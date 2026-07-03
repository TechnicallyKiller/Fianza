// zktls/ — Reclaim zkTLS off-chain revenue proof orchestrator.
//
// Ports the validated spike2 flow: zkFetch a private revenue figure (Stripe
// balance) with the API key held ONLY in secretOptions, assert the secret never
// leaks into the proof, then verify the proof on the deployed Soroban verifier
// (Gate 2A/2B). Returns the proven off-chain figure plus the verification tx.

import { ReclaimClient } from "@reclaimprotocol/zk-fetch";
import * as Reclaim from "@reclaimprotocol/js-sdk";
import StellarHDWallet from "stellar-hd-wallet";
import {
  rpc,
  Contract,
  TransactionBuilder,
  nativeToScVal,
  Keypair,
  TimeoutInfinite,
} from "@stellar/stellar-sdk";
import { config } from "../config.js";
import { getRecId, formatSignature, getSerializedClaim, getHash } from "./utils.js";

const STRIPE_URL = "https://api.stripe.com/v1/balance";
// Stripe pretty-prints JSON, so allow whitespace between tokens.
// Proving `pending` rather than `available`: Stripe (test AND live mode)
// holds funds pending for several days before they settle to `available`, so
// `available` legitimately reads $0 right after a charge even though real
// revenue was just earned. `pending` is itself a real, verifiable Stripe
// balance figure — and it's the more correct one for underwriting anyway,
// since it reflects revenue the moment it's earned rather than delayed by
// payout scheduling that has nothing to do with creditworthiness.
const AMT_REGEX = '"pending":\\s*\\[\\s*\\{\\s*"amount":\\s*(?<amt>\\d+)';
// zkTLS proof generation occasionally stalls on the Reclaim attestor network;
// bound it so a hung attestor can never block the pipeline.
const PROOF_TIMEOUT_MS = Number(process.env.PROOF_TIMEOUT_MS ?? "120000");

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

export interface ProofResult {
  /** Proven off-chain figure, in minor units (Stripe cents). */
  amountMinorUnits: string;
  /** Same figure normalized to USDC stroops (7 decimals) for scoring. */
  amountStroops: string;
  proofIdentifier: string;
  secretSafe: boolean;
  verifyTxHash: string;
  onchainStatus: string;
  verified: boolean;
}

function walletKeypair(): Keypair {
  const wallet = StellarHDWallet.fromMnemonic(config.seedphrase);
  return Keypair.fromSecret(wallet.getSecret(0));
}

function bytesScVal(buffer: Buffer | Uint8Array) {
  return nativeToScVal(Buffer.from(buffer), { type: "bytes" });
}

/** zkFetch the private Stripe balance; the key lives only in secretOptions. */
async function generateProof(): Promise<any> {
  if (!config.stripeTestKey) {
    throw new Error("STRIPE_TEST_KEY missing — cannot generate a real revenue proof");
  }
  const client = new ReclaimClient(config.reclaimAppId, config.reclaimAppSecret);
  const secretOptions: Record<string, unknown> = {
    // PRIVATE — never appears in the proof. The key lives ONLY here.
    headers: { Authorization: `Bearer ${config.stripeTestKey}` },
    responseMatches: [{ type: "regex", value: AMT_REGEX }],
  };
  try {
    return await withTimeout(
      client.zkFetch(
        STRIPE_URL,
        { method: "GET" },
        { ...secretOptions, responseRedactions: [{ regex: AMT_REGEX }] },
      ),
      PROOF_TIMEOUT_MS,
      "zkFetch (redacted)",
    );
  } catch {
    // Some providers reject redactions; retry with matches only (spike behavior).
    return withTimeout(
      client.zkFetch(STRIPE_URL, { method: "GET" }, secretOptions),
      PROOF_TIMEOUT_MS,
      "zkFetch",
    );
  }
}

/** Assert the API key (and its prefix) are absent from the proof object. */
function assertSecretSafe(proof: unknown): boolean {
  const proofStr = JSON.stringify(proof);
  const keyPresent = config.stripeTestKey ? proofStr.includes(config.stripeTestKey) : false;
  const prefixPresent = proofStr.includes("sk_test_");
  return !keyPresent && !prefixPresent;
}

/** Submit the transformed proof to the deployed verifier's `verify_proof`. */
async function verifyOnChain(proof: any): Promise<string> {
  const transformed = Reclaim.transformForOnchain(proof);
  const recId = getRecId(transformed.signedClaim.signatures[0]);
  const signature = Buffer.from(formatSignature(transformed.signedClaim.signatures[0]), "hex");
  const message = getHash(getSerializedClaim(transformed));

  const server = new rpc.Server(config.sorobanRpcUrl);
  const keypair = walletKeypair();
  const account = await server.getAccount(keypair.publicKey());
  const contract = new Contract(config.reclaimVerifierContractId);

  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      contract.call(
        "verify_proof",
        bytesScVal(message),
        bytesScVal(signature.slice(0, 64)),
        nativeToScVal(recId, { type: "u32" }),
      ),
    )
    .setTimeout(TimeoutInfinite)
    .build();

  const prepared = await server.prepareTransaction(tx);
  prepared.sign(keypair);
  const sent = await server.sendTransaction(prepared);
  return sent.hash;
}

/** Generate, leak-check, and on-chain-verify an off-chain revenue proof. */
export async function proveOffchainRevenue(): Promise<ProofResult> {
  const proof = await generateProof();
  if (!proof) throw new Error("zkFetch returned no proof");

  const amountMinorUnits = String(proof.extractedParameterValues?.amt ?? "0");
  const secretSafe = assertSecretSafe(proof);
  if (!secretSafe) {
    throw new Error("ABORT: API key leaked into the proof object");
  }

  const verifyTxHash = await verifyOnChain(proof);

  // Poll for on-chain confirmation.
  const server = new rpc.Server(config.sorobanRpcUrl);
  let status = "UNKNOWN";
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const t = await server.getTransaction(verifyTxHash);
    status = t.status;
    if (status === "SUCCESS" || status === "FAILED") break;
  }

  // Stripe minor units (cents) → treat as USD, normalize to USDC stroops.
  const amountStroops = ((BigInt(amountMinorUnits) * 10_000_000n) / 100n).toString();

  return {
    amountMinorUnits,
    amountStroops,
    proofIdentifier: proof.identifier,
    secretSafe,
    verifyTxHash,
    onchainStatus: status,
    verified: status === "SUCCESS" && secretSafe,
  };
}
