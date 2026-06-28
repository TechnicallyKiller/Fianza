// indexer/ — x402 USDC revenue indexer.
//
// Phase 2: read SAC `transfer` events via Soroban `getEvents`, keyed on
// `transfer.from` as the payer. Lifts the validated pattern from
// spikes/spike1-x402-payer (Gate 1).
//
// GOTCHAS to honour here:
//  - getEvents SAC transfer filter needs FOUR topic segments
//    ["transfer","*","*","*"] or the RPC silently returns nothing.
//  - transfer event topics are ["transfer", from, to, asset], data = amount.
//  - the facilitator fee-payer appears only in a separate ["fee", from] event;
//    keep facilitator submitter + fee-payer on X402_EXCLUDE_ADDRESSES.
//
// Phase 0 scaffold: no implementation yet.

export {};
