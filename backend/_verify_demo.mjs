// Underwrite the honest + sybil agents and print the contrast.
import fs from "node:fs";
const d = JSON.parse(fs.readFileSync("/tmp/_demo_agents.json", "utf8"));
const BASE = "http://localhost:8787";

async function waitHealth() {
  for (let i = 0; i < 30; i++) {
    try { if ((await fetch(`${BASE}/health`)).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("backend not healthy");
}

async function underwrite(addr) {
  const r = await fetch(`${BASE}/agent/${addr}/underwrite?skipProof=true&fromLedger=${d.fromLedger}`, { method: "POST" });
  return r.json();
}

function show(name, r) {
  const s = r.score, ind = r.independence;
  console.log(`\n=== ${name} (${r.agent.slice(0, 6)}…) ===`);
  console.log(`  revenue indexed:   ${r.revenue.totalRevenueUsdc} USDC from ${r.revenue.distinctPayers} payer(s)`);
  if (ind) {
    console.log(`  independent payers: ${ind.independentPayers.length}`);
    console.log(`  circular  payers:   ${ind.circularPayers.length}`);
    console.log(`  independent revenue: ${Number(ind.independentRevenueStroops) / 1e7} USDC`);
  }
  console.log(`  SCORE: ${s.score} → ${s.tier}   limit: ${s.limitUsdc} USDC @ ${s.aprBps / 100}% APR`);
  console.log(`  VERDICT: ${s.limitUsdc > 0 ? "✅ CREDIT APPROVED" : "🚫 CREDIT DENIED"}`);
}

await waitHealth();
console.log("underwriting honest agent…");
show("HONEST", await underwrite(d.honestAgentPub));
console.log("\nunderwriting sybil agent…");
show("SYBIL ", await underwrite(d.sybilAgentPub));
