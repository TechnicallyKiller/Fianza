# Tael Protocol — Architecture Map (for Fianza integration evaluation)

## 1. Repo map

**Monorepo:** yes — pnpm workspaces (`pnpm-workspace.yaml:1-3`: `apps/*`, `packages/*`) + Turborepo (`turbo.json`) for task orchestration. Node ≥ 22, pnpm ≥ 11 (per README). Language: TypeScript throughout (`strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax` per ARCHITECTURE.md:331). Runtime targets: Node (API), browser (Next.js apps), and the Web `Request`/`Response` standard for the SDK (framework-agnostic — works in Hono, Next route handlers, Bun, Deno, Workers).

Top-level layout matches ARCHITECTURE.md's description, verified against actual files:

- `apps/api` — `@tael/api`? — **actually unnamed/unverified**: I did not find `apps/api/package.json`'s `name` field explicitly checked, but it's referenced as `@tael/api` in ARCHITECTURE.md and CI (`pnpm --filter @tael/api`). It's a Hono + tRPC modular monolith; not published (apps are `ignore`d by Changesets per ARCHITECTURE.md:324).
- `apps/web` — marketing site (Next.js 15), not published.
- `apps/dashboard` — product dashboard (Next.js 15, wallets/marketplace/agents/analytics UI), not published.
- `packages/config` — `@tael/config`, dev-only tooling presets (tsconfig/eslint/prettier/tailwind), no runtime code.
- `packages/types` — `@tael/types`, package.json `"name": "@tael/types"` (confirmed) — the domain kernel: `Money`, zod schemas (`wallet.ts`, `payment.ts`, `capability.ts`, `policy.ts`), and `TaelError` taxonomy. Depends only on `zod`.
- `packages/payments` — `@tael/payments` (confirmed `package.json`) — the x402/HTTP-402 protocol envelope: challenge building, header encode/decode, verification orchestration via a `PaymentVerifier` port. Depends on `@tael/types` + `zod` only — **no Stellar SDK dependency**.
- `packages/stellar` — `@tael/stellar` (confirmed `package.json`) — Stellar settlement primitives: USDC asset construction, network config, tx submission, signature verification, keypair/provisioning helpers. Depends on `@stellar/stellar-sdk` (`^13.1.0`, pinned in the pnpm catalog) + `@tael/types`.
- `packages/sdk` — `@tael/sdk` (confirmed `package.json`) — the `tael()`/`createTael()` developer wrapper. Depends on `@tael/payments` + `@tael/types` — **does not depend on `@tael/stellar` directly**; the Stellar-backed verifier is composed in `apps/api/src/container.ts`, not in the SDK package.
- `packages/ui` — `@tael/ui`, shared shadcn/ui React components, ships source (`transpilePackages`).
- `packages/auth` — `@tael/auth` (confirmed), Sign-In-With-Stellar: challenge + JWT session tokens via `jose` only (edge-safe, deliberately no Stellar SDK — wallet signature verification lives in `@tael/stellar`'s `verifySignedMessage`).
- `packages/database` — **exists in the repo tree but is NOT listed in ARCHITECTURE.md's "Repository layout" diagram**, which claims it's a "Deferred workspace" (ARCHITECTURE.md:347: "`packages/database` … Create it when… persistence is needed"). **This is stale documentation** — `packages/database` is fully scaffolded with Drizzle schemas (`payments.ts`, `capabilities.ts`, `wallets.ts`, `agents.ts`, `users.ts`, `api-keys.ts`) and is actively imported by `apps/api/src/container.ts:14` and `apps/api/src/modules/payments/payment.repository.ts:1-7`. The docs have not caught up with the code.

All published packages (`@tael/types`, `@tael/payments`, `@tael/stellar`, `@tael/sdk`, `@tael/ui`, `@tael/auth`) use the "just-in-time" export pattern: `exports["."] .default` points at `./src/index.ts` for local dev (no build step needed), and `publishConfig.exports` swaps to `./dist/index.js` for npm consumers, built via `tsup`. Versions are currently all `0.0.0` — **nothing has actually been published to npm yet** (no evidence of a release having run; Changesets workflow exists at `.github/workflows/release.yml` but versions are still at the initial `0.0.0`).

## 2. The core payment wrapper

**Location:** `packages/sdk/src/tael.ts`. Two exports: `tael(options: TaelOptions): FetchHandler` (line 64) and `createTael(defaults: TaelDefaults)` (line 121), which just partially-applies `tael()` with shared defaults (`{ ...defaults, ...route }`, line 122).

**End-to-end trace of one call** (`packages/sdk/src/tael.ts:64-105`):
1. `tael()` returns an async `(request: Request) => Promise<Response>`.
2. On every call it rebuilds the 402 `requirements` via `buildPaymentRequirements()` from `@tael/payments` (line 67-75), using `resource = new URL(request.url).pathname` (line 66) — so the "resource" tied to a price is the request path, computed fresh each call, not persisted.
3. If no `X-PAYMENT` header (`PAYMENT_REQUEST_HEADER` = `"X-PAYMENT"`, defined in `packages/payments/src/x402.ts:23`) is present, responds `402` with `{ x402Version, accepts: [requirements], error }` (line 77-82).
4. If present, decodes it (`decodePaymentHeader`, throws `PaymentVerificationError` on bad base64/JSON/zod-shape) and calls `verifyPayment(payload, requirements, options.verifier)` (line 87-88) — this is where the injected `PaymentVerifier` actually runs.
5. On success, calls `options.handler({ request, receipt })` (line 96) — this is the `TaelContext`.
6. Echoes the settlement receipt back to the caller via `X-PAYMENT-RESPONSE` header, base64-JSON-encoded (`encodeReceipt`, line 54-56, line 98).

**402 challenge construction** — `packages/payments/src/x402.ts`, function `buildPaymentRequirements()` (line 118-139). Fields and their sources:
- `scheme: "exact"` — hardcoded; only scheme supported (`paymentSchemeSchema = z.enum(["exact"])`, line 28).
- `network` — passed straight from `options.network` (developer-supplied, `"stellar-testnet" | "stellar-mainnet"`, line 31).
- `maxAmountRequired` — the developer's `price`, minus an optional marketplace fee split via `splitFee()` (line 72-80, integer/atomic math, fee rounds down).
- `payTo` — developer-supplied Stellar address (`StellarAddress` = zod-validated `G[A-Z2-7]{55}` string, `packages/types/src/wallet.ts:5`).
- `asset` — `{ code: "USDC", issuer: options.issuer }` (line 134) — issuer is developer/env-supplied, not hardcoded in this function.
- `fee` — optional `{ payTo, amount }` leg (marketplace/Tael fee), same-transaction, non-custodial (line 45-49 comment).
- `resource` — the request path (from the SDK caller, `tael.ts:66`).
- `description` — developer-supplied, defaults to `""`.
- `maxTimeoutSeconds` — defaults to `60` (`paymentRequirementsSchema`, line 63) — **this default is never actually enforced anywhere in the verify path** (see below).

**`X-PAYMENT` decode/dispatch** — `decodePaymentHeader()` (`x402.ts:158-175`): base64-decodes, JSON-parses, validates against `paymentPayloadSchema` (`x402Version`, `scheme`, `network`, `payload.transaction` — a signed Stellar XDR string, line 90-100). Dispatch to a verifier happens in `verifyPayment()` (`packages/payments/src/verify.ts:32-48`), which first checks `scheme`/`network` match the requirements, then delegates the actual crypto/chain check to `verifier.verify(payload, requirements)`.

**The context object handlers receive** — `TaelContext` (`packages/sdk/src/tael.ts:15-18`):
```ts
export interface TaelContext {
  request: Request;
  receipt: SettlementReceipt;
}
```
And `SettlementReceipt` (`packages/payments/src/verify.ts:10-16`):
```ts
export interface SettlementReceipt {
  txHash: string;
  network: PaymentNetwork;
  settledAt: string;
  payer: string;
}
```

**Critical finding:** `SettlementReceipt` exposes `txHash` and `payer` (the settled tx hash and payer address — good), and `network`/`settledAt`, but **does NOT expose `amount` or `asset`**. A handler (or a third party reading the `X-PAYMENT-RESPONSE` header) cannot tell from the receipt itself how much was paid or in what asset — it must independently know the `PaymentRequirements` it originally advertised. The amount is tracked separately, internally, only in the API's own ledger (`apps/api/src/modules/payments/payment.service.ts` / `payment.repository.ts`, backed by the `payments` Postgres table) — not in the wire-level receipt object the SDK returns to arbitrary callers.

## 3. Verifiers — the settlement seam

**Interface** (`packages/payments/src/verify.ts:24-26`):
```ts
export interface PaymentVerifier {
  verify(payload: PaymentPayload, requirements: PaymentRequirements): Promise<SettlementReceipt>;
}
```

**`createMockVerifier()`** — `packages/payments/src/verify.ts:54-67`. Lives in `@tael/payments` (not `@tael/stellar`). Accepts *any* well-formed payload unconditionally — no signature check, no amount check, no chain interaction at all. It fabricates a `txHash` (`mock_<hex-of-transaction-string>`) and a `payer` (`mock_payer_<hex>`) purely by hashing the raw `payload.payload.transaction` string. Explicitly commented "For tests and the local playground only — never wire this into production" (line 51-53).

**Stellar-backed verifier** — there is **no `createStellarVerifier` inside `@tael/stellar`**. Contrary to what a reader might assume from ARCHITECTURE.md's clean-package-boundary narrative, the actual Stellar↔x402 adapter lives in the API app's composition root: `apps/api/src/container.ts`, function `createStellarVerifier(env: Env): PaymentVerifier` (lines 56-94). This is intentional per ARCHITECTURE.md:213 ("`payments` and `stellar` are siblings … their composition happens once, in `apps/api/src/container.ts`") — so the doc is accurate here, but a naive search for "createStellarVerifier" in `packages/stellar` would find nothing.

What "verified" concretely means (`container.ts:64-93`):
1. **Offline check first** (before touching the network): `verifyTransactionPayments()` from `@tael/stellar` (`packages/stellar/src/payment-verify.ts:29-75`) parses the signed XDR locally and checks that it contains a `payment` operation (not path payment, not any other op type) whose `asset.getCode() === "USDC"` and `asset.getIssuer() === usdcIssuer`, destination equals `requirements.payTo` (and, if a fee was configured, a second distinct payment op to `requirements.fee.payTo`), and amount `>= minAmount` for each leg. Each expected leg must match a **distinct** operation index (`used` Set, line 58-71) so one operation can't double-count for two legs.
2. **Only then** is the transaction **submitted** to Horizon: `settlement.submitSignedTransaction(payload.payload.transaction)` (`container.ts:85`, implemented in `packages/stellar/src/settlement.ts:29-47`, `StellarSettlement.submitSignedTransaction`) — i.e., **Tael's own server submits the client-signed transaction**; it is not merely confirming an already-broadcast tx. This is a "submit-and-verify-first" pattern, explicitly commented as guarding against "submit-and-trust" (`container.ts:67-68`).
3. SDK/RPC used: `@stellar/stellar-sdk` `^13.1.0`, via `Horizon.Server` (classic Horizon REST, not Soroban RPC) — `packages/stellar/src/settlement.ts:1,25`. Network config comes from `env.STELLAR_NETWORK` / `env.STELLAR_HORIZON_URL` / `env.USDC_ISSUER` (`apps/api/src/env.ts`), defaulting to Stellar testnet Horizon and a specific testnet USDC issuer.

**What is / isn't checked:**
- Amount match — yes, `>= minAmount` per leg (checks for *underpayment*; overpayment silently accepted, no upper bound).
- Asset/issuer match — yes, exact code `"USDC"` + exact issuer string equality.
- Destination match — yes, exact address equality per leg.
- Scheme/network match — yes, but only at the `verifyPayment()` orchestration layer (`packages/payments/src/verify.ts:37-46`), before the verifier is even called.
- **Double-spend / replay protection — not implemented.** Nothing in `verifyTransactionPayments`, `submitSignedTransaction`, or the Postgres `payments` schema (`packages/database/src/schema/payments.ts`) enforces uniqueness on `txHash` or the payload transaction. There's no application-level nonce/sequence tracking or "have we seen this XDR before" cache. The only thing that would stop a resubmitted transaction is Stellar's own sequence-number replay protection at the network level (if you resubmit the exact same signed tx, Horizon will just return the same result or a `tx_bad_seq`/already-applied error depending on timing) — Tael does not add its own layer on top.
- **Timeout/expiry** — `PaymentRequirements.maxTimeoutSeconds` (defaults to 60) is defined in the schema but **no code path reads or enforces it** anywhere in `packages/payments`, `packages/stellar`, or `apps/api` — it looks like a documented-but-unused field. Separately, the Stellar transaction itself carries `.setTimeout(120)` (2 minutes) when built by the payer (`packages/stellar/src/pay.ts:46`, and the testnet script `apps/api/src/scripts/testnet-pay.ts:72`), which is standard Stellar tx expiry (`timeBounds`), enforced by the network itself, not by Tael's verify logic.

## 4. On-chain settlement shape

**It is a classic Stellar `Operation.payment` (a SAC/classic-asset transfer), not a path payment or Soroban contract call.** Confirmed in three places: `packages/stellar/src/pay.ts:42-45` (`Operation.payment({ destination, asset: usdc, amount })`), `packages/stellar/src/payment-verify.ts:47-54` (filters `tx.operations` for `op.type === "payment"` specifically — a path-payment or Soroban invocation would be silently rejected, not matched), and the testnet fixtures (`apps/api/src/scripts/testnet-pay.ts:64-71`, `testnet-setup.ts`). Soroban is explicitly future work ("Soroban-ready" comment in `packages/stellar/src/index.ts:3`; ARCHITECTURE.md's Deferred Workspaces table lists `contracts/` as not-yet-built).

**No memo, tag, or on-chain marker of any kind.** Grepping the entire `packages/` and `apps/` trees for `memo`/`Memo` found zero matches related to Stellar transactions (only unrelated React `useMemo` hits). `TransactionBuilder` is used in `pay.ts`, `provision.ts`, `testnet-setup.ts`, and `testnet-pay.ts` and none of them call `.addMemo(...)`. **A settled Tael payment is a bare USDC transfer to `payTo` — there is nothing in the transaction itself (memo text/hash/id, or a distinguishing Soroban-contract call parameter) that attributes the payment to a specific capability, resource path, or invocation.** All of that attribution (`capabilityId`, `resource`) lives only in Tael's own off-chain Postgres ledger (`packages/database/src/schema/payments.ts`) and is populated after the fact by the gateway (`apps/api/src/modules/gateway/gateway.handler.ts:59-67`, `deps.payments.recordSettled(...)`), not from anything queryable on-chain.

**USDC asset identification in code:** always `{ code: "USDC", issuer: <address> }` via the Stellar SDK's classic `Asset` class (`packages/stellar/src/usdc.ts:7-9`, `new Asset("USDC", issuer)`) — this is the classic (non-SAC-contract) trustline-based asset representation, identified purely by asset code + issuer public key, **not** a Soroban contract ID.
- **Testnet issuer**: hardcoded default in two places — `.env.example` and `apps/api/src/env.ts:12` (`GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`) — same address, consistently used as the default `USDC_ISSUER`. Also used as the `ISSUER` constant in `packages/stellar/src/payment-verify.test.ts:14`. This does **not** look like Circle's official testnet USDC issuer — worth flagging: the operator script `testnet-setup.ts` actually mints its *own* throwaway test-USDC asset with a freshly generated issuer keypair rather than using any canonical faucet asset, meaning "USDC" as configured here can be an arbitrary self-issued test asset, not necessarily interoperable with any other testnet USDC.
- **Mainnet issuer**: not present anywhere in code or `.env.example` (which only documents the testnet default) — there's no evidence a real Circle mainnet USDC issuer address has been wired in yet. This is consistent with README's roadmap marking "Soroban contracts, mainnet" as Phase 3 (not yet built).
- Network selection flows via `STELLAR_NETWORK` (`"testnet" | "mainnet"`, `apps/api/src/env.ts:9`) into `networkPassphrase()` (`packages/stellar/src/config.ts:15-17`, mapping to `Networks.PUBLIC` or `Networks.TESTNET`) and into the payments-layer `PaymentNetwork` enum `"stellar-testnet" | "stellar-mainnet"` via `toPaymentNetwork()` (`container.ts:51-53`).

**Could Fianza deterministically index a `payTo` address's settled Tael receipts from on-chain data alone?** No, not reliably. Given only a Stellar address and its transaction history, a third party can see: incoming USDC payment ops, their amounts, senders, and timestamps/ledger sequence — that much is public and indexable via Horizon or any Stellar indexer. But it **cannot** distinguish a Tael-mediated payment from any other unrelated USDC transfer to that same address, because:
- There's no memo, no distinguishing source-account pattern (the SDK doesn't route payments through any Tael-controlled intermediary address — Tael is explicitly "non-custodial," funds move agent-wallet → developer-wallet directly per README's Security section), and no on-chain reference to `capabilityId`/`resource`/`x402` at all.
- The only place resource/capability attribution exists is Tael's private Postgres `payments` table, which is not exposed as any public API (no unauthenticated/public payments-list endpoint was found in `apps/api/src/modules/payments/payment.router.ts`).
- Practical implication for Fianza: to attribute a specific on-chain payment to a specific Tael invocation, Fianza would need either (a) access to Tael's private ledger/API (an explicit integration, not passive on-chain observation), or (b) Tael to add a memo/tag in a future version. As shipped today, on-chain data alone gives amount + sender + recipient + time, not "this was a Tael payment for resource X."

## 5. The buyer/client side

**There is no packaged client-side SDK for the paying agent.** No `packages/agent`, `packages/mcp`, or similar exists — ARCHITECTURE.md's own "Deferred workspaces" table (line 348) lists `packages/mcp`, `packages/agent` as future Phase 3 work, not yet scaffolded. This matches the code: `packages/sdk` only implements the **server/developer** side (`tael()`/`createTael()`); nothing in `packages/sdk/src` builds or signs a payment.

**Payment-construction code that does exist** (test/fixture/example-only, not shipped as a consumable SDK):
- `packages/stellar/src/pay.ts`, `buildSignedPayment()` (lines 25-49) — builds and signs a multi-leg USDC payment transaction from a raw `secret` (Stellar seed) against a live Horizon account, returns base64 XDR. This is a **library-internal helper**, exported from `@tael/stellar`'s `index.ts`, so it is technically importable by an external payer, but it's clearly written for server-side/operator use (it takes a raw secret key as a parameter) rather than as an ergonomic client SDK.
- `apps/api/src/scripts/testnet-pay.ts` — an **operator script**, not a package, demonstrating the entire buyer flow end to end: fetch the 402 challenge → build a `TransactionBuilder` with `Operation.payment` for the builder leg (and fee leg if present) using the Stellar SDK directly → `tx.sign(payer)` → base64-JSON-encode `{ x402Version, scheme: "exact", network, payload: { transaction: tx.toXDR() } }` → send as `X-PAYMENT` header → retry the call. This is effectively the reference implementation of "how to be an x402 payer against Tael," but it's a `pnpm --filter @tael/api pay:testnet` CLI script, not an importable/publishable library.
- No test fixtures encode signing via Freighter/other real wallets — everything (`tael.test.ts`, `gateway.test.ts`) uses `createMockVerifier()` with a fake `"AAAA-signed-xdr"` string, sidestepping real signing entirely on the server side.

**Conclusion: payment construction is left to the caller**, exactly as the README's positioning implies, and the actual reference logic for doing so correctly lives only in an internal ops script, not a distributed package.

## 6. Config, networks, extension points

**Network selection flow:** `STELLAR_NETWORK` env var (`"testnet"|"mainnet"`, `apps/api/src/env.ts:9`) → `StellarConfig.network` / `StellarNetwork` type (`packages/stellar/src/config.ts:4-6`) → `networkPassphrase()` maps to the Stellar SDK's `Networks.PUBLIC`/`Networks.TESTNET` constant → separately, `toPaymentNetwork()` in `container.ts:51-53` re-maps the same value into the x402-level `PaymentNetwork` string enum (`"stellar-testnet"|"stellar-mainnet"`) used in `PaymentRequirements.network` and `SettlementReceipt.network`. There are thus **two parallel network-type representations** (`StellarNetwork` in `@tael/stellar` vs. `PaymentNetwork` in `@tael/payments`) reconciled only at the composition root — a seam an integrator needs to be aware of if hooking in anywhere except `container.ts`.

**Env vars** (`.env.example`, cross-checked against `apps/api/src/env.ts` which is "the source of truth" per ARCHITECTURE.md:284):
- Actually validated/used by the API: `NODE_ENV`, `API_PORT`, `API_PUBLIC_URL`, `STELLAR_NETWORK`, `STELLAR_HORIZON_URL`, `USDC_ISSUER`, `DATABASE_URL`, `ENCRYPTION_KEY`, `TAEL_FEE_ADDRESS`, `TAEL_FEE_BPS` (`apps/api/src/env.ts:8-24`).
- **Present in `.env.example` but NOT in `env.ts`'s schema (i.e., documented but currently dead/unused by the code)**: `STELLAR_RPC_URL` (Soroban RPC — unused since settlement is classic-Horizon-only today) and `X402_FACILITATOR_URL` ("Facilitator that verifies/settles x402 payment proofs" — there is no facilitator abstraction anywhere in the actual code; verification is done in-process via `createStellarVerifier`/`createMockVerifier`, not delegated to an external facilitator service). This is a doc/code mismatch worth flagging explicitly.
- No private keys are stored in env for the platform itself; agent/hot-wallet secrets are generated per-wallet (`packages/stellar/src/keypair.ts`) and expected to be encrypted at rest via `@tael/database`'s `ENCRYPTION_KEY` (AES-256-GCM per `capabilities.ts:73` comment) — not env-configured secrets.

**Extension points a third party could implement without forking:**
- **`PaymentVerifier`** (`packages/payments/src/verify.ts:24-26`) — the primary seam. Anyone (including Fianza) can implement `{ verify(payload, requirements): Promise<SettlementReceipt> }` and pass it into `tael({ verifier: ... })` or `createTael({ verifier: ... })`. This is the cleanest integration point — e.g., a Fianza-aware verifier could intercept/augment settlement, check a credit line before allowing settlement, or wrap the Stellar verifier to add its own attribution/logging.
- **Receipt/settlement callback** — no formal hook exists; the closest analog is that `tael()`'s `handler` receives `{ request, receipt }` (`TaelContext`) after verification, so a developer's own handler can log/forward the receipt, but there's no dedicated `onSettled` callback in the SDK itself — you'd have to wrap the `handler` yourself, or wrap/compose the `verifier`.
- **Middleware** — none formalized; `apps/api` uses Hono, so ordinary Hono middleware could sit in front of `handleGatewayRequest`, but nothing in `@tael/sdk` exposes a middleware chain concept.
- **Fee leg mechanism** (`TaelOptions.fee` / `requirements.fee`) is itself a reusable extension pattern — a same-transaction atomic side-payment already exists for Tael's own marketplace fee; a similar additional leg could plausibly be adapted for a Fianza underwriting fee/spread if Fianza wanted an on-chain-atomic cut, though this would require code changes (the `fee` field currently supports exactly one extra leg, hardcoded to a single `{ payTo, bps }`).

## 7. Tests, examples, maturity

**Testing:** Vitest throughout, colocated `*.test.ts` files. Confirmed test files: `packages/types/src/money.test.ts`, `packages/payments/src/x402.test.ts`, `packages/sdk/src/tael.test.ts`, `packages/stellar/src/{keypair,payment-verify,stellar,verify}.test.ts`, `packages/auth/src/auth.test.ts`, `apps/api/src/{server,modules/wallets/wallet.service,modules/gateway/gateway}.test.ts`.
- SDK-level and gateway-level tests (`tael.test.ts`, `gateway.test.ts`) exclusively use `createMockVerifier()` — **no test exercises the real Stellar verifier path** (`createStellarVerifier`) end-to-end within the automated suite.
- `packages/stellar/src/payment-verify.test.ts` does test the **offline XDR-parsing logic** (`verifyTransactionPayments`) thoroughly against real Stellar-SDK-built transactions (unsigned network calls, using `Account(pubkey, "0")` as a synthetic account) — good coverage of amount/asset/issuer/destination matching and rejection cases — but this test never calls Horizon or submits anything.
- **Real end-to-end chain testing exists only as a manual operator flow**: `apps/api/src/scripts/testnet-setup.ts` + `testnet-pay.ts`, explicitly documented as "Proves the REAL settlement path... not the dev mock verifier," run manually via `pnpm --filter @tael/api pay:testnet` against live Stellar testnet/Horizon + friendbot. This is not part of CI (`.github/workflows/ci.yml` only runs `pnpm lint && pnpm typecheck && pnpm test && pnpm build`, all of which use the mock verifier).

**Runnable examples/quickstarts:** the README's SDK example (`import { tael } from "@tael/sdk"; export default tael({ price: "0.02", handler: myApi })`) is illustrative only — no standalone `examples/` directory exists. The closest thing to a runnable example is the `apps/api` gateway itself plus the `testnet-pay.ts`/`testnet-setup.ts` scripts.

**Maturity assessment: early prototype / pre-production, well-organized but with real gaps for a payments product.** Evidence:
- Production settlement path (`createStellarVerifier`) is gated behind `NODE_ENV === "production"` (`container.ts:110`) and has **zero automated test coverage** of its own composition logic (only its sub-pieces are unit-tested separately).
- No double-spend/replay protection at the application layer (confirmed above) — a payment could plausibly be recorded twice from the same underlying transaction if the verify/record flow were retried, since neither the DB schema nor the verifier enforces `txHash` uniqueness.
- `X402_FACILITATOR_URL` and `STELLAR_RPC_URL` are documented in `.env.example` as if they matter but are dead in the code — signs of aspirational/outdated documentation drifting from implementation.
- Mainnet USDC issuer is not configured anywhere; only a testnet placeholder issuer exists, and the "testnet setup" script actually mints a wholly custom test asset rather than integrating any canonical testnet USDC faucet.
- All package versions are still `0.0.0` — nothing has been published to npm despite the Changesets release pipeline existing.
- No memo/on-chain attribution mechanism (a real product gap, not just immaturity, if third parties are expected to reconcile payments from chain data).
- On the positive side: the DDD/ports-and-adapters structure is unusually disciplined for this stage (clean `PaymentVerifier` interface, in-memory vs. Postgres repository swapping, SSRF guarding on upstream proxying in `upstream.ts`, careful stripping of the `X-PAYMENT`/`authorization` headers before forwarding to upstreams), CI enforces lint/typecheck/test/build on every PR, and the fee-splitting math is done in integer/atomic units to avoid floating-point payment bugs (`Money` class, `splitFee()`). This reads as a well-engineered early-stage prototype, not a hackathon dump — but it is clearly pre-production for the on-chain settlement path specifically.

---

## Integration-relevant summary

1. **Settlement is a bare classic Stellar `Operation.payment` in USDC (asset code + issuer, not a Soroban SAC contract call) — with no memo, tag, or any on-chain reference to the resource/invocation being paid for.** (`packages/stellar/src/pay.ts:42-45`, `payment-verify.ts:47-54`). Fianza cannot reconstruct "this on-chain transfer was a Tael payment for capability X" from chain data alone; it needs an off-chain feed from Tael (its private Postgres `payments` ledger) or a protocol change (a memo) to attribute revenue landing at a `payTo` address.

2. **The settlement receipt the SDK returns (`SettlementReceipt`) exposes `txHash`, `payer`, `network`, `settledAt` — but NOT `amount` or `asset`.** (`packages/payments/src/verify.ts:10-16`). Amount tracking exists only in Tael's private ledger. If Fianza wants to underwrite based on revenue landing at a `payTo` address in real time via the SDK layer (rather than chain-scanning), it would need Tael to either extend the receipt shape or expose the ledger via an API — neither exists today.

3. **`PaymentVerifier` is a clean, swappable interface** (`{ verify(payload, requirements): Promise<SettlementReceipt> }`, `packages/payments/src/verify.ts:24-26`) that any credit layer can implement or wrap without forking — e.g., a Fianza-aware verifier could gate settlement on an available credit line before ever hitting Stellar, or wrap the existing Stellar verifier to add underwriting-relevant logging. This is the single best integration seam in the codebase.

4. **No double-spend/replay protection at the application layer** — no `txHash` uniqueness constraint in the DB (`packages/database/src/schema/payments.ts`), no nonce/idempotency tracking in `verifyTransactionPayments` or `submitSignedTransaction`. Anything Fianza builds that assumes "one signed tx → exactly one recorded/billed settlement" needs its own idempotency guarantee; it cannot rely on Tael's.

5. **There is no client-side agent SDK.** Payment construction (building and signing the Stellar XDR, encoding the `X-PAYMENT` header) is entirely left to the caller today; the only reference implementation is an internal operator script (`apps/api/src/scripts/testnet-pay.ts`), not a published package. This is exactly the gap Fianza's "agents pay on borrowed funds" model would need to fill — there's no existing agent-side wallet/signing abstraction to plug credit into or compete with; Fianza would be introducing the first real client SDK for this ecosystem.

6. **The fee-leg mechanism (`TaelOptions.fee` / `PaymentRequirements.fee`) already proves out same-transaction, atomic, non-custodial side-payments** (used today for Tael's own marketplace fee, `splitFee()` in `packages/payments/src/x402.ts:72-80`). This is a plausible template for a Fianza underwriting fee/spread leg, though currently hardcoded to support exactly one extra leg.

7. **Mainnet is not wired up at all** — only a testnet default USDC issuer exists (and it's a self-issued test asset per `testnet-setup.ts`, not a canonical faucet asset); there's no mainnet Circle USDC issuer address anywhere in config or code. Any integration plan needs to account for this being pre-mainnet.

8. **Verification submits the transaction itself** (Tael's server, not the payer, broadcasts to Horizon) after an offline pre-check of amount/asset/destination per leg (`apps/api/src/container.ts:56-94`, `packages/stellar/src/payment-verify.ts`). Underpayment is rejected; overpayment and unexpected extra operations in the same tx are not specially handled either way. `maxTimeoutSeconds` is defined in the schema but appears unenforced anywhere in the verify path — worth confirming with the Tael team before relying on it for any credit-expiry logic.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                