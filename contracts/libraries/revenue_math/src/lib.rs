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

/// Cross-contract read interface for `score_registry`. The `#[contractclient]`
/// macro generates `ScoreRegistryClient`, which `credit_line` and
/// `lending_vault` use to read a registry by address. The registry exposes
/// matching inherent functions (same pattern as `soroban_sdk::token`).
#[contractclient(name = "ScoreRegistryClient")]
pub trait ScoreRegistryInterface {
    fn get_score(env: Env, agent: Address) -> ScoreData;
    fn is_registered(env: Env, agent: Address) -> bool;
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
}
