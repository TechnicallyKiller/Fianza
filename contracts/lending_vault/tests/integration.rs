//! End-to-end integration test exercising all three TrustLine contracts plus
//! the shared revenue_math policy, against the Soroban test host:
//!
//!   register -> score -> (terms) -> deposit -> borrow -> repay
//!
//! Asserts that the `credit_line` terms view and the `lending_vault` borrow
//! enforcement agree (both driven by `revenue_math`), that USDC actually moves,
//! that interest accrues and is repaid as lender yield, and that the registry
//! records the repayment outcome.

use credit_line::{CreditLine, CreditLineClient, CreditTerms};
use lending_vault::{LendingVault, LendingVaultClient};
use revenue_math::Tier;
use score_registry::{RepaymentRecord, ScoreRegistry, ScoreRegistryClient};
use soroban_sdk::{testutils::Address as _, testutils::Ledger as _, token, Address, Env};

const YEAR: u64 = 31_536_000;

fn usdc(n: i128) -> i128 {
    n * 10_000_000
}

#[test]
fn full_protocol_flow() {
    let env = Env::default();
    env.mock_all_auths();

    // ---- Actors ----
    let admin = Address::generate(&env);
    let signer = Address::generate(&env); // the trusted underwriting engine
    let agent = Address::generate(&env); // the AI agent / borrower
    let lender = Address::generate(&env); // liquidity provider

    // ---- Deploy: USDC SAC + the three contracts ----
    let usdc_sac = env.register_stellar_asset_contract_v2(admin.clone());
    let usdc_addr = usdc_sac.address();
    let token = token::Client::new(&env, &usdc_addr);
    let token_admin = token::StellarAssetClient::new(&env, &usdc_addr);

    let registry_id = env.register(ScoreRegistry, (admin.clone(), signer.clone()));
    let credit_id = env.register(CreditLine, (registry_id.clone(),));
    let vault_id = env.register(LendingVault, (registry_id.clone(), usdc_addr.clone()));

    let registry = ScoreRegistryClient::new(&env, &registry_id);
    let credit = CreditLineClient::new(&env, &credit_id);
    let vault = LendingVaultClient::new(&env, &vault_id);

    // ===== 1. Agent registers against its stable Stellar address =====
    assert!(!registry.is_registered(&agent));
    registry.register(&agent);
    assert!(registry.is_registered(&agent));

    // ===== 2. Underwriting engine (signer) publishes a signed score =====
    // 720 → Tier B; 25,000 trailing revenue.
    registry.publish_score(&agent, &720, &usdc(25_000));
    let data = registry.get_score(&agent);
    assert_eq!(data.tier, Tier::B);

    // ===== 3. credit_line derives the public terms (must match policy) =====
    assert_eq!(
        credit.terms(&agent),
        CreditTerms {
            tier: Tier::B,
            limit: usdc(50_000), // 2.0× revenue
            apr_bps: 850,        // 8.5%
        }
    );

    // ===== 4. Lender deposits USDC into the agent's isolated vault =====
    token_admin.mint(&lender, &usdc(100_000));
    vault.deposit(&lender, &agent, &usdc(60_000));
    assert_eq!(vault.liquidity(&agent), usdc(60_000));
    assert_eq!(token.balance(&vault_id), usdc(60_000));

    // ===== 5. Agent borrows up to the limit; vault disburses USDC =====
    env.ledger().set_timestamp(10_000);
    // The vault enforces exactly the limit credit_line advertised.
    assert_eq!(vault.available_credit(&agent), usdc(50_000));
    vault.borrow(&agent, &usdc(50_000));
    assert_eq!(token.balance(&agent), usdc(50_000));
    assert_eq!(vault.available_credit(&agent), 0);

    // ===== 6. A year later the agent repays principal + interest =====
    env.ledger().set_timestamp(10_000 + YEAR);
    let owed = vault.amount_owed(&agent);
    assert_eq!(owed, usdc(54_250)); // 50,000 + 8.5%

    token_admin.mint(&agent, &usdc(4_250)); // agent's earned revenue covers interest
    vault.repay(&agent, &owed);
    assert_eq!(vault.amount_owed(&agent), 0);
    assert_eq!(vault.liquidity(&agent), usdc(60_000)); // principal returned
    assert_eq!(vault.yield_pool(&agent), usdc(4_250)); // interest is lender yield

    // ===== 7. Engine records the repayment outcome on the registry =====
    registry.record_repayment(&agent, &true);
    assert_eq!(
        registry.get_repayments(&agent),
        RepaymentRecord {
            on_time: 1,
            total: 1
        }
    );

    // ===== 8. Lender realizes yield and withdraws principal =====
    assert_eq!(vault.claim_yield(&lender, &agent), usdc(4_250));
    vault.withdraw(&lender, &agent, &usdc(60_000));
    // Lender ends with original 100k + 4,250 interest earned.
    assert_eq!(token.balance(&lender), usdc(104_250));
    assert_eq!(vault.liquidity(&agent), 0);
}
