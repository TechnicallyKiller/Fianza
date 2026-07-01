// One-off: pay DataCo for a real lookup, verify the x402 settlement + response.
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".env") });

import { wrapFetchWithPaymentFromConfig, decodePaymentResponseHeader } from "@x402/fetch";
import { createEd25519Signer } from "@x402/stellar";
import { ExactStellarScheme } from "@x402/stellar/exact/client";

const NETWORK = "stellar:testnet";
const signer = createEd25519Signer(process.env.SCOUT_WALLET_SECRET, NETWORK);
const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: NETWORK, client: new ExactStellarScheme(signer) }],
});

console.log("Scout pays DataCo $1 for a lookup on 'Stellar (payment network)'...");
const res = await fetchWithPayment("http://127.0.0.1:3021/lookup", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ query: "Stellar (payment network)" }),
});
console.log("HTTP", res.status);
console.log(JSON.stringify(await res.json(), null, 2));
const h = res.headers.get("x-payment-response");
if (h) {
  try { console.log("settlement tx:", decodePaymentResponseHeader(h).transaction); }
  catch { console.log("settlement header raw:", h); }
}
