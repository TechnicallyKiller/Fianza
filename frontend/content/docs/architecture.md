# Architecture

## Repo layout

```
contracts/   Soroban contracts — score_registry, credit_line, lending_vault, revenue_math
backend/     underwriting engine (TS/Fastify) — indexer, independence, zktls, scoring, signer, API
packages/    @trustline-agents/agent-sdk — the agent-facing SDK
frontend/    Next.js dashboards (borrower + lender) + landing
agents/      the live agent fleet (Scout, DataCo, Analyst, Reviewer) — real, working examples
spikes/      validated de-risking spikes (x402 payer, Reclaim zkTLS)
docs/        this documentation
```

## Data flow, end to end

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

1. **Earn** — an agent gets paid in USDC over x402. The backend indexer reads
   the resulting SAC transfer events as revenue (`backend/src/indexer/`).
2. **Underwrite** — `backend/src/underwrite.ts` orchestrates the whole pass:
   index revenue → run the independence/anti-Sybil check
   (`scoring/independence.ts`) → optionally verify an off-chain zkTLS proof
   (`zktls/`) → compute a score (`scoring/index.ts`) → sign it (`signer/`).
3. **Publish** — the signed score is submitted to the on-chain
   `score_registry` contract.
4. **Price** — `credit_line` reads the published score and derives a tier,
   credit limit, and APR via the shared `revenue_math` library (same math on
   both the contract side and the backend's scoring side, kept in sync
   deliberately).
5. **Fund** — a lender deposits USDC into that specific agent's **isolated
   vault** in `lending_vault` — a separate accounting bucket per agent, so
   one agent's default never touches another lender's exposure.
6. **Borrow / repay** — the agent (via the SDK, its own Stellar key) draws
   against its line and repays as it earns. Repaid interest funds a
   first-loss reserve and lender yield; a missed repayment triggers the
   on-chain default lifecycle.

## The three moving systems

### 1. Contracts (Soroban, `contracts/`)

- **`score_registry`** — stores each agent's latest signed score. Its history
  is preserved across every redeploy of the other contracts (see
  [Contract addresses](contracts.md) for why this ID never changes while
  `credit_line`/`lending_vault` have been redeployed as features shipped).
- **`credit_line`** — pure pricing logic: score in, `{tier, limit, apr}` out,
  via `revenue_math`.
- **`lending_vault`** — the actual money contract: isolated per-agent
  accounting, shares-based lender positions, a first-loss reserve, dynamic
  utilization-based APR, on-chain credit ramps, and a permissionless default
  lifecycle (`mark_default`) — see
  [How the credit engine works §4](credit-engine.md#4-the-on-chain-credit-engine---the-lending-vault)
  for the full mechanics.
- **`revenue_math`** — the shared tier/limit/APR/risk math library, the
  single source of truth both the contract and the backend's scoring code
  read from.

### 2. Backend (Fastify/TypeScript, `backend/`)

The trusted underwriter in v1 (see [Roadmap](roadmap.md) for the
decentralization path). Owns:

- **The indexer** — reads on-chain USDC SAC transfer events (on-demand RPC, a
  persistent Postgres-backed payment graph for full history, and a Horizon
  deep-history fallback for revenue that predates both).
- **The independence engine** (`scoring/independence.ts`) — the anti-Sybil
  moat; see [Sybil / independence model](sybil-model.md).
- **The zkTLS module** (`zktls/`) — generates and verifies Reclaim proofs of
  off-chain revenue against a deployed Soroban verifier contract.
- **The signer** (`signer/`) — holds the one key that publishes scores
  on-chain today.
- **The REST API** (`api/server.ts`) — everything the frontend and SDK call:
  `/agent/:address/underwrite`, `/agent/:address`, `/agents`, `/config`,
  `/waitlist`, `/faucet`, and more.

### 3. Agent SDK (`packages/agent-sdk/`)

The interface an agent actually uses — `register`, `onboard`, `underwrite`,
`creditLine`, `vaultState`, `borrow`, `repay`, `deposit`, `payWithCredit`. The
agent holds its own Stellar key; on-chain writes are signed by that key, not
by TrustLine. See the full [SDK reference](sdk-reference.md).

## Frontend (`frontend/`, Next.js)

Public-facing dashboards and the live demo: `/underwrite` (paste any address,
watch a live verdict), `/demo` (honest agent vs. a Sybil side-by-side),
`/borrower` and `/lender` (the actual credit/deposit flows against connected
wallets), and the landing page.
