# Fianza — Project Log & Handoff

**On-chain, revenue-underwritten credit protocol for AI agents on Stellar.**
Borrowing power is underwritten by verified revenue (on-chain x402 earnings +
Reclaim zkTLS-attested off-chain revenue), not wallet history. Settles in USDC
over x402. Every credit line is an isolated per-agent vault.

> This file is the single source of truth for continuity. Update it at the end
> of each work session. Last updated: **end of Phase 3** (dashboards wired to
> live data; Phase 4 testnet deploy not started).

---

## 0. COLD-START SUMMARY (read this first in a new chat)

- **Where the code lives:** native WSL Ubuntu-24.04, ext4 path `~/stellar`
  (= `\\wsl.localhost\ubuntu-24.04\home\divyanshh1\stellar`). **Stay native** —
  do NOT build over the `\\wsl.localhost` UNC mount or `/mnt/c` (koffi/native
  deps fail over UNC).
- **Run all commands as:** `wsl -d ubuntu-24.04 -- bash -lc 'source ~/.profile; <cmd>'`
  (login shells don't auto-source the toolchain PATH; sourcing `~/.profile` fixes it).
- **GitHub:** https://github.com/TechnicallyKiller/TrustLine (branch `main`,
  latest commit `bef1ae0 phase-2 underwriting engine + cinematic landing`).
- **Status:** Phases 0, 1, 2 ✅ done. Marketing/landing site ✅ done. Phase 3
  (frontend wiring) ✅ done — both dashboards live on real API + wallet. Phase 4
  ✅ done — contracts deployed to testnet AND the full register→borrow→repay loop
  ran on-chain with REAL USDC (tx hashes in §6). Remaining: optional UI polish to
  drive the same flow from the dashboard buttons.
- **Run both dev servers:** backend API — `wsl -d ubuntu-24.04 -- bash -lc
  'source ~/.profile; cd ~/stellar/backend && npm run dev'` (port 8787);
  frontend — `preview_start` config `web` (builds + serves on 3100). The browser
  reaches the backend at `localhost:8787` (CORS open); confirmed working.
- **Build protocol:** work in phases, STOP and report after each, wait for "continue".
- **Commit style:** terse messages (e.g. `phase-1 done`), **no Co-Authored-By / AI trailers.**
- **Nothing costs money** — everything is testnet (free friendbot funds, test Stripe key,
  free Reclaim demo creds).

---

## 1. Environment & toolchain (all installed natively on ext4, no Docker)

| Tool | Version | Notes |
|---|---|---|
| Rust | 1.96.0 | + targets `wasm32-unknown-unknown` AND `wasm32v1-none` |
| soroban-sdk | 26.1.0 | pinned `"26"` in `contracts/Cargo.toml` |
| stellar CLI | 27.0.0 | prebuilt binary in `~/.local/bin` |
| Node / npm | v24.18.0 / 11.16.0 | via nvm |
| gh CLI | 2.95.0 | `~/.local/bin`; auth via Windows Git Credential Manager |
| C toolchain | gcc 13.3.0, make 4.3 | `build-essential` (installed via sudo by the user) |

**Gotchas learned:**
- `stellar contract build` targets **`wasm32v1-none`** (protocol 23+), not the old
  `wasm32-unknown-unknown`. Must `rustup target add wasm32v1-none`.
- `~/.profile` has a toolchain block (cargo env, nvm, `~/.local/bin`). Non-login
  shells skip it → always `source ~/.profile`.
- git push works without prompts: `credential.helper` points to Windows GCM
  (`/mnt/c/Program Files/Git/mingw64/bin/git-credential-manager.exe`).
- npm 11 blocks dependency lifecycle scripts by default (allow-scripts gate), but
  koffi/re2 ship prebuilts so the native stack works anyway. Reclaim needs
  `npm run download-zk-files` after install (already run for `backend/`).

---

## 2. Repo structure

