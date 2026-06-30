# TrustLine — Project Log & Handoff

**On-chain, revenue-underwritten credit protocol for AI agents on Stellar.**
Borrowing power is underwritten by verified revenue (on-chain x402 earnings +
Reclaim zkTLS-attested off-chain revenue), not wallet history. Settles in USDC
over x402. Every credit line is an isolated per-agent vault.

> This file is the single source of truth for continuity. Update it at the end
> of each work session. Last updated: **end of Phase 2** (Phase 3 not started).

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
  (frontend wiring) and Phase 4 (testnet deploy + live full flow) **not started.**
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
│   ├── components/        # CinematicBackground, BrandMark, TrustLineMark, NotifyForm, DashboardChrome, SiteHeader/Footer, ...
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

### Phase 3 — Frontend wiring (NEXT)
Rebuild the two dashboards to the `screens/` designs as **real components wired to
live data + wallet**, not the current static samples:
- Borrower: connect wallet (Stellar Wallets Kit + Freighter), register, see indexed
  revenue (`GET /agent/:addr/revenue`), submit a revenue proof (`POST .../underwrite`),
  see score + limit, request + repay a credit line (vault calls).
- Lender: browse agents (`GET /agents`) + underwriting history, deposit into a chosen
  agent's isolated vault, see exposure + yield.
- No mock data once wired. Report screen by screen.

### Phase 4 — Testnet wiring
- Deploy `score_registry`, `credit_line`, `lending_vault` to testnet (`stellar contract deploy`).
  Wire `SCORE_REGISTRY_CONTRACT_ID` etc. into `backend/.env` + `frontend/.env.local`.
- Run ONE full flow: register → revenue indexed → proof verified → score published →
  lender deposits → agent borrows → agent repays. **Report every tx hash.**

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

### The real moat (strategic — not a coding task)
zkTLS proves revenue is **real**, not that it's **independent**. The defensible IP is
the **counterparty-independence / Sybil model** (an operator can loop their own wallets
or fund their own Stripe). This is the unsolved core research bet — see `docs/sybil-model.md`.

---

## 7. Out of scope (v1 — do NOT build)
zkML strategy proofs, AVS decentralization, reserve fund, multi-page revenue
aggregation. `stellar8004_identity` stays an interface stub.
