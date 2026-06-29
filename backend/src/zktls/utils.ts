// Proof-processing helpers, ported verbatim from the VALIDATED
// spikes/spike2-reclaim-revenue/src/utils.js (Gate 2A/2B passed on testnet).
// Do not "tidy" these — the exact byte handling is what the deployed Soroban
// verifier expects.

import { keccak256 } from "@ethersproject/keccak256";

/** Recovery id (0-3) from the trailing byte of an Ethereum-style signature. */
export function getRecId(signature: string): number {
  if (!signature || typeof signature !== "string") {
    throw new Error("Signature must be a valid string");
  }
  if (signature.length < 2) throw new Error("Signature too short to contain recovery ID");
  const rec = signature.slice(-2);
  const recId = parseInt(rec, 16) - 27;
  if (recId < 0 || recId > 3) throw new Error(`Invalid recovery ID: ${recId}`);
  return recId;
}

/** Strip the `0x` prefix and the recovery-id byte, leaving the 64-byte sig (hex). */
export function formatSignature(signature: string): string {
  if (!signature || typeof signature !== "string") {
    throw new Error("Signature must be a valid string");
  }
  if (signature.length < 130) throw new Error("Signature too short to be valid");
  // The double-substring is intentional (drops '0' then 'x'); matches the spike.
  return signature.substring(1, 130).substring(1, 130);
}

interface SignedClaimLike {
  signedClaim: { claim: Record<string, unknown> };
}

/** Serialize the claim into the exact newline-joined form the verifier hashes. */
export function getSerializedClaim(proof: SignedClaimLike): string {
  if (!proof || !proof.signedClaim || !proof.signedClaim.claim) {
    throw new Error("Invalid proof structure: missing signedClaim.claim");
  }
  const claim = proof.signedClaim.claim as Record<string, unknown>;
  for (const field of ["identifier", "owner", "timestampS", "epoch"]) {
    if (claim[field] === undefined || claim[field] === null) {
      throw new Error(`Missing required claim field: ${field}`);
    }
  }
  return `${claim.identifier}\n${claim.owner}\n${claim.timestampS}\n${claim.epoch}`;
}

/** keccak256 of the Ethereum-signed-message-wrapped serialized claim. */
export function getHash(serializedClaim: string): Buffer {
  if (!serializedClaim || typeof serializedClaim !== "string") {
    throw new Error("Serialized claim must be a valid string");
  }
  const ethPrefix = "\x19Ethereum Signed Message:\n";
  const message = ethPrefix + serializedClaim.length + serializedClaim;
  const digest = keccak256(Buffer.from(message));
  return Buffer.from(digest.substring(2), "hex");
}
