# TrustLine × Tael — Partnership Brief

_Draft — 2026-07-14, updated 2026-07-16. Author: TrustLine. Status: Tael has
replied in-kind (`trustline-partnership.html`, unverified provenance) and, per
a fresh pull of `rahulsainlll/tael-protocol` main, has already shipped the
attribution fix this brief asked for. Angle B is now unblocked on their side.
On our side: revenue indexing (Angle B) is implemented
(`backend/src/integrations/tael.ts`), and Phase 0's proof demo is DONE and
passing on real testnet Horizon — which also surfaced and fixed a genuine
protocol incompatibility in `payWithCredit` (see Angle A2 below)._

## TL;DR

**Tael is the cash register. TrustLine is the bank that reads it.**

Tael answers _"how does an autonomous agent get paid for its API."_ It has no
answer for the two questions that come right after:

1. _"What if the paying agent's wallet is empty?"_ — today, the payment just
   fails and the request dies.
2. _"What can an earning agent do with the revenue Tael settles for it?"_ —
   today, nothing; it's just USDC sitting in a wallet.

TrustLine is both answers. We give buyer-side agents a **credit line** so they
can always afford Tael's tolls, and we give seller-side agents **revenue-based
underwriting** that turns the income Tael settles for them into borrowing power.
Both sides run on the exact same rails Tael already uses — x402 payments in
Stellar USDC, testnet and mainnet. No bridge, no new chain, no new asset.

---

## Why this is a clean fit (not a forced one)

Tael and TrustLine already speak the identical primitive:

| | Tael | TrustLine |
|---|---|---|
| Protocol | x402 / HTTP-402 | x402 / HTTP-402 (`@x402/stellar`, `@x402/fetch`) |
| Chain | Stellar (testnet + mainnet) | Stellar (testnet + mainnet) |
| Asset | USDC (classic, issuer `GBBD47IF...`) | USDC (classic, same issuer `GBBD47IF...`) |
| Scheme | `exact` | `exact` |
| Auth model | payment-as-auth (agent signs, no keys) | agent holds its own key, signs every write |

There is no integration seam to bridge. Tael emits exactly the on-chain payment
events TrustLine already indexes and underwrites against. Confirmed directly
against both `.env.example` files: Tael's testnet `USDC_ISSUER` and TrustLine's
own `USDC_TESTNET_ISSUER` are the **same address** — the shared, well-known
Circle testnet issuer. Unlike DeFindex, there is no testnet asset fragmentation
between Tael and TrustLine to work around, on testnet or mainnet.

**What each side is missing that the other has:**

- Tael has a rich, verifiable **revenue signal** (every `receipt.payer` /
  tx-hash it settles) but **no credit product** to do anything with it.
- TrustLine has a **credit product** built precisely to score on-chain agent
  revenue — but needs a **revenue source** worth underwriting. Tael is a
  revenue-manufacturing machine.

Neither can build the loop alone. Together it closes on one chain, one asset.

> **Grounded in their code — re-verified 2026-07-16 against `main`.** The
> original scan (2026-07-14) found bare, unattributed settlements. A fresh
> `git pull` of `rahulsainlll/tael-protocol` shows they've since shipped the
> exact fix: every settlement now carries a `TAEL_MEMO = "tael"` Stellar text
> memo (`packages/stellar/src/pay.ts:17`, applied in
> `apps/dashboard/features/agents/run-capability.ts:132`);
> `SettlementReceipt` now includes `amount` and `asset`
> (`packages/payments/src/verify.ts:9-20`); and settlement rows carry a
> `uniqueIndex` on `txHash` with `onConflictDoNothing`
> (`packages/database/src/schema/payments.ts:39-40`,
> `apps/api/src/modules/payments/payment.repository.ts:66`) — replay
> protection, also asked for, also shipped. `PaymentVerifier` remains a
> **clean swappable interface** (`packages/payments/src/verify.ts:24-26`).
> There is still **no client-side agent SDK** — payment construction is
> server-side only, inside their own dashboard actions. **Not yet shipped**,
> despite being described in their reply: any credit UI on the wallet page
> (`apps/dashboard/app/(dashboard)/wallet/page.tsx` shows only USDC/XLM), and
> any non-marketplace capability kind or nav section for a financial add-on
> (`apps/dashboard/features/navigation/nav.config.ts` has four fixed groups,
> none of them credit; `capabilityKindSchema` is still the fixed
> `api\|mcp\|agent\|model\|dataset` enum).

---

## Angle A — Credit as a drop-in verifier (fills Tael's "broke agent" gap)

Tael's payment flow has a silent assumption: the paying agent **already holds
USDC**. The x402 step "agent signs a USDC transfer" simply fails against an
empty wallet. Tael has no fallback — and (confirmed by the scan) **no
buyer-side client SDK at all**; payment construction is left entirely to the
caller, demonstrated only by an internal ops script.

There are two ways TrustLine closes this, and the scan makes clear which is
cleaner:

