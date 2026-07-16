// DeFindex yield-on-idle integration (lender side) — read surface for the UI.
//
// TrustLine's DeFindex-integrated lending_vault sweeps idle lender liquidity
// into a DeFindex USDC vault (Blend strategy) so it earns yield while it waits
// to be borrowed, then divests on demand for instant draws. The value path is
// fully on-chain (lending_vault ↔ DeFindex vault); this module only READS the
// live DeFindex vault to show lenders where the idle yield comes from.
//
// Testnet reality (surfaced honestly in the UI): DeFindex/Blend settle in their
// own testnet USDC, distinct from TrustLine's main USDC with no swap pool
// between them, so this integration runs in DeFindex's USDC. On mainnet all
// converge on Circle USDC and the split disappears.

import { rpc, xdr, Address, scValToNative, Contract, TransactionBuilder, Account } from "@stellar/stellar-sdk";
import { config } from "../config.js";
import { rpcErrorMessage } from "../rpc-error.js";

const server = new rpc.Server(config.sorobanRpcUrl, { allowHttp: false });
// A well-formed but unimportant source account for read-only simulation.
const SIM_SOURCE = "GCNFNO4A4WPHUNNT3YJ36J4NIW4SV46XNO35Y355TMJF6DVPVXM3KWXF";

export interface DefindexStatus {
  configured: boolean;
  /** TrustLine's DeFindex-integrated lending vault. */
  integratedVault: string;
  /** DeFindex USDC vault idle capital is swept into. */
  treasuryVault: string;
  /** DeFindex/Blend testnet USDC this integration settles in. */
  usdc: string;
  /** Live total assets in the DeFindex vault (USDC), or null if unreadable. */
  vaultTvlUsdc: number | null;
  /** Net APY as a fraction (e.g. 0.052), or null if unavailable. */
  netApy: number | null;
  /** Where netApy came from. */
  apySource: "api" | "unavailable";
  strategy: string;
  /** Testnet asset-fragmentation note + mainnet framing for the UI. */
  note: string;
  mainnetCompatible: true;
}

/** Simulate a read-only contract call and decode the result. */
async function simRead(contractId: string, method: string): Promise<unknown> {
  const acct = new Account(SIM_SOURCE, "0");
  const tx = new TransactionBuilder(acct, {
    fee: "100",
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(new Contract(contractId).call(method))
    .setTimeout(30)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error);
  return sim.result?.retval ? scValToNative(sim.result.retval) : null;
}

/** Live total managed USDC in the DeFindex vault (idle + invested), best-effort. */
async function readVaultTvlUsdc(vault: string): Promise<number | null> {
  try {
    const funds = (await simRead(vault, "fetch_total_managed_funds")) as
      | { total_amount?: bigint | number | string }[]
      | null;
    const total = funds?.[0]?.total_amount;
    if (total == null) return null;
    return Number(BigInt(total)) / 1e7;
  } catch {
    return null;
  }
}

/** Live net APY from the DeFindex hosted API when an API key is set (display only). */
async function readApy(vault: string): Promise<number | null> {
  const { apiKey, apiBaseUrl } = config.defindex;
  if (!apiKey) return null;
  try {
    const r = await fetch(`${apiBaseUrl}/vault/${vault}/apy?network=testnet`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { apyPercent?: string | number };
    if (j.apyPercent == null) return null;
    return Number(j.apyPercent) / 100;
  } catch {
    return null;
  }
}

const NOTE =
  "Testnet only: DeFindex/Blend settle in their own testnet USDC, separate from " +
  "TrustLine's main testnet USDC with no swap pool between them — so this yield " +
  "integration runs in DeFindex's USDC. On mainnet everything settles in Circle " +
  "USDC and this split disappears; the integration is mainnet-compatible as built.";

export async function defindexStatus(): Promise<DefindexStatus> {
  const { integratedVault, treasuryVault, usdc } = config.defindex;
  const configured = Boolean(integratedVault && treasuryVault);
  const [vaultTvlUsdc, apy] = await Promise.all([
    configured ? readVaultTvlUsdc(treasuryVault) : Promise.resolve(null),
    configured ? readApy(treasuryVault) : Promise.resolve(null),
  ]);
  return {
    configured,
    integratedVault,
    treasuryVault,
    usdc,
    vaultTvlUsdc,
    netApy: apy,
    apySource: apy != null ? "api" : "unavailable",
    strategy: "Blend strategy",
    note: NOTE,
    mainnetCompatible: true,
  };
}
