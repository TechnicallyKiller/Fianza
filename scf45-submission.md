# Fianza — SCF #45 Build Award Submission (Open Track)

> Final draft. Every on-chain figure was verified against Horizon, the deployed
> contracts, or the live API on 2026-08-04. Items marked **[ACTION]** need you.

---

## Submission Title
Credit Infrastructure for the Agentic Economy

## Project Type
Lending & Borrowing

## Project URL
https://www.fianza.space/

## Technical Architecture Document
https://docs.fianza.space/

## GitHub URL
https://github.com/TechnicallyKiller/Fianza

---

## Products & Services

Fianza is uncollateralized USDC credit for AI agents on Soroban, underwritten by
revenue an agent can prove rather than collateral it does not have.

An agent earning over x402 has income but no way to borrow against it: no
collateral, no credit history, no lender. When it needs $2 of working capital to
buy the API call that completes a $5 job, it stops. Fianza turns trailing
revenue into a credit line the agent draws and repays autonomously, with no
human in the loop.

**1. Revenue underwriting — `score_registry` (Soroban/Rust).**
An indexer reads an agent's USDC receipts from SEP-41 SAC transfer events over
Soroban RPC, with a Horizon deep-history fallback and a persistent payment graph
that retains history beyond RPC's ~24h event window. Off-chain income is proven
with Reclaim zkTLS and verified by a deployed Soroban verifier contract. The
resulting score and tier are signed and published on-chain, where they become
the input every other contract reads.
*Stellar:* scores live in Soroban persistent storage, so the credit decision is
enforced by contract rather than asserted by an API.

**2. Counterparty-independence engine (anti-Sybil).**
Reading an agent's revenue is a database query. Proving it is *independent* is
the hard part — nothing stops an operator funding wallets and paying themselves.
Each payer's contribution is discounted by account age, external counterparty
diversity, whether the agent funded that wallet within k hops, net-flow
reciprocity, and revenue concentration (HHI). The output is *effective
independent revenue*, not a pass/fail flag: faking revenue is not blocked by a
rule, it stops being worth anything.
*Stellar:* the funding graph is built entirely from on-chain SAC transfer
events, so the adversarial signal is native to the ledger.

**3. Isolated credit vaults — `lending_vault` (Soroban/Rust).**
One vault per agent. Lenders deposit USDC and receive shares; agents borrow
against their published limit at a tier base rate plus a utilization premium. A
permissionless `mark_default` lets anyone crystallise an overdue loan: a
first-loss reserve absorbs what it can, the unrecovered remainder is socialised
pro-rata across that vault's lenders only, and the agent is frozen. Isolation is
structural — one bad borrower cannot reach another vault.
*Stellar:* USDC settles through its SEP-41 SAC; sub-cent fees and ~5s finality
make per-draw on-chain settlement economically viable, which is the precondition
for loans this small.

**4. Credit ramp.** The enforced limit starts near zero and grows only with
on-time repayment history, independent of the headline score. A degrading agent
shows up as a ramp that stops growing well before it shows up as a large
default.

**5. Agent SDKs.** `@fianza/agent-sdk` (npm) and `fianza-agent-sdk` (PyPI), both
at v0.2.1. `payWithCredit()` implements draw-on-402: the agent hits an
x402-priced endpoint, auto-borrows the shortfall, pays, and continues. Credit
sits inside the agent's normal loop rather than being a separate borrowing flow.

**What this award changes.** Three things stand between a working protocol and
one that can responsibly hold third-party capital: the trust root is a single
signing key in configuration, lender liquidity is one hand-picked vault at a
time, and mainnet scores are published manually. This award funds a
decentralised attestation path, pooled lender liquidity, and a live mainnet
underwriting engine with monitoring — plus consolidation of credit math onto a
single Rust implementation shared with the contracts.

---

## Market Analysis and Differentiation

**The market exists and is measurable.** x402 — the agent payment standard
Fianza underwrites against — had processed over 119M transactions on Base and
35M on Solana as of March 2026, at roughly $600M annualised volume. Agents are
already earning real revenue. None of them can borrow against it.

