#![cfg(test)]

use crate::{Error, LendingVault, LendingVaultClient};
use score_registry::{ScoreRegistry, ScoreRegistryClient};
use soroban_sdk::{testutils::Address as _, testutils::Ledger as _, token, Address, Env};

const YEAR: u64 = 31_536_000;
/// A term long enough that the non-default tests never go overdue.
const LONG_TERM: u64 = 100 * YEAR;
/// On-time repayments needed to lift the credit ramp to 100%.
const FULL_RAMP: u32 = 6;

/// USDC has 7 decimals; `usdc(1)` == 1.0 USDC in stroops.
fn usdc(n: i128) -> i128 {
    n * 10_000_000
}

struct Setup {
    env: Env,
    registry: ScoreRegistryClient<'static>,
    vault: LendingVaultClient<'static>,
    token: token::Client<'static>,
    token_admin: token::StellarAssetClient<'static>,
}

/// deposit_cap = 0 (uncapped) by default so existing behavioural tests are
/// unaffected; cap-specific tests pass a nonzero cap via `make_with_cap`.
fn make_with_term_and_cap(term: u64, deposit_cap: i128) -> (Setup, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let signer = Address::generate(&env);

    let registry_id = env.register(ScoreRegistry, (admin.clone(), signer));
    let usdc = env.register_stellar_asset_contract_v2(admin.clone());
    let usdc_addr = usdc.address();
    let vault_id = env.register(
        LendingVault,
        (registry_id.clone(), usdc_addr.clone(), term, admin.clone(), deposit_cap),
    );

    let s = Setup {
        env: env.clone(),
        registry: ScoreRegistryClient::new(&env, &registry_id),
        vault: LendingVaultClient::new(&env, &vault_id),
        token: token::Client::new(&env, &usdc_addr),
        token_admin: token::StellarAssetClient::new(&env, &usdc_addr),
    };
    let lender = Address::generate(&env);
    let agent = Address::generate(&env);
    (s, lender, agent)
}

fn make_with_term(term: u64) -> (Setup, Address, Address) {
    make_with_term_and_cap(term, 0)
}

fn make() -> (Setup, Address, Address) {
    make_with_term(LONG_TERM)
}

fn score(s: &Setup, agent: &Address, score: u32, revenue: i128) {
    s.registry.register(agent);
    s.registry.publish_score(agent, &score, &revenue);
}

/// Give the agent enough on-time history to unlock its full (100%) ramp.
fn season_full(s: &Setup, agent: &Address) {
    for _ in 0..FULL_RAMP {
        s.registry.record_repayment(agent, &true);
    }
}

/// Score an agent and season it to full ramp so it can draw its whole limit.
fn full_credit(s: &Setup, agent: &Address, score_val: u32, revenue: i128) {
    score(s, agent, score_val, revenue);
    season_full(s, agent);
}

#[test]
fn cold_agent_is_ramped_to_a_fraction_of_its_limit() {
    let (s, lender, agent) = make();
    // 720 → Tier B, 25k revenue → 50k sized limit. No history → 15% ramp = 7,500.
    score(&s, &agent, 720, usdc(25_000));
    s.token_admin.mint(&lender, &usdc(100_000));
    s.vault.deposit(&lender, &agent, &usdc(60_000));

    assert_eq!(s.vault.available_credit(&agent), usdc(7_500));
    s.vault.borrow(&agent, &usdc(7_500));
    // One stroop past the ramped limit is refused even though liquidity exists.
    assert_eq!(
        s.vault.try_borrow(&agent, &1),
        Err(Ok(Error::InsufficientCredit))
    );
}

#[test]
fn ramp_grows_with_on_time_history() {
    let (s, _lender, agent) = make();
    score(&s, &agent, 720, usdc(25_000)); // 50k sized limit
    // 15% cold, +15% per on-time repayment, clamped at 100%.
    assert_eq!(s.vault.available_credit(&agent), usdc(7_500)); // 15%
    s.registry.record_repayment(&agent, &true);
    assert_eq!(s.vault.available_credit(&agent), usdc(15_000)); // 30%
    s.registry.record_repayment(&agent, &true);
    assert_eq!(s.vault.available_credit(&agent), usdc(22_500)); // 45%
    season_full(&s, &agent);
    assert_eq!(s.vault.available_credit(&agent), usdc(50_000)); // clamped 100%
}

