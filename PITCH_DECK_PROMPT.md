# Claude design prompt — Fianza pitch deck + GTM deck

_Paste everything below the line into Claude (with the artifact-design skill).
Every fact in here is real and sourced; placeholders are marked `[[FILL: …]]`.
Do NOT let Claude invent numbers, logos, or traction — the prompt says so, but
double-check the output against this file._

---

Build me a **investor pitch deck AND a go-to-market (GTM) deck** for **Fianza**
as a single, polished, presentation-grade **HTML artifact** (one deck; the GTM
content is a clearly-marked section after the pitch, with a divider slide). It
will be presented live and I'll play a ~60-second demo video in the middle, so
plan a natural "DEMO" break slide where the video slots in.

## Absolute rules (do not break these)
- **Every number and claim below is real. Do NOT invent, round up, or embellish
  any metric, market size, logo, customer, or partnership.** If something is a
  placeholder it's written as `[[FILL: …]]` — render it as an obvious styled
  placeholder chip, never as a fake fact.
- This is **testnet only** — never imply mainnet traction, real-money users, or
  revenue. Say "live on Stellar testnet."
- Team is **solo / small** — frame around what's *built*, not headcount.
- Tone: confident, honest, a little irreverent. This is agentic-economy infra —
  it can be fun. **Include 2–3 meme/GIF slots** (marked as `[[GIF: vibe]]`
  placeholder boxes with a caption) at the moments I mark — I'll drop real GIFs in.
- Cite market stats inline as small footnote-style source tags (e.g. `— Coinbase,
  Apr 2026`) so it reads credible, not hand-wavy.

## What Fianza is (the one-liner)
**Uncollateralized USDC credit for AI agents, underwritten by their revenue —
on Stellar.** An agent earns via x402 but can't borrow against it (no collateral,
no credit history). Fianza turns an agent's verifiable trailing revenue into
a real credit line it draws and repays autonomously — no human in the loop.
Tagline to use: *"Not a credibility badge. A real lending decision, sized against
income an agent can prove."*

## The narrative arc (slide order — pitch deck)

1. **Cover.** Fianza. "Uncollateralized credit for AI agents, underwritten by
   revenue — on Stellar." Live on Stellar testnet. By **Divyanshh Kalra
   (@divyanshh_kalra)**.

2. **The shift (why now).** The agentic economy is real and exploding — agents
   now pay for things themselves via x402. Real numbers:
   - **69,000 active agents, 165 million transactions, ~$50M cumulative volume**
     on x402 by April 2026 — *Coinbase*.
   - The **x402 Foundation** (Linux Foundation, launched Jul 14 2026) has 40+
     members incl. **Visa, Mastercard, Stripe, AWS, Google, Cloudflare**. This is
     becoming standard infrastructure.
   - **Stellar** runs a production x402 facilitator (via OpenZeppelin), live
     March 2026.
   `[[GIF: "money printer / agents going brrr" vibe]]`

