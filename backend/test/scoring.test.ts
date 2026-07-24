// Unit tests for the money math in src/scoring/index.ts — tier bands, the
// credit ramp, default collapse, and counterparty gating. This is the one
// piece of business-critical logic that had ZERO test coverage (flagged in
// the full-product audit): it decides an agent's score, tier, APR, and both
// the tier-ceiling limit and the currently-drawable ramped limit. It mirrors
// contracts/libraries/revenue_math exactly on purpose, so a regression here
// silently desyncs the API's numbers from what the vault contract enforces.
//
// MIN_COUNTERPARTIES / SCORE_BAND_DIVISOR are read from env at module load —
// tests run with the repo's default env (backend/.env, MIN_COUNTERPARTIES=3,
// no SCORE_BAND_DIVISOR override => divisor 1, mainnet-scale bands) unless a
// test explicitly documents otherwise.

import { test } from "node:test";
import assert from "node:assert/strict";
import { computeScoreResult, type ScoreInputs } from "../src/scoring/index.js";

const STROOPS = 10_000_000n;

function usdcStroops(usdc: number): string {
  return BigInt(Math.round(usdc * Number(STROOPS))).toString();
}

function baseInputs(overrides: Partial<ScoreInputs> = {}): ScoreInputs {
  return {
    agent: "GTESTAGENT",
    onchainRevenueStroops: "0",
    distinctPayers: 0,
    offchainRevenueStroops: "0",
    offchainVerified: false,
    ...overrides,
  };
}

// ---- Counterparty gating (anti-Sybil floor) --------------------------------

test("below MIN_COUNTERPARTIES: on-chain revenue does not count toward the score", () => {
  const r = computeScoreResult(
    baseInputs({ onchainRevenueStroops: usdcStroops(50_000), distinctPayers: 2 }),
  );
  assert.equal(r.onchainCounts, false);
  assert.equal(r.revenueUsdc, 0, "revenue must be zeroed, not just discounted");
  assert.equal(r.tier, "Unrated");
});

test("at MIN_COUNTERPARTIES (3): on-chain revenue counts", () => {
  const r = computeScoreResult(
    baseInputs({ onchainRevenueStroops: usdcStroops(50_000), distinctPayers: 3 }),
  );
  assert.equal(r.onchainCounts, true);
  assert.equal(r.revenueUsdc, 50_000);
});

test("distinct-payer bonus is capped at 10 payers (+50 max), does not grow past it", () => {
  const with10 = computeScoreResult(
    baseInputs({ onchainRevenueStroops: usdcStroops(50_000), distinctPayers: 10 }),
  );
  const with50 = computeScoreResult(
    baseInputs({ onchainRevenueStroops: usdcStroops(50_000), distinctPayers: 50 }),
  );
  assert.equal(with10.score, with50.score, "bonus must plateau at 10 distinct payers");
});

// ---- Tier banding (mirrors revenue_math::tier_from_score) ------------------
// Bands (BAND_DIVISOR=1): >=25000->760(A), >=10000->680(B), >=2500->600(C),
// >=500->560(C), else 400(Unrated). Tier cuts: A>=750, B>=650, C>=550.

test("tier Unrated below the $500 revenue floor", () => {
  const r = computeScoreResult(
    baseInputs({ onchainRevenueStroops: usdcStroops(100), distinctPayers: 5 }),
  );
  assert.equal(r.tier, "Unrated");
  assert.equal(r.limitUsdc, 0, "Unrated has a 0x limit multiple");
});

test("tier C at the $500 band (base 560, +payer bonus clears 550 floor)", () => {
  const r = computeScoreResult(
    baseInputs({ onchainRevenueStroops: usdcStroops(500), distinctPayers: 5 }),
  );
  assert.equal(r.tier, "C");
  assert.equal(r.aprBps, 1200);
  assert.equal(r.limitUsdc, r.revenueUsdc * 1, "C tier limit multiple is 1x");
});

test("tier B at the $10,000 band", () => {
  const r = computeScoreResult(
    baseInputs({ onchainRevenueStroops: usdcStroops(10_000), distinctPayers: 5 }),
  );
  assert.equal(r.tier, "B");
  assert.equal(r.aprBps, 850);
  assert.equal(r.limitUsdc, r.revenueUsdc * 2, "B tier limit multiple is 2x");
});

test("tier A at the $25,000 band", () => {
  const r = computeScoreResult(
    baseInputs({ onchainRevenueStroops: usdcStroops(25_000), distinctPayers: 5 }),
  );
  assert.equal(r.tier, "A");
  assert.equal(r.aprBps, 600);
  assert.equal(r.limitUsdc, r.revenueUsdc * 3, "A tier limit multiple is 3x");
});

test("score is monotonic in revenue across every band boundary", () => {
  const amounts = [0, 100, 499, 500, 2_499, 2_500, 9_999, 10_000, 24_999, 25_000, 100_000];
  let prevScore = -1;
  for (const usd of amounts) {
    const r = computeScoreResult(
      baseInputs({ onchainRevenueStroops: usdcStroops(usd), distinctPayers: 5 }),
    );
    assert.ok(
      r.score >= prevScore,
      `score must never decrease as revenue rises (at $${usd}: ${r.score} < prev ${prevScore})`,
    );
    prevScore = r.score;
  }
});

test("score is always clamped into [0, 850]", () => {
  const huge = computeScoreResult(
    baseInputs({
      onchainRevenueStroops: usdcStroops(10_000_000),
      distinctPayers: 1000,
      repayments: { onTime: 1000, total: 1000, missed: 0 },
    }),
  );
  assert.ok(huge.score <= 850);
  assert.ok(huge.score >= 0);
});

// ---- Off-chain (zkTLS) revenue: weighted higher, no counterparty gate ------

