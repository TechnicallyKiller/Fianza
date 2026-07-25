# Assessment: Tael's loan-integration spec vs. what Fianza has today

_Checked against tael-protocol main @ c96b035 (pulled 2026-07-18) and the
Fianza backend/contracts as they stand. Scoring how much of the spec is
already done, what's a small lift, and the one real architectural fork._

## Verdict up front

**~40% already exists; ~35% is straightforward new backend work; ~25% is a
genuine architectural decision** about how a loan is disbursed and secured
(the `borrow` route). The spec is well-written and mostly aligns with what we
built — but its `borrow` model is meaningfully different from how our on-chain
`borrow()` works today, and that's the thing to resolve before building.

## Route-by-route

### Route 1 — `check-available-credit` (free read) — ~90% DONE

- ✅ **The endpoint exists and returns live data.** Our
  `GET /agent/:address/available-credit` already runs `previewCredit` (live
  on-chain underwrite, read-only) and returns tier/limit/apr/revenue/payers.
- ✅ **HMAC identity verification is already built** (`verifyTaelSignature` in
  `server.ts`) — the spec's §5.1 is done on our side.
- ⚠️ **Response shape is close but not identical.** Spec §4.1 wants:
  `availableUsdc`, `outstandingUsdc`, `eligibleToBorrow`, and string amounts.
  We return `rampedLimitUsdc`/`limitUsdc`/`tier`/`aprBps`/`revenueUsdc`/
  `distinctPayers` as numbers. Adding `availableUsdc` (= ramped − outstanding),
  `outstandingUsdc`, `eligibleToBorrow`, and switching to decimal strings is a
  small, mechanical change.
- ⚠️ **Pricing flip (→ free) is a Tael-side change**, and requires their §5.2
  work (forward identity on *free authenticated* calls) — currently identity is
  only forwarded on paid calls. They own this; they've listed it in their §9.
  Fine with us — we never wanted to charge for a read.

### Route 2 — `borrow` / `draw` (priced action) — THE HARD ONE, ~20% done

This is where the spec and our architecture diverge, and it's the crux.

**What the spec wants (§4.2, §5.3):** the Card calls `POST /borrow`; Fianza
verifies identity via HMAC, then **Fianza's treasury disburses USDC directly
to the Card address** and returns a confirmation. No agent signature — "a
disbursement the Card can't sign." Loan tracked off-chain (`loanId`,
`outstandingUsdc`, `dueBy`), origination fee deducted from disbursement.

**What we have on-chain today:** `lending_vault.borrow(agent, amount)`
- requires **`agent.require_auth()`** — the borrowing agent MUST sign it;
- sends USDC **from that agent's own isolated vault** to the agent;
- requires the vault to already hold lender **liquidity** (else
  `InsufficientLiquidity`) — which today the **treasury seeds** via
  `ensure-liquidity`.

So there are **two genuinely different loan models on the table:**

| | Spec's model | Our on-chain model |
|---|---|---|
| Who signs the draw | nobody (treasury pushes) | the agent (`require_auth`) |
| Where USDC comes from | Fianza treasury → Card | agent's own vault (lender-funded) |
| Loan record | off-chain (`loanId`, `dueBy`) | on-chain (vault `principal`, `due`) |
| Repayment | Card pays treasury, matched by memo | on-chain `repay(agent, amount)` |
| APR / limit | Fianza tracks off-chain | vault contract enforces on-chain |

**This is a real decision, not a coding gap.** Two ways to satisfy the spec:

- **Option A — build the spec's off-chain loan model** as a new backend service:
  treasury is a plain USDC wallet that pays Cards on a verified HTTP request,
  and we track loans in Postgres (not the vault). Simpler to match the spec
  exactly, decoupled from the Soroban vault — but it **throws away the on-chain
  credit vault, the ramp, lender yield, the anti-Sybil enforcement** we already
  built and tested. It becomes "Fianza treasury is a payday lender over
  HTTP." Fast, but it's a different (thinner) product.
