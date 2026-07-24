# TrustLine lender pool — the mainnet supply side

_The honest answer to the #1 question about TrustLine: "on mainnet, who lends
the real money, and why?" Today (testnet) the treasury is the sole
lender-of-first-resort — `lenderModel: testnet-treasury-v0` in `/portfolio`.
This is the design for the productized supply side. It is a DESIGN, not yet
built — deliberately, so it doesn't destabilize the working on-chain credit
primitive before it's proven._

## The problem this solves

Isolated per-agent vaults are great for **risk** (one agent's default can't
touch another's lenders) but terrible for **liquidity supply**: nobody wakes up
wanting to fund "agent 0x7f3a's vault specifically." Capital doesn't allocate
that way. So the vault model, as-is, can't attract organic lenders — which is
exactly why the treasury seeds them today.

## The model: pooled supply, isolated risk

Two layers, so lenders get a simple product and agents keep isolation:

1. **A shared lending pool** lenders deposit into once ("I want agentic-credit
   yield") — NOT per-agent vaults. One place capital sits.
2. **Per-agent isolation stays** as the risk/accounting layer underneath: the
   pool allocates to agents by tier, each agent keeps its own limit / principal /
   default tracking (the vaults we already have). Lenders never pick an agent.

This is the Aave / Morpho pattern — pooled supply, isolated risk markets — and
it's the credible mainnet answer. The current treasury is simply the **single-LP
v0** of this pool.

## Tranches: lenders pick risk, not agents

A lender chooses a **tranche**, not a borrower:

| Tranche | Lends to | Yield | First-loss |
|---|---|---|---|
| **Senior** | A-tier agents only | lower (~5%) | protected by junior + reserve |
| **Junior / all-tiers** | all tiers incl. C | higher (~10–12%) | absorbs losses first |

The protocol routes senior capital to the safest agents and junior capital
across the book. On a default, the **reserve buffer absorbs first**, then the
**junior tranche**, then (only if wiped out) senior — standard waterfall. The
`/portfolio` view already surfaces the two inputs this needs: reserve coverage
and realized loss.

## Why a lender earns (the yield is real, not subsidized)

- Borrowers pay APR priced to tier risk (C=12%, B=8.5%, A=6% today).
- Repaid **interest** splits 20% → reserve buffer, 80% → lender yield (already
  implemented on-chain; visible as `totalYieldUsdc` in `/portfolio`).
- So a lender's return = their tranche's share of that 80%, minus their tranche's
  share of realized losses. Positive expected return as long as the tier's APR
  exceeds its default rate — which is what the underwriter's job is to ensure.

## Why it's safe enough to attract capital

Three protections, in order:
1. **Underwriting caps exposure to proven revenue.** A fresh agent starts at 15%
   of a limit it already demonstrated it can service (the ramp). Max loss is a
   fraction of money the agent already earned — not a blind bet.
2. **Reserve buffer** takes the first loss before any lender principal.
3. **Tranching** lets risk-averse capital sit senior. Junior lenders are paid
   more precisely because they absorb losses first — priced, not hidden.

## What already exists vs. what the pool needs

**Already built (reuse, don't rebuild):**
- Per-agent isolated vaults with liquidity / principal / reserve / yield / loss
- On-chain APR, ramp, reserve split, realized-loss socialization
- `deposit()` / `withdraw()` / `claim_yield()` (lenders already mint vault shares)
- The `/portfolio` risk view (this session) — the lender-facing transparency

**To build for the pool (the new work, scoped):**
- A **pool contract** that accepts deposits, issues tranche shares, and allocates
  liquidity across agent vaults by tier (routing logic).
- **Tranche accounting** (senior/junior share classes + the loss waterfall).
- A **lender dashboard** (deposit, pick tranche, see yield/exposure) — the
  `/portfolio` page is the read-only precursor.
- **Rebalancing**: move idle pool liquidity toward demand (agents wanting to
  borrow) and toward DeFindex yield when idle (the `invest_idle`/`harvest` hooks
  already exist per-vault — lift them to the pool).

## The honest roadmap framing (for a pitch)

> "Today it's isolated vaults seeded by our treasury — that proves the credit
> primitive works end-to-end on-chain: earn → underwrite → borrow → repay →
> yield → default, all live on testnet. The productization is this pooled lender
> market: deposit once, pick a risk tranche, earn the interest agents pay, with
> per-agent isolation and a reserve buffer as first-loss. Nobody hand-picks an
> agent to fund — same as no one hand-picks a borrower on Aave. Our treasury is
> v0 of that pool; the `/portfolio` credit book is the transparency layer lenders
> will underwrite us on."

That turns the biggest open question into a roadmap with the primitive already
proven — which is the strongest position to pitch from.
