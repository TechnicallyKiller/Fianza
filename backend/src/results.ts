// results/ — persistence for the latest underwriting result per agent.
//
// Replaces the in-memory Map (which lost all state on restart) with Postgres
// when DATABASE_URL is set, falling back to in-memory otherwise so local/dev
// runs need no database. The full result is stored as JSONB; a few hot columns
// are duplicated for the cheap /agents listing.

import { dbConfigured, query } from "./db/index.js";
import type { UnderwritingResult } from "./underwrite.js";

const mem = new Map<string, UnderwritingResult>();

export async function saveResult(r: UnderwritingResult): Promise<void> {
  if (!dbConfigured()) {
    mem.set(r.agent, r);
    return;
  }
  await query(
    `INSERT INTO underwriting_results
       (agent, score, tier, limit_usdc, revenue_usdc, distinct_payers, underwrote_at, result, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, now())
     ON CONFLICT (agent) DO UPDATE SET
       score = EXCLUDED.score, tier = EXCLUDED.tier, limit_usdc = EXCLUDED.limit_usdc,
       revenue_usdc = EXCLUDED.revenue_usdc, distinct_payers = EXCLUDED.distinct_payers,
       underwrote_at = EXCLUDED.underwrote_at, result = EXCLUDED.result, updated_at = now()`,
    [
      r.agent,
      r.score.score,
      r.score.tier,
      r.score.limitUsdc,
      r.score.revenueUsdc,
      r.revenue.distinctPayers,
      r.underwroteAt,
      JSON.stringify(r),
    ],
  );
}

export async function getResult(agent: string): Promise<UnderwritingResult | undefined> {
  if (!dbConfigured()) return mem.get(agent);
  const rows = await query<{ result: UnderwritingResult }>(
    "SELECT result FROM underwriting_results WHERE agent = $1",
    [agent],
  );
  return rows[0]?.result; // pg returns JSONB already parsed
}

// Backstop cap so this query can't unbounded-scan as the underwritten set
// grows well past demo scale — /agents in server.ts does real limit/offset
// pagination on top of this for callers that want fewer than the cap.
const LIST_RESULTS_CAP = 500;

export async function listResults(): Promise<UnderwritingResult[]> {
  if (!dbConfigured()) return [...mem.values()];
  const rows = await query<{ result: UnderwritingResult }>(
    `SELECT result FROM underwriting_results ORDER BY updated_at DESC LIMIT ${LIST_RESULTS_CAP}`,
  );
  return rows.map((r) => r.result);
}
