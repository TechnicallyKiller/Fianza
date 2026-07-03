// Underwriting orchestrator — wires indexer → zktls → scoring → signer into a
// single pass for one agent, the end-to-end pipeline the API exposes.

import { indexRevenue, type RevenueReport } from "./indexer/index.js";
import type { ProofResult } from "./zktls/index.js";
import { computeScoreResult, type ScoreResult } from "./scoring/index.js";
import { analyzeIndependence, type IndependenceResult } from "./scoring/independence.js";
import { attestScore, submitScore, type Attestation, type SubmitResult } from "./signer/index.js";
import { readRepayments } from "./chain/registry.js";
import { saveResult, getResult, listResults } from "./results.js";
import { dbConfigured } from "./db/index.js";
import { graphRevenue } from "./scoring/graph.js";
import { horizonUsdcTransfers } from "./indexer/horizon.js";
import { config } from "./config.js";

const STROOPS = 10_000_000;
// Below this, treat RPC/graph revenue as "thin" and worth checking Horizon's
// full history before accepting a near-zero result — an agent whose real
// activity predates our ~24h RPC window and our own graph's start date would
// otherwise always look unrated, no matter how real its history is.
const THIN_REVENUE_STROOPS = 5_000_000n; // 0.5 USDC

/**
 * Revenue from Horizon's FULL account history (indexer/horizon.ts) — not the
 * RPC's ~24h window, not our own graph's forward-collected data. Slower (a
 * paginated REST walk of one account's whole history), so this is only called
 * as a last-resort fallback when the faster sources come up thin. Resilient:
 * any failure (rate limit, network) just means we keep whatever the faster
 * sources found, never breaks the underwrite pass.
 */
async function horizonRevenueReport(agent: string): Promise<RevenueReport | null> {
  const exclude = new Set(config.excludeAddresses);
  const transfers = await horizonUsdcTransfers(agent);
  const payerSet = new Set<string>();
  let total = 0n;
  const payments: RevenueReport["payments"] = [];
  for (const t of transfers) {
    if (t.to !== agent || t.from === agent || exclude.has(t.from)) continue;
    const amt = BigInt(t.amount);
    total += amt;
    payerSet.add(t.from);
    payments.push({ from: t.from, amount: t.amount, ledger: 0, txHash: "" });
  }
  if (payerSet.size === 0) return null;
  return {
    agent,
    totalRevenueStroops: total.toString(),
    totalRevenueUsdc: Number(total) / STROOPS,
    distinctPayers: payerSet.size,
    payers: [...payerSet],
    payments,
    windowFromLedger: 0,
    windowToLedger: 0,
  };
}

/**
 * Revenue over the agent's full history from the persisted payment graph
 * (Track C), not the RPC's ~24h event-retention window. An agent's real
 * payments age out of the RPC window in about a day; the graph remembers them
 * as long as the indexer has been running. Falls back to null (caller uses the
 * RPC path) when no DB is configured or the graph has nothing for this agent.
 */
async function graphRevenueReport(agent: string): Promise<RevenueReport | null> {
  if (!dbConfigured()) return null;
  const g = await graphRevenue(agent, 0);
  if (g.payers.length === 0) return null;
  const total = BigInt(g.totalStroops);
  return {
    agent,
    totalRevenueStroops: g.totalStroops,
    totalRevenueUsdc: Number(total) / STROOPS,
    distinctPayers: g.payers.length,
    payers: g.payers,
    payments: g.payments,
    windowFromLedger: 0,
    windowToLedger: g.payments.at(-1)?.ledger ?? 0,
  };
}

export { getResult, listResults };

export interface UnderwritingResult {
  agent: string;
  revenue: RevenueReport;
  /** Counterparty-independence (anti-Sybil) analysis; null if it couldn't run. */
  independence: IndependenceResult | null;
  proof: ProofResult | null;
  proofError: string | null;
  score: ScoreResult;
  attestation: Attestation;
  submission: SubmitResult;
  underwroteAt: number;
}

