// Decodes raw Soroban/contract errors (the multi-line `HostError: ... Error(Contract, #N)`
// dumps simulateTransaction/prepareTransaction throw) into a short, human message.
//
// Add a new contract's codes here as `{ [contractId]: { [code]: message } }` — mirror
// the Rust `pub enum Error` exactly (contracts/*/src/lib.rs) so this never drifts out
// of sync with what's actually deployed.

import type { PublicConfig } from "./api";

/** Mirrors contracts/lending_vault/src/lib.rs's `Error` enum. */
const LENDING_VAULT_ERRORS: Record<number, string> = {
  1: "That amount isn't valid — enter a positive USDC amount.",
  2: "This vault doesn't have enough liquidity to lend right now. Try a smaller amount, or ask a lender to supply more.",
  3: "That's more than your available credit line. Reduce the amount.",
  4: "That's more than you have deposited in this vault.",
  5: "This agent has defaulted — borrowing and new deposits are frozen.",
  6: "This loan isn't overdue yet.",
  7: "There's nothing owed to mark as a default.",
  8: "Deposits and borrows are paused for this vault right now.",
  9: "That deposit would push this vault past its cap.",
};

/** Mirrors contracts/score_registry/src/lib.rs's `Error` enum. */
const SCORE_REGISTRY_ERRORS: Record<number, string> = {
  1: "The registry is already initialized.",
  2: "This address is already registered.",
  3: "This address isn't registered yet — register on-chain first.",
  4: "That score isn't valid.",
};

/** Keyed by the {@link PublicConfig} field naming that contract's deployed id. */
const ERROR_TABLES: { configKey: keyof PublicConfig; codes: Record<number, string> }[] = [
  { configKey: "lendingVaultContractId", codes: LENDING_VAULT_ERRORS },
  { configKey: "scoreRegistryContractId", codes: SCORE_REGISTRY_ERRORS },
];

/** Pulls `contract:C...` and `Error(Contract, #N)` out of a raw HostError dump. */
function parseContractError(raw: string): { contractId: string; code: number } | null {
  const codeMatch = raw.match(/Error\(Contract,\s*#(\d+)\)/);
  if (!codeMatch) return null;
  const contractMatch = raw.match(/contract:([A-Z0-9]{56})/);
  if (!contractMatch) return null;
  return { contractId: contractMatch[1], code: Number(codeMatch[1]) };
}

/**
 * Turn a raw error (an `Error`, or any thrown value) into a short message fit
 * for a banner/toast. Falls back to the error's own message, trimmed to one
 * line, when it isn't a contract error we recognize — never throws.
 */
export function friendlyErrorMessage(err: unknown, config: PublicConfig | null): string {
  const raw = err instanceof Error ? err.message : String(err);
  const parsed = parseContractError(raw);
  if (parsed && config) {
    for (const { configKey, codes } of ERROR_TABLES) {
      if (config[configKey] === parsed.contractId && codes[parsed.code]) {
        return codes[parsed.code];
      }
    }
  }
  // Not a matched contract error — surface a short, non-scary fallback rather
  // than the raw multi-line diagnostic-event dump.
  const firstLine = raw.split("\n")[0].trim();
  return firstLine.length > 160 ? `${firstLine.slice(0, 160)}…` : firstLine || "Something went wrong.";
}
