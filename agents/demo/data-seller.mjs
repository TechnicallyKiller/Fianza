// data-seller — the paid "premium data" endpoint the demo agent buys from.
//
// A real x402-priced seller (same @x402/express machinery the analyst/scout
// agents use, the path our SDK's generic scheme pays). It returns REAL research
// (free brain), costs $0.30, and pays out to the demo HOLDING wallet — an
// arms-length payee, NOT the demo agent — so the purchase is a genuine payment
// to a third party, not the agent paying itself.
//
//   POST /research  { "asset": "XLM" }  → 402 (pay $0.30) → 200 { note, provider }
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "../.env") });
dotenv.config({ path: path.resolve(here, "../.demo-holding-wallet.local") });

import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactStellarScheme } from "@x402/stellar/exact/server";
import { think } from "../shared/brain.mjs";

const NETWORK = "stellar:testnet";
// Render injects PORT; DATA_SELLER_PORT is the local-dev override.
const PORT = Number(process.env.PORT || process.env.DATA_SELLER_PORT || 3022);
const PRICE = "$" + (process.env.DEMO_RESEARCH_PRICE_USDC || "0.3");
// Pay out to the holding wallet (has a USDC trustline, is not the demo agent).
const PAYTO = process.env.DEMO_HOLDING_PUBLIC;
if (!PAYTO) throw new Error("DEMO_HOLDING_PUBLIC missing (.demo-holding-wallet.local)");
if (!process.env.OZ_API_KEY) throw new Error("OZ_API_KEY missing (x402 facilitator auth)");

async function research(asset) {
  const prompt =
    `You are a premium market-research desk. Give a concise, balanced research ` +
    `note on "${asset}": what it is, the main recent drivers, and the key risks ` +
    `to watch. Informational only — no financial advice, no buy/sell call.`;
  const { text, provider } = await think(prompt);
  return { note: text, provider, asset };
}

const facilitator = new HTTPFacilitatorClient({
  url: process.env.FACILITATOR_URL ?? "https://channels.openzeppelin.com/x402/testnet",
  createAuthHeaders: async () => {
    const h = { Authorization: `Bearer ${process.env.OZ_API_KEY}` };
    return { verify: h, settle: h, supported: h };
  },
});
const resourceServer = new x402ResourceServer(facilitator).register(
  NETWORK,
  new ExactStellarScheme(),
);

const app = express();
app.use(express.json());

// Permissive CORS so the status page (and any browser client) can read /health.
// Without this the browser blocks the response even on a 200, which looked like
// the service was "down" when it was actually up.
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type, x-payment");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(
  paymentMiddleware(
    {
      "POST /research": {
        accepts: { scheme: "exact", price: PRICE, network: NETWORK, payTo: PAYTO },
        description: "Premium market-data call (Fianza demo seller)",
      },
    },
    resourceServer,
  ),
);

app.post("/research", async (req, res) => {
  const asset = req.body?.asset;
  if (!asset) return res.status(400).json({ error: "missing 'asset' in body" });
  try {
    res.json(await research(asset));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/health", (_req, res) => res.json({ ok: true, service: "data-seller", payTo: PAYTO }));

app.listen(PORT, "0.0.0.0", () =>
  console.log(`[data-seller] listening on :${PORT}  POST /research  price=${PRICE}  payTo=${PAYTO}`),
);
