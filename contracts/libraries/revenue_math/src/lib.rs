#![no_std]
//! revenue_math — the single source of truth for TrustLine's underwriting
//! policy and the shared types/interfaces the three contracts agree on.
//!
//! Everything here is pure (no storage, no auth) so it can be unit-tested in
//! isolation and reused identically on-chain by `credit_line` and
//! `lending_vault` and off-chain by the scoring engine. Keeping the banding and
//! limit math in one place is what guarantees the registry, the credit-line
//! terms view, and the vault's borrow check never disagree.

use soroban_sdk::{contractclient, contracttype, Address, Env};

/// Underwriting tier, derived from the published score. Ordered worst→best so
/// the enum's discriminants are meaningful if ever compared.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Tier {
    /// Below the lending threshold — no credit extended.
    Unrated = 0,
    C = 1,
    B = 2,
    A = 3,
}

/// What the registry stores per agent and what cross-contract readers consume.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ScoreData {
    /// Composite revenue-coverage score, 0..=850 (FICO-like range).
    pub score: u32,
    /// Tier banded from `score`.
    pub tier: Tier,
    /// Verified trailing revenue (USDC, 7-decimal stroops) the score was
    /// computed against. Drives the credit limit.
    pub revenue: i128,
    /// Ledger timestamp the score was last published.
    pub updated_at: u64,
}

/// Running tally of an agent's repayment history, maintained by `score_registry`
/// and consumed on-chain by the credit ramp (`ramp_limit`). Lives here (the
/// shared-types home) so the vault and the registry agree on its shape.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RepaymentRecord {
    /// Loans repaid on or before their due date.
    pub on_time: u32,
    /// Total repayment outcomes observed (on-time + missed).
    pub total: u32,
}

/// Cross-contract read interface for `score_registry`. The `#[contractclient]`
/// macro generates `ScoreRegistryClient`, which `credit_line` and
/// `lending_vault` use to read a registry by address. The registry exposes
/// matching inherent functions (same pattern as `soroban_sdk::token`).
#[contractclient(name = "ScoreRegistryClient")]
pub trait ScoreRegistryInterface {
    fn get_score(env: Env, agent: Address) -> ScoreData;
    fn is_registered(env: Env, agent: Address) -> bool;
    fn get_repayments(env: Env, agent: Address) -> RepaymentRecord;
}

// ---- Policy constants -------------------------------------------------------

/// Score thresholds (inclusive lower bound) for each tier.
const TIER_A_MIN: u32 = 750;
const TIER_B_MIN: u32 = 650;
const TIER_C_MIN: u32 = 550;

/// Basis-point denominator (10_000 bps = 100%).
pub const BPS: i128 = 10_000;

// ---- Policy functions -------------------------------------------------------

/// Band a published score into a tier.
pub fn tier_from_score(score: u32) -> Tier {
    if score >= TIER_A_MIN {
        Tier::A
    } else if score >= TIER_B_MIN {
        Tier::B
    } else if score >= TIER_C_MIN {
        Tier::C
    } else {
        Tier::Unrated
    }
}

/// Credit-limit multiple for a tier, in basis points of trailing revenue.
/// A = 3.0×, B = 2.0×, C = 1.0×, Unrated = 0.
pub fn limit_multiple_bps(tier: &Tier) -> i128 {
    match tier {
        Tier::A => 30_000,
        Tier::B => 20_000,
        Tier::C => 10_000,
        Tier::Unrated => 0,
    }
}

/// Fixed borrower APR for a tier, in basis points.
/// A = 6.00%, B = 8.50%, C = 12.00%, Unrated = 0 (cannot borrow).
pub fn apr_bps(tier: &Tier) -> u32 {
    match tier {
        Tier::A => 600,
        Tier::B => 850,
        Tier::C => 1_200,
        Tier::Unrated => 0,
    }
}

/// Credit limit = trailing revenue × tier multiple. Saturating + non-negative;
/// negative or zero revenue yields a zero limit.
pub fn limit_for(revenue: i128, tier: &Tier) -> i128 {
    if revenue <= 0 {
        return 0;
    }
    revenue
        .saturating_mul(limit_multiple_bps(tier))
        / BPS
}

/// Coverage ratio = revenue / debt, expressed in basis points (10_000 = 1.0×).
/// Zero debt is treated as fully covered (`u32::MAX`). Result clamps to u32.
pub fn coverage_ratio_bps(revenue: i128, debt: i128) -> u32 {
    if debt <= 0 {
        return u32::MAX;
    }
    if revenue <= 0 {
        return 0;
    }
    let ratio = revenue.saturating_mul(BPS) / debt;
    if ratio > u32::MAX as i128 {
        u32::MAX
    } else {
        ratio as u32
    }
}

