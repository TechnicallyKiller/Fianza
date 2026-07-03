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
