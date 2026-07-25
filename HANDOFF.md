# Fianza (formerly TrustLine) — Reality & Handoff (READ THIS FIRST)

_Last updated: 2026-07-25. If you're a new session, read this whole file before
touching anything. It is deliberately blunt. `PROJECT_LOG.md` has the granular
history; this file is the truth + the plan._

_Newest work: **Part 12 — mainnet deploy (all 3 contracts LIVE on Stellar
mainnet, verified) + rename TrustLine → "Fianza"** (name collision with a
different, already-SCF-44-funded "Trustline" project). The rename is FULLY
DONE, including publish: `@fianza/agent-sdk` + `@fianza/skill` are live on
npm, `fianza-agent-sdk` is live on PyPI (note the scope is `@fianza`, not
`@fianza-agents` — the npm org is named `fianza`). Read Part 12 FIRST — it has
the exact rename state and the hard rule not to touch backend routes/URLs or
break Tael's integration. What's left is only explicitly user-deferred infra
(domain, GitHub repo rename, Render renames). Then
Part 11 (autonomous agent demo, credit-book dashboard, Tier-2 hardening) for
product context. Backend is `https://trustline-rpxt.onrender.com` (NOT
`trustline.onrender.com`, which is SUSPENDED). Rename work lives on branch
`rename/fianza`, not merged/pushed._

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