3. **The problem (the gap that's YOUR wedge).** Agents can *earn* and *spend* —
   but they can't get *credit*. The moment an agent needs to spend more than it
   holds (buy data/compute/a tool to finish a paid job), it just… fails. Even
   CoinDesk noted the honest truth: *"demand is just not there yet"* (Mar 2026) —
   because the missing primitive is **working capital**. Agents are cash-flow-
   blocked despite being profitable. No collateral, no credit history, no lender.

4. **The insight.** An agent's on-chain x402 revenue IS its creditworthiness.
   It's verifiable, real-time, and can't be faked at scale (independent payers).
   Underwrite the revenue → extend credit → the loan repays itself from the work
   it funded. *This is exactly how businesses borrow against receivables — for
   agents, for the first time.*

5. **What Fianza does — 3 things, all real on testnet.**
   1. **Revenue-backed underwriting.** Indexes an agent's real x402 revenue +
      an anti-Sybil independence check (needs ≥3 distinct payers), produces a
      score (0–850) and tier.
   2. **A real on-chain credit line.** Soroban contracts: score registry, credit
      line, isolated per-agent lending vault. The agent borrows/repays USDC
      itself via the SDK.
   3. **Draw-on-402.** `payWithCredit(url, price)` — the agent hits a paywall it
      can't afford, and the credit silently covers the shortfall, then it pays.

6. **How it works (architecture — keep it visual, a flow diagram).**
   earn (x402 revenue) → underwrite (score + tier + anti-Sybil) → credit line
   published on-chain → lender funds isolated vault → agent borrows → spends →
   earns → repays → limit ramps up. Settlement rides x402 + USDC on Stellar.
   Real deployed contracts (testnet):
   - Score Registry: `CAZUPW5MWHG5XCE7BM6YP6M52NPB6TPRRAXU3GEV4TL2AR2ZMYE7TRSX`
   - Credit Line: `CC4ZAKREYMCDEONIQMSSBYOBFC75LL5NPYVEBRZ5SACHYWLYGK2R7GDO`
   - Lending Vault: `CAMF3BS23WXYMA6W6E55VSX577GIPSRKJXJKLL2G46TABUQ4GIRGHIL3`

7. **The credit engine (the real mechanics — this is the moat, show you thought
   it through).**
   - **Tiers** by revenue + repayment: C / B / A (score bands up to 850).
   - **Limit multiples:** C = 1×, B = 2×, A = 3× of proven revenue.
   - **APR priced to risk:** C = 12%, B = 8.5%, A = 6%.
   - **Cold-start ramp:** a new agent starts at **15%** of its sized limit;
     +15% per on-time repayment, −30% on a miss. So exposure always trails
     *demonstrated* cashflow — a "build trust then run" attack nets almost nothing.
   - **Anti-Sybil:** revenue only counts from ≥3 independent payers.
   - **Default handling:** overdue → `mark_default` → reserve buffer absorbs
     first, remainder socialized to lenders, agent frozen. On-chain, real.

8. **DEMO BREAK.** Full-bleed slide: "See it borrow, earn, and repay — live on
   testnet." Big play-button visual. `[[This is where I play the ~60s demo video.]]`
   Sub-caption: real LLM-driven agent, real Stellar testnet transactions, clickable.

9. **Proof it's real (the credit book).** Live on-chain portfolio numbers pulled
   from the deployed contracts (these are REAL as of the latest read — present as
   "live on testnet," and note they grow as the demo runs):
   - **15 agents underwritten · 3 active loans**
   - **1 default (6.67% default rate)** — and it's handled: reserve + socialized loss
   - **~13% weighted-avg APR** (risk-priced)
   - **$0.10 realized loss**, absorbed exactly as designed
   Screenshot/mock the `/portfolio` "credit book" dashboard. Point: *this already
   behaves like a credit business, not a slide.* `[[GIF: "it's alive" vibe]]`

10. **Differentiation (honest, defensible).**
    - Ethereum's **EIP-8004** proposes on-chain agent identity + credit *scores* —
      so the world agrees agent credit is coming. But that's a scoring standard,
      not a lender.
    - Collateralized DeFi lending (Aave etc.) is useless to an agent with no
      collateral — that's the whole point of an agent.
    - **Fianza is the only revenue-underwritten, uncollateralized credit
      primitive for agents on Stellar.** (State it exactly that scoped way — it's
      true and defensible.)
    - Comparison table: Fianza vs collateralized DeFi vs "nothing (agent just
      fails)" vs traditional credit (no agent identity).

11. **Traction (honest — testnet + partnership + built).**
    - **Tael partnership is real:** Tael (an x402 payment layer for agents on
      Stellar) integrated Fianza credit — merged credit-draw code + an open PR
      for repayment. A second protocol is adopting the primitive. *This is the
      strongest signal — a real integration, not a metric.*
    - **Working MVP live on Stellar testnet:** contracts deployed, full loop
      settled on-chain, SDK live on **npm (`@trustline-agents/agent-sdk` 0.2.1)**
      and **PyPI (`trustline-agent-sdk`)**, plus a one-command onboarding skill
      (`npx @trustline-agents/skill`). Integration is a ~3-line drop-in.
    - Be explicit: **no mainnet / no real-money users yet** — this is a proven
      primitive, pre-mainnet.

