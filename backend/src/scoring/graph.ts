// scoring/graph.ts — independence signals computed over the persisted payment
// graph (Postgres). These are the full-history equivalents of the ~24h RPC
// lookups in independence.ts: account age, external out-degree, funding ancestry
// (loop detection as one recursive SQL query), and reciprocated flow.

import { query } from "../db/index.js";
import { config } from "../config.js";

export interface GraphPayment {
  from: string;
  amount: string;
  ledger: number;
  txHash: string;
}

/** All USDC the agent RECEIVED (revenue), excluding self-pay + known hubs. */
export async function graphRevenue(
  agent: string,
  sinceLedger = 0,
): Promise<{ payments: GraphPayment[]; payers: string[]; totalStroops: string }> {
  const exclude = [...config.excludeAddresses, agent];
  const rows = await query<{ from_addr: string; amount: string; ledger: number; tx_hash: string }>(
    `SELECT from_addr, amount::text, ledger, tx_hash
       FROM payments
      WHERE to_addr = $1 AND ledger >= $2 AND from_addr <> ALL($3)
      ORDER BY ledger ASC`,
    [agent, sinceLedger, exclude],
  );
  const payers = new Set<string>();
  let total = 0n;
  const payments = rows.map((r) => {
    payers.add(r.from_addr);
    total += BigInt(r.amount);
    return { from: r.from_addr, amount: r.amount, ledger: r.ledger, txHash: r.tx_hash };
  });
  return { payments, payers: [...payers], totalStroops: total.toString() };
}

/** Account age in days from the earliest transfer we've ever seen touch it. */
export async function ageDays(address: string): Promise<number> {
  const rows = await query<{ first_seen_time: string }>(
    "SELECT first_seen_time FROM accounts WHERE address = $1",
    [address],
  );
  if (!rows[0]) return 0;
  return Math.max(0, (Date.now() - new Date(rows[0].first_seen_time).getTime()) / 86_400_000);
}

/** Distinct counterparties (both directions) EXCLUDING the agent, this payer,
 *  the agent's co-payers, and known hubs — full-history external out-degree. */
export async function externalOutDegree(
  address: string,
  coPayers: string[],
  agent: string,
): Promise<number> {
  const exclude = [...config.excludeAddresses, agent, address, ...coPayers];
  const rows = await query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM (
        SELECT to_addr   AS cp FROM payments WHERE from_addr = $1
        UNION
        SELECT from_addr AS cp FROM payments WHERE to_addr   = $1
      ) t
      WHERE cp <> ALL($2)`,
    [address, exclude],
  );
  return Number(rows[0]?.n ?? 0);
}

/** Total USDC the agent paid this payer back (reciprocity / net-flow). */
export async function sumPaid(from: string, to: string): Promise<bigint> {
  const rows = await query<{ s: string }>(
    "SELECT COALESCE(SUM(amount),0)::text AS s FROM payments WHERE from_addr = $1 AND to_addr = $2",
    [from, to],
  );
  return BigInt(rows[0]?.s ?? "0");
}

/**
 * Does `payer`'s USDC funding trace back to `agent` within `maxHops`? Loop
 * detection over the full graph as a single recursive walk — the DB equivalent
 * of the RPC k-hop search, but complete and fast. Known hubs are not traversed.
 */
export async function fundedByAgent(
  payer: string,
  agent: string,
  maxHops = 3,
): Promise<boolean> {
  const rows = await query<{ funded: boolean }>(
    `WITH RECURSIVE anc(addr, depth) AS (
        SELECT $1::text, 0
        UNION
        SELECT p.from_addr, a.depth + 1
          FROM anc a
          JOIN payments p ON p.to_addr = a.addr
         WHERE a.depth < $3 AND p.from_addr <> ALL($4)
     )
     SELECT EXISTS(SELECT 1 FROM anc WHERE addr = $2 AND depth > 0) AS funded`,
    [payer, agent, maxHops, config.excludeAddresses],
  );
  return rows[0]?.funded ?? false;
}
