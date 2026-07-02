// Analyst — a real autonomous trading-research agent. Earns real testnet USDC
// over x402 for market/asset research summaries, gets underwritten by
// TrustLine on that real revenue. Read-only research only — this agent never
// places trades or moves anyone's funds; it answers questions about markets.
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
const PORT = Number(process.env.ANALYST_PORT || 3022);
const PRICE = "$" + (process.env.ANALYST_PRICE_USDC || "0.3");
const PAYTO = process.env.ANALYST_WALLET_PUBLIC;

if (!process.env.OZ_API_KEY) throw new Error("OZ_API_KEY missing");
if (!PAYTO) throw new Error("ANALYST_WALLET_PUBLIC missing — run node _new_agent_wallets.mjs first");

const tl = new TrustLineAgent(process.env.ANALYST_WALLET_SECRET, {
  apiBaseUrl: process.env.TRUSTLINE_API || "http://localhost:8787",
});

const jobLog = [];

async function research(asset) {
  const prompt =
    `You are a market research analyst. Give a concise, balanced research note ` +
    `on "${asset}": what it is, the main factors driving it recently, and the ` +
    `key risks to watch. This is informational research only — do not give ` +
    `financial advice or a buy/sell recommendation.`;
  const { text, provider } = await think(prompt);
  return { note: text, provider };
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
  "POST /research": {
    accepts: { scheme: "exact", price: PRICE, network: NETWORK, payTo: PAYTO },
    description: "Analyst — autonomous trading-research agent (read-only analysis, no trades placed)",
  },
}, resourceServer));

app.post("/research", async (req, res) => {
  const asset = req.body?.asset;
  if (!asset) return res.status(400).json({ error: "missing 'asset' in body" });
  const t0 = Date.now();
  try {
    const result = await research(asset);
    jobLog.unshift({ asset, ...result, ms: Date.now() - t0, ts: Date.now() });
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

app.get("/health", (_req, res) => res.json({ ok: true, service: "analyst", agent: PAYTO }));

app.listen(PORT, "0.0.0.0", () => console.log(`Analyst listening on :${PORT}  price=${PRICE}  agent=${PAYTO}`));
