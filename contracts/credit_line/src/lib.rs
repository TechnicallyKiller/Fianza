#![no_std]
//! credit_line — per-agent credit limit + fixed APR per underwriting tier.
//!
//! Phase 0 scaffold only: compilable placeholder. Real logic (derive a limit
//! and a fixed per-tier APR from the registry score) lands in Phase 1.

use soroban_sdk::{contract, contractimpl, Env};

#[contract]
pub struct CreditLine;

#[contractimpl]
impl CreditLine {
    /// Placeholder. Real credit-terms API arrives in Phase 1.
    pub fn version(_env: Env) -> u32 {
        0
    }
}
