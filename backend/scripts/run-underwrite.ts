// Dev: run the full underwriting pipeline for one agent and print the result.
//   npx tsx scripts/run-underwrite.ts <AGENT_ADDRESS> [fromLedger]
import { underwrite } from "../src/underwrite.js";

const agent = process.argv[2];
const fromLedger = process.argv[3] ? Number(process.argv[3]) : undefined;
if (!agent) {
  console.error("usage: tsx scripts/run-underwrite.ts <AGENT_ADDRESS> [fromLedger]");
  process.exit(1);
}
const r = await underwrite(agent, { fromLedger });
console.log(JSON.stringify(r, null, 2));
