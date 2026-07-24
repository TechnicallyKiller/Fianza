# The missing piece: repayment on Tael's side

_Checked against tael-protocol main @ c96b035. The borrow path in
`run-capability.ts` is real and safe (three gates: `allowCreditDraw` → policy
caps → on-chain `availableCreditUsdc`). What does NOT exist yet is repayment:
the agent draws credit to complete a call, but nothing ever pays it back. This
sketches where repay hooks into Tael's architecture, so the loop is complete and
not half-baked._

## Why this is the real gap

`run-capability.ts` does: detect shortfall → `borrow(shortfall)` → spend. The
debt then sits open on-chain forever unless something calls `repay()`. An agent
that only ever borrows and never repays **defaults every time** — which is the
opposite of what we want to demo. Borrow and repay are deliberately separate
on-chain actions (you repay *later*, from revenue), so repay needs its own
trigger. That trigger is what's missing.

## The natural hook: Tael already knows when a Card earns

Tael records every payment in the `payments` table with `payer` + `payee` (both
indexed — `packages/database/src/schema/payments.ts`). **When a Card earns, a
row lands with `payee = that Card's address`.** That is the exact moment the
agent has fresh cash and *should* pay down what it owes. We don't need new
infrastructure — we reuse the settlement path Tael already runs.

## Design: repay-on-earning (recommended)

Right after a payment settles where the Card is the **payee**, check if that Card
owes TrustLine and, if so, repay from the spare balance. One function, called
from the settlement path.

```ts
// After a payment settles with payee = agentAddress (the Card just earned):
async function maybeRepayTrustLine(agentAddress: string, secretEnc: string) {
  if (!TRUSTLINE_API) return;                 // gate 1: deployment opted in
  const agent = await loadAgent(agentAddress);
  if (!agent?.policy?.allowCreditDraw) return; // gate 2: owner opted THIS agent in
  try {
    const tl = new TrustLineAgent(decryptSecret(secretEnc), { apiBaseUrl: TRUSTLINE_API });

    // What does it owe right now (principal + accrued interest)?
    const owed = await tl.amountOwedUsdc();     // (see SDK note below)
    if (owed <= 0) return;                       // nothing outstanding

    // Only repay from SPARE cash — never touch the float the agent needs to
    // keep operating. Leave a working buffer (e.g. keep >= its maxPerCall).
    const bal = await tl.usdcBalanceUsdc();
    const buffer = Number(agent.policy.maxPerCall);   // keep enough for one more call
    const spare = Math.max(0, bal - buffer);
    if (spare <= 0) return;                      // earned, but needs it all to operate

    const repayAmt = Math.min(owed, spare);      // pay what it owes, capped by spare
    await tl.repay(repayAmt);                    // agent-signed, on-chain repay
  } catch (e) {
    // Best-effort: a repay hiccup must never break settlement. The debt just
    // stays open until the next earning (or a manual repay).
    console.error("[repay] TrustLine repay skipped:", e);
  }
}
```

**Where it hooks:** in the settlement flow (`packages/stellar/src/settlement.ts`
→ recorded via `payment.service.ts`), immediately after a `payee`-side payment
is confirmed and the `payments` row is written. Non-blocking — fire it after the
settlement response is returned so a slow repay never delays the earning.

**Why this is safe (same three-gate discipline as borrow):**
1. `TRUSTLINE_API` set (deployment opt-in),
2. `policy.allowCreditDraw` on (owner opted this agent into the credit
   relationship — the same flag that authorized borrowing authorizes repaying),
3. only ever repays from **spare** cash above a working buffer, and never more
   than it owes.

An agent that opted into credit is saying "manage my debt autonomously" — repay
is the *responsible* half of that, so it rides the same consent flag.

## Alternative triggers (if repay-on-earning isn't enough)

- **Periodic sweep** — a cron/worker that, every N minutes, repays any agent
  whose `owed > 0` and has spare balance. Catches agents that earned via a path
  the settlement hook missed. Heavier (needs a scheduler), but a good backstop.
- **Repay-before-borrow** — at the top of `tryDrawTrustLineCredit`, if the agent
  already has spare cash, repay first, then borrow only the remaining shortfall.
  Keeps utilization low but adds latency to the call. Least preferred (couples
  repay to the hot path).

Recommended: **repay-on-earning as primary**, optional **periodic sweep** as a
backstop. Skip repay-before-borrow (it slows the call).

## One small SDK add needed

`tryDrawTrustLineCredit` uses `tl.availableCreditUsdc()` (exists). Repay needs
"how much do I owe right now" — `amount_owed` (principal + accrued interest) is
in the vault's `state()` view and the `amountOwedUsdc` field of `vaultState()`,
so it's readable today via `tl.vaultState()` → `.amountOwedUsdc`. A thin
`tl.amountOwedUsdc()` convenience (one call, no new contract work) would make the
repay code above read cleanly. Optional — `vaultState().amountOwedUsdc` works
now.

## What "done" looks like (the complete, non-half-baked loop)

```
call costs $0.30, Card has $0.05
  → borrow $0.25 (gated: allowCreditDraw + caps + available credit)   [EXISTS]
  → pay for the call                                                   [EXISTS]
  ...agent earns $0.50 from its own work (payee row lands)...
  → maybeRepayTrustLine fires: owes $0.25, spare $0.45 → repay $0.25   [THIS SKETCH]
  → debt cleared, limit ramps up; next borrow is cheaper/bigger
```

## Split of work

- **Tael owns:** the settlement hook + `maybeRepayTrustLine` (their DB, their
  settlement path, their policy). ~1 function + 1 call site.
- **TrustLine owns:** already done — on-chain `repay()` (interest-first →
  reserve + lender yield), `vaultState().amountOwedUsdc`, and optionally the
  `amountOwedUsdc()` convenience.

Nothing here needs the borrow-model debate resolved — it works with the
agent-signed, vault-backed model exactly as built and demoed live.
