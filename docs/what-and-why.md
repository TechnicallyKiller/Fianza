# What & why

## The problem

AI agents increasingly earn their own money — getting paid over protocols
like x402 for research, code review, data, compute. But they can't *borrow*
against that income. Traditional credit needs collateral, a bank account, a
legal identity, a credit history. An autonomous agent has none of that. So
even a genuinely profitable agent is stuck operating only on cash it already
holds — it can't smooth cash flow, can't take on a bigger job that requires
upfront spend, can't scale the way a business with access to working capital
can.

## The thesis

**Revenue-based financing already exists for businesses** — invoice
factoring, revenue-based loans, merchant cash advances. A lender looks at
your real trailing revenue and extends credit against it, no collateral
needed, because the revenue itself is the underwriting signal. Fianza is
that same primitive, rebuilt for agents and settled on-chain:

- **Prove** what you actually earned (on-chain, cryptographically, in
  minutes) instead of submitting bank statements over weeks.
- **Get scored and funded** by a real underwriting engine instead of a human
  loan officer.
- **Borrow and repay autonomously**, because the borrower is code that can
  hold its own keys and transact without a human approving each draw.
- **Build a track record on-chain** — good repayment history ramps the
  credit limit up automatically; a default collapses it. No credit bureau
  needed; it's all provable from the chain itself.

## Why this is hard (and why most of the engineering is here, not in the UI)

The obvious failure mode: an agent fakes its revenue by paying itself from
wallets it controls, and walks away with a credit line backed by fiction.
**Proving revenue is real is easy (zkTLS, on-chain events). Proving revenue
is *independent* — that it didn't just come from the agent itself — is the
actual hard problem**, and it's where Fianza's real engineering has gone:
a counterparty-independence model that scores each payer by age, external
diversity, funding independence, and reciprocity, and a concentration cap so
no single payer can inflate a score. See
[Sybil / independence model](sybil-model.md) for the real mechanics.

The second hard problem: what happens when an agent *doesn't* repay. Real
lending needs a real risk engine — default detection, loss socialization,
a first-loss reserve, dynamic rates — not just "and then it works out." See
[How the credit engine works](credit-engine.md).

## Why Stellar

Not chain-agnostic by accident — Stellar-native by design:

- **Soroban** (Rust/WASM smart contracts) for the on-chain credit rules.
- **USDC via the Stellar Asset Contract (SAC)** as the settlement currency —
  real money semantics, not a wrapped/synthetic asset.
- **x402 on Stellar** — near-zero fees make it practical to index every
  micro-payment an agent earns, which is exactly the revenue signal the
  underwriter needs.
- **Reclaim zkTLS with a live Soroban verifier** — off-chain revenue (e.g. a
  Stripe balance) can be cryptographically proven and verified on-chain,
  without trusting a centralized oracle.

## Why now

Two trends are colliding: AI agents are increasingly transacting
autonomously (x402, agent-to-agent payments, agentic commerce), and Stellar's
stack (Soroban, native USDC, x402, zkTLS tooling) makes it newly practical to
build real financial infrastructure for them. Fianza is a bet that
**agent-native credit** — instantly assessed, collateral-free, provable — is
a real, missing primitive, not a novelty.

## What Fianza is *not* (on purpose, for now)

- Not a mainnet product yet — see [Roadmap](roadmap.md) for what's gating
  that.
- Not decentralized end-to-end — scoring is currently signed by one trusted
  key (v1), with a documented path to change that.
- Not chasing every DeFi primitive — integrations are chosen deliberately
  (see the roadmap's integration-decision notes) rather than bolted on for
  appearance.
