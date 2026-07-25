# Handoff prompt — Tael codebase architecture scan

> Paste everything below the line into a **fresh session** that has the Tael
> repo (https://github.com/rahulsainlll/tael-protocol) checked out as its
> working directory. It has no context from our Fianza conversation — the
> prompt is self-contained on purpose.

---

You are scanning an unfamiliar codebase to produce an **architecture map**. The
repo is Tael — an x402 / HTTP-402 payment layer that lets developers put a
per-call USDC price (settled on Stellar) on any HTTP endpoint. Agents pay by
signing a Stellar USDC transfer and passing it in an `X-PAYMENT` header; the
server verifies settlement before running the handler.

I am evaluating this codebase for an integration with **Fianza**, a credit
protocol for AI agents on the same rails (x402, Stellar, USDC). So your scan
must go beyond "what is this repo" — I need the specific structural facts an
integrator would need. Do NOT change any code. Read-only.

## Deliver a single markdown report with these sections:

### 1. Repo map
- Top-level layout: packages/apps/modules and what each is responsible for.
- Is it a monorepo? Package manager, build tooling, language(s), runtime targets.
- Which packages are published (npm names) vs. internal? Match the docs'
  `@tael/sdk` and `@tael/stellar` to actual directories.

### 2. The core payment wrapper
- Where `tael()` and `createTael()` are implemented. Trace one call end to end.
- How the 402 challenge is built (what fields, where `price`/`payTo`/`issuer`/
  `network`/`description`/`accepts` come from).
- How the `X-PAYMENT` header is decoded and dispatched to a verifier.
- The exact shape of the object handlers receive (the "receipt" /
  `SettlementReceipt` / `TaelContext`) — field names and types. **Critical:**
  does it expose the settled tx hash, payer address, amount, and asset?

### 3. Verifiers — the settlement seam
- `createMockVerifier` vs. `createStellarVerifier`: where each lives, the
  `PaymentVerifier` interface, and what "verified" concretely means.
- For the Stellar verifier: does it **submit** the transaction itself, or only
  **confirm** an already-submitted one? What Stellar SDK / RPC / Horizon does it
  use, and against what network config?
- What exactly is checked: amount match, asset/issuer match, destination match,
  double-spend / replay protection, timeout/expiry handling.

### 4. On-chain settlement shape (most important for integration)
- What does a settled payment look like **on Stellar** — a classic payment op, a
  path payment, a Soroban contract call, a SAC transfer? Trace the code that
  constructs or validates it.
- Is there a **memo, tag, or on-chain marker** that attributes a payment to a
  specific resource/invocation, or is it a bare USDC transfer to `payTo`?
- How is the USDC asset identified in code (issuer address, SAC contract id,
  asset code)? Where do the testnet vs. mainnet issuer/asset values live?
- Given only a `payTo` Stellar address, could a third party (Fianza)
  deterministically index that address's settled Tael receipts from on-chain
  data alone? What's present/missing to attribute them reliably?

### 5. The buyer/client side
- Is there ANY client-side SDK for the paying agent, or is payment
  construction left to the caller (as the docs' hand-rolled example suggests)?
- If there's payment-construction code anywhere (tests, examples, fixtures),
  point to it and describe how it signs/encodes the Stellar tx into `X-PAYMENT`.

### 6. Config, networks, extension points
- How network selection (`stellar-testnet` / `stellar-mainnet`) flows through.
- Env vars / config files and what they hold (issuer addresses, RPC URLs, keys).
- Interfaces/hooks a third party could implement or wrap without forking:
  custom `PaymentVerifier`, middleware, receipt callbacks, settlement logging.

### 7. Tests, examples, maturity
- What's tested and how (mock vs. real chain). Any e2e against live Stellar?
- Runnable examples/quickstarts and where.
- Rough maturity read: production-ready, prototype, or hackathon-stage? Cite
  evidence (TODOs, stubbed paths, mock-only verification, missing error handling).

## Output rules
- Every claim anchored to a concrete `path/to/file.ts:line` reference.
- Where the code and the public docs disagree, flag it explicitly — the docs may
  be aspirational.
- Prefer quoting actual type definitions and function signatures over paraphrase.
- If something can't be determined from the code, say so plainly rather than
  guessing.
- End with a **"Integration-relevant summary"**: the 5–8 facts that most matter
  to someone building a credit layer that (a) lets agents pay Tael endpoints on
  borrowed funds and (b) underwrites agents on the Tael revenue landing at their
  `payTo` address.
