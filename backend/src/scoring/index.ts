// scoring/ — composite revenue-coverage score.
//
// Combines indexed on-chain x402 revenue (indexer/) with one Reclaim-verified
// off-chain revenue figure (zktls/) into a score (0..850) + tier. The tier
// banding, limit multiples, and APR mirror the on-chain `revenue_math` library
// exactly, so the engine and the contracts always agree.
//
// Anti-Sybil (README risk model): on-chain revenue only counts when it comes
// from at least MIN_COUNTERPARTIES distinct payers (faking N independent wallets
// is cheap); zkTLS-proved off-chain revenue is weighted more heavily and is not
// subject to the counterparty minimum (faking a real Stripe account is harder).

const STROOPS = 10_000_000; // 1 USDC, 7 decimals

export type Tier = "A" | "B" | "C" | "Unrated";

export interface ScoreInputs {
  agent: string;
  onchainRevenueStroops: string;
  distinctPayers: number;
  offchainRevenueStroops: string;
  offchainVerified: boolean;
}

export interface ScoreResult {
  agent: string;
  score: number;
  tier: Tier;
  /** Effective verified revenue used to size credit (stroops + USDC). */
  revenueStroops: string;
  revenueUsdc: number;
  limitStroops: string;
  limitUsdc: number;
  aprBps: number;
  distinctPayers: number;
  minCounterparties: number;
  onchainCounts: boolean;
  components: {
    onchainUsdc: number;
    offchainUsdc: number;
    offchainWeight: number;
  };
  issuedAt: number;
}

// Tunable policy (env-overridable in a fuller build).
const MIN_COUNTERPARTIES = Number(process.env.MIN_COUNTERPARTIES ?? "3");
const OFFCHAIN_WEIGHT = 1.5; // zkTLS revenue trusted more than raw on-chain
const ONCHAIN_WEIGHT = 1.0;

// Banding mirrors revenue_math::tier_from_score and limit/apr policy.
function tierFromScore(score: number): Tier {
  if (score >= 750) return "A";
  if (score >= 650) return "B";
  if (score >= 550) return "C";
  return "Unrated";
}

function limitMultiple(tier: Tier): number {
  return { A: 3, B: 2, C: 1, Unrated: 0 }[tier];
}

function aprBps(tier: Tier): number {
  return { A: 600, B: 850, C: 1200, Unrated: 0 }[tier];
}

/** Map effective verified USDC revenue + payer diversity to a 0..850 score. */
function computeScore(effectiveUsdc: number, distinctPayers: number, onchainCounts: boolean): number {
  let base: number;
  if (effectiveUsdc >= 25_000) base = 760;
  else if (effectiveUsdc >= 10_000) base = 680;
  else if (effectiveUsdc >= 2_500) base = 600;
  else if (effectiveUsdc >= 500) base = 560;
  else base = 400;

  // Counterparty-diversity bonus (anti-Sybil): independent payers build trust.
  const bonus = Math.min(distinctPayers, 10) * 5; // up to +50

  // If on-chain revenue failed the counterparty minimum and there's no verified
  // off-chain revenue to lean on, cap below the lending threshold.
  let score = base + bonus;
  if (!onchainCounts && effectiveUsdc < 500) score = Math.min(score, 540);

  return Math.max(0, Math.min(850, Math.round(score)));
}

export function computeScoreResult(inputs: ScoreInputs): ScoreResult {
  const onchainUsdc = Number(BigInt(inputs.onchainRevenueStroops)) / STROOPS;
  const offchainUsdc = Number(BigInt(inputs.offchainRevenueStroops)) / STROOPS;

  // On-chain revenue only counts past the counterparty minimum.
  const onchainCounts = inputs.distinctPayers >= MIN_COUNTERPARTIES;
  const offchainWeight = inputs.offchainVerified ? OFFCHAIN_WEIGHT : 0;

  const effectiveUsdc =
    (onchainCounts ? onchainUsdc * ONCHAIN_WEIGHT : 0) + offchainUsdc * offchainWeight;

  const score = computeScore(effectiveUsdc, inputs.distinctPayers, onchainCounts);
  const tier = tierFromScore(score);

  // Limit is sized off the effective verified revenue × tier multiple.
  const revenueStroops = BigInt(Math.round(effectiveUsdc * STROOPS));
  const limitStroops = revenueStroops * BigInt(limitMultiple(tier));

  return {
    agent: inputs.agent,
    score,
    tier,
    revenueStroops: revenueStroops.toString(),
    revenueUsdc: effectiveUsdc,
    limitStroops: limitStroops.toString(),
    limitUsdc: Number(limitStroops) / STROOPS,
    aprBps: aprBps(tier),
    distinctPayers: inputs.distinctPayers,
    minCounterparties: MIN_COUNTERPARTIES,
    onchainCounts,
    components: { onchainUsdc, offchainUsdc, offchainWeight },
    issuedAt: Math.floor(Date.now() / 1000),
  };
}
