import { describe, expect, it, vi } from 'vitest';

describe('utils branch coverage', () => {
  it('getRecId throws when signature too short', async () => {
    const { getRecId } = await import('../src/utils.js');
    expect(() => getRecId('0')).toThrow('Signature too short');
  });

  it('getSerializedClaim throws on missing field', async () => {
    const { getSerializedClaim } = await import('../src/utils.js');
    expect(() =>
      getSerializedClaim({
        signedClaim: {
          claim: {
            identifier: 'id',
            owner: 'owner',
            timestampS: 1,
          },
        },
      })
    ).toThrow('Missing required claim field');
  });

  it('getHash throws when hashing fails', async () => {
    vi.resetModules();
    vi.doMock('@ethersproject/keccak256', () => ({
      keccak256: () => {
        throw new Error('boom');
      },
    }));
    const { getHash } = await import('../src/utils.js');
    expect(() => getHash('test')).toThrow('Failed to generate hash');
  });
});

