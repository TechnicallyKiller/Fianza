# Spike 2 — Reclaim revenue proof on Soroban

Cloned from https://github.com/reclaimprotocol/zkfetch-stellar-example.

## Gate 2A — PASS (verifier leg, canned Stellar-price source)
- Fresh proof generated (CoinGecko XLM price), `transformForOnchain`, submitted to the
  testnet verifier contract `CA3EMXR6JOOTNP44T3OAJFMMMGKRRETDJKBLZP2RU3SIY4SDFAH54DU5`.
- Verify tx `c819e14559d0d1297aa038f3def8b8ae63f959e9cfbe367798aaa926742561bc` → **SUCCESS**.
- Evidence: `gate2a-result.json`, fresh `src/proof.json` (timestamp 2026-06-28).

## ⚠️ How to run (important — cannot run on the WSL UNC path)
A transitive native dep (`koffi`) builds via `cmd.exe`, which refuses UNC working
directories, so `npm install` fails under `\\wsl.localhost\...`. Also the repo's CLI
entry guard is POSIX-only and silently no-ops on Windows. Therefore this spike was run
from a **local NTFS working copy**, driving the exported functions directly:

1. Copy this folder's source to a local path (e.g. a Windows temp dir or, preferably, run
   inside WSL with a native Linux node — this distro currently has none).
2. `npm install` (local path → koffi builds fine).
3. `npm run download-zk-files` (required, or proof generation fails).
4. `node gen-seed.mjs` — generates a 12-word SEEDPHRASE, derives the Stellar account
   (`stellar-hd-wallet` getSecret(0)), friendbot-funds it, writes `.env`.
5. `node run-2a.mjs` — Gate 2A: request stellar-price proof → verify on Soroban → poll
   getTransaction for SUCCESS. Prints proof + tx hash + verdict, writes `gate2a-result.json`.

Reclaim `APP_ID`/`APP_SECRET` are hardcoded demo creds in `src/config.js`, so Phase A
needs only the funded SEEDPHRASE (already in `.env`, gitignored).

## Gate 2B (next) — private revenue endpoint
Will write a `@reclaimprotocol/zk-fetch` script pointing at a private API with the key in
the PRIVATE options (Stripe `GET /v1/balance` preferred; FALLBACK_API_URL/KEY otherwise),
extract the integer amount via responseMatches, `transformForOnchain`, verify on the SAME
contract, then assert the secret never appears in the proof object. Needs the user to
provide `STRIPE_TEST_KEY` or `FALLBACK_API_URL`/`FALLBACK_API_KEY` in `spikes/.env`.
