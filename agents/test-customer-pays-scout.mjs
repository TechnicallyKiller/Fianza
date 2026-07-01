// A real customer pays Scout for a real research job over x402.
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".env") });

import { wrapFetchWithPaymentFromConfig, decodePaymentResponseHeader } from "@x402/fetch";
import { createEd25519Signer } from "@x402/stellar";
import { ExactStellarScheme } from "@x402/stellar/exact/client";
import { Horizon } from "@stellar/stellar-sdk";

const NETWORK = "stellar:testnet";
const secretVar = process.argv[2] || "CUSTOMER1_SECRET";
const question = process.argv[3] || "What is the Stellar Consensus Protocol?";
const secret = process.env[secretVar];
if (!secret) throw new Error(`env var ${secretVar} not set`);

const signer = createEd25519Signer(secret, NETWORK);
const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: NETWORK, client: new ExactStellarScheme(signer) }],
});

const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");
async function scoutBalance() {
  const acct = await horizon.loadAccount(process.env.SCOUT_WALLET_PUBLIC);
  return Number(acct.balances.find((b) => b.asset_code === "USDC")?.balance ?? 0);
}

console.log(`[${secretVar}] paying Scout $${process.env.SCOUT_PRICE_USDC || 3} for: "${question}"`);
console.log("Scout balance before:", await scoutBalance(), "USDC");

const res = await fetchWithPayment("http://127.0.0.1:3020/research", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ question }),
});
console.log("HTTP", res.status);
const body = await res.json();
console.log(JSON.stringify(body, null, 2));

const h = res.headers.get("x-payment-response");
if (h) {
  try { console.log("\ncustomer→Scout settlement tx:", decodePaymentResponseHeader(h).transaction); }
  catch { console.log("settlement header raw:", h); }
}
console.log("Scout balance after:", await scoutBalance(), "USDC");
