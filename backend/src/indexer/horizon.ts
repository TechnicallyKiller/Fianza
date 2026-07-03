// indexer/horizon.ts — deep-history USDC transfer lookup via Horizon.
//
// The Soroban RPC's getEvents (indexer/index.ts) only retains ~24h of events;
// our own persisted graph (Track C) only has data from whenever WE started
// ingesting. Horizon is different: it retains an account's FULL operation
// history indefinitely, and its /operations endpoint returns the raw
// invoke_host_function call params (contract address, function symbol, args)
// for every historical Soroban contract call — decodable with the exact same
// scValToNative pattern used everywhere else in this codebase. Confirmed live
// against a real mainnet agent with 3-month-old history before building this.
//
// This is a FALLBACK, not a primary path: it's slower (paginated REST calls
// against one account's full history) than the RPC/graph paths, so it's only
// invoked when both of those come up empty/thin for an agent (see
// underwrite.ts). Never breaks the underwrite pass on failure — resilient by
// design, matching every other data source in this pipeline.

import { xdr, scValToNative } from "@stellar/stellar-sdk";
import { config } from "../config.js";

export interface HorizonTransfer {
  from: string;
  to: string;
  amount: string; // stroops, as a string
  ledgerCloseTime: string;
}

function decodeParam(b64: string): unknown {
  try {
    return scValToNative(xdr.ScVal.fromXDR(b64, "base64"));
  } catch {
    return undefined;
  }
}

interface HorizonOp {
  type: string;
  created_at: string;
  parameters?: { value: string; type: string }[];
  // Classic `payment` operation fields (present when type === "payment").
  asset_type?: string;
  asset_code?: string;
  from?: string;
  to?: string;
  amount?: string;
}

/**
 * All USDC transfers touching `account` (either direction), read from
 * Horizon's full operation history. Covers BOTH forms a USDC transfer can
 * take on this protocol — a Soroban `invoke_host_function` SAC `transfer`
 * call, AND a classic `payment` operation moving the same asset (these are
 * different Horizon operation types even though both settle the same USDC;
 * the RPC-events indexer sees them as one thing because the SAC contract
 * emits the same transfer event either way, but Horizon's operation listing
 * does not — missing this was a real bug caught while testing this module
 * against Scout's real history). Paginated with a page cap so a very active
 * account can't hang the request indefinitely.
 */
export async function horizonUsdcTransfers(
  account: string,
  maxPages = 15,
): Promise<HorizonTransfer[]> {
  const transfers: HorizonTransfer[] = [];
  let url = `${config.horizonUrl}/accounts/${account}/operations?order=asc&limit=200`;

  for (let page = 0; page < maxPages; page++) {
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 404) return transfers; // account has no history at all
      throw new Error(`Horizon ${res.status} fetching operations for ${account}`);
    }
    const body = (await res.json()) as {
      _embedded?: { records?: HorizonOp[] };
      _links?: { next?: { href?: string } };
    };
    const records = body._embedded?.records ?? [];

    for (const op of records) {
      if (op.type === "invoke_host_function" && op.parameters && op.parameters.length >= 5) {
        // Flattened by Horizon as [contract_address, function_symbol, ...args].
        const [contractParam, fnParam, fromParam, toParam, amountParam] = op.parameters;
        const contractAddr = decodeParam(contractParam.value);
        const fnName = decodeParam(fnParam.value);
        if (contractAddr !== config.usdcSac || fnName !== "transfer") continue;

        const from = decodeParam(fromParam.value);
        const to = decodeParam(toParam.value);
        const amount = decodeParam(amountParam.value);
        if (typeof from !== "string" || typeof to !== "string") continue;
        const amt =
          typeof amount === "bigint" ? amount : typeof amount === "number" ? BigInt(amount) : null;
        if (amt === null) continue;
        transfers.push({ from, to, amount: amt.toString(), ledgerCloseTime: op.created_at });
      } else if (op.type === "payment" && op.asset_code === "USDC" && op.from && op.to && op.amount) {
        const amt = BigInt(Math.round(Number(op.amount) * 1e7));
        transfers.push({ from: op.from, to: op.to, amount: amt.toString(), ledgerCloseTime: op.created_at });
      }
    }

    const next = body._links?.next?.href;
    if (!next || records.length === 0) break;
    url = next;
  }
  return transfers;
}

/** Real account-creation date from Horizon (used for the payer age signal). */
export async function horizonAccountAgeDays(account: string): Promise<number> {
  try {
    const res = await fetch(
      `${config.horizonUrl}/accounts/${account}/operations?order=asc&limit=1`,
    );
    if (!res.ok) return 0;
    const body = (await res.json()) as { _embedded?: { records?: { created_at?: string }[] } };
    const createdAt = body._embedded?.records?.[0]?.created_at;
    if (!createdAt) return 0;
    return Math.max(0, (Date.now() - new Date(createdAt).getTime()) / 86_400_000);
  } catch {
    return 0;
  }
}