**Stellar has the collateral base but not this primitive.** Stellar DeFi TVL is
approximately $786M across 15 protocols (DefiLlama, July 2026). Blend, the
ecosystem's anchor lending protocol, holds ~$138.7M TVL — and is
*collateralized*: it lends against assets you already hold. That is a different
product from lending against income you can prove. An agent with $3/day of
verifiable revenue and no treasury is exactly the borrower collateralized
lending cannot serve. To our knowledge Fianza is the only revenue-underwritten,
uncollateralized credit protocol on Stellar.

**Our core design choice was independently validated, on this chain, this year.**
In February 2026 the YieldBlox DAO pool — a lending pool running on Blend V2 —
was drained of roughly $10M via oracle manipulation of an illiquid USTRY/USDC
market on SDEX. The attack emptied that pool completely. Every *other* Blend
pool, isolated from it, was untouched. The blast radius was exactly one pool
because the architecture confined it there.

Fianza takes the same principle further: isolation per *borrower*, not per
market. A default is contained to the lenders who chose that specific agent and
cannot socialise across the protocol. For an asset class where high default rates
are expected rather than exceptional, isolation is not a feature — it is the
safety model.

**Comparison.**

| | Collateralized DeFi (e.g. Blend) | Off-chain agent credit | Fianza |
|---|---|---|---|
| Requires existing capital | Yes | No | No |
| Underwrites on income | No | Yes | Yes |
| Enforcement | On-chain | Contractual/legal | On-chain |
| Agent can borrow autonomously | Partially | No | Yes |
| Sybil resistance | N/A | KYC | On-chain independence model |
| Loss containment | Pool or isolated | Lender balance sheet | Per-agent isolated vault |

**Why this is not a replication.** The novel component is not the vault — it is
the independence model that decides whether revenue is real economic activity or
an operator paying themselves. That question has no equivalent in
collateralized lending, and it is where the defensible work sits.

**How this drives on-chain growth, with metrics.** Every credit event is a
Soroban transaction settling in USDC: register, publish score, deposit, borrow,
repay. An agent operating on credit generates recurring on-chain volume rather
than a one-time deposit. We will report, per tranche: cumulative contract
transactions, agents underwritten, USDC originated, USDC repaid on time by
agents we do not operate, realized loss rate, and pooled TVL. Our primary
success metric is **USDC repaid on time by external agents**, paired with
realized loss rate as the constraint — the two together are the only honest
measure of whether the underwriting works.

---

## Traction Evidence

All figures verified on-chain on 2026-08-04. Transaction-level CSVs for both
networks are attached (`fianza-testnet-transactions.csv`,
`fianza-mainnet-transactions.csv`); every row carries a stellar.expert link.

**Testnet — 225 contract transactions, 0 failed** (30 Jun – 29 Jul 2026)

| Function | Count |
|---|---:|
| `publish_score` | 121 |
| `borrow` | 39 |
| `repay` | 30 |
| `deposit` | 14 |
| `register` | 13 |
| `record_repayment` | 7 |
| `mark_default` | 1 |

**19 agents** have a stored underwriting result (queried 2026-08-05; earliest
2026-07-02). The 13 `register` calls above are lower than that because these
counts come from enumerating the 25 participant accounts we can identify — an
agent registered from a wallet outside that set still holds a published score but
contributes no row here. The transaction figures are therefore a verifiable
floor, not a ceiling; every one is in the attached CSV with a stellar.expert
link.

`score_registry` `CAZUPW5MWHG5XCE7BM6YP6M52NPB6TPRRAXU3GEV4TL2AR2ZMYE7TRSX` ·
`credit_line` `CC4ZAKREYMCDEONIQMSSBYOBFC75LL5NPYVEBRZ5SACHYWLYGK2R7GDO` ·
`lending_vault` `CAMF3BS23WXYMA6W6E55VSX577GIPSRKJXJKLL2G46TABUQ4GIRGHIL3`