#[test]
fn dynamic_apr_rises_with_utilization() {
    let (s, lender, agent) = make();
    full_credit(&s, &agent, 720, usdc(25_000)); // Tier B base 8.5%
    s.token_admin.mint(&lender, &usdc(100_000));
    s.vault.deposit(&lender, &agent, &usdc(50_000));

    // Idle vault: rate is the tier base.
    assert_eq!(s.vault.state(&agent).apr_bps, 850);
    // Draw 25k of 50k assets → 50% utilisation → +5% premium.
    s.vault.borrow(&agent, &usdc(25_000));
    assert_eq!(s.vault.state(&agent).utilization_bps, 5_000);
    assert_eq!(s.vault.state(&agent).apr_bps, 850 + 500);
    // Draw the rest → 100% utilisation → +10% premium.
    s.vault.borrow(&agent, &usdc(25_000));
    assert_eq!(s.vault.state(&agent).utilization_bps, 10_000);
    assert_eq!(s.vault.state(&agent).apr_bps, 850 + 1_000);
}

#[test]
fn full_flow_deposit_borrow_repay_reserve_yield_withdraw() {
    let (s, lender, agent) = make();
    full_credit(&s, &agent, 720, usdc(25_000)); // Tier B, full ramp → 50k
    s.token_admin.mint(&lender, &usdc(100_000));

    s.vault.deposit(&lender, &agent, &usdc(50_000));
    assert_eq!(s.vault.shares(&lender, &agent), usdc(50_000)); // 1:1 first deposit

    // Borrow the full line: 100% utilisation → APR 8.5% + 10% = 18.5%.
    s.env.ledger().set_timestamp(1_000);
    s.vault.borrow(&agent, &usdc(50_000));
    assert_eq!(s.token.balance(&agent), usdc(50_000));

    // One year later owe principal + 18.5% = 59,250.
    s.env.ledger().set_timestamp(1_000 + YEAR);
    assert_eq!(s.vault.amount_owed(&agent), usdc(59_250));

    // Repay in full. Interest 9,250 splits 20% → reserve (1,850), 80% → yield (7,400).
    s.token_admin.mint(&agent, &usdc(9_250));
    s.vault.repay(&agent, &usdc(59_250));
    assert_eq!(s.vault.amount_owed(&agent), 0);
    assert_eq!(s.vault.liquidity(&agent), usdc(50_000)); // principal returned
    assert_eq!(s.vault.reserve(&agent), usdc(1_850)); // first-loss buffer funded
    assert_eq!(s.vault.yield_pool(&agent), usdc(7_400));
    // Full repayment cleared the repayment clock.
    assert_eq!(s.vault.due_date(&agent), 0);

    // Lender claims yield, then withdraws principal at par (share price 1.0).
    // Started with 100k, deposited 50k, so ends at 100k + 7,400 yield.
    assert_eq!(s.vault.claim_yield(&lender, &agent), usdc(7_400));
    s.vault.withdraw(&lender, &agent, &usdc(50_000));
    assert_eq!(s.token.balance(&lender), usdc(100_000) + usdc(7_400));
    assert_eq!(s.vault.liquidity(&agent), 0);
    // Reserve stays as protocol buffer (not withdrawable lender equity).
    assert_eq!(s.vault.reserve(&agent), usdc(1_850));
}

