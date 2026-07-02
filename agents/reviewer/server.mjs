// Reviewer — a real autonomous code-review agent. Earns real testnet USDC over
// x402 for reviewing a pasted code snippet, gets underwritten by TrustLine on
// that real revenue. Same proven shape as Scout/Analyst, different domain — the
// point is proving the pattern replicates, not that this agent is special.
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "../.env") });

import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactStellarScheme } from "@x402/stellar/exact/server";
import { TrustLineAgent } from "../../packages/agent-sdk/dist/index.js";
import { think } from "../shared/brain.mjs";

const NETWORK = "stellar:testnet";
const PORT = Number(process.env.REVIEWER_PORT || 3023);
const PRICE = "$" + (process.env.REVIEWER_PRICE_USDC || "0.3");
const PAYTO = process.env.REVIEWER_WALLET_PUBLIC;

if (!process.env.OZ_API_KEY) throw new Error("OZ_API_KEY missing");
if (!PAYTO) throw new Error("REVIEWER_WALLET_PUBLIC missing — run node _new_agent_wallets.mjs first");

const tl = new TrustLineAgent(process.env.REVIEWER_WALLET_SECRET, {
  apiBaseUrl: process.env.TRUSTLINE_API || "http://localhost:8787",
});

const jobLog = [];

async function review(code, language) {
  const prompt =
    `You are a code reviewer. Review the following ${language || ""} code for ` +
    `bugs, security issues, and readability. Be concise and specific.\n\n${code}`;
  const { text, provider } = await think(prompt);
  return { review: text, provider };
}

const facilitator = new HTTPFacilitatorClient({
  url: process.env.FACILITATOR_URL ?? "https://channels.openzeppelin.com/x402/testnet",
  createAuthHeaders: async () => {
    const h = { Authorization: `Bearer ${process.env.OZ_API_KEY}` };
    return { verify: h, settle: h, supported: h };
  },
});
const resourceServer = new x402ResourceServer(facilitator).register(NETWORK, new ExactStellarScheme());

const app = express();
app.use(express.json());
app.use(paymentMiddleware({
  "POST /review": {
    accepts: { scheme: "exact", price: PRICE, network: NETWORK, payTo: PAYTO },
    description: "Reviewer — autonomous code-review agent (real inference, real credit)",
  },
}, resourceServer));

app.post("/review", async (req, res) => {
  const code = req.body?.code;
  if (!code) return res.status(400).json({ error: "missing 'code' in body" });
  const t0 = Date.now();
  try {
    const result = await review(code, req.body?.language);
    jobLog.unshift({ language: req.body?.language, ...result, ms: Date.now() - t0, ts: Date.now() });
    if (jobLog.length > 20) jobLog.length = 20;
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/status", async (_req, res) => {
  try {
    const [balance, creditLine, vault] = await Promise.all([
      tl.usdcBalanceUsdc(),
      tl.creditLine().catch(() => null),
      tl.vaultState().catch(() => null),
    ]);
    res.json({ agent: tl.publicKey(), balanceUsdc: balance, creditLine, vault, recentJobs: jobLog });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/health", (_req, res) => res.json({ ok: true, service: "reviewer", agent: PAYTO }));

app.listen(PORT, "0.0.0.0", () => console.log(`Reviewer listening on :${PORT}  price=${PRICE}  agent=${PAYTO}`));
