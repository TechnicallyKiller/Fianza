// Tael revenue indexing — read a builder's Tael-earned USDC directly off
// Stellar, so TrustLine can underwrite credit against it.
//
// Tael (rahulsainlll/tael-protocol) settles x402 payments as CLASSIC Stellar
// `payment` operations (Operation.payment), not Soroban SAC transfer events —
// a different on-chain shape than TrustLine's own x402 revenue (indexer/index.ts
// reads SAC events). Every Tael settlement carries a fixed Stellar text memo
// (TAEL_MEMO = "tael", packages/stellar/src/pay.ts in their repo), which is
// exactly what makes a transfer attributable to Tael from chain data alone —
// this module is the reader for that convention.
//
// Also note: Tael's testnet USDC issuer is its OWN (config.tael.usdcIssuer),
// distinct from TrustLine's testnet USDC (config.usdcIssuer) — same "different
// testnet issuer" fragmentation already documented for DeFindex. On mainnet
// both converge on Circle USDC and this distinction disappears.

import { config } from "../config.js";
import type { RevenueReport } from "../indexer/index.js";

interface HorizonPaymentOp {
  type: string;
  created_at: string;
  transaction_hash: string;
  asset_type?: string;
  asset_code?: string;
  asset_issuer?: string;
  from?: string;
  to?: string;
  amount?: string;
  transaction?: { memo_type?: string; memo?: string };
}

/**
 * Walk `account`'s full Horizon operation history and return every classic
 * USDC payment received where the settling transaction's memo matches Tael's
 * convention. `?join=transactions` embeds each op's transaction (incl. memo)
 * so this is one paginated call chain, no N+1 transaction lookups.
 */
async function taelPaymentsReceived(
  account: string,
  maxPages = 15,
): Promise<{ from: string; amount: string; txHash: string; createdAt: string }[]> {
  const { usdcIssuer, memo } = config.tael;
  if (!usdcIssuer) return []; // not configured — caller treats this as "no Tael revenue"

  const out: { from: string; amount: string; txHash: string; createdAt: string }[] = [];
  let url =
    `${config.horizonUrl}/accounts/${account}/operations` +
    `?order=asc&limit=200&join=transactions`;

  for (let page = 0; page < maxPages; page++) {
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 404) return out; // account has no history at all
      throw new Error(`Horizon ${res.status} fetching operations for ${account}`);
    }
    const body = (await res.json()) as {
      _embedded?: { records?: HorizonPaymentOp[] };
      _links?: { next?: { href?: string } };
    };
    const records = body._embedded?.records ?? [];

    for (const op of records) {
      if (op.type !== "payment") continue;
      if (op.asset_type === "native") continue;
      if (op.asset_code !== "USDC" || op.asset_issuer !== usdcIssuer) continue;
      if (op.to !== account || !op.from || !op.amount) continue;
      if (op.transaction?.memo_type !== "text" || op.transaction.memo !== memo) continue;

      out.push({
        from: op.from,
        amount: BigInt(Math.round(Number(op.amount) * 1e7)).toString(),
        txHash: op.transaction_hash,
        createdAt: op.created_at,
      });
    }

    const next = body._links?.next?.href;
    if (!next || records.length === 0) break;
    url = next;
  }
  return out;
}

/**
 * An agent's Tael-earned revenue, shaped as a {@link RevenueReport} so it can
 * feed the same underwriting pass as TrustLine's own x402 revenue sources
 * (indexRevenue / graphRevenueReport / horizonRevenueReport in underwrite.ts).
 * Self-pay and configured exclusions are filtered the same way those are.
 */
export async function taelRevenueReport(agent: string): Promise<RevenueReport | null> {
  if (!config.tael.usdcIssuer) return null;

  const exclude = new Set(config.excludeAddresses);
  const payments = await taelPaymentsReceived(agent);

  const payerSet = new Set<string>();
  let total = 0n;
  const reportPayments: RevenueReport["payments"] = [];
  for (const p of payments) {
    if (p.from === agent || exclude.has(p.from)) continue;
    total += BigInt(p.amount);
    payerSet.add(p.from);
    reportPayments.push({ from: p.from, amount: p.amount, ledger: 0, txHash: p.txHash });
  }
  if (payerSet.size === 0) return null;

  return {
    agent,
    totalRevenueStroops: total.toString(),
    totalRevenueUsdc: Number(total) / 10 ** config.usdcDecimals,
    distinctPayers: payerSet.size,
    payers: [...payerSet],
    payments: reportPayments,
    windowFromLedger: 0,
    windowToLedger: 0,
  };
}