/// Simple (non-compounding) interest accrued on `principal` over `elapsed_secs`
/// at `apr_bps`. Used by the vault. Saturating; returns 0 for non-positive
/// principal or zero rate/time.
pub fn simple_interest(principal: i128, apr_bps: u32, elapsed_secs: u64) -> i128 {
    if principal <= 0 || apr_bps == 0 || elapsed_secs == 0 {
        return 0;
    }
    const SECONDS_PER_YEAR: i128 = 31_536_000; // 365 days
    principal
        .saturating_mul(apr_bps as i128)
        .saturating_mul(elapsed_secs as i128)
        / (BPS * SECONDS_PER_YEAR)
}

// ---- Risk-engine policy (Track A) ------------------------------------------

/// Share of repaid interest routed to a vault's first-loss reserve before the
/// remainder becomes lender yield. 20% — the reserve is the buffer that absorbs
/// defaults ahead of lenders.
pub const RESERVE_CUT_BPS: i128 = 2_000;

/// Maximum APR premium (bps) added on top of the tier's base rate when a vault
/// is fully utilised. Rates rise with utilisation so scarce liquidity is priced.
pub const MAX_UTIL_PREMIUM_BPS: u32 = 1_000; // up to +10.00% at 100% utilisation

/// Credit-ramp floor: a brand-new agent (no repayment history) may draw only
/// this fraction of its revenue-derived limit. Caps a cold attacker's take.
pub const RAMP_START_BPS: i128 = 1_500; // 15% of the sized limit at cold start
/// Each on-time repayment lifts the ramp by this much, up to 100%.
pub const RAMP_STEP_BPS: i128 = 1_500; // +15% per proven on-time repayment
/// Every missed repayment pulls the ramp down by this much (compounds distrust).
pub const RAMP_MISS_PENALTY_BPS: i128 = 3_000; // -30% per miss

/// Interest split on repayment: `(to_yield, to_reserve)`. The reserve cut is
/// taken first; the rest is lender yield. Non-positive interest splits to zero.
pub fn split_interest(interest: i128) -> (i128, i128) {
    if interest <= 0 {
        return (0, 0);
    }
    let to_reserve = interest.saturating_mul(RESERVE_CUT_BPS) / BPS;
    (interest - to_reserve, to_reserve)
}

/// Vault utilisation in bps: outstanding principal / lender assets, clamped to
/// [0, 10_000]. Zero deposits ⇒ zero (nothing to price).
pub fn utilization_bps(principal: i128, assets: i128) -> u32 {
    if principal <= 0 || assets <= 0 {
        return 0;
    }
    let u = principal.saturating_mul(BPS) / assets;
    if u >= BPS {
        BPS as u32
    } else {
        u as u32
    }
}

/// Utilisation-adjusted borrower APR: the tier's base rate plus a linear premium
/// that scales from 0 (idle vault) to `MAX_UTIL_PREMIUM_BPS` (fully drawn).
pub fn dynamic_apr_bps(base_apr_bps: u32, utilization_bps: u32) -> u32 {
    if base_apr_bps == 0 {
        return 0; // Unrated cannot borrow — no rate.
    }
    let util = utilization_bps.min(BPS as u32);
    let premium = ((MAX_UTIL_PREMIUM_BPS as u64) * (util as u64) / (BPS as u64)) as u32;
    base_apr_bps + premium
}

/// Credit-ramp factor (bps of the sized limit) an agent may actually draw, given
/// its repayment history. Starts at `RAMP_START_BPS`, grows `RAMP_STEP_BPS` per
/// on-time repayment, and is dragged down `RAMP_MISS_PENALTY_BPS` per miss.
/// Clamped to [0, 10_000].
pub fn ramp_factor_bps(rec: &RepaymentRecord) -> i128 {
    let missed = rec.total.saturating_sub(rec.on_time) as i128;
    let raw = RAMP_START_BPS + (rec.on_time as i128) * RAMP_STEP_BPS
        - missed * RAMP_MISS_PENALTY_BPS;
    raw.clamp(0, BPS)
}