#[test]
fn default_draws_reserve_then_socializes_loss_to_lenders() {
    let (s, lender, agent) = make_with_term(2 * YEAR);
    full_credit(&s, &agent, 720, usdc(25_000));
    s.token_admin.mint(&lender, &usdc(100_000));

    // Lender funds 100k; agent draws 50k → 50% utilisation → APR 13.5%.
    s.vault.deposit(&lender, &agent, &usdc(100_000));
    s.vault.borrow(&agent, &usdc(50_000)); // t=0, due at 2*YEAR
    assert_eq!(s.vault.due_date(&agent), 2 * YEAR);

    // Year 1: agent pays interest only (6,750), funding the reserve, then stops.
    s.env.ledger().set_timestamp(YEAR);
    assert_eq!(s.vault.amount_owed(&agent), usdc(56_750));
    s.token_admin.mint(&agent, &usdc(6_750));
    s.vault.repay(&agent, &usdc(6_750));
    assert_eq!(s.vault.reserve(&agent), usdc(1_350)); // 20% of 6,750
    assert_eq!(s.vault.yield_pool(&agent), usdc(5_400));
    assert_eq!(s.vault.state(&agent).principal, usdc(50_000)); // principal untouched

    // Before default the lender's claim is intact: idle 50k + lent 50k.
    assert_eq!(s.vault.position(&lender, &agent), usdc(100_000));

    // Past the due date, anyone may crystallise the default.
    s.env.ledger().set_timestamp(2 * YEAR + 1);
    let keeper = Address::generate(&s.env);
    s.vault.mark_default(&agent, &keeper);

    // Reserve absorbed 1,350; the remaining 48,650 principal is socialised.
    let st = s.vault.state(&agent);
    assert!(st.defaulted);
    assert_eq!(st.principal, 0);
    assert_eq!(st.reserve, 0);
    assert_eq!(st.realized_loss, usdc(48_650));
    // Idle 50k + recovered 1,350 reserve = 51,350 recoverable liquidity.
    assert_eq!(s.vault.liquidity(&agent), usdc(51_350));
    // Lender's claim collapses to the recoverable amount (lost 48,650 of the 50k lent).
    assert_eq!(s.vault.position(&lender, &agent), usdc(51_350));
    assert_eq!(s.vault.due_date(&agent), 0);

    // Yield already earned before default is still claimable.
    assert_eq!(s.vault.claim_yield(&lender, &agent), usdc(5_400));

    // The defaulted agent is frozen out: no more borrowing, no new deposits.
    assert_eq!(s.vault.available_credit(&agent), 0);
    assert_eq!(
        s.vault.try_borrow(&agent, &usdc(1)),
        Err(Ok(Error::Defaulted))
    );
    assert_eq!(
        s.vault.try_deposit(&lender, &agent, &usdc(1)),
        Err(Ok(Error::Defaulted))
    );
}

#[test]
fn loss_socializes_pro_rata_across_lenders() {
    let (s, lender_a, agent) = make_with_term(YEAR);
    let lender_b = Address::generate(&s.env);
    full_credit(&s, &agent, 720, usdc(25_000));
    s.token_admin.mint(&lender_a, &usdc(100_000));
    s.token_admin.mint(&lender_b, &usdc(100_000));

    // Two lenders fund the same vault 75k / 25k (3:1).
    s.vault.deposit(&lender_a, &agent, &usdc(30_000));
    s.vault.deposit(&lender_b, &agent, &usdc(10_000));
    s.vault.borrow(&agent, &usdc(40_000)); // fully lent, 0 idle, 0 reserve

    // Loan goes unpaid past its due date → full principal loss, no reserve.
    s.env.ledger().set_timestamp(YEAR + 1);
    let keeper = Address::generate(&s.env);
    s.vault.mark_default(&agent, &keeper);

    // Assets wiped to 0 → both lenders' claims go to 0, proportionally.
    assert_eq!(s.vault.state(&agent).realized_loss, usdc(40_000));
    assert_eq!(s.vault.position(&lender_a, &agent), 0);
    assert_eq!(s.vault.position(&lender_b, &agent), 0);
    // Shares are preserved (3:1) — the loss is in the price, not the share count.
    assert_eq!(s.vault.shares(&lender_a, &agent), usdc(30_000));
    assert_eq!(s.vault.shares(&lender_b, &agent), usdc(10_000));
}

