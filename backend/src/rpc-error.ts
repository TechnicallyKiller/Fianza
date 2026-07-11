// Soroban RPC client errors (from @stellar/stellar-sdk's rpc.Server) come back
// as plain JSON-RPC objects ({code, message}) — NOT `instanceof Error`. Code
// across the indexer/independence engine regex-matches on the message to
// clamp+retry a stale `startLedger` into the RPC's retention window; using
// `e instanceof Error ? e.message : String(e)` silently defeats that (yields
// "[object Object]", the regex never matches, the raw error propagates and
// breaks the whole request). Extract the message correctly instead.
export function rpcErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && typeof (e as { message?: unknown }).message === "string") {
    return (e as { message: string }).message;
  }
  return String(e);
}
