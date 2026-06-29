// Underwriting orchestrator — wires indexer → zktls → scoring → signer into a
// single pass for one agent, the end-to-end pipeline the API exposes.

import { indexRevenue, type RevenueReport } from "./indexer/index.js";
import { proveOffchainRevenue, type ProofResult } from "./zktls/index.js";
import { computeScoreResult, type ScoreResult } from "./scoring/index.js";
import { attestScore, submitScore, type Attestation, type SubmitResult } from "./signer/index.js";

export interface UnderwritingResult {
  agent: string;
  revenue: RevenueReport;
  proof: ProofResult | null;
  proofError: string | null;
  score: ScoreResult;
  attestation: Attestation;
  submission: SubmitResult;
  underwroteAt: number;
}

// Latest result per agent (MVP in-memory store; the lender dashboard lists these).
const store = new Map<string, UnderwritingResult>();

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

  let proof: ProofResult | null = null;
  let proofError: string | null = null;
  if (!opts.skipProof) {
    try {
      proof = await proveOffchainRevenue();
    } catch (e) {
      proofError = e instanceof Error ? e.message : String(e);
    }
  }

  const score = computeScoreResult({
    agent,
    onchainRevenueStroops: revenue.totalRevenueStroops,
    distinctPayers: revenue.distinctPayers,
    offchainRevenueStroops: proof?.amountStroops ?? "0",
    offchainVerified: proof?.verified ?? false,
  });

  const attestation = attestScore(score);
  const submission = await submitScore(score);

  const result: UnderwritingResult = {
    agent,
    revenue,
    proof,
    proofError,
    score,
    attestation,
    submission,
    underwroteAt: Math.floor(Date.now() / 1000),
  };
  store.set(agent, result);
  return result;
}

export function getResult(agent: string): UnderwritingResult | undefined {
  return store.get(agent);
}

export function listResults(): UnderwritingResult[] {
  return [...store.values()];
}