#[test]
fn default_is_isolated_to_the_defaulting_agents_vault() {
    let (s, lender, agent_a) = make_with_term(YEAR);
    let agent_b = Address::generate(&s.env);
    let lender_b = Address::generate(&s.env);
    full_credit(&s, &agent_a, 720, usdc(25_000));
    full_credit(&s, &agent_b, 720, usdc(25_000));
    s.token_admin.mint(&lender, &usdc(100_000));
    s.token_admin.mint(&lender_b, &usdc(100_000));

    s.vault.deposit(&lender, &agent_a, &usdc(50_000));
    s.vault.deposit(&lender_b, &agent_b, &usdc(50_000));
    s.vault.borrow(&agent_a, &usdc(40_000));
    s.vault.borrow(&agent_b, &usdc(40_000));

    // A defaults.
    s.env.ledger().set_timestamp(YEAR + 1);
    let keeper = Address::generate(&s.env);
    s.vault.mark_default(&agent_a, &keeper);
    assert!(s.vault.state(&agent_a).defaulted);

    // B is completely untouched: same principal, liquidity, position, no default.
    let stb = s.vault.state(&agent_b);
    assert!(!stb.defaulted);
    assert_eq!(stb.principal, usdc(40_000));
    assert_eq!(s.vault.liquidity(&agent_b), usdc(10_000));
    assert_eq!(s.vault.position(&lender_b, &agent_b), usdc(50_000));
    // B can still borrow the rest of its line; A cannot borrow at all.
    s.vault.borrow(&agent_b, &usdc(10_000));
    assert_eq!(
        s.vault.try_borrow(&agent_a, &usdc(1)),
        Err(Ok(Error::Defaulted))
    );
}

#[test]
fn mark_default_rejects_when_not_overdue_or_nothing_owed() {
    let (s, lender, agent) = make_with_term(YEAR);
    full_credit(&s, &agent, 720, usdc(25_000));
    s.token_admin.mint(&lender, &usdc(100_000));
    s.vault.deposit(&lender, &agent, &usdc(50_000));
    let keeper = Address::generate(&s.env);

    // No outstanding principal → nothing to default.
    assert_eq!(
        s.vault.try_mark_default(&agent, &keeper),
        Err(Ok(Error::NothingOwed))
    );

    // Borrow, then try to default before the due date.
    s.vault.borrow(&agent, &usdc(40_000));
    assert_eq!(
        s.vault.try_mark_default(&agent, &keeper),
        Err(Ok(Error::NotOverdue))
    );

    // A repayment to zero clears the clock, so it can't be defaulted afterwards.
    s.env.ledger().set_timestamp(100);
    s.token_admin.mint(&agent, &usdc(1_000));
    s.vault.repay(&agent, &s.vault.amount_owed(&agent));
    assert_eq!(s.vault.due_date(&agent), 0);
    s.env.ledger().set_timestamp(2 * YEAR);
    assert_eq!(
        s.vault.try_mark_default(&agent, &keeper),
        Err(Ok(Error::NothingOwed))
    );
}

#[test]
fn vaults_are_isolated_per_agent() {
    let (s, lender, agent_a) = make();
    let agent_b = Address::generate(&s.env);
    full_credit(&s, &agent_a, 800, usdc(20_000)); // A: 60k limit
    full_credit(&s, &agent_b, 700, usdc(20_000)); // B: 40k limit, but no deposits

    s.token_admin.mint(&lender, &usdc(50_000));
    s.vault.deposit(&lender, &agent_a, &usdc(30_000));

    // A can borrow against its own deposited liquidity.
    s.vault.borrow(&agent_a, &usdc(20_000));
    assert_eq!(s.vault.liquidity(&agent_a), usdc(10_000));

    // B has credit limit but ZERO liquidity — A's deposits never reach B.
    assert_eq!(s.vault.liquidity(&agent_b), 0);
    assert_eq!(
        s.vault.try_borrow(&agent_b, &usdc(1)),
        Err(Ok(Error::InsufficientLiquidity))
    );
}

#[test]
fn unscored_agent_cannot_borrow() {
    let (s, lender, agent) = make();
    s.registry.register(&agent); // registered but never scored → Unrated, limit 0
    s.token_admin.mint(&lender, &usdc(10_000));
    s.vault.deposit(&lender, &agent, &usdc(10_000));
    assert_eq!(
        s.vault.try_borrow(&agent, &usdc(1)),
        Err(Ok(Error::InsufficientCredit))
    );
}

