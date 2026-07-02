#![no_std]
//! lending_vault — isolated, per-agent credit vaults settling in USDC, with a
//! full credit-risk lifecycle (Track A).
//!
//! A single deployment holds many agents' vaults, but every agent's accounting
//! is fully isolated: a lender deposits USDC *into a chosen agent's vault*, and
//! those funds can only ever be lent to that agent. One agent's default can
//! never touch another agent's lenders (README "isolated risk per agent").
//!
//! ## Lender shares
//! Deposits mint **shares** priced against the vault's assets
//! (`liquidity + principal + reserve`). This is what makes a default's loss
//! socialise pro-rata across a vault's lenders *without iterating them*: on
//! default the unrecovered principal is written off, assets fall, and every
//! share is worth proportionally less. Yield is tracked and claimed separately.
//!
//! ## Credit lifecycle
//! - **Ramp:** a cold agent may draw only a fraction of its revenue-sized limit;
//!   the fraction grows with on-time repayments and collapses on misses
//!   (`revenue_math::ramp_limit`), so a fresh attacker's take is capped.
//! - **Term & default:** the first draw from a zero balance starts a clock
//!   (`now + term`); it is not extended by further draws and clears on full
//!   repayment. Past the due date, anyone may call `mark_default` — the reserve
//!   absorbs the loss first, the remainder is socialised to the vault's lenders,
//!   and the agent is frozen out of further borrowing.
//! - **Reserve:** a cut of every repaid interest payment
//!   (`revenue_math::split_interest`) funds a per-vault first-loss buffer.
//! - **Dynamic APR:** the borrower rate is the tier base plus a utilisation
//!   premium (`revenue_math::dynamic_apr_bps`).

use revenue_math::{
    apr_bps, dynamic_apr_bps, limit_for, ramp_limit, simple_interest, split_interest,
    utilization_bps, RepaymentRecord, ScoreData, ScoreRegistryClient,
};
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
    /// Agent has defaulted; borrowing and new deposits are frozen.
    Defaulted = 5,
    /// `mark_default` called on a loan that is not past its due date.
    NotOverdue = 6,
    /// `mark_default` called on an agent with no outstanding principal.
    NothingOwed = 7,
    /// New deposits/borrows are halted (admin circuit breaker). Exits
    /// (repay/withdraw/claim_yield) and mark_default are never paused.
    Paused = 8,
    /// Deposit would push this agent's vault past the global cap.
    DepositCapExceeded = 9,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Registry,
    Token,
    TermSecs,                  // loan term applied on a fresh draw
    Admin,                     // can pause/unpause and set the deposit cap
    Paused,                    // bool: new deposits/borrows halted
    DepositCap,                // i128: max TotalDeposited per agent vault (0 = no cap)
    Liquidity(Address),        // agent -> USDC available to lend
    Principal(Address),        // agent -> outstanding borrowed principal
    InterestOwed(Address),     // agent -> accrued unpaid interest
    LastAccrual(Address),      // agent -> last interest-accrual timestamp
    Reserve(Address),          // agent -> first-loss buffer
    YieldPool(Address),        // agent -> repaid interest awaiting claim
    TotalShares(Address),      // agent -> sum of lender shares
    Shares(Address, Address),  // (lender, agent) -> lender's shares
    DueDate(Address),          // agent -> timestamp outstanding balance is due (0 = no active draw)
    Defaulted(Address),        // agent -> has defaulted
    RealizedLoss(Address),     // agent -> cumulative loss socialised to lenders
}

/// Snapshot of one agent's isolated vault.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VaultState {
    pub liquidity: i128,
    pub principal: i128,
    pub amount_owed: i128, // principal + interest accrued to now
    pub reserve: i128,
    pub total_shares: i128,
    pub total_assets: i128, // liquidity + principal (backs lender shares; reserve excluded)
    pub yield_pool: i128,
    pub realized_loss: i128,
    pub limit: i128, // ramped credit limit
    pub apr_bps: u32, // current utilisation-adjusted borrower APR
    pub utilization_bps: u32,
    pub due_date: u64, // 0 when no active draw
    pub defaulted: bool,
}

#[contractevent(topics = ["deposit"])]
pub struct Deposited {
    pub lender: Address,
    pub agent: Address,
    pub amount: i128,
    pub shares: i128,
}

#[contractevent(topics = ["borrow"])]
pub struct Borrowed {
    pub agent: Address,
    pub amount: i128,
    pub due_date: u64,
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
    pub shares: i128,
}

