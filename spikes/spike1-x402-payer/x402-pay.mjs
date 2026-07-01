// Simple x402 buyer: the honest agent pays for /premium (validates the live
// facilitator + our accounts before adding the draw-on-402 twist).
import "./load-env.mjs";
import fs from "node:fs";
import { wrapFetchWithPaymentFromConfig, decodePaymentResponseHeader } from "@x402/fetch";
import { createEd25519Signer } from "@x402/stellar";
import { ExactStellarScheme } from "@x402/stellar/exact/client";

const NETWORK = "stellar:testnet";
const URL = process.env.PAID_URL || "http://127.0.0.1:3010/premium";
const d = JSON.parse(fs.readFileSync("/tmp/_demo_agents.json", "utf8"));

const signer = createEd25519Signer(d.honestAgent, NETWORK);
const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: NETWORK, client: new ExactStellarScheme(signer) }],
});

console.log("agent requests premium content (will auto-pay over x402)…");
const res = await fetchWithPayment(URL);
console.log("HTTP status:", res.status);
console.log("body:", JSON.stringify(await res.json().catch(() => null)));
const h = res.headers.get("x-payment-response");
if (h) {
  try {
    const s = decodePaymentResponseHeader(h);
    console.log("settlement tx:", s.transaction || s.txHash || s.hash || JSON.stringify(s));
  } catch { console.log("settlement raw:", h); }
}