#[test]
fn cannot_withdraw_funds_that_are_lent_out() {
    let (s, lender, agent) = make();
    full_credit(&s, &agent, 720, usdc(25_000));
    s.token_admin.mint(&lender, &usdc(50_000));
    s.vault.deposit(&lender, &agent, &usdc(50_000));
    s.vault.borrow(&agent, &usdc(40_000)); // liquidity now 10k

    assert_eq!(
        s.vault.try_withdraw(&lender, &agent, &usdc(20_000)),
        Err(Ok(Error::InsufficientLiquidity))
    );
    // Up to idle liquidity is fine.
    s.vault.withdraw(&lender, &agent, &usdc(10_000));
    assert_eq!(s.vault.liquidity(&agent), 0);
}

#[test]
fn pause_blocks_new_deposits_and_borrows_but_not_exits() {
    let (s, lender, agent) = make();
    full_credit(&s, &agent, 720, usdc(25_000));
    s.token_admin.mint(&lender, &usdc(100_000));
    s.vault.deposit(&lender, &agent, &usdc(50_000));
    s.vault.borrow(&agent, &usdc(30_000));

    s.vault.pause(); // admin circuit breaker
    assert!(s.vault.paused());

    // New risk-taking is blocked...
    assert_eq!(
        s.vault.try_deposit(&lender, &agent, &usdc(1)),
        Err(Ok(Error::Paused))
    );
    assert_eq!(s.vault.try_borrow(&agent, &usdc(1)), Err(Ok(Error::Paused)));

    // ...but every exit still works: repay, withdraw, claim_yield.
    s.env.ledger().set_timestamp(1_000);
    let owed = s.vault.amount_owed(&agent);
    s.token_admin.mint(&agent, &usdc(1));
    s.vault.repay(&agent, &owed);
    assert_eq!(s.vault.amount_owed(&agent), 0);
    s.vault.withdraw(&lender, &agent, &usdc(10_000));
    assert_eq!(s.vault.liquidity(&agent), usdc(40_000));

    // Unpause restores normal operation.
    s.vault.unpause();
    assert!(!s.vault.paused());
    s.vault.borrow(&agent, &usdc(1_000));
}

#[test]
fn pause_requires_genuine_authorization() {
    // No mock_all_auths() here — pause() must genuinely fail without a real
    // signature from the admin address, proving it isn't callable by anyone.
    let env = Env::default();
    let admin = Address::generate(&env);
    let signer = Address::generate(&env);
    let registry_id = env.register(ScoreRegistry, (admin.clone(), signer));
    let usdc_addr = env.register_stellar_asset_contract_v2(admin.clone()).address();
    let vault_id = env.register(
        LendingVault,
        (registry_id, usdc_addr, LONG_TERM, admin.clone(), 0i128),
    );
    let vault = LendingVaultClient::new(&env, &vault_id);
    assert!(vault.try_pause().is_err()); // no auth provided at all -> rejected
}

#[test]
fn deposit_cap_limits_capital_at_risk_per_vault() {
    let (s, lender, agent) = make_with_term_and_cap(LONG_TERM, usdc(50_000));
    full_credit(&s, &agent, 720, usdc(25_000));
    s.token_admin.mint(&lender, &usdc(100_000));

    // Up to the cap is fine.
    s.vault.deposit(&lender, &agent, &usdc(50_000));
    assert_eq!(s.vault.state(&agent).total_assets, usdc(50_000));

    // One stroop past the cap is rejected, even though the lender has funds.
    assert_eq!(
        s.vault.try_deposit(&lender, &agent, &1),
        Err(Ok(Error::DepositCapExceeded))
    );

    // Withdrawing frees up room under the cap again.
    s.vault.withdraw(&lender, &agent, &usdc(10_000));
    s.vault.deposit(&lender, &agent, &usdc(10_000));
    assert_eq!(s.vault.state(&agent).total_assets, usdc(50_000));

    // Admin can raise the cap.
    s.vault.set_deposit_cap(&usdc(60_000));
    s.vault.deposit(&lender, &agent, &usdc(10_000));
    assert_eq!(s.vault.state(&agent).total_assets, usdc(60_000));
}

#[test]
fn zero_cap_means_uncapped() {
    let (s, lender, agent) = make(); // make() uses deposit_cap = 0
    full_credit(&s, &agent, 800, usdc(100_000)); // large sized limit
    s.token_admin.mint(&lender, &usdc(1_000_000));
    // A very large deposit succeeds — no cap enforced.
    s.vault.deposit(&lender, &agent, &usdc(500_000));
    assert_eq!(s.vault.liquidity(&agent), usdc(500_000));
}

