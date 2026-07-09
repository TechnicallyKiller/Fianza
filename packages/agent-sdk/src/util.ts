// Pure, side-effect-free helpers — extracted so they can be unit-tested without
// a network. This is where the "risky" logic lives (unit conversion, the
// draw-on-402 shortfall math), which is exactly what needs coverage.

import { StrKey } from "@stellar/stellar-sdk";
import { ValidationError, MaxDrawExceededError } from "./errors.js";

const STROOPS_PER_USDC = 1e7;

/** USDC → i128 stroops (7 decimals). Throws on non-finite input. */
export function toStroops(usdc: number | bigint): bigint {
  if (typeof usdc === "bigint") return usdc;
  if (typeof usdc !== "number" || !Number.isFinite(usdc)) {
    throw new ValidationError(`amount must be a finite number, got ${usdc}`);
  }
  return BigInt(Math.round(usdc * STROOPS_PER_USDC));
}

/** i128 stroops → USDC. Accepts bigint, decimal string, or number. */
export function fromStroops(s: bigint | string | number): number {
  return Number(BigInt(s)) / STROOPS_PER_USDC;
}

/** Throw unless `usdc` is a finite number strictly greater than zero. */
export function assertPositiveAmount(usdc: number, label = "amount"): void {
  if (typeof usdc !== "number" || !Number.isFinite(usdc)) {
    throw new ValidationError(`${label} must be a finite number, got ${usdc}`);
  }
  if (usdc <= 0) {
    throw new ValidationError(`${label} must be greater than 0, got ${usdc}`);
  }
}

export function isValidStellarAddress(address: string): boolean {
  return typeof address === "string" && StrKey.isValidEd25519PublicKey(address);
}

export function assertValidAddress(address: string, label = "address"): void {
  if (!isValidStellarAddress(address)) {
    throw new ValidationError(`${label} is not a valid Stellar address: ${address}`);
  }
}

/**
 * How much credit must be drawn to afford `priceUsdc` given the current
 * `balanceUsdc`. Returns 0 when the balance already covers the price;
 * otherwise the shortfall rounded UP to the cent (so a draw is never a hair
 * short of the price). Throws MaxDrawExceededError when a `maxDraw` cap is
 * given and the shortfall exceeds it. This is the core of payWithCredit,
 * isolated so it's testable without hitting the chain.
 */
export function creditShortfallUsdc(
  balanceUsdc: number,
  priceUsdc: number,
  maxDraw?: number,
): number {
  assertPositiveAmount(priceUsdc, "priceUsdc");
  if (typeof balanceUsdc !== "number" || !Number.isFinite(balanceUsdc) || balanceUsdc < 0) {
    throw new ValidationError(`balanceUsdc must be a finite, non-negative number, got ${balanceUsdc}`);
  }
  if (balanceUsdc >= priceUsdc) return 0;
  const need = Math.ceil((priceUsdc - balanceUsdc) * 100) / 100;
  if (maxDraw != null && need > maxDraw) {
    throw new MaxDrawExceededError(need, maxDraw);
  }
  return need;
}