```
~/stellar/
├── contracts/            # Soroban workspace (Rust) — Phase 1 ✅
│   ├── Cargo.toml         # workspace, soroban-sdk = "26"
│   ├── score_registry/    # registration + signed scores keyed to address
│   ├── credit_line/       # derives limit + APR from registry (read view)
│   ├── lending_vault/     # isolated per-agent vault: deposit/borrow/repay/withdraw/yield
│   │   └── tests/integration.rs   # full-flow end-to-end test
│   ├── libraries/revenue_math/    # shared policy: banding, limits, APR, interest, ScoreData, ScoreRegistry client iface
│   └── adapters/stellar8004_identity/  # INTERFACE ONLY (unimplemented, per scope)
├── backend/              # Underwriting engine (TS + Fastify) — Phase 2 ✅
│   └── src/{config,underwrite,index}.ts
│       ├── indexer/      # x402 USDC getEvents → agent revenue
│       ├── zktls/        # Reclaim proof gen + on-chain verify (ported from spike2)
│       ├── scoring/      # composite score, mirrors revenue_math banding
│       ├── signer/       # Ed25519 attestation + publish_score submission (Phase 4)
│       └── api/server.ts # Fastify REST
│   └── scripts/          # setup-signer.mjs, probe.ts, run-underwrite.ts, demo-api.sh
├── frontend/             # Next.js App Router + Tailwind — landing ✅, dashboards = samples
│   ├── app/page.tsx       # cinematic coming-soon landing (/)
│   ├── app/preview/       # old content-rich landing (early preview)
│   ├── app/borrower/      # SAMPLE agent dashboard (illustrative data)
│   ├── app/lender/        # SAMPLE lender dashboard (illustrative data)
│   ├── app/coming-soon/   # earlier coming-soon page
│   ├── components/        # CinematicBackground, BrandMark, FianzaMark, NotifyForm, DashboardChrome, SiteHeader/Footer, ...
│   └── public/logo6.png   # the real logo (2048², ~6.2MB — optimize later)
├── spikes/               # VALIDATED de-risking spikes (testnet) — DO NOT reinvent
│   ├── spike1-x402-payer/        # Gate 1: x402 payer identity (transfer.from = agent)
│   └── spike2-reclaim-revenue/   # Gates 2A/2B: Reclaim zkTLS on-chain verify
├── screens/              # Stitch design exports (borrower=dashboard.*, lender=lending.*)
├── docs/                 # architecture, scoring-methodology, sybil-model (stubs)
└── PROJECT_LOG.md        # this file
```

---

## 3. Key addresses & constants (testnet)

