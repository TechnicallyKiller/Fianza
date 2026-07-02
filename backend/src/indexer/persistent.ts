// indexer/persistent.ts — stream USDC SAC transfers into the Postgres payment
// graph ONCE. Unlike the on-demand `indexRevenue` (per-agent, ~24h window), this
// ingests the whole transfer graph incrementally and keeps it, so the moat can
// query full history (age, out-degree, funding ancestry, reciprocity).
//
// Run:  npx tsx src/indexer/persistent.ts [fromLedger] [maxPages]

import { rpc, xdr, scValToNative } from "@stellar/stellar-sdk";
import { config } from "../config.js";
import { query, migrate, closePool } from "../db/index.js";

const server = new rpc.Server(config.sorobanRpcUrl, { allowHttp: false });
const SYNC_ID = "usdc_transfers";

function native(t: unknown): unknown {
  const sv = typeof t === "string" ? xdr.ScVal.fromXDR(t, "base64") : (t as xdr.ScVal);
  return scValToNative(sv);
}

/** Robustly extract a transfer amount. Most SAC transfers carry the amount as a
 *  bare i128; muxed-destination transfers wrap it as `{amount, to_muxed_id}`.
 *  Returns null for shapes we don't recognise (skip, don't crash the ingest). */
function amountOf(value: unknown): bigint | null {
  const v = native(value);
  try {
    if (typeof v === "bigint" || typeof v === "number" || typeof v === "string") return BigInt(v);
    if (v && typeof v === "object" && "amount" in v) return BigInt((v as { amount: unknown }).amount as never);
  } catch {
    /* fall through */
  }
  return null;
}

async function getEventsRetry(
  req: rpc.Server.GetEventsRequest,
  attempts = 4,
): Promise<rpc.Api.GetEventsResponse> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await server.getEvents(req);
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (!/fetch failed|ECONN|ETIMEDOUT|socket|network|EAI_AGAIN|other side closed/i.test(msg)) {
        throw e;
      }
      await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    }
  }
  throw lastErr;
}

async function lastSynced(): Promise<number | null> {
  const rows = await query<{ last_ledger: number }>(
    "SELECT last_ledger FROM sync_state WHERE id=$1",
    [SYNC_ID],
  );
  return rows[0]?.last_ledger ?? null;
}

async function setSynced(ledger: number): Promise<void> {
  await query(
    `INSERT INTO sync_state (id, last_ledger, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (id) DO UPDATE SET last_ledger = EXCLUDED.last_ledger, updated_at = now()`,
    [SYNC_ID, ledger],
  );
}

interface Row {
  eventId: string;
  from: string;
  to: string;
  amount: string;
  ledger: number;
  time: string;
  txHash: string;
}

async function flush(rows: Row[]): Promise<void> {
  if (rows.length === 0) return;
  await query(
    `INSERT INTO payments (event_id, from_addr, to_addr, amount, ledger, ledger_time, tx_hash)
     SELECT * FROM UNNEST($1::text[], $2::text[], $3::text[], $4::numeric[], $5::int[], $6::timestamptz[], $7::text[])
     ON CONFLICT (event_id) DO NOTHING`,
    [
      rows.map((r) => r.eventId),
      rows.map((r) => r.from),
      rows.map((r) => r.to),
      rows.map((r) => r.amount),
      rows.map((r) => r.ledger),
      rows.map((r) => r.time),
      rows.map((r) => r.txHash),
    ],
  );

  // Aggregate account first/last-seen per address (dedupe so ON CONFLICT never
  // touches the same row twice in one statement).
  const acct = new Map<string, { minL: number; minT: string; maxL: number }>();
  for (const r of rows) {
    for (const a of [r.from, r.to]) {
      const cur = acct.get(a);
      if (!cur) acct.set(a, { minL: r.ledger, minT: r.time, maxL: r.ledger });
      else {
        if (r.ledger < cur.minL) {
          cur.minL = r.ledger;
          cur.minT = r.time;
        }
        if (r.ledger > cur.maxL) cur.maxL = r.ledger;
      }
    }
  }
  const addrs = [...acct.keys()];
  await query(
    `INSERT INTO accounts (address, first_seen_ledger, first_seen_time, last_seen_ledger)
     SELECT * FROM UNNEST($1::text[], $2::int[], $3::timestamptz[], $4::int[])
     ON CONFLICT (address) DO UPDATE SET
       first_seen_ledger = LEAST(accounts.first_seen_ledger, EXCLUDED.first_seen_ledger),
       first_seen_time   = LEAST(accounts.first_seen_time, EXCLUDED.first_seen_time),
       last_seen_ledger  = GREATEST(accounts.last_seen_ledger, EXCLUDED.last_seen_ledger)`,
    [
      addrs,
      addrs.map((a) => acct.get(a)!.minL),
      addrs.map((a) => acct.get(a)!.minT),
      addrs.map((a) => acct.get(a)!.maxL),
    ],
  );
}

