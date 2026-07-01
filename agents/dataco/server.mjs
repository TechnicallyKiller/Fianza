// DataCo — a boring, real x402-paid data microservice. This is the "cost" side
// of Scout's economics: real external lookups (Wikipedia, free/no-key), sold for
// real testnet USDC over x402. It's what creates Scout's genuine cash-flow gap.
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactStellarScheme } from "@x402/stellar/exact/server";

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env") });

const NETWORK = "stellar:testnet";
const PORT = Number(process.env.DATACO_PORT || 3021);
const PRICE = "$" + (process.env.DATACO_PRICE_USDC || "1");
const PAYTO = process.env.DATACO_WALLET_PUBLIC;
if (!process.env.OZ_API_KEY) throw new Error("OZ_API_KEY missing");
if (!PAYTO) throw new Error("DATACO_WALLET_PUBLIC missing — run setup-wallets.mjs first");

async function wikipediaLookup(query) {
  const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json`;
  const searchRes = await fetch(searchUrl);
  const searchData = await searchRes.json();
  const top = searchData.query?.search?.[0];
  if (!top) return null;
  const summaryRes = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(top.title)}`,
  );
  if (!summaryRes.ok) return null;
  const summary = await summaryRes.json();
  return {
    title: summary.title,
    extract: summary.extract,
    url: summary.content_urls?.desktop?.page ?? null,
  };
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
  "POST /lookup": {
    accepts: { scheme: "exact", price: PRICE, network: NETWORK, payTo: PAYTO },
    description: "DataCo premium sourced-data lookup (Wikipedia-backed)",
  },
}, resourceServer));

app.post("/lookup", async (req, res) => {
  const query = req.body?.query;
  if (!query) return res.status(400).json({ error: "missing 'query' in body" });
  const result = await wikipediaLookup(query);
  if (!result) return res.json({ source: "wikipedia", found: false, query });
  res.json({ source: "wikipedia", found: true, query, ...result });
});

app.get("/health", (_req, res) => res.json({ ok: true, service: "dataco", payTo: PAYTO }));

app.listen(PORT, "0.0.0.0", () =>
  console.log(`DataCo listening on :${PORT}  price=${PRICE}  payTo=${PAYTO}`));
