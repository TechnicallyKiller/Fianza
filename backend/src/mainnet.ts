// mainnet/ — isolated, minimal mainnet-facing routes.
//
// Deliberately NOT the full underwriting engine ported to mainnet: there is no
// real mainnet agent revenue yet to index/score, so a live mainnet indexer or
// scorer would have nothing genuine to underwrite against. This module only
// reads the mainnet contracts directly (score_registry -> credit_line ->
// lending_vault, already wired and verified live) and signs real borrow/repay
// transactions with a dedicated mainnet agent key. Entirely separate from the
// testnet config/routes in config.ts and server.ts — nothing here is reachable
// unless MAINNET_* env vars are set, and nothing testnet-side imports this file.

import {
  rpc,
  Contract,
  Address,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  Keypair,
  TimeoutInfinite,
  BASE_FEE,
} from "@stellar/stellar-sdk";

const STROOPS = 10_000_000;

function opt(name: string, fallback = ""): string {
  const v = process.env[name];
  return v && v.trim() !== "" ? v : fallback;
}

// Free public mainnet Soroban RPCs are individually flaky (seen firsthand
// during the original contract deploy this session — timeouts and
// TxInsufficientFee on all three of these at different points). Reads
// (simulateTransaction) tend to succeed on the first RPC that responds; writes
// (sendTransaction + poll-to-confirmation) are where flakiness actually bites,
// so borrow/repay try each RPC in this list in turn rather than trusting one.
// MAINNET_RPC_URL, if set, is tried first. For anything beyond occasional demo
// use, get a dedicated RPC key (e.g. an Ankr or QuickNode free-tier endpoint)
// and set MAINNET_RPC_URL — free public endpoints are shared/rate-limited and
// were never meant to carry production write traffic.
const FALLBACK_RPC_URLS = [
  "https://mainnet.sorobanrpc.com",
  "https://rpc.ankr.com/stellar_soroban",
  "https://soroban-rpc.mainnet.stellar.gateway.fm",
];

function rpcUrls(): string[] {
  const configured = opt("MAINNET_RPC_URL");
  const urls = configured ? [configured, ...FALLBACK_RPC_URLS] : FALLBACK_RPC_URLS;
  return Array.from(new Set(urls));
}

export const mainnetConfig = {
  network: "mainnet",
  sorobanRpcUrl: opt("MAINNET_RPC_URL", "https://mainnet.sorobanrpc.com"),
  networkPassphrase: "Public Global Stellar Network ; September 2015",
  scoreRegistryContractId: opt(
    "MAINNET_SCORE_REGISTRY_CONTRACT_ID",
    "CAHWYFLMQI6BBOL6ZLZRRINCK6KVBX73ACH7LCPB24WDED4LSMCI7YZC",
  ),
  creditLineContractId: opt(
    "MAINNET_CREDIT_LINE_CONTRACT_ID",
    "CDK7S4UWY227FHFKDSV37DGT7AIJ5Z2QEYO5AY456M7RBGJN25WYJVGC",
  ),
  lendingVaultContractId: opt(
    "MAINNET_LENDING_VAULT_CONTRACT_ID",
    "CAE5C5UJYVED5DAVY4YKYT6E2C4NBZCIUBAK2MXGKGLKZESBBXKFPZ4U",
  ),
  usdcSac: opt("MAINNET_USDC_SAC", "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75"),
  // The demo agent's own key — it must sign its own borrow()/repay() calls
  // (agent.require_auth() on-chain), same as the testnet ANALYST_WALLET_SECRET
  // pattern in agents/demo/agent-runtime.mjs. Unset => borrow/repay routes are
  // inert (available-credit reads still work with any queried address).
  agentSecret: opt("MAINNET_AGENT_SECRET"),
} as const;

export function mainnetAgentConfigured(): boolean {
  return !!mainnetConfig.agentSecret;
}

let cachedAgentKeypair: Keypair | null = null;
function agentKeypair(): Keypair {
  if (!cachedAgentKeypair) cachedAgentKeypair = Keypair.fromSecret(mainnetConfig.agentSecret);
  return cachedAgentKeypair;
}

export function mainnetAgentPublicKey(): string | null {
  if (!mainnetConfig.agentSecret) return null;
  try {
    return agentKeypair().publicKey();
  } catch {
    return null;
  }
}

function server(): rpc.Server {
  return new rpc.Server(mainnetConfig.sorobanRpcUrl);
}

/** Read-only simulate call, decoded via scValToNative. Throws on sim error. */
async function simulateRead(
  contractId: string,
  method: string,
  args: ReturnType<typeof nativeToScVal>[],
  sourcePublicKey: string,
) {
  const srv = server();
  const acct = await srv.getAccount(sourcePublicKey);
  const tx = new TransactionBuilder(acct, {
    fee: BASE_FEE,
    networkPassphrase: mainnetConfig.networkPassphrase,
  })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(30)
    .build();
  const sim = await srv.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`simulate ${method} failed: ${sim.error}`);
  }
  return sim.result?.retval ? scValToNative(sim.result.retval) : null;
}

export interface MainnetCreditInfo {
  agent: string;
  tier: string | number;
  limitUsdc: number;
  aprBps: number;
  vault: {
    liquidityUsdc: number;
    principalUsdc: number;
    amountOwedUsdc: number;
    availableCreditUsdc: number;
  } | null;
}

