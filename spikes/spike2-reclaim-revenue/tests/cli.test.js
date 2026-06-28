import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fsMocks = vi.hoisted(() => ({
  existsSync: vi.fn(),
  statSync: vi.fn(),
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(),
}));

const zkFetchMock = vi.hoisted(() => vi.fn());
const ReclaimClientMock = vi.hoisted(() =>
  vi.fn().mockImplementation(() => ({ zkFetch: zkFetchMock }))
);

const transformForOnchainMock = vi.hoisted(() => vi.fn());
const walletMock = vi.hoisted(() => ({
  getSecret: vi.fn().mockReturnValue('SSECRET'),
}));
const fromMnemonicMock = vi.hoisted(() =>
  vi.fn().mockReturnValue(walletMock)
);

const loadAccountMock = vi.hoisted(() => vi.fn());
const prepareTransactionMock = vi.hoisted(() => vi.fn());
const sendTransactionMock = vi.hoisted(() => vi.fn());
const contractCallMock = vi.hoisted(() => vi.fn());

vi.mock('fs', () => ({
  default: fsMocks,
  ...fsMocks,
}));

vi.mock('@reclaimprotocol/zk-fetch', () => ({
  ReclaimClient: ReclaimClientMock,
}));

vi.mock('@reclaimprotocol/js-sdk', () => ({
  transformForOnchain: transformForOnchainMock,
}));

vi.mock('stellar-hd-wallet', () => ({
  default: {
    fromMnemonic: fromMnemonicMock,
  },
}));

vi.mock('@stellar/stellar-sdk', () => ({
  Horizon: {
    Server: class {
      constructor() {
        return { loadAccount: loadAccountMock };
      }
    },
  },
  Keypair: {
    fromSecret: vi.fn(() => ({
      publicKey: () => 'GTESTPUBLICKEY',
    })),
  },
  Account: class {
    constructor(publicKey, sequence) {
      this.publicKey = publicKey;
      this.sequence = sequence;
    }
  },
  Contract: class {
    call(...args) {
      return contractCallMock(...args);
    }
  },
  TransactionBuilder: class {
    constructor() {
      this.addOperation = vi.fn().mockReturnThis();
      this.setTimeout = vi.fn().mockReturnThis();
      this.build = vi.fn().mockReturnValue({});
    }
  },
  TimeoutInfinite: 'TimeoutInfinite',
  nativeToScVal: vi.fn((value) => value),
  rpc: {
    Server: class {
      constructor() {
        this.prepareTransaction = prepareTransactionMock;
        this.sendTransaction = sendTransactionMock;
      }
    },
  },
}));

const originalArgv = process.argv.slice();

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  process.argv = originalArgv.slice();
  process.env.SEEDPHRASE = 'test seed phrase';

  fsMocks.existsSync.mockReturnValue(true);
  fsMocks.statSync.mockReturnValue({ isDirectory: () => true });
  fsMocks.writeFileSync.mockImplementation(() => {});
  fsMocks.readFileSync.mockImplementation(() =>
    JSON.stringify({ signatures: ['0xabc'] })
  );
  zkFetchMock.mockResolvedValue({
    extractedParameterValues: { price: '1.23' },
  });
  loadAccountMock.mockResolvedValue({
    sequence: '1',
    balances: [{ balance: '10' }],
  });
  prepareTransactionMock.mockResolvedValue({ sign: vi.fn() });
  sendTransactionMock.mockResolvedValue({ hash: 'txhash' });
  contractCallMock.mockReturnValue({ op: 'call' });
  transformForOnchainMock.mockReturnValue({
    signedClaim: {
      signatures: [`0x${'a'.repeat(128)}1b`],
      claim: {
        identifier: 'id',
        owner: 'owner',
        timestampS: 1,
        epoch: 1,
      },
    },
  });
});

afterEach(() => {
  process.argv = originalArgv.slice();
  vi.restoreAllMocks();
});

