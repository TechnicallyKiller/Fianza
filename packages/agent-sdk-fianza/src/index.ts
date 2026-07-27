// @trustline-agents/agent-sdk — the interface an AI agent uses to take and repay
// revenue-underwritten credit on Fianza (Stellar), settled in USDC.
//
// An agent holds its own Stellar key, so the whole lifecycle is agent-driven:
//   const tl = new FianzaAgent(secret, { apiBaseUrl, contracts });
//   await tl.register();
//   await tl.underwrite();                 // backend scores + publishes on-chain
//   const { limitUsdc } = await tl.creditLine();
//   await tl.borrow(5);  /* ...work... */  await tl.repay(5);
//
// On-chain writes (register/borrow/repay) are signed by the agent's own key.
// Reads (creditLine/vaultState) are simulate-only. Scoring/underwriting is
// delegated to the Fianza backend (the trusted underwriter, v1).

import {
  rpc,
  Contract,
  Address,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  Keypair,
  BASE_FEE,
  TimeoutInfinite,
  type xdr,
} from "@stellar/stellar-sdk";

import {
  toStroops,
  fromStroops,
  assertPositiveAmount,
  assertValidAddress,
  creditShortfallUsdc,
} from "./util.js";
import { ApiError, TxError } from "./errors.js";
import { isTaelChallenge, payTael } from "./tael-pay.js";

// Re-export the error types + pure helpers so callers can catch typed errors
// and reuse the conversions.
export * from "./errors.js";
export {
  toStroops,
  fromStroops,
  isValidStellarAddress,
  creditShortfallUsdc,
} from "./util.js";

const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";
const TESTNET_RPC = "https://soroban-testnet.stellar.org";

const MAINNET_PASSPHRASE = "Public Global Stellar Network ; September 2015";
// Free public mainnet Soroban RPCs are individually flaky (confirmed in
// production: writes intermittently fail to confirm on one endpoint while
// succeeding immediately on another). read()/invoke() try each of these in
// turn — rpcUrl, if set, is tried first.
const MAINNET_RPC_URLS = [
  "https://mainnet.sorobanrpc.com",
  "https://rpc.ankr.com/stellar_soroban",
  "https://soroban-rpc.mainnet.stellar.gateway.fm",
];

// The 3 contracts deployed and verified live on mainnet (see docs/contracts.md
// "Mainnet deployment"). Used as defaults when network:"mainnet" is set and no
// explicit opts.contracts is given — same shape as the testnet default of
// resolving from the backend's `/config`, just hardcoded since these never
// change without a fresh mainnet deploy.
const MAINNET_CONTRACTS = {
  registry: "CAHWYFLMQI6BBOL6ZLZRRINCK6KVBX73ACH7LCPB24WDED4LSMCI7YZC",
  creditLine: "CDK7S4UWY227FHFKDSV37DGT7AIJ5Z2QEYO5AY456M7RBGJN25WYJVGC",
  vault: "CAE5C5UJYVED5DAVY4YKYT6E2C4NBZCIUBAK2MXGKGLKZESBBXKFPZ4U",
};

const MAINNET_USDC_SAC = "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75";

export interface FianzaContracts {
  registry: string;
  creditLine: string;
  vault: string;
}

export interface FianzaOptions {
  /**
   * Which network to operate on. Sets sensible RPC/passphrase/contract/API
   * defaults for that network; any of rpcUrl/networkPassphrase/contracts/
   * apiBaseUrl passed explicitly still overrides the default for that field.
   * Default: "testnet" (this SDK's original behavior, unchanged).
   */
  network?: "testnet" | "mainnet";
  /** Soroban RPC url (default: testnet's, or mainnet's if network:"mainnet"). */
  rpcUrl?: string;
  /** Network passphrase (default: testnet's, or mainnet's if network:"mainnet"). */
  networkPassphrase?: string;
  /**
   * Fianza underwriting API base url (default: http://localhost:8787).
   * On network:"mainnet", previewCredit()/underwrite()/revenue() call the
   * backend's isolated /mainnet/* routes instead of the testnet-shaped
   * /agent/* ones — see backend/src/mainnet.ts. Those routes read the
   * already-deployed mainnet contracts directly (no live indexer/scorer:
   * there is no real mainnet agent revenue yet to underwrite against), so
   * underwrite()/revenue() are NOT meaningful calls on mainnet today and
   * will throw — use previewCredit()/creditLine()/vaultState() instead.
   */
  apiBaseUrl?: string;
  /** Contract ids. If omitted, resolved from the backend `/config` (testnet) or the known mainnet deploy (mainnet). */
  contracts?: Partial<FianzaContracts>;
}

