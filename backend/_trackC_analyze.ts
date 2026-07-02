// Track C proof — run the moat ENTIRELY off the persisted Postgres graph:
// revenue, payers, age, out-degree, reciprocity, and loop detection all come
// from the DB (no RPC retention window). Run: npx tsx _trackC_analyze.ts
import { readFileSync } from "node:fs";
import { graphRevenue } from "./src/scoring/graph.js";
import { analyzeIndependence } from "./src/scoring/independence.js";
import { closePool, query } from "./src/db/index.js";

const ids = readFileSync("/home/divyanshh1/stellar/contracts/_trackB_ids.txt", "utf8");
const get = (k: string) => ids.match(new RegExp(`${k}=(.*)`))![1].trim();
const attacker = get("ATTACKER");

const [{ n: payRows }] = await query<{ n: string }>("SELECT count(*)::text n FROM payments");
const [{ n: acctRows }] = await query<{ n: string }>("SELECT count(*)::text n FROM accounts");
console.log(`graph in Neon: ${payRows} payments, ${acctRows} accounts`);
console.log(`attacker=${attacker}\n${"=".repeat(64)}`);

// Build the revenue report straight from the graph (full history, no RPC).
const g = await graphRevenue(attacker, 0);
const report = {
  agent: attacker,
  totalRevenueStroops: g.totalStroops,
  totalRevenueUsdc: Number(BigInt(g.totalStroops)) / 1e7,
  distinctPayers: g.payers.length,
  payers: g.payers,
  payments: g.payments.map((p) => ({ from: p.from, amount: p.amount, ledger: p.ledger, txHash: p.txHash })),
  windowFromLedger: 0,
  windowToLedger: 0,
};
console.log(`RAW graph revenue: ${report.totalRevenueUsdc} USDC from ${report.distinctPayers} payer(s)`);

const indep = await analyzeIndependence(attacker, report, 0);
const counted = Number(BigInt(indep.independentRevenueStroops)) / 1e7;
console.log(`\nmoat over the GRAPH (full history):`);
console.log(`   counted (R_eff): ${counted} USDC   score: ${indep.independenceScore.toFixed(3)}`);
for (const p of indep.perPayer) {
  console.log(
    `   - ${p.payer.slice(0, 8)}…  rev=${Number(BigInt(p.revenueStroops)) / 1e7} USDC  ` +
      `age=${p.ageFactor.toFixed(2)} div=${p.diversityFactor.toFixed(2)} ` +
      `recip=${p.reciprocityFactor.toFixed(2)} funded=${p.notFundedFactor === 0}  → ${p.reason}`,
  );
}
await closePool();
console.log("=".repeat(64));
console.log(
  counted === 0
    ? `✅ moat (reading Postgres) counted 0 of ${report.totalRevenueUsdc} USDC claimed.`
    : `counted ${counted} USDC — inspect above.`,
);
