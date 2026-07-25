// Client-side log of this browser's register/borrow/repay transactions,
// keyed by agent address. The backend has no general tx-history endpoint for
// the lending_vault contract (only the underwriting pass is persisted), so
// the borrower page's activity feed otherwise never shows draws/repayments —
// only score/proof events. Best-effort, local-only: it won't show another
// device's activity on this agent, but it's the only source we have without
// standing up an indexer for these events.

export type TxKind = "register" | "borrow" | "repay";

export interface LoggedTx {
  kind: TxKind;
  txHash: string;
  amountUsdc?: number;
  at: number; // epoch ms
}

const STORAGE_PREFIX = "fianza:txlog:";
const MAX_ENTRIES = 20;

function key(agent: string): string {
  return `${STORAGE_PREFIX}${agent}`;
}

export function logTx(agent: string, entry: Omit<LoggedTx, "at">): void {
  if (typeof window === "undefined") return;
  try {
    const existing = readTxLog(agent);
    const next = [{ ...entry, at: Date.now() }, ...existing].slice(0, MAX_ENTRIES);
    window.localStorage.setItem(key(agent), JSON.stringify(next));
  } catch {
    /* localStorage unavailable/full — activity log is best-effort */
  }
}

export function readTxLog(agent: string): LoggedTx[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key(agent));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