export interface CreditTerms {
  /** Tier enum from the contract (0 = Unrated). */
  tier: number;
  /** Maximum outstanding principal, in USDC. */
  limitUsdc: number;
  /** Fixed APR, basis points. */
  aprBps: number;
}

export interface VaultState {
  liquidityUsdc: number;
  principalUsdc: number;
  amountOwedUsdc: number;
  /** Current liquidity + principal deployed (backs lender shares; reserve excluded) — NOT cumulative deposits. */
  totalAssetsUsdc: number;
  yieldPoolUsdc: number;
  limitUsdc: number;
  aprBps: number;
}

/** Which tier band an agent's score falls into. Mirrors the backend/contracts. */
export type Tier = "A" | "B" | "C" | "Unrated";

// Mirrors revenue_math::Tier in the Rust contracts (Unrated=0, C=1, B=2, A=3).
const TIER_LABELS: Tier[] = ["Unrated", "C", "B", "A"];
function tierNumberToLabel(tier: string | number): Tier {
  if (typeof tier === "string" && (TIER_LABELS as string[]).includes(tier)) return tier as Tier;
  const n = Number(tier);
  return TIER_LABELS[n] ?? "Unrated";
}

/**
 * The composite score/limit/APR result the underwriting engine computes.
 * Mirrors `backend/src/scoring/index.ts`'s `ScoreResult` field-for-field.
 */
export interface ScoreResult {
  agent: string;
  score: number;
  tier: Tier;
  /** Effective verified revenue used to size credit (stroops + USDC). */
  revenueStroops: string;
  revenueUsdc: number;
  /** Tier ceiling — what this agent could draw with a perfect repayment
   * track record. NOT what it can borrow right now — see `rampedLimitUsdc`. */
  limitStroops: string;
  limitUsdc: number;
  /** The REAL, currently-drawable limit the vault contract enforces. */
  rampedLimitStroops: string;
  rampedLimitUsdc: number;
  aprBps: number;
  distinctPayers: number;
  minCounterparties: number;
  onchainCounts: boolean;
  repayments: { onTime: number; total: number; missed: number };
  /** True when a recorded default has collapsed the score below lending grade. */
  defaulted: boolean;
  components: {
    onchainUsdc: number;
    offchainUsdc: number;
    offchainWeight: number;
    historyDelta: number;
  };
  issuedAt: number;
}

/**
 * Full result of a `POST /agent/:address/underwrite` pass. `revenue`,
 * `independence`, `proof`, `attestation`, and `submission` are intentionally
 * typed loosely (`Record<string, unknown>`) rather than fully mirrored here —
 * they're diagnostic/audit detail whose shape lives in the backend, not part
 * of the SDK's stable contract. `score` (the actual credit decision) is fully
 * typed — see {@link ScoreResult}.
 */
export interface UnderwritingResult {
  agent: string;
  revenue: Record<string, unknown>;
  independence: Record<string, unknown> | null;
  proof: Record<string, unknown> | null;
  proofError: string | null;
  score: ScoreResult;
  attestation: Record<string, unknown>;
  submission: Record<string, unknown>;
  underwroteAt: number;
}

/** Response shape of `GET /agent/:address/available-credit` — see {@link previewCredit}. */
export interface CreditPreview {
  agent: string;
  rampedLimitUsdc: number;
  limitUsdc: number;
  tier: Tier;
  aprBps: number;
  revenueUsdc: number;
  distinctPayers: number;
}

export interface TxResult {
  txHash: string;
  returnValue: unknown;
  explorerUrl: string;
}

