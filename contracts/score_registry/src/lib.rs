#![no_std]
//! score_registry — the portable underwriting artifact.
//!
//! Registration and signed scores keyed directly to an agent's stable Stellar
//! address (no identity-registry dependency; see README "Identity, decoupled").
//! A single trusted signer (the off-chain underwriting engine, MVP) publishes
//! scores; the contract bands them into a tier via `revenue_math` and stores
//! them for any lender to read. Repayment outcomes are recorded by the same
//! signer.

use revenue_math::{tier_from_score, ScoreData, Tier};
use soroban_sdk::{
    contract, contractevent, contracterror, contractimpl, contracttype, Address, Env,
};

const MAX_SCORE: u32 = 850;

// TTL: keep per-agent state alive ~30 days, bumped when it falls below ~1 day.
const TTL_THRESHOLD: u32 = 17_280; // ~1 day at 5s ledgers
const TTL_EXTEND: u32 = 518_400; // ~30 days

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    AlreadyRegistered = 2,
    NotRegistered = 3,
    InvalidScore = 4,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
    Signer,
    Registered(Address),
    Score(Address),
    Repayments(Address),
}

/// Running tally of an agent's repayment history.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RepaymentRecord {
    pub on_time: u32,
    pub total: u32,
}

#[contractevent(topics = ["registered"])]
pub struct Registered {
    pub agent: Address,
}

#[contractevent(topics = ["score"])]
pub struct ScorePublished {
    pub agent: Address,
    pub score: u32,
    pub tier: Tier,
}

#[contractevent(topics = ["repaid"])]
pub struct RepaymentRecorded {
    pub agent: Address,
    pub on_time: bool,
}

#[contract]
pub struct ScoreRegistry;

#[contractimpl]
impl ScoreRegistry {
    /// Set the admin (can rotate the signer) and the trusted signer (publishes
    /// scores + repayment outcomes). Runs once at deploy.
    pub fn __constructor(env: Env, admin: Address, signer: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Signer, &signer);
    }

    /// Register an agent against its own address. Idempotency is enforced — an
    /// agent registers itself once.
    pub fn register(env: Env, agent: Address) -> Result<(), Error> {
        agent.require_auth();
        if env
            .storage()
            .persistent()
            .has(&DataKey::Registered(agent.clone()))
        {
            return Err(Error::AlreadyRegistered);
        }
        env.storage()
            .persistent()
            .set(&DataKey::Registered(agent.clone()), &true);
        env.storage().persistent().extend_ttl(
            &DataKey::Registered(agent.clone()),
            TTL_THRESHOLD,
            TTL_EXTEND,
        );
        Registered { agent }.publish(&env);
        Ok(())
    }

    /// Publish a signed score for a registered agent. Only the trusted signer
    /// may call this; the tier is banded on-chain from the score.
    pub fn publish_score(
        env: Env,
        agent: Address,
        score: u32,
        revenue: i128,
    ) -> Result<(), Error> {
        Self::signer(&env).require_auth();
        if !env
            .storage()
            .persistent()
            .has(&DataKey::Registered(agent.clone()))
        {
            return Err(Error::NotRegistered);
        }
        if score > MAX_SCORE || revenue < 0 {
            return Err(Error::InvalidScore);
        }
        let data = ScoreData {
            score,
            tier: tier_from_score(score),
            revenue,
            updated_at: env.ledger().timestamp(),
        };
        env.storage()
            .persistent()
            .set(&DataKey::Score(agent.clone()), &data);
        env.storage().persistent().extend_ttl(
            &DataKey::Score(agent.clone()),
            TTL_THRESHOLD,
            TTL_EXTEND,
        );
        ScorePublished {
            agent,
            score,
            tier: data.tier,
        }
        .publish(&env);
        Ok(())
    }

    /// Record a repayment outcome (reported by the signer/engine after observing
    /// settlement). Feeds future re-scoring.
    pub fn record_repayment(env: Env, agent: Address, on_time: bool) -> Result<(), Error> {
        Self::signer(&env).require_auth();
        if !env
            .storage()
            .persistent()
            .has(&DataKey::Registered(agent.clone()))
        {
            return Err(Error::NotRegistered);
        }
        let mut rec = Self::get_repayments(env.clone(), agent.clone());
        rec.total += 1;
        if on_time {
            rec.on_time += 1;
        }
        env.storage()
            .persistent()
            .set(&DataKey::Repayments(agent.clone()), &rec);
        env.storage().persistent().extend_ttl(
            &DataKey::Repayments(agent.clone()),
            TTL_THRESHOLD,
            TTL_EXTEND,
        );
        RepaymentRecorded { agent, on_time }.publish(&env);
        Ok(())
    }

    /// Rotate the trusted signer. Admin-only.
    pub fn set_signer(env: Env, new_signer: Address) {
        Self::admin(&env).require_auth();
        env.storage().instance().set(&DataKey::Signer, &new_signer);
    }

    // ---- Reads (get_score + is_registered match revenue_math's
    // ScoreRegistryInterface so cross-contract callers can use the client) ----

    /// Current score data for an agent. Returns an `Unrated`/zero record if the
    /// agent has no published score yet (so callers get a safe default).
    pub fn get_score(env: Env, agent: Address) -> ScoreData {
        env.storage()
            .persistent()
            .get(&DataKey::Score(agent))
            .unwrap_or(ScoreData {
                score: 0,
                tier: Tier::Unrated,
                revenue: 0,
                updated_at: 0,
            })
    }

    pub fn is_registered(env: Env, agent: Address) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::Registered(agent))
    }

    pub fn get_repayments(env: Env, agent: Address) -> RepaymentRecord {
        env.storage()
            .persistent()
            .get(&DataKey::Repayments(agent))
            .unwrap_or(RepaymentRecord { on_time: 0, total: 0 })
    }

    pub fn signer(env: &Env) -> Address {
        env.storage().instance().get(&DataKey::Signer).unwrap()
    }

    pub fn admin(env: &Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }
}

mod test;