#[contractevent(topics = ["yield"])]
pub struct YieldClaimed {
    pub lender: Address,
    pub agent: Address,
    pub amount: i128,
}

/// A defaulted loan: `loss` written off, `reserve_used` absorbed by the buffer,
/// `socialized` borne by lenders (share value drop). The backend watches this to
/// record the missed repayment on-chain and re-underwrite the agent.
#[contractevent(topics = ["default"])]
pub struct Defaulted_ {
    pub agent: Address,
    pub caller: Address,
    pub loss: i128,
    pub reserve_used: i128,
    pub socialized: i128,
}

#[contract]
pub struct LendingVault;

#[contractimpl]
impl LendingVault {
    /// Bind the vault to a score_registry (for limits), the USDC SEP-41 SAC, the
    /// loan term (seconds) a fresh draw must be repaid within, an admin (can
    /// pause/unpause and adjust the deposit cap), and an initial global deposit
    /// cap per agent vault (0 = uncapped).
    pub fn __constructor(
        env: Env,
        registry: Address,
        token: Address,
        term_secs: u64,
        admin: Address,
        deposit_cap: i128,
    ) {
        env.storage().instance().set(&DataKey::Registry, &registry);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::TermSecs, &term_secs);
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::DepositCap, &deposit_cap);
        env.storage().instance().set(&DataKey::Paused, &false);
    }

    /// Circuit breaker: halt new deposits and new borrows. Exits (repay,
    /// withdraw, claim_yield) and mark_default always keep working — pausing
    /// can never trap anyone's funds, it only stops NEW risk from being taken.
    pub fn pause(env: Env) {
        Self::admin(&env).require_auth();
        env.storage().instance().set(&DataKey::Paused, &true);
    }

    pub fn unpause(env: Env) {
        Self::admin(&env).require_auth();
        env.storage().instance().set(&DataKey::Paused, &false);
    }

    pub fn paused(env: Env) -> bool {
        env.storage().instance().get(&DataKey::Paused).unwrap_or(false)
    }

    /// Admin-adjustable global cap on capital at risk (liquidity + principal)
    /// per agent vault. Caps the blast radius of an undiscovered bug: no single
    /// vault can ever hold more than this, no matter how much lenders want to
    /// deposit. 0 = uncapped.
    pub fn set_deposit_cap(env: Env, new_cap: i128) {
        Self::admin(&env).require_auth();
        env.storage().instance().set(&DataKey::DepositCap, &new_cap);
    }

    pub fn deposit_cap(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::DepositCap).unwrap_or(0)
    }

    /// Lender deposits USDC into a specific agent's isolated vault, receiving
    /// shares priced against the vault's current assets. Frozen after default,
    /// blocked while paused, and capped at the global per-vault deposit cap.
    pub fn deposit(env: Env, lender: Address, agent: Address, amount: i128) -> Result<(), Error> {
        lender.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        if Self::is_paused(&env) {
            return Err(Error::Paused);
        }
        if Self::is_defaulted(&env, &agent) {
            return Err(Error::Defaulted);
        }
        let cap = Self::read_cap(&env);
        if cap > 0 && Self::assets(&env, &agent) + amount > cap {
            return Err(Error::DepositCapExceeded);
        }
        Self::token_client(&env).transfer(&lender, &env.current_contract_address(), &amount);

        // Mint shares against pre-deposit assets (1:1 for the first deposit).
        let total_shares = Self::read(&env, &DataKey::TotalShares(agent.clone()));
        let assets = Self::assets(&env, &agent);
        let shares = if total_shares <= 0 || assets <= 0 {
            amount
        } else {
            amount.saturating_mul(total_shares) / assets
        };

        Self::bump(
            &env,
            &DataKey::Liquidity(agent.clone()),
            Self::read(&env, &DataKey::Liquidity(agent.clone())) + amount,
        );
        Self::bump(&env, &DataKey::TotalShares(agent.clone()), total_shares + shares);
        Self::bump(
            &env,
            &DataKey::Shares(lender.clone(), agent.clone()),
            Self::read(&env, &DataKey::Shares(lender.clone(), agent.clone())) + shares,
        );

        Deposited { lender, agent, amount, shares }.publish(&env);
        Ok(())
    }

    /// Agent draws against its credit line; USDC is disbursed from its vault. The
    /// drawable limit is ramped by repayment history; the first draw from a zero
    /// balance starts the repayment clock. Blocked while paused (new risk-taking
    /// only — an agent that already has a loan can still repay it while paused).
    pub fn borrow(env: Env, agent: Address, amount: i128) -> Result<(), Error> {
        agent.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        if Self::is_paused(&env) {
            return Err(Error::Paused);
        }
        if Self::is_defaulted(&env, &agent) {
            return Err(Error::Defaulted);
        }
        Self::accrue(&env, &agent);

        let limit = Self::ramped_limit(&env, &agent);
        let principal = Self::read(&env, &DataKey::Principal(agent.clone()));
        if principal + amount > limit {
            return Err(Error::InsufficientCredit);
        }
        let liquidity = Self::read(&env, &DataKey::Liquidity(agent.clone()));
        if liquidity < amount {
            return Err(Error::InsufficientLiquidity);
        }

        // A fresh draw (from a zero balance) starts the repayment clock; further
        // draws against an open balance do not extend it.
        let due_date = if principal == 0 {
            let term: u64 = env.storage().instance().get(&DataKey::TermSecs).unwrap();
            let due = env.ledger().timestamp() + term;
            Self::set_due(&env, &agent, due);
            due
        } else {
            Self::read_due(&env, &agent)
        };

        Self::bump(&env, &DataKey::Principal(agent.clone()), principal + amount);
        Self::bump(&env, &DataKey::Liquidity(agent.clone()), liquidity - amount);
        Self::token_client(&env).transfer(&env.current_contract_address(), &agent, &amount);

        Borrowed { agent, amount, due_date }.publish(&env);
        Ok(())
    }

    /// Agent repays. Payment covers accrued interest first — a cut of which funds
    /// the reserve and the rest becomes lender yield — then principal (→ returned
    /// to lendable liquidity). Full repayment clears the repayment clock.
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
            // Reserve takes its cut first; the rest is distributable yield.
            let (to_yield, to_reserve) = split_interest(pay_interest);
            Self::bump(
                &env,
                &DataKey::Reserve(agent.clone()),
                Self::read(&env, &DataKey::Reserve(agent.clone())) + to_reserve,
            );
            Self::bump(
                &env,
                &DataKey::YieldPool(agent.clone()),
                Self::read(&env, &DataKey::YieldPool(agent.clone())) + to_yield,
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
            // Balance fully cleared → stop the clock.
            if principal - pay_principal == 0 {
                Self::set_due(&env, &agent, 0);
            }
        }

        Repaid { agent, amount }.publish(&env);
        Ok(())
    }

    /// Permissionless default trigger: once an agent's loan is past its due date
    /// and principal remains outstanding, anyone may crystallise the default. The
    /// reserve absorbs the loss first; the unrecovered remainder is socialised to
    /// the vault's lenders (share value falls); the agent is frozen out of
    /// further borrowing. Isolated to this agent's vault.
    pub fn mark_default(env: Env, agent: Address, caller: Address) -> Result<(), Error> {
        caller.require_auth();
        if Self::is_defaulted(&env, &agent) {
            return Err(Error::Defaulted);
        }
        let principal = Self::read(&env, &DataKey::Principal(agent.clone()));
        if principal <= 0 {
            return Err(Error::NothingOwed);
        }
        let due = Self::read_due(&env, &agent);
        if due == 0 || env.ledger().timestamp() <= due {
            return Err(Error::NotOverdue);
        }

        // Reserve absorbs first; the rest is a realised loss to lenders.
        let reserve = Self::read(&env, &DataKey::Reserve(agent.clone()));
        let reserve_used = principal.min(reserve);
        let socialized = principal - reserve_used;

        // Recovered reserve returns to withdrawable liquidity; principal and any
        // accrued (now uncollectable) interest are written off. The socialised
        // loss falls out of the share price automatically: assets drop by
        // `socialized` while total shares are unchanged.
        Self::bump(&env, &DataKey::Reserve(agent.clone()), reserve - reserve_used);
        Self::bump(
            &env,
            &DataKey::Liquidity(agent.clone()),
            Self::read(&env, &DataKey::Liquidity(agent.clone())) + reserve_used,
        );
        Self::bump(&env, &DataKey::Principal(agent.clone()), 0);
        Self::bump(&env, &DataKey::InterestOwed(agent.clone()), 0);
        Self::bump(
            &env,
            &DataKey::RealizedLoss(agent.clone()),
            Self::read(&env, &DataKey::RealizedLoss(agent.clone())) + socialized,
        );
        Self::set_due(&env, &agent, 0);
        env.storage()
            .persistent()
            .set(&DataKey::Defaulted(agent.clone()), &true);
        env.storage().persistent().extend_ttl(
            &DataKey::Defaulted(agent.clone()),
            TTL_THRESHOLD,
            TTL_EXTEND,
        );

        Defaulted_ {
            agent,
            caller,
            loss: principal,
            reserve_used,
            socialized,
        }
        .publish(&env);
        Ok(())
    }

    /// Lender withdraws idle deposited value (only funds not currently lent),
    /// burning shares at the current share price.
    pub fn withdraw(env: Env, lender: Address, agent: Address, amount: i128) -> Result<(), Error> {
        lender.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        Self::accrue(&env, &agent);
        let total_shares = Self::read(&env, &DataKey::TotalShares(agent.clone()));
        let assets = Self::assets(&env, &agent);
        let shares = Self::read(&env, &DataKey::Shares(lender.clone(), agent.clone()));
        // The lender's claim is capped by their share value at current price.
        let claim = if total_shares <= 0 {
            0
        } else {
            shares.saturating_mul(assets) / total_shares
        };
        if claim < amount {
            return Err(Error::InsufficientDeposit);
        }
        let liquidity = Self::read(&env, &DataKey::Liquidity(agent.clone()));
        if liquidity < amount {
            return Err(Error::InsufficientLiquidity);
        }

        // Shares to burn for `amount` of value at the current price.
        let burn = if assets <= 0 {
            shares // assets wiped: exiting burns the lender's now-worthless shares
        } else {
            amount.saturating_mul(total_shares) / assets
        };
        let burn = burn.min(shares);

        Self::bump(&env, &DataKey::Shares(lender.clone(), agent.clone()), shares - burn);
        Self::bump(&env, &DataKey::TotalShares(agent.clone()), total_shares - burn);
        Self::bump(&env, &DataKey::Liquidity(agent.clone()), liquidity - amount);
        Self::token_client(&env).transfer(&env.current_contract_address(), &lender, &amount);

        Withdrawn { lender, agent, amount, shares: burn }.publish(&env);
        Ok(())
    }

    /// Lender claims its pro-rata (by shares) share of accumulated interest yield.
    pub fn claim_yield(env: Env, lender: Address, agent: Address) -> i128 {
        lender.require_auth();
        let pool = Self::read(&env, &DataKey::YieldPool(agent.clone()));
        let total = Self::read(&env, &DataKey::TotalShares(agent.clone()));
        let shares = Self::read(&env, &DataKey::Shares(lender.clone(), agent.clone()));
        if pool <= 0 || total <= 0 || shares <= 0 {
            return 0;
        }
        let share = pool.saturating_mul(shares) / total;
        if share > 0 {
            Self::bump(&env, &DataKey::YieldPool(agent.clone()), pool - share);
            Self::token_client(&env).transfer(&env.current_contract_address(), &lender, &share);
            YieldClaimed { lender, agent, amount: share }.publish(&env);
        }
        share
    }

    // ---- Views ----

    /// Full isolated state for an agent's vault.
    pub fn state(env: Env, agent: Address) -> VaultState {
        let principal = Self::read(&env, &DataKey::Principal(agent.clone()));
        let assets = Self::assets(&env, &agent);
        let util = utilization_bps(principal, assets);
        let base_apr = apr_bps(&Self::score_data(&env, &agent).tier);
        VaultState {
            liquidity: Self::read(&env, &DataKey::Liquidity(agent.clone())),
            principal,
            amount_owed: Self::amount_owed(env.clone(), agent.clone()),
            reserve: Self::read(&env, &DataKey::Reserve(agent.clone())),
            total_shares: Self::read(&env, &DataKey::TotalShares(agent.clone())),
            total_assets: assets,
            yield_pool: Self::read(&env, &DataKey::YieldPool(agent.clone())),
            realized_loss: Self::read(&env, &DataKey::RealizedLoss(agent.clone())),
            limit: Self::ramped_limit(&env, &agent),
            apr_bps: dynamic_apr_bps(base_apr, util),
            utilization_bps: util,
            due_date: Self::read_due(&env, &agent),
            defaulted: Self::is_defaulted(&env, &agent),
        }
    }

    /// Total currently owed (principal + interest accrued to the current ledger).
    pub fn amount_owed(env: Env, agent: Address) -> i128 {
        let principal = Self::read(&env, &DataKey::Principal(agent.clone()));
        let interest = Self::read(&env, &DataKey::InterestOwed(agent.clone()));
        principal + interest + Self::pending_interest(&env, &agent, principal)
    }

    /// Remaining drawable credit (ramped limit − outstanding principal).
    pub fn available_credit(env: Env, agent: Address) -> i128 {
        if Self::is_defaulted(&env, &agent) {
            return 0;
        }
        let limit = Self::ramped_limit(&env, &agent);
        let principal = Self::read(&env, &DataKey::Principal(agent));
        (limit - principal).max(0)
    }

    /// The lender's current claim value (USDC) at the vault's share price.
    pub fn position(env: Env, lender: Address, agent: Address) -> i128 {
        let total = Self::read(&env, &DataKey::TotalShares(agent.clone()));
        if total <= 0 {
            return 0;
        }
        let shares = Self::read(&env, &DataKey::Shares(lender, agent.clone()));
        let assets = Self::assets(&env, &agent);
        shares.saturating_mul(assets) / total
    }

    /// The lender's raw share balance in this agent's vault.
    pub fn shares(env: Env, lender: Address, agent: Address) -> i128 {
        Self::read(&env, &DataKey::Shares(lender, agent))
    }

    pub fn liquidity(env: Env, agent: Address) -> i128 {
        Self::read(&env, &DataKey::Liquidity(agent))
    }

    pub fn reserve(env: Env, agent: Address) -> i128 {
        Self::read(&env, &DataKey::Reserve(agent))
    }

    pub fn yield_pool(env: Env, agent: Address) -> i128 {
        Self::read(&env, &DataKey::YieldPool(agent))
    }

    pub fn defaulted(env: Env, agent: Address) -> bool {
        Self::is_defaulted(&env, &agent)
    }

    pub fn due_date(env: Env, agent: Address) -> u64 {
        Self::read_due(&env, &agent)
    }

    pub fn registry(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Registry).unwrap()
    }

    pub fn token(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Token).unwrap()
    }

    pub fn term_secs(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::TermSecs).unwrap()
    }

    // ---- Internals ----

    fn admin(env: &Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    fn is_paused(env: &Env) -> bool {
        env.storage().instance().get(&DataKey::Paused).unwrap_or(false)
    }

    fn read_cap(env: &Env) -> i128 {
        env.storage().instance().get(&DataKey::DepositCap).unwrap_or(0)
    }

    fn is_defaulted(env: &Env, agent: &Address) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::Defaulted(agent.clone()))
            .unwrap_or(false)
    }

    /// Assets backing lender shares: idle liquidity + outstanding principal. The
    /// reserve is a separate protocol buffer (lenders earn yield net of the
    /// reserve cut), so it is deliberately excluded: on default it converts into
    /// withdrawable liquidity, and only the *unrecovered* principal write-down
    /// drops the share price. A default with no reserve wipes shares to the
    /// recovered amount; a fully-reserved loss leaves lenders whole.
    fn assets(env: &Env, agent: &Address) -> i128 {
        Self::read(env, &DataKey::Liquidity(agent.clone()))
            + Self::read(env, &DataKey::Principal(agent.clone()))
    }

    /// Revenue-sized limit, ramped down by the agent's repayment history.
    fn ramped_limit(env: &Env, agent: &Address) -> i128 {
        let data = Self::score_data(env, agent);
        let base = limit_for(data.revenue, &data.tier);
        let rec = Self::repayments(env, agent);
        ramp_limit(base, &rec)
    }

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
    /// Rate is the agent's current utilisation-adjusted APR.
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
        let base = apr_bps(&Self::score_data(env, agent).tier);
        let util = utilization_bps(principal, Self::assets(env, agent));
        simple_interest(principal, dynamic_apr_bps(base, util), now - last)
    }

    fn score_data(env: &Env, agent: &Address) -> ScoreData {
        Self::registry_client(env).get_score(agent)
    }

    fn repayments(env: &Env, agent: &Address) -> RepaymentRecord {
        Self::registry_client(env).get_repayments(agent)
    }

    fn registry_client(env: &Env) -> ScoreRegistryClient<'_> {
        let registry: Address = env.storage().instance().get(&DataKey::Registry).unwrap();
        ScoreRegistryClient::new(env, &registry)
    }

    fn read_due(env: &Env, agent: &Address) -> u64 {
        env.storage()
            .persistent()
            .get(&DataKey::DueDate(agent.clone()))
            .unwrap_or(0)
    }

    fn set_due(env: &Env, agent: &Address, due: u64) {
        env.storage()
            .persistent()
            .set(&DataKey::DueDate(agent.clone()), &due);
        env.storage().persistent().extend_ttl(
            &DataKey::DueDate(agent.clone()),
            TTL_THRESHOLD,
            TTL_EXTEND,
        );
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
