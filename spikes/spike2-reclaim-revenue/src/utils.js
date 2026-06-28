/**
 * Utility Functions for Proof Processing
 *
 * This module contains utility functions for processing zero-knowledge proofs,
 * including signature formatting, recovery ID extraction, and hash generation.
 */

import { keccak256 } from '@ethersproject/keccak256';

/**
 * Extracts the recovery ID from a signature
 * @param {string} signature - The signature string (hex format)
 * @returns {number} The recovery ID (0-3)
 * @throws {Error} If signature format is invalid
 */
export const getRecId = (signature) => {
  if (!signature || typeof signature !== 'string') {
    throw new Error('Signature must be a valid string');
  }

  if (signature.length < 2) {
    throw new Error('Signature too short to contain recovery ID');
  }

  const rec = signature.slice(-2);
  const recId = parseInt(rec, 16) - 27;

  if (recId < 0 || recId > 3) {
    throw new Error(`Invalid recovery ID: ${recId}`);
  }

  return recId;
};

/**
 * Formats a signature by removing the recovery ID suffix
 * @param {string} signature - The signature string (hex format)
 * @returns {string} The formatted signature without recovery ID
 * @throws {Error} If signature format is invalid
 */
export const formatSignature = (signature) => {
  if (!signature || typeof signature !== 'string') {
    throw new Error('Signature must be a valid string');
  }

  if (signature.length < 130) {
    throw new Error('Signature too short to be valid');
  }

  // Remove the '0x' prefix and recovery ID suffix, keep only the signature part
  return signature.substring(1, 130).substring(1,130);
};

/**
 * Serializes claim data into a standardized string format
 * @param {Object} proof - The proof object containing signed claim
 * @returns {string} Serialized claim string
 * @throws {Error} If proof structure is invalid
 */
export const getSerializedClaim = (proof) => {
  if (!proof || !proof.signedClaim || !proof.signedClaim.claim) {
    throw new Error('Invalid proof structure: missing signedClaim.claim');
  }

  const claim = proof.signedClaim.claim;
  const requiredFields = ['identifier', 'owner', 'timestampS', 'epoch'];

  for (const field of requiredFields) {
    if (claim[field] === undefined || claim[field] === null) {
      throw new Error(`Missing required claim field: ${field}`);
    }
  }

  return (
    claim.identifier +
    '\n' +
    claim.owner +
    '\n' +
    claim.timestampS +
    '\n' +
    claim.epoch
  );
};

/**
 * Generates a hash of the serialized claim using Ethereum's message format
 * @param {string} serializedClaim - The serialized claim string
 * @returns {Buffer} The hash as a Buffer
 * @throws {Error} If serialization fails
 */
export const getHash = (serializedClaim) => {
  if (!serializedClaim || typeof serializedClaim !== 'string') {
    throw new Error('Serialized claim must be a valid string');
  }

  try {
    // Ethereum signed message prefix
    const ethPrefix = '\x19Ethereum Signed Message:\n';
    const message = ethPrefix + serializedClaim.length + serializedClaim;

    // Generate keccak256 hash
    const digest = keccak256(Buffer.from(message));

    // Remove '0x' prefix and convert to Buffer
    const cleanDigest = digest.substring(2);
    return Buffer.from(cleanDigest, 'hex');
  } catch (error) {
    throw new Error(`Failed to generate hash: ${error.message}`);
  }
};

/**
 * Validates a proof object structure
 * @param {Object} proof - The proof object to validate
 * @returns {boolean} True if valid, throws error if invalid
 * @throws {Error} If proof structure is invalid
 */
export const validateProofStructure = (proof) => {
  if (!proof || typeof proof !== 'object') {
    throw new Error('Proof must be an object');
  }

  // Check for required top-level properties
  const requiredTopLevel = [
    'claimData',
    'signatures',
    'extractedParameterValues',
  ];
  for (const prop of requiredTopLevel) {
    if (!proof[prop]) {
      throw new Error(`Missing required proof property: ${prop}`);
    }
  }

  // Check signatures array
  if (!Array.isArray(proof.signatures) || proof.signatures.length === 0) {
    throw new Error('Proof must have at least one signature');
  }

  // Check extracted parameters
  if (
    !proof.extractedParameterValues ||
    typeof proof.extractedParameterValues !== 'object'
  ) {
    throw new Error('Proof must have extractedParameterValues object');
  }

  return true;
};