**A1 — the drop-in verifier — corrected (2026-07-16).** Designing this against
the real `lending_vault` contract surfaced a hard constraint: a `PaymentVerifier`
only ever receives an **already client-signed transaction**. It cannot make an
underfunded payment succeed after the fact — there's no way to retroactively
enlarge a signature. And `lending_vault.borrow()` pays credit **into the
borrowing agent's own wallet** (by design — a vault can't pay a third party on
an agent's behalf without bypassing that agent's signing authority; see
`contracts/lending_vault/src/lib.rs:363`). So "gate settlement on a credit
line" at the verifier layer can only mean one thing: **Tael's own gateway
would need to hold a TrustLine-registered agent identity** and front
underfunded calls itself, reconciling with the real payer later — a real
feature, but a much heavier one than a config swap, and it changes who's
borrowing (Tael's platform wallet, not the end user's agent). **The credit
draw has to happen before signing — client-side, which is exactly what A2
already does.** Angle A1 as originally pitched (drop-in verifier, zero
new integration) doesn't hold up; A2 is the real, working mechanism.

**A2 — the buyer-side client (`payWithCredit`).** TrustLine's SDK ships the
missing client Tael doesn't have. Its flagship `payWithCredit(url, price)` does
draw-on-402:

```
payWithCredit(url, price)
  balance ≥ price ?  → pay over x402
  balance < price ?  → borrow the shortfall against the agent's line, THEN pay
```

The agent never "decides to borrow" — it just transacts, and the credit line
silently covers what its cash can't.

> **Correction (2026-07-16) — this is NOT zero new code.** Reading both SDKs
> side by side (not just the docs) surfaced a real incompatibility:
> `payWithCredit` builds its x402 payment via `@x402/stellar`'s
> `ExactStellarScheme`, which treats `requirements.asset` as a **Soroban
> contract address** and signs an `AssembledTransaction` invoking that
> contract's SEP-41 `transfer` (`node_modules/@x402/stellar/.../exact/client/index.js:171-181`).
> Tael's `buildPaymentRequirements` emits `asset: { code: "USDC", issuer }` — a
> **classic asset descriptor** — and its verifier
> (`packages/stellar/src/payment-verify.ts:verifyTransactionPayments`) only
> recognizes a classic `Operation.payment`
> (`tael-protocol/packages/api/src/container.ts:56-98`). Same envelope shape
> (`{ x402Version, scheme, network, payload: { transaction } }`), genuinely
> different transaction contents. `payWithCredit` pointed at a live Tael
> endpoint today would fail decoding the challenge, before payment is even
> attempted. **We need a Tael-compatible payment builder inside the SDK** —
> either a second scheme/adapter in `payWithCredit` that builds a classic
> `Operation.payment` when `requirements.asset` looks like `{code, issuer}`,
> or a Tael-specific helper. This is real, scoped work, not a demo detail.

A1 and A2 compose: A2 is what the agent runs, A1 is what the service trusts.

> **Pitch line:** Tael turns any API into a paid API. TrustLine makes sure the
> agent can always afford it.

---

## Angle B — Revenue-based underwriting for sellers (the structural one)

Think about what an agent that wraps its service in Tael _is_: a machine with a
**verifiable, on-chain, growing USDC revenue stream.** Every payment Tael
settles lands at that agent's Stellar `payTo` address, stamped on-chain with a
tx hash.

That stream is _exactly and only_ what TrustLine's underwriter scores.
TrustLine's thesis is "credit for agents based on real, verifiable, on-chain
revenue." Tael is the machine that manufactures that revenue and writes it to
the ledger TrustLine already reads.

> **Update — this blocker is resolved.** As of the 2026-07-16 re-verification,
> Tael settlements carry the `TAEL_MEMO` Stellar memo and `SettlementReceipt`
> includes `amount`/`asset` (see the grounding note above). TrustLine can
> already index a `payTo` address's Tael revenue self-attributingly, today,
> with no further dependency on Tael. Angle B is now purely a build item on
> **our** side — see Phase 2 below, which moved up accordingly.

**The flywheel (payments are attributable today):**

1. Agent wraps its API with Tael → starts earning USDC from other agents.
2. That revenue history _is_ its creditworthiness. TrustLine indexes the
   `payTo` address, sees consistent income, and underwrites a credit line
   against it.
3. Agent borrows against future Tael earnings — to pay its own upstream costs
   (compute, other paid APIs, Tael-wrapped tools it _consumes_) or to scale
   capacity.
4. It repays out of ongoing Tael revenue. On-time repayment ramps the limit up;
   more capacity → serves more → earns more Tael revenue → bigger line.

This is **revenue-based financing for AI agents**, where Tael is the
point-of-sale and TrustLine is the lender reading the till.

**The lending side falls out for free:** a Tael operator with _surplus_ revenue
is a natural **lender** into TrustLine vaults — earning yield on the very USDC
Tael just settled for them, redeployed as credit to other agents in the same
economy. The money never leaves the Tael/TrustLine loop.

---

## What we'd build (proposed, phased — updated 2026-07-16)

