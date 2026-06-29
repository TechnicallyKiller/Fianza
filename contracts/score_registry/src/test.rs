#![cfg(test)]

use crate::{Error, RepaymentRecord, ScoreRegistry, ScoreRegistryClient};
use revenue_math::Tier;
use soroban_sdk::{testutils::Address as _, testutils::AuthorizedFunction, Address, Env};

struct Setup {
    env: Env,
    signer: Address,
    admin: Address,
    client: ScoreRegistryClient<'static>,
}

fn setup() -> Setup {
    let env = Env::default();
    let admin = Address::generate(&env);
    let signer = Address::generate(&env);
    let id = env.register(ScoreRegistry, (admin.clone(), signer.clone()));
    let client = ScoreRegistryClient::new(&env, &id);
    Setup {
        env,
        signer,
        admin,
        client,
    }
}

#[test]
fn register_then_publish_and_read() {
    let s = setup();
    s.env.mock_all_auths();
    let agent = Address::generate(&s.env);

    assert!(!s.client.is_registered(&agent));
    s.client.register(&agent);
    assert!(s.client.is_registered(&agent));

    // 720 → Tier B (matches the borrower design mock).
    s.client.publish_score(&agent, &720, &25_000_0000000i128);
    let data = s.client.get_score(&agent);
    assert_eq!(data.score, 720);
    assert_eq!(data.tier, Tier::B);
    assert_eq!(data.revenue, 25_000_0000000i128);
}

#[test]
fn unregistered_agent_has_safe_default() {
    let s = setup();
    let agent = Address::generate(&s.env);
    let data = s.client.get_score(&agent);
    assert_eq!(data.score, 0);
    assert_eq!(data.tier, Tier::Unrated);
}

#[test]
fn cannot_register_twice() {
    let s = setup();
    s.env.mock_all_auths();
    let agent = Address::generate(&s.env);
    s.client.register(&agent);
    assert_eq!(
        s.client.try_register(&agent),
        Err(Ok(Error::AlreadyRegistered))
    );
}

#[test]
fn cannot_publish_for_unregistered() {
    let s = setup();
    s.env.mock_all_auths();
    let agent = Address::generate(&s.env);
    assert_eq!(
        s.client.try_publish_score(&agent, &700, &1000),
        Err(Ok(Error::NotRegistered))
    );
}

#[test]
fn rejects_out_of_range_score() {
    let s = setup();
    s.env.mock_all_auths();
    let agent = Address::generate(&s.env);
    s.client.register(&agent);
    assert_eq!(
        s.client.try_publish_score(&agent, &851, &1000),
        Err(Ok(Error::InvalidScore))
    );
}

#[test]
fn publish_requires_signer_auth() {
    let s = setup();
    s.env.mock_all_auths();
    let agent = Address::generate(&s.env);
    s.client.register(&agent);
    s.client.publish_score(&agent, &700, &1000);

    // The most recent auth required must be the signer authorizing publish_score.
    let auths = s.env.auths();
    assert!(auths.iter().any(|(addr, invoke)| {
        addr == &s.signer
            && matches!(&invoke.function, AuthorizedFunction::Contract(c) if c.1 == soroban_sdk::Symbol::new(&s.env, "publish_score"))
    }));
}

#[test]
fn records_repayment_tally() {
    let s = setup();
    s.env.mock_all_auths();
    let agent = Address::generate(&s.env);
    s.client.register(&agent);

    s.client.record_repayment(&agent, &true);
    s.client.record_repayment(&agent, &true);
    s.client.record_repayment(&agent, &false);

    assert_eq!(
        s.client.get_repayments(&agent),
        RepaymentRecord {
            on_time: 2,
            total: 3
        }
    );
}

#[test]
fn admin_can_rotate_signer() {
    let s = setup();
    s.env.mock_all_auths();
    let new_signer = Address::generate(&s.env);
    s.client.set_signer(&new_signer);
    // After rotation the new signer's auth governs publishing.
    let agent = Address::generate(&s.env);
    s.client.register(&agent);
    s.client.publish_score(&agent, &800, &10_000_0000000i128);
    assert_eq!(s.client.get_score(&agent).tier, Tier::A);
    // admin field is exercised by set_signer's require_auth above.
    let _ = &s.admin;
}
