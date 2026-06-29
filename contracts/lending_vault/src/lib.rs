#![no_std]
//! lending_vault — isolated, per-agent credit vaults settling in USDC.
//!
//! A single deployment holds many agents' vaults, but every agent's accounting
//! is fully isolated: a lender deposits USDC *into a chosen agent's vault*, and
//! those funds can only ever be lent to that agent. One agent's default can
//! never touch another agent's lenders (README "isolated risk per agent").
//!
//! Borrowing power is read live from `score_registry` and sized with the shared
//! `revenue_math` policy — the exact same limit/APR the `credit_line` view
//! reports. Interest accrues as simple interest at the agent's fixed tier APR;
//! repaid interest accumulates as lender yield, claimable pro-rata.

use revenue_math::{apr_bps, limit_for, simple_interest, ScoreData, ScoreRegistryClient};
use soroban_sdk::{
    contract, contractevent, contracterror, contractimpl, contracttype, token, Address, Env,
};

const TTL_THRESHOLD: u32 = 17_280; // ~1 day
const TTL_EXTEND: u32 = 518_400; // ~30 days

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    InvalidAmount = 1,
    InsufficientLiquidity = 2,
    InsufficientCredit = 3,
    InsufficientDeposit = 4,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Registry,
    Token,
    Liquidity(Address),      // agent -> USDC available to lend
    Principal(Address),      // agent -> outstanding borrowed principal
    InterestOwed(Address),   // agent -> accrued unpaid interest
    LastAccrual(Address),    // agent -> last interest-accrual timestamp
    TotalDeposited(Address), // agent -> sum of lender deposits
    YieldPool(Address),      // agent -> repaid interest awaiting claim
    Deposit(Address, Address), // (lender, agent) -> deposited principal
}

/// Snapshot of one agent's isolated vault.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VaultState {
    pub liquidity: i128,
    pub principal: i128,
    pub amount_owed: i128, // principal + interest accrued to now
    pub total_deposited: i128,
    pub yield_pool: i128,
    pub limit: i128,
    pub apr_bps: u32,
}

#[contractevent(topics = ["deposit"])]
pub struct Deposited {
    pub lender: Address,
    pub agent: Address,
    pub amount: i128,
}

#[contractevent(topics = ["borrow"])]
pub struct Borrowed {
    pub agent: Address,
    pub amount: i128,
}

#[contractevent(topics = ["repay"])]
pub struct Repaid {
    pub agent: Address,
    pub amount: i128,
}

#[contractevent(topics = ["withdraw"])]
pub struct Withdrawn {
    pub lender: Address,
    pub agent: Address,
    pub amount: i128,
}

#[contractevent(topics = ["yield"])]
pub struct YieldClaimed {
    pub lender: Address,
    pub agent: Address,
    pub amount: i128,
}

#[contract]
pub struct LendingVault;

#[contractimpl]
impl LendingVault {
    /// Bind the vault to a score_registry (for limits) and the USDC SEP-41 SAC.
    pub fn __constructor(env: Env, registry: Address, token: Address) {
        env.storage().instance().set(&DataKey::Registry, &registry);
        env.storage().instance().set(&DataKey::Token, &token);
    }

    /// Lender deposits USDC into a specific agent's isolated vault.
    pub fn deposit(env: Env, lender: Address, agent: Address, amount: i128) -> Result<(), Error> {
        lender.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        Self::token_client(&env).transfer(&lender, &env.current_contract_address(), &amount);

        Self::bump(
            &env,
            &DataKey::Liquidity(agent.clone()),
            Self::read(&env, &DataKey::Liquidity(agent.clone())) + amount,
        );
        Self::bump(
            &env,
            &DataKey::TotalDeposited(agent.clone()),
            Self::read(&env, &DataKey::TotalDeposited(agent.clone())) + amount,
        );
        Self::bump(
            &env,
            &DataKey::Deposit(lender.clone(), agent.clone()),
            Self::read(&env, &DataKey::Deposit(lender.clone(), agent.clone())) + amount,
        );

        Deposited {
            lender,
            agent,
            amount,
        }
        .publish(&env);
        Ok(())
    }

