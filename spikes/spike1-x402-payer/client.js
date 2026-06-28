// Spike 1 x402 buyer. Makes EXACTLY ONE paid request from AGENT to /paid,
// captures the settlement tx hash + payer reported by the facilitator,
// and writes settlement.json for the Gate 1 evidence script. TESTNET ONLY.
import "./load-env.mjs";
import fs from "node:fs";
import { wrapFetchWithPaymentFromConfig, decodePaymentResponseHeader } from "@x402/fetch";
import { createEd25519Signer } from "@x402/stellar";
import { ExactStellarScheme } from "@x402/stellar/exact/client";

const NETWORK = process.env.X402_NETWORK || "stellar:testnet";
const URL = process.env.PAID_URL || "http://localhost:3001/paid";

if (!process.env.AGENT_SECRET) throw new Error("AGENT_SECRET missing — run scripts/00-setup.mjs.");

// createEd25519Signer takes the raw S... secret + CAIP-2 network id (does Keypair + passphrase internally).
const signer = createEd25519Signer(process.env.AGENT_SECRET, NETWORK);

const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: NETWORK, client: new ExactStellarScheme(signer) }],
});

function decodePaymentResponse(res) {
  // x402 returns settlement metadata in an X-PAYMENT-RESPONSE header (base64 JSON).
  for (const name of ["x-payment-response", "x-payment", "payment-response"]) {
    const v = res.headers.get(name);
    if (v) {
      try { return decodePaymentResponseHeader(v); }   // official @x402/fetch decoder
      catch { try { return JSON.parse(v); } catch { return { raw: v }; } }
    }
  }
  return null;
}

const res = await fetchWithPayment(URL);
const body = await res.json().catch(() => null);
const settlement = decodePaymentResponse(res);

const allHeaders = Object.fromEntries(res.headers.entries());

console.log("HTTP status:", res.status);
console.log("Response body:", JSON.stringify(body));
console.log("Settlement (decoded X-PAYMENT-RESPONSE):", JSON.stringify(settlement, null, 2));

// Pull the tx hash out of whatever field the facilitator used.
const txHash =
  settlement?.transaction ||
  settlement?.txHash ||
  settlement?.transactionHash ||
  settlement?.hash ||
  null;
const reportedPayer = settlement?.payer || settlement?.from || null;

console.log("\n=> settlement tx hash:", txHash);
console.log("=> facilitator-reported payer:", reportedPayer);
console.log("=> AGENT (expected payer):", process.env.AGENT_PUBLIC);

fs.writeFileSync(
  "settlement.json",
  JSON.stringify(
    { url: URL, network: NETWORK, status: res.status, body, settlement, txHash, reportedPayer, headers: allHeaders },
    null,
    2
  )
);
console.log("\nWrote settlement.json");
if (!txHash) {
  console.error("\nWARN: no tx hash found in payment response. Inspect settlement.json -> headers.");
  process.exit(2);
}
