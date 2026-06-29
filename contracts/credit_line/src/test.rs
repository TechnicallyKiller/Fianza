#![cfg(test)]

use crate::{CreditLine, CreditLineClient, CreditTerms};
use revenue_math::Tier;
use score_registry::{ScoreRegistry, ScoreRegistryClient};
use soroban_sdk::{testutils::Address as _, Address, Env};

struct Setup {
    env: Env,
    registry: ScoreRegistryClient<'static>,
    credit: CreditLineClient<'static>,
}

fn setup() -> Setup {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let signer = Address::generate(&env);

    let registry_id = env.register(ScoreRegistry, (admin, signer));
    let credit_id = env.register(CreditLine, (registry_id.clone(),));

    Setup {
        env: env.clone(),
        registry: ScoreRegistryClient::new(&env, &registry_id),
        credit: CreditLineClient::new(&env, &credit_id),
    }
}

#[test]
fn derives_terms_from_published_score() {
    let s = setup();
    let agent = Address::generate(&s.env);
    s.registry.register(&agent);
    s.registry.publish_score(&agent, &720, &25_000_0000000i128);

    assert_eq!(
        s.credit.terms(&agent),
        CreditTerms {
            tier: Tier::B,
            limit: 50_000_0000000i128, // 2.0× revenue
            apr_bps: 850,              // 8.5%
        }
    );
    assert_eq!(s.credit.limit(&agent), 50_000_0000000i128);
    assert_eq!(s.credit.apr_bps(&agent), 850);
}

#[test]
fn tier_a_gets_higher_limit_lower_apr() {
    let s = setup();
    let agent = Address::generate(&s.env);
    s.registry.register(&agent);
    s.registry.publish_score(&agent, &800, &10_000_0000000i128);

    let terms = s.credit.terms(&agent);
    assert_eq!(terms.tier, Tier::A);
    assert_eq!(terms.limit, 30_000_0000000i128); // 3.0×
    assert_eq!(terms.apr_bps, 600); // 6.0%
}

#[test]
fn unscored_agent_has_zero_limit() {
    let s = setup();
    let agent = Address::generate(&s.env);
    // Registered but never scored → Unrated, no credit.
    s.registry.register(&agent);
    let terms = s.credit.terms(&agent);
    assert_eq!(terms.tier, Tier::Unrated);
    assert_eq!(terms.limit, 0);
    assert_eq!(terms.apr_bps, 0);
}