export class FianzaAgent {
  readonly keypair: Keypair;
  readonly network: "testnet" | "mainnet";
  private server: rpc.Server;
  private rpcUrls: string[];
  private passphrase: string;
  private apiBaseUrl: string;
  private contracts: FianzaContracts | null = null;
  private optContracts: Partial<FianzaContracts>;
  private usdcSacId: string | null = null;

  constructor(secret: string, opts: FianzaOptions = {}) {
    this.keypair = Keypair.fromSecret(secret);
    this.network = opts.network ?? "testnet";
    const isMainnet = this.network === "mainnet";

    this.passphrase = opts.networkPassphrase ?? (isMainnet ? MAINNET_PASSPHRASE : TESTNET_PASSPHRASE);
    this.rpcUrls = opts.rpcUrl
      ? [opts.rpcUrl, ...(isMainnet ? MAINNET_RPC_URLS : [])]
      : isMainnet
        ? MAINNET_RPC_URLS
        : [TESTNET_RPC];
    this.server = new rpc.Server(this.rpcUrls[0]);
    this.apiBaseUrl = opts.apiBaseUrl ?? "http://localhost:8787";

    this.optContracts = opts.contracts ?? (isMainnet ? MAINNET_CONTRACTS : {});
    const c = this.optContracts;
    if (c.registry && c.creditLine && c.vault) {
      this.contracts = c as FianzaContracts;
    }
    if (isMainnet) this.usdcSacId = opts.contracts ? this.usdcSacId : MAINNET_USDC_SAC;
  }

  /** This agent's Stellar public key. */
  publicKey(): string {
    return this.keypair.publicKey();
  }

  /** The mainnet-routed underwriting path prefix, or "" on testnet. */
  private get apiNetworkPrefix(): string {
    return this.network === "mainnet" ? "/mainnet" : "";
  }

  /** Resolve contract ids (from opts, the known mainnet deploy, or the backend `/config`), cached. */
  async ensureContracts(): Promise<FianzaContracts> {
    if (this.contracts) return this.contracts;
    const cfg = await this.apiGet<{
      scoreRegistryContractId?: string;
      creditLineContractId?: string;
      lendingVaultContractId?: string;
    }>(`${this.apiNetworkPrefix}/config`);
    const c: Partial<FianzaContracts> = {
      registry: this.optContracts.registry ?? cfg.scoreRegistryContractId,
      creditLine: this.optContracts.creditLine ?? cfg.creditLineContractId,
      vault: this.optContracts.vault ?? cfg.lendingVaultContractId,
    };
    if (!c.registry || !c.creditLine || !c.vault) {
      throw new Error(
        `Fianza contract ids unavailable from ${this.apiNetworkPrefix}/config — pass them via opts.contracts.`,
      );
    }
    this.contracts = c as FianzaContracts;
    return this.contracts;
  }

  /** USDC Stellar Asset Contract id (from opts, the known mainnet SAC, or the backend `/config`), cached. */
  private async usdcSac(): Promise<string> {
    if (this.usdcSacId) return this.usdcSacId;
    const cfg = await this.apiGet<{ usdcSac: string }>(`${this.apiNetworkPrefix}/config`);
    if (!cfg.usdcSac) throw new Error(`usdcSac unavailable from ${this.apiNetworkPrefix}/config`);
    this.usdcSacId = cfg.usdcSac;
    return this.usdcSacId;
  }

  // ---- Underwriting (delegated to the backend) ----

  /**
   * Live x402 revenue index for this agent. TESTNET ONLY — there is no live
   * mainnet revenue indexer (no real mainnet agent revenue exists yet to
   * index), so this throws immediately on network:"mainnet" rather than
   * hitting a 404. Use {@link creditLine} / {@link vaultState} for the
   * already-published mainnet terms instead.
   */
  async revenue(fromLedger?: number): Promise<unknown> {
    if (this.network === "mainnet") {
      throw new Error(
        "revenue() has no mainnet equivalent yet — there is no live mainnet " +
          "revenue indexer. Use creditLine()/vaultState() to read already-published terms.",
      );
    }
    const q = fromLedger ? `?fromLedger=${fromLedger}` : "";
    return this.apiGet(`/agent/${this.publicKey()}/revenue${q}`);
  }