/**
 * Read an agent's live mainnet terms (credit_line.terms) + vault state
 * (lending_vault.state / available_credit). Read-only — never signs. Uses the
 * queried address itself as the simulation's fee-source account (any funded
 * account works for a read-only sim; no auth is actually required to read).
 */
export async function mainnetCreditInfo(agent: string): Promise<MainnetCreditInfo> {
  const agentScVal = Address.fromString(agent).toScVal();

  const terms = (await simulateRead(
    mainnetConfig.creditLineContractId,
    "terms",
    [agentScVal],
    agent,
  )) as { tier?: string | number; limit?: bigint | number; apr_bps?: number } | null;

  let vault: MainnetCreditInfo["vault"] = null;
  try {
    const state = (await simulateRead(
      mainnetConfig.lendingVaultContractId,
      "state",
      [agentScVal],
      agent,
    )) as Record<string, bigint | number> | null;
    const available = (await simulateRead(
      mainnetConfig.lendingVaultContractId,
      "available_credit",
      [agentScVal],
      agent,
    )) as bigint | number | null;
    if (state) {
      vault = {
        liquidityUsdc: Number(BigInt(state.liquidity ?? 0)) / STROOPS,
        principalUsdc: Number(BigInt(state.principal ?? 0)) / STROOPS,
        amountOwedUsdc: Number(BigInt(state.amount_owed ?? 0)) / STROOPS,
        availableCreditUsdc: Number(BigInt(available ?? 0)) / STROOPS,
      };
    }
  } catch {
    // Vault read is best-effort; terms() alone is still useful if this fails.
  }

  return {
    agent,
    tier: terms?.tier ?? "unrated",
    limitUsdc: Number(BigInt(terms?.limit ?? 0)) / STROOPS,
    aprBps: terms?.apr_bps ?? 0,
    vault,
  };
}

/**
 * Poll every candidate RPC (not just the one that submitted) for a hash's
 * confirmation. A submitting RPC that goes silent doesn't mean the tx didn't
 * land — Stellar's mempool is shared, so a different public RPC often sees it
 * when the first one is the flaky one.
 */
async function pollAnyRpc(hash: string, urls: string[], attempts = 20): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    for (const url of urls) {
      try {
        const got = await new rpc.Server(url).getTransaction(hash);
        if (got.status === "SUCCESS") return true;
        if (got.status === "FAILED") {
          throw new Error(`tx failed on-chain: ${JSON.stringify((got as { resultXdr?: unknown }).resultXdr ?? got)}`);
        }
      } catch (e) {
        if (e instanceof Error && e.message.startsWith("tx failed on-chain")) throw e;
        // RPC-level error (this endpoint down/erroring) — try the next one.
      }
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

/**
 * Sign and submit against each candidate RPC in turn until one accepts the
 * submission, then poll ALL of them for confirmation (see pollAnyRpc). Each
 * RPC attempt rebuilds the transaction against ITS OWN account/sequence read,
 * so a stale sequence from a previous failed attempt never causes a
 * txBadSeq — only one submission is ever in flight at a time.
 */
async function signAndSubmit(buildOp: () => ReturnType<Contract["call"]>): Promise<string> {
  const kp = agentKeypair();
  const urls = rpcUrls();
  let lastErr: Error | null = null;

  for (const url of urls) {
    const srv = new rpc.Server(url);
    try {
      const acct = await srv.getAccount(kp.publicKey());
      const tx = new TransactionBuilder(acct, {
        fee: BASE_FEE,
        networkPassphrase: mainnetConfig.networkPassphrase,
      })
        .addOperation(buildOp())
        .setTimeout(TimeoutInfinite)
        .build();

      const prepared = await srv.prepareTransaction(tx);
      prepared.sign(kp);
      const sent = await srv.sendTransaction(prepared);
      if (sent.status === "ERROR") {
        lastErr = new Error(`submit via ${url} failed: ${JSON.stringify(sent.errorResult)}`);
        continue;
      }

      const confirmed = await pollAnyRpc(sent.hash, urls);
      if (confirmed) return sent.hash;
      lastErr = new Error(`submitted (${sent.hash}) via ${url} but no RPC confirmed it in time`);
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastErr ?? new Error("all mainnet RPC endpoints failed");
}

/** Real, signed mainnet borrow() — moves real USDC from the vault to the agent. */
export async function mainnetBorrow(amountUsdc: number): Promise<string> {
  if (!mainnetAgentConfigured()) throw new Error("MAINNET_AGENT_SECRET not set");
  const kp = agentKeypair();
  const amount = BigInt(Math.round(amountUsdc * STROOPS));
  return signAndSubmit(() =>
    new Contract(mainnetConfig.lendingVaultContractId).call(
      "borrow",
      Address.fromString(kp.publicKey()).toScVal(),
      nativeToScVal(amount, { type: "i128" }),
    ),
  );
}

/** Real, signed mainnet repay() — pays USDC back into the vault. */
export async function mainnetRepay(amountUsdc: number): Promise<string> {
  if (!mainnetAgentConfigured()) throw new Error("MAINNET_AGENT_SECRET not set");
  const kp = agentKeypair();
  const amount = BigInt(Math.round(amountUsdc * STROOPS));
  return signAndSubmit(() =>
    new Contract(mainnetConfig.lendingVaultContractId).call(
      "repay",
      Address.fromString(kp.publicKey()).toScVal(),
      nativeToScVal(amount, { type: "i128" }),
    ),
  );
}
