// Spike 1 x402 paid endpoint (seller). TESTNET ONLY.
// Facilitator = OpenZeppelin Channels (official Stellar x402 quickstart), Bearer auth.
import "./load-env.mjs";
import fs from "node:fs";
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactStellarScheme } from "@x402/stellar/exact/server";

const NETWORK = process.env.X402_NETWORK || "stellar:testnet";
const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || "127.0.0.1";
// Synchronous boot log — survives kill, unaffected by stdout buffering on Windows.
fs.writeFileSync("boot.log", "");
const blog = (m) => fs.appendFileSync("boot.log", `${new Date().toISOString()} ${m}\n`);
blog("[boot] start");

if (!process.env.OZ_API_KEY) {
  throw new Error(
    "OZ_API_KEY is required (OZ Channels facilitator). Generate a TESTNET key at " +
      "https://channels.openzeppelin.com/testnet/gen and put it in spikes/.env."
  );
}
if (!process.env.SERVICE_PUBLIC) {
  throw new Error("SERVICE_PUBLIC missing — run `node scripts/00-setup.mjs` first.");
}

blog("[boot] env loaded, network=" + NETWORK);
const facilitator = new HTTPFacilitatorClient({
  url: process.env.FACILITATOR_URL ?? "https://channels.openzeppelin.com/x402/testnet",
  createAuthHeaders: async () => {
    const h = { Authorization: `Bearer ${process.env.OZ_API_KEY}` };
    return { verify: h, settle: h, supported: h };
  },
});

blog("[boot] facilitator client created: " + process.env.FACILITATOR_URL);
const resourceServer = new x402ResourceServer(facilitator).register(
  NETWORK,
  new ExactStellarScheme()
);
blog("[boot] resourceServer registered, building app...");

const app = express();

app.use(
  paymentMiddleware(
    {
      "GET /paid": {
        accepts: {
          scheme: "exact",
          price: "$0.001", // 7-decimal USDC -> 10000 base units
          network: NETWORK,
          payTo: process.env.SERVICE_PUBLIC, // recipient G... (has USDC trustline)
        },
        description: "TrustLine spike1 paid endpoint",
      },
    },
    resourceServer
  )
);

app.get("/paid", (_req, res) => {
  res.json({ ok: true, data: "paid content", ts: Date.now() });
});

blog("[boot] calling app.listen on " + HOST + ":" + PORT);
const httpServer = app.listen(PORT, HOST, () => {
  blog("[boot] LISTENING on " + HOST + ":" + PORT);
  console.log(`x402 server on http://${HOST}:${PORT}/paid  (${NETWORK}, payTo=${process.env.SERVICE_PUBLIC})`);
});
httpServer.on("error", (e) => {
  blog("[boot] LISTEN ERROR: " + e.message);
  console.error("listen error:", e);
  process.exit(1);
});
process.on("uncaughtException", (e) => { blog("[boot] uncaughtException: " + e.stack); process.exit(1); });
process.on("unhandledRejection", (e) => { blog("[boot] unhandledRejection: " + (e?.stack || e)); });