    /// Agent draws against its credit line; USDC is disbursed from its vault.
    pub fn borrow(env: Env, agent: Address, amount: i128) -> Result<(), Error> {
        agent.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        Self::accrue(&env, &agent);

        let data = Self::score_data(&env, &agent);
        let limit = limit_for(data.revenue, &data.tier);
        let principal = Self::read(&env, &DataKey::Principal(agent.clone()));
        if principal + amount > limit {
            return Err(Error::InsufficientCredit);
        }
        let liquidity = Self::read(&env, &DataKey::Liquidity(agent.clone()));
        if liquidity < amount {
            return Err(Error::InsufficientLiquidity);
        }

        Self::bump(&env, &DataKey::Principal(agent.clone()), principal + amount);
        Self::bump(&env, &DataKey::Liquidity(agent.clone()), liquidity - amount);
        Self::token_client(&env).transfer(&env.current_contract_address(), &agent, &amount);

        Borrowed { agent, amount }.publish(&env);
        Ok(())
    }

    /// Agent repays. Payment covers accrued interest first (→ lender yield),
    /// then principal (→ returned to lendable liquidity).
    pub fn repay(env: Env, agent: Address, amount: i128) -> Result<(), Error> {
        agent.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        Self::accrue(&env, &agent);
        Self::token_client(&env).transfer(&agent, &env.current_contract_address(), &amount);

        let mut remaining = amount;

        let interest = Self::read(&env, &DataKey::InterestOwed(agent.clone()));
        let pay_interest = remaining.min(interest);
        if pay_interest > 0 {
            Self::bump(&env, &DataKey::InterestOwed(agent.clone()), interest - pay_interest);
            Self::bump(
                &env,
                &DataKey::YieldPool(agent.clone()),
                Self::read(&env, &DataKey::YieldPool(agent.clone())) + pay_interest,
            );
            remaining -= pay_interest;
        }

        if remaining > 0 {
            let principal = Self::read(&env, &DataKey::Principal(agent.clone()));
            let pay_principal = remaining.min(principal);
            // Principal repayment + any overpayment both return to liquidity.
            Self::bump(&env, &DataKey::Principal(agent.clone()), principal - pay_principal);
            Self::bump(
                &env,
                &DataKey::Liquidity(agent.clone()),
                Self::read(&env, &DataKey::Liquidity(agent.clone())) + remaining,
            );
        }

        Repaid { agent, amount }.publish(&env);
        Ok(())
    }

    /// Lender withdraws idle deposited principal (only funds not currently lent).
    pub fn withdraw(env: Env, lender: Address, agent: Address, amount: i128) -> Result<(), Error> {
        lender.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        let deposited = Self::read(&env, &DataKey::Deposit(lender.clone(), agent.clone()));
        if deposited < amount {
            return Err(Error::InsufficientDeposit);
        }
        let liquidity = Self::read(&env, &DataKey::Liquidity(agent.clone()));
        if liquidity < amount {
            return Err(Error::InsufficientLiquidity);
        }

        Self::bump(
            &env,
            &DataKey::Deposit(lender.clone(), agent.clone()),
            deposited - amount,
        );
        Self::bump(
            &env,
            &DataKey::TotalDeposited(agent.clone()),
            Self::read(&env, &DataKey::TotalDeposited(agent.clone())) - amount,
        );
        Self::bump(&env, &DataKey::Liquidity(agent.clone()), liquidity - amount);
        Self::token_client(&env).transfer(&env.current_contract_address(), &lender, &amount);

        Withdrawn {
            lender,
            agent,
            amount,
        }
        .publish(&env);
        Ok(())
    }

    /// Lender claims its pro-rata share of accumulated interest yield.
    pub fn claim_yield(env: Env, lender: Address, agent: Address) -> i128 {
        lender.require_auth();
        let pool = Self::read(&env, &DataKey::YieldPool(agent.clone()));
        let total = Self::read(&env, &DataKey::TotalDeposited(agent.clone()));
        let deposited = Self::read(&env, &DataKey::Deposit(lender.clone(), agent.clone()));
        if pool <= 0 || total <= 0 || deposited <= 0 {
            return 0;
        }
        let share = pool.saturating_mul(deposited) / total;
        if share > 0 {
            Self::bump(&env, &DataKey::YieldPool(agent.clone()), pool - share);
            Self::token_client(&env).transfer(&env.current_contract_address(), &lender, &share);
            YieldClaimed {
                lender,
                agent,
                amount: share,
            }
            .publish(&env);
        }
        share
    }