/// Apply the credit ramp to a sized limit: `base_limit × ramp_factor`.
pub fn ramp_limit(base_limit: i128, rec: &RepaymentRecord) -> i128 {
    if base_limit <= 0 {
        return 0;
    }
    base_limit.saturating_mul(ramp_factor_bps(rec)) / BPS
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn banding_thresholds() {
        assert_eq!(tier_from_score(850), Tier::A);
        assert_eq!(tier_from_score(750), Tier::A);
        assert_eq!(tier_from_score(749), Tier::B);
        assert_eq!(tier_from_score(720), Tier::B); // matches the design mock
        assert_eq!(tier_from_score(650), Tier::B);
        assert_eq!(tier_from_score(649), Tier::C);
        assert_eq!(tier_from_score(550), Tier::C);
        assert_eq!(tier_from_score(549), Tier::Unrated);
        assert_eq!(tier_from_score(0), Tier::Unrated);
    }

    #[test]
    fn limit_matches_design_mock() {
        // Borrower screen: 25,000 revenue, Tier B → 50,000 limit (2.0×).
        let revenue = 25_000_0000000i128; // 25,000 USDC at 7 decimals
        assert_eq!(limit_for(revenue, &Tier::B), 50_000_0000000i128);
        assert_eq!(limit_for(revenue, &Tier::A), 75_000_0000000i128);
        assert_eq!(limit_for(revenue, &Tier::C), 25_000_0000000i128);
        assert_eq!(limit_for(revenue, &Tier::Unrated), 0);
    }

    #[test]
    fn limit_handles_nonpositive_revenue() {
        assert_eq!(limit_for(0, &Tier::A), 0);
        assert_eq!(limit_for(-100, &Tier::A), 0);
    }

    #[test]
    fn apr_matches_design_mock() {
        assert_eq!(apr_bps(&Tier::B), 850); // borrower screen shows 8.5%
        assert_eq!(apr_bps(&Tier::A), 600);
        assert_eq!(apr_bps(&Tier::C), 1_200);
        assert_eq!(apr_bps(&Tier::Unrated), 0);
    }

    #[test]
    fn coverage_ratio() {
        assert_eq!(coverage_ratio_bps(100, 100), 10_000); // 1.0×
        assert_eq!(coverage_ratio_bps(200, 100), 20_000); // 2.0×
        assert_eq!(coverage_ratio_bps(50, 100), 5_000); // 0.5×
        assert_eq!(coverage_ratio_bps(100, 0), u32::MAX); // no debt
        assert_eq!(coverage_ratio_bps(0, 100), 0);
    }

    #[test]
    fn interest_accrual() {
        // 10,000 USDC at 8.5% for a full year ≈ 850 USDC.
        let principal = 10_000_0000000i128;
        let year = 31_536_000u64;
        assert_eq!(simple_interest(principal, 850, year), 850_0000000i128);
        // Half a year ≈ 425 USDC.
        assert_eq!(simple_interest(principal, 850, year / 2), 425_0000000i128);
        // Edge cases.
        assert_eq!(simple_interest(0, 850, year), 0);
        assert_eq!(simple_interest(principal, 0, year), 0);
        assert_eq!(simple_interest(principal, 850, 0), 0);
    }

    #[test]
    fn interest_split_reserve_first() {
        // 20% of interest goes to the reserve, the rest to yield.
        assert_eq!(split_interest(100_0000000), (80_0000000, 20_0000000));
        assert_eq!(split_interest(0), (0, 0));
        assert_eq!(split_interest(-5), (0, 0));
        // Split is exhaustive: parts always sum back to the input.
        let (y, r) = split_interest(7);
        assert_eq!(y + r, 7);
    }

    #[test]
    fn utilization_clamps() {
        assert_eq!(utilization_bps(0, 100), 0);
        assert_eq!(utilization_bps(50, 100), 5_000); // 50%
        assert_eq!(utilization_bps(100, 100), 10_000); // 100%
        assert_eq!(utilization_bps(150, 100), 10_000); // over-drawn clamps
        assert_eq!(utilization_bps(100, 0), 0); // no deposits ⇒ unpriced
    }

    #[test]
    fn dynamic_apr_scales_with_utilization() {
        // Tier B base 8.5%: idle vault charges base, full vault charges base+10%.
        assert_eq!(dynamic_apr_bps(850, 0), 850);
        assert_eq!(dynamic_apr_bps(850, 5_000), 850 + 500); // half → +5%
        assert_eq!(dynamic_apr_bps(850, 10_000), 850 + 1_000); // full → +10%
        assert_eq!(dynamic_apr_bps(0, 10_000), 0); // Unrated stays 0
    }

    #[test]
    fn ramp_grows_and_collapses() {
        let base = 100_000_0000000i128;
        // Cold start: only 15% of the sized limit.
        let cold = RepaymentRecord { on_time: 0, total: 0 };
        assert_eq!(ramp_factor_bps(&cold), 1_500);
        assert_eq!(ramp_limit(base, &cold), 15_000_0000000);
        // Each on-time repayment lifts the ramp; full access after enough history.
        let seasoned = RepaymentRecord { on_time: 6, total: 6 };
        assert_eq!(ramp_factor_bps(&seasoned), 10_000); // 15% + 6×15% clamps to 100%
        assert_eq!(ramp_limit(base, &seasoned), base);
        // A default (missed) collapses the ramp hard.
        let defaulted = RepaymentRecord { on_time: 2, total: 3 };
        // 15% + 2×15% − 1×30% = 15% → but one miss drags it down.
        assert_eq!(ramp_factor_bps(&defaulted), 1_500);
        // Enough misses drive the ramp to zero.
        let burned = RepaymentRecord { on_time: 0, total: 2 };
        assert_eq!(ramp_factor_bps(&burned), 0);
        assert_eq!(ramp_limit(base, &burned), 0);
    }
}
