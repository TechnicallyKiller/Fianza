# Claude prompt — Fianza roadmap diagram (standalone)

_Paste below the line into Claude (with the artifact-design skill). Every "Now"
item is really built and live on testnet; everything else is honestly labeled as
planned. Placeholders are `[[FILL]]`. Don't let Claude invent milestones, dates,
or metrics._

---

Build me a **standalone roadmap diagram** for **Fianza** — *uncollateralized
USDC credit for AI agents, underwritten by revenue, on Stellar* — as a single
self-contained, presentation-grade **HTML artifact** I can show full-screen and
also screenshot into a pitch deck.

## Absolute rules
- **Do NOT invent milestones, dates, metrics, or logos.** Use exactly the items
  below. Anything not given is a `[[FILL]]` placeholder rendered as an obvious
  dashed chip — never a fake fact.
- Be honest about stage: the **Now** column is genuinely built and live on
  **Stellar testnet**; everything to the right is **planned** (mark it clearly —
  e.g. a "shipped ✓" vs "planned" visual distinction). **No mainnet yet.**
- No hard calendar dates (I'm solo/early — phases, not quarters). If you want a
  time axis, label it "Now → Next → Later," not months.

## The shape
A **horizontal timeline / swim-flow** in 4 phases, left→right, with a thin
"maturity" arrow underneath going from *primitive proven* → *credit business*.
Group items under each phase. Use a status marker per item (✓ done / ◐ in
progress / ○ planned). Keep it one screen, legible from the back of a room.

## Phase 1 — NOW · "The primitive, proven" (all ✓ done, live on testnet)
- ✓ Soroban contracts deployed & live on testnet — score registry, credit line,
  isolated per-agent lending vault
- ✓ Revenue-based underwriting (indexes real on-chain x402 revenue → score 0–850
  + tier C/B/A)
- ✓ Anti-Sybil independence check (revenue counts only from ≥3 distinct payers)
- ✓ Full loop on-chain: borrow → spend → repay, agent-signed, no human
- ✓ Risk mechanics live: APR priced by tier (C 12% / B 8.5% / A 6%), cold-start
  ramp (15% → +15%/on-time, −30%/miss), reserve buffer, on-chain default
  (`mark_default`, loss socialized to lenders)
- ✓ Draw-on-402 SDK — `payWithCredit` (JS `@trustline-agents/agent-sdk` 0.2.1 +
  Python `trustline-agent-sdk`), one-command onboarding `npx @trustline-agents/skill`
- ✓ DeFindex yield-on-idle integration (idle vault liquidity earns)
- ✓ Live "credit book" dashboard (portfolio risk, read from chain)
- ✓ Partner integration: **Tael** (x402 agent payments) adopting the credit
  primitive — merged credit-draw code + open repay PR
- ✓ Open-source (MIT)

## Phase 2 — NEXT · "Harden for real money" (planned)
- ◐/○ Security audit + contract hardening
- ○ Response-shape / API polish for partner integrations (finish Tael: repay
  trigger, field alignment)
- ○ Mainnet-readiness: capped limits, guarded rollout
- ○ zkTLS-attested off-chain revenue into underwriting (already stubbed) — widen
  what counts as provable income

## Phase 3 — NEXT+ · "The lender supply side" (planned — the mainnet unlock)
- ○ Pooled lender market: deposit USDC once, no per-agent picking
- ○ Risk tranches (senior A-tier / junior all-tiers) + loss waterfall
  (reserve → junior → senior)
- ○ Lender dashboard (deposit, pick tranche, see yield/exposure)
- ○ Treasury reframed as the single-LP v0 → opens to third-party lenders
- Caption: *this is the honest answer to "who lends the real money on mainnet."*

## Phase 4 — LATER · "Credit as a network primitive" (vision)
- ○ Mainnet launch
- ○ Credit as a **portable reputation signal** other protocols read (an agent's
  tier gates whether peers transact with it, not just whether it can borrow) —
  a signed, verifiable attestation the agent carries anywhere, no need to trust
  Fianza's API
- ○ More agent platforms integrating the SDK (be the default credit option
  wherever agents earn on x402)
- ○ **Credit-scoring-as-a-service:** expose the underwriting engine as a read
  API so any protocol can price agent risk off Fianza's revenue data — even
  ones that don't borrow from us. Positions Fianza as the *credit bureau* for
  agents, not just a lender.
- ○ **Multi-rail / cross-chain:** underwrite revenue wherever agents earn (other
  x402 networks — Base, Solana), settle on Stellar. The x402 Foundation is
  multi-chain; the underwriting layer should be too.
- ○ **Richer income proof:** beyond x402 — zkTLS-attested off-chain revenue,
  recurring/subscription income, streaming payments — so more of an agent's real
  cashflow becomes creditworthy collateral.
- ○ **Institutional lender onramp:** the tranched pool opens to funds/DAOs
  seeking agentic-credit yield as a new fixed-income-like asset class.
- ○ **Programmable credit policies:** owners set autonomous debt rules per agent
  (caps, allowed spend categories, auto-repay-from-revenue) enforced on-chain.

## The through-line (put this as a one-line subtitle under the title)
"From a proven on-chain credit primitive → to the credit rail for the agentic
economy." The left is real today; the right is the path to real money at scale.

## Design
- Fianza brand: obsidian/near-black background, warm **amber/gold** primary
  accent (NOT teal), mint/ion-green secondary, bone/off-white text, a red/flare
  reserved for the risk/default note. Serif display title, clean mono for item
  labels + status markers.
- Phase 1 should visually "glow" a touch (it's the real, shipped part); later
  phases progressively lighter/more muted so the eye reads shipped-vs-planned
  instantly. A small legend: ✓ shipped (testnet) · ◐ in progress · ○ planned.
- Responsive, theme-aware, no external assets (inline everything). Legible
  full-screen and as a screenshot.

Deliver as one self-contained HTML artifact.
```
```