export interface IngestResult {
  inserted: number;
  pages: number;
  fromLedger: number;
  toLedger: number;
}

/**
 * Ingest USDC transfers into the graph. Resumes from the stored cursor unless
 * `fromLedger` is given; clamps into the RPC retention window if it overshoots.
 */
export async function ingest(opts: { fromLedger?: number; maxPages?: number } = {}): Promise<IngestResult> {
  await migrate();
  const latest = (await server.getLatestLedger()).sequence;
  const cursorLedger = await lastSynced();
  let start = opts.fromLedger ?? (cursorLedger !== null ? cursorLedger + 1 : Math.max(1, latest - 1000));
  const maxPages = opts.maxPages ?? 100;

  const transferSym = xdr.ScVal.scvSymbol("transfer").toXDR("base64");
  const filters = [
    { type: "contract" as const, contractIds: [config.usdcSac], topics: [[transferSym, "*", "*", "*"]] },
  ];

  let inserted = 0;
  let pages = 0;
  let maxLedgerSeen = start - 1;
  let cursor: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    let resp: rpc.Api.GetEventsResponse;
    try {
      resp = cursor
        ? await getEventsRetry({ filters, limit: 200, cursor } as rpc.Server.GetEventsRequest)
        : await getEventsRetry({ startLedger: start, filters, limit: 200 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const m = /ledger range:\s*(\d+)\s*-\s*(\d+)/.exec(msg);
      if (m && !cursor) {
        start = Math.min(Math.max(start, Number(m[1])), Number(m[2]));
        maxLedgerSeen = start - 1;
        resp = await getEventsRetry({ startLedger: start, filters, limit: 200 });
      } else {
        throw e;
      }
    }
    const events = resp.events ?? [];
    const rows: Row[] = [];
    for (const e of events) {
      const topics = (e.topic as unknown[]).map(native);
      const [, from, to] = topics as [string, string, string, string];
      if (typeof from !== "string" || typeof to !== "string") continue;
      const amount = amountOf(e.value);
      if (amount === null) continue; // non-standard transfer shape — skip
      rows.push({
        eventId: e.id,
        from,
        to,
        amount: amount.toString(),
        ledger: e.ledger,
        time: e.ledgerClosedAt,
        txHash: e.txHash,
      });
      if (e.ledger > maxLedgerSeen) maxLedgerSeen = e.ledger;
    }
    await flush(rows);
    inserted += rows.length;
    pages++;
    cursor = resp.cursor;
    if (!cursor || events.length === 0) break;
  }

  if (maxLedgerSeen >= start) await setSynced(maxLedgerSeen);
  return { inserted, pages, fromLedger: start, toLedger: maxLedgerSeen };
}

// CLI entry: npx tsx src/indexer/persistent.ts [fromLedger] [maxPages]
if (import.meta.url === `file://${process.argv[1]}`) {
  const fromLedger = process.argv[2] ? Number(process.argv[2]) : undefined;
  const maxPages = process.argv[3] ? Number(process.argv[3]) : undefined;
  ingest({ fromLedger, maxPages })
    .then((r) => {
      console.log("ingest:", JSON.stringify(r));
      return closePool();
    })
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
