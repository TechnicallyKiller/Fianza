# TrustLine ↔ Tael: what the spec asked for vs. what exists

_A side-by-side of Tael's `trustline-loan-integration.md` (the three routes:
check / borrow / repay + the open questions) against what is actually built and
tested today — plus the two things that were making "borrow doesn't work," and
exactly how to close the gap. Checked against tael-protocol `origin/main`
(c96b035) and TrustLine as deployed._

---

## TL;DR

- **check-available-credit:** ✅ works. Minor response-shape polish to match the
  spec's exact field names.
- **borrow:** ✅ works — once **two config things are fixed** (below). The code
  is correct; it was failing for environmental reasons, not logic.
- **repay:** ⚠️ was missing on Tael's side; **this PR adds it** (opportunistic
  repay-from-spare-cash after a successful call).
- **default:** ✅ works, proven live on testnet (`mark_default`).

## The two things that made "borrow doesn't work" (both now addressed)

**1. Stale npm SDK (fixed by publishing 0.2.1).**
Tael's dashboard installs `@trustline-agents/agent-sdk@^0.2.0`. The published
`0.2.0` was an older build **without the treasury auto-seed** in `borrow()`. So
`tl.borrow()` drew against an **empty vault** → `InsufficientLiquidity` →
"borrow doesn't work." Fixed by publishing **0.2.1** (contains the auto-seed).
**Action for Tael:** reinstall so `^0.2.0` resolves to `0.2.1`
(`pnpm i @trustline-agents/agent-sdk@latest`).