describe('requestProof CLI', () => {
  it('runs CLI and exits with code 0 on success', async () => {
    vi.resetModules();
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
    process.argv = ['node', 'requestProof.js', 'stellar', './src/proof.json'];
    const { main } = await import('../src/requestProof.js');
    await main();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('runs CLI and exits with code 1 on error', async () => {
    vi.resetModules();
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
    fsMocks.existsSync.mockReturnValue(false);
    process.argv = ['node', 'requestProof.js', 'stellar', './missing/proof.json'];
    const { main } = await import('../src/requestProof.js');
    await main();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

describe('bytesN function', () => {
  it('accepts Uint8Array input', async () => {
    vi.resetModules();
    vi.doMock('../src/config.js', async () => {
      const actual = await vi.importActual('../src/config.js');
      return {
        ...actual,
        validateEnvironment: () => {},
      };
    });
    const { bytesN } = await import('../src/verifyProof.js');
    const uint8 = new Uint8Array(32);
    const result = bytesN(uint8, 32);
    expect(result).toBeDefined();
  });

  it('throws when buffer is not Buffer or Uint8Array', async () => {
    vi.resetModules();
    vi.doMock('../src/config.js', async () => {
      const actual = await vi.importActual('../src/config.js');
      return {
        ...actual,
        validateEnvironment: () => {},
      };
    });
    const { bytesN } = await import('../src/verifyProof.js');
    expect(() => bytesN('invalid', 32)).toThrow('Expected Buffer or Uint8Array');
    expect(() => bytesN(123, 32)).toThrow('Expected Buffer or Uint8Array');
    expect(() => bytesN({}, 32)).toThrow('Expected Buffer or Uint8Array');
  });

  it('throws when buffer length does not match expected length', async () => {
    vi.resetModules();
    vi.doMock('../src/config.js', async () => {
      const actual = await vi.importActual('../src/config.js');
      return {
        ...actual,
        validateEnvironment: () => {},
      };
    });
    const { bytesN } = await import('../src/verifyProof.js');
    const buf = Buffer.alloc(16);
    expect(() => bytesN(buf, 32)).toThrow('Expected 32 bytes, got 16');
  });
});

describe('verifyProof CLI', () => {
  it('runs CLI and exits with code 1 on error', async () => {
    vi.resetModules();
    vi.doMock('../src/config.js', async () => {
      const actual = await vi.importActual('../src/config.js');
      return {
        ...actual,
        validateEnvironment: () => {},
      };
    });
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
    fsMocks.existsSync.mockReturnValue(false);
    process.argv = ['node', 'verifyProof.js', './missing.json'];
    const { main } = await import('../src/verifyProof.js');
    await main();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('runs CLI and exits with code 0 on success', async () => {
    vi.resetModules();
    vi.doMock('../src/config.js', async () => {
      const actual = await vi.importActual('../src/config.js');
      return {
        ...actual,
        validateEnvironment: () => {},
      };
    });
    vi.doMock('stellar-hd-wallet', () => ({
      default: {
        fromMnemonic: vi.fn().mockReturnValue({
          getSecret: vi.fn().mockReturnValue('SSECRET'),
        }),
      },
    }));
    vi.doMock('stellar-sdk', () => ({
      default: {
        Keypair: {
          fromSecret: vi.fn(() => ({
            publicKey: () => 'GTESTPUBLICKEY',
          })),
        },
        Contract: class {
          call(...args) {
            return contractCallMock(...args);
          }
        },
        TransactionBuilder: class {
          constructor() {
            this.addOperation = vi.fn().mockReturnThis();
            this.setTimeout = vi.fn().mockReturnThis();
            this.build = vi.fn().mockReturnValue({});
          }
        },
        TimeoutInfinite: 'TimeoutInfinite',
        nativeToScVal: vi.fn((value) => value),
        rpc: {
          Server: class {
            constructor() {
              this.prepareTransaction = prepareTransactionMock;
              this.sendTransaction = sendTransactionMock;
              this.getAccount = vi.fn().mockResolvedValue({ sequence: '12345' });
            }
          },
        },
      },
    }));
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
    fsMocks.existsSync.mockReturnValue(true);
    fsMocks.readFileSync.mockReturnValue(JSON.stringify({ signatures: ['0xabc'] }));
    transformForOnchainMock.mockReturnValue({
      signedClaim: {
        signatures: [`0x${'a'.repeat(128)}1b`],
        claim: {
          identifier: 'id',
          owner: 'owner',
          timestampS: 1,
          epoch: 1,
        },
      },
    });
    prepareTransactionMock.mockResolvedValue({ sign: vi.fn() });
    sendTransactionMock.mockResolvedValue({ hash: 'txhash' });
    process.argv = ['node', 'verifyProof.js', './proof.json'];
    const { main } = await import('../src/verifyProof.js');
    await main();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('uses default proof path when no CLI argument provided', async () => {
    vi.resetModules();
    vi.doMock('../src/config.js', async () => {
      const actual = await vi.importActual('../src/config.js');
      return {
        ...actual,
        validateEnvironment: () => {},
      };
    });
    vi.doMock('stellar-hd-wallet', () => ({
      default: {
        fromMnemonic: vi.fn().mockReturnValue({
          getSecret: vi.fn().mockReturnValue('SSECRET'),
        }),
      },
    }));
    vi.doMock('stellar-sdk', () => ({
      default: {
        Keypair: {
          fromSecret: vi.fn(() => ({
            publicKey: () => 'GTESTPUBLICKEY',
          })),
        },
        Contract: class {
          call(...args) {
            return contractCallMock(...args);
          }
        },
        TransactionBuilder: class {
          constructor() {
            this.addOperation = vi.fn().mockReturnThis();
            this.setTimeout = vi.fn().mockReturnThis();
            this.build = vi.fn().mockReturnValue({});
          }
        },
        TimeoutInfinite: 'TimeoutInfinite',
        nativeToScVal: vi.fn((value) => value),
        rpc: {
          Server: class {
            constructor() {
              this.prepareTransaction = prepareTransactionMock;
              this.sendTransaction = sendTransactionMock;
              this.getAccount = vi.fn().mockResolvedValue({ sequence: '12345' });
            }
          },
        },
      },
    }));
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
    fsMocks.existsSync.mockReturnValue(true);
    fsMocks.readFileSync.mockReturnValue(JSON.stringify({ signatures: ['0xabc'] }));
    transformForOnchainMock.mockReturnValue({
      signedClaim: {
        signatures: [`0x${'a'.repeat(128)}1b`],
        claim: {
          identifier: 'id',
          owner: 'owner',
          timestampS: 1,
          epoch: 1,
        },
      },
    });
    prepareTransactionMock.mockResolvedValue({ sign: vi.fn() });
    sendTransactionMock.mockResolvedValue({ hash: 'txhash' });
    process.argv = ['node', 'verifyProof.js'];
    const { main } = await import('../src/verifyProof.js');
    await main();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});

describe('index CLI', () => {
  it('executes default usage output', async () => {
    vi.resetModules();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    process.argv = ['node', 'index.js', 'unknown'];
    vi.doMock('../src/requestProof.js', () => ({
      requestProof: vi.fn(),
    }));
    vi.doMock('../src/verifyProof.js', () => ({
      verifyProof: vi.fn(),
    }));

    const { main } = await import('../src/index.js');
    await main();
    expect(logSpy).toHaveBeenCalled();
  });

  it('handles request and verify commands', async () => {
    vi.resetModules();
    const requestProofMock = vi.fn();
    const verifyProofMock = vi.fn();
    vi.doMock('../src/requestProof.js', () => ({
      requestProof: requestProofMock,
    }));
    vi.doMock('../src/verifyProof.js', () => ({
      verifyProof: verifyProofMock,
    }));
    process.argv = ['node', 'index.js', 'request-proof'];
    const { main } = await import('../src/index.js');
    await main();
    expect(requestProofMock).toHaveBeenCalled();

    vi.resetModules();
    vi.doMock('../src/requestProof.js', () => ({
      requestProof: requestProofMock,
    }));
    vi.doMock('../src/verifyProof.js', () => ({
      verifyProof: verifyProofMock,
    }));
    process.argv = ['node', 'index.js', 'verify-proof'];
    const { main: mainVerify } = await import('../src/index.js');
    await mainVerify();
    expect(verifyProofMock).toHaveBeenCalled();
  });

  it('handles workflow and info commands', async () => {
    vi.resetModules();
    const requestProofMock = vi.fn().mockResolvedValue({ ok: true });
    const verifyProofMock = vi.fn().mockResolvedValue('hash');
    vi.doMock('../src/requestProof.js', () => ({
      requestProof: requestProofMock,
    }));
    vi.doMock('../src/verifyProof.js', () => ({
      verifyProof: verifyProofMock,
    }));
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    process.argv = ['node', 'index.js', 'workflow'];
    const { main } = await import('../src/index.js');
    await main();
    expect(requestProofMock).toHaveBeenCalled();
    expect(verifyProofMock).toHaveBeenCalled();

    vi.resetModules();
    vi.doMock('../src/requestProof.js', () => ({
      requestProof: requestProofMock,
    }));
    vi.doMock('../src/verifyProof.js', () => ({
      verifyProof: verifyProofMock,
    }));
    process.argv = ['node', 'index.js', 'info'];
    const { main: mainInfo } = await import('../src/index.js');
    await mainInfo();
    expect(logSpy).toHaveBeenCalled();
  });

  it('handles request-goal command', async () => {
    vi.resetModules();
    const requestProofMock = vi.fn();
    vi.doMock('../src/requestProof.js', () => ({
      requestProof: requestProofMock,
    }));
    vi.doMock('../src/verifyProof.js', () => ({
      verifyProof: vi.fn(),
    }));
    process.argv = ['node', 'index.js', 'request-goal'];
    const { main } = await import('../src/index.js');
    await main();
    expect(requestProofMock).toHaveBeenCalledWith(
      undefined,
      'goal'
    );
  });

  it('handles request-accuweather command', async () => {
    vi.resetModules();
    const requestProofMock = vi.fn();
    vi.doMock('../src/requestProof.js', () => ({
      requestProof: requestProofMock,
    }));
    vi.doMock('../src/verifyProof.js', () => ({
      verifyProof: vi.fn(),
    }));
    process.argv = ['node', 'index.js', 'request-accuweather'];
    const { main } = await import('../src/index.js');
    await main();
    expect(requestProofMock).toHaveBeenCalledWith(
      undefined,
      'accuweather'
    );
  });

  it('handles request-trading-economics command', async () => {
    vi.resetModules();
    const requestProofMock = vi.fn();
    vi.doMock('../src/requestProof.js', () => ({
      requestProof: requestProofMock,
    }));
    vi.doMock('../src/verifyProof.js', () => ({
      verifyProof: vi.fn(),
    }));
    process.argv = ['node', 'index.js', 'request-trading-economics'];
    const { main } = await import('../src/index.js');
    await main();
    expect(requestProofMock).toHaveBeenCalledWith(
      undefined,
      'trading-economics'
    );
  });

  it('handles request-forbes command', async () => {
    vi.resetModules();
    const requestProofMock = vi.fn();
    vi.doMock('../src/requestProof.js', () => ({
      requestProof: requestProofMock,
    }));
    vi.doMock('../src/verifyProof.js', () => ({
      verifyProof: vi.fn(),
    }));
    process.argv = ['node', 'index.js', 'request-forbes'];
    const { main } = await import('../src/index.js');
    await main();
    expect(requestProofMock).toHaveBeenCalledWith(
      undefined,
      'forbes'
    );
  });
});

