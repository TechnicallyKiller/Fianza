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

/**
 * The trusted signer keypair (from SCORE_SIGNER_SECRET).
 *
 * If the secret is unset, we FALL BACK to a random ephemeral key ONLY when
 * ALLOW_EPHEMERAL_SIGNER=true — because an ephemeral key changes on every
 * restart, so its attestations become unverifiable across restarts. Making it
 * opt-in means a misconfigured production deploy fails loudly instead of
 * silently issuing worthless attestations.
 */
export function signerKeypair(): Keypair {
  if (cachedKeypair) return cachedKeypair;
  if (config.scoreSignerSecret) {
    cachedKeypair = Keypair.fromSecret(config.scoreSignerSecret);
  } else if (process.env.ALLOW_EPHEMERAL_SIGNER === "true") {
    cachedKeypair = Keypair.random();
    ephemeral = true;
    console.warn(
      "[signer] SCORE_SIGNER_SECRET unset — using an EPHEMERAL signer (attestations won't survive restart). Dev only.",
    );
  } else {
    throw new Error(
      "SCORE_SIGNER_SECRET is not set. Set it, or set ALLOW_EPHEMERAL_SIGNER=true for local dev (attestations will be non-persistent).",
    );
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
 * Sign, send, and CONFIRM a prepared tx. Polls getTransaction until it lands in
 * SUCCESS — so a caller that gets { submitted: true } knows the state change
 * actually happened on-chain. A tx that errors at submit or fails at consensus
 * returns { submitted: false, reason }, never a false success. (Previously these
 * returned submitted:true right after sendTransaction, which could report e.g.
 * "default recorded" for a tx that never landed.)
 */
async function sendAndConfirm(
  server: rpc.Server,
  prepared: Awaited<ReturnType<rpc.Server["prepareTransaction"]>>,
  kp: Keypair,
): Promise<SubmitResult> {
  prepared.sign(kp);
  const sent = await server.sendTransaction(prepared);
  if (sent.status === "ERROR") {
    return { submitted: false, txHash: sent.hash, reason: "submit rejected by RPC" };
  }
  let got = await server.getTransaction(sent.hash);
  for (let i = 0; i < 40 && got.status === rpc.Api.GetTransactionStatus.NOT_FOUND; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    got = await server.getTransaction(sent.hash);
  }
  if (got.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
    return { submitted: false, txHash: sent.hash, reason: `tx ${got.status}` };
  }
  return { submitted: true, txHash: sent.hash };
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
  return sendAndConfirm(server, prepared, kp);
}

/**
 * Record a repayment outcome on score_registry, authorized by the signer. This
 * is how a default (`onTime = false`) becomes part of the agent's on-chain
 * history — which the credit ramp and the next re-underwrite both read. No-op
 * until the registry is wired.
 */
export async function recordRepayment(agent: string, onTime: boolean): Promise<SubmitResult> {
  if (!config.scoreRegistryContractId) {
    return { submitted: false, reason: "SCORE_REGISTRY_CONTRACT_ID not set" };
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
        "record_repayment",
        Address.fromString(agent).toScVal(),
        nativeToScVal(onTime),
      ),
    )
    .setTimeout(TimeoutInfinite)
    .build();

  const prepared = await server.prepareTransaction(tx);
  return sendAndConfirm(server, prepared, kp);
}
