// Stellar Wallets Kit + Soroban transaction helpers.
//
// One lazily-instantiated kit (Freighter + the other browser wallets) drives
// connect/disconnect and transaction signing. invokeContract() builds, signs
// (via the connected wallet), submits and polls a Soroban contract call — the
// shared path behind every borrower/lender on-chain action.

import {
  StellarWalletsKit,
  WalletNetwork,
  allowAllModules,
  FREIGHTER_ID,
  type ISupportedWallet,
} from "@creit.tech/stellar-wallets-kit";
import {
  rpc,
  Contract,
  TransactionBuilder,
  Address,
  nativeToScVal,
  scValToNative,
  BASE_FEE,
  TimeoutInfinite,
  xdr,
} from "@stellar/stellar-sdk";

export const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
export const SOROBAN_RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ??
  "https://soroban-testnet.stellar.org";

// ---- Wallet kit (browser-only, lazy) ----

let kit: StellarWalletsKit | null = null;

function getKit(): StellarWalletsKit {
  if (typeof window === "undefined") {
    throw new Error("Wallet kit is only available in the browser");
  }
  if (!kit) {
    kit = new StellarWalletsKit({
      network: WalletNetwork.TESTNET,
      selectedWalletId: FREIGHTER_ID,
      modules: allowAllModules(),
    });
  }
  return kit;
}

const STORAGE_KEY = "trustline:walletId";

/** Open the wallet picker and return the chosen account's public key. */
export async function connectWallet(): Promise<string> {
  const k = getKit();
  return new Promise<string>((resolve, reject) => {
    k.openModal({
      onWalletSelected: async (option: ISupportedWallet) => {
        try {
          k.setWallet(option.id);
          const { address } = await k.getAddress();
          if (typeof window !== "undefined") {
            window.localStorage.setItem(STORAGE_KEY, option.id);
          }
          resolve(address);
        } catch (e) {
          reject(e);
        }
      },
      onClosed: () => reject(new Error("Wallet selection cancelled")),
    });
  });
}

/** Re-attach a previously selected wallet (on reload) and return its address, or null. */
export async function restoreWallet(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const id = window.localStorage.getItem(STORAGE_KEY);
  if (!id) return null;
  try {
    const k = getKit();
    k.setWallet(id);
    const { address } = await k.getAddress();
    return address;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function disconnectWallet(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  kit = null;
}

// ---- ScVal helpers ----

export const sc = {
  address: (addr: string) => new Address(addr).toScVal(),
  i128: (amount: bigint | string | number) =>
    nativeToScVal(BigInt(amount), { type: "i128" }),
  u32: (n: number) => nativeToScVal(n, { type: "u32" }),
};

// ---- Contract invocation ----

export interface InvokeResult {
  txHash: string;
  returnValue: unknown;
}

/**
 * Build → simulate/prepare → wallet-sign → submit → poll a Soroban contract call.
 * Throws on simulation failure or a non-SUCCESS final status.
 */
export async function invokeContract(params: {
  contractId: string;
  method: string;
  args: xdr.ScVal[];
  publicKey: string;
  rpcUrl?: string;
  networkPassphrase?: string;
}): Promise<InvokeResult> {
  const rpcUrl = params.rpcUrl ?? SOROBAN_RPC_URL;
  const passphrase = params.networkPassphrase ?? NETWORK_PASSPHRASE;
  const server = new rpc.Server(rpcUrl);
  const k = getKit();

  const source = await server.getAccount(params.publicKey);
  const contract = new Contract(params.contractId);

  const built = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: passphrase,
  })
    .addOperation(contract.call(params.method, ...params.args))
    .setTimeout(TimeoutInfinite)
    .build();

  // Simulate + assemble the footprint/auth (prepareTransaction throws on a
  // simulation error, surfacing contract panics before the wallet prompt).
  const prepared = await server.prepareTransaction(built);

  const { signedTxXdr } = await k.signTransaction(prepared.toXDR(), {
    address: params.publicKey,
    networkPassphrase: passphrase,
  });

  const signed = TransactionBuilder.fromXDR(signedTxXdr, passphrase);
  const sent = await server.sendTransaction(signed);
  if (sent.status === "ERROR") {
    throw new Error(`Transaction submission failed: ${JSON.stringify(sent.errorResult)}`);
  }

  // Poll for the final result.
  let got = await server.getTransaction(sent.hash);
  for (let i = 0; i < 30 && got.status === "NOT_FOUND"; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    got = await server.getTransaction(sent.hash);
  }

  if (got.status !== "SUCCESS") {
    throw new Error(`Transaction ${sent.hash} did not succeed: ${got.status}`);
  }

  return {
    txHash: sent.hash,
    returnValue: got.returnValue ? scValToNative(got.returnValue) : null,
  };
}

/**
 * Read-only contract call via simulation — no wallet signature, no submission.
 * Needs SOME existing funded account as the simulated tx source (sequence
 * number bookkeeping only; it never signs or pays), so pass any connected
 * wallet's public key.
 */
export async function readContract(params: {
  contractId: string;
  method: string;
  args: xdr.ScVal[];
  sourcePublicKey: string;
  rpcUrl?: string;
  networkPassphrase?: string;
}): Promise<unknown> {
  const rpcUrl = params.rpcUrl ?? SOROBAN_RPC_URL;
  const passphrase = params.networkPassphrase ?? NETWORK_PASSPHRASE;
  const server = new rpc.Server(rpcUrl);
  const source = await server.getAccount(params.sourcePublicKey);
  const contract = new Contract(params.contractId);
  const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: passphrase })
    .addOperation(contract.call(params.method, ...params.args))
    .setTimeout(30)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error);
  const okSim = sim as rpc.Api.SimulateTransactionSuccessResponse;
  return okSim.result?.retval ? scValToNative(okSim.result.retval) : null;
}

export const STELLAR_EXPERT_TX = (hash: string) =>
  `https://stellar.expert/explorer/testnet/tx/${hash}`;