  /**
   * Run the full underwriting pass (revenue → proof → score → publish).
   * TESTNET ONLY — see {@link revenue}; throws immediately on mainnet.
   */
  async underwrite(
    opts: { skipProof?: boolean; fromLedger?: number } = {},
  ): Promise<UnderwritingResult> {
    if (this.network === "mainnet") {
      throw new Error(
        "underwrite() has no mainnet equivalent yet — there is no live mainnet " +
          "scorer to re-underwrite against. The agent's mainnet terms were " +
          "published manually; read them with creditLine()/vaultState().",
      );
    }
    const q = new URLSearchParams();
    if (opts.skipProof) q.set("skipProof", "true");
    if (opts.fromLedger) q.set("fromLedger", String(opts.fromLedger));
    const qs = q.toString();
    return this.apiPost(
      `/agent/${this.publicKey()}/underwrite${qs ? `?${qs}` : ""}`,
    );
  }

  /**
   * Convenience: register on-chain, then run an underwriting pass. TESTNET
   * ONLY — see {@link underwrite}. On mainnet, call {@link register} directly
   * (its on-chain terms come from whatever score was already published).
   */
  async onboard(opts: { skipProof?: boolean; fromLedger?: number } = {}): Promise<{
    register: TxResult;
    underwrite: UnderwritingResult;
  }> {
    const register = await this.register();
    const underwrite = await this.underwrite(opts);
    return { register, underwrite };
  }

  /**
   * Read-only live credit preview. On testnet, `GET /agent/:address/available-credit`
   * — this agent's CURRENT score/limit/tier from its real on-chain revenue
   * right now, no zkTLS proof, no on-chain write, nothing persisted. On
   * mainnet, `GET /mainnet/agent/:address/credit` — the agent's already-
   * published terms + live vault state (no fresh scoring pass, since none
   * exists yet); `rampedLimitUsdc`/`revenueUsdc`/`distinctPayers` are testnet-
   * scoring concepts with no mainnet equivalent and read 0 there — read
   * `limitUsdc`/`tier`/`aprBps` instead, or call {@link vaultState} directly.
   */
  async previewCredit(): Promise<CreditPreview> {
    if (this.network === "mainnet") {
      const info = await this.apiGet<{
        agent: string;
        tier: string | number;
        limitUsdc: number;
        aprBps: number;
        vault: { availableCreditUsdc: number } | null;
      }>(`/mainnet/agent/${this.publicKey()}/credit`);
      return {
        agent: info.agent,
        rampedLimitUsdc: info.vault?.availableCreditUsdc ?? 0,
        limitUsdc: info.limitUsdc,
        tier: tierNumberToLabel(info.tier),
        aprBps: info.aprBps,
        revenueUsdc: 0,
        distinctPayers: 0,
      };
    }
    return this.apiGet(`/agent/${this.publicKey()}/available-credit`);
  }

  // ---- On-chain reads (simulate-only) ----

  async creditLine(): Promise<CreditTerms> {
    const c = await this.ensureContracts();
    const t = (await this.read(c.creditLine, "terms", [
      this.addr(this.publicKey()),
    ])) as { tier: number; limit: bigint | string; apr_bps: number };
    return { tier: Number(t.tier), limitUsdc: fromStroops(t.limit), aprBps: Number(t.apr_bps) };
  }

  async vaultState(): Promise<VaultState> {
    const c = await this.ensureContracts();
    const s = (await this.read(c.vault, "state", [
      this.addr(this.publicKey()),
    ])) as Record<string, bigint | string | number>;
    return {
      liquidityUsdc: fromStroops(s.liquidity as bigint),
      principalUsdc: fromStroops(s.principal as bigint),
      amountOwedUsdc: fromStroops(s.amount_owed as bigint),
      totalAssetsUsdc: fromStroops(s.total_assets as bigint),
      yieldPoolUsdc: fromStroops(s.yield_pool as bigint),
      limitUsdc: fromStroops(s.limit as bigint),
      aprBps: Number(s.apr_bps),
    };
  }

  /** Remaining drawable credit (limit − outstanding principal), in USDC. */
  async availableCreditUsdc(): Promise<number> {
    const c = await this.ensureContracts();
    const v = await this.read(c.vault, "available_credit", [
      this.addr(this.publicKey()),
    ]);
    return fromStroops(v as bigint);
  }

