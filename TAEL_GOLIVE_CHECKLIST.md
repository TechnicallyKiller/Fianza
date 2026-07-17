# Tael × TrustLine — go-live checklist

_The code is merged on both sides. What's left is operational. This lists every
step to actually make it work, in dependency order, split by who does it. Each
step says why it's needed and how to confirm it worked._

Status legend: ☐ not done · ⚠️ blocked on an earlier step · ✅ done

---

## Layer 0 — TrustLine backend must run the LATEST code (blocks EVERYTHING)

The service at `https://trustline-rpxt.onrender.com` is **up**, but it's
running **old code**: `/config` works, yet `/agent/:address/available-credit`
and `/agent/:address/tael-revenue` both 404. Root cause: Render deploys from
`main`, and the Tael work lives on the `feat/tael-integration` branch, which
is **not yet merged into `main`**.

- ☐ **[YOU] Merge `feat/tael-integration` into `main`** (or point Render at that
  branch). This is the actual blocker — the endpoints exist in the branch, just
  not on the branch Render builds.
- ☐ **[YOU] Redeploy** from the merged `main` (`render.yaml`, `npm run build` →
  `npm start`).
- ☐ **[YOU] Confirm `/available-credit` now resolves** (verify block below).
- ☐ **[YOU] Confirm the Tael revenue indexer env is set** (optional but needed
  for underwriting on Tael income): set `TAEL_USDC_ISSUER` in the backend's
  Render env to Tael's testnet USDC issuer. Unset = Tael revenue is ignored
  (safe, just means agents won't be underwritten on their Tael earnings yet).

  **Verify Layer 0:**
  ```
  curl https://trustline-rpxt.onrender.com/health
    → { "ok": true, ... }
  curl https://trustline-rpxt.onrender.com/agent/<any-G-address>/available-credit
    → { "agent": "...", "rampedLimitUsdc": 0, "tier": 0, "aprBps": 0 }   (200, not 404/suspended)
  ```

---

## Layer 1 — TrustLine side setup (YOU)

Do these once Layer 0 verifies.

- ☐ **Decide the payout wallet for credit-check fees.**
  The `credit` capability's `payTo` is where the $0.10-per-check fees land.
  There is **no dedicated treasury wallet in the env today** — either:
  - reuse an existing TrustLine-controlled wallet, or
  - create a fresh Stellar wallet, fund it with a little XLM + add the USDC
    trustline (so it can receive USDC).
  Write the chosen public `G...` address down — Layer 3 needs it.

- ☐ **Publish the `credit` capability on Tael's marketplace** (via their
  dashboard publish wizard) with:
  | field | value |
  |---|---|
  | name | `trustline-credit` |
  | kind | `credit` |
  | upstreamUrl | `https://trustline-rpxt.onrender.com/agent/{payer}/available-credit` |
  | upstreamSecret | *(blank — public endpoint)* |
  | payTo | *your payout wallet from above* |
  | price | `$0.10` |

  Use the literal `{payer}` token — Tael now substitutes the calling agent's
  verified address at call time (they shipped this: `applyPayerToken`), so ONE
  listing serves every caller with their own credit read. (Earlier this had to
  be a hardcoded address; that limitation is gone.)

  (Can only be done after Layer 2 step 1 — the marketplace must know the
  `credit` kind, which needs their migration applied. Coordinate ordering.)

- ☐ **(Optional) `TAEL_PARTNER_HMAC_SECRET`** — leave UNSET. The endpoint works
  fully open (it returns only public, read-only credit data). If you ever want
  to verify calls genuinely came through Tael's gateway, get their
  `PARTNER_HMAC_SECRET` and set this env var — no code change needed, the
  verification is already built and falls open when unset. Not a blocker.

- ☐ **Publish `@trustline-agents/agent-sdk@0.2.0`** — ✅ already done (live on
  npm; verified it contains the Tael-compatible payWithCredit fix).

---

## Layer 2 — Tael side setup (THEM — send them this section)

The code is merged, but three operational steps remain before it functions:

- ☐ **Apply the DB migration** to production Postgres — the merged
  `0012_...capability_kind ADD VALUE 'credit'` migration. Without it, the DB
  enum rejects `credit` capabilities.
  Verify: publishing a `credit`-kind capability succeeds (no enum error).

- ☐ **Set `TRUSTLINE_API` in the dashboard deployment env**:
  ```
  TRUSTLINE_API=https://trustline-rpxt.onrender.com
  ```
  Unset = the credit-draw fallback stays dormant (no borrowing ever happens).

- ☐ **Add the `allowCreditDraw` toggle to the agent-settings UI.**
  The merged code *reads* `policy.allowCreditDraw`, but nothing *sets* it yet.
  Needs a checkbox in the agent's policy editor ("Allow this agent to draw
  TrustLine credit when short on USDC"). Until this exists, the flag is always
  false and no agent can opt in — the whole pay-on-credit feature is
  unreachable through the UI.
  Verify: toggling it on an agent persists `allowCreditDraw: true` in that
  agent's `policy` JSON.

---

## Layer 3 — prove one real agent end to end (YOU + THEM)

Once Layers 0–2 verify, run the actual flow with one agent:

- ☐ **Pick/create a Tael agent** whose wallet has earned some real testnet
  revenue (a couple of settled Tael capability payments — this is what makes it
  underwritable).
- ☐ **Onboard that wallet to TrustLine**: run the SDK once against its secret —
  ```js
  import { TrustLineAgent } from "@trustline-agents/agent-sdk";
  const tl = new TrustLineAgent(WALLET_SECRET, { apiBaseUrl: "https://trustline-rpxt.onrender.com" });
  await tl.onboard();                    // register + underwrite
  console.log(await tl.availableCreditUsdc());   // should be > 0
  ```
- ☐ **Flip `allowCreditDraw` on** for that agent (via the new toggle from Layer 2).
- ☐ **Run a capability it can't afford** — a call priced above its wallet's USDC
  balance. Expected: it borrows the shortfall and succeeds, instead of "Fund it
  first."
  Verify: on Horizon, the wallet shows a `borrow` transaction landing USDC just
  before the capability's own payment. Server logs do NOT show
  `[run] TrustLine credit draw failed`.
- ☐ **Confirm the safety gates** (quick negative tests):
  - `allowCreditDraw` off → same call fails with the old "Fund it first" error.
  - `TRUSTLINE_API` unset → same.

---

## What "done" looks like

An autonomous agent earning on Tael, with credit enabled, that pays for
capabilities it couldn't otherwise afford — borrowing on the fly, repaying from
its Tael earnings, its limit growing over time. Tael earns its marketplace fee
on every call (including the $0.10 credit checks); TrustLine earns the
credit-check fee now and loan interest once real lending is live on mainnet.

## Honest status of the money side

- **$0.10 credit-check fee**: real and works the moment the capability is
  published (settles through Tael's rails to your payout wallet).
- **Loan interest**: the lending contract currently splits interest only to
  lenders + reserve — there is **no protocol-fee cut to TrustLine yet**. Real
  lending revenue needs (a) mainnet, (b) real lenders, and (c) a contract change
  to route a protocol fee. That's future work, not live today.
