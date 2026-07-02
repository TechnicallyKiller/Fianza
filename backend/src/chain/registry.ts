// chain/registry.ts — read-only accessors for on-chain score_registry state.
//
// Track A wires the agent's proven repayment history into scoring: on-time
// history lifts the score, a default collapses it. Reading it needs a Soroban
// simulate (no fee, no signature) against the deployed registry. The signer's
// public key is used only as the simulation source account (it is funded, so
// getAccount succeeds); nothing is submitted.

import {
  rpc,
  Contract,
  Address,
  TransactionBuilder,
  scValToNative,
} from "@stellar/stellar-sdk";
import { config } from "../config.js";
import { signerPublicKey } from "../signer/index.js";

export interface RepaymentRecord {
  onTime: number;
  total: number;
  /** Repayment outcomes observed that were NOT on time (defaults/misses). */
  missed: number;
}

const EMPTY: RepaymentRecord = { onTime: 0, total: 0, missed: 0 };

/**
 * Read an agent's repayment tally from score_registry. Returns an all-zero
 * record when the registry isn't configured yet, the agent has no history, or
 * the read fails — history is a bonus/penalty layer, never a hard dependency.
 */
export async function readRepayments(agent: string): Promise<RepaymentRecord> {
  if (!config.scoreRegistryContractId) return EMPTY;
  try {
    const server = new rpc.Server(config.sorobanRpcUrl);
    const source = await server.getAccount(signerPublicKey());
    const contract = new Contract(config.scoreRegistryContractId);
    const tx = new TransactionBuilder(source, {
      fee: "100",
      networkPassphrase: config.networkPassphrase,
    })
      .addOperation(contract.call("get_repayments", Address.fromString(agent).toScVal()))
      .setTimeout(30)
      .build();

    const sim = await server.simulateTransaction(tx);
    if (!rpc.Api.isSimulationSuccess(sim) || !sim.result?.retval) return EMPTY;
    const rec = scValToNative(sim.result.retval) as { on_time?: number; total?: number };
    const onTime = Number(rec.on_time ?? 0);
    const total = Number(rec.total ?? 0);
    return { onTime, total, missed: Math.max(0, total - onTime) };
  } catch {
    return EMPTY;
  }
}
