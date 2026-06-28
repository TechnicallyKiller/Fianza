// GATE 2B: prove a PRIVATE revenue figure (Stripe balance) on Soroban via Reclaim
// zkTLS, without exposing the API key. The key goes ONLY in zkFetch secretOptions
// (private headers, hidden from the proof). Reuses the proven Phase A verify path.
import "dotenv/config";
import fs from "node:fs";
import { ReclaimClient } from "@reclaimprotocol/zk-fetch";
import * as Reclaim from "@reclaimprotocol/js-sdk";
import { verifyProof } from "./src/verifyProof.js";
import { CONFIG } from "./src/config.js";
import StellarSdk from "stellar-sdk";

const STRIPE_KEY = process.env.STRIPE_TEST_KEY;
if (!STRIPE_KEY) throw new Error("STRIPE_TEST_KEY missing from .env");
const STRIPE_URL = "https://api.stripe.com/v1/balance";
const PROOF_PATH = "./src/stripe-proof.json";
// Stripe returns PRETTY-PRINTED JSON, so allow whitespace between tokens.
const AMT_REGEX = '"available":\\s*\\[\\s*\\{\\s*"amount":\\s*(?<amt>\\d+)';

const client = new ReclaimClient(CONFIG.RECLAIM.APP_ID, CONFIG.RECLAIM.APP_SECRET);

async function genProof(withRedactions) {
  const secretOptions = {
    // PRIVATE — never appears in the proof. The API key lives ONLY here.
    headers: { Authorization: `Bearer ${STRIPE_KEY}` },
    responseMatches: [{ type: "regex", value: AMT_REGEX }],
  };
  if (withRedactions) secretOptions.responseRedactions = [{ regex: AMT_REGEX }];
  return client.zkFetch(STRIPE_URL, { method: "GET" }, secretOptions);
}

console.log("=== STEP 1: zkFetch Stripe balance (key in PRIVATE options only) ===");
let proof;
try {
  proof = await genProof(true);
  console.log("proof generated (with responseRedactions)");
} catch (e) {
  console.log("redacted attempt failed:", e.message, "\n-> retrying with responseMatches only");
  proof = await genProof(false);
  console.log("proof generated (responseMatches only)");
}
if (!proof) throw new Error("zkFetch returned undefined (no proof)");

fs.writeFileSync(PROOF_PATH, JSON.stringify(proof, null, 2));
console.log("\nproof.extractedParameterValues:", JSON.stringify(proof.extractedParameterValues));
console.log("proof.identifier:", proof.identifier);
console.log("proof.signatures.length:", (proof.signatures || []).length);
console.log("proof.claimData.timestampS ->", new Date((proof.claimData?.timestampS || 0) * 1000).toISOString());

// ---- STEP 2: secret-leak assertion BEFORE doing anything else ----
console.log("\n=== STEP 2: assert the API key does NOT appear in the proof ===");
const proofStr = JSON.stringify(proof);
const last4 = STRIPE_KEY.slice(-4);
const keyPresent = proofStr.includes(STRIPE_KEY);
const prefixPresent = proofStr.includes("sk_test_");
const last4Present = proofStr.includes(last4);
console.log(`  full key present in proof:   ${keyPresent}`);
console.log(`  'sk_test_' prefix in proof:  ${prefixPresent}`);
console.log(`  key last4 ('${last4}') in proof: ${last4Present}`);
const secretSafe = !keyPresent && !prefixPresent;
console.log(`  => SECRET SAFE: ${secretSafe}`);

// ---- STEP 3: transformForOnchain + show payload ----
console.log("\n=== STEP 3: transformForOnchain payload ===");
const transformed = Reclaim.transformForOnchain(proof);
const transformedStr = JSON.stringify(transformed);
console.log(JSON.stringify(transformed, null, 2).slice(0, 1500));
const keyInTransformed = transformedStr.includes(STRIPE_KEY) || transformedStr.includes("sk_test_");
console.log(`  key present in transformed payload: ${keyInTransformed}`);

// ---- STEP 4: verify on the SAME contract as Phase A ----
console.log("\n=== STEP 4: verify private-derived amount on Soroban ===");
console.log("contract:", CONFIG.STELLAR_TESTNET.CONTRACT_ID);
const txHash = await verifyProof(PROOF_PATH, "testnet");
console.log("submitted tx hash:", txHash);

console.log("\n=== STEP 5: confirm on-chain status ===");
const server = new StellarSdk.rpc.Server(CONFIG.STELLAR_TESTNET.SOROBAN_RPC_URL);
let status = "UNKNOWN";
for (let i = 0; i < 20; i++) {
  await new Promise((r) => setTimeout(r, 3000));
  const t = await server.getTransaction(txHash);
  status = t.status;
  console.log(`  attempt ${i + 1}: status=${status}`);
  if (status === "SUCCESS" || status === "FAILED") break;
}

const verdict = status === "SUCCESS" && secretSafe ? "PASS" : "FAIL";
const result = {
  gate: "2B",
  source: "Stripe GET /v1/balance (private, key in zkFetch secretOptions)",
  extractedParameterValues: proof.extractedParameterValues,
  amountMinorUnits: proof.extractedParameterValues?.amt,
  proofIdentifier: proof.identifier,
  contractId: CONFIG.STELLAR_TESTNET.CONTRACT_ID,
  verifyTxHash: txHash,
  onchainStatus: status,
  explorer: `${CONFIG.STELLAR_TESTNET.EXPLORER_LINK}${txHash}`,
  secretCheck: { fullKeyPresent: keyPresent, prefixPresent, keyInTransformed, secretSafe },
  verdict,
};
fs.writeFileSync("gate2b-result.json", JSON.stringify(result, null, 2));
console.log("\n================= GATE 2B =================");
console.log(JSON.stringify(result, null, 2));
console.log("verdict:", verdict);
console.log("==========================================");
process.exit(verdict === "PASS" ? 0 : 1);
