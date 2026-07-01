// Validate the SDK's payWithCredit() — draw-on-402 as a one-liner.
import fs from "node:fs";
import { TrustLineAgent } from "../packages/agent-sdk/dist/index.js";

const d = JSON.parse(fs.readFileSync("/tmp/_demo_agents.json", "utf8"));
const agent = new TrustLineAgent(d.honestAgent, { apiBaseUrl: "http://localhost:8787" });

console.log("balance:", await agent.usdcBalanceUsdc(), "USDC · available credit:", await agent.availableCreditUsdc(), "USDC");
console.log("agent.payWithCredit('/premium', 3)  →  auto-draws shortfall, pays over x402");
const res = await agent.payWithCredit("http://127.0.0.1:3010/premium", 3);
console.log("HTTP", res.status, "→", JSON.stringify(await res.json().catch(() => null)));
