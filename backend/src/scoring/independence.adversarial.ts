// Adversarial proof for the counterparty-independence model (docs/sybil-model.md
// §1.3 attack catalog). Runs each attack pattern — plus a genuinely independent
// agent — through the pure `scoreIndependence` model and asserts the honest one
// passes while the cheap Sybil attacks are caught or heavily discounted.
//
// Run: npx tsx src/scoring/independence.adversarial.ts
// Deterministic, no network — this is the "here are the scams, here's the model
// catching each one" evidence the moat needs.

import { scoreIndependence, type PayerFacts } from "./independence.js";

const USDC = 10_000_000n; // 1 USDC in stroops
const usdc = (n: number) => BigInt(Math.round(n)) * USDC;

interface Scenario {
  name: string;
  facts: PayerFacts[];
  expect: "pass" | "caught" | "discounted" | "gap";
}

// Helper: N payers with shared traits and equal revenue.
function payers(
  n: number,
  each: number,
  t: { ageDays: number; outDegree: number; fundedByAgent?: boolean; agentPaid?: number },
): PayerFacts[] {
  return Array.from({ length: n }, (_, i) => ({
    payer: `P${i}`,
    revenueStroops: usdc(each),
    ageDays: t.ageDays,
    outDegree: t.outDegree,
    fundedByAgent: t.fundedByAgent ?? false,
    agentPaidStroops: usdc(t.agentPaid ?? 0),
  }));
}

const scenarios: Scenario[] = [
  {
    name: "HONEST — 5 aged, diverse, independent payers, revenue spread",
    facts: payers(5, 20, { ageDays: 60, outDegree: 5 }),
    expect: "pass",
  },
  {
    name: "A1 self-pay — aged wallets that ONLY ever pay this agent (out-degree 0)",
    facts: payers(5, 20, { ageDays: 60, outDegree: 0 }),
    expect: "caught",
  },
  {
    name: "A2 fresh-wallet farm — 5 brand-new wallets, no other history",
    facts: payers(5, 20, { ageDays: 1, outDegree: 0 }),
    expect: "caught",
  },
  {
    name: "A3 circular funding — payers funded by the agent (loop detected)",
    facts: payers(5, 20, { ageDays: 60, outDegree: 5, fundedByAgent: true }),
    expect: "caught",
  },
  {
    name: "A4 concentration — one 'payer' supplies 95% of revenue",
    facts: [
      { payer: "whale", revenueStroops: usdc(95), ageDays: 90, outDegree: 8, fundedByAgent: false },
      { payer: "P1", revenueStroops: usdc(5), ageDays: 90, outDegree: 8, fundedByAgent: false },
    ],
    expect: "discounted",
  },
  {
    name: "A7a collusion ring (mutual) — 3 aged operators cross-paying each other",
    // Each looks externally diverse, but the agent pays them back ~what they pay
    // it (the ring inflates both sides) → net-flow/reciprocity zeroes it.
    facts: payers(3, 33, { ageDays: 90, outDegree: 6, agentPaid: 33 }),
    expect: "caught",
  },
  {
    name: "A7b sophisticated ring — non-reciprocal, laundered external diversity (REMAINING GAP)",
    // No reciprocated flow, real external counterparties, not agent-funded — this
    // is genuinely hard and still passes. Needs staking / global-graph (v2+).
    facts: payers(3, 33, { ageDays: 120, outDegree: 8 }),
    expect: "gap",
  },
];

// Verdict thresholds on independence_score ∈ [0,1].
const PASS = 0.8; // honest revenue mostly survives
const CAUGHT = 0.05; // attack revenue essentially zeroed
const DISCOUNTED = 0.25; // attack heavily cut (only a fraction counts)
const GAP = 0.6; // known-unsolved: still passes (documented limitation)

let failures = 0;
console.log("Independence model — adversarial catalog\n" + "=".repeat(70));
for (const s of scenarios) {
  const r = scoreIndependence(s.facts);
  const score = r.independenceScore;
  let ok: boolean;
  let want: string;
  switch (s.expect) {
    case "pass": ok = score >= PASS; want = `>= ${PASS} (survives)`; break;
    case "caught": ok = score <= CAUGHT; want = `<= ${CAUGHT} (zeroed)`; break;
    case "discounted": ok = score <= DISCOUNTED; want = `<= ${DISCOUNTED} (cut)`; break;
    case "gap": ok = score >= GAP; want = `>= ${GAP} (KNOWN GAP: passes)`; break;
  }
  if (!ok) failures++;
  const claimed = Number(s.facts.reduce((a, f) => a + f.revenueStroops, 0n)) / Number(USDC);
  const counted = Number(BigInt(r.independentRevenueStroops)) / Number(USDC);
  console.log(
    `\n${ok ? "✅" : "❌"} ${s.name}\n` +
      `   score=${score.toFixed(3)} (want ${want})  |  ` +
      `claimed=${claimed} USDC → counted=${counted.toFixed(1)} USDC  |  ` +
      `HHI=${r.hhi.toFixed(2)} conc=${r.concentrationFactor.toFixed(2)}`,
  );
}
console.log("\n" + "=".repeat(70));
if (failures) {
  console.log(`FAILED: ${failures} scenario(s) did not match expectation`);
  process.exit(1);
}
console.log("ALL SCENARIOS AS EXPECTED — honest passes, A1–A4 caught/discounted, A7 gap documented");
