// TrustLine demo x402 resource server — a "premium data API" priced in USDC,
// settled via the OZ Channels facilitator. Price + payTo from env.
import "./load-env.mjs";
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactStellarScheme } from "@x402/stellar/exact/server";

const NETWORK = "stellar:testnet";
const PORT = Number(process.env.PORT || 3010);
const PRICE = "$" + (process.env.X402_PRICE_USDC || "0.5"); // avoids shell/dotenv $-expansion
const PAYTO = process.env.SERVICE_PUBLIC;
if (!process.env.OZ_API_KEY) throw new Error("OZ_API_KEY missing");
if (!PAYTO) throw new Error("SERVICE_PUBLIC missing (the seller's G... address)");

const facilitator = new HTTPFacilitatorClient({
  url: process.env.FACILITATOR_URL ?? "https://channels.openzeppelin.com/x402/testnet",
  createAuthHeaders: async () => {
    const h = { Authorization: `Bearer ${process.env.OZ_API_KEY}` };
    return { verify: h, settle: h, supported: h };
  },
});
const resourceServer = new x402ResourceServer(facilitator).register(NETWORK, new ExactStellarScheme());

const app = express();
app.use(paymentMiddleware({
  "GET /premium": {
    accepts: { scheme: "exact", price: PRICE, network: NETWORK, payTo: PAYTO },
    description: "TrustLine premium market-research report",
  },
}, resourceServer));
app.get("/premium", (_req, res) => res.json({ ok: true, data: "🔒 premium market-research report unlocked", ts: Date.now() }));

app.listen(PORT, "127.0.0.1", () =>
  console.log(`x402 server on http://127.0.0.1:${PORT}/premium  price=${PRICE} payTo=${PAYTO}`));
