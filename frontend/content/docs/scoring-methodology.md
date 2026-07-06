# Scoring methodology

Composite revenue-coverage score: indexed on-chain x402 revenue + one
Reclaim-verified off-chain revenue figure, banded into tiers that map to
credit limits and a dynamic (utilization-based) APR — computed identically on
both the backend (`scoring/`) and on-chain (`revenue_math`), so the two never
drift apart.

**The full mechanics — effective revenue, score bands, repayment adjustment,
tier mapping, credit ramps, and the on-chain risk engine — are documented in
detail in [How the credit engine works §2–4](credit-engine.md#2-the-independence-engine---the-sybil-tracker-the-moat).**
This page is intentionally short; that one is the ground-truth reference.
