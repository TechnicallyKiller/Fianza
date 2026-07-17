// treasury/ — TrustLine's lender-of-first-resort for testnet.
//
// A credit line is only PERMISSION to borrow; the USDC an agent draws has to
// come from a lender who deposited into that agent's isolated vault. On testnet
// there are no organic lenders yet, so the treasury bootstraps liquidity: when
// an agent needs to borrow and its vault is short, the treasury deposits just
// enough (capped) so the borrow can proceed.
//
// TESTNET-ONLY BOOTSTRAP. On mainnet, independent third-party lenders take the
// default risk; TrustLine seeding vaults its own engine underwrote is a
// demo/cold-start posture, not a mainnet one. Gated hard on TREASURY_SECRET —
// unset => every function here is inert.
//
// The treasury is a REAL lender: its deposits mint it vault shares, so it earns
// the lender yield on repaid interest and can withdraw later. It does NOT pay
// agents (that would look like fake revenue and break anti-Sybil) — it only
// deposits lender→vault.

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
import { config } from "./config.js";

const STROOPS = 10_000_000;

export interface TopUpResult {
  /** Whether the treasury deposited anything. */
  deposited: boolean;
  /** USDC deposited into the vault this call (0 if none needed / possible). */
  amountUsdc: number;
  txHash?: string;
  /** Why nothing was deposited, when deposited=false. */
  reason?: string;
}

export function treasuryConfigured(): boolean {
  return !!config.treasurySecret && !!config.lendingVaultContractId;
}

let cached: Keypair | null = null;
function treasuryKeypair(): Keypair {
  if (!cached) cached = Keypair.fromSecret(config.treasurySecret);
  return cached;
}

function server(): rpc.Server {
  return new rpc.Server(config.sorobanRpcUrl);
}

/** Read a numeric i128 from a vault view fn (returns 0 on any failure). */
async function readVaultI128(method: string, agent: string): Promise<number> {
  try {
    const srv = server();
    const acct = await srv.getAccount(treasuryKeypair().publicKey());
    const tx = new TransactionBuilder(acct, {
      fee: BASE_FEE,
      networkPassphrase: config.networkPassphrase,
    })
      .addOperation(
        new Contract(config.lendingVaultContractId).call(
          method,
          Address.fromString(agent).toScVal(),
        ),
      )
      .setTimeout(30)
      .build();
    const sim = await srv.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) return 0;
    const v = sim.result?.retval ? scValToNative(sim.result.retval) : 0;
    return Number(BigInt(v ?? 0)) / STROOPS;
  } catch {
    return 0;
  }
}

/**
 * Ensure `agent`'s vault holds at least `neededUsdc` of borrowable liquidity,
 * topping up from the treasury if it's short. Bounded by:
 *   - treasuryMaxPerVaultUsdc (per-call cap)
 *   - the agent's available credit (never seed more than it can borrow)
 *   - the treasury wallet's actual USDC balance
 * Best-effort and non-throwing: any failure returns { deposited:false, reason }
 * so the caller (borrow flow) can fall through to the normal "insufficient
 * liquidity" path rather than break.
 */
export async function ensureLiquidity(agent: string, neededUsdc: number): Promise<TopUpResult> {
  if (!treasuryConfigured()) {
    return { deposited: false, amountUsdc: 0, reason: "treasury not configured (TREASURY_SECRET unset)" };
  }
  if (!(neededUsdc > 0)) {
    return { deposited: false, amountUsdc: 0, reason: "no liquidity needed" };
  }

  try {
    const [liquidity, available] = await Promise.all([
      readVaultI128("liquidity", agent),
      readVaultI128("available_credit", agent),
    ]);

    // Already enough sitting in the vault → nothing to do.
    const shortfall = neededUsdc - liquidity;
    if (shortfall <= 0) {
      return { deposited: false, amountUsdc: 0, reason: "vault already has enough liquidity" };
    }
    // Never seed more than the agent is actually allowed to borrow — no point
    // parking liquidity it can't draw.
    if (available <= 0) {
      return { deposited: false, amountUsdc: 0, reason: "agent has no available credit to borrow against" };
    }

    // Amount to deposit: cover the shortfall, but capped by per-vault limit and
    // by what the agent can borrow.
    let deposit = Math.min(shortfall, config.treasuryMaxPerVaultUsdc, available);
    deposit = Math.ceil(deposit * STROOPS) / STROOPS; // round up to a whole stroop
    if (deposit <= 0) {
      return { deposited: false, amountUsdc: 0, reason: "computed deposit is zero after caps" };
    }

    // Treasury wallet must actually hold the USDC (+ leave a small XLM buffer,
    // handled by the network). Read its USDC balance via the SAC.
    const bal = await treasuryUsdcBalance();
    if (bal < deposit) {
      return {
        deposited: false,
        amountUsdc: 0,
        reason: `treasury USDC balance too low ($${bal} < $${deposit}) — top up TREASURY wallet`,
      };
    }

    const txHash = await depositIntoVault(agent, deposit);
    return { deposited: true, amountUsdc: deposit, txHash };
  } catch (e) {
    return {
      deposited: false,
      amountUsdc: 0,
      reason: e instanceof Error ? e.message : String(e),
    };
  }
}

/** Treasury's own USDC balance (SAC `balance`), best-effort. */
async function treasuryUsdcBalance(): Promise<number> {
  try {
    const srv = server();
    const kp = treasuryKeypair();
    const acct = await srv.getAccount(kp.publicKey());
    const tx = new TransactionBuilder(acct, {
      fee: BASE_FEE,
      networkPassphrase: config.networkPassphrase,
    })
      .addOperation(
        new Contract(config.usdcSac).call("balance", Address.fromString(kp.publicKey()).toScVal()),
      )
      .setTimeout(30)
      .build();
    const sim = await srv.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) return 0;
    const v = sim.result?.retval ? scValToNative(sim.result.retval) : 0;
    return Number(BigInt(v ?? 0)) / STROOPS;
  } catch {
    return 0;
  }
}

/** Deposit `usdc` from the treasury (as lender) into `agent`'s vault. */
async function depositIntoVault(agent: string, usdc: number): Promise<string> {
  const srv = server();
  const kp = treasuryKeypair();
  const acct = await srv.getAccount(kp.publicKey());
  const amount = BigInt(Math.round(usdc * STROOPS));

  const tx = new TransactionBuilder(acct, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      new Contract(config.lendingVaultContractId).call(
        "deposit",
        Address.fromString(kp.publicKey()).toScVal(), // lender = treasury
        Address.fromString(agent).toScVal(), // agent's vault
        nativeToScVal(amount, { type: "i128" }),
      ),
    )
    .setTimeout(TimeoutInfinite)
    .build();

  const prepared = await srv.prepareTransaction(tx);
  prepared.sign(kp);
  const sent = await srv.sendTransaction(prepared);
  if (sent.status === "ERROR") {
    throw new Error(`treasury deposit submit failed: ${JSON.stringify(sent.errorResult)}`);
  }
  // Poll to confirmation so the caller can borrow immediately after.
  let got = await srv.getTransaction(sent.hash);
  for (let i = 0; i < 30 && got.status === "NOT_FOUND"; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    got = await srv.getTransaction(sent.hash);
  }
  if (got.status !== "SUCCESS") {
    throw new Error(`treasury deposit did not confirm: ${got.status}`);
  }
  return sent.hash;
}

export function treasuryPublicKey(): string | null {
  if (!config.treasurySecret) return null;
  try {
    return treasuryKeypair().publicKey();
  } catch {
    return null;
  }
}
