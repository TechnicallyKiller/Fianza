#![no_std]
//! credit_line — the per-agent credit policy view.
//!
//! Reads an agent's published score from `score_registry` and derives the
//! borrowing terms (limit + fixed APR for the agent's tier) using the shared
//! `revenue_math` policy. This is the contract lenders and the frontend query
//! to see "what can this agent borrow and at what rate." The `lending_vault`
//! enforces the same policy independently (via the same `revenue_math`), so the
//! terms shown here always match what the vault will allow.

use revenue_math::{ScoreRegistryClient, Tier};
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Registry,
}

/// Derived borrowing terms for an agent.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CreditTerms {
    pub tier: Tier,
    /// Maximum outstanding principal, in USDC stroops (7 decimals).
    pub limit: i128,
    /// Fixed APR in basis points.
    pub apr_bps: u32,
}

#[contract]
pub struct CreditLine;

#[contractimpl]
impl CreditLine {
    /// Bind this credit-line contract to a score_registry instance.
    pub fn __constructor(env: Env, registry: Address) {
        env.storage().instance().set(&DataKey::Registry, &registry);
    }

    /// Full derived terms for an agent. The advertised limit is the credit ramp
    /// applied to the revenue-sized limit (grows with on-time repayment history,
    /// collapses on defaults), so it matches exactly what `lending_vault` will
    /// enforce at borrow time. The APR shown is the tier base rate; the vault
    /// charges this plus a utilisation premium at draw time.
    pub fn terms(env: Env, agent: Address) -> CreditTerms {
        let registry = Self::registry(env.clone());
        let client = ScoreRegistryClient::new(&env, &registry);
        let data = client.get_score(&agent);
        let rec = client.get_repayments(&agent);
        let base_limit = revenue_math::limit_for(data.revenue, &data.tier);
        CreditTerms {
            tier: data.tier,
            limit: revenue_math::ramp_limit(base_limit, &rec),
            apr_bps: revenue_math::apr_bps(&data.tier),
        }
    }

    /// Credit limit (max outstanding principal) for an agent.
    pub fn limit(env: Env, agent: Address) -> i128 {
        Self::terms(env, agent).limit
    }

    /// Fixed APR (basis points) for an agent's tier.
    pub fn apr_bps(env: Env, agent: Address) -> u32 {
        Self::terms(env, agent).apr_bps
    }

    /// The bound score_registry address.
    pub fn registry(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Registry).unwrap()
    }
}

mod test;
