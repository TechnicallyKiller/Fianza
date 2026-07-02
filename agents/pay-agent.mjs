// A real customer pays any local agent for a real job over x402.
// Usage: node pay-agent.mjs CUSTOMER1_SECRET http://127.0.0.1:3022/research '{"asset":"gold"}'
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".env") });

import { wrapFetchWithPaymentFromConfig, decodePaymentResponseHeader } from "@x402/fetch";
import { createEd25519Signer } from "@x402/stellar";
import { ExactStellarScheme } from "@x402/stellar/exact/client";

const NETWORK = "stellar:testnet";
const secretVar = process.argv[2];
const url = process.argv[3];
const body = process.argv[4];
if (!secretVar || !url || !body) {
  console.error("usage: node pay-agent.mjs CUSTOMER_SECRET_VAR url json-body");
  process.exit(1);
}
const secret = process.env[secretVar];
if (!secret) throw new Error(`env var ${secretVar} not set`);

const signer = createEd25519Signer(secret, NETWORK);
const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: NETWORK, client: new ExactStellarScheme(signer) }],
});

console.log(`[${secretVar}] paying ${url}`);
const res = await fetchWithPayment(url, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body,
});
console.log("HTTP", res.status);
console.log(JSON.stringify(await res.json(), null, 2));
const h = res.headers.get("x-payment-response");
if (h) {
  try { console.log("\nsettlement tx:", decodePaymentResponseHeader(h).transaction); }
  catch { console.log("settlement header raw:", h); }
}
