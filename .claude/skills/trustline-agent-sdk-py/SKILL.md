---
name: trustline-agent-sdk-py
description: Drive the TrustLine Python SDK (trustline-agent-sdk) so an AI agent can take and repay revenue-underwritten, uncollateralized USDC credit on Stellar. Covers register -> underwrite -> credit_line -> borrow -> repay, on-chain vault/credit reads, and pay_with_credit (draw-on-402: auto-borrow a shortfall then pay an x402-priced API). Testnet-first, USDC (SEP-41 SAC), stellar:testnet. Use when writing a Python agent that earns, gets underwritten, and pays for its own inputs on credit.
user-invocable: true
argument-hint: "[what the agent should do — onboard / underwrite / borrow / pay an x402 API on credit]"
---

# TrustLine Agent SDK (Python)

`trustline-agent-sdk` (import `trustline`) is the Python interface an AI agent
uses to take and repay **revenue-underwritten, uncollateralized USDC credit** on
TrustLine (Stellar/Soroban). The agent holds its own Stellar key, so the whole
lifecycle is agent-driven. It is the Python port of the TypeScript
`@trustline-agents/agent-sdk` — same backend API, same on-chain contracts.

The one-line thesis: an agent proves real revenue → TrustLine underwrites it →
the agent gets a credit line it draws against to pay for its own inputs (APIs,
compute, other agents) and repays as it earns.

## Quick decision — which method

| You want to… | Call |
|--|--|
| Register the agent on-chain (one-time) | `tl.register()` |
| Score + publish a credit line from revenue | `tl.underwrite(skip_proof=True)` |
| Do both in one step | `tl.onboard(skip_proof=True)` |
| Read the current credit terms | `tl.credit_line()` |
| Read isolated-vault state | `tl.vault_state()` |
| See remaining drawable credit | `tl.available_credit_usdc()` |
| Draw cash against the line | `tl.borrow(usdc)` |
| Repay (interest → lender yield, then principal) | `tl.repay(usdc)` |
| Lend into another agent's vault | `tl.deposit(agent_address, usdc)` |
| Pay an x402 API, auto-borrowing any shortfall | `tl.pay_with_credit(url, price_usdc, ...)` |

- Just getting an agent live → **Onboarding** below.
- Agent needs to pay for an x402 resource it can't fully afford → **Draw-on-402** below.
- Unsure why a fresh agent got `limit_usdc=0` → that's correct: zero revenue =
  Unrated tier = 0 limit, by design. Earn real x402 revenue, then re-`underwrite()`.

## Install

Not yet on PyPI. Install from the monorepo:

```bash
pip install -e packages/agent-sdk-py          # editable, for local dev
# or once published:  pip install trustline-agent-sdk
```

Requires Python ≥3.10, `stellar-sdk` (13–15.x) and `requests` (installed
automatically). If the WSL/Linux box has no `pip`, bootstrap it — see the repo
memory note `trustline-python-env`.

## Construct

```python
from stellar_sdk import Keypair
from trustline import TrustLineAgent

tl = TrustLineAgent(
    secret,                                    # the agent's S... secret
    api_base_url="https://trustline.onrender.com",  # the TrustLine backend
    # rpc_url=..., network_passphrase=...,     # default: testnet
    # contracts={"registry","creditLine","vault"},  # else auto-resolved from /config
)
```

Contract ids are auto-resolved from the backend `/config` on first use and
cached. Pass `contracts=` only to pin them.

## Onboarding (register → underwrite → read line)

```python
tl.register()                              # on-chain, one-time
result = tl.underwrite(skip_proof=True)    # revenue → score → publish on-chain
print(result["score"])                     # {'score','tier','limitUsdc','aprBps',...}

terms = tl.credit_line()                   # simulate-only read
# CreditTerms(tier=..., limit_usdc=..., apr_bps=...)
```

`skip_proof=True` skips the slow zkTLS off-chain-revenue proof (Reclaim, ~70–90s)
— use it for fast on-chain-only scoring. Drop it to also fold in proven off-chain
revenue.

A fresh, zero-revenue agent correctly returns **score 400 / Unrated / limit 0**.
That is the honest result, not a bug.

## Draw-on-402 (the headline feature)

