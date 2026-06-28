#![no_std]
//! Optional Stellar 8004 identity adapter — INTERFACE ONLY, unimplemented.
//!
//! Identity is deliberately NOT load-bearing in TrustLine (see README,
//! "Identity, decoupled"). Scores key directly off the agent's stable Stellar
//! address. This thin interface is the only identity surface in v1: a real
//! Stellar 8004 adapter (reputation + discovery) could implement it later, and
//! dropping it is deleting a file. Per the v1 scope it is left unimplemented.

use soroban_sdk::{Address, Env};

/// Thin identity interface. The default behaviour (Phase 1+) is simply to treat
/// any well-formed `Address` as valid; reputation/discovery is out of scope.
pub trait IIdentityRegistry {
    /// Whether `agent` is considered a valid, registerable identity.
    fn is_valid(env: &Env, agent: &Address) -> bool;
}