12. **Roadmap (real — what's now vs next).**
    - **Now (done, testnet):** contracts live; revenue underwriting + anti-Sybil;
      isolated vaults; borrow/repay/default on-chain; draw-on-402 SDK (JS + Py);
      DeFindex yield-on-idle integration; Tael partnership; live credit-book
      dashboard.
    - **Next — the lender supply side (the mainnet unlock):** a **pooled lender
      market** — deposit USDC once, pick a risk tranche (senior A-tier / junior
      all-tiers), earn the interest agents pay, with per-agent isolation + reserve
      as first-loss. (Today the treasury is the single-LP v0 of this.) This is the
      honest answer to "who lends the real money on mainnet."
    - **Then:** more revenue sources into underwriting (zkTLS-attested off-chain
      income — already stubbed), credit as a portable reputation signal other
      protocols read, mainnet launch.

13. **Team.** `[[FILL: your name, background, why you]]` — solo/small builder.
    Frame around *what's shipped* (contracts, SDKs, live demo, a partner
    integration) as evidence of execution. Honest and lean beats fake headcount.

14. **The ask.** Stellar Community Fund Build award (tranche-based; final tranche
    = mainnet). `[[FILL LATER: tranche amounts + the specific milestones each
    tranche funds]]` — map tranches to the roadmap (e.g. Tranche 1: harden +
    audit contracts; Tranche 2: pooled lender market; Tranche 3: mainnet). Note
    SCF context lightly — not the whole framing. Contracts are **open-source
    (MIT)**.

15. **Closing.** Restate: the agentic economy needs credit to actually move, and
    Fianza is the credit rail. "Live on testnet. SDK out. Come build on it."
    The developer hook (show this as a clean code/terminal block):
    > Devs can build agents that borrow against their revenue in **one command**:
    > `npx @trustline-agents/skill`
    > or grab the SDK directly:
    > `npm i @trustline-agents/agent-sdk` · `pip install trustline-agent-sdk`
    Links: **Live app → 0xtrustline.online** · **Docs → docs.0xtrustline.online**
    · **SDK 0.2.1 (latest on npm)** + Python on PyPI · **GitHub release →
    github.com/TechnicallyKiller/TrustLine/releases/tag/v0.2.0**

## GTM DECK (after a divider slide "— Go To Market —")

Keep it tight, honest, testnet-stage (this is a plan, not reported results):

G1. **Who borrows first (ICP).** The agents already earning on x402 that hit
    working-capital walls: research/data agents, agents that must buy paid
    APIs/compute/other agents' capabilities to complete a paid job. Start where
    revenue is already observable on-chain.

G2. **Wedge / beachhead.** Ride existing x402 rails and partner platforms (Tael)
    — meet agents where they already earn and spend, don't make them migrate.
    Distribution = the SDK (`payWithCredit` is a ~3-line drop-in) + being the
    default credit option inside partner platforms.

G3. **Two-sided GTM.** Demand side = agents/agent-platforms integrating the SDK.
    Supply side = lenders wanting agentic-credit yield (the tranched pool). Chart
    the flywheel: more agents → more revenue data → better underwriting → more
    lender confidence → more liquidity → more agents can borrow.

G4. **Go-to-market phases.**
    - Phase 1 (now): testnet, design-partner integrations (Tael), SDK adoption.
    - Phase 2: mainnet pilot with capped limits + the treasury/early LPs.
    - Phase 3: open the pooled lender market; credit-as-reputation across protocols.

G5. **How growth is measured (the metrics that matter).** agents underwritten,
    active credit lines, total credit outstanding, repayment/default rate, lender
    yield, # of protocols integrating the SDK. `[[FILL: any concrete targets you
    want to commit to]]`.

G6. **Moat / why us.** The underwriting data compounds (every repayment sharpens
    the model), isolated-vault risk design, and being embedded in partner rails.
    Honest on risk: mainnet lender supply is the key unlock, and the tranched
    pool is how we solve it.

## Design direction
- Fianza brand: dark, premium fintech-meets-crypto. Palette — obsidian/near-
  black background, warm **amber/gold** as the primary accent (NOT teal), a
  mint/ion green as a secondary accent, bone/off-white text, a red/flare for the
  default/risk moments. Serif display headings + clean mono for data/labels.
- Presentation-grade: one idea per slide, big type, lots of breathing room,
  real charts for the market-growth and credit-engine slides (use the dataviz
  approach — clean, labeled, theme-aware). Keyboard arrow navigation between
  slides. A subtle slide counter.
- The 3 GIF slots and the DEMO break should feel intentional and fun, not
  cluttered — a single centered placeholder box with a caption each.
- Make market-stat sources visible as small tags. Make placeholders obviously
  placeholders (dashed border + `[[FILL]]` label).

Deliver it as one self-contained HTML artifact I can present full-screen.
```
```
