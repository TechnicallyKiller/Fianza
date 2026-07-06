# Roadmap

## Shipped, live on testnet

- **The core credit loop** — register, prove revenue, get scored, receive an
  on-chain credit line, borrow, repay, lender yield. All real, all on-chain.
- **A real credit-risk engine** — default lifecycle with permissionless
  `mark_default`, a first-loss reserve, shares-based loss socialization
  across lenders, dynamic utilization-based APR, and on-chain credit ramps.
  Proven with unit tests, a 1,500-step randomized invariant fuzz test, and a
  live adversarial default run.
- **A real anti-Sybil independence model** — payer age, external diversity,
  funding-source independence, reciprocity, and concentration (HHI),
  replacing naive loop-detection. Proven against a synthetic attack catalog
  and a live on-chain circular-funding attacker.
- **Persistent scale** — a continuously-running Postgres payment-graph
  indexer and a Horizon deep-history fallback, so the moat isn't limited to
  the RPC's ~24h event retention.
- **zkTLS off-chain revenue proofs** — a Reclaim-verified off-chain revenue
  figure (e.g. a Stripe balance), verified on a deployed Soroban verifier
  contract, carrying real weight in the score.
- **A real autonomous artifact** — an agent (Scout) has run the entire
  lifecycle — earn, get underwritten, borrow, repay — completely
  autonomously, starting from zero capital.
- **The agent SDK and onboarding kit** — `@trustline-agents/agent-sdk`, a testnet
  USDC faucet, and a runnable quickstart, so an outside builder can actually
  plug an agent in.

## In progress

- **External adoption** — the SDK, faucet, and onboarding kit exist
  specifically to let agents that aren't ours integrate. Current real usage
  is still a handful of test agents, honestly.
- **Public documentation** — this docs site itself; still growing (an
  error-code/glossary page and more integration examples are next).
- **Ecosystem composability** — exploring integrations with other Stellar
  DeFi primitives so an agent's revenue can come from participating
  elsewhere in the ecosystem (e.g. running as a keeper/operator on another
  protocol), and so idle lender capital isn't sitting fully dormant between
  loans.

## Next up

- **Get the score-signing key out of plaintext config**, with a documented
  rotation procedure — the biggest remaining centralization risk.
- **API auth + rate-limiting** on the underwriting endpoint, currently open
  to anyone.
- **zkTLS proof-caching resilience** — a transient proof failure shouldn't
  visibly downgrade an agent's tier; fall back to the last verified proof
  instead of zeroing it out.
- **Extend deep-history to the independence engine's diversity signal**, not
  just revenue and payer age.
- **Basic CI** (build + typecheck + contract tests on push) and baseline
  uptime monitoring.

## Deliberately deferred until testnet is proven out

Real-money mainnet pilot, real LP capital, a paid security + economic audit,
legal/compliance/KYC-AML work, zero-code/managed-wallet tiers, and a Python
SDK. These are all real, all necessary eventually, and all explicitly **not**
started — the strategy is to build and adversarially test everything that
can be built and attacked for free on testnet first, before anything touches
real money or a real adversary.

## The honest gap analysis

What's genuinely built and tested (the credit loop, the risk engine, the
independence model, the safety rails) is real engineering, not a demo. What's
still missing is not more contract logic — it's **proof under real
conditions**: real money, a real adversary, real external users, and a
decentralized trust root. That's the actual distance between "working
testnet prototype" and "production credit protocol," and it's why the
near-term roadmap is about distribution and hardening, not new primitives.
