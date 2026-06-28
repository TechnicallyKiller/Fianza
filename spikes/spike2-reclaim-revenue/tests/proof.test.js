/**
 * Comprehensive Test Suite for zkfetch-stellar-example
 *
 * This test suite validates proof generation, verification, and utility functions
 * to ensure the application works correctly.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { ethers } from 'ethers';
import * as fs from 'fs';
import * as utils from '../src/utils.js';
import { CONFIG } from '../src/config.js';

let proof;

describe('Proof Validation Tests', () => {
  beforeAll(() => {
    try {
      const data = fs.readFileSync('./src/proof.json');
      proof = JSON.parse(data);
    } catch (error) {
      console.warn('Warning: proof file not found, some tests will be skipped');
      proof = null;
    }
  });

  describe('Proof Structure Validation', () => {
    it('should have required fields', () => {
      if (!proof) {
        console.log('Skipping test - no proof file');
        return;
      }

      expect(proof).toHaveProperty('claimData');
      expect(proof).toHaveProperty('signatures');
      expect(proof.signatures.length).toBeGreaterThan(0);
      expect(proof).toHaveProperty('extractedParameterValues');
      expect(proof.extractedParameterValues).toHaveProperty('price');
    });

    it('should have a valid positive price', () => {
      if (!proof) {
        console.log('Skipping test - no proof file');
        return;
      }

      const price = parseFloat(proof.extractedParameterValues.price);
      expect(price).toBeGreaterThan(0);
      expect(Number.isNaN(price)).toBe(false);
    });

    it('should have non-empty witnesses array with valid entries', () => {
      if (!proof) {
        console.log('Skipping test - no proof file');
        return;
      }

      const witnesses = proof.witnesses;
      expect(Array.isArray(witnesses)).toBe(true);
      expect(witnesses.length).toBeGreaterThan(0);

      witnesses.forEach((witness) => {
        expect(witness).toHaveProperty('id');
        expect(typeof witness.id).toBe('string');
        expect(witness.id.startsWith('0x')).toBe(true);

        expect(witness).toHaveProperty('url');
        expect(typeof witness.url).toBe('string');
        expect(witness.url.startsWith('wss://')).toBe(true);
      });
    });
  });

  describe('Proof Signature Validation', () => {
    it('should verify the signature matches the owner', async () => {
      if (!proof) {
        console.log('Skipping test - no proof file');
        return;
      }

      const message =
        proof.identifier +
        '\n' +
        proof.claimData.owner +
        '\n' +
        proof.claimData.timestampS +
        '\n' +
        proof.claimData.epoch;

      const signature = proof.signatures[0];
      const signerAddress = proof.witnesses[0].id;

      const recoveredAddress = ethers.verifyMessage(message, signature);
      expect(recoveredAddress.toLowerCase()).toBe(signerAddress.toLowerCase());
    });
  });

  describe('Proof Data Validation', () => {
    it('should have a valid UNIX timestamp not in the future', () => {
      if (!proof) {
        console.log('Skipping test - no proof file');
        return;
      }

      const timestamp = proof.claimData.timestampS;
      expect(typeof timestamp).toBe('number');

      const nowInSeconds = Math.floor(Date.now() / 1000);
      expect(timestamp).toBeLessThanOrEqual(nowInSeconds + 300);
      expect(timestamp).toBeGreaterThan(0);
    });

    it('should have a valid provider (http or https)', () => {
      if (!proof) {
        console.log('Skipping test - no proof file');
        return;
      }

      const provider = proof.claimData.provider;
      expect(typeof provider).toBe('string');
      expect(['http', 'https']).toContain(provider);
    });

    it('should have a positive integer epoch', () => {
      if (!proof) {
        console.log('Skipping test - no proof file');
        return;
      }

      const epoch = proof.claimData.epoch;
      expect(Number.isInteger(epoch)).toBe(true);
      expect(epoch).toBeGreaterThan(0);
    });

    it('should parse parameters JSON and contain expected keys', () => {
      if (!proof) {
        console.log('Skipping test - no proof file');
        return;
      }

      const parametersStr = proof.claimData.parameters;
      expect(typeof parametersStr).toBe('string');

      let paramsObj;
      try {
        paramsObj = JSON.parse(parametersStr);
      } catch (e) {
        paramsObj = null;
      }

      expect(paramsObj).not.toBeNull();
      expect(paramsObj).toHaveProperty('method');
      expect(paramsObj).toHaveProperty('url');
      expect(paramsObj).toHaveProperty('responseMatches');
    });
  });
});

describe('Utility Functions Tests', () => {
  describe('getRecId', () => {
    it('should extract recovery ID correctly', () => {
      const signature =
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b';
      const recId = utils.getRecId(signature);
      expect(recId).toBe(0); // 0x1b - 27 = 0
    });

    it('should throw error for invalid signature', () => {
      expect(() => utils.getRecId(null)).toThrow(
        'Signature must be a valid string'
      );
    });

    it('should throw error for invalid recovery ID', () => {
      expect(() => utils.getRecId('0x00')).toThrow('Invalid recovery ID');
    });
  });

  describe('formatSignature', () => {
    it('should format signature correctly', () => {
      const signature =
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b';
      const formatted = utils.formatSignature(signature);
      expect(formatted).toHaveLength(128);
      expect(formatted).not.toContain('0x');
    });

    it('should throw error for invalid signature', () => {
      expect(() => utils.formatSignature('short')).toThrow(
        'Signature too short'
      );
      expect(() => utils.formatSignature(null)).toThrow(
        'Signature must be a valid string'
      );
    });
  });

  describe('getSerializedClaim', () => {
    it('should serialize claim correctly', () => {
      const mockProof = {
        signedClaim: {
          claim: {
            identifier: '0x123',
            owner: '0x456',
            timestampS: 1234567890,
            epoch: 1,
          },
        },
      };

      const serialized = utils.getSerializedClaim(mockProof);
      expect(serialized).toBe('0x123\n0x456\n1234567890\n1');
    });

    it('should throw error for invalid proof structure', () => {
      expect(() => utils.getSerializedClaim(null)).toThrow(
        'Invalid proof structure'
      );
      expect(() => utils.getSerializedClaim({})).toThrow(
        'Invalid proof structure'
      );
    });
  });

  describe('getHash', () => {
    it('should generate hash correctly', () => {
      const serializedClaim = 'test claim';
      const hash = utils.getHash(serializedClaim);
      expect(hash).toBeInstanceOf(Buffer);
      expect(hash.length).toBe(32); // keccak256 produces 32 bytes
    });

    it('should throw error for invalid input', () => {
      expect(() => utils.getHash(null)).toThrow(
        'Serialized claim must be a valid string'
      );
      expect(() => utils.getHash('')).toThrow(
        'Serialized claim must be a valid string'
      );
    });
  });

  describe('validateProofStructure', () => {
    it('should validate correct proof structure', () => {
      const validProof = {
        claimData: {},
        signatures: ['0x123'],
        extractedParameterValues: {},
      };

      expect(() => utils.validateProofStructure(validProof)).not.toThrow();
    });

    it('should throw error for invalid proof structure', () => {
      expect(() => utils.validateProofStructure(null)).toThrow(
        'Proof must be an object'
      );
      expect(() => utils.validateProofStructure({})).toThrow(
        'Missing required proof property'
      );
    });

    it('should throw error for missing signatures or parameters', () => {
      expect(() =>
        utils.validateProofStructure({
          claimData: {},
          signatures: [],
          extractedParameterValues: {},
        })
      ).toThrow('Proof must have at least one signature');
      expect(() =>
        utils.validateProofStructure({
          claimData: {},
          signatures: ['0x123'],
          extractedParameterValues: 'bad',
        })
      ).toThrow('Proof must have extractedParameterValues object');
    });
  });
});

describe('Configuration Tests', () => {
  it('should have valid configuration', () => {
    expect(CONFIG.RECLAIM.APP_ID).toBeDefined();
    expect(CONFIG.RECLAIM.APP_SECRET).toBeDefined();
    expect(CONFIG.STELLAR_TESTNET.CONTRACT_ID).toBeDefined();
    expect(CONFIG.API.COINGECKO_STELLAR_PRICE).toBeDefined();
  });

  it('should have valid API URL', () => {
    expect(CONFIG.API.COINGECKO_STELLAR_PRICE).toMatch(/^https:\/\//);
    expect(CONFIG.API.COINGECKO_STELLAR_PRICE).toContain('coingecko.com');
  });

  it('should have valid Stellar network configuration', () => {
    expect(CONFIG.TESTNET_DETAILS.networkUrl).toMatch(/^https:\/\//);
    expect(CONFIG.STELLAR_TESTNET.SOROBAN_RPC_URL).toMatch(/^https:\/\//);
  });
});