**Deployed:** backend `https://trustline-rpxt.onrender.com` (Render free tier —
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
- On Vercel: `NEXT_PUBLIC_API_BASE_URL=https://trustline-rpxt.onrender.com`.

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

_Updated 2026-07-04, end of a long multi-day session. Everything below is
pushed to `main` unless stated otherwise — check `git log --oneline -20` to
orient. Tracks A/B/C (Part 3) are all DONE, not just planned — see below._

**Tracks A/B/C are built, tested, and live on testnet:**
- **Track A (credit/risk):** `lending_vault` has default lifecycle, first-loss
  reserve, credit ramps, dynamic APR, **plus safety rails** (admin pause/unpause
  — exits never blocked —, admin-adjustable per-vault deposit cap, and a
  1,500-step randomized invariant fuzz test proving
  `token.balance(vault) == liquidity + reserve + yield_pool` holds after every
  random action). Current vault: `CAMF3BS23WXYMA6W6E55VSX577GIPSRKJXJKLL2G46TABUQ4GIRGHIL3`
  (term 300s, cap 10,000 USDC). credit_line: `CC4ZAKREYMCDEONIQMSSBYOBFC75LL5NPYVEBRZ5SACHYWLYGK2R7GDO`.
  Registry (`CAZUPW5MWHG5XCE7BM6YP6M52NPB6TPRRAXU3GEV4TL2AR2ZMYE7TRSX`) has
  never been redeployed — all history preserved across every contract upgrade.
  40 Rust tests total, all green (`cd contracts && cargo test`).
- **Track B (moat):** `backend/src/scoring/independence.ts` — real model (age ·
  external-diversity · not-funded · reciprocity · concentration), NOT the old
  loop-only heuristic. Testnet-calibrated (`INDEP_AGE_FULL_DAYS=2`,
  `INDEP_DIVERSITY_FULL=1` — verified against the full adversarial catalog
  before changing these; A1/A2 self-pay/fresh-farm attacks are defeated by the
  diversity signal specifically, which is unaffected by the age threshold).
  `npm run test:independence` in backend/ proves it against a synthetic attack
  catalog; also proven against a REAL on-chain circular-funding attacker.
- **Track C (scale):** Postgres (Neon) persists the payment graph AND the
  underwriting-results store; a continuous indexer runs in-process
  (`startContinuousIngest`, `backend/src/indexer/persistent.ts`) whenever
  `DATABASE_URL` is set. `underwrite()` now reads revenue from whichever of
  {RPC live window, our Postgres graph} has seen more — fixes the ~24h RPC
  blindness for agents already in our graph, but **the graph only has data from
  when WE started ingesting (~July 1). It is NOT a real historical backfill.**

**Real agents with real, live, verified ratings (not synthetic):**
Scout (`GC654YOQQWSOYVDJKIYY726J3ULZBAQJYJXNUCXZPJ4EBCTFFLNTZOS5`), Analyst
(`GDJDMZDLOUQL3ZGOXOIGBQIX7SYQDIXDJ5DC3IQN4JYZ4EJY4WXMDJDC`, trading-research,
x402-priced), and Reviewer (`GAB4FYJSDKQBID2JZRNU4LPTOZIOXDNBSBZ7C5SSGJOYW6WDWWCTHRHJ`,
code-review, x402-priced) all show real Tier C ratings on `/lender` from real
customer payments (`agents/pay-agent.mjs`, `agents/onboard.mjs`). Source in
`agents/analyst/`, `agents/reviewer/`. **Analyst/Reviewer are NOT publicly
hosted yet** — `render.yaml` has both service definitions ready but the user
hit Render's card-on-file requirement partway through dashboard setup and
paused there (see "Open items" below).

**Frontend is coherent and live-demo-ready:** landing leads with the product
(no more "COMING SOON"), `/underwrite` is the flagship — paste any address,
watch a live verdict + per-payer independence breakdown, presets for honest/
sybil/live-attacker. `/lender` shows real underwritten agents + a working
deposit flow (code-verified, not yet click-tested with a live wallet
extension by anyone). `/borrower` had a real bug — "Currently Borrowed"/
"Amount Drawn" were hardcoded to `0`, never read live vault state — **fixed**
(`lib/stellar.ts` `readContract()` + wired into the page). zkTLS proof
(`/borrower`'s "Submit revenue proof") is genuinely verified working
end-to-end tonight (real proof, real on-chain verify, `secretSafe:true`,
~68s) — deliberately NOT added to `/underwrite` (too slow for a live click-
through demo), just given expectation-setting copy on `/borrower`.

**A real user click-tested the actual connect-wallet-and-underwrite flow
tonight** (first time either of us had) — a fresh wallet correctly scored
400/Unrated/0 (zero revenue, correct result, not a bug), then was funded with
real USDC from three clean/aged/unrelated wallets and re-scored to a real
Tier C live on the production Render backend. This is the strongest
end-to-end proof yet that the whole pipeline works for an outside wallet, not
just our own agents.

**A real, self-inflicted data-integrity incident happened and was fixed
tonight** — see `memory` file `trustline-funding-contamination-trap` (or just:
never fund a test customer wallet from another agent's own dependency wallet;
it creates a real on-chain loop the independence engine will correctly and
*permanently* flag). Scout's original 3 customer wallets are permanently
tainted for Scout specifically because of this; Scout's current real rating
comes from 3 different, clean payers (`AGENT`/`SERVICE` — old spike1 wallets —
plus `SCOUT_LENDER`). Keep this pattern in mind before ever using a "convenient"
funding source again.

**Open items, in priority order:**
1. **Signer key is still a single point of failure.** A native-Stellar-
   multisig fix was attempted and deliberately reverted mid-build (see git
   log — the SDK's `authorizeEntry()` only supports one signature per entry,
   required hand-building CAP-46-4 auth entries; it worked but was too
   fragile to ship same-session). Cheapest real improvement not yet done: get
   `SCORE_SIGNER_SECRET` out of plaintext `.env`, document rotation.
2. **Real historical backfill, NOT yet built.** Confirmed live tonight:
   Horizon (`horizon-testnet.stellar.org`, NOT the Soroban RPC) retains FULL
   history indefinitely, and its `/operations` endpoint returns the raw
   `invoke_host_function` call params (base64 XDR) for every historical
   `transfer` call — decodable with the exact same `scValToNative` pattern
   already used everywhere in this codebase. This is a much simpler path than
   the Hubble/BigQuery or captive-core/Galexie options this file used to
   speculate about. **Plan:** add a Horizon-based deep-history revenue+payer
   lookup (`backend/src/indexer/` or a new `horizon-backfill.ts`), used as a
   fallback when RPC + our own graph both come up empty/thin for an agent
   being underwritten, and/or as a one-time backfill job to seed the Postgres
   graph with real depth instead of only forward-collected data. NOT yet
   started — this is the next concretely-scoped task.
3. **Network-mismatch trap, worth a quick guard:** tonight a user tried to
   underwrite a real external agent (`GDDTQFQZK734EXIJE5LWU4G4YC5A6P5AHJ4UWVMV6WBFWT6BAAQQHV2V`,
   found via a "stellar8004" AI-agent reputation site) that turned out to be a
   **mainnet** address, not testnet — scored 400 correctly, but for a
   confusing reason (wrong network entirely, not lack of history). Worth a
   cheap UX fix: detect/warn when an underwrite target resolves on mainnet but
   not testnet (or vice versa) instead of silently returning a zero score.
   Not started.
4. **Analyst/Reviewer public hosting — paused mid-setup.** `render.yaml` has
   both services fully defined (rootDir `agents`, builds `packages/agent-sdk`
   first). User hit Render asking for a card on file when creating a plain Web
   Service (not just the Cron Job type as first assumed) and paused rather
   than commit to that without deciding first. `agents/.env` has the wallet
   secrets needed (`ANALYST_WALLET_SECRET/PUBLIC`, `REVIEWER_WALLET_SECRET/PUBLIC`).
5. **Keep-alive is built and free-tier-friendly**, not yet scheduled anywhere.
   `agents/keep-alive.mjs` exports `tick()` (real, small, scoped x402 research/
   review job from a random existing customer wallet — explicitly research/
   review ONLY, never trades, see the file's header). Rather than a paid
   Render Cron Job, it's wired as a **token-protected HTTP endpoint** on
   Analyst (`GET /keep-alive-tick?token=...` in `agents/analyst/server.mjs`,
   `KEEPALIVE_TOKEN` env var) so a free external pinger (cron-job.org,
   UptimeRobot) can trigger it with zero Render billing. Verified locally:
   wrong token → 403, correct token → real tick, HTTP 200. Blocked on #4 (needs
   Analyst actually deployed first) plus the user setting up the free external
   pinger.
6. **Backend cold-start mitigated** — user has a UptimeRobot (or similar) ping
   on `https://trustline-rpxt.onrender.com/health` from earlier tonight; confirm
   it's still active in a new session (`curl .../health` should respond
   instantly, not after a 30-60s cold-start delay, if the ping is working).
7. **Render dashboard historically has NOT auto-synced from `render.yaml`'s
   literal `value:` fields** — confirmed twice tonight (contract ids and
   `DEMO_HONEST_AGENT` were stale in the dashboard despite render.yaml having
   the right values for multiple pushes). Always verify `/config` and `/demo`
   on the live backend after a contract/config-relevant push rather than
   assume Render picked it up automatically.
8. **Traction is still ~0 real external users.** Not a code problem. One X
   post went out tonight. See Part 3 discussion in-session for channel ideas
   (Stellar/Soroban dev community, x402 protocol community, AI agent-builder
   circles, direct outreach) — nothing programmatic to do here, it's outreach.

**Update, same session, right after the above was written — #2 and zkTLS are
now DONE, not just planned:**

- **Horizon backfill (item #2) is BUILT.** `backend/src/indexer/horizon.ts`
  (`horizonUsdcTransfers`) walks an account's full Horizon operation history
  and extracts every USDC transfer — handles BOTH forms a transfer takes on
  this protocol: a Soroban `invoke_host_function` SAC call, and a classic
  `payment` operation. Missing the classic-payment case was a real bug caught
  while testing against Scout's known-correct revenue (undercounted 19
  USDC/3 payers instead of 20.5/6 — fixed before shipping). Wired into
  `underwrite.ts` as a third-tier fallback: only checked when RPC + our own
  graph both come up under 0.5 USDC for an agent, resilient to failure.
  **NOT yet extended to the independence engine's diversity (out-degree)
  signal** — that still only sees RPC/graph-depth history per payer. Age
  already used Horizon and was already correct. Worth doing if a payer's
  *own* diversity (not the agent's revenue) needs deep history too.
- **zkTLS proof now demonstrates a real, non-trivial, non-zero result.** It
  was always cryptographically working, but proved $0 because the Stripe
  test account's `available` balance was empty. Fixed with two real (not
  faked) changes: (1) created genuine Stripe TEST-MODE charges (`sk_test_`
  key + Stripe's own `tok_visa` test token — zero real money possible), (2)
  switched the proven field from `available` to `pending`, since Stripe
  holds charged funds pending for days before settling — `pending` is itself
  a real, verifiable balance field and arguably the *more* correct one to
  underwrite against (revenue the moment it's earned, not delayed by payout
  scheduling). Verified live: proved $73.86, `secretSafe:true`,
  `verified:true`, real on-chain tx
  `7dd9f5235cad3b47cb21fb5a5d1bce74f6354f9158fca0ff0b35a428dd7a0320` — and it
  meaningfully changed a real score (Scout → 775/Tier A, since the offchain
  component carries 1.5x weight). Still slow (~70-90s, Reclaim attestor
  network) — deliberately still not added to `/underwrite`'s fast demo flow,
  stays a `/borrower`-only, narrated feature.
- Neither of these has been deployed to the LIVE Render backend yet this
  session (both were tested against a local instance) — a fresh session
  should confirm the push auto-deployed and re-verify both live before
  assuming they're active in production, per the standing "Render dashboard
  doesn't always auto-sync" caution above.

**Recommended next move for a fresh session:** verify both of the above are
live on Render (`/agent/<addr>/underwrite` for a thin-history testnet agent
should now find revenue via Horizon; the zkTLS proof button should now
return a nonzero figure). After that, items #1 (signer key) and #4 (Analyst/
Reviewer public hosting, currently paused on Render's card requirement) are
the two with the most real value left on the table.

---

## Part 7 — Session update (2026-07-04, later) + weekly milestones for what's left

**What got done this pass (verified live, not just locally):**
- Confirmed the "verify both are live on Render" ask above was **not yet true**:
  a live `POST /agent/<Scout>/underwrite` came back 575/Tier C with
  `proofError: "STRIPE_TEST_KEY missing"`. Root cause: `STRIPE_TEST_KEY` and
  `SEEDPHRASE` (the zkTLS Reclaim-proof secrets) only ever existed in
  `spikes/.env` / `spikes/spike2-reclaim-revenue/.env` — never in
  `backend/.env`, never in `render.yaml` (not even as a `sync: false`
  placeholder), and therefore never in the Render dashboard either.
- Fixed: copied both into `backend/.env` (local), added both to
  `render.yaml` as declared `sync: false` secrets (so this can't silently
  regress again), user added the real values to the Render dashboard and
  redeployed.
- Re-verified live, twice, after each secret was added — final result:
  **Scout is genuinely 775/Tier A on the live production backend**, real
  Reclaim proof ($73.86, `verified:true`, on-chain verify tx succeeded),
  real new on-chain score-attestation tx. This closes the loop HANDOFF Part 6
  flagged as unconfirmed.
- Landing page (`frontend/app/page.tsx`) redesigned: removed the sci-fi HUD
  boilerplate that read as generic/templated (`Sector A · x402` / `Node Δ ·
  Testnet` corner labels, the four corner brackets, the lat/long footer
  coordinate) — kept the underwriting-journey diagram (Revenue Sector → Proof
  Precursors → Score Activated → Credit Propagation → The Horizon) since
  that's the one distinctive, real piece. Pushed to `main` (`1a5dac1`).
- Confirmed (for anyone who asks again): the ~575↔775 score flip for the same
  agent is not a bug, it's the resilience design — `underwrite()` always
  attempts the Reclaim proof unless `skipProof` is passed, and silently
  degrades to on-chain-only revenue if the proof step throws (missing key,
  attestor timeout, network hiccup) rather than failing the whole pass. A
  real remaining gap: a failed re-proof currently **zeroes out** the offchain
  component instead of falling back to the last-verified proof — not fixed
  yet, flagged for Week 3 below.

**Everything else in Part 6 (open items #1, #3–#8) is UNCHANGED — still open.**
Below is a 4-week plan for it, testnet-only, same "ends with an adversarial/
failure test" discipline as Part 3.

### Week 1 — Close the security gap + cheap UX fix
- **~~Signer key out of plaintext (KMS)~~ — dropped.** `SCORE_SIGNER_SECRET`
  is a testnet key; moving it to a secret manager is security theater when
  nothing real is at stake. Correctly called out this session as solving the
  wrong problem — replaced with the item below, which is the real fix.
- **K-of-N multisig signer (real fix, testnet-safe, history-preserving).**
  Read `contracts/score_registry/src/lib.rs` this session: the signer is
  **not baked into the contract** — it's a mutable `Address` in storage
  (`DataKey::Signer`), gated behind an existing admin-only
  `set_signer(new_signer)` that was clearly left there on purpose. Plan:
  1. Deploy a small Soroban **custom-account contract** (`__check_auth`) that
     approves an action only with **K-of-N valid signatures** over a caller-
     defined signature bundle (the standard Soroban "smart wallet" pattern —
     NOT Stellar's native multisig/thresholds, which is what the earlier
     abandoned attempt fought via CAP-46-4 hand-built auth entries and
     `authorizeEntry()`'s one-signature-per-entry limit. A custom account
     contract sidesteps that entirely: `__check_auth` receives one payload
     you define, e.g. a `Vec` of signatures, so it's a clean single auth
     entry, not a fight with account thresholds).
  2. Call the registry's existing `set_signer(multisig_address)` — **one
     transaction, zero redeploy** of `score_registry`. All persistent state
     (`Registered`, `Score`, `Repayments` per agent — i.e. Scout's entire
     history and every agent shown on `/lender`) is untouched; it's keyed by
     agent address in the same contract instance that never moves.
  3. Update `backend/src/signer/` to collect K signatures (from K
     independently-held keys) instead of one, before calling
     `publish_score`/`record_repayment`.
  **Why this matters for judges:** turns "single trusted signer" from an
  unaddressed weakness into "trust is K-of-N, here's the contract and here's
  proof it doesn't erase history." Real ~1-2 week scope (write + test the
  account contract, wire the backend, verify end-to-end on testnet), zero
  cost (testnet only), does not touch a cent of real money.
  **Test:** call `set_signer` with the multisig address on the live testnet
  registry, confirm `/lender` and `/agent/<Scout>` still show Scout's full
  existing history unchanged, then confirm a K-of-N-signed `publish_score`
  succeeds and a (K-1)-signed one is rejected on-chain.
- **Network-mismatch guard.** A user pasted a mainnet address into
  `/underwrite` and got a silent, confusing 400/Unrated instead of "this
  address doesn't exist on testnet." Cheap fix: detect the account resolves
  on the *other* network and say so explicitly.
  **Test:** paste a known mainnet-only address and a known testnet-only
  address into `/underwrite`; both should give an actionable message, not a
  bare zero score.
- **Confirm the uptime pinger is still active** (`curl .../health` should
  answer instantly, not after a 30-60s cold-start). Five-minute check, but
  do it — free-tier Render sleeps kill first-impression demos.

### Week 2 — Ship Analyst/Reviewer publicly + turn on keep-alive
- Unblock item #4: decide on Render's card-on-file requirement for a plain
  Web Service (the two agents are otherwise fully defined in `render.yaml`,
  builds `packages/agent-sdk` first) and actually deploy
  `trustline-analyst` / `trustline-reviewer`.
  **Test:** hit both public URLs with a real x402-paid request from an
  external wallet, confirm the payment clears and `/lender` shows their real
  Tier C ratings (already proven locally — this is just "does it survive
  being public").
- Turn on `agents/keep-alive.mjs` via the token-protected
  `GET /keep-alive-tick?token=...` endpoint on Analyst, using a free external
  pinger (cron-job.org / UptimeRobot) — this was built and verified locally
  but is blocked on Analyst actually being deployed.
  **Test:** confirm a scheduled external tick produces a real, tiny research
  job and updated revenue — not just a 200 with no side effect.

### Week 3 — Guardrails around the two "anyone can hit this" endpoints
- **API auth + rate-limiting** on `/underwrite` (currently open — "anyone can
  spam it" per HANDOFF Part 2 #8). Doesn't need to be fancy: an API key
  header + a per-IP/per-agent rate limit is enough for testnet.
  **Test:** hammer `/underwrite` past the limit from a script, confirm it
  throttles instead of hammering Reclaim/RPC on your behalf.
- **zkTLS proof-caching resilience** (the gap surfaced this session): when a
  re-proof attempt fails, fall back to the last **verified** proof for that
  agent instead of zeroing `offchainUsdc` — a transient Reclaim hiccup
  shouldn't visibly downgrade an agent's tier.
  **Test:** force a proof failure (bad key temporarily) on an agent with a
  previously-verified proof; score should hold, not collapse.
- **Basic CI**: build + typecheck + `cargo test` on push. Cheap, catches the
  class of "pushed and didn't notice it broke" mistake before it reaches
  Render.

### Week 4 — Moat depth + traction
- **Extend Horizon deep-history to the independence engine's diversity
  signal.** Horizon backfill already feeds agent revenue and payer *age*;
  it does NOT yet feed a payer's own out-degree/diversity, so a payer with
  real deep history that predates the RPC/graph window still looks
  "undiversified." Wire `horizonUsdcTransfers` into
  `scoring/independence.ts`'s diversity factor the same way `underwrite.ts`
  already uses it for revenue.
  **Test:** re-run the adversarial catalog (`npm run test:independence`)
  plus one payer whose real diversity is >24h/graph-start old — confirm it's
  no longer misclassified as low-diversity.
- **Monitoring pass**: confirm Render + Neon + Vercel all have some baseline
  alerting (even just uptime), not just the one manual `/health` pinger.
- **Outreach** (not engineering, but a real weekly deliverable): one
  concrete post/thread in a Stellar/Soroban, x402, or AI-agent-builder
  community per week, pointing at `/underwrite` as the live demo. Zero real
  external users remains the single biggest gap that no amount of further
  engineering fixes.

**Explicitly still OUT** (per Part 3, unchanged): mainnet pilot, real LPs,
paid audit, legal/KYC-AML, zero-code/managed-wallet tiers, Python SDK.

---

## Part 8 — Build Station submission (SOURCE OF TRUTH for the 3-week program)

_This is the canonical version submitted to Build Station. Part 7 above is the
raw engineering backlog it draws from — if the two ever disagree, THIS wins for
anything submission-facing. Dates assume the program starts ~2026-07-05._

**System architecture:**
- `contracts/` — Soroban contracts: `score_registry`, `credit_line`,
  `lending_vault`, `revenue_math`.
- `backend/` — underwriting engine (TS/Fastify): indexer, independence, zktls,
  scoring, signer, API.
- `packages/` — `@trustline/agent-sdk`, the agent-facing SDK.
- `frontend/` — Next.js dashboards (borrower + lender) + landing.
- `spikes/` — validated de-risking spikes (x402 payer, Reclaim zkTLS).
- `docs/` — architecture, scoring methodology, sybil model.

**Tech stack:** Soroban (Rust) + Fastify (TS) + Next.js, composing with Nectar
Network (keeper revenue) and DeFindex (lender-vault yield) on Stellar testnet.

**Repo:** https://github.com/TechnicallyKiller/TrustLine/tree/main ·
**Landing:** https://0xtrustline.vercel.app/

### Milestone 1 — Week 1: V1 complete, tested, and demoed live on testnet (DONE)
The full protocol shipped end-to-end: the core loop (earn → prove → underwrite
→ borrow → repay → lender yield) on-chain via `score_registry`, `credit_line`,
and `lending_vault`; the credit-risk engine (default lifecycle, permissionless
`mark_default`, first-loss reserve, shares-based loss socialization, dynamic
APR, on-chain credit ramps — 17 unit tests + a 1,500-step randomized invariant
fuzz test + a live adversarial default run); the anti-Sybil independence model
(payer age · external diversity · funding-source independence · reciprocity ·
HHI concentration); a persistent Postgres payment-graph indexer; and zkTLS
off-chain revenue proofs (Reclaim-verified). Verified via `/demo` (honest agent
vs. fraudster) and `/underwrite`, and proven by our own agent Scout completing
the entire lifecycle autonomously from zero capital — scoring a real 775/Tier A
in production off a live zkTLS revenue proof.
_Expected completion: ~2026-07-05 (already complete)._

### Milestone 2 — Week 2: Agent onboarding SDK kit + ecosystem composability (Nectar + DeFindex)
Turn "only we can use it" into "any agent can." Publish `@trustline/agent-sdk`
to npm (currently monorepo-only), and ship an onboarding kit: a testnet funding
guide (XLM, USDC, trustline setup), a copy-pasteable
`register → underwrite → borrow → repay` walkthrough with real command output,
and a working simulation of a fully configured agent. Compose with two SCF-track
Stellar products to create a primitive none has alone: (1) **Nectar Network**
(flagship) — an AI agent runs as a Nectar keeper, earns real on-chain
liquidation profit, and TrustLine underwrites that genuine yield into a credit
line; (2) **DeFindex** (lighter second win) — TrustLine's idle lender-vault
capital earns yield via DeFindex while waiting to be lent out, raising lender
returns (keep a liquid buffer for instant draws; only route idle excess).
**Test:** a from-scratch external agent, built only from the published kit, gets
funded, earns as a Nectar keeper, and gets underwritten off that revenue.
_Scope note: SDK kit + Nectar are the must-ship core; DeFindex is the droppable
stretch if time runs short. Expected completion: ~2026-07-12._

### Milestone 3 — Week 3: Marketing, traction, and polish
Ship the onboarding kit publicly with full docs. Seed the network with
genuinely-operating agents — the Nectar keeper plus the already-built research
and code-review agents deployed as public, x402-payable services — so outside
wallets have real services to test the credit flow against, not just our own
demo agents. Push distribution into the communities where the users are
(Stellar/Soroban dev channels, the x402 protocol community, AI-agent-builder
circles), leading with the Scout and Nectar-keeper artifacts as concrete proof.
Polish the demo surfaces (`/underwrite`, `/lender`, landing) for a first-time
visitor. Honest framing: engineering is ahead of adoption today — so Week 3
splits into what we will definitively ship and the adoption we're driving toward.

**Committed deliverables (we will ship these — verifiable):**
- `@trustline/agent-sdk` published to npm with public install docs.
- Onboarding kit live: testnet funding guide + copy-pasteable
  `register → underwrite → borrow → repay` walkthrough with real output.
- ≥3 publicly-payable agents deployed and earning real x402 revenue on-chain
  (Nectar keeper + research + code-review).
- Nectar Network keeper integration working end-to-end.
- ≥3 distribution touchpoints launched in target communities.
- Backend `/health` uptime confirmed (no cold-start hangs).

**Traction targets (directional — driving toward, not pass/fail):**
- First external (non-team) agents onboarded and underwritten.
- First external agent completing the full loop (underwrite → borrow → repay).
- Growing live-underwrite volume through public `/underwrite`.
- First external npm installs of the SDK.

_Reality check (why the split): external-adoption metrics depend on strangers
showing up to a testnet product with no financial upside — the classic
cold-start problem, and the single hardest thing in the project, harder than any
code already shipped. Gating the milestone on committed deliverables (things we
control) keeps it honest; faking external usage is also self-defeating here
since our own anti-Sybil engine would flag it. Expected completion: ~2026-07-19._

### Ultimate end goal / vision
A production-grade, permissionless credit rail for the AI-agent economy: any
agent — anywhere, unaffiliated with TrustLine — can prove its real revenue
(on-chain x402 earnings, off-chain revenue via zkTLS, or both) and automatically
receive an uncollateralized USDC credit line, sized and priced by that proof,
that it draws against autonomously to pay for its own inputs (APIs, compute,
other agents) and repays as it earns. Human lenders supply the capital and earn
yield, isolated per-agent so one agent's default never touches another's vault.

TrustLine is designed to be composable with the broader Stellar DeFi ecosystem,
not a silo: an agent can earn verifiable revenue *as* a participant in that
ecosystem — for example running as a Nectar Network keeper capturing real
liquidation profit — and have that revenue underwritten into credit, while idle
lender capital stays productive earning yield through infrastructure like
DeFindex. Credit, revenue, and yield flow through the same on-chain rails.

The underlying bet: as the economy shifts toward agents transacting with agents
and services at machine speed, they need agent-native credit — collateral-free,
revenue-underwritten, instantly assessed — the on-chain equivalent of
revenue-based financing, settled in seconds instead of a bank's underwriting
cycle. Prove earnings → get trusted → get funded → repay → build a track record
that unlocks more credit next time. The long arc: TrustLine becomes the default
underwriting-and-credit layer any autonomous agent plugs into the moment it
starts earning.

### Integration decisions (from the SCF-product scan)
- **Nectar Network** — IN (Week 2 flagship): agent's revenue source; keeper
  profit is real on-chain USDC revenue to underwrite. Blocker: Nectar uses a
  MOCK USDC on testnet (`CD34YC6F…J4VBW`) vs TrustLine's standard testnet USDC
  (`CBIELTK6…DAMA`) — TrustLine's indexer just needs to ALSO watch Nectar's
  SAC for keeper payouts (config add, not a rebuild). Contracts: KeeperRegistry
  `CDT257SL…JDRB`, NectarVault `CDZR6VDC…7345`.
- **DeFindex** — IN (Week 2 second, droppable): lender-vault yield-on-idle;
  standardized yield infra, cleaner/easier than Nectar for the capital angle,
  active Palta Labs Discord support. Watch the liquidity-mismatch (keep a liquid
  buffer for instant draws).
- **Soroswap** — IN as plumbing only (utility, not a headline): the swap hop
  between Nectar's mock USDC and standard testnet USDC; Nectar already uses it.
- **Skip for now** (mainnet/real-money-era, or redundant): Blend v2 direct
  (already in Blend ecosystem free via Nectar; direct integration dilutes the
  uncollateralized thesis), Etherfuse (redundant yield), and ALL fiat
  ramps/bridges/anchors (AlfredPay, MoneyGram, Bridge, Abroad, BlindPay,
  Mercuryo, Anchor Platform, SDP, Allbridge, Axelar, CCTP, Near Intents,
  Sushiswap).

### Week 2 progress: SDK kit + faucet (this session, verified live)
The core of Milestone 2 is genuinely built and tested against the live
production backend, not just planned:
- **`@trustline/agent-sdk` is npm-publish-ready** — `publishConfig.access:
  "public"`, `repository`/`homepage`/`bugs` fields, `prepublishOnly` build
  hook added to `package.json`. **Not yet actually published** — that's a
  real, effectively-irreversible public action (can only unpublish within
  72h), deliberately left for an explicit go-ahead rather than done
  unilaterally.
- **A testnet USDC faucet is built and live-tested**: `backend/src/faucet.ts`
  + `POST /faucet` / `GET /faucet/status`, backed by a `faucet_claims` table
  (one drip per address, ever). Funded by a **brand-new, dedicated wallet**
  (`GCUVT3UH4JFHAK7APFHU655SY5QC4JQGRWH5NPGUC3RXCIBYH2NTB2UB`) — deliberately
  NOT any existing agent/customer wallet, since those are the ones already
  flagged circular/tainted in Scout's own independence analysis (see the
  funding-contamination-trap memory) — funding a new agent from our own
  cluster would instantly poison its independence score. Added to
  `X402_EXCLUDE_ADDRESSES`. XLM-funded and USDC-trustline-open on-chain;
  **still needs a human to actually send it testnet USDC** before it can
  drip (verified live: correctly returns `op_underfunded`, not a crash, when
  asked to drip with zero balance).
- **A real, runnable quickstart** (`packages/agent-sdk/examples/quickstart.mjs`)
  was written and actually executed against the live Render backend this
  session — generated a fresh keypair, Friendbot-funded it, registered, and
  underwrote for real. Correctly came back **400/Unrated/$0** for a
  zero-revenue agent (the honest answer, not a bug) — captured verbatim in
  `docs/onboarding-kit.md`.
- **`docs/onboarding-kit.md`** written: the funding guide (keypair → Friendbot
  → trustline → faucet) plus the real captured quickstart output plus what to
  do once the agent has actual revenue.
- **Caught and fixed a real bug in the process**: `backend/.env` had a
  corrupted line from an earlier session's append (`DATABASE_URL` and
  `STRIPE_TEST_KEY` smashed onto one line, no separating newline) — found and
  repaired while wiring the faucet secret in. Also hit, again, the documented
  WSL trap where command substitution silently returns empty when passed
  inline through `wsl -d ubuntu-24.04 -- bash -lc '...'` — worked around by
  writing an actual script file and running `bash script.sh` instead (per the
  existing memory note on this).

**Not done yet**: actual `npm publish` (needs your go-ahead + npm auth), the
faucet wallet still needs topping up, and the remaining onboarding-kit docs
sections (SDK API reference page, contract-address reference, roadmap page)
are still just the one `onboarding-kit.md` file, not a full docs site.

### Open gap: real public docs (GitBook-style), not yet built
Real content already exists but is scattered as loose internal markdown in
`docs/` (`architecture.md` — mostly a stub pointing at the README,
`credit-engine.md` — a genuinely detailed ground-truth writeup,
`scoring-methodology.md`, `sybil-model.md`, and now `onboarding-kit.md`) plus
this HANDOFF file itself. None of it is public-facing, organized, or
discoverable — there's no docs
site, no SDK reference, no roadmap page. This is a real blocker for the
external-agent-onboarding push (Part 8, Milestone 2/3): a builder with the
`@trustline/agent-sdk` kit still has nowhere to read *why* the protocol works
the way it does. Nectar Network's own docs (referenced this session) are the
concrete bar to match — clean nav, a "getting started by audience" table,
contract-address reference pages, quickstart guides per persona.

**Needed structure** (Docusaurus/GitBook/Mintlify — pick one, doesn't need to
be literal GitBook):
- **Getting started** — five-second mental model + a "what do you want to do"
  table by audience (agent builder / lender / integrator / curious), same
  pattern Nectar uses.
- **Architecture** — promote the real content already in `docs/architecture.md`
  and the README's diagrams; add the actual repo layout (`contracts/`,
  `backend/`, `packages/`, `frontend/`) and data flow end to end.
- **Protocol / how it works** — the credit loop, the risk engine (default
  lifecycle, reserve, credit ramps — lift from `docs/credit-engine.md`), the
  anti-Sybil independence model (lift from `docs/sybil-model.md`), zkTLS
  off-chain proofs.
- **Contract addresses** — a single reference page (current + superseded ids),
  mirroring what this HANDOFF's Part 1/6 already track manually.
- **SDK reference** — `@trustline/agent-sdk` API (register/onboard/underwrite/
  creditLine/vaultState/borrow/repay/deposit/payWithCredit), currently
  undocumented anywhere public; ties directly into the Week 2 onboarding-kit
  work.
- **Roadmap** — the Build Station 3-week milestones (Part 8) in public-facing
  form, plus the longer Part 3 track list, framed honestly (what's live on
  testnet vs. explicitly deferred until mainnet).
- **Error codes / glossary** — small but worth it once the SDK has real
  external users; another thing Nectar's docs do that ours don't yet.

Not started. Reasonable to fold into Part 8 Milestone 2 (SDK kit week) or
treat as a parallel Week 3 deliverable — it's largely a packaging/writing
task over content that already exists, not new engineering.

---

## Part 9 — DeFindex yield-on-idle: contract/backend/frontend DONE, deployment NOT (2026-07-14)

**What's actually built and tested (verified this session — 22/22 `lending_vault`
Rust tests pass, including these):**
- `contracts/lending_vault/src/lib.rs` — a full treasury leg: `set_treasury`
  (admin points idle liquidity at a DeFindex single-asset vault),
  `invest_idle` (sweeps un-invested idle liquidity into DeFindex via a minimal
  `DefindexVaultClient` `deposit`/`withdraw` cross-contract client),
  `harvest`/`divest_all` (redeems the full position, credits surplus to the
  lender yield pool, socializes a rare loss exactly like a default
  write-down), plus `ensure_physical` (auto-divests before `borrow`/`withdraw`
  so a realised loss is reflected before the liquidity check). Solvency
  identity extended to `token.balance(vault) + Σ Invested == Σ(liquidity +
  reserve + yield_pool)` and covered by its own fuzz test
  (`invariant_fuzz_holds_with_defindex_treasury_and_yield`) plus dedicated
  unit tests (`invest_idle_parks_liquidity_and_keeps_it_lendable`,
  `invest_idle_rejects_more_than_uninvested_liquidity`,
  `invest_idle_without_treasury_errors`, `harvest_credits_defindex_yield_to_lenders`).
