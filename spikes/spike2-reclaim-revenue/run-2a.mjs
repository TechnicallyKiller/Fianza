// GATE 2A driver: prove the Reclaim verifier leg end-to-end with the canned
// built-in Stellar-price source. Bypasses the repo's POSIX-only CLI guard by
// calling the exported functions directly. Captures the proof object AND the
// Soroban verification tx hash, then polls RPC to confirm the tx SUCCEEDED.
import fs from "node:fs";
import { requestProof } from "./src/requestProof.js";
import { verifyProof } from "./src/verifyProof.js";
import { CONFIG } from "./src/config.js";
import StellarSdk from "stellar-sdk";

const RPC = CONFIG.STELLAR_TESTNET.SOROBAN_RPC_URL;
const EXPLORER = CONFIG.STELLAR_TESTNET.EXPLORER_LINK;

console.log("=== STEP 1: generate Stellar-price proof (canned source) ===");
const proof = await requestProof(CONFIG.PATHS.PROOF_FILE, "stellar");
console.log("\nproof.extractedParameterValues:", JSON.stringify(proof.extractedParameterValues));
console.log("proof.identifier:", proof.identifier);
console.log("proof.signatures.length:", (proof.signatures || []).length);
console.log("proof.claimData.timestampS:", proof.claimData?.timestampS,
  "->", new Date((proof.claimData?.timestampS || 0) * 1000).toISOString());

if (!proof.signatures || proof.signatures.length === 0) {
  throw new Error("Proof has no signatures — cannot verify on-chain.");
}

console.log("\n=== STEP 2: verify proof on Soroban testnet contract ===");
console.log("contract:", CONFIG.STELLAR_TESTNET.CONTRACT_ID);
const txHash = await verifyProof(CONFIG.PATHS.PROOF_FILE, "testnet");
console.log("submitted tx hash:", txHash);

console.log("\n=== STEP 3: confirm on-chain status (poll getTransaction) ===");
const server = new StellarSdk.rpc.Server(RPC);
let status = "UNKNOWN";
let getTx = null;
for (let i = 0; i < 20; i++) {
  await new Promise((r) => setTimeout(r, 3000));
  getTx = await server.getTransaction(txHash);
  status = getTx.status;
  console.log(`  attempt ${i + 1}: status=${status}`);
  if (status === "SUCCESS" || status === "FAILED") break;
}

const result = {
  gate: "2A",
  source: "stellar-price (CoinGecko, built-in)",
  extractedParameterValues: proof.extractedParameterValues,
  proofIdentifier: proof.identifier,
  signaturesLen: (proof.signatures || []).length,
  contractId: CONFIG.STELLAR_TESTNET.CONTRACT_ID,
  verifyTxHash: txHash,
  onchainStatus: status,
  explorer: `${EXPLORER}${txHash}`,
  verdict: status === "SUCCESS" ? "PASS" : "FAIL",
};
fs.writeFileSync("gate2a-result.json", JSON.stringify(result, null, 2));

console.log("\n================= GATE 2A =================");
console.log(JSON.stringify(result, null, 2));
console.log("verdict:", result.verdict);
console.log("==========================================");
process.exit(status === "SUCCESS" ? 0 : 1);