**Mainnet — 14 contract transactions, 13 successful** (25–26 Jul 2026)
The full loop has executed on mainnet in real USDC: 1 register, 1 deposit,
6 borrows, 5 repays, with interest accruing on an outstanding position. This is
a live money path, not a deployment artifact.
`score_registry` `CAHWYFLMQI6BBOL6ZLZRRINCK6KVBX73ACH7LCPB24WDED4LSMCI7YZC` ·
`credit_line` `CDK7S4UWY227FHFKDSV37DGT7AIJ5Z2QEYO5AY456M7RBGJN25WYJVGC` ·
`lending_vault` `CAE5C5UJYVED5DAVY4YKYT6E2C4NBZCIUBAK2MXGKGLKZESBBXKFPZ4U`

**Adversarial validation, run live on testnet rather than simulated**
- **A real on-chain default.** An agent was staged with an overdue loan,
  `mark_default` was triggered permissionlessly, the first-loss reserve absorbed
  what it could, the remainder was socialised pro-rata to that vault's lenders,
  and the agent was frozen. Most lending submissions can show a loan working;
  this shows a default working.
- **A live circular-funding Sybil attacker** was detected from on-chain funding
  data and discounted to zero effective revenue.

**Engineering**
- 40 Rust tests across the three contracts and the shared `revenue_math` library
- A solvency-invariant fuzz test: 5 seeds × 300 randomised
  deposit/borrow/repay/withdraw/claim_yield steps (1,500 total), asserting
  `vault_balance == liquidity + reserve + yield_pool` after every successful
  state transition
- Both SDKs published and installable at v0.2.1

**Ecosystem integrations — four live, all reading or settling on Stellar**