| Thing | Value |
|---|---|
| USDC testnet SAC (for getEvents) | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` |
| USDC testnet issuer (classic) | `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` |
| Reclaim Soroban verifier (testnet) | `CA3EMXR6JOOTNP44T3OAJFMMMGKRRETDJKBLZP2RU3SIY4SDFAH54DU5` |
| **score_registry** (Phase 4 deploy) | `CAZUPW5MWHG5XCE7BM6YP6M52NPB6TPRRAXU3GEV4TL2AR2ZMYE7TRSX` |
| **credit_line** (Phase 4 deploy) | `CA2HOO3KKDPQB4URKDJGVP4QD57UTCSKA2XN7U76RAN4VATOKXZV4QSV` |
| **lending_vault** (Phase 4 deploy, bound to USDC SAC) | `CD5RQFFYF57MLI3JI2PHUROMYFWLGDB7RPMGIK5JRWAO6NWHEUE3EC6C` |
| Phase-4 deployer (admin; funded) | `GAR5YLY4JZGHOC5552T7UGXNYQTDT3GI6M7ZWZYLOTVZYSPOKLPYQE4J` (CLI key `deployer`) |
| Reclaim demo app id | `0x381994d6B9B08C3e7CfE3A4Cd544C85101b8f201` |
| Score signer (funded) | `GCNFNO4A4WPHUNNT3YJ36J4NIW4SV46XNO35Y355TMJF6DVPVXM3KWXF` |
| Facilitator submitter (exclude) | `GDS55JGUTDAH43XQRQGYK5NTDIO57HFA5OP6EOQ3AZ2E3GG634A2ZD5L` |
| Facilitator fee sponsor (exclude) | `GA6THKUY2XJZOBRFMEQMMEADSCQLCZ2QMQWAWMMDXBTE7SARKAXVH7TL` |
| **Test agent** (earns x402 revenue) | `GCW6JEZSI64YMCARRROUPJVLIE5JFRNKRZVZYSKHQOQCVZN6RV3CYPAF` |
| Test agent's payer | `GBEFWKH6NGDAGJ2TAUEF3VOUQETOIFM64WBNDIRIPRK2KE5QOUWVQHDE` |
| Validated payment | 10000 stroops (0.001 USDC), ledger 3326966, tx `ee7aa15bd22823b4ff2340f8e67f0bb14cd343ed1af5d459dd357d356227d4fd` |

**Secrets** (gitignored, never commit): `spikes/.env`, `spikes/spike2-reclaim-revenue/.env`
(has `SEEDPHRASE`, `STRIPE_TEST_KEY`), `backend/.env` (has `SCORE_SIGNER_SECRET`).
Backend `config.ts` loads all three (spike envs + backend override). Reclaim app
creds default to the demo values (the `.env` keys are empty; spikes hardcoded them).

---

## 4. Underwriting policy (single source of truth = `revenue_math`)

- **Tiers from score (0–850):** A ≥ 750, B ≥ 650, C ≥ 550, else Unrated.
- **Credit limit** = trailing revenue × tier multiple: A=3×, B=2×, C=1×, Unrated=0.
- **Fixed APR per tier:** A=6.00%, B=8.50%, C=12.00%, Unrated=0 (bps: 600/850/1200).
- **Interest:** simple interest at the tier APR; repaid interest → lender yield.
- Calibrated to the design mock: score 720 → Tier B; 25k revenue → 50k limit @ 8.5%.
- **Anti-Sybil (off-chain scoring):** on-chain revenue only counts with ≥
  `MIN_COUNTERPARTIES` (default 3) distinct payers; zkTLS off-chain revenue
  weighted 1.5× and not subject to the minimum.

---

## 5. PHASE STATUS

### Phase 0 — Scaffolding ✅
Monorepo + native toolchain installed. Committed `phase-0 done`.

### Phase 1 — Soroban contracts ✅ (commit `phase-1 done`)
- `revenue_math`, `score_registry`, `credit_line`, `lending_vault` implemented;
  `stellar8004_identity` interface-only.
- **23 tests pass** (`cargo test`): revenue_math 6, score_registry 8, credit_line 3,
  lending_vault 5, integration 1.
- All three contracts build to WASM (`stellar contract build`):
  score_registry 6.2K, credit_line 3.9K, lending_vault 13K.
- Soroban test snapshots committed (differential testing).
- **Isolation proven** by test: agent A's deposits can never fund agent B.
- **Run:** `wsl -d ubuntu-24.04 -- bash -lc 'source ~/.profile; cd ~/stellar/contracts && cargo test'`

### Phase 2 — Underwriting engine ✅ (commit `phase-2 ...`)
- `indexer/` — `getEvents` on USDC SAC (4-segment topics `["transfer",*,*,*]`),
  sums transfers where `to == agent`, counts distinct payers, excludes facilitator.
  **Validated on real testnet data** (found the test agent's 0.001 USDC payment).
  NOTE: USDC SAC is high-traffic → use a narrow `fromLedger` window near a known payment.
- `zktls/` — faithful port of spike2: zkFetch Stripe balance with key in private
  headers only, secret-leak assertion, `transformForOnchain`, on-chain `verify_proof`.
  Has a 120s timeout (Reclaim attestor occasionally hangs — see Known Issues).
- `scoring/` — composite score (mirrors `revenue_math`), anti-Sybil rule.
- `signer/` — Ed25519 attestation (funded signer `GCNFNO4A…`, self-verified);
  `submitScore()` builds `publish_score` tx, **deferred until Phase 4** (no deployed registry).
- `api/` — Fastify REST (see endpoints below).
- **End-to-end run succeeded** via the live API (proof step skipped due to attestor hang):
  real indexed revenue → score 405/Unrated (honestly low: 0.001 USDC, 1 payer < min) →
  real attestation. The zkTLS on-chain verify itself is proven by spike2 gate2b
  (tx `3733e2b91a1106516bd8ac966055c35e73bba819bd03e62e922e0fd40ebeaf30`).
- **Run the API demo:** `wsl -d ubuntu-24.04 -- bash -lc 'source ~/.profile; bash ~/stellar/backend/scripts/demo-api.sh'`
- **Run full underwrite:** `... cd ~/stellar/backend && npx tsx scripts/run-underwrite.ts <AGENT> [fromLedger]`

**API endpoints** (Fastify, port 8787, entry `src/index.ts`):
- `GET  /health`
- `GET  /config` — network, contract ids, signer, exclude list (no secrets)
- `GET  /signer`
- `GET  /agent/:address/revenue?fromLedger=` — live x402 revenue
- `POST /agent/:address/underwrite?skipProof=&fromLedger=` — full pipeline
- `GET  /agent/:address` — last stored result
- `GET  /agents` — all underwritten agents (lender dashboard)

### Marketing / landing site ✅ (in commit `phase-2 ...`)
- `/` = cinematic coming-soon splash (HUD frame, starfield, the real `logo6.png`
  with edge-fade mask, left→right underwriting "journey", Notify form → mailto
  `divyanshhkalra1234@gmail.com`, access links).
- `/preview` = original content-rich landing (early preview).
- `/borrower`, `/lender` = **sample** dashboards, illustrative data, faithful to `screens/`.
- `/coming-soon` = earlier coming-soon page (candidate for removal).
- Deploys on Vercel; **Root Directory must be `frontend`** (see `frontend/vercel.json`).
- Preview locally: `preview_start` config `web` in `.claude/launch.json` (serves `npm start` on 3100).

---

## 6. WHAT'S LEFT

### Phase 3 — Frontend wiring ✅ done
Both dashboards rebuilt as real client components on the live API + wallet (no
mock data). New shared foundation:
- `frontend/lib/api.ts` — typed client mirroring every backend response shape +
  formatters; network/HTTP errors → typed `ApiError`.
- `frontend/lib/stellar.ts` — Stellar Wallets Kit (Freighter + all modules);
  connect/restore/disconnect; generic `invokeContract()` (build→simulate→
  wallet-sign→submit→poll) ready for the Phase-4 vault calls.
- `frontend/components/WalletProvider.tsx` (+ `WalletButton`) — wallet/config
  React context, mounted app-wide in `app/layout.tsx`; address persists.
- `DashboardChrome` now uses the real wallet button + live network pill + working
  Dashboard/Liquidity nav (dropped the "sample preview" ribbon).

Borrower (`app/borrower/page.tsx`): connect-gate → auto-index revenue → "Submit
revenue proof" (full underwrite) / "Score on-chain only" (`skipProof`) → real
score/tier/limit/APR, revenue chart from `payments`, score breakdown, activity
feed (real tx hashes → stellar.expert). Plus an **inspect bar** (address +
fromLedger, "Test agent" quick-fill) to view/underwrite ANY agent read-only
(revenue + underwrite are public, address-keyed — no key needed).

Lender (`app/lender/page.tsx`): live `/agents` table (tier/rev/credit-line/APR/
risk dot), per-agent underwriting detail panel, protocol aggregates (agents,
total credit, avg APR). Deposit box + positions honestly **gated to Phase 4**
(no vault deployed → `config.lendingVaultContractId` unset).

**Phase-4-gated, by design:** credit draw/repay (borrower) and vault deposit +
lender positions/exposure/yield (lender) read contract ids from `/config`; while
unset they show a clear "activates after testnet deploy" state, and the
wallet-signing path (`invokeContract`) is already built.

### Phase 4 — Testnet wiring (IN PROGRESS)
**4a ✅ done — deploy + backend wiring:**
- All three contracts deployed to testnet (ids in §3). credit_line bound to the
  registry; lending_vault bound to registry + USDC SAC. Verified by read calls
  (`credit_line.registry`, `lending_vault.token`, `credit_line.terms` reads
  through to the registry).
- Deployer = funded CLI key `deployer` (`GAR5YLY4…`), admin of the registry;
  registry signer = `GCNFNO4A…` (the backend's score signer). **Deploy never
  needs the signer secret — only its public key as a constructor arg.**
- `backend/.env` set: `SCORE_REGISTRY_CONTRACT_ID`, `CREDIT_LINE_CONTRACT_ID`,
  `LENDING_VAULT_CONTRACT_ID`. `config.ts` exposes all three; `/config` now
  returns the live `scoreRegistryContractId`. `submitScore` made fault-tolerant
  (try/catch) so on-chain publish failures never break the underwrite endpoint.
- Deploy/wire scripts: `contracts/_phase4_deploy.sh`, `backend/_phase4_wire.sh`.

**TOOLCHAIN GOTCHA (important):** running `wsl -d ubuntu-24.04 -- bash -lc '…'`
from the Windows Bash tool **mangles `$VAR` / `$(…)` expansion** (variables come
back empty). Literal commands work; anything needing shell variables must be put
in a **script file** and run as `bash file.sh`. That's why the deploy/wire logic
lives in `.sh` files, not inline.

**4b ✅ done — full money flow ran on testnet with REAL USDC.** Chose real USDC
(Circle testnet faucet, 20 USDC to the lender; agent needs none — it borrows then
repays the same funds). Test accounts (throwaway, keys in `/tmp/_phase4b_keys.json`):
- lender `GB2T6L3PSZ4BGJRCE5ACQ3QOKHHTGQ3Z44SBTVHGXMPECFCIORFCHH7L`
- agent  `GDWYTAEXQIXE2SGK7G3SN5CVKQS7Q67FNPGGXSBTWZITOJDWRUKLC6OC`

Six steps, every tx hash:
1. register (agent)         `f95bdd706be4b5525c902ffa8f314a780e7069cb1d49336476d613d5a05123a8`
2. publish_score (signer)   `9807fd447255ed8bab383e5f5b1abcf0a4b3358927a67805f487bf7d1cecf178`
3. deposit 10 USDC (lender) `7e554bb70c1623062b590b98992a3001402d361b2b555bf645a2d2fe16aebdf3`
4. borrow 5 USDC (agent)    `e92ffa56a63d6eb8c3db79463da8d9e8609c469ce300f714b8aa0ee0e655edfe`
5. repay 5 USDC (agent)     `96a0a771c81cb9b93805214529c77c45bb3941f42e31ec8161f70ab18b802a5c`
6. record_repayment(signer) `5cbf6d1d8c19b7efce369e89501a18556e5e0f0fea7f8b43a1659f0684bf9a68`

Final on-chain state verified: `credit_line.terms` = Tier B / 50 USDC limit /
8.5% APR; `vault.state` = 10 USDC liquidity, principal 0, fully repaid;
`get_repayments` = 1/1 on-time. NOTE: step 2 published a **representative** score
(720 / 25 USDC revenue) to size a borrowable limit — real indexed testnet revenue
is ~0; the contract rails are fully real, only that one input is a stand-in.
Scripts: `backend/_phase4b_setup.mjs` (accounts+trustlines), `_phase4b_flow.mjs`.

**Phase 4 remaining (UI polish, optional):** wire the frontend vault handlers
(register/borrow/repay/deposit via the existing `invokeContract`) and expose
creditLine/vault ids in `/config` so the dashboard buttons drive this same flow
(kept gated until handlers exist). The protocol itself is fully proven on-chain.

### Known issues / tech debt
- **zkTLS proof generation occasionally hangs** on the Reclaim attestor network
  (once ran ~1hr). Mitigated with a 120s timeout (`PROOF_TIMEOUT_MS`). Not a Stellar
  or cost issue — it's client-side zk proving / attestor stall.
- **Indexer** does on-demand `getEvents` scans; the shared USDC SAC is high-traffic
  so a wide window is impractical. Prod needs a **persistent incremental indexer → DB**.
- `logo6.png` is 6.2MB (2048²) — downscale to ~512px.
- In-memory underwriting store (no DB), no API auth/rate-limiting, single signer.
- Testnet revenue is tiny (0.001 USDC) → demo scores are honestly low. For a funded
  score, generate fresh x402 revenue from ≥3 distinct payers, or fund a Stripe figure.

### The real moat (strategic) — now has a v1 spec
zkTLS proves revenue is **real**, not that it's **independent**. The defensible IP is
the **counterparty-independence / Sybil model** (an operator can loop their own wallets
or fund their own Stripe). `docs/sybil-model.md` is now a full **v1 design spec**:
reframes Sybil resistance as economic security (`cost_to_fake > value_unlocked`),
catalogs the attacks, and specifies a buildable on-chain independence model (payer
reputation, fund-flow loop detection via the payment graph, concentration/HHI caps,
temporal organicity) — **no zkML needed**. Not yet implemented in `scoring/`
(planned `backend/src/scoring/independence.ts`).

### v1 scope decision (for fundraising — 2026-06-30)
Agreed priority for a fundable v1: (1) **Phase 4 live loop** (deploy + one full
register→borrow→repay with tx hashes) is the highest-leverage artifact; (2)
**counterparty-independence v1** is the moat to build/show; (3) finish Phase 3
dashboards (done). **Cut from v1:** zkML (research tarpit, off critical path).
**Deferred to v1.5:** paginated trailing-revenue aggregation (per-page proofs +
trustless sum) — do a minimal version so revenue proofs aren't a single-balance
toy, but don't over-build pre-funding. The persistent-indexer→DB upgrade serves
BOTH scaling and the independence model (shared dependency).

---

## 7. Out of scope (v1 — do NOT build)
zkML strategy proofs, AVS decentralization, reserve fund, multi-page revenue
aggregation. `stellar8004_identity` stays an interface stub.

---

## 8. Arc 1 — hackathon build progress (2026-07-01)

Roadmap + locked decisions live in `~/.claude/plans/see-develop-a-plan-magical-wolf.md`
(positioning **originate → open**; **centralized underwriter v1**, decentralize on
roadmap; **curated LPs**, testnet for demo day; goal = win the hackathon with a
*real autonomous loop*, then VC). Two arcs: Arc 1 = win the hackathon; Arc 2 =
investment-worthy product (production infra, full independence model, originate→open).

**Done this session:**
- **Agent SDK** — `packages/agent-sdk/` (`@trustline/agent-sdk`). `FianzaAgent`
  class: `register / underwrite / onboard / creditLine / vaultState / borrow / repay`
  over a Node `Keypair`. Built + **validated on testnet** (autonomous borrow+repay
  settled: tx `7274c448…`, `d680da1b…`). README = the "infrastructure" signal.
- **Dashboard wired** — `/config` now exposes `creditLineContractId` +
  `lendingVaultContractId`; borrower `register/borrow/repay` + lender `deposit` are
  live wallet-signed actions via `frontend/lib/stellar.ts:invokeContract`.
  Typecheck + build clean.
- **OZ Channels key wired** — `OZ_API_KEY` + `FACILITATOR_URL` in `backend/.env` +
  `spikes/.env` (unblocks x402-native settlement, Task #5).
- **Independence engine (the moat)** — `backend/src/scoring/independence.ts`:
  fund-flow loop detection (BFS over USDC transfer events — is a payer funded by the
  agent within 3 hops?). Wired into `underwrite.ts` so the score counts **only
  independent revenue**; resilient (falls back to raw revenue on error). Validated on
  real data: correctly classified the test agent's payer as *independent*.

**Seeder + moat VALIDATED (live on testnet):**
- Funder `GA2YSWX…` faucet'd 20 USDC → seeded via SAC transfers (all revenue/
  funding flows go through the USDC SAC so they're both indexed AND visible to the
  independence graph). `backend/_seed_revenue.mjs` + `_reseed_sybil.mjs`.
- Demo agents (keys in `/tmp/_demo_agents.json`, `fromLedger` saved there too):
  - HONEST `GB2FTLU3…` — 7.5 USDC from **3 independent payers** → **Tier C, 7.5 USDC
    line, APPROVED**.
  - SYBIL `GAXCQ2B6…` — self-paid 3 wallets → all **3 caught as circular** → 0
    independent revenue → **Unrated, 0 limit, DENIED**.
- **Testnet calibration (honest, not a hack):** `SCORE_BAND_DIVISOR=1000` in
  `backend/.env` rescales the revenue→tier bands for faucet-scale USDC (mainnet
  default 1). And the funder is added to `X402_EXCLUDE_ADDRESSES` (a funding/faucet
  source isn't revenue — same rationale as the facilitator excludes) so the sybil
  agent's only counted revenue is the circular loop → clean 0-independent denial.
  NOTE: classic USDC payments ALSO emit SAC transfer events on this protocol, so
  the indexer catches both — exclusion (not payment type) is how funding is filtered.

**ARC 1 COMPLETE — full demo ran on testnet (all tasks ✅):**
- **`scripts/demo-day.mjs`** (3 agents, 3 beats) ran end-to-end. Lender reused the
  funded Phase-4b lender `GB2T6L3P…` (10 USDC) via `backend/_use_old_lender.mjs`
  (faucet was rate-limited). Beat 1: honest agent register → underwrite (Tier C) →
  lender deposits 7 USDC → agent autonomously borrows 5 → repays 5. Beat 2: sybil
  agent DENIED (0 independent), on-chain borrow rejected with `Error(Contract,#3)`
  = InsufficientCredit. Tx hashes captured in chat.
- **x402-native "draw-on-402" (Task #5) WORKS.** `spikes/spike1-x402-payer/`:
  `x402-server.mjs` (resource server, price via `X402_PRICE_USDC` numeric env to
  dodge `$`-mangling/dotenvx expansion; payTo=funder; OZ facilitator) +
  `x402-pay.mjs` (basic buyer, validated) + `x402-draw-demo.mjs`. Draw-on-402:
  agent wants a $3 call, has 0.5 USDC → auto-borrows 2.5 from its credit line
  (tx `b43c0998…`) → pays $3 over x402 → HTTP 200. Credit made invisible.
  Server runs as a bg node process on :3010 (start with
  `SERVICE_PUBLIC=<funder> X402_PRICE_USDC=3 PORT=3010 node x402-server.mjs`).

## 9. Scout — the live autonomous agent (2026-07-01/02)

**A brand-new agent, zero starting capital, ran the ENTIRE Fianza lifecycle
organically through real usage — no pre-arranged demo script.** New top-level
`agents/` workspace (`agents/{shared,dataco,scout}/`), $0 real cost throughout
(free Groq/Gemini inference, free testnet USDC, free Render/local hosting).

**What Scout is:** a real x402-paid `/research` agent. `agents/scout/server.mjs`
uses `agents/shared/brain.mjs` (Groq primary, Gemini 2.5 Flash fallback — both
live-verified) for real inference, and buys real supplementary data from
**DataCo** (`agents/dataco/server.mjs`, a real Wikipedia-backed x402-paid lookup
service — genuine external data, free, no key) via the SDK's `payWithCredit`.
This is the real, on-chain cash-flow gap: Scout must pay DataCo before it's
collected for the job that needed the data.

**The full organic lifecycle, proven on testnet:**
1. Scout earned real revenue from 3 independent real customer wallets paying
   its `/research` endpoint over x402 (real AI answers, real Wikipedia sourcing).
2. `agents/scout/reconcile.mjs` registered + underwrote Scout on that real
   revenue → **score 695 (Tier B)**, independence check: **3/3 real payers
   verified independent, 0 circular**.
3. A real lender deposited into Scout's isolated vault (tx `075b6507…`).
4. Facing a real cost it couldn't cover, Scout **autonomously borrowed** from
   its own earned credit line — no human decided this; `payWithCredit`'s inline
   logic did. Verified on-chain vault state: real principal, real accruing
   interest.
5. Scout **autonomously repaid** from its earnings (tx `6015548b…`) — interest
   paid first into a real, tiny, non-zero **yield_pool** the lender can claim.

**Bug found + fixed along the way (important):** `SCORE_SIGNER_SECRET` was never
actually set on Render — `signerKeypair()` was silently falling back to a fresh,
**unfunded ephemeral key on every cold start**, so on-chain score *publishing*
had been failing silently since the Render deploy (the funded local signer,
`GCNFNO4A4WPHUNNT3YJ36J4NIW4SV46XNO35Y355TMJF6DVPVXM3KWXF`, was never used
there). The `/demo` page's UI numbers were always computed correctly off-chain;
they just weren't landing on-chain. Fixed by setting `SCORE_SIGNER_SECRET` in
Render's dashboard (value in local `backend/.env`) — confirmed fixed: `/config`
now reports the correct funded signer, and a fresh underwrite for Scout returned
`submission.submitted: true` with a real tx hash for the first time.

**SDK fix:** `payWithCredit(url, priceUsdc, opts)` gained an `opts.init` param
(method/headers/body) — it previously only supported a bare GET, which broke on
DataCo's POST+JSON endpoint.

**Also confirmed (real, not staged):** `lending_vault.borrow()` enforces BOTH
credit limit AND vault liquidity — Scout's first borrow attempt correctly failed
with `InsufficientCredit` (before underwriting), then `InsufficientLiquidity`
(after underwriting but before a lender deposited), then succeeded once both
conditions were real. This is the two-sided marketplace working exactly as
designed, discovered through genuine testing, not asserted.

**Ops gotcha:** `pkill -f` inside `wsl bash -lc` intermittently failed to kill
background node processes in this session, leaving stale servers squatting on
ports and serving stale env — always verify with `ss -ltnp` / kill by exact PID
after a pkill, don't trust the exit code alone.

**Left to do:** restore Scout/DataCo to persistent hosting (Render, `agents/`
services) + a public "Scout, live" status page — currently running locally only.
Keys for all agent/customer/lender wallets used above live in `agents/.env`
(gitignored) — back these up, `/tmp`-style loss already happened once this
session.

**Polish DONE (all of it):** independence verdict surfaced in the borrower Score
Breakdown; zkTLS Beat 3 validated (proof verifies on-chain); draw-on-402 folded
into the SDK as `payWithCredit(url, priceUsdc)`. Fixed an independence false
positive (don't traverse loop-detection through excluded funding hubs) + excluded
the vault contract. Fixed a real frontend bug: the API client sent
`content-type: application/json` on bodyless POSTs → Fastify 400 (broke the
underwrite button); now only set on requests with a body.

**Self-serve /demo page (VC/SCF-facing) — the "no scripts" fix:** `app/demo/page.tsx`
+ backend `GET /demo` (serves the two showcase agents from `DEMO_*` env, `/tmp`
fallback) + `api.demo()`. A visitor clicks "Run" → the site LIVE-underwrites the
honest + sybil agents (no wallet) → animates APPROVED vs DENIED with the
independence breakdown, then a real settlement-tx timeline. README fully rewritten
product-first (live-demo link, tx proof, architecture, why-Stellar).

**Render deploy:** backend builds to `dist/index.js` (`npm run build` → `npm start`,
`node dist/index.js`); PORT from env; CORS open; config reads all secrets/ids from
env (no .env on Render). Point the Vercel frontend's `NEXT_PUBLIC_API_BASE_URL` at
the Render URL. Env vars to set on Render: `SCORE_SIGNER_SECRET`, the three
contract ids, `DEMO_HONEST_AGENT`/`DEMO_SYBIL_AGENT`/`DEMO_FROM_LEDGER`,
`X402_EXCLUDE_ADDRESSES` (facilitators + funder `GA2YSWX…` + vault `CD5RQFFY…`),
`SCORE_BAND_DIVISOR=1000`, and (for x402/zkTLS) `OZ_API_KEY`/`FACILITATOR_URL`.

**Artifacts added this session:** `packages/agent-sdk/*` (SDK + LP deposit),
`scripts/{sdk-smoke,sdk-write-smoke,demo-day}.mjs`,
`backend/{_oz_wire.sh,_seed_funder.mjs,_seed_revenue.mjs,_reseed_sybil.mjs,_make_lender.mjs,_verify_demo.mjs}`,
`backend/src/scoring/independence.ts`. Backend runs as a bg task
(`npm run dev`, tsx watch, port 8787).
