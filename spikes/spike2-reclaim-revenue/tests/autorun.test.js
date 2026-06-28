import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
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

describe('autorun branches', () => {
  it('runs requestProof when executed directly', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
    const requestProofPath = fileURLToPath(
      new URL('../src/requestProof.js', import.meta.url)
    );
    process.argv = ['node', requestProofPath, 'stellar', './src/proof.json'];

    await import('../src/requestProof.js');
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('runs index CLI when executed directly', async () => {
    vi.doMock('../src/requestProof.js', () => ({
      requestProof: vi.fn(),
    }));
    vi.doMock('../src/verifyProof.js', () => ({
      verifyProof: vi.fn(),
    }));
    const indexPath = fileURLToPath(new URL('../src/index.js', import.meta.url));
    process.argv = ['node', indexPath, 'info'];

    await import('../src/index.js');
  });
});