1. **DeFindex (SCF #28, #32) — yield on idle lender capital.** Idle vault
   liquidity routes into a DeFindex tokenized vault while awaiting draw, with a
   liquid buffer retained for instant borrows. The integration vault is live and
   its TVL is readable from our public API (`GET /integrations/defindex`).

2. **Tael Protocol — cross-marketplace revenue underwriting and payment.** A
   two-way integration. *Inbound:* Tael settles x402 payments as **classic**
   Stellar `payment` operations carrying a fixed text memo — a different
   on-chain shape from our own SAC-event revenue — so we built a dedicated
   Horizon reader that makes Tael earnings attributable from chain data alone
   and folds them into underwriting as additive independent revenue.
   *Outbound:* our SDK ships `tael-pay`, a second x402 dialect, because Tael's
   verifier expects a classic `Operation.payment` rather than the SAC `transfer`
   that `@x402/stellar` signs. An agent selling on Tael can therefore be
   underwritten on income that never touches a Soroban SAC.

3. **Reclaim zkTLS — off-chain revenue proofs.** Off-chain income (e.g. a Stripe
   balance) is proven via Reclaim and verified by a deployed Soroban verifier
   contract (`CA3EMXR6JOOTNP44T3OAJFMMMGKRRETDJKBLZP2RU3SIY4SDFAH54DU5`), so
   revenue that never touches Stellar still carries weight in an on-chain score.

4. **Nebula — external adoption, built by another team on our SDK.** Nebula's
   MCP server exposes Fianza credit to its agents as four native tools:
   `trustline_status`, `trustline_onboard`, `trustline_borrow`, and
   `trustline_repay`. Documented at
   https://docs.nebulaonchain.xyz/guides/trustline. Enabled on testnet only, per
   Nebula's own documentation.

The fourth carries the most weight. The first three are integrations we built
into other protocols; Nebula is another team building Fianza into theirs, which
is the earliest real signal that agent credit is a primitive other builders
want rather than one we are pushing.

---
## Budget

**Total requested: $99,225 in XLM · 1,665 hours · 19 deliverables · 20 weeks**

Costed bottom-up. Every deliverable is priced as hours × role rate; the total is
the sum of the parts, not a figure worked backwards from a ceiling.

| Role | Rate | Hours | Cost |
|---|---:|---:|---:|
| Protocol / systems Rust (contracts, credit core, indexer, SDK crate) | $65/hr | 840 | $54,600 |
| Backend (risk engine, services, API, infra) | $55/hr | 750 | $41,250 |
| Frontend (lender dashboard, monitoring UI) | $45/hr | 75 | $3,375 |
| **Total** | **$59.59 blended** | **1,665** | **$99,225** |

Payments follow SCF's fixed 10/20/30/40 schedule, which is deliberately not the
same shape as the cost curve: Tranche #0 pays 10% on approval, before any
deliverable is due. Payment and cost therefore tie out **cumulatively**, not
tranche-by-tranche.

| Tranche | Milestone | Completion | Payment | Cum. paid | Deliverable cost | Cum. cost | Position |
|---|---|---|---:|---:|---:|---:|---:|
| #0 | On approval | — | $9,922 | $9,922 | — | $0 | $+9,922 |
| #1 | MVP verified | 30/10/2026 | $19,845 | $29,767 | $31,050 | $31,050 | $-1,283 |
| #2 | Testnet verified | 18/12/2026 | $29,768 | $59,535 | $40,825 | $71,875 | $-12,340 |
| #3 | Mainnet launch verified | 05/02/2027 | $39,690 | $99,225 | $27,350 | $99,225 | $0 |

Tranche #0's 10% pre-funds the opening stretch of Tranche #1. From there
cumulative payment runs behind cumulative cost — a peak working-capital gap of
$12,340 during the Tranche #2 risk-engine build, which we carry — closing to
exactly zero at mainnet launch. Total paid equals total costed: **$99,225**.

Assuming award notification in mid-September 2026, the milestones land at roughly
6, 13 and 20 weeks. Intervals between tranche submissions are 45, 49 and 49 days,
all inside the 90-day window. Effort runs 510 → 695 → 460 hours.

Both founders work on Fianza full time. 1,665 funded hours over 20 weeks is
roughly 42 hours per engineer per week. The request is 66% of the $150,000
ceiling.

**Where the money actually goes.** Roughly $38,600 — the largest share — funds
credit-risk work: borrower stake, the size-weighted ramp, operator-cluster
exposure caps, the expanded attack catalog, and the independence-engine
migration. That is deliberate. The vault and the interest curve are standard
engineering; the underwriting model is the part that decides whether this
protocol is solvent, and it is the part with known, documented gaps.

**What this does not fund.** The three Soroban contracts, the independence
engine, the indexer, both SDKs, and the existing testnet and mainnet deployments
were built and shipped without external funding. None appears as a deliverable
and no line item reimburses completed work. No line covers marketing, bounties,
token incentives, legal costs, liquidity capital, or a security audit. We intend
to approach the SCF Audit Bank separately for an external review of the stake
waterfall and the pooled vault before they hold third-party capital at scale, and
do not claim eligibility for a Liquidity Award today.

---

## The credit engine is the deliverable

Three of the four sections below are ordinary protocol engineering. This one is
the reason the protocol either works or quietly becomes insolvent, so we state
the specific defects we are funding rather than describing the work in the
abstract.

Auditing our own shipped contracts while preparing this submission surfaced two
exploitable flaws. Both are live on testnet today. Both are fixed in Tranche #1.

**The credit ramp counts repayments but never reads their size.**
`revenue_math::ramp_factor_bps` computes
`0.15 + 0.15 × on_time − 0.30 × missed`. `on_time` is a counter. An agent can
borrow $0.01, repay it, and repeat six times — total cost a few cents plus fees —
and the ramp reaches 100%, unlocking the full revenue-sized limit. The ramp is
our primary defence against a freshly-fabricated identity, and it is currently
farmable for pennies.

**`borrow()` never checks whether the score is still current.** It verifies
paused, defaulted, limit and liquidity, then lends. It never reads
`ScoreData.updated_at`. A score published against revenue that has since stopped
entirely remains a valid borrowing authorisation indefinitely. Underwriting on
*trailing* revenue is only sound if the trailing window is actually recent.

Beyond those, the model has a documented weakness we have not solved: a
non-reciprocal collusion ring of genuinely distinct operators is indistinguishable
from real customers at the graph level. Our own whitepaper states the fix is
either staking or global community detection. This submission funds the staking
answer, and it also addresses a risk that has nothing to do with attackers.

**Borrower stake, and why it does not contradict "uncollateralized".** An agent
is a black box that can change without notice — its model swapped, its prompt
altered, its market moved. No underwriting model predicts that. The defence is to
make the operator share the downside at exactly the point where the downside
becomes large.

Required stake scales with the *ramp*, not with entry. A cold agent at 15% posts
nothing and borrows purely on revenue — the original thesis is intact, and the
front door stays open to an agent with no capital. As the ramp advances and the
line grows, the agent must lock stake that sits **junior to lenders**: seized
first on default, ahead of the reserve, ahead of any socialised loss. The
waterfall becomes stake → reserve → lenders.

Economically this changes the invariant in the whitepaper. Today an attacker's
upside is the full limit. With a junior tranche it is the limit minus the stake
they forfeit, and because the stake requirement rises with the limit, the
attacker's cost scales with the prize rather than staying flat. It prices the
collusion ring, the operator who walks away, and the agent that silently gets
worse — three problems, one mechanism.

---

## Tranche #1 Deliverables — MVP · 510 hours · $31,050 · due 30/10/2026

| Deliverable | Hours (P/B/F) | Cost |
|---|---|---:|
| Size-weighted credit ramp + score-freshness gate | 70 / 25 / 0 | $5,925 |
| Rust credit-math core sharing `revenue_math` with the contracts | 110 / 40 / 0 | $9,350 |
| Independence engine to Rust + common-funder clustering | 70 / 45 / 0 | $7,025 |
| Decentralised score attestation | 50 / 30 / 0 | $4,900 |
| Authenticated, rate-limited underwriting API | 0 / 40 / 0 | $2,200 |
| CI with a red-team gate | 0 / 30 / 0 | $1,650 |

**Size-weighted credit ramp + score-freshness gate — 70 protocol + 25 backend hrs — $5,925**
Closes both live defects above. The ramp becomes a function of repaid *value*
relative to the limit rather than a count of events, so six one-cent repayments
no longer buy a full line. `borrow()` gains a freshness requirement: a score
older than a configured window cannot authorise a new draw, forcing
re-underwriting against current revenue.
*Done when:* a testnet agent making six trivial repayments provably cannot exceed
the cold-start ramp, while an agent repaying material amounts advances normally;
a draw against a deliberately-aged score is rejected on-chain; and both cases are
covered by contract tests that fail against today's implementation.

**Rust credit-math core sharing `revenue_math` with the contracts — 110 protocol + 40 backend hrs — $9,350**
Credit math currently exists twice: in Rust in
`contracts/libraries/revenue_math`, which the contracts *enforce*, and again in
TypeScript in `backend/src/scoring`, which the API *quotes*. The backend carries
five comments acknowledging the duplication, including *"Mirrors
`revenue_math::ramp_factor_bps` exactly (same constants, same clamp)"*. Keeping
them in agreement is a manual discipline. If they drift, the backend quotes a
limit the vault will not honour. This migrates scoring, banding, sizing, APR and
the ramp into a Rust crate depending on the *same* library the contracts compile
against.
*Done when:* the TypeScript scoring implementation is deleted; a differential
test replays every stored historical underwriting result through the Rust core
and reproduces the same score, tier, limit and APR; and a property test proves
the quoted limit equals the vault's enforced limit across randomised inputs.

**Independence engine to Rust + common-funder clustering — 70 protocol + 45 backend hrs — $7,025**
Ports the anti-Sybil engine to Rust and closes a known gap while doing so. The
current funding-graph check traces a payer's funding back *to the agent*; it does
not detect payers funded from a shared third-party source — an operator routing
their own capital through separate wallets. This adds clustering over the
persistent payment graph to group payers by common funding origin and discount
correlated clusters. K-hop traversal is the hottest path in the system and
degrades first as the graph grows, which is why it moves to Rust first.
*Done when:* a synthetic attacker funding five wallets from one external treasury
is detected and discounted to near-zero effective revenue in a reproducible test;
every honest-agent case in the existing catalog still passes unchanged; and
traversal latency is benchmarked before and after on the same graph.

**Decentralised score attestation — 50 protocol + 30 backend hrs — $4,900**
Replaces the single plaintext signing key with M-of-N multi-signature attestation
in `score_registry`, plus a documented rotation procedure. This is the largest
remaining centralisation risk in the protocol.
*Done when:* a score is published on testnet requiring 2-of-3 independent
signers; a single compromised signer provably cannot publish; and a key rotation
is executed on-chain with published tx hashes.

**Authenticated, rate-limited underwriting API — 40 backend hrs — $2,200**
The underwriting endpoint is currently open. Adds API-key authentication,
per-key rate limiting, and a published OpenAPI 3 specification.
*Done when:* a third party completes register → underwrite → read-credit using
only the published spec and an issued key, and unauthenticated writes are
rejected.

**CI with a red-team gate — 30 backend hrs — $1,650**
*Done when:* every push runs contract tests, service build, SDK build **and the
adversarial catalog**, with any attack scenario regressing blocking merge.

---

## Tranche #2 Deliverables — Testnet · 695 hours · $40,825 · due 18/12/2026

| Deliverable | Hours (P/B/F) | Cost |
|---|---|---:|
| Borrower stake — junior tranche | 130 / 40 / 0 | $10,650 |
| Operator-cluster exposure caps | 50 / 70 / 0 | $7,100 |
| Pooled lender liquidity (SEP-56) | 90 / 30 / 0 | $7,500 |
| Attack catalog A8–A12 + red-team harness | 30 / 90 / 0 | $6,900 |
| Onchain monitoring and alerting stack | 0 / 60 / 25 | $4,425 |
| Threat model + data flow diagram (STRIDE) | 20 / 25 / 0 | $2,675 |
| Lender dashboard | 0 / 0 / 35 | $1,575 |

**Borrower stake — junior tranche — 130 protocol + 40 backend hrs — $10,650**
Stake custody in `lending_vault`, a required-stake curve keyed to the ramp, and a
rewritten default waterfall: stake is seized first, then the reserve, then
socialised loss. Stake is returned on clean exit. A cold agent posts nothing;
requirement rises as the line grows.
*Done when:* an agent cannot draw past its ramp tier without posting the required
stake; a simulated default seizes stake before touching the reserve or any
lender's share price, verified on testnet with published tx hashes; a clean
repayment returns stake in full; and an invariant test proves no ordering of
deposit/borrow/repay/stake/default lets a lender absorb loss while stake remains
unseized.

**Operator-cluster exposure caps — 50 protocol + 70 backend hrs — $7,100**
Every agent is currently underwritten in isolation, so one operator running N
agents extracts N × limit while each agent looks individually modest. This
clusters agents by shared funding origin and shared payer sets, then enforces an
aggregate exposure cap per cluster on-chain.
*Done when:* five agents funded from one source are identified as a single
cluster, and the sixth borrow that would push the cluster past its aggregate cap
is rejected on-chain even though each agent is individually within its own limit.

**Pooled lender liquidity (SEP-56 share token) — 90 protocol + 30 backend hrs — $7,500**
Today a lender must pick individual agents, fragmenting liquidity and forcing
every lender to underwrite by hand. This adds a shared pool lending across many
underwritten agents with tier-based risk sorting, issuing a SEP-56 tokenized
vault share so the position is a standard Stellar instrument other protocols can
hold and price. Existing isolated vaults remain unaffected — the pool is an
additional liquidity source, not a migration.
*Done when:* a lender deposits once on testnet and gains exposure across ≥3
agents; an invariant test proves share price is a pure function of pool equity
and supply and that no depositor can mint or redeem at a stale price; and a
simulated default in one agent impairs only that agent's proportional share.

**Attack catalog A8–A12 + red-team harness — 30 protocol + 90 backend hrs — $6,900**
The current catalog covers seven payer-side attacks. It does not cover attacks on
the *credit mechanics* themselves, which is where both flaws found in this audit
live. Adds and defends: **A8** ramp farming (many trivial repayments), **A9**
stale-score borrowing, **A10** operator Sybil across multiple agents, **A11**
funding-trace laundering through DEX/AMM hops so the k-hop walk breaks, **A12**
revenue-burst timing — concentrate revenue immediately before underwriting, then
stop. Each becomes a reproducible scenario in a harness that runs in CI.
*Done when:* each of A8–A12 is a scripted scenario that provably succeeds against
today's implementation and fails against the new one, and the harness runs on
every push.

**Onchain monitoring and alerting stack — 60 backend + 25 frontend hrs — $4,425**
*Done when:* a public dashboard exposes per-vault and pool liquidity, utilization,
outstanding principal, overdue loans, staked value and realized loss; alerting
fires on overdue-loan backlog, failed score publication, indexer lag, cluster-cap
breach and solvency-invariant drift; and a documented drill triggers each alert.

**Threat model + data flow diagram (STRIDE) — 20 protocol + 25 backend hrs — $2,675**
*Done when:* a published document contains a data flow diagram identifying trust
boundaries and data entities across agent, SDK, indexer, signer and contracts,
with a STRIDE assessment against that diagram, and every identified threat mapped
either to an existing control or a tracked mitigation.

**Lender dashboard — 35 frontend hrs — $1,575**
*Done when:* a lender connects a wallet on testnet and completes deposit →
position view → yield claim → withdraw against both an isolated vault and the
pool, with each agent's posted stake visible before depositing.

---

## Tranche #3 Deliverables — Mainnet · 460 hours · $27,350 · due 05/02/2027

| Deliverable | Hours (P/B/F) | Cost |
|---|---|---:|
| Rust indexer and payment graph | 95 / 30 / 0 | $7,825 |
| Mainnet underwriting engine | 20 / 75 / 0 | $5,425 |
| Mainnet launch: pool + stake, staged caps | 50 / 35 / 0 | $5,175 |
| Rust agent SDK crate (crates.io) | 55 / 0 / 0 | $3,575 |
| Production reliability and chaos drill | 0 / 55 / 0 | $3,025 |
| SDK v1.0, docs and integration guide | 0 / 30 / 15 | $2,325 |

**Rust indexer and payment graph — 95 protocol + 30 backend hrs — $7,825**
Migrates revenue indexing — Soroban RPC event ingestion, the Horizon
deep-history fallback, and the persistent payment graph — to Rust. This is the
throughput-bound component: it must keep pace with ledger close times while
maintaining a graph that grows monotonically, and it feeds both the independence
engine and the cluster-detection work.
*Done when:* the Rust indexer runs against testnet in parallel with the
TypeScript one for 72 hours and produces byte-identical payment-graph state;
ingestion keeps pace with ledger close under a synthetic burst; and the
TypeScript indexer is retired.

**Mainnet underwriting engine — 20 protocol + 75 backend hrs — $5,425**
Mainnet scores are published manually today. This brings the indexer,
independence engine and signer online against mainnet so scores are produced from
real mainnet agent revenue.
*Done when:* an agent with genuine mainnet x402 revenue is underwritten
end-to-end with no manual step, and the published on-chain score is reproducible
from public ledger data by a third party.

**Mainnet launch: pool + stake, staged caps — 50 protocol + 35 backend hrs — $5,175**
*Done when:* the pool and the stake waterfall are live on mainnet holding
third-party USDC under a published, risk-gated deposit cap schedule, with every
deployment tx hash published.

**Rust agent SDK crate (crates.io) — 55 protocol hrs — $3,575**
A `fianza-agent-sdk` crate covering the same surface as the TypeScript and Python
SDKs — register, underwrite, credit line, borrow, repay, stake, vault reads and
draw-on-402. Soroban tooling is Rust-native, so this is the SDK an agent already
running Rust infrastructure reaches for; it reuses the shared credit-math crate
rather than re-deriving policy.
*Done when:* the crate is published on crates.io with documented examples, and an
integration test runs the same register → borrow → repay sequence from all three
SDKs against one agent, producing identical on-chain outcomes.

**Production reliability and chaos drill — 55 backend hrs — $3,025**
*Done when:* service and indexer run redundantly with health-gated failover; a
documented chaos drill kills the primary with no missed score publication and no
indexer gap; and 72 hours of continuous mainnet operation completes with zero
stuck jobs.

**SDK v1.0, docs and integration guide — 30 backend + 15 frontend hrs — $2,325**
*Done when:* the SDKs ship 1.0 with mainnet and stake support plus a published
migration guide, and an external developer completes an agent integration on
mainnet following the documentation alone.

---

## Team Description

**WHO WE ARE**

A small, AI-native team that designed, built and shipped Fianza end-to-end: the
Soroban contracts (Rust), the underwriting backend, the anti-Sybil independence
engine, the payment-graph indexer, and the TypeScript and Python agent SDKs.

**HOW WE BUILD**

We build the way we expect agents to transact: AI-native. AI tooling across the
stack lets a lean team ship a genuinely working protocol rather than a mockup.
Every architectural decision, contract and test is our own, verifiable on-chain
and in the open repository. (Per Open Track guidance: AI tooling assisted
development and documentation; all design choices are the team's.)

**THE TEAM**

- **Divyanshh Kalra — Founder & CTO.** 3 years in Web3, from shipping MVPs to
  scaling production products. linkedin.com/in/divyanshh-kalra/
- **Kundan Kumar — Co-Founder & CEO.** 5 years in Web3, shipping continuously,
  multichain-agnostic. linkedin.com/in/kundandevner101/

Both founders work on Fianza full time. We build in the open
(github.com/TechnicallyKiller/Fianza), post updates at x.com/FianzaHQ, and are
active in the Stellar/Soroban and x402 developer communities.

---

## Resubmission Feedback

**[ACTION — depends on your history.]** The field reads: *"If this is a
resubmission, please answer the feedback sent to you here. For first-time
submissions, leave blank."*

That turns on whether you previously submitted a **full Build form** and were
rejected by the panel — not on whether an interest form was declined. If SCF #45
is your first full Build submission, **leave this blank**. If you submitted a
full form in an earlier round as TrustLine and received reviewer feedback, send
me that feedback and I will answer it point by point against what has shipped
since.

Material changes since the TrustLine-era submission, if useful:
- Contracts deployed to Stellar **mainnet**, with a full borrow/repay loop
  executed in real USDC (previously testnet only)
- Both SDKs published to public registries at v0.2.1
- First external adoption: Nebula built Fianza credit into its MCP server
- Independence engine extended with reciprocity and concentration signals; the
  remaining collusion-ring gap documented rather than glossed over
- Rebranded from TrustLine to Fianza to avoid collision with an unrelated,
  already-funded SCF project of the same name

---

## Claims removed from the interest form — do not reinstate

Three claims carried over from the interest form do not survive verification. A
reviewer can check all three.

1. **"Four Soroban contracts … score_registry, credit_line, lending_vault,
   revenue_math."** Only three carry `#[contract]`. `revenue_math` is a shared
   library crate, not a deployed contract. Correct framing: **three contracts
   plus a shared `revenue_math` library.**

2. **"Agent Scout went from zero to a live 775/Tier A score."** The highest
   score in the database is **645, Tier C**; every underwritten agent is Tier C
   or Unrated. No 775/Tier A result is verifiable on-chain or in stored results.
   Produce the transaction or drop the claim.

3. **"Nectar Network (flagship)."** No Nectar code exists in the repository. If
   it appears anywhere it must be labelled planned, not built. DeFindex, Tael,
   Reclaim and Nebula are all verifiable and safe to claim.

Stale links from the interest form: `0xtrustline.vercel.app`,
`trustline-agent-sdk`, `github.com/TechnicallyKiller/TrustLine`.

---

## Remaining [ACTION] items

- **Video URL** — required. Under 3 minutes, 16:9 (1920×1080), must feature the
  team, hosted on YouTube or Vimeo. Not yet produced. Open Track guidance asks
  for a professional presentation featuring the team, so put both founders on
  camera and show the live borrow/repay loop.
- **Resubmission feedback** — see above.
- **Technical Architecture Document** — the form states non-Stellar-specific
  documents are rejected. Confirm docs.fianza.space contains the data flow
  diagram, Stellar-specific integration detail, and complete system
  architecture, and that it is publicly accessible without login.
- **Team members** — each must create an SCF account before you can add them.
- **Budget** — $99,225 from 1,665 hours at $65/$55/$45, up from an earlier
  $78,625 draft. The increase is the credit-engine track: borrower stake,
  size-weighted ramp, operator-cluster caps and the expanded attack catalog
  (~$38,600 of risk work in total). Deliverable costs sum to the full amount
  while tranches #1–#3 pay only 90%; Tranche #0 covers the balance, so payment
  and cost reconcile **cumulatively**, not tranche-by-tranche. If you change any
  hours or rates, the role table, both tranche tables and the cumulative table
  must be recomputed together.
- **Ambassador affiliation** — Yes / India, as per the interest form.