test("verified off-chain revenue counts even with zero on-chain counterparties", () => {
  const r = computeScoreResult(
    baseInputs({
      distinctPayers: 0,
      offchainRevenueStroops: usdcStroops(10_000),
      offchainVerified: true,
    }),
  );
  assert.ok(r.revenueUsdc > 0, "off-chain revenue must not require MIN_COUNTERPARTIES");
  assert.equal(r.components.offchainWeight, 1.5, "off-chain is weighted 1.5x on-chain");
});

test("unverified off-chain revenue contributes nothing (weight 0)", () => {
  const r = computeScoreResult(
    baseInputs({
      offchainRevenueStroops: usdcStroops(10_000),
      offchainVerified: false,
    }),
  );
  assert.equal(r.revenueUsdc, 0);
  assert.equal(r.components.offchainWeight, 0);
});

test("on-chain + verified off-chain revenue combine additively at their respective weights", () => {
  const r = computeScoreResult(
    baseInputs({
      onchainRevenueStroops: usdcStroops(1_000),
      distinctPayers: 5,
      offchainRevenueStroops: usdcStroops(1_000),
      offchainVerified: true,
    }),
  );
  // 1000 * 1.0 (onchain) + 1000 * 1.5 (offchain) = 2500
  assert.equal(r.revenueUsdc, 2_500);
  assert.equal(r.components.onchainUsdc, 1_000);
  assert.equal(r.components.offchainUsdc, 1_000);
});

// ---- Repayment history: the credit ramp ------------------------------------
// rampFactorBps = clamp(1500 + onTime*1500 - missed*3000, 0, 10000)

test("cold start (no repayment history) ramps to exactly 15% of the tier limit", () => {
  const r = computeScoreResult(
    baseInputs({ onchainRevenueStroops: usdcStroops(10_000), distinctPayers: 5 }),
  );
  assert.equal(r.rampedLimitUsdc, r.limitUsdc * 0.15);
});

test("each on-time repayment grows the ramp by +15%, up to 100%", () => {
  const steps = [0, 1, 2, 3, 4, 5, 6]; // 15%, 30%, ..., clamps at 100% (step 6=105%->100%)
  const expected = [0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1.0];
  steps.forEach((onTime, i) => {
    const r = computeScoreResult(
      baseInputs({
        onchainRevenueStroops: usdcStroops(10_000),
        distinctPayers: 5,
        repayments: { onTime, total: onTime, missed: 0 },
      }),
    );
    assert.ok(
      Math.abs(r.rampedLimitUsdc - r.limitUsdc * expected[i]) < 1e-6,
      `onTime=${onTime}: expected ramp ${expected[i]}, got ${r.rampedLimitUsdc / r.limitUsdc}`,
    );
  });
});

test("a single miss (-30%) more than wipes one on-time step (+15%): net negative", () => {
  const clean = computeScoreResult(
    baseInputs({
      onchainRevenueStroops: usdcStroops(10_000),
      distinctPayers: 5,
      repayments: { onTime: 1, total: 1, missed: 0 },
    }),
  );
  const withMiss = computeScoreResult(
    baseInputs({
      onchainRevenueStroops: usdcStroops(10_000),
      distinctPayers: 5,
      repayments: { onTime: 1, total: 2, missed: 1 },
    }),
  );
  assert.ok(
    withMiss.rampedLimitUsdc < clean.rampedLimitUsdc,
    "a miss must reduce the ramped limit relative to the same on-time count without it",
  );
});

test("ramp factor never goes negative — heavy misses floor the ramped limit at 0", () => {
  const r = computeScoreResult(
    baseInputs({
      onchainRevenueStroops: usdcStroops(10_000),
      distinctPayers: 5,
      repayments: { onTime: 0, total: 10, missed: 10 },
    }),
  );
  assert.equal(r.rampedLimitUsdc, 0);
});

// ---- Default collapse ------------------------------------------------------

test("any recorded default (missed > 0) collapses the score below lending grade", () => {
  const r = computeScoreResult(
    baseInputs({
      onchainRevenueStroops: usdcStroops(100_000), // would otherwise be tier A
      distinctPayers: 10,
      repayments: { onTime: 5, total: 6, missed: 1 },
    }),
  );
  assert.equal(r.defaulted, true);
  assert.ok(r.score <= 500, `defaulted score must be capped at 500, got ${r.score}`);
  assert.notEqual(r.tier, "A", "a default must prevent top-tier standing regardless of revenue");
});

test("defaulted=false and no score ceiling when there is no history at all", () => {
  const r = computeScoreResult(
    baseInputs({ onchainRevenueStroops: usdcStroops(25_000), distinctPayers: 10 }),
  );
  assert.equal(r.defaulted, false);
  assert.equal(r.tier, "A");
});

// ---- Sanity on the derived stroops fields ----------------------------------

test("limitStroops / rampedLimitStroops match their *Usdc counterparts within stroop rounding", () => {
  const r = computeScoreResult(
    baseInputs({
      onchainRevenueStroops: usdcStroops(10_000),
      distinctPayers: 5,
      repayments: { onTime: 2, total: 2, missed: 0 },
    }),
  );
  assert.equal(BigInt(r.limitStroops), BigInt(Math.round(r.limitUsdc * Number(STROOPS))));
  assert.equal(
    BigInt(r.rampedLimitStroops),
    BigInt(Math.round(r.rampedLimitUsdc * Number(STROOPS))),
  );
});

test("agent + minCounterparties + issuedAt are threaded through untouched", () => {
  const r = computeScoreResult(baseInputs({ agent: "GSPECIFIC" }));
  assert.equal(r.agent, "GSPECIFIC");
  assert.equal(r.minCounterparties, 3);
  assert.ok(r.issuedAt > 0);
});
