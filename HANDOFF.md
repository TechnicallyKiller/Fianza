# TrustLine — Reality & Handoff (READ THIS FIRST)

_Last updated: 2026-07-02. If you're a new session, read this whole file before
touching anything. It is deliberately blunt. `PROJECT_LOG.md` has the granular
history; this file is the truth + the plan._

---

## TL;DR — what this actually is

TrustLine is a **working, honest testnet prototype** of revenue-underwritten,
uncollateralized USDC credit for AI agents on Stellar. The core loop
(earn → underwrite → get a credit line → borrow → repay → lender yield) **works
end-to-end on-chain**, and a real autonomous agent (Scout) has run the whole
cycle from zero capital. That is genuinely done and verifiable on-chain.

**It is NOT a lending product.** It is ~10–15% of the way to production. Every
gap that matters — credit risk, a real anti-Sybil moat, scale, contract safety,
trust decentralization — is unbuilt. Nothing has ever touched real money or a
real adversary. See Part 2. **Do not describe this as production-ready to anyone.**

The current push: build the **production-grade organs that CAN be built on
testnet** (credit/risk engine, robust independence, scale), because testnet is
free to be adversarial in. Real-money/legal/audit work is explicitly deferred
(Part 3).

---

## Part 1 — What is REALLY built (verified)

**Contracts (Soroban, deployed to testnet, tested):**
- `score_registry` `CAZUPW5MWHG5XCE7BM6YP6M52NPB6TPRRAXU3GEV4TL2AR2ZMYE7TRSX` —
  registration + signed scores + `record_repayment`. Track A wired the
  repayment tally into scoring (on-chain: the vault/credit_line credit ramp
  reads `get_repayments`; off-chain: the scorer lifts on on-time history and
  collapses below lending grade on a recorded default). Never redeployed —
  address preserved since day one, so all history (Scout, demo agents, the
  live default) survives every downstream redeploy.
- `credit_line` `CC4ZAKREYMCDEONIQMSSBYOBFC75LL5NPYVEBRZ5SACHYWLYGK2R7GDO` —
  reads score → ramped tier/limit/APR via `revenue_math`.
  _(superseded pre-Track-A id: `CA2HOO3K…OKXZV4QSV`.)_
