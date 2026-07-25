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

async function signAndSubmit(op: ReturnType<Contract["call"]>): Promise<string> {
  const srv = server();
  const kp = agentKeypair();
  const acct = await srv.getAccount(kp.publicKey());
  const tx = new TransactionBuilder(acct, {
    fee: BASE_FEE,
    networkPassphrase: mainnetConfig.networkPassphrase,
  })
    .addOperation(op)
    .setTimeout(TimeoutInfinite)
    .build();

  const prepared = await srv.prepareTransaction(tx);
  prepared.sign(kp);
  const sent = await srv.sendTransaction(prepared);
  if (sent.status === "ERROR") {
    throw new Error(`submit failed: ${JSON.stringify(sent.errorResult)}`);
  }
  let got = await srv.getTransaction(sent.hash);
  for (let i = 0; i < 30 && got.status === "NOT_FOUND"; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    got = await srv.getTransaction(sent.hash);
  }
  if (got.status !== "SUCCESS") {
    throw new Error(`tx did not confirm: ${got.status}`);
  }
  return sent.hash;
}

/** Real, signed mainnet borrow() — moves real USDC from the vault to the agent. */
export async function mainnetBorrow(amountUsdc: number): Promise<string> {
  if (!mainnetAgentConfigured()) throw new Error("MAINNET_AGENT_SECRET not set");
  const kp = agentKeypair();
  const amount = BigInt(Math.round(amountUsdc * STROOPS));
  return signAndSubmit(
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
  return signAndSubmit(
    new Contract(mainnetConfig.lendingVaultContractId).call(
      "repay",
      Address.fromString(kp.publicKey()).toScVal(),
      nativeToScVal(amount, { type: "i128" }),
    ),
  );
}