#[test]
fn rejects_nonpositive_amounts() {
    let (s, lender, agent) = make();
    score(&s, &agent, 720, usdc(25_000));
    assert_eq!(
        s.vault.try_deposit(&lender, &agent, &0),
        Err(Ok(Error::InvalidAmount))
    );
    assert_eq!(s.vault.try_borrow(&agent, &-5), Err(Ok(Error::InvalidAmount)));
}

// ---- Invariant fuzz test -----------------------------------------------
//
// The core solvency promise of the whole vault: the contract can never be
// asked to pay out more USDC than it actually holds for a given agent.
// Concretely, at every point in time (before any action fails or succeeds):
//
//   token.balance(vault) == liquidity + reserve + yield_pool
//
// Principal is deliberately excluded — once borrowed it left the contract and
// is held by the agent, not owed back until repaid. If this identity ever
// breaks, either lenders can't get paid or money is silently created/lost.
//
// A tiny deterministic xorshift PRNG (no external crate — no build-time
// network dependency) drives hundreds of random deposit/borrow/repay/
// withdraw/claim_yield calls with random amounts and random time advances,
// asserting the invariant after every single successful call. Errors (e.g.
// InsufficientLiquidity) are expected and skipped — only successful state
// transitions are checked.

struct Xorshift(u64);
impl Xorshift {
    fn next(&mut self) -> u64 {
        let mut x = self.0;
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        self.0 = x;
        x
    }
    fn range(&mut self, lo: i128, hi: i128) -> i128 {
        if hi <= lo {
            return lo;
        }
        lo + (self.next() as i128).rem_euclid(hi - lo)
    }
}

fn assert_solvent(s: &Setup, agent: &Address) {
    let bal = s.token.balance(&s.vault.address);
    let st = s.vault.state(agent);
    assert_eq!(
        bal,
        st.liquidity + st.reserve + st.yield_pool,
        "SOLVENCY INVARIANT BROKEN: contract balance {} != liquidity {} + reserve {} + yield_pool {}",
        bal,
        st.liquidity,
        st.reserve,
        st.yield_pool,
    );
}

#[test]
fn invariant_fuzz_solvency_holds_across_random_action_sequences() {
    // Run several independent random seeds, hundreds of steps each.
    for seed in [1u64, 42, 12345, 999_999, 7] {
        let (s, lender, agent) = make_with_term(2 * YEAR); // long enough to rarely default mid-fuzz
        full_credit(&s, &agent, 720, usdc(1_000_000)); // large sized limit, full ramp
        s.token_admin.mint(&lender, &usdc(10_000_000));
        s.token_admin.mint(&agent, &usdc(10_000_000)); // agent can always fund interest/principal

        let mut rng = Xorshift(seed);
        let mut now: u64 = 0;
        assert_solvent(&s, &agent);

        for _ in 0..300 {
            // Occasionally advance time so interest actually accrues.
            if rng.range(0, 4) == 0 {
                now += rng.range(0, 3_600 * 24 * 30) as u64; // up to ~30 days
                s.env.ledger().set_timestamp(now);
            }

            match rng.range(0, 5) {
                0 => {
                    let amt = rng.range(1, usdc(5_000));
                    let _ = s.vault.try_deposit(&lender, &agent, &amt);
                }
                1 => {
                    let amt = rng.range(1, usdc(2_000));
                    let _ = s.vault.try_borrow(&agent, &amt);
                }
                2 => {
                    let amt = rng.range(1, usdc(2_000));
                    let _ = s.vault.try_repay(&agent, &amt);
                }
                3 => {
                    let amt = rng.range(1, usdc(1_000));
                    let _ = s.vault.try_withdraw(&lender, &agent, &amt);
                }
                _ => {
                    let _ = s.vault.try_claim_yield(&lender, &agent);
                }
            }

            // Whether the action above succeeded or errored, the invariant
            // must hold NOW — a failed call must never partially apply state.
            assert_solvent(&s, &agent);
        }
    }
}
