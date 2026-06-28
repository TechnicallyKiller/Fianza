# Integration tests

Phase 1 adds the full-flow Soroban integration test here
(register -> score -> deposit -> borrow -> repay), running against the Soroban
test host via `cargo test`. Per-contract unit tests live next to each contract
in its own `src` / `tests`.
