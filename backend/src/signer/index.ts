// signer/ — the single trusted signer for the MVP.
//
// Produces a signed attestation of a computed score (Ed25519 over a canonical
// message) and, once the registry is deployed (Phase 4), submits the score to
// score_registry.publish_score authorized by this signer key (the contract's
// require_auth(signer) is satisfied by this key signing the transaction).

import {
  rpc,
  Contract,
  TransactionBuilder,
  Address,
  nativeToScVal,
  Keypair,
  TimeoutInfinite,
} from "@stellar/stellar-sdk";
import { config } from "../config.js";
import type { ScoreResult } from "../scoring/index.js";

let cachedKeypair: Keypair | null = null;
let ephemeral = false;

/** The trusted signer keypair (from SCORE_SIGNER_SECRET; ephemeral if unset). */
export function signerKeypair(): Keypair {
  if (cachedKeypair) return cachedKeypair;
  if (config.scoreSignerSecret) {
    cachedKeypair = Keypair.fromSecret(config.scoreSignerSecret);
  } else {
    cachedKeypair = Keypair.random();
    ephemeral = true;
  }
  return cachedKeypair;
}

export function signerPublicKey(): string {
  return signerKeypair().publicKey();
}

function canonicalMessage(s: ScoreResult): string {
  return [
    "TrustLine score attestation",
    `agent=${s.agent}`,
    `score=${s.score}`,
    `tier=${s.tier}`,
    `revenue=${s.revenueStroops}`,
    `issuedAt=${s.issuedAt}`,
  ].join("\n");
}

export interface Attestation {
  signer: string;
  ephemeralSigner: boolean;
  message: string;
  signatureHex: string;
  verified: boolean;
}

/** Sign a score with the trusted signer key (detached Ed25519 attestation). */
export function attestScore(s: ScoreResult): Attestation {
  const kp = signerKeypair();
  const message = canonicalMessage(s);
  const sig = kp.sign(Buffer.from(message, "utf8"));
  return {
    signer: kp.publicKey(),
    ephemeralSigner: ephemeral,
    message,
    signatureHex: sig.toString("hex"),
    verified: kp.verify(Buffer.from(message, "utf8"), sig),
  };
}

export interface SubmitResult {
  submitted: boolean;
  txHash?: string;
  reason?: string;
}

/**
 * Submit the score on-chain via score_registry.publish_score, authorized by the
 * signer key. No-op until SCORE_REGISTRY_CONTRACT_ID is set (Phase 4 deploy).
 */
export async function submitScore(s: ScoreResult): Promise<SubmitResult> {
  if (!config.scoreRegistryContractId) {
    return {
      submitted: false,
      reason: "SCORE_REGISTRY_CONTRACT_ID not set — registry is deployed + wired in Phase 4",
    };
  }
  const server = new rpc.Server(config.sorobanRpcUrl);
  const kp = signerKeypair();
  const account = await server.getAccount(kp.publicKey());
  const contract = new Contract(config.scoreRegistryContractId);

  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      contract.call(
        "publish_score",
        Address.fromString(s.agent).toScVal(),
        nativeToScVal(s.score, { type: "u32" }),
        nativeToScVal(BigInt(s.revenueStroops), { type: "i128" }),
      ),
    )
    .setTimeout(TimeoutInfinite)
    .build();

  const prepared = await server.prepareTransaction(tx);
  prepared.sign(kp);
  const sent = await server.sendTransaction(prepared);
  return { submitted: true, txHash: sent.hash };
}
