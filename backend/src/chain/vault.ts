// chain/vault.ts — read-only accessors for on-chain lending_vault state.
//
// Same simulate-only approach as chain/registry.ts: no fee, no signature, the
// signer's funded public key is used purely as the simulation source account.
//
// Used by the repayment-settlement path (api/server.ts) to decide, from the
// chain's own state rather than the caller's word, whether a repayment
// actually cleared an agent's debt and whether it landed on time.

import {
  rpc,
  Contract,
  Address,
  TransactionBuilder,
  scValToNative,
} from "@stellar/stellar-sdk";
import { config } from "../config.js";
import { signerPublicKey } from "../signer/index.js";

/** The subset of lending_vault's `state(agent)` this module needs. */
export interface VaultSnapshot {
  amountOwedStroops: bigint;
  principalStroops: bigint;
  /** Unix seconds the current loan is due; 0 once the balance is fully cleared. */
  dueDate: number;
  defaulted: boolean;
}

/**
 * Read an agent's live vault state. Returns null when the vault isn't
 * configured, the agent has no vault, or the read fails — callers treat a null
 * as "can't tell" and skip rather than guessing.
 */
export async function readVaultState(agent: string): Promise<VaultSnapshot | null> {
  if (!config.lendingVaultContractId) return null;
  try {
    const server = new rpc.Server(config.sorobanRpcUrl);
    const source = await server.getAccount(signerPublicKey());
    const contract = new Contract(config.lendingVaultContractId);
    const tx = new TransactionBuilder(source, {
      fee: "100",
      networkPassphrase: config.networkPassphrase,
    })
      .addOperation(contract.call("state", Address.fromString(agent).toScVal()))
      .setTimeout(30)
      .build();

    const sim = await server.simulateTransaction(tx);
    if (!rpc.Api.isSimulationSuccess(sim) || !sim.result?.retval) return null;
    const s = scValToNative(sim.result.retval) as {
      amount_owed?: bigint;
      principal?: bigint;
      due_date?: bigint;
      defaulted?: boolean;
    };
    return {
      amountOwedStroops: BigInt(s.amount_owed ?? 0n),
      principalStroops: BigInt(s.principal ?? 0n),
      dueDate: Number(s.due_date ?? 0n),
      defaulted: Boolean(s.defaulted),
    };
  } catch {
    return null;
  }
}
