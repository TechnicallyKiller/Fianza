#![cfg(test)]

use crate::{Error, LendingVault, LendingVaultClient};
use score_registry::{ScoreRegistry, ScoreRegistryClient};
use soroban_sdk::{testutils::Address as _, testutils::Ledger as _, token, Address, Env};

const YEAR: u64 = 31_536_000;

/// USDC has 7 decimals; `usdc(1)` == 1.0 USDC in stroops.
fn usdc(n: i128) -> i128 {
    n * 10_000_000
}

struct Setup {
    env: Env,
    vault_id: Address,
    registry: ScoreRegistryClient<'static>,
    vault: LendingVaultClient<'static>,
    token: token::Client<'static>,
    token_admin: token::StellarAssetClient<'static>,
}

fn make() -> (Setup, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let signer = Address::generate(&env);

    let registry_id = env.register(ScoreRegistry, (admin.clone(), signer));
    let usdc = env.register_stellar_asset_contract_v2(admin.clone());
    let usdc_addr = usdc.address();
    let vault_id = env.register(LendingVault, (registry_id.clone(), usdc_addr.clone()));

    let s = Setup {
        env: env.clone(),
        vault_id: vault_id.clone(),
        registry: ScoreRegistryClient::new(&env, &registry_id),
        vault: LendingVaultClient::new(&env, &vault_id),
        token: token::Client::new(&env, &usdc_addr),
        token_admin: token::StellarAssetClient::new(&env, &usdc_addr),
    };
    let lender = Address::generate(&env);
    let agent = Address::generate(&env);
    (s, lender, agent)
}

fn score(s: &Setup, agent: &Address, score: u32, revenue: i128) {
    s.registry.register(agent);
    s.registry.publish_score(agent, &score, &revenue);
}

#[test]
fn full_flow_deposit_borrow_repay_yield_withdraw() {
    let (s, lender, agent) = make();
    // 720 → Tier B, 25k revenue → 50k limit, 8.5% APR.
    score(&s, &agent, 720, usdc(25_000));
    s.token_admin.mint(&lender, &usdc(100_000));

    // Lender funds the agent's isolated vault.
    s.vault.deposit(&lender, &agent, &usdc(60_000));
    assert_eq!(s.vault.liquidity(&agent), usdc(60_000));
    assert_eq!(s.token.balance(&s.vault_id), usdc(60_000));
    assert_eq!(s.token.balance(&lender), usdc(40_000));

    // Borrow up to the limit; one stroop more is rejected.
    s.env.ledger().set_timestamp(1_000);
    s.vault.borrow(&agent, &usdc(50_000));
    assert_eq!(s.token.balance(&agent), usdc(50_000));
    assert_eq!(s.vault.liquidity(&agent), usdc(10_000));
    assert_eq!(
        s.vault.try_borrow(&agent, &1),
        Err(Ok(Error::InsufficientCredit))
    );

    // One year later: owe principal + 8.5% interest = 54,250.
    s.env.ledger().set_timestamp(1_000 + YEAR);
    assert_eq!(s.vault.amount_owed(&agent), usdc(54_250));

    // Repay in full (agent funds the interest from elsewhere).
    s.token_admin.mint(&agent, &usdc(4_250));
    s.vault.repay(&agent, &usdc(54_250));
    assert_eq!(s.vault.amount_owed(&agent), 0);
    // Principal returned to liquidity; interest booked as yield.
    assert_eq!(s.vault.liquidity(&agent), usdc(60_000));
    assert_eq!(s.vault.yield_pool(&agent), usdc(4_250));

    // Lender claims yield, then withdraws principal.
    assert_eq!(s.vault.claim_yield(&lender, &agent), usdc(4_250));
    assert_eq!(s.token.balance(&lender), usdc(40_000) + usdc(4_250));
    s.vault.withdraw(&lender, &agent, &usdc(60_000));
    assert_eq!(s.token.balance(&lender), usdc(104_250));
    assert_eq!(s.vault.liquidity(&agent), 0);
}

#[test]
fn vaults_are_isolated_per_agent() {
    let (s, lender, agent_a) = make();
    let agent_b = Address::generate(&s.env);
    score(&s, &agent_a, 800, usdc(20_000)); // A: limit 60k
    score(&s, &agent_b, 700, usdc(20_000)); // B: limit 40k, but no deposits

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
    score(&s, &agent, 720, usdc(25_000));
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
fn rejects_nonpositive_amounts() {
    let (s, lender, agent) = make();
    score(&s, &agent, 720, usdc(25_000));
    assert_eq!(
        s.vault.try_deposit(&lender, &agent, &0),
        Err(Ok(Error::InvalidAmount))
    );
    assert_eq!(
        s.vault.try_borrow(&agent, &-5),
        Err(Ok(Error::InvalidAmount))
    );
}
