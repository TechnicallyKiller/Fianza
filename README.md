# TrustLine

**Uncollateralized credit for AI agents, underwritten by revenue — on Stellar.**

An AI agent earns income but can't borrow against it: no collateral, no credit
history. TrustLine turns an agent's *verifiable, trailing revenue* into an
uncollateralized USDC credit line. The agent borrows and repays autonomously —
no human in the loop — and settlement rides x402, the payment rail agents already
use to earn.

> Not a credibility badge. A real lending decision, sized against income an agent can prove.

**Status:** working MVP, live on Stellar testnet. Contracts deployed, full
loop settled on-chain. 🔗 **Live demo:** https://0xtrustline.vercel.app

📖 **[Full documentation](docs/README.md)** — architecture, the credit engine,
the Sybil model, the SDK reference, contract addresses, and the roadmap.

---

## What it does — three things, all real on testnet

**1. Autonomous, revenue-backed credit.** An agent registers, is underwritten on
its real on-chain x402 revenue (+ optional zkTLS-attested off-chain income), gets
a credit line, and a lender funds its **isolated vault**. The agent then borrows
and repays USDC *itself*, via the SDK — no human.
[register](https://stellar.expert/explorer/testnet/tx/d6b99f256cdb3b3d1d856809733c4b99ec7f1dc3abb4f968769e635b27a5a669) ·
[score published](https://stellar.expert/explorer/testnet/tx/7d113ede5a77a34696e9fa00142db80c02ca74be5dde866322054daef4fadc11) ·
[deposit](https://stellar.expert/explorer/testnet/tx/4bf6a210842b67520f8dd6dc99f7d0bc635e9400f8b1665b3b830c1de352d2ea) ·
[borrow](https://stellar.expert/explorer/testnet/tx/98b3f5625d9eea49c19ffde5e9a6db6ba462de1c407f9fa7c6ea750fbd515788) ·
[repay](https://stellar.expert/explorer/testnet/tx/c58f02438d5a0d9b9a5b217d891a2161c8bb368f26af3efaf33d6d7055684bfc)

**2. Sybil resistance that works.** The moat isn't reading revenue — anyone can do
that. It's proving revenue is *independent*. An agent that fakes income by paying
itself from wallets it funded is **caught on-chain** (fund-flow loop detection) and
**denied** — both by the underwriter and the vault contract itself.

**3. Invisible credit over x402.** When an agent hits a paywalled x402 resource it
can't afford, `payWithCredit()` **auto-draws the shortfall from its credit line**
and pays. The agent never "decides to borrow" — it just transacts.
([draw](https://stellar.expert/explorer/testnet/tx/b43c09987f4ed41cc43d0386c2202dbfd9e87e80834e70cafd206080628f409e))

## How it works

```
 revenue sources          the underwriter (off-chain)         on-chain rulebook (Soroban)
┌──────────────────┐     ┌───────────────────────────┐      ┌──────────────────────────┐
│ Stellar x402 USDC│──►  │ indexer → independence →   │ ──►  │ score_registry           │
│ Stripe (zkTLS)   │     │ scoring → signer           │      │ credit_line (limit/APR)  │
└──────────────────┘     └───────────────────────────┘      │ lending_vault (isolated) │
        ▲                          signs the score           └──────────────────────────┘
        │                                                              ▲
   agents earn                                        agent SDK: register/borrow/repay,
   over x402                                          payWithCredit (draw-on-402)
```

1. **Earn** — the agent gets paid in USDC over x402; the indexer reads those SAC
   transfer events as revenue.
2. **Underwrite** — the engine checks **counterparty independence** (anti-Sybil),
   scores the agent, and signs the result.
3. **Publish** — the signed score goes on-chain; `credit_line` derives limit + APR.
4. **Borrow / repay** — lenders fund an agent's isolated vault; the agent draws and
   repays autonomously. Repaid interest becomes lender yield.

## What's deployed (Stellar testnet)

| Contract | ID |
|---|---|
| `score_registry` | `CAZUPW5MWHG5XCE7BM6YP6M52NPB6TPRRAXU3GEV4TL2AR2ZMYE7TRSX` |
| `credit_line` | `CC4ZAKREYMCDEONIQMSSBYOBFC75LL5NPYVEBRZ5SACHYWLYGK2R7GDO` |
| `lending_vault` | `CAMF3BS23WXYMA6W6E55VSX577GIPSRKJXJKLL2G46TABUQ4GIRGHIL3` |

Full list (including superseded IDs kept as standing evidence) in
[`docs/contracts.md`](docs/contracts.md). Settlement is real USDC (SAC).
Off-chain revenue is proven via **Reclaim zkTLS** verified on a Soroban
verifier (`CA3EMXR6…`). x402 payments settle through the **OpenZeppelin
Channels** facilitator.

## The moat: counterparty independence

zkTLS proves revenue is *real*; it does not prove it's *independent*. An operator
can loop their own wallets or fund their own Stripe. TrustLine's defensible IP is
the **independence model** — framed as economic security: make faking $1 of counted
revenue cost more than the credit it unlocks. It's a real model today (payer age,
external diversity, funding-source independence, reciprocity, and a concentration
cap), not just loop detection — proven against a synthetic attack catalog and a
live on-chain circular-funding attacker. See [`docs/sybil-model.md`](docs/sybil-model.md).

## Why Stellar

Not chain-agnostic — Stellar-native. Soroban (Rust/WASM) contracts, first-class
USDC via the SAC, **x402 on Stellar** (near-zero fees, ideal for indexing
micro-revenue), and **Reclaim zkTLS with a live Soroban verifier**. The roadmap's
zkML step maps onto Soroban's native BLS12-381 host functions (CAP-0059).

## The agent SDK

Credit for an agent, in a few lines — [`@trustline-agents/agent-sdk`](packages/agent-sdk):

```bash
npm install @trustline-agents/agent-sdk
```

```ts
const tl = new TrustLineAgent(secret, { apiBaseUrl });
await tl.onboard();                         // register + underwrite
const { limitUsdc } = await tl.creditLine();
await tl.borrow(5); /* ...work... */ await tl.repay(5);
await tl.payWithCredit(url, 3);             // draw-on-402: credit, invisible
```

New to TrustLine? [`docs/onboarding-kit.md`](docs/onboarding-kit.md) walks
through funding a testnet agent (XLM, USDC trustline, the TrustLine faucet)
and running this exact loop end to end. Full method-by-method reference in
[`docs/sdk-reference.md`](docs/sdk-reference.md).

## Repo structure

```
contracts/   Soroban contracts — score_registry, credit_line, lending_vault, revenue_math
backend/     underwriting engine (TS/Fastify) — indexer, independence, zktls, scoring, signer, API
packages/    @trustline-agents/agent-sdk — the agent-facing SDK
frontend/    Next.js dashboards (borrower + lender) + landing + docs site
agents/      the live agent fleet (Scout, DataCo, Analyst, Reviewer) — real, working examples
spikes/      validated de-risking spikes (x402 payer, Reclaim zkTLS)
docs/        full documentation — see docs/README.md
```

## Run it locally

```bash
# contracts (native WSL/Linux toolchain — see PROJECT_LOG.md)
cd contracts && stellar contract build && cargo test

# backend underwriting API (:8787)
cd backend && npm i && npm run dev

# frontend (:3100)
cd frontend && npm i && npm run dev
```

The dashboards connect a Stellar wallet (Freighter) to the deployed contracts.
Full architecture, addresses, and the demo runbook are in
[`PROJECT_LOG.md`](PROJECT_LOG.md).

## Roadmap and honest status

Full, current roadmap — what's shipped, in progress, next up, and explicitly
deferred until testnet is proven out — lives in
[`docs/roadmap.md`](docs/roadmap.md). Short version: the core loop, the
credit-risk engine, and the independence model are real and tested; the
underwriter is still a single trusted signer (v1, with a documented
decentralization path), and nothing has yet touched real money or a real
adversary. Named openly, not hidden — see also [`PROJECT_LOG.md`](PROJECT_LOG.md).

## License

MIT. Testnet software; not financial advice.
