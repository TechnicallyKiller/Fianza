// portfolio/ — protocol-wide risk view across every underwritten agent.
//
// Reads each agent's on-chain vault `state()` (liquidity, principal, reserve,
// realised loss, yield, defaulted) and aggregates it into the numbers a credit
// business actually reports: total lent, utilization, reserve coverage, default
// rate, lender yield. Simulate-only (read) — never signs or moves anything.
//
// This is what turns "a demo" into "a credit book": one endpoint that shows the
// whole portfolio's health at a glance.

import {
  rpc,
  Contract,
  Address,
  TransactionBuilder,
  scValToNative,
  BASE_FEE,
} from "@stellar/stellar-sdk";
import { config } from "./config.js";
import { signerKeypair } from "./signer/index.js";
import { listResults } from "./underwrite.js";

const STROOPS = 10_000_000;

export interface AgentPosition {
  agent: string;
  tier: string;
  aprBps: number;
  limitUsdc: number;
  /** Outstanding debt (principal + accrued interest). */
  owedUsdc: number;
  principalUsdc: number;
  /** Un-borrowed liquidity sitting in the vault. */
  liquidityUsdc: number;
  reserveUsdc: number;
  yieldPoolUsdc: number;
  realizedLossUsdc: number;
  defaulted: boolean;
}

export interface Portfolio {
  agents: number;
  activeLoans: number;
  defaults: number;
  defaultRatePct: number;
  /** Total outstanding debt across all agents (the "book"). */
  totalOwedUsdc: number;
  totalPrincipalUsdc: number;
  /** Total lendable liquidity currently parked in vaults. */
  totalLiquidityUsdc: number;
  /** Capital deployed vs available: principal / (principal + liquidity). */
  utilizationPct: number;
  totalReserveUsdc: number;
  /** How many times the reserve buffer covers current outstanding debt. */
  reserveCoverageX: number;
  totalYieldUsdc: number;
  totalRealizedLossUsdc: number;
  /** Weighted-average APR across active loans (bps). */
  avgAprBps: number;
  positions: AgentPosition[];
  /** Testnet treasury as sole lender today; the tiered pool is the mainnet plan. */
  lenderModel: "testnet-treasury-v0";
}

function srv(): rpc.Server {
  return new rpc.Server(config.sorobanRpcUrl);
}

/** Read one agent's full vault state via the `state(agent)` view (read-only). */
async function readState(agent: string): Promise<Record<string, unknown> | null> {
  if (!config.lendingVaultContractId) return null;
  try {
    const s = srv();
    const acct = await s.getAccount(signerKeypair().publicKey());
    const tx = new TransactionBuilder(acct, {
      fee: BASE_FEE,
      networkPassphrase: config.networkPassphrase,
    })
      .addOperation(
        new Contract(config.lendingVaultContractId).call(
          "state",
          Address.fromString(agent).toScVal(),
        ),
      )
      .setTimeout(30)
      .build();
    const sim = await s.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) return null;
    return sim.result?.retval ? (scValToNative(sim.result.retval) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const usdc = (v: unknown): number => {
  try {
    return Number(BigInt((v ?? 0) as bigint)) / STROOPS;
  } catch {
    return 0;
  }
};

// Short-TTL cache + in-flight de-duplication. /portfolio does one simulated
// RPC call per underwritten agent (currently a handful, but it's O(n) and this
// is polled every 20s per open browser tab — see frontend/app/portfolio/page.tsx
// — plus read by /api/status). Without this, N tabs polling at once each
// trigger their own full fan-out of RPC calls. A short cache means concurrent/
// rapid callers within the window share one fan-out instead of one each.
const CACHE_TTL_MS = 12_000;
let cache: { at: number; data: Portfolio } | null = null;
let inflight: Promise<Portfolio> | null = null;

/**
 * Build the protocol-wide portfolio view. Reads every underwritten agent's
 * vault state in parallel and aggregates. Best-effort per agent: an agent whose
 * state can't be read is skipped rather than failing the whole view. Cached for
 * CACHE_TTL_MS; pass `fresh: true` to bypass (e.g. a manual refresh button).
 */
export async function getPortfolio(opts: { fresh?: boolean } = {}): Promise<Portfolio> {
  if (!opts.fresh && cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.data;
  }
  if (!opts.fresh && inflight) {
    return inflight;
  }
  const p = buildPortfolio();
  inflight = p;
  try {
    const data = await p;
    cache = { at: Date.now(), data };
    return data;
  } finally {
    inflight = null;
  }
}

async function buildPortfolio(): Promise<Portfolio> {
  const agents = await listResults();

  const positions: AgentPosition[] = [];
  await Promise.all(
    agents.map(async (a) => {
      const s = await readState(a.agent);
      if (!s) return;
      positions.push({
        agent: a.agent,
        tier: a.score.tier,
        aprBps: Number(s.apr_bps ?? a.score.aprBps ?? 0),
        limitUsdc: usdc(s.limit),
        owedUsdc: usdc(s.amount_owed),
        principalUsdc: usdc(s.principal),
        liquidityUsdc: usdc(s.liquidity),
        reserveUsdc: usdc(s.reserve),
        yieldPoolUsdc: usdc(s.yield_pool),
        realizedLossUsdc: usdc(s.realized_loss),
        defaulted: s.defaulted === true,
      });
    }),
  );

  const sum = (f: (p: AgentPosition) => number) => positions.reduce((t, p) => t + f(p), 0);

  const totalOwed = sum((p) => p.owedUsdc);
  const totalPrincipal = sum((p) => p.principalUsdc);
  const totalLiquidity = sum((p) => p.liquidityUsdc);
  const totalReserve = sum((p) => p.reserveUsdc);
  const defaults = positions.filter((p) => p.defaulted).length;
  const activeLoans = positions.filter((p) => p.principalUsdc > 0).length;

  // Weighted-average APR across positions that actually carry debt.
  const debtPositions = positions.filter((p) => p.owedUsdc > 0);
  const avgAprBps =
    debtPositions.length > 0
      ? Math.round(
          debtPositions.reduce((t, p) => t + p.aprBps * p.owedUsdc, 0) /
            debtPositions.reduce((t, p) => t + p.owedUsdc, 0),
        )
      : 0;

  const deployedBase = totalPrincipal + totalLiquidity;

  return {
    agents: positions.length,
    activeLoans,
    defaults,
    defaultRatePct: positions.length ? round2((defaults / positions.length) * 100) : 0,
    totalOwedUsdc: round7(totalOwed),
    totalPrincipalUsdc: round7(totalPrincipal),
    totalLiquidityUsdc: round7(totalLiquidity),
    utilizationPct: deployedBase > 0 ? round2((totalPrincipal / deployedBase) * 100) : 0,
    totalReserveUsdc: round7(totalReserve),
    reserveCoverageX: totalOwed > 0 ? round2(totalReserve / totalOwed) : 0,
    totalYieldUsdc: round7(sum((p) => p.yieldPoolUsdc)),
    totalRealizedLossUsdc: round7(sum((p) => p.realizedLossUsdc)),
    avgAprBps,
    positions: positions.sort((a, b) => b.owedUsdc - a.owedUsdc),
    lenderModel: "testnet-treasury-v0",
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round7 = (n: number) => Math.round(n * 1e7) / 1e7;
