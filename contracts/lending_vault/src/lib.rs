#![no_std]
//! lending_vault — isolated, per-agent vault: deposit, disburse, repay.
//!
//! Reads the credit limit from score_registry / credit_line and enforces it.
//! Phase 0 scaffold only: compilable placeholder. Real logic lands in Phase 1.

use soroban_sdk::{contract, contractimpl, Env};

#[contract]
pub struct LendingVault;

#[contractimpl]
impl LendingVault {
    /// Placeholder. Real vault API arrives in Phase 1.
    pub fn version(_env: Env) -> u32 {
        0
    }
}
