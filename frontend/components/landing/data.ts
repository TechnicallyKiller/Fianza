import type { CSSProperties } from "react";

// Lifecycle loop strip (bottom of the landing page).
export const LOOP = [
  { n: "1", t: "Earn", d: "x402 USDC + off-chain", c: "#FFB020" },
  { n: "2", t: "Prove", d: "graph + zkTLS proof", c: "#58F0C8" },
  { n: "3", t: "Score", d: "effective revenue", c: "#58F0C8" },
  { n: "4", t: "Borrow", d: "draw the line", c: "#FFB020" },
  { n: "5", t: "Repay", d: "as it earns", c: "#FFB020" },
];

// Real numbers from the live honest-agent underwrite (Scout, testnet):
// declared 20.50 USDC / 6 payers → effective 1.23 (−94%), score 575 Tier C,
// lifted to 775 Tier A by the zkTLS off-chain revenue proof.
export const PAYMENTS = [
  { id: "payer·GBEF…QHDE", amt: "+0.50", ok: true },
  { id: "payer·GCW6…YPAF", amt: "+0.50", ok: true },
  { id: "payer·GAEX…SR77", amt: "+0.50", ok: true },
  { id: "payer·GBHC…RDJ6", amt: "+3.00", ok: false },
];

export const TICKER = "EARN → PROVE → SCORE → BORROW → REPAY → LENDER YIELD · ";

/** Stagger helper for gated `.tl-*-g` child animations (see Reveal). */
export const stagger = (s: string): CSSProperties => ({ "--d": s }) as CSSProperties;