**2. USDC issuer mismatch (config on Tael's side).**
On Stellar an asset is `(code, issuer)` — same code, different issuer = a
different, non-interchangeable token. Today:

| Issuer | Used by |
|---|---|
| `GBBD47IF…` (SDF canonical testnet USDC) | **all of TrustLine**, and Tael's **API** default (`apps/api/src/env.ts`) |
| `GBCDXWBE…` | Tael's **dashboard buy-side** default (`run-capability.ts`, `pay.ts`, `swap.ts`, `horizon.ts`: `USDC_ISSUER ?? "GBCDXWBE…"`) |
| `GC62IXD4…` | **only a FEE_ADDRESS in test files** — NOT a USDC issuer |

So the dashboard can borrow `GBBD47IF` USDC from the vault but then try to
pay/settle in `GBCDXWBE` USDC — mismatch. **Action for Tael:** set
`USDC_ISSUER=GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` in the
dashboard app's env so buy-side, API, and TrustLine all use the same dollar on
testnet.

> Note on "add trustline to `GC62IXD4…`": that address is a **fee-collection
> wallet** in Tael's own test files, not a USDC issuer. Adding a trustline to it
> won't help. The issuer to align on is `GBBD47IF…`.

---

## Route 1 — check-available-credit (free read)

**Spec asked for:** a free, authenticated read returning `availableUsdc`,
`outstandingUsdc`, `eligibleToBorrow`, tier, apr, as decimal strings; identity
verified via HMAC.

| Item | Status |
|---|---|
| Endpoint returning live underwrite | ✅ `GET /agent/:address/available-credit` (`previewCredit`) |
| HMAC identity verification | ✅ `verifyTaelSignature` (spec §5.1) |
| Tier / limit / APR / revenue / payers | ✅ returned |
| Exact field names (`availableUsdc`, `outstandingUsdc`, `eligibleToBorrow`) | ⚠️ we return `rampedLimitUsdc`/`limitUsdc`/… as numbers — small mapping tweak |
| Decimal strings vs numbers | ⚠️ cosmetic — easy |
| Free (not priced) | ⚠️ Tael-side: forward identity on free authenticated calls (their §5.2) |

**Gap:** trivial response-shape alignment. **Owner:** TrustLine (fields) + Tael
(free-call identity forwarding).

## Route 2 — borrow / draw (the priced action)

**Spec asked for:** Card calls borrow; TrustLine disburses; loan tracked;
origination fee; repayment later.

**What exists (and is better than the spec's off-chain model):** the borrow is
**agent-signed and vault-backed**, fully on-chain:

| Item | Status |
|---|---|
| Shortfall detection on a call | ✅ `run-capability.ts` (`allowCreditDraw`) |
| Draw the shortfall from the credit line | ✅ `tryDrawTrustLineCredit` → `tl.borrow()` |
| Underwrite BEFORE lending | ✅ checks `availableCreditUsdc()`, refuses if `< shortfall` |
| Owner consent to take on debt | ✅ `policy.allowCreditDraw` (off by default) |
| Per-call / daily caps enforced first | ✅ `maxPerCall` + rolling `dailyLimit` |
| On-chain debt, interest, ramp, yield | ✅ vault contract |
| Vault liquidity seeded so a draw can go through | ✅ treasury `ensure-liquidity` (auto-seeds in `borrow()` as of SDK 0.2.1) |

**The spec's "borrow = unsigned treasury push, off-chain loan" is NOT what we
built — and we recommend keeping the on-chain, agent-signed model.** The Card
*can* sign its own credit draw (it signs Pay/Swap already); framing it as "the
agent draws its own line" dissolves the spec's "the Card can't sign a
disbursement" concern, and reuses both sides' tested code instead of building a
parallel off-chain lender. Proven live end-to-end (borrow → spend → repay →
default) on testnet.

**Gap:** none in logic — it was the two config issues above. **Owner:** Tael
(reinstall SDK + set `USDC_ISSUER`).

## Route 3 — repay (free action)

**Spec asked for:** agent repays; loan closed; on-time repayment improves
standing.

| Item | Status |
|---|---|
| On-chain `repay()` (interest-first → reserve + lender yield) | ✅ vault contract |
| Ramp: on-time repay grows the limit | ✅ vault contract |
| A TRIGGER on Tael's side to actually repay | ❌ was missing → **added by this PR** |

**This PR (`feat/trustline-repay`)** adds `maybeRepayTrustLineCredit` to
`run-capability.ts`: after any successful call, if the agent holds spare cash
above a working buffer (its `maxPerCall`) and still owes TrustLine, it repays
`min(owed, spare)` on-chain. Same opt-in gates as borrow
(`TRUSTLINE_API` + `allowCreditDraw`); best-effort so it never affects the call.

**Why opportunistic (not "repay-on-earning"):** the truest trigger is when the
Card is *paid* (a `payee` row in the gateway settlement path), but that lives in
`apps/api` — a bigger, cross-package change. Repaying after the agent's next
*action* is self-contained, mergeable, and catches the common case (an active
agent transacts often). The gateway-settlement hook is the recommended
follow-up (see `TAEL_REPAY_SKETCH.md`) if opportunistic isn't aggressive enough.

## Route 4 — default (not in the original spec, but essential)

| Item | Status |
|---|---|
| Overdue loan → `mark_default` (reserve absorbs, rest socialized to lenders, agent frozen) | ✅ vault contract, **proven live** (tx on testnet) |

This is the answer to "what if they don't pay?" — real, on-chain, demoable.

---

## Answers to the spec's open questions (§10)

1. **Disbursement:** agent-signed from its own vault, NOT a treasury→Card push.
   Same issuer as Tael once aligned to `GBBD47IF`.
2. **Repay reconciliation:** on-chain `repay()` — no memo-watcher needed.
3. **APR accrual:** simple interest, per-second, utilization-adjusted, on-chain.
4. **Origination fee:** none today; repaid interest splits 20% reserve / 80%
   lender yield. A flat origination fee would be new.
5. **HMAC vs secret-sharing:** ✅ HMAC, already built and preferred.
6. **One open loan vs many:** vault tracks one rolling `principal` per agent —
   "one open loan" maps naturally.

## The short to-do list to make it fully work

- [ ] **Tael:** `pnpm i @trustline-agents/agent-sdk@latest` (gets 0.2.1 w/ the
      treasury auto-seed — fixes "borrow doesn't work").
- [ ] **Tael:** set `USDC_ISSUER=GBBD47IF…` in the dashboard app env.
- [ ] **Tael:** merge this repay PR (`feat/trustline-repay`).
- [ ] **TrustLine:** map `/available-credit` to the spec's exact field names
      (`availableUsdc`/`outstandingUsdc`/`eligibleToBorrow`, decimal strings).
- [ ] **Both:** agree to keep the **agent-signed, vault-backed** borrow model
      (drop the off-chain treasury-push framing from the spec).