    // ---- Views ----

    /// Full isolated state for an agent's vault.
    pub fn state(env: Env, agent: Address) -> VaultState {
        let data = Self::score_data(&env, &agent);
        VaultState {
            liquidity: Self::read(&env, &DataKey::Liquidity(agent.clone())),
            principal: Self::read(&env, &DataKey::Principal(agent.clone())),
            amount_owed: Self::amount_owed(env.clone(), agent.clone()),
            total_deposited: Self::read(&env, &DataKey::TotalDeposited(agent.clone())),
            yield_pool: Self::read(&env, &DataKey::YieldPool(agent.clone())),
            limit: limit_for(data.revenue, &data.tier),
            apr_bps: apr_bps(&data.tier),
        }
    }

    /// Total currently owed (principal + interest accrued to the current ledger).
    pub fn amount_owed(env: Env, agent: Address) -> i128 {
        let principal = Self::read(&env, &DataKey::Principal(agent.clone()));
        let interest = Self::read(&env, &DataKey::InterestOwed(agent.clone()));
        principal + interest + Self::pending_interest(&env, &agent, principal)
    }

    /// Remaining drawable credit (limit − outstanding principal).
    pub fn available_credit(env: Env, agent: Address) -> i128 {
        let data = Self::score_data(&env, &agent);
        let limit = limit_for(data.revenue, &data.tier);
        let principal = Self::read(&env, &DataKey::Principal(agent));
        (limit - principal).max(0)
    }

    pub fn position(env: Env, lender: Address, agent: Address) -> i128 {
        Self::read(&env, &DataKey::Deposit(lender, agent))
    }

    pub fn liquidity(env: Env, agent: Address) -> i128 {
        Self::read(&env, &DataKey::Liquidity(agent))
    }

    pub fn yield_pool(env: Env, agent: Address) -> i128 {
        Self::read(&env, &DataKey::YieldPool(agent))
    }

    pub fn registry(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Registry).unwrap()
    }

    pub fn token(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Token).unwrap()
    }

    // ---- Internals ----

    fn accrue(env: &Env, agent: &Address) {
        let now = env.ledger().timestamp();
        let principal = Self::read(env, &DataKey::Principal(agent.clone()));
        let pending = Self::pending_interest(env, agent, principal);
        if pending > 0 {
            let owed = Self::read(env, &DataKey::InterestOwed(agent.clone())) + pending;
            Self::bump(env, &DataKey::InterestOwed(agent.clone()), owed);
        }
        env.storage()
            .persistent()
            .set(&DataKey::LastAccrual(agent.clone()), &now);
        env.storage().persistent().extend_ttl(
            &DataKey::LastAccrual(agent.clone()),
            TTL_THRESHOLD,
            TTL_EXTEND,
        );
    }

    /// Interest accrued on `principal` since the last accrual, not yet booked.
    fn pending_interest(env: &Env, agent: &Address, principal: i128) -> i128 {
        if principal <= 0 {
            return 0;
        }
        let now = env.ledger().timestamp();
        let last: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::LastAccrual(agent.clone()))
            .unwrap_or(now);
        if now <= last {
            return 0;
        }
        let data = Self::score_data(env, agent);
        simple_interest(principal, apr_bps(&data.tier), now - last)
    }

    fn score_data(env: &Env, agent: &Address) -> ScoreData {
        let registry: Address = env.storage().instance().get(&DataKey::Registry).unwrap();
        ScoreRegistryClient::new(env, &registry).get_score(agent)
    }

    fn token_client(env: &Env) -> token::Client<'_> {
        let token: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        token::Client::new(env, &token)
    }

    fn read(env: &Env, key: &DataKey) -> i128 {
        env.storage().persistent().get(key).unwrap_or(0)
    }

    fn bump(env: &Env, key: &DataKey, value: i128) {
        env.storage().persistent().set(key, &value);
        env.storage()
            .persistent()
            .extend_ttl(key, TTL_THRESHOLD, TTL_EXTEND);
    }
}

mod test;
