# x402_settlement (adapter)

Disbursement + repayment glue for the lending_vault.

In the Stellar build, x402 settlement is driven **off-chain** by the backend
(`@x402/stellar`, SEP-41 USDC, auth-entry signing via the OZ Channels
facilitator) — see `backend/src/`. On-chain, `lending_vault` moves USDC with a
direct SAC `transfer` as the settlement primitive/fallback.

This directory is a placeholder for any thin on-chain settlement helpers that
turn out to be needed in Phase 1/Phase 4. It is intentionally **not** a Cargo
workspace member yet — no contract code lives here in Phase 0.