`pay_with_credit` fetches an [x402](https://x402.org)-priced resource and, if the
wallet can't cover the price, **draws the shortfall from the credit line first**,
then pays. The agent never "decides to borrow" — it just transacts.

```python
res = tl.pay_with_credit(
    "http://localhost:3099/research",
    0.05,                       # price in USDC (the agent knows what it's buying)
    method="POST",
    json_body={"asset": "BTC"},
    max_draw=None,              # optional cap; raises MaxDrawExceededError if exceeded
)
data = res.json()               # returns a requests.Response
```

Under the hood: `balance < price` → `borrow(shortfall)` on-chain → build + sign
the x402 **exact-Stellar** payment (SEP-41 transfer, agent signs an auth entry
only) → the facilitator settles it → resource returned. No extra dependency: the
SDK reimplements the `@x402/stellar` exact scheme in `trustline/x402.py`.

For selling/paying x402 in general (facilitator setup, seller side, MPP), see the
[`agentic-payments`](../../../.stellar-dev-skill/skills/agentic-payments/SKILL.md)
skill.

## Errors (all subclass `TrustLineError`)

```python
from trustline import (
    TrustLineError, ValidationError, ApiError, TxError, MaxDrawExceededError,
)
```

- `ValidationError` — bad input (non-finite/≤0 amount, malformed address).
- `ApiError` — backend returned non-2xx (`.status`, `.method`, `.path`, `.body`).
- `TxError` — on-chain tx failed to simulate/submit/confirm (`.contract_method`, `.detail`).
- `MaxDrawExceededError` — `pay_with_credit` would draw past `max_draw` (`.need`, `.max_draw`).

## Pure helpers (unit-tested, no network)

```python
from trustline import to_stroops, from_stroops, is_valid_stellar_address, credit_shortfall_usdc
to_stroops(0.3)                # 3_000_000  (USDC → 7-decimal stroops)
credit_shortfall_usdc(0.1, 0.3)  # 0.2  (how much to borrow to afford 0.3 with 0.1 on hand)
```

## Runnable examples

- `packages/agent-sdk-py/examples/quickstart.py` — fresh keypair → Friendbot →
  faucet → register → underwrite → borrow → repay, all real against live testnet.
- `agents/demo/plain.py` vs `agents/demo/with_credit.py` — the apples-to-apples
  demo: same agent, same paywall; `plain.py` (wallet only) dies when broke,
  `with_credit.py` draws credit and pays. Start the Analyst server first:
  `cd agents/analyst && ANALYST_PORT=3099 ANALYST_PRICE_USDC=0.05 node server.mjs`.

## Common pitfalls

**Fresh agent scores 0 / Unrated**
- Not a bug. Zero on-chain (and off-chain) revenue → Unrated tier → 0 limit.
  Earn real x402 revenue, then call `underwrite()` again.

**`borrow` / `pay_with_credit` fails with a SAC error #10 (`resulting balance not within allowed range`)**
- The agent's USDC transfer would go negative — it has no cash and (for a raw pay)
  no credit fallback. Use `pay_with_credit` (auto-borrows) and confirm
  `available_credit_usdc()` covers the price. This is exactly what the `plain.py`
  demo shows as a real failure.

**SAC error #13 (`trustline entry is missing`)**
- The **recipient** (or the agent) lacks a USDC trustline. Open one before paying
  (`change_trust` for `USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`
  on testnet). See the `agentic-payments` testnet runbook.

**Reads (`credit_line`, `vault_state`, `usdc_balance_usdc`) raise on a brand-new key**
- They simulate against the agent's account, which must exist on-chain first
  (Friendbot-fund it). Register/onboard after funding.

**Backend cold-start (Render free tier)**
- First request after ~15 min idle wakes the backend (~30–60s). A slow first
  `/config` / `underwrite` is the wake, not a hang.

**Amounts are in USDC, not stroops**
- All SDK method args (`borrow(1)`, `pay_with_credit(url, 0.05)`) are human USDC.
  The SDK converts to 7-decimal stroops internally. Only use `to_stroops` if you
  need raw base units yourself.

## Related skills
- x402 seller/buyer, MPP, facilitator setup → `../../../.stellar-dev-skill/skills/agentic-payments/SKILL.md`
- The Soroban contracts underneath (score_registry / credit_line / lending_vault) → `../../../.stellar-dev-skill/skills/soroban/SKILL.md`
- USDC trustlines and classic assets → `../../../.stellar-dev-skill/skills/assets/SKILL.md`
