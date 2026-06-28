// zktls/ — Reclaim zkTLS proof request + on-chain verify.
//
// Phase 2: reuse spikes/spike2-reclaim-revenue to request a proof via zkFetch
// and verify it against the deployed Soroban verifier (Gates 2A/2B).
//
// GOTCHAS to honour here:
//  - run the `download-zk-files` script after install or proof generation fails.
//  - API keys go in zkFetch PRIVATE options, never public.
//  - assert the secret is absent from the returned proof object.
//
// Phase 0 scaffold: no implementation yet.

export {};
