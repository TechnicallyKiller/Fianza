import { afterEach, describe, expect, it, vi } from 'vitest';

const serverCtorMock = vi.hoisted(() => vi.fn());

vi.mock('dotenv', () => ({
  config: vi.fn(() => ({})),
}));

vi.mock('@stellar/stellar-sdk', () => ({
  Horizon: {
    Server: class {
      constructor(url) {
        serverCtorMock(url);
      }
    },
  },
}));

describe('config helpers', () => {
  const originalSeed = process.env.SEEDPHRASE;

  afterEach(() => {
    if (originalSeed === undefined) {
      delete process.env.SEEDPHRASE;
    } else {
      process.env.SEEDPHRASE = originalSeed;
    }
  });

  it('validateEnvironment throws when required env is missing', async () => {
    delete process.env.SEEDPHRASE;
    const { validateEnvironment } = await import('../src/config.js');

    expect(() => validateEnvironment()).toThrow(
      'Missing required environment variables'
    );
  });

  it('validateEnvironment passes when env is present', async () => {
    process.env.SEEDPHRASE = 'seed phrase';
    const { validateEnvironment } = await import('../src/config.js');

    expect(() => validateEnvironment()).not.toThrow();
  });

  it('getStellarServer uses the configured network URL', async () => {
    const { CONFIG, getStellarServer } = await import('../src/config.js');
    await getStellarServer();

    expect(serverCtorMock).toHaveBeenCalledWith(
      CONFIG.TESTNET_DETAILS.networkUrl
    );
  });
});

