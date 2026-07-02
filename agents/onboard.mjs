import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".env") });
import { TrustLineAgent } from "../packages/agent-sdk/dist/index.js";

const secretVar = process.argv[2];
const tl = new TrustLineAgent(process.env[secretVar], {
  apiBaseUrl: process.env.TRUSTLINE_API || "http://localhost:8787",
});
console.log("agent:", tl.publicKey());
try {
  const r = await tl.onboard({ skipProof: true });
  console.log("register:", JSON.stringify(r.register));
  console.log("score:", r.underwrite.score.score, r.underwrite.score.tier, "limit", r.underwrite.score.limitUsdc, "claimed", r.underwrite.revenue.totalRevenueUsdc);
} catch (e) {
  console.error("onboard failed:", e.message);
}