export interface UnderwriteOptions {
  /** Skip the (slow, on-chain) Reclaim proof — useful for quick revenue-only runs. */
  skipProof?: boolean;
  /** Explicit start ledger for indexing (e.g. near a known payment). */
  fromLedger?: number;
}

export async function underwrite(
  agent: string,
  opts: UnderwriteOptions = {},
): Promise<UnderwritingResult> {
  const [rpcRevenue, graphRev] = await Promise.all([
    indexRevenue(agent, { fromLedger: opts.fromLedger }),
    graphRevenueReport(agent).catch(() => null),
  ]);
  // Prefer whichever source has seen MORE revenue — the graph usually wins
  // once an agent's history is older than the RPC's retention window, but the
  // RPC path stays authoritative for agents newer than the graph's backfill.
  let revenue =
    graphRev && BigInt(graphRev.totalRevenueStroops) > BigInt(rpcRevenue.totalRevenueStroops)
      ? graphRev
      : rpcRevenue;

  // Both fast sources came up thin — before accepting that, check Horizon's
  // full history. Catches agents whose real activity predates both the RPC's
  // ~24h window and our own graph's start date (e.g. an agent that earned
  // real revenue weeks ago and has been quiet since).
  if (BigInt(revenue.totalRevenueStroops) < THIN_REVENUE_STROOPS) {
    try {
      const horizonRev = await horizonRevenueReport(agent);
      if (horizonRev && BigInt(horizonRev.totalRevenueStroops) > BigInt(revenue.totalRevenueStroops)) {
        revenue = horizonRev;
      }
    } catch {
      /* Horizon fallback is best-effort — keep whatever the fast paths found */
    }
  }

  // Counterparty independence: only revenue from payers NOT funded by the agent
  // counts. Defeats the self-pay Sybil attack. Resilient — on failure we fall
  // back to raw revenue rather than break the pass.
  let independence: IndependenceResult | null = null;
  try {
    independence = await analyzeIndependence(
      agent,
      revenue,
      opts.fromLedger ?? revenue.windowFromLedger,
    );
  } catch {
    independence = null;
  }
  const onchainRevenueStroops = independence
    ? independence.independentRevenueStroops
    : revenue.totalRevenueStroops;
  const distinctPayers = independence
    ? independence.independentPayers.length
    : revenue.distinctPayers;

  let proof: ProofResult | null = null;
  let proofError: string | null = null;
  if (!opts.skipProof) {
    try {
      // Lazy import: @reclaimprotocol/zk-fetch needs a manual asset-download step
      // (`npm run download-zk-files`) that fresh deploy environments may skip. A
      // failure here must only break the proof step, never the whole server.
      const { proveOffchainRevenue } = await import("./zktls/index.js");
      proof = await proveOffchainRevenue();
    } catch (e) {
      proofError = e instanceof Error ? e.message : String(e);
    }
  }

  // Proven repayment history (on-time lifts the score, a default collapses it).
  // Resilient: a read failure falls back to "no history".
  const repayments = await readRepayments(agent);

  const score = computeScoreResult({
    agent,
    onchainRevenueStroops,
    distinctPayers,
    offchainRevenueStroops: proof?.amountStroops ?? "0",
    offchainVerified: proof?.verified ?? false,
    repayments,
  });

  const attestation = attestScore(score);
  // Publishing on-chain can fail for benign reasons (agent not registered yet,
  // RPC hiccup). Never let it break the underwriting pass — record and continue.
  let submission: SubmitResult;
  try {
    submission = await submitScore(score);
  } catch (e) {
    submission = { submitted: false, reason: e instanceof Error ? e.message : String(e) };
  }

  const result: UnderwritingResult = {
    agent,
    revenue,
    independence,
    proof,
    proofError,
    score,
    attestation,
    submission,
    underwroteAt: Math.floor(Date.now() / 1000),
  };
  await saveResult(result);
  return result;
}
