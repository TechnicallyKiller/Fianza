#![no_std]
//! score_registry — signed scores + tiers, keyed by a stable Stellar address.
//!
//! Phase 0 scaffold only: this is a compilable placeholder. The real registry
//! surface (signed score submission by the trusted signer, tier banding, score
//! reads for the credit_line/lending_vault) lands in Phase 1.

use soroban_sdk::{contract, contractimpl, Env};

#[contract]
pub struct ScoreRegistry;

#[contractimpl]
impl ScoreRegistry {
    /// Placeholder. Real registry API arrives in Phase 1.
    pub fn version(_env: Env) -> u32 {
        0
    }
}
