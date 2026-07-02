// Underwriting orchestrator — wires indexer → zktls → scoring → signer into a
// single pass for one agent, the end-to-end pipeline the API exposes.

import { indexRevenue, type RevenueReport } from "./indexer/index.js";
import type { ProofResult } from "./zktls/index.js";
import { computeScoreResult, type ScoreResult } from "./scoring/index.js";
import { analyzeIndependence, type IndependenceResult } from "./scoring/independence.js";
import { attestScore, submitScore, type Attestation, type SubmitResult } from "./signer/index.js";
import { readRepayments } from "./chain/registry.js";
import { saveResult, getResult, listResults } from "./results.js";

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
  const revenue = await indexRevenue(agent, { fromLedger: opts.fromLedger });

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
