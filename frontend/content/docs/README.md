# Getting started

**TrustLine is a revenue-underwritten, uncollateralized USDC credit protocol
for AI agents on Stellar.** An agent proves what it actually earns — on-chain
x402 revenue, optionally backed by a zkTLS-verified off-chain figure — and
gets a credit line sized and priced against that proof. It draws and repays
autonomously. No collateral, no human in the loop, no wallet-age heuristics.

> **Status:** live, working prototype on Stellar **testnet**. The core loop
> (earn → prove → underwrite → borrow → repay → lender yield) runs
> end-to-end on real testnet infrastructure. Not yet on mainnet — see
> [Roadmap](roadmap.md) for what that requires.

## The five-second mental model

1. An agent earns real USDC revenue (x402 payments, optionally + a
   zkTLS-proven off-chain figure).
2. TrustLine's underwriting engine checks that revenue is genuinely
   **independent** (not the agent quietly paying itself), scores it, and
   publishes the score on-chain.
3. An on-chain `credit_line` contract derives a credit limit and APR from
   that score.
4. Lenders deposit USDC into the agent's **isolated vault** — exposed only to
   that one agent's default risk, never pooled across agents.
5. The agent borrows against its line and repays as it earns. On-time
   repayment ramps the limit up over time; a default collapses it and
   socializes the loss to that vault's lenders via a first-loss reserve.

## What do you want to do?

| I want to... | Start here |
|---|---|
| Understand *why* this exists and the core thesis | [What & why](what-and-why.md) |
| See how the pieces fit together (contracts, backend, SDK) | [Architecture](architecture.md) |
| Understand exactly how revenue is judged and scored | [How the credit engine works](credit-engine.md) |
| Build an AI agent that earns credit on TrustLine | [Onboarding kit](onboarding-kit.md) → [SDK reference](sdk-reference.md) |
| Look up a deployed contract ID | [Contract addresses](contracts.md) |
| See what's shipped vs. planned | [Roadmap](roadmap.md) |

## Quick links

| Resource | Link |
|---|---|
| Live app | [0xtrustline.vercel.app](https://0xtrustline.vercel.app) |
| Live underwriter (paste any address) | [/underwrite](https://0xtrustline.vercel.app/underwrite) |
| Backend API | `https://trustline.onrender.com` |
| GitHub | [TechnicallyKiller/TrustLine](https://github.com/TechnicallyKiller/TrustLine) |
| Agent SDK | [`packages/agent-sdk`](../packages/agent-sdk) |

## Honest status, up front

This is a genuine, adversarially-tested testnet prototype — not a
production lending product. The credit-risk engine, anti-Sybil independence
model, and safety rails are real and tested (fuzzed contracts, a live
on-chain default run, a synthetic + live attacker catalog). What's explicitly
**not** yet true: nothing has touched real money or a real adversary, the
score-signing key is a single trusted signer (not yet decentralized), and
external adoption is still near zero. See [Roadmap](roadmap.md) for the plan
to close each of these.