- `backend/src/integrations/defindex.ts` — read-only `GET
  /integrations/defindex` status endpoint: live DeFindex vault TVL
  (`fetch_total_managed_funds` simulation) + APY (hosted API, optional key),
  with honest testnet-fragmentation framing (DeFindex/Blend settle in their
  own testnet USDC, no swap pool to TrustLine's main testnet USDC — this
  disappears on mainnet where everything is Circle USDC).
- `frontend/app/lender/page.tsx` — a `DefindexCard` that renders when the
  backend reports `configured: true`, showing net APY / vault TVL / the
  mainnet-compatibility note. Non-blocking (best-effort fetch, hidden if
  unconfigured).
- All of the above typechecks clean and the Rust side is fully green — this
  is real, working code, not a half-finished stub.

**What's NOT done (the actual gap, and why this got flagged for cleanup):**
- **No DeFindex vault was ever actually deployed+funded on testnet.**
  `contracts/_tmp_gettoken.sh` (mint DeFindex-flavor USDC to the deployer) and
  `contracts/_phase1_defindex_ids.txt` (scratch vault/treasury/usdc contract
  ids from an attempted deploy) were leftover, never-finished deployment
  scratch work — **deleted this session** (2026-07-14) since they were dead
  ends, not because the feature is broken.
  `backend/config.ts`'s `defindex.integratedVault`/`treasuryVault`/`usdc`
  defaults (`CBZ4IGN7…`, `CBMVK2JK…`, `CAQCFVLO…`) are UNVERIFIED placeholder
  ids from that same attempt — **do not assume they point at a real, funded,
  live contract.** `backend/.env` has no `DEFINDEX_*` overrides and
  `render.yaml` has no DeFindex vars at all, so the live Render backend's
  `/integrations/defindex` almost certainly returns `configured:false` or
  errors on read today.
