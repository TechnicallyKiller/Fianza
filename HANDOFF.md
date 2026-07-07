# TrustLine — Reality & Handoff (READ THIS FIRST)

_Last updated: 2026-07-04. If you're a new session, read this whole file before
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
   on `https://trustline.onrender.com/health` from earlier tonight; confirm
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