- `lending_vault` `CAMF3BS23WXYMA6W6E55VSX577GIPSRKJXJKLL2G46TABUQ4GIRGHIL3`
  (current — safety-rails hardened) — isolated per-agent vaults with a full
  credit-risk lifecycle: **shares-based lender accounting** (defaults
  socialize loss pro-rata without iterating lenders), **first-loss reserve**
  (funded from an interest cut), **due dates + permissionless `mark_default`**,
  **dynamic (utilization-based) APR**, on-chain **credit ramp** enforced in
  `borrow`, plus **safety rails**: admin `pause`/`unpause` (halts NEW
  deposits/borrows only — repay/withdraw/claim_yield/mark_default always work,
  so paused ≠ funds trapped) and an admin-adjustable global **deposit cap**
  per agent vault (currently 10,000 USDC, caps the blast radius of an
  undiscovered bug). 17 unit tests + a **1,500-step randomized invariant fuzz
  test** (asserts `token.balance(vault) == liquidity + reserve + yield_pool`
  after every single random deposit/borrow/repay/withdraw/claim_yield) + a
  live testnet adversarial default run. Term is a constructor param (deployed
  at 300s for fast live default testing).
  _(superseded ids: Track A `CA7QGIAU…KTDIQOA` — holds the live default
  evidence (agent `GB24RHGT…`), keep for reference; pre-Track-A `CD5RQFF…EUE3EC6C`
  holds Scout's historical loan.)_
- `revenue_math` (lib, single source of truth for tiers/limits/APR + Track A
  risk math: dynamic APR, reserve split, credit ramp, `RepaymentRecord`),
  `stellar8004_identity` (interface stub, unused).

**Backend** (`backend/`, TS/Fastify, on Render): indexer (on-demand `getEvents`
of USDC SAC) + a **persistent payment-graph indexer** (Track C, Postgres/Neon,
runs continuously), `scoring/independence.ts` (full independence model — age ·
diversity · not-funded · reciprocity · concentration — Track B), scoring,
signer, zktls (Reclaim, lazy-loaded, flaky), REST API. Underwriting results now
**persist to Postgres** (`results.ts`) when `DATABASE_URL` is set; falls back
to in-memory otherwise.

**SDK** (`packages/agent-sdk/`): `TrustLineAgent` — register/onboard/underwrite/
creditLine/vaultState/borrow/repay/deposit/`payWithCredit`(draw-on-402, now
supports POST bodies via `opts.init`). Real, works.

**Frontend** (`frontend/`, Next.js, on Vercel): `/demo` (self-serve, live —
underwrites the two demo agents, shows APPROVED vs DENIED), `/borrower`,
`/lender`, landing.

**Agent fleet** (`agents/`, NEW, **local-only, uncommitted at time of writing**):
`shared/brain.mjs` (Groq primary + Gemini 2.5 Flash fallback, $0), `dataco/`
(x402-paid Wikipedia lookup = real cost driver), `scout/` (x402-paid research
agent, wired to SDK). **Scout genuinely earned from 3 independent customers, was
underwritten to Tier B (695), autonomously borrowed against its line from a real
lender deposit, and repaid — full lifecycle, on-chain, from zero.** This is the
strongest artifact.

**Deployed:** backend `https://trustline.onrender.com` (Render free tier —
SLEEPS after ~15 min, first request wakes it ~30–60s). Frontend
`https://0xtrustline.vercel.app`. Repo `github.com/TechnicallyKiller/TrustLine`
(branch `main`).

---

## Part 2 — The brutal reality (what's missing / broken)

1. **Zero real money, zero real adversary.** All "revenue" was free testnet USDC
   we moved around. The whole thesis (underwriting survives attackers) is
   UNTESTED because nothing is at stake. This is the #1 gap.
2. ~~**No credit-risk engine at all.**~~ **BUILT (Track A, on testnet).** Default
   state + permissionless `mark_default`, first-loss reserve, shares-based loss
   socialization, dynamic (utilization) APR, credit ramps, and repayment history
   wired into scoring — all deployed and proven live (see Part 1). Still missing
   under this heading: it has never faced a REAL default with REAL money or a
   real adversary (gap #1 stands), no partial-recovery/collections, no
   liquidation of collateral (N/A — uncollateralized by design), reserve
   parameters are unaudited/uncalibrated.
3. ~~**The moat is one shallow heuristic.**~~ **UPGRADED (Track B).** The loop
   heuristic is now a continuous independence model (`independence.ts`): per-payer
   `w_i` = age · external-diversity · not_funded · reciprocity, + concentration
   (HHI) penalty → effective revenue `R_eff`. Proven by `npm run test:independence`
   (honest passes; self-pay/fresh-farm/circular/concentration caught; mutual
   collusion rings caught via net-flow) AND a live testnet attacker run
   (`_trackB_*`, circular funding → 0 counted). **Remaining gaps:** sophisticated
   *non-reciprocal* collusion rings, bought revenue, and — critically — the model
   can only see ~24h of history (RPC event retention), so age/diversity need the
   persistent graph from Track C to work at full strength. Not calibrated on real
   adversarial data (gap #1 stands).
4. **Single signer = catastrophic single point of failure.** One key mints every
   score; leak it and every vault is drainable. It's a plaintext secret in
   `.env`. It was already silently misconfigured on Render for days.
5. **No scale/persistence.** *Partly addressed (Track C).* A persistent
   payment-graph indexer now exists: Postgres (Neon) `payments`/`accounts`/
   `sync_state`, `indexer/persistent.ts` (idempotent, resumable, `npm run
   db:ingest`), and `scoring/graph.ts` full-history signals incl. loop detection
   as one recursive SQL query. The moat auto-reads the graph when `DATABASE_URL`
   is set (removes the ~24h RPC-retention blindness on QUERIES; history
   accumulates forward as the ingester runs). Verified live on Neon (95
   payments/53 accounts; circular attacker caught from the DB). The underwriting
   store is now **persisted** too (`underwriting_results` JSONB via `results.ts`,
   in-memory fallback) and the indexer runs **continuously** (`startContinuousIngest`,
   `INDEX_INTERVAL_SECS` default 30s, started by `buildServer` when a DB is set) —
   verified live (server auto-ingested 95→404 payments; an underwrite persisted +
   served from `/agents`). **Still missing:** no BullMQ/Redis job queue (async
   re-underwrite/retry), no Hubble/history backfill for pre-retention deep
   history, other tables (payments-graph aside) minimal. `DATABASE_URL` is in
   `backend/.env`; **must also be set on Render** (it's `sync:false` in render.yaml).
6. ~~**Contracts unaudited. No fuzzing, no invariant tests, no caps, no pause
   switch.**~~ **Safety rails added to `lending_vault`** (see Part 1): admin
   pause/unpause (exits never blocked), an admin-adjustable per-vault deposit
   cap (blast-radius limit), and a 1,500-step randomized invariant fuzz test
   proving the core solvency identity holds after every random action. Still
   true: **no PAID audit, no formal verification** — this is "stop flying
   blind," not a substitute for professional review before real money.
   `credit_line`/`score_registry` hold no funds and weren't in scope for
   pause/caps.
7. **Fragile external deps** in the critical path: OZ Channels facilitator
   (single third party, API key, hangs), Reclaim attestor (hangs 120s+).
8. **No product/users/distribution.** No zero-code tiers, no Python SDK, no API
   auth/rate-limiting. One agent has used it and we built it.
9. **Regulatory landmine untouched** (uncollateralized lending, LP capital,
   KYC/AML, money transmission) — gated on leaving testnet, possibly existential.

---

## Part 3 — The plan: production-grade, on testnet

Three tracks, all buildable + adversarially testable on testnet for free. Pick
one and go deep; don't spread thin. Each ends with an **adversarial/failure test**
because that's the actual proof.

### Track A — Credit & risk engine (contracts + backend + `revenue_math`)
The missing organ. Build in `lending_vault` + scoring:
- **Default lifecycle:** loan due-date / max-term, overdue → default state,
  per-loan status. Event on default.
- **Loss handling on default:** socialize the loss to that isolated vault's
  lenders, record it, and **drop the agent's on-chain score** (wire the existing
  `score_registry.record_repayment` — on-time AND missed — into scoring so limits
  ramp up with good history and collapse on default).
- **Reserve / first-loss buffer:** route a cut of interest into a per-vault
  reserve that absorbs defaults before lenders do.
- **Dynamic APR:** utilization-based rate (currently a fixed number per tier).
- **Credit ramps:** new agents start with a small limit that grows only with
  proven on-time repayment — caps `value_unlocked` for a cold attacker.
- **TEST:** have an agent borrow and deliberately NOT repay past the deadline →
  verify default fires, reserve draws, score drops, isolation holds.

### Track B — Robust independence (the moat) — `backend/src/scoring/independence.ts`
Turn the one heuristic into a real model (spec: `docs/sybil-model.md`):
- **Payer reputation weight** `w_i`: account age (first-activity ledger),
  out-degree (distinct counterparties a payer transacts with), penalize
  puppets that only ever pay this agent.
- **Concentration cap (HHI):** no single payer counts past X% of revenue.
- **Temporal organicity:** irregular/bursty (real) vs periodic (scripted).
- **Deeper/weighted fund-flow graph**, funding-source clustering, ring detection
  (mutual/cyclic payment graphs = collusion).
- **Economic-security framing:** cost_to_fake > value_unlocked (pair with Track
  A credit ramps).
- **TEST (this is the real validation):** build a set of ATTACKER agents that
  each run a distinct attack — directly-funded Sybil, aged-wallet Sybil,
  4th-hop-funded, concentrated single payer, a 3-agent collusion ring — and prove
  each is caught or discounted while a genuinely independent agent passes. This
  is free on testnet and is the single most convincing thing you can build.

### Track C — Scale & persistence (backend)
- **Kill the in-memory store → Postgres** (`agents`, `scores`,
  `underwriting_results`, `payments`, `accounts`). First and cheapest win.
- **Persistent incremental indexer:** stream new ledgers, decode USDC SAC
  transfers ONCE into `payments`, keep the payment graph. Backfill from Hubble /
  history archives (note: Hubble is BigQuery, first 1TB/mo free; verify it
  actually carries SAC contract-transfer events before relying on it — may need
  a captive-core / Galexie ingester instead).
- **BullMQ + Redis:** async underwrite jobs (retry the flaky zkTLS step),
  scheduled re-underwriting, per-agent locks, hot-read cache.
- Unblocks onboarding many agents + full history + the graph Track B needs.

### Also do (cheap, high-value, testnet):
- ~~Contract hardening: invariant + fuzz tests, per-vault caps, a pause
  switch, admin controls.~~ **DONE** on `lending_vault` (see Part 1). Not a
  paid audit — that's still later.
- API auth + rate-limiting (anyone can spam `/underwrite` today).
- CI (build+typecheck+contract tests on push), basic monitoring/uptime.

### Explicitly OUT until you leave testnet (do NOT start these now):
Real-money mainnet pilot, real LPs/users, paid security + economic audit,
legal/compliance/KYC-AML, the zero-code gateway/managed-wallet tiers, Python SDK
(nice-to-have, not blocking the three tracks).

---

## Part 4 — Operational ground truth (so you don't break things)

**Environment / how to run anything:**
- Code lives on **native WSL ext4** at `~/stellar`
  (`\\wsl.localhost\ubuntu-24.04\home\divyanshh1\stellar`). **Never build over the
  UNC mount or `/mnt/c`** (koffi/native deps fail).
- Run commands as `wsl -d ubuntu-24.04 -- bash -lc 'source ~/.profile; <cmd>'`.
- Stellar CLI at `~/.local/bin/stellar`; deployer identity `deployer` =
  the funded signer.

**Key addresses (testnet):**
- USDC SAC `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`;
  USDC issuer (classic) `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`.
- **Score signer (funded)** `GCNFNO4A4WPHUNNT3YJ36J4NIW4SV46XNO35Y355TMJF6DVPVXM3KWXF`
  — secret is `SCORE_SIGNER_SECRET` in `backend/.env`. **This MUST be set on
  Render** or publishing silently uses a fresh unfunded key (this bit us —
  verify `/config`'s `signer` matches the above after any Render change).
- **Contracts (testnet, current):** vault
  `CAMF3BS23WXYMA6W6E55VSX577GIPSRKJXJKLL2G46TABUQ4GIRGHIL3` (term 300s,
  safety-rails hardened — pause + deposit cap), credit_line
  `CC4ZAKREYMCDEONIQMSSBYOBFC75LL5NPYVEBRZ5SACHYWLYGK2R7GDO`, registry
  unchanged (`CAZUPW5…MYE7TRSX`, never redeployed). `backend/.env` points
  here; **Render must be updated to match** + the vault added to
  `X402_EXCLUDE_ADDRESSES` (already reflected in `render.yaml`, but Render
  still needs a redeploy to pick it up). Redeploy pattern: reuse the registry,
  see `contracts/_trackA_deploy.sh` / `_safety_rails_ids.txt` for the exact
  invocation shape. Live default-run agent `GB24RHGT…EJNMP2ZC` is
  defaulted/frozen on the **prior** vault `CA7QGIAU…KTDIQOA` (kept as
  standing evidence, not the active vault).
- Demo agents (public, in Render env): honest
  `GB2FTLU3SE6GVATDG2TZMGRYJTRXLZJJM6PKYNZUV3PE6BSATL3PN5L3`, sybil
  `GAXCQ2B6MLJSP6IHB3DLMARUJMJLWMCEUV5ZMI4OHJ3FZGMYO55F5NLN`, `DEMO_FROM_LEDGER=3369652`.
- Scout fleet (secrets in `agents/.env`): Scout
  `GC654YOQQWSOYVDJKIYY726J3ULZBAQJYJXNUCXZPJ4EBCTFFLNTZOS5` (Tier B, has a small
  open loan), DataCo `GDAL5EDBD7ES6YGCTM767NHJQ7KG4ICTJ76LS7JQJV3G6KWDDH3WG53E`,
  Scout's lender `GAEXGDYLIYAOISITB4HCCDHQ7EN6G6K4CO6JBBYW7KFN7OBKLENISR77`
  (deposited 15 USDC into Scout's vault), 3 customer wallets.

**Secrets & where they live (ALL gitignored — never commit, never screenshot with
values shown):**
- `backend/.env` — `SCORE_SIGNER_SECRET`, contract ids, `SCORE_BAND_DIVISOR=1000`
  (testnet band calibration), `X402_EXCLUDE_ADDRESSES` (facilitators + the seeder
  funder + the vault contract), OZ key, Reclaim/Stripe.
- `agents/.env` — Groq + Gemini API keys, all Scout/DataCo/customer/lender wallet
  secrets, OZ key. **Back this up somewhere durable — `/tmp` key loss already
  happened once.**
- `spikes/.env`, `spikes/spike2-reclaim-revenue/.env` — SEEDPHRASE, Stripe key, OZ.
- On Render: same as `backend/.env`, set in the dashboard; `render.yaml` locks
  non-secret vars + build (`npm install && npm run build`) / start (`npm start`).
- On Vercel: `NEXT_PUBLIC_API_BASE_URL=https://trustline.onrender.com`.

**Running services right now:** Scout `:3020`, DataCo `:3021` (local only).
Backend is on Render, not local. Nothing else local.

---

## Part 5 — Traps discovered this session (do NOT repeat)

- **`wsl -d ubuntu-24.04 -- bash -lc '...$VAR...'` MANGLES shell variables and
  command substitution** — they come back empty. Use literal values inline, or
  put logic in a script file and run `bash file.sh`. This wasted a lot of time.
- **`pkill -f` inside wsl is unreliable** — it left stale node servers squatting
  on ports serving stale env (caused a fake "bug"). After any pkill, verify with
  `ss -ltnp` and kill by exact PID.
- **`python3` is NOT installed in WSL** — parse JSON with `node -e`, not python.
- **Fastify rejects a bodyless POST that sends `content-type: application/json`**
  (400). The frontend api client now only sets it when there's a body — keep it.
- **Classic USDC payments ALSO emit SAC transfer events** on this protocol, so
  the indexer counts them too — you cannot hide funding by using a classic
  payment; use the exclude list.
- **The signer misconfig canary:** if scores compute but don't publish, check
  `/config` `signer` first — an ephemeral unfunded key means `SCORE_SIGNER_SECRET`
  isn't set in that environment.
- Commit style: terse messages, **no Co-Authored-By / AI trailers**. Currently
  committing straight to `main`.

---

## Part 6 — Immediate state & first actions for a new session

- Latest pushed commit: `bea5d85`. **Uncommitted (Track A + prior):** the
  Track A changes — `contracts/libraries/revenue_math`, `contracts/lending_vault`,
  `contracts/credit_line`, `contracts/score_registry` (RepaymentRecord moved to
  revenue_math), `backend/src/{chain,scoring,signer,underwrite,api}`, deploy
  scripts `contracts/_trackA_*.sh` + `_trackA_ids.txt`, `backend/.env` (new ids);
  plus prior `packages/agent-sdk/src/index.ts`, `agents/` (source only), docs.
  Track A build+deploy+live-test is DONE and green (35 Rust tests + a live
  testnet default run). SDK `dist/` gitignored — rebuild with
  `cd packages/agent-sdk && npm run build`.
- **Track A next steps:** update Render env to the new contract ids (above);
  optionally re-run the live default demo with an interest-repay step first to
  show a non-zero reserve draw (was 0 live because the agent never repaid before
  defaulting). Then pick Track B or C.
- Task #17 (unfinished): deploy Scout + DataCo persistently + a public "Scout,
  live" status page. Lower priority than the three tracks now.
- **Recommended first move:** pick ONE of Track A / B / C and go deep. If unsure,
  **Track A (credit/risk engine)** — it's the most glaring "this isn't a lending
  product" hole and it's fully testnet-buildable, or **Track B** if the moat/
  fundraise story matters more. Don't do all three at once.