  /** This agent's spendable USDC balance (SAC `balance`), in USDC. */
  async usdcBalanceUsdc(): Promise<number> {
    const sac = await this.usdcSac();
    const v = await this.read(sac, "balance", [this.addr(this.publicKey())]);
    return v ? fromStroops(v as bigint) : 0;
  }

  /**
   * ✨ Draw-on-402: pay for an x402 resource, auto-drawing any shortfall from the
   * credit line first. The agent never "decides to borrow" — it just transacts,
   * and the line silently covers what its cash can't. Returns the fetch Response.
   *
   * @param url        the x402-priced resource
   * @param priceUsdc  the resource price in USDC (the agent knows what it's buying)
   * @param opts.maxDraw  optional cap on how much credit a single call may draw
   * @param opts.init     optional fetch RequestInit (method/headers/body) forwarded
   *                      to the paid request — e.g. a POST with a JSON body.
   */
  async payWithCredit(
    url: string,
    priceUsdc: number,
    opts: { maxDraw?: number; init?: RequestInit } = {},
  ): Promise<Response> {
    const bal = await this.usdcBalanceUsdc();
    // How much (if any) to draw from credit to cover the price — pure, tested
    // (throws MaxDrawExceededError if the shortfall exceeds opts.maxDraw).
    const need = creditShortfallUsdc(bal, priceUsdc, opts.maxDraw);
    if (need > 0) {
      await this.borrow(need);
    }

    // Tael-wrapped resources (rahulsainlll/tael-protocol) 402 with a CLASSIC
    // asset descriptor ({ code, issuer }), not the Soroban-contract asset
    // shape @x402/stellar's ExactStellarScheme expects — the two are
    // genuinely different x402 payloads despite both being "Stellar x402".
    //
    // IMPORTANT: this must not cost the caller a second request against the
    // existing (SAC-based) path — an earlier version of this probed with its
    // own `fetch(url, opts.init)` unconditionally, which silently double-hit
    // every server (real side effects on a non-idempotent endpoint) and could
    // corrupt a stream-body `init` before the real payment attempt read it.
    // Only a plain, safely-clonable body (string/undefined/null — the common
    // case for JSON POSTs, and what every caller in this codebase actually
    // passes) is probed; anything else (a ReadableStream, FormData, etc.)
    // skips straight to the generic scheme, unchanged from pre-Tael behavior,
    // since we can't safely inspect it without consuming it.
    const rawBody = opts.init?.body;
    const bodyIsSafeToProbe =
      rawBody === undefined || rawBody === null || typeof rawBody === "string";
    if (bodyIsSafeToProbe) {
      const probe = await fetch(url, opts.init);
      if (probe.status === 402) {
        const body = await probe.json().catch(() => undefined);
        if (isTaelChallenge(body)) {
          return payTael(url, body, { secret: this.keypair.secret(), init: opts.init });
        }
        // Not Tael-shaped: this probe's response IS the 402 the generic path
        // would have gotten anyway — but wrapFetchWithPaymentFromConfig always
        // re-fetches internally and there's no supported hook to hand it a
        // pre-fetched response, so we still fall through to it below. This
        // means exactly one extra GET/POST-with-safe-body per NON-Tael 402
        // response (not per successful call — a 200 on the first try returns
        // immediately without ever reaching the fallback). Accepted as a
        // known, bounded cost until @x402/fetch exposes a way to seed its
        // first probe; tracked as a follow-up, not silently shipped.
      } else {
        return probe; // 200 (or a non-402 error) on the first try — no payment needed.
      }
    }

    const caip =
      this.passphrase === TESTNET_PASSPHRASE ? "stellar:testnet" : "stellar:pubnet";
    const { wrapFetchWithPaymentFromConfig } = await import("@x402/fetch");
    const { createEd25519Signer } = await import("@x402/stellar");
    const { ExactStellarScheme } = await import("@x402/stellar/exact/client");
    const signer = createEd25519Signer(this.keypair.secret(), caip);
    const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
      schemes: [{ network: caip, client: new ExactStellarScheme(signer) }],
    });
    return fetchWithPayment(url, opts.init);
  }

  // ---- On-chain writes (signed by this agent) ----

  /** Register this agent in the score registry (one-time). */
  async register(): Promise<TxResult> {
    const c = await this.ensureContracts();
    return this.invoke(c.registry, "register", [this.addr(this.publicKey())]);
  }

  /** Draw `usdc` against the credit line into this agent's wallet. */
  async borrow(usdc: number): Promise<TxResult> {
    assertPositiveAmount(usdc, "borrow amount");
    const c = await this.ensureContracts();
    // Testnet bootstrap: make sure the vault actually holds the USDC before we
    // sign the draw. A credit line is only PERMISSION to borrow — the money has
    // to have been deposited by a lender. On testnet the Fianza treasury is
    // the lender-of-first-resort and seeds the exact shortfall on demand; on
    // mainnet (no treasury) this is a no-op and a real lender must have funded
    // the vault. Best-effort and non-throwing — see ensureLiquidity.
    await this.ensureLiquidity(usdc);
    return this.invoke(c.vault, "borrow", [
      this.addr(this.publicKey()),
      this.i128(toStroops(usdc)),
    ]);
  }

  /**
   * Repay `usdc` (interest first → lender yield, then principal).
   *
   * On testnet, once this clears the balance it also settles the repayment into
   * the agent's on-chain CREDIT HISTORY via the backend — the vault itself
   * never writes to score_registry, so without this an agent could repay
   * perfectly forever and its credit ramp would never grow. Best-effort: a
   * settlement failure is swallowed, since the repayment itself already
   * succeeded on-chain and must not be reported as failed. Skipped on mainnet
   * (no underwriting backend there yet).
   */
  async repay(usdc: number): Promise<TxResult> {
    assertPositiveAmount(usdc, "repay amount");
    const c = await this.ensureContracts();
    const result = await this.invoke(c.vault, "repay", [
      this.addr(this.publicKey()),
      this.i128(toStroops(usdc)),
    ]);
    if (this.network !== "mainnet") {
      try {
        await this.apiPost(`/agent/${this.publicKey()}/settle-repayment`);
      } catch {
        /* credit-history settlement is best-effort — the repay already landed */
      }
    }
    return result;
  }

  /**
   * Repay everything currently owed (principal + accrued interest), reading
   * `amountOwedUsdc` from the vault first so the caller doesn't have to track
   * it manually. Capped at the agent's spendable USDC balance — repays as much
   * as it can rather than throwing, and returns `null` (no tx) if either there
   * is nothing owed or there is no spare balance to repay with. Reversed order
   * from a hand-rolled "read then repay" so this is the one-call convenience.
   */
  async repayAll(): Promise<TxResult | null> {
    const [state, balance] = await Promise.all([this.vaultState(), this.usdcBalanceUsdc()]);
    const owed = state.amountOwedUsdc;
    if (!(owed > 0)) return null;
    const amount = Math.min(owed, balance);
    if (!(amount > 0)) return null;
    return this.repay(amount);
  }

  /**
   * Supply `usdc` of liquidity into `agentAddress`'s isolated vault. LP action —
   * the caller (this keypair) is the lender, exposed only to that one agent.
   */
  async deposit(agentAddress: string, usdc: number): Promise<TxResult> {
    assertValidAddress(agentAddress, "agentAddress");
    assertPositiveAmount(usdc, "deposit amount");
    const c = await this.ensureContracts();
    return this.invoke(c.vault, "deposit", [
      this.addr(this.publicKey()),
      this.addr(agentAddress),
      this.i128(toStroops(usdc)),
    ]);
  }

  // ---- internals ----

  private addr(a: string): xdr.ScVal {
    return new Address(a).toScVal();
  }
  private i128(n: bigint): xdr.ScVal {
    return nativeToScVal(n, { type: "i128" });
  }

  /**
   * Run `fn` against each RPC in {@link rpcUrls} in turn, returning the first
   * success. Only meant for idempotent/read-style calls — see {@link invoke}
   * for why writes don't retry this way across the whole submit+confirm flow.
   */
  private async withRpcFallback<T>(fn: (server: rpc.Server) => Promise<T>): Promise<T> {
    let lastErr: unknown;
    for (const url of this.rpcUrls) {
      const server = url === this.rpcUrls[0] ? this.server : new rpc.Server(url);
      try {
        return await fn(server);
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr;
  }

  private async read(
    contractId: string,
    method: string,
    args: xdr.ScVal[],
  ): Promise<unknown> {
    return this.withRpcFallback(async (server) => {
      const acct = await server.getAccount(this.publicKey());
      const tx = new TransactionBuilder(acct, {
        fee: BASE_FEE,
        networkPassphrase: this.passphrase,
      })
        .addOperation(new Contract(contractId).call(method, ...args))
        .setTimeout(30)
        .build();
      const sim = await server.simulateTransaction(tx);
      if (rpc.Api.isSimulationError(sim)) {
        throw new Error(`${method} simulation failed: ${sim.error}`);
      }
      const retval = sim.result?.retval;
      return retval ? scValToNative(retval) : null;
    });
  }

  private async invoke(
    contractId: string,
    method: string,
    args: xdr.ScVal[],
  ): Promise<TxResult> {
    // Only the build+prepare steps (read-only against the RPC) fall back
    // across rpcUrls. Once sendTransaction() actually submits, we stick to
    // that same server for confirmation polling — retrying submission itself
    // on a different RPC after an ambiguous failure risks double-submitting.
    const { prepared, server } = await this.withRpcFallback(async (server) => {
      const acct = await server.getAccount(this.publicKey());
      const tx = new TransactionBuilder(acct, {
        fee: BASE_FEE,
        networkPassphrase: this.passphrase,
      })
        .addOperation(new Contract(contractId).call(method, ...args))
        .setTimeout(TimeoutInfinite)
        .build();
      const prepared = await server.prepareTransaction(tx);
      return { prepared, server };
    });
    prepared.sign(this.keypair);
    const sent = await server.sendTransaction(prepared);
    if (sent.status === "ERROR") {
      throw new TxError(`${method} submit failed`, method, sent.errorResult);
    }
    let got = await server.getTransaction(sent.hash);
    for (let i = 0; i < 40 && got.status === "NOT_FOUND"; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      got = await server.getTransaction(sent.hash);
    }
    if (got.status !== "SUCCESS") {
      throw new TxError(`${method} did not succeed: ${got.status}`, method, got);
    }
    return {
      txHash: sent.hash,
      returnValue: got.returnValue ? scValToNative(got.returnValue) : null,
      explorerUrl: `https://stellar.expert/explorer/${this.network === "mainnet" ? "public" : "testnet"}/tx/${sent.hash}`,
    };
  }

  private async apiGet<T = any>(path: string): Promise<T> {
    const res = await fetch(`${this.apiBaseUrl}${path}`);
    if (!res.ok) {
      throw new ApiError(res.status, "GET", path, await res.text().catch(() => undefined));
    }
    return res.json() as Promise<T>;
  }
  private async apiPost<T = any>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.apiBaseUrl}${path}`, {
      method: "POST",
      ...(body !== undefined
        ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
        : {}),
    });
    if (!res.ok) {
      throw new ApiError(res.status, "POST", path, await res.text().catch(() => undefined));
    }
    return res.json() as Promise<T>;
  }

  /**
   * Ask the Fianza treasury (testnet lender-of-first-resort) to seed this
   * agent's vault with at least `usdc` of borrowable liquidity before a draw.
   * Best-effort: on mainnet, or when no treasury is configured, the backend
   * simply returns { deposited:false } and we fall through to the normal
   * on-chain borrow (which will fail with InsufficientLiquidity if a real
   * lender hasn't funded the vault — exactly the pre-treasury behavior). Never
   * throws: a treasury hiccup must not block an otherwise-fundable borrow.
   */
  private async ensureLiquidity(usdc: number): Promise<void> {
    try {
      await this.apiPost(`/agent/${this.publicKey()}/ensure-liquidity`, {
        neededUsdc: usdc,
      });
    } catch {
      // Swallow — the borrow below is the source of truth. If the vault ends up
      // short, borrow() surfaces the real InsufficientLiquidity error.
    }
  }
}