**Phase 0 — proof demo. ✅ DONE, running on real testnet Horizon.** Built and
ran end-to-end: `agents/demo/tael-capability-server.mjs` (a capability that
reimplements Tael's real `verifyTransactionPayments` check + memo attribution
verbatim from their source, settling for real — no mock verifier) and
`agents/demo/tael-demo.mjs` (a TrustLine agent, zero USDC balance, calling it
via `payWithCredit`). This is what surfaced the A2 incompatibility above and
proved the fix: the agent borrowed on-demand, `payWithCredit` correctly
detected the Tael-shaped classic-asset challenge, built and signed a classic
`Operation.payment` with the `tael` memo, and it **settled successfully on
testnet Horizon** — confirmed via `GET /transactions/{hash}`:
`successful: true`, `memo: "tael" (text)`, correct payer. Real tx hash:
`736e4b69561725b3448adb62e4bf3524bf30511f6fc13715ebccfa10ef0b5adf`.

**Phase 1 — revenue underwriting (unblocked now, moved up).** Tael's
attribution fix already shipped — `TAEL_MEMO` + `amount`/`asset` on
`SettlementReceipt` + `txHash` replay protection are all live on `main`. This
phase is now purely **our** build: point TrustLine's underwriter at a `payTo`
address, filter its Horizon payment history for `TAEL_MEMO`-tagged transfers,
and score that stream as revenue. No dependency on Tael, no timeline risk from
their side.

**Phase 2 — the runCapability() credit fallback (ours to build or propose as a
PR).** Tael's own `runCapability()` server action
(`apps/dashboard/features/agents/run-capability.ts:112-119`) already has the
exact failure point our credit line should intercept: today, if an agent
wallet's USDC balance can't cover a capability's price, the call just fails
with "Not enough USDC… Fund it first." We add a TrustLine credit-draw fallback
right there — check `availableCreditUsdc()`, `borrow()` the shortfall, then
fall through to the existing sign-and-pay path. This is `payWithCredit`'s logic
transplanted into Tael's own runner, not a new capability card.

**Phase 3 — corrected: no standalone drop-in verifier.** Superseded by the A1
correction above — a `PaymentVerifier` can't retroactively cover an
underfunded, already-signed payment, and `lending_vault.borrow()` intentionally
only pays into the borrowing agent's own wallet. Phase 2 (the `runCapability()`
fallback) is the actual mechanism; there's no separate verifier-only path to
ship on top of it. If Tael wants credit-backed payment acceptance in a context
*other* than their own dashboard runner (e.g. a future self-hosted `tael.paid()`
route), that would need the same shape as Phase 2 — draw credit into the
payer's wallet before it signs — implemented at whatever call site builds the
client's transaction, not inside `PaymentVerifier`.

**Phase 4 — credit surfaced in product (needs Tael's UI work).** A credit
widget on the wallet page (`apps/dashboard/app/(dashboard)/wallet/page.tsx`)
showing limit/used/available beside the USDC balance, and TrustLine listed as
a first-class capability/add-on — **not** as a 6th `capabilityKind` (it doesn't
fit the one-price-one-call model the kind enum assumes), but as its own
section, the way their reply described it. This is Tael's build; we support
with a documented API surface.

**Phase 5 — co-marketed SDK surface.** Document TrustLine as the recommended
buyer-side client for consuming Tael services on credit, and TrustLine
underwriting as the recommended financing layer for Tael sellers.

---

## The ask to Tael (updated 2026-07-16 — technical blockers are resolved)

**~~Technical~~ — done, confirmed on `main`:**
- ~~Memo/tag convention~~ → shipped as `TAEL_MEMO`.
- ~~Amount and asset on `SettlementReceipt`~~ → shipped.
- ~~`txHash` uniqueness / replay protection~~ → shipped (`uniqueIndex` +
  `onConflictDoNothing`).

**Still outstanding — product surface (theirs to build, ours to spec with
them):**
- A credit line widget on the wallet page, next to the USDC balance —
  matches what their reply described, not yet in the code.
- A way to expose "credit as a capability" that isn't the existing
  `capabilityKind` enum — that enum is one-price-one-call; credit is a
  standing relationship. Needs its own section/primitive, likely alongside
  API Keys/Settings in the nav, not the Marketplace grid.
- Reviewing/accepting a PR against `run-capability.ts`'s balance-check
  fallback (Phase 2) — this is the real mechanism (see the A1 correction
  above: a standalone `PaymentVerifier` can't do this; the credit draw has
  to happen before the client signs). Could land without any dashboard UI
  work at all.

**Collaboration:**
- A testnet Tael-wrapped endpoint we can point the demo agent at.
- Mainnet coordination when Tael wires it up (still testnet-only per
  `packages/stellar/src/config.ts`, on a self-issued test USDC rather than
  Circle's canonical asset — this hasn't changed).
- Willingness to co-document: Tael docs reference TrustLine as the buyer-side
  credit client and seller-side financing layer; TrustLine docs reference Tael
  as a first-class revenue source and paid-service ecosystem.

---

## One-line summary

> Tael answers "how does an agent get paid." It has no answer for "what if the
> agent can't pay" or "what can the agent do with what it earns." TrustLine is
> both answers — a credit line so agents can always afford your tolls, and
> revenue-based underwriting that turns the income you settle into borrowing
> power. You're the cash register; we're the bank that reads it.