- Nothing on `lending_vault`'s live testnet instance
  (`CAMF3BS23WXYMA6W6E55VSX577GIPSRKJXJKLL2G46TABUQ4GIRGHIL3`) has ever
  called `set_treasury` — the treasury leg exists in the contract code but
  has never been activated on the actual deployed instance.

**To finish this later:**
1. Actually deploy (or find) a funded DeFindex USDC vault on testnet, get its
   real vault/treasury contract ids (Palta Labs Discord was the support
   channel noted in Part 8's integration scan).
2. Get real, correct `DEFINDEX_INTEGRATED_VAULT`/`DEFINDEX_TREASURY_VAULT`/
   `DEFINDEX_USDC` ids into `backend/.env` (local) AND the Render dashboard
   (per the standing "Render doesn't auto-sync `render.yaml` literals"
   caution — Part 6 item #7).
3. Call `set_treasury` on the live `lending_vault` instance with the real
   DeFindex vault address.
4. Verify live: `GET /integrations/defindex` returns `configured:true` with a
   real non-null TVL/APY, and the `/lender` `DefindexCard` renders on the
   production frontend.
5. Decide on an off-chain rebalancer (who/what actually calls `invest_idle`/
   `harvest` on a schedule) — currently admin-gated, manual-only.

## Part 10 — Tael partnership integration: SHIPPED + LIVE, + testnet treasury (2026-07-17)

**Partner:** Tael (`github.com/rahulsainlll/tael-protocol`) — an x402/HTTP-402
payment layer where AI agents pay per-call for APIs/MCP tools, settled in USDC
on Stellar. Same rails as TrustLine (x402, Stellar, USDC, **same testnet USDC
issuer `GBBD47IF…`** — no fragmentation, unlike DeFindex). A read-only clone
lives at `/tael-protocol` (gitignored — a nested repo, NOT part of this repo;
do not commit it). Their repo is the source of truth for their side.

**The thesis:** Tael answers "how does an agent get paid." TrustLine adds "what
if it can't pay" (credit line) and "what can it do with what it earns"
(revenue-based underwriting). Docs: `TAEL_PARTNERSHIP.md` (strategy, honest
about gaps), `tael.md` (their protocol scraped), `TAEL_CODEBASE_SCAN_PROMPT.md`.

### What shipped on OUR side (TrustLine repo, all on `main`, pushed, LIVE on Render)

- **SDK `@trustline-agents/agent-sdk@0.2.0` — PUBLISHED to npm.** Fixes a real
  incompatibility discovered by reading both SDKs: `payWithCredit` used
  `@x402/stellar`'s scheme which builds a **Soroban-SAC** payment, but Tael's
  verifier only accepts a **classic `Operation.payment`** (its
  `requirements.asset` is `{code,issuer}`, not a contract address). Added
  `packages/agent-sdk/src/tael-pay.ts` (`isTaelChallenge` + `buildTaelPaymentTx`
  + `payTael`) and a branch in `payWithCredit` that detects Tael's classic-asset
  402 and pays it correctly, falling back to the generic scheme otherwise.
  Tests in `test/tael-pay.test.ts`. **TRAP fixed:** the first version probed with
  an unconditional extra `fetch` that double-hit every server and could corrupt
  a stream body — now only probes when the body is safely re-sendable (string/
  null/undefined). Verified live: SAC path (`plain.mjs`) AND Tael path
  (`tael-demo.mjs`) both settle real testnet payments.
- **`backend/src/integrations/tael.ts`** — indexes an agent's Tael revenue
  (memo-`tael`-filtered Horizon walk). Additive into `underwrite()` via the
  extracted `gatherScoredRevenue()`. NOTE: because Tael's USDC issuer == ours,
  Tael earnings are ALREADY counted by the main indexer — `TAEL_USDC_ISSUER` is
  a future-proofing knob (for if Tael ever uses a different issuer), NOT
  required today. Verified: a Tael-memo-earning wallet scores non-zero with it
  unset. `GET /agent/:address/tael-revenue`.
- **`/agent/:address/available-credit`** — the endpoint the Tael `credit`
  capability calls. Now runs `previewCredit()` (in `underwrite.ts`): a
  READ-ONLY live underwriting pass (index on-chain revenue + independence +
  repayments → score), **no zkTLS proof, no on-chain publish, nothing
  persisted**. Returns a real live number instead of a stale stored 0. Optional
  `x-tael-agent-sig` HMAC verification (`config.tael.partnerHmacSecret`, unset =
  open — the endpoint is public read-only data anyway). Verified live: ANALYST →
  tier C, $2.96 rev, 5 payers.
- **`backend/src/treasury.ts` — the testnet lender-of-first-resort.** THE key
  insight of this session: a credit line is only *permission* to borrow; the
  USDC must come from a **lender who deposited into the agent's isolated vault**.
  No organic lenders exist on testnet, so the treasury bootstraps it:
  `POST /agent/:address/ensure-liquidity {neededUsdc}` tops up a vault by the
  exact shortfall (capped by per-vault limit + available credit + treasury
  balance). `GET /treasury` for status. Gated on `TREASURY_SECRET` (unset =
  inert). Deposits lender→vault (earns yield, never *pays* the agent, so no
  anti-Sybil contamination). Verified live end-to-end on production:
  treasury seeded ANALYST's vault (`tx a110da7e`) → agent borrowed (`tx 0749b962`).

### What shipped on THEIR side (merged into `rahulsainlll/tael-protocol` main)

- **PR #51** (via fork `TechnicallyKiller/tael-protocol`): the credit-draw
  fallback in `run-capability.ts` (opt-in via `TRUSTLINE_API` env +
  per-agent `policy.allowCreditDraw` toggle — both off by default), the
  `credit` capability kind (enum + migration + marketplace + wizard), and
  `SpendingPolicy.allowCreditDraw`. Docs `TRUSTLINE_INTEGRATION.md` +
  `TRUSTLINE_FOR_TAEL.md` are in their repo.
- **They then shipped, unprompted:** `{payer}` URL substitution (#68) +
  `x-tael-agent`/`x-tael-agent-sig` HMAC header forwarding (#67) + credit-kind
  wizard tile (#66) — from our `TRUSTLINE_PAYER_TEMPLATING.md` ask.

### LIVE production state (verified 2026-07-17)

- Backend URL is now **`https://trustline-rpxt.onrender.com`** (old
  `trustline.onrender.com` is dead/suspended — all ~26 files updated). Render
  deploys from `main`; a push auto-redeploys (~2 min).
- **Treasury is LIVE + funded:** `TREASURY_SECRET` on Render = SCOUT_LENDER
  (`GAEXGDYL…`, ~20 USDC). `GET /treasury` → `configured:true`. (The dedicated
  `GDXLI7XG…` wallet I generated mid-session was abandoned in favor of
  SCOUT_LENDER; its USDC was swept back and its secret file deleted.)
- The `credit` capability is publishable on Tael's marketplace with:
  name `trustline-credit`, kind `credit`, GET,
  upstream `https://trustline-rpxt.onrender.com/agent/{payer}/available-credit`
  (literal `{payer}` — their gateway substitutes the caller), blank path/secret,
  price `$0.10`, payTo = a TrustLine wallet.

### Traps / hard-won learnings this session (do NOT relearn these)

1. **Credit ≠ liquidity.** An underwritten agent with an empty vault borrows
   NOTHING (`InsufficientLiquidity` = vault error #2). Every "why won't it
   borrow" dead-end traces to: no lender deposited into that vault. The
   treasury exists solely to fix this on testnet.
2. **Preview limit ≠ on-chain limit.** `/available-credit` (previewCredit)
   shows the *live-computed* limit; the vault enforces the *last PUBLISHED*
   limit. They diverge until you re-run `underwrite()` (which publishes on
   chain). ANALYST looked "maxed out" only because its published limit was a
   stale $0.08; re-underwriting published the real $0.44 and freed room.
3. **Cards ≠ wallets.** The credit-draw fallback lives ONLY in the wallet
   "Run" flow (`run-capability.ts`), NOT the Card path (`key.service.ts`
   `payForCall`, which has no credit logic and a misleading "no balance" error
   that never reads the balance). Flagged to Tael in
   `tael-protocol/TRUSTLINE_CARD_NOTES.md`. We deliberately did NOT extend
   credit to Cards (Cards are a spending instrument; credit belongs to the
   earning agent).
4. **`payWithCredit` was deliberately NOT wired to auto-call the treasury** —
   the treasury secret must stay server-side (never in the client SDK), and
   auto-funding every borrow would be an invisible treasury drain. Top-up is a
   deliberate server-side lever (`/ensure-liquidity`), separate from the borrow.

### The genuinely UNSOLVED thing (business, not code)

Everything above proves the *mechanism* works — but on testnet it's **TrustLine
lending its own money to make its own demo function.** The real mainnet
question — *who are the independent lenders, and why would they risk capital on
agent defaults for the interest yield* — is untouched. That's the demand-side
problem to solve before mainnet; the code is ready, the liquidity market is not.

### If Tael or a new session picks this up

- Publish the `credit` capability (values above) — endpoint returns real data now.
- Tael's remaining ops steps (their side): set `TRUSTLINE_API`, apply the
  credit-kind migration to prod DB, add the `allowCreditDraw` toggle to their
  agent-settings UI (code reads it; nothing sets it yet).
- `TREASURY_MAX_PER_VAULT_USDC` (default 10) + the treasury wallet's balance are
  the only spend guards — there is NO cross-vault exposure ledger (deferred as a
  mainnet concern). Keep the treasury wallet funded only to accepted exposure.

## Part 11 — Autonomous agent demo, credit book, site polish, product audit + Tier-1 hardening (2026-07-24)

**A new session: start here, then jump to the Tier-2 plan at the bottom of this Part.**

### Live URLs (all verified this session)
- Frontend: **https://www.0xtrustline.online** (Vercel, auto-deploys `main`). Canonical is `www`.
- Backend (underwriting API): **https://trustline-rpxt.onrender.com** — `trustline.onrender.com` is **SUSPENDED**, do not use it.
- Agent server (demo LLM loop): **https://trustline-1.onrender.com**
- Data seller (x402 endpoint the demo agent buys from): **https://trustline-data-seller.onrender.com**
- Docs: **https://docs.0xtrustline.online** (Mintlify — real, substantive). The internal Next `/docs` tree was DELETED this session (dead/unreachable); `/docs` 307-redirects to Mintlify. Canonical doc source is top-level `docs/*.md`.
- Product X handle: **@0xtrustline** (personal is @divyanshh_kalra). Contact: divyanshhkalra1234@gmail.com.

### What SHIPPED this session (all on `main`, pushed, live)

**1. Autonomous agent demo (`/agent-demo`) — the flagship "wow".**
A real LLM (free Groq default, with fallback chain) drives a tool-loop that, live on testnet: checks credit → draws credit for a shortfall → buys a paid x402 data call → delivers research → gets paid → repays. Every money-move is a real tx with a Stellar Expert link.
- `agents/shared/agent-brain.mjs` — model-agnostic tool-calling loop. **LLM fallback chain: Groq big → Groq small (`llama-3.1-8b-instant`) → Gemini** (all OpenAI-compatible). Swap via `LLM_BASE_URL`/`LLM_API_KEY`/`LLM_MODEL`. **KNOWN RISK: free Groq + Gemini daily quotas can BOTH exhaust after heavy testing → the demo's TEXT 429s (tx still work).** Let quotas reset or add a paid key before a pitch.
- `agents/demo/agent-runtime.mjs` — the 4 tools wired to the SDK (check_credit / buy_premium_data / deliver_and_get_paid / repay). Demo agent = the **ANALYST wallet** (has real revenue → Tier C, ~$0.44 limit). Its spare cash is swept to a HOLDING wallet (`agents/.demo-holding-wallet.local`, gitignored) so it's cash-poor and MUST draw credit. The holding wallet doubles as the "customer" that pays the agent (the one staged part — labeled honestly; the credit/borrow/repay/default are 100% real).
- `agents/demo/agent-server.mjs` — SSE bridge (`POST /run`, `GET /info`, `POST /drain`, `GET /deadbeat`, `POST /default`). Binds `$PORT`.
- `agents/demo/data-seller.mjs` — $0.30 x402 seller (real `@x402/express`). **Now has CORS** (added this session).
- `frontend/app/agent-demo/page.tsx` — chat UI + **operator controls**: a "drain agent cash" button (sweep to force a credit draw next run) and a **default scenario** panel.
- **Default scenario (the "what if they don't pay?" answer, proven live):** `agents/demo/default-scenario.mjs` + `stage-default.mjs`. A dedicated DEADBEAT wallet (`agents/.deadbeat-wallet.local`, gitignored) is staged with real revenue from 3 independent payers, underwritten, and borrows to start the 5-min due clock. After ~5 min, `POST /default` fires the REAL on-chain `mark_default`. **The deadbeat is ONE-SHOT** (once defaulted it's frozen) — to re-run, stage a fresh deadbeat. Loan term is `term_secs = 300` (5 min) on the deployed vault.
- Run/deploy guides: `agents/demo/AGENT_DEMO.md`, `agents/demo/DEPLOY.md`.

**2. Live credit-book dashboard (`/portfolio`).**
`backend/src/portfolio.ts` + `GET /portfolio`: reads every underwritten agent's on-chain vault `state()` and aggregates — total outstanding, utilization, default rate, realized loss, reserve coverage, weighted-avg APR, lender yield, per-agent positions. `frontend/app/portfolio/page.tsx` renders it (stat tiles + positions table + lender-pool teaser). Read-only. **This is the "it's a credit business, not a demo" proof.** Real numbers as of this session: 15 agents, 3 active loans, 1 default (6.67%), $0.10 realized loss, ~13% avg APR.

**3. SDK 0.2.1 published to npm** — `borrow()` now auto-seeds the vault via the treasury (`ensureLiquidity`). **This was the fix for Tael's "borrow doesn't work"** — the published 0.2.0 lacked it, so Tael borrowed against an empty vault → InsufficientLiquidity. 0.2.1 verified working via the exact published package. **Tael still needs to: reinstall `@latest`, and set `USDC_ISSUER=GBBD47IF…` in their dashboard env** (their buy-side default `GBCDXWBE…` is a DIFFERENT USDC than everything else uses). The `GC62IXD4…` address Tael mentioned is a FEE wallet, not a USDC issuer.

**4. Tael repay PR** — `feat/trustline-repay` on the fork → **PR #137** to `rahulsainlll/tael-protocol`: adds `maybeRepayTrustLineCredit` in `run-capability.ts` (opportunistic repay from spare cash after a successful call). Closes the loop (borrow existed, repay didn't). Docs: `TAEL_SPEC_VS_REALITY.md`, `TAEL_REPAY_SKETCH.md`.

**5. Site polish:**
- `/status` — server-side health page via same-origin `/api/status` (Next route handler pings services server-side). **CRITICAL FIX: privacy browsers (Brave Shields) block direct cross-origin `*.onrender.com` pings from the browser → false "down". The `/api/status` proxy fixes it for every browser.** Don't revert to browser-side pinging.
- Global footer (`components/tl/TLFooter.tsx`, in `layout.tsx`) — brand, live status pill, links, `npx @trustline-agents/skill`, @0xtrustline, contact. Removed old blue `SiteFooter` from the 2 pages that had it.
- `/brand` — brand kit (palette/type/one-liners).
- **Mobile nav** — `TLNav` got a hamburger + full-screen menu (was completely hidden on phones before).
- MIT `LICENSE` added at repo root (open-source claim is now true).

**6. Pitch materials (prompts, not built decks):** `PITCH_DECK_PROMPT.md` (pitch + GTM, real sourced market stats: 69k agents / 165M tx / ~$50M x402 vol by Apr 2026 — Coinbase; x402 Foundation w/ Visa/MC/Stripe; EIP-8004 for differentiation), `ROADMAP_DIAGRAM_PROMPT.md`, `LENDER_POOL_DESIGN.md`.

**7. Mainnet XLM deploy form** — measured real Soroban deploy cost on testnet: Score Registry 0.43 / Credit Line 0.35 / Lending Vault 3.44 XLM = **4.22 real; asked for 6 (buffered)**. Freighter mainnet address on file: `GADUJHCLCDXVCBQZYQMLB66WO7AL3PNAO65JSKF3FKO4ER6XUE2IJDNW`.

### Tier-1 hardening DONE this session (from the product audit)
- Mobile nav (was unusable on phones). `/coming-soon` + `/preview` (stale blue-theme) redirect to `/`. Deleted the dead internal `/docs` tree (~2.3k lines).
- **signer bug FIXED:** `submitScore`/`recordRepayment` now send-AND-confirm (poll to SUCCESS) instead of returning `submitted:true` right after send — they were reporting success for txs that could fail at consensus.
- **Security:** removed the committed `RECLAIM_APP_SECRET` literal (env-only now); ephemeral-signer fallback is opt-in (`ALLOW_EPHEMERAL_SIGNER=true`) and throws otherwise. zkTLS still fails-gracefully when the secret's unset (try/catch in underwrite), so no prod breakage — but if you want zkTLS live on Render, set `RECLAIM_APP_SECRET` there.

### THE PRODUCT AUDIT (3 parallel agents, this session) — what a reviewer will hit

**Genuinely strong (lead with these, don't touch):** fuzzed solvency invariants on the vault; O(1) socialized-loss via share repricing; per-agent isolation; the **anti-Sybil independence engine + adversarial catalog** (6 named attacks pass, and it HONESTLY documents the one gap A7b — reviewers respect that); ERC-4626 inflation attack is closed; three real revenue rails (x402/Tael/zkTLS); `payWithCredit` is senior-level; the spectator demo path (landing → underwrite → duel → agent-demo) is best-in-class and pitch-ready TODAY.

### >>> TIER 2 — START HERE (new session). Days, not weeks. Ranked by impact. <<<

Full findings are in the audit; these are the confirmed high-value items. NONE are new features — all are hardening the real thing.

**P0 correctness/trust:**
1. **Anti-Sybil window bug (the moat runs weaker than claimed).** In the NO-DB path, `analyzeIndependence` gets `windowFromLedger = 0` (`backend/src/underwrite.ts:178`), so `gatherPayerFacts` (`independence.ts:~508`) does RPC `getEvents` from ledger 0 → RPC clamps to ~24h retention → the funding/out-degree graph only covers ~24h even for full-history revenue. The DB path (`gatherPayerFactsFromGraph`) is correct. FIX: pass the real revenue window, OR make in-memory mode refuse to claim independence rather than under-compute it. **This is the thing a technical judge probes.**
2. **`DIVERSITY_FULL=1`** (`independence.ts:~36`) saturates diversity at a single external counterparty on testnet — the moat is tuned near its weakest defensible setting. Consider raising for a real-scrutiny demo.

**P1 product-readiness (turns demo → company):**
3. **Lender "YOUR POSITIONS" read-back** — `frontend/app/lender/page.tsx:111,189` is hardcoded `"—"`; a lender can't see what they own after depositing. Read their vault shares on-chain. **Biggest functional hole.**
4. **API auth + rate-limiting** — `POST /underwrite`, `/repayment`, `/ensure-liquidity` are OPEN (only `/available-credit` has the Tael HMAC guard). Add `@fastify/rate-limit` + an API-key/bearer guard (reuse the `verifyTaelSignature` pattern in `server.ts`). Trivial DoS/cost-amplification today.
5. **Borrower onboarding stepper** — `frontend/app/borrower/page.tsx:574` buries "Register on-chain (first time)" as a ghost link; new users click Draw → contract error. Add a register→underwrite→draw stepper, gate Draw behind registration.
6. **Contract upgrade path** — no `upgrade()` on any contract holding lender USDC (#1 "production-ready" red flag). Add `env.deployer().update_current_contract_wasm` + admin rotation on the vault, OR explicitly declare immutability with a `version()` view and lean on the isolation/pause story.
7. **Paginate `/agents` + `/portfolio`** — currently O(n) RPC per request (a vault `state()` per agent in a loop). Won't scale past demo; cache the reads.

**P1 correctness (backend):**
8. **Untested score math** — `computeScoreResult` (`backend/src/scoring/index.ts`) has ZERO tests (tier bands, ramp, default collapse, counterparty gating). Wire a backend `test` script; add unit tests. This is the money math.

**P2 differentiators (the "best, not just solid" moves):**
9. **Contract admin/treasury events** (pause/unpause/cap/treasury/invest/harvest emit nothing) + **genuine-auth negative tests** (prove an attacker can't borrow as another agent / drain another lender — most tests use `mock_all_auths`).
10. **SDK polish:** `underwrite()`/`onboard()` return `any` (mirror the backend `ScoreResult`/`UnderwritingResult` types); add `repayAll()` (reads `amountOwedUsdc` then repays) and `previewCredit()` wrappers; no portfolio/agents reads.
11. **Instance-TTL bumping** on contracts (no `instance().extend_ttl` anywhere → config keys can expire and brick the contract on low traffic). One-liner per entrypoint.
12. **Portable credit attestation** — the 10x "we're the credit BUREAU" move. `publish_score` is on-chain already; expose a signed, portable tier/score proof other protocols read (EIP-8004 validates the demand). Highest ceiling.
13. **Close A7b** — raise `DIVERSITY_FULL` + add a minimum-external-volume / global-graph signal so the documented non-reciprocal collusion-ring gap closes; extend the adversarial catalog.

### Traps / hard-won learnings this session (do NOT relearn)
- **`trustline.onrender.com` is SUSPENDED.** Live backend is `trustline-rpxt.onrender.com`. `agents/.env` had the dead one — fixed. Check `NEXT_PUBLIC_API_BASE_URL` everywhere.
- **Brave Shields blocks browser→onrender cross-origin pings** → false "down" on a naive status page. Always check service health SERVER-side (`/api/status`), never client-side cross-origin.
- **Render free tier sleeps (~15min idle, 30-50s cold start).** A keep-warm pinger (cron-job.org, every 10 min, hitting the 3 service health URLs) is set up — keep it. Ping services ~1 min before any live demo regardless.
- **npm publish is immutable** — the published 0.2.0 was a stale build; had to bump to 0.2.1. When you fix the SDK, ALWAYS bump the version and republish (needs OTP; user does it).
- **Two USDC issuers exist in Tael's code** (`GBBD47IF` = correct/shared; `GBCDXWBE` = their buy-side default = wrong). Same code, different issuer = different token. Align everything to `GBBD47IF` on testnet.
- **The deadbeat default agent is one-shot** — stage a fresh one to re-demo default.
- **LLM quotas (Groq/Gemini free) exhaust** — plan around it for pitch day.
- Local wallet key files are gitignored (`*.local`): `agents/.demo-holding-wallet.local`, `agents/.deadbeat-wallet.local`. Don't commit them; don't lose them.

## Part 12 — MAINNET DEPLOY + PRODUCT RENAME TO "FIANZA" (2026-07-25)

**READ THIS FIRST if you're picking up mid-rename.** Two big things happened this session: (1) all 3 contracts deployed to Stellar MAINNET for real, (2) the product is being renamed **TrustLine → Fianza** because a different, already-SCF-44-funded project is *also* called "Trustline" (institutional security/insurance tooling, `communityfund.stellar.org/project/trustline-23z`, $133.6K awarded) — same category, same program, too close a collision to submit under the same name.

### Mainnet deploy — DONE, verified live
Real Soroban resource fees on mainnet are **~20x testnet's subsidized fees** — don't reuse testnet cost estimates for mainnet ever again. Real measured costs: Score Registry 26.44 XLM, Credit Line 20.15 XLM, Lending Vault 55.72 XLM (~102 XLM total, not the ~6 XLM testnet estimate).

Deployed contracts (mainnet, verified with real on-chain reads/writes):
- `score_registry`: `CAHWYFLMQI6BBOL6ZLZRRINCK6KVBX73ACH7LCPB24WDED4LSMCI7YZC`
- `credit_line`: `CDK7S4UWY227FHFKDSV37DGT7AIJ5Z2QEYO5AY456M7RBGJN25WYJVGC`
- `lending_vault`: `CAE5C5UJYVED5DAVY4YKYT6E2C4NBZCIUBAK2MXGKGLKZESBBXKFPZ4U`

Config: mainnet USDC SAC `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75` (derived via `stellar contract id asset` from Circle's real issuer `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN` — never trust a contract address off a random webpage, derive it). 30-day loan term, $100/vault deposit cap. Admin = deployer wallet `GADUJHCLCDXVCBQZYQMLB66WO7AL3PNAO65JSKF3FKO4ER6XUE2IJDNW`. Dedicated mainnet signer (separate from deployer, funded with 5 XLM): `GDVJ3W2SMINZ7MDPJ2VUKPD4F2AJXRXJPUPARFUD7RRCWL2ND6FCO32P` — its secret lives ONLY in the user's local `~/.config/stellar/identity/mainnet-signer.toml`, not in this repo.

**Verified live end-to-end on mainnet** (read-only test, no real revenue needed): registered the deployer wallet as an agent, published a test score (560/tier C) signed by the dedicated signer, confirmed `credit_line.terms()` correctly derives `apr_bps:1200, limit:0.15 USDC` (15% cold-start ramp) cross-contract from the registry, confirmed the vault's `available_credit()` matches. **Contract wiring is proven correct on mainnet.** No real borrow/repay/default tested yet (needs a lender to deposit real USDC first — deliberately not done, real money).

**Traps hit deploying to mainnet:**
- The default `mainnet` network alias in the Stellar CLI is a placeholder ("Bring Your Own RPC") — you MUST `stellar network add mainnet --rpc-url <real-provider> --network-passphrase "Public Global Stellar Network ; September 2015"` first. Testnet's free public RPC has no mainnet equivalent from SDF.
- Tried 3 free public mainnet RPCs: `mainnet.sorobanrpc.com` worked for the first deploy then started timing out; `rpc.ankr.com/stellar_soroban` and `soroban-rpc.mainnet.stellar.gateway.fm` also flaked intermittently (`transaction submission timeout` / `TxInsufficientFee`) — these are free-tier and NOT reliable for a string of deploys. Retrying (sometimes with `--inclusion-fee 1000000` to beat a stale fee estimate) got everything through eventually. Always re-check balance+sequence via Horizon before retrying to confirm nothing double-spent.
- On-chain contract state stores NO product name/branding string anywhere (checked) — the rename does not require touching or redeploying any contract.
- Swapped 5 XLM → USDC via `stellar tx new path-payment-strict-send` (real DEX trade, ~$0.177/XLM, confirmed via Horizon order book first). Real trustline via `stellar tx new change-trust --line "USDC:GA5ZSEJY..."` first.

The user's remaining mainnet balance after all of this: ~15-25 XLM + ~0.88 USDC on `GADUJHCL...` (check live, don't trust this number as current).

### The rename — IN PROGRESS, here's the exact state

**Ground rule from the user, followed strictly:** do NOT change backend HTTP routes/URLs, do NOT touch `TRUSTLINE_API`-style env var names or the `trustline-rpxt.onrender.com` hostname anywhere — Tael and possibly other integrations depend on the CURRENT backend as-is. Domain/GitHub-repo-rename/Render-service-renames are explicitly DEFERRED to the user, doing them later. Only rename what's safe without touching live infra or breaking an existing integration.

**Critical fact about the SDKs:** `@trustline-agents/agent-sdk` (npm) and `trustline-agent-sdk` (PyPI) are PUBLISHED and Tael's `run-capability.ts` imports the npm one directly. npm/PyPI packages are immutable/can't be renamed or deleted. Decision made (confirmed with user): **the old packages stay published and untouched forever** (Tael's import never breaks, zero action needed from them) — new work goes into freshly-created `@fianza/*` (npm) and `fianza-agent-sdk` (PyPI) packages, published ALONGSIDE the old ones, not replacing them.

**Full audit of every "trustline" occurrence in the repo was run** (a subagent, read-only) — the key finding: a lot of "trustline" hits are the GENERIC STELLAR SEP TERM (an account's asset trustline), NOT the brand — these live in `backend/src/faucet.ts`, various `_seed_*.mjs`/`_make_lender.mjs` scripts, `frontend/lib/stellar.ts`, both SDKs' own docs (things like "Opening a USDC trustline..."), and the entire vendored `tael-protocol/` tree. **DO NOT rename these** — doing so breaks correct Stellar terminology, not the brand. Every rename step in this session double-checked this distinction before touching a file; a new session must too.

**DONE (this session, all verified working — typechecked/tested/built, nothing broken):**
1. `packages/agent-sdk-fianza/` — NEW directory, copy of `agent-sdk` with `TrustLineAgent→FianzaAgent`, `TrustLineError→FianzaError`, `TrustLineContracts→FianzaContracts`, `TrustLineOptions→FianzaOptions` renamed throughout src/test/examples/README. `package.json` name `@fianza/agent-sdk`, version reset to `0.1.0` (fresh lineage, not continuing 0.2.1). 17/17 tests pass, typecheck clean, `npm run build` clean. **NOT published yet** — needs `npm publish` with the user's OTP (same flow as the original 0.2.1 publish earlier this session).
2. `packages/skill-installer-fianza/` — NEW directory, copy of `skill-installer`. `package.json` name `@fianza/skill`, bin renamed `fianza-skill`, `SKILL_NAME` constant in `bin/install.mjs` changed to `fianza-agent-sdk`. Verified end-to-end with a fake `$HOME` — installs to `~/.claude/skills/fianza-agent-sdk/` correctly, prints the right messages. **NOT published yet.**
3. `.claude/skills/fianza-agent-sdk/` — NEW directory (copy of `.claude/skills/trustline-agent-sdk/`), `SKILL.md` frontmatter `name: fianza-agent-sdk`, all code-identifier/package-name references renamed, but the `trustline-rpxt.onrender.com` URL and generic "USDC trustline" prose LEFT UNCHANGED on purpose (see ground rule above). This copy is synced byte-identical into `packages/skill-installer-fianza/skill/SKILL.md` — if you edit one, `cp` it into the other (see that package's README "Maintainers" section).
4. `packages/agent-sdk-py-fianza/` — NEW directory, copy of `agent-sdk-py`. **Import package directory itself renamed** `src/trustline/` → `src/fianza/` (this is the Python import name, i.e. `from fianza import FianzaAgent`, not just a string). `pyproject.toml`: name `fianza-agent-sdk`, version reset to `0.1.0`, **`packages = ["src/fianza"]`** (this line MUST match the renamed dir or the published wheel is broken — caught and fixed this exact bug once already, double-check it if you touch this file again). `TrustLineAgent→FianzaAgent`, `TrustLineError→FianzaError` throughout. Verified: installed `stellar-sdk`+`requests`+`pytest` into an isolated `pip install --target=<scratch-dir>` (this sandbox has no venv/`python3-venv`, is an "externally-managed-environment" — do NOT use `--break-system-packages` without asking the user first; the `--target` scratch-dir trick avoids needing it), then `PYTHONPATH=<scratch>:src python3 -m pytest tests/` → **20/20 pass**. Real backend URL (`trustline-rpxt.onrender.com`) and `TRUSTLINE_API` env var name both deliberately left unchanged in `examples/quickstart.py` and `README.md`.

**Phase 2 — DONE (this session, second pass).** User-facing copy rename completed across:
- `docs/*.md` (all 9 files) and `mintlify-docs/*.mdx` + `docs.json` + both `logo/*.svg` wordmarks (text only, shape/viewBox untouched — user said not to touch the logo art).
- root `README.md`, `LICENSE` (copyright line), `PROJECT_LOG.md`.
- All of `frontend/`: every `app/**/page.tsx`, `app/layout.tsx` (page title/meta), `components/Navbar.tsx`/`SiteFooter.tsx`/`SiteHeader.tsx`/`tailwind.config.ts`/`lib/api.ts`/`lib/stellar.ts`, `components/tl/TLNav.tsx`/`TLFooter.tsx`/`TLWalletButton.tsx`. `components/TrustLineMark.tsx` → renamed to `components/FianzaMark.tsx` (git mv), import fixed in `BrandMark.tsx` — the logo PNG (`/public/logo6.png`) and the SVG shape/path data inside `FianzaMark.tsx` were deliberately left untouched, only text/identifiers changed. `app/brand/page.tsx` copy updated (name/description text only, no new palette/visual identity invented). **Verified: `npx tsc --noEmit` clean, `npm run build` succeeds, all 16 routes compile.**
- `.claude-plugin/marketplace.json` + `plugin.json` — these are LIVE plugin-install config (not just domain references), so handled like the npm/PyPI packages: `marketplace.json` now lists BOTH a new `fianza-agent-sdk` plugin entry and the old `trustline-agent-sdk` entry (kept for existing installs, marked legacy in its description), both pointing at `source: "."`. The marketplace's own `name` field stayed `trustline` (renaming it would break anyone who already ran `/plugin marketplace add .../TrustLine` — same "don't break existing integrations" rule as the npm packages). `plugin.json`'s single-manifest `name`/`displayName` updated to `fianza-agent-sdk`/"Fianza Agent SDK" since its `skills` field exposes the whole `.claude/skills/` dir (both the fianza and trustline skill copies), so one manifest serves both. Fixed a stray invented `@fianza`-suffix install command in `packages/skill-installer-fianza/README.md` back to the real `@trustline` marketplace suffix.
- `tael.md`, `teal.md` (Tael-codebase analysis notes — only OUR brand mentions renamed, Tael's own naming/code untouched), `trustline-partnership.html` + `tael_partnernship.html` (two standalone partnership-brief mockups, full brand-text rename, "Tael" and all CSS/colors untouched).
- Re-verified `packages/agent-sdk-fianza` tests: still 17/17 pass after all the above.

**Explicitly NOT renamed, per direct user instruction mid-session ("no need to change such mds now")** — left exactly as they were before this rename effort touched them: `TAEL_GOLIVE_CHECKLIST.md`, `TAEL_PARTNERSHIP.md`, `TAEL_REPAY_SKETCH.md`, `TAEL_SPEC_VS_REALITY.md` (all reverted via `git checkout` back to their committed state after a couple were briefly edited — confirm with `git diff` before assuming otherwise). These are heavy prose/spec docs about the Tael integration, low priority vs. shipped product surfaces.

**Already renamed before that instruction landed (left as-is, not reverted):** `PITCH_DECK_PROMPT.md`, `ROADMAP_DIAGRAM_PROMPT.md`, `MAINNET_POST_DESIGN_PROMPT.md`, `TAEL_CODEBASE_SCAN_PROMPT.md`, `TAEL_LOAN_SPEC_ASSESSMENT.md`, `LENDER_POOL_DESIGN.md` — these are one-off generation prompts, prose-only brand swaps, no code identifiers at risk.

**Phase 4 — DONE.** All 3 packages published and verified live on their registries:
- npm `@fianza/agent-sdk@0.1.0` and `@fianza/skill@1.0.0`. Note the scope is `@fianza`, NOT `@fianza-agents` — the user created the npm org as `fianza` (not `fianza-agents`), so every reference across the repo (both packages' `package.json` name/bin fields, `package-lock.json`, README.md, HANDOFF.md, docs/*.md, mintlify-docs/*.mdx) was corrected from `@fianza-agents/*` to `@fianza/*` before publish — grep for `@fianza-agents` if you ever see it again, that scope doesn't exist.
- PyPI `fianza-agent-sdk@0.1.0`. Built via `python3 -m build` (works fine despite this sandbox's PEP-668 "externally-managed-environment" restriction, since `build` creates its own isolated venv internally — no `--break-system-packages` needed). Verified the wheel contains the `fianza/` import package (not the old broken `trustline/` path). Uploaded via `twine` installed into an isolated `pip install --target=<scratch dir>` (same trick as the earlier test-install, avoids touching system Python).
- **Deferred, explicitly NOT this session's job:** domain purchase/DNS, GitHub repo rename (`TechnicallyKiller/TrustLine` — GitHub rename auto-redirects, is genuinely low-risk whenever the user wants to do it, but wait for their go-ahead), Render service renames (would change `*.onrender.com` hostnames that are hardcoded as defaults in ~15 files — do NOT touch until the user says so, this is exactly the kind of thing that silently breaks Tael).
- `trustline-ui/` — a brand-new, untracked Claude-Design HTML/CSS/JS handoff bundle (design mockups, not yet reviewed/implemented) — deliberately left alone, it's raw design source the user hasn't acted on yet, not a rename target.
- The rename work is on a git branch, `rename/fianza` — not merged to `main`, not pushed. Check `git status`/`git log` to see exactly what's committed vs. still working-tree-only before continuing.
