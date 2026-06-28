import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFIG } from '../src/config.js';

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

const stellarSdkMock = {
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
        this.getAccount = vi.fn().mockResolvedValue({ sequence: '12345' });
      }
    },
  },
};

vi.mock('@stellar/stellar-sdk', () => stellarSdkMock);

vi.mock('stellar-sdk', () => ({
  default: stellarSdkMock,
  ...stellarSdkMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
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

describe('requestProof', () => {
  it('throws for invalid output path', async () => {
    const { requestProof } = await import('../src/requestProof.js');
    await expect(requestProof(null)).rejects.toThrow(
      'Output path must be a valid string'
    );
  });

  it('throws when output directory is missing', async () => {
    fsMocks.existsSync.mockReturnValue(false);
    const { requestProof } = await import('../src/requestProof.js');
    await expect(requestProof('./missing/proof.json')).rejects.toThrow(
      'Directory does not exist'
    );
  });

  it('throws when output path is not a directory', async () => {
    fsMocks.statSync.mockReturnValue({ isDirectory: () => false });
    const { requestProof } = await import('../src/requestProof.js');
    await expect(requestProof('./src/proof.json')).rejects.toThrow(
      'Path is not a directory'
    );
  });

  it('throws for unknown proof type', async () => {
    const { requestProof } = await import('../src/requestProof.js');
    await expect(requestProof('./src/proof.json', 'unknown')).rejects.toThrow(
      'Unknown proof type'
    );
  });

  it('throws when reclaim client cannot be created', async () => {
    ReclaimClientMock.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    const { requestProof } = await import('../src/requestProof.js');
    await expect(requestProof('./src/proof.json', 'stellar')).rejects.toThrow(
      'Failed to create Reclaim client'
    );
  });

  it('throws when proof generation fails', async () => {
    zkFetchMock.mockRejectedValueOnce(new Error('network down'));
    const { requestProof } = await import('../src/requestProof.js');
    await expect(requestProof('./src/proof.json', 'stellar')).rejects.toThrow(
      'Failed to generate proof'
    );
  });

  it('generates a stellar proof and saves it', async () => {
    const { requestProof } = await import('../src/requestProof.js');
    const proof = await requestProof('./src/proof.json', 'stellar');

    expect(proof).toEqual(
      expect.objectContaining({
        extractedParameterValues: { price: '1.23' },
      })
    );
    expect(ReclaimClientMock).toHaveBeenCalledWith(
      CONFIG.RECLAIM.APP_ID,
      CONFIG.RECLAIM.APP_SECRET
    );
    expect(zkFetchMock).toHaveBeenCalledWith(
      CONFIG.API.COINGECKO_STELLAR_PRICE,
      { method: 'GET' },
      expect.any(Object)
    );
    expect(fsMocks.writeFileSync).toHaveBeenCalledWith(
      './src/proof.json',
      expect.any(String)
    );
  });

  it('writes proof data and fails if saving throws', async () => {
    fsMocks.writeFileSync.mockImplementationOnce(() => {
      throw new Error('disk full');
    });
    const { requestProof } = await import('../src/requestProof.js');
    await expect(requestProof('./src/proof.json', 'stellar')).rejects.toThrow(
      'Failed to save proof'
    );
  });

  it('routes additional proof types through zkFetch', async () => {
    const { requestProof } = await import('../src/requestProof.js');
    await requestProof('./src/proof.json', 'forbes');

    expect(zkFetchMock).toHaveBeenCalledWith(
      CONFIG.API.FORBES_BILLIONAIRES,
      expect.any(Object),
      expect.any(Object)
    );
  });

  it('routes remaining proof types', async () => {
    const { requestProof } = await import('../src/requestProof.js');
    await requestProof('./src/proof.json', 'trading-economics');
    await requestProof('./src/proof.json', 'accuweather');
    await requestProof('./src/proof.json', 'goal');

    expect(zkFetchMock).toHaveBeenCalledWith(
      CONFIG.API.TRADING_ECONOMICS_COUNTRIES,
      expect.any(Object),
      expect.any(Object)
    );
    expect(zkFetchMock).toHaveBeenCalledWith(
      CONFIG.API.ACCUWEATHER_NYC,
      expect.any(Object),
      expect.any(Object)
    );
    expect(zkFetchMock).toHaveBeenCalledWith(
      CONFIG.API.GOAL_LIVE_SCORES,
      expect.any(Object),
      expect.any(Object)
    );
  });

  it('throws when goal proof generation fails', async () => {
    zkFetchMock.mockRejectedValueOnce(new Error('goal fail'));
    const { requestProof } = await import('../src/requestProof.js');
    await expect(requestProof('./src/proof.json', 'goal')).rejects.toThrow(
      'Failed to generate Goal.com proof'
    );
  });

  it('logs goal scores when extracted values are present', async () => {
    zkFetchMock.mockResolvedValueOnce({
      extractedParameterValues: {
        team1: 'A',
        team2: 'B',
        score1: '1',
        score2: '2',
      },
    });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { requestProof } = await import('../src/requestProof.js');
    await requestProof('./src/proof.json', 'goal');

    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('logs AccuWeather city and temperature when present', async () => {
    zkFetchMock.mockResolvedValueOnce({
      extractedParameterValues: {
        city: 'New York',
        tempInC: '20',
      },
    });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { requestProof } = await import('../src/requestProof.js');
    await requestProof('./src/proof.json', 'accuweather');

    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('throws when AccuWeather proof generation fails', async () => {
    zkFetchMock.mockRejectedValueOnce(new Error('accu fail'));
    const { requestProof } = await import('../src/requestProof.js');
    await expect(requestProof('./src/proof.json', 'accuweather')).rejects.toThrow(
      'Failed to generate AccuWeather proof'
    );
  });

  it('logs Forbes entries only when all fields are present', async () => {
    zkFetchMock.mockResolvedValueOnce({
      extractedParameterValues: {
        name1: 'Alice',
        rank1: '1',
        worth1: '100',
        name2: 'Bob',
        rank2: '2',
      },
    });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { requestProof } = await import('../src/requestProof.js');
    await requestProof('./src/proof.json', 'forbes');

    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('throws when Forbes proof generation fails', async () => {
    zkFetchMock.mockRejectedValueOnce(new Error('forbes fail'));
    const { requestProof } = await import('../src/requestProof.js');
    await expect(requestProof('./src/proof.json', 'forbes')).rejects.toThrow(
      'Failed to generate Forbes proof'
    );
  });
});

describe('verifyProof', () => {
  it('throws if proof file is missing', async () => {
    fsMocks.existsSync.mockReturnValue(false);
    const { verifyProof } = await import('../src/verifyProof.js');
    await expect(verifyProof('./missing.json')).rejects.toThrow(
      'Proof file not found'
    );
  });

  it('throws if wallet creation fails', async () => {
    fromMnemonicMock.mockImplementationOnce(() => {
      throw new Error('no wallet');
    });
    const { verifyProof } = await import('../src/verifyProof.js');
    await expect(verifyProof('./src/proof.json')).rejects.toThrow(
      'Failed to create Stellar wallet'
    );
  });

  it('throws if proof signatures are missing', async () => {
    fsMocks.readFileSync.mockImplementationOnce(() =>
      JSON.stringify({ signatures: [] })
    );
    const { verifyProof } = await import('../src/verifyProof.js');
    await expect(verifyProof('./src/proof.json')).rejects.toThrow(
      'Invalid proof: missing signatures'
    );
  });

  it('throws if proof file is invalid JSON', async () => {
    fsMocks.readFileSync.mockImplementationOnce(() => '{bad json');
    const { verifyProof } = await import('../src/verifyProof.js');
    await expect(verifyProof('./src/proof.json')).rejects.toThrow(
      'Failed to load proof'
    );
  });

  it('throws if proof data is invalid', async () => {
    transformForOnchainMock.mockReturnValueOnce({
      signedClaim: {
        signatures: ['0x1234'],
        claim: {
          identifier: 'id',
          owner: 'owner',
          timestampS: 1,
          epoch: 1,
        },
      },
    });
    const { verifyProof } = await import('../src/verifyProof.js');
    await expect(verifyProof('./src/proof.json')).rejects.toThrow(
      'Failed to prepare proof data'
    );
  });

  it('throws if submitting transaction fails', async () => {
    sendTransactionMock.mockRejectedValueOnce(new Error('rpc down'));
    const { verifyProof } = await import('../src/verifyProof.js');
    await expect(verifyProof('./src/proof.json')).rejects.toThrow(
      'Failed to submit transaction'
    );
  });

  it('verifies proof and returns transaction hash', async () => {
    const { verifyProof } = await import('../src/verifyProof.js');
    const txHash = await verifyProof('./src/proof.json');

    expect(txHash).toBe('txhash');
    expect(transformForOnchainMock).toHaveBeenCalled();
    expect(prepareTransactionMock).toHaveBeenCalled();
    expect(sendTransactionMock).toHaveBeenCalled();
  });
});

describe('ZkFetchStellarApp', () => {
  it('routes to the correct proof type', async () => {
    vi.resetModules();
    const requestProofMock = vi.fn();
    const verifyProofMock = vi.fn();

    vi.doMock('../src/requestProof.js', () => ({
      requestProof: requestProofMock,
    }));
    vi.doMock('../src/verifyProof.js', () => ({
      verifyProof: verifyProofMock,
    }));

    const { ZkFetchStellarApp } = await import('../src/index.js');
    const app = new ZkFetchStellarApp();
    await app.requestTradingEconomicsProof('./out.json');

    expect(requestProofMock).toHaveBeenCalledWith(
      './out.json',
      'trading-economics'
    );
  });

  it('routes additional app methods to helpers', async () => {
    vi.resetModules();
    const requestProofMock = vi.fn();
    const verifyProofMock = vi.fn();

    vi.doMock('../src/requestProof.js', () => ({
      requestProof: requestProofMock,
    }));
    vi.doMock('../src/verifyProof.js', () => ({
      verifyProof: verifyProofMock,
    }));

    const { ZkFetchStellarApp } = await import('../src/index.js');
    const app = new ZkFetchStellarApp();

    await app.requestForbesProof('./forbes.json');
    await app.requestAccuWeatherProof('./weather.json');
    await app.requestGoalProof('./goal.json');
    await app.verifyProofOnStellar('./proof.json');

    expect(requestProofMock).toHaveBeenCalledWith('./forbes.json', 'forbes');
    expect(requestProofMock).toHaveBeenCalledWith(
      './weather.json',
      'accuweather'
    );
    expect(requestProofMock).toHaveBeenCalledWith('./goal.json', 'goal');
    expect(verifyProofMock).toHaveBeenCalledWith('./proof.json');
  });

  it('runs complete workflow successfully', async () => {
    vi.resetModules();
    const requestProofMock = vi.fn().mockResolvedValue({ ok: true });
    const verifyProofMock = vi.fn().mockResolvedValue('txhash');

    vi.doMock('../src/requestProof.js', () => ({
      requestProof: requestProofMock,
    }));
    vi.doMock('../src/verifyProof.js', () => ({
      verifyProof: verifyProofMock,
    }));

    const { ZkFetchStellarApp } = await import('../src/index.js');
    const app = new ZkFetchStellarApp();
    const result = await app.runCompleteWorkflow('./proof.json');

    expect(result).toEqual({
      proof: { ok: true },
      transactionHash: 'txhash',
      success: true,
    });
  });

  it('returns error result when workflow fails', async () => {
    vi.resetModules();
    const requestProofMock = vi.fn().mockRejectedValue(new Error('fail'));
    const verifyProofMock = vi.fn();

    vi.doMock('../src/requestProof.js', () => ({
      requestProof: requestProofMock,
    }));
    vi.doMock('../src/verifyProof.js', () => ({
      verifyProof: verifyProofMock,
    }));

    const { ZkFetchStellarApp } = await import('../src/index.js');
    const app = new ZkFetchStellarApp();
    const result = await app.runCompleteWorkflow('./proof.json');

    expect(result).toEqual({ error: 'fail', success: false });
    expect(verifyProofMock).not.toHaveBeenCalled();
  });

  it('prints app info', async () => {
    vi.resetModules();
    vi.doMock('../src/requestProof.js', () => ({
      requestProof: vi.fn(),
    }));
    vi.doMock('../src/verifyProof.js', () => ({
      verifyProof: vi.fn(),
    }));

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { ZkFetchStellarApp } = await import('../src/index.js');
    const app = new ZkFetchStellarApp();
    app.displayInfo();

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('zkFetch'));
    logSpy.mockRestore();
  });
});

