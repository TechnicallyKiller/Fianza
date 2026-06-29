// Dev probe: index one agent's x402 revenue and print the report.
//   npx tsx scripts/probe.ts <AGENT_ADDRESS> [lookbackLedgers]
import { indexRevenue } from "../src/indexer/index.js";

const agent = process.argv[2];
const fromLedger = process.argv[3] ? Number(process.argv[3]) : undefined;
if (!agent) {
  console.error("usage: tsx scripts/probe.ts <AGENT_ADDRESS> [fromLedger]");
  process.exit(1);
}
const r = await indexRevenue(agent, { fromLedger });
console.log(JSON.stringify(r, null, 2));