- **Option B — bridge the spec to the on-chain vault.** `borrow` becomes: treasury
  `ensure-liquidity` (already built) → then the *agent's Card signs the actual
  `borrow()`*. Problem: the spec explicitly wants NO agent signature on borrow,
  because the Card "can't sign a disbursement to itself." But our `borrow` isn't
  a disbursement *to* the card from outside — it's the agent drawing its *own*
  credit line, which it CAN and should sign (that's the security model). This
  keeps everything we built but **requires the spec to accept an agent-signed
  borrow**, contradicting its §5.3 framing.

**Recommendation:** push back on the spec's "borrow is an unsigned treasury
disbursement" framing. An agent signing its own credit draw is a *feature*
(non-custodial, the agent authorizes its own debt), not a problem to design
around. Our SDK's `payWithCredit` already does exactly this. The cleaner
integration is Option B: Tael's buy-side detects the shortfall (it already
does, `allowCreditDraw`), the Card signs the borrow (as it already signs Pay/
Swap), treasury guarantees the liquidity. That reuses BOTH sides' existing,
tested machinery instead of building a parallel off-chain lender.

### Route 3 — `repay` (free action) — ~70% DONE (theirs) / needs a watcher (ours)

- ✅ **The `tael_action: "pay"` intent shape the spec wants is EXACTLY their
  existing Pay action** (`operations/pay.ts`), memo included, 28-char cap and
  all. So "repay returns a pay intent the Card signs" needs almost nothing new
  on Tael's side — confirmed in their code.
- ✅ On-chain `repay(agent, amount)` exists (interest-first, then principal,
  splits to reserve + lender yield).
- ⚠️ **What's missing on our side: memo-based reconciliation.** The spec wants
  the Card to pay the treasury with `memo tl:<loanId>` and Fianza to *watch
  the treasury* for that memo and mark the loan repaid. We don't have a
  treasury-payment watcher today. If we go Option B (on-chain vault), repay is
  just the existing on-chain `repay()` and no memo-watcher is needed — another
  reason B is cleaner.

## What's already done and reusable (don't rebuild)

- ✅ HMAC identity verification (`verifyTaelSignature`) — spec §5.1
- ✅ Live credit read (`previewCredit`) — spec §4.1 core
- ✅ Treasury that seeds vault liquidity (`ensure-liquidity`) — the piece that
  makes any borrow possible
- ✅ On-chain vault borrow/repay with APR, ramp, reserve, lender yield
- ✅ `{payer}` substitution + `x-tael-agent` header (their side, live)
- ✅ Their Pay-action pipeline (what repay rides on) — live at c96b035

## Answers to their §10 open questions (from our code)

1. **Disbursement:** Today borrow is agent-signed from its own vault, NOT a
   treasury→Card push (see Route 2). Same USDC issuer as Tael — ✅ confirmed
   (`GBBD47IF…`, matches).
2. **Repay reconciliation by memo:** doable but we'd have to build a treasury
   watcher; on-chain `repay()` avoids it entirely. Prefer on-chain.
3. **APR accrual:** simple interest, accrued lazily per-second on outstanding
   principal, utilization-adjusted (`revenue_math::simple_interest` +
   `dynamic_apr_bps`). Already enforced on-chain.
4. **Origination fee:** we don't take one today; the vault splits repaid
   *interest* (20% reserve / 80% lender yield). A flat origination fee would be
   new. Deduct-from-disbursement is fine if we go the off-chain model.
5. **HMAC auth instead of secret-sharing:** ✅ YES — already built and preferred.
6. **One open loan vs many:** the vault tracks a single `principal` per agent
   (effectively one rolling balance, not discrete loans) — so "one open loan"
   maps naturally; discrete `loanId`s are an off-chain-model concept.

## Bottom line / what to tell Tael

- **check + repay: we're basically there.** Small response-shape tweaks; repay
  rides their existing Pay pipeline. Agree with the free/free/priced framing.
- **borrow: one decision to make together first.** Their spec assumes an
  off-chain, unsigned, treasury-push loan. We have a working on-chain,
  agent-signed credit vault (ramp, yield, anti-Sybil). Recommend we align on the
  **agent-signed, vault-backed** model (reuses both sides' tested code) rather
  than build a parallel off-chain lender — the "Card can't sign a disbursement"
  concern dissolves once it's framed as the agent drawing its own line, which is
  exactly what `payWithCredit` already does.
