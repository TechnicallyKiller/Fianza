// Track B live showcase — PART 2: run the REAL indexer + independence engine
// against the on-chain circular-funding attacker built by _trackB_live_setup.sh.
// Run: npx tsx _trackB_analyze.ts
import { readFileSync } from "node:fs";
import { indexRevenue } from "./src/indexer/index.js";
import { analyzeIndependence } from "./src/scoring/independence.js";

const ids = readFileSync("/home/divyanshh1/stellar/contracts/_trackB_ids.txt", "utf8");
const get = (k: string) => ids.match(new RegExp(`${k}=(.*)`))![1].trim();
const attacker = get("ATTACKER");
const fromLedger = Number(get("FROM_LEDGER"));

console.log(`attacker=${attacker}\nfromLedger=${fromLedger}\n${"=".repeat(64)}`);

const report = await indexRevenue(attacker, { fromLedger });
console.log(
  `RAW indexed revenue: ${report.totalRevenueUsdc} USDC from ${report.distinctPayers} payer(s)`,
);
for (const p of report.payers) console.log(`   payer ${p.slice(0, 8)}…`);

const indep = await analyzeIndependence(attacker, report, fromLedger);
const counted = Number(BigInt(indep.independentRevenueStroops)) / 1e7;
console.log(`\nAFTER independence engine:`);
console.log(`   counted (R_eff): ${counted} USDC   independence_score: ${indep.independenceScore.toFixed(3)}`);
console.log(`   circular payers caught: ${indep.circularPayers.length}`);
for (const p of indep.perPayer) {
  console.log(
    `   - ${p.payer.slice(0, 8)}…  rev=${Number(BigInt(p.revenueStroops)) / 1e7} USDC  ` +
      `weight=${p.weight.toFixed(2)}  → ${p.reason}`,
  );
}
console.log("=".repeat(64));
console.log(
  counted === 0
    ? `✅ CAUGHT: attacker claimed ${report.totalRevenueUsdc} USDC of fake revenue, engine counted 0.`
    : `⚠️ counted ${counted} USDC — inspect above.`,
);
