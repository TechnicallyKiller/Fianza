// Demo: a trading-research agent WITHOUT TrustLine credit.
// It works fine until its USDC balance runs dry — then it just dies at the
// paywall. This is what every earning agent looks like today.
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".env") });

const RESEARCH_URL = process.env.RESEARCH_URL || "http://localhost:3022/research";
const asset = process.argv[2] || "XLM";

console.log(`[demo-agent] requesting research on "${asset}"...`);

const res = await fetch(RESEARCH_URL, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ asset }),
});

if (res.status === 402) {
  console.log("[demo-agent] 402 Payment Required — out of USDC, no credit line.");
  console.log("[demo-agent] dead. can't afford the next research call.");
  process.exit(1);
}

const data = await res.json();
console.log("[demo-agent] got research:", data.note?.slice(0, 120) + "...");
