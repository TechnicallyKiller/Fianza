// Scout — a real autonomous research agent. Earns real testnet USDC over x402,
// gets underwritten by TrustLine on that real revenue, and autonomously draws
// credit to cover a real on-chain cost (buying data from DataCo) before it's
// collected payment for the job that needed it. No human touches the loop.
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
const PORT = Number(process.env.SCOUT_PORT || 3020);
const PRICE = "$" + (process.env.SCOUT_PRICE_USDC || "3");
const DATACO_PRICE = Number(process.env.DATACO_PRICE_USDC || "1");
const DATACO_URL = process.env.DATACO_URL || "http://127.0.0.1:3021/lookup";
const PAYTO = process.env.SCOUT_WALLET_PUBLIC;

if (!process.env.OZ_API_KEY) throw new Error("OZ_API_KEY missing");
if (!PAYTO) throw new Error("SCOUT_WALLET_PUBLIC missing — run setup-wallets.mjs first");

const tl = new TrustLineAgent(process.env.SCOUT_WALLET_SECRET, {
  apiBaseUrl: process.env.TRUSTLINE_API || "http://localhost:8787",
});

// Serialize Scout's own outbound Stellar txns (borrow/repay/register) so two
// jobs landing close together don't race on the account's sequence number.
let chain = Promise.resolve();
function withLock(fn) {
  const p = chain.then(fn, fn);
  chain = p.catch(() => {});
  return p;
}

const jobLog = [];

async function fulfill(question) {
  let dataResult = null;
  let borrowedUsdc = 0;
  const balBefore = await tl.usdcBalanceUsdc();
  try {
    // The real cash-flow gap: Scout must pay DataCo NOW, before it's collected
    // for the job that needs this data. If cash is short, credit covers it.
    const res = await withLock(() =>
      tl.payWithCredit(DATACO_URL, DATACO_PRICE, {
        maxDraw: DATACO_PRICE * 2,
        init: {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ query: question }),
        },
      }),
    );
    dataResult = await res.json();
  } catch (e) {
    console.error("[scout] DataCo purchase failed:", e.message);
  }
  const balAfter = await tl.usdcBalanceUsdc();
  borrowedUsdc = Math.max(0, DATACO_PRICE - (balBefore - balAfter));

  const prompt = dataResult?.found
    ? `Question: ${question}\n\nSourced reference (${dataResult.title}): ${dataResult.extract}\n\nWrite a concise, well-informed answer using the reference where relevant.`
    : `Question: ${question}\n\nWrite a concise, well-informed answer.`;
  const { text, provider } = await think(prompt);
  return { answer: text, provider, dataSource: dataResult, borrowedUsdc };
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
    description: "Scout — autonomous AI research agent (real inference, real credit)",
  },
}, resourceServer));

app.post("/research", async (req, res) => {
  const question = req.body?.question;
  if (!question) return res.status(400).json({ error: "missing 'question' in body" });
  const t0 = Date.now();
  try {
    const result = await fulfill(question);
    jobLog.unshift({ question, ...result, ms: Date.now() - t0, ts: Date.now() });
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

app.get("/health", (_req, res) => res.json({ ok: true, service: "scout", agent: PAYTO }));

app.listen(PORT, "0.0.0.0", () => console.log(`Scout listening on :${PORT}  price=${PRICE}  agent=${PAYTO}`));
