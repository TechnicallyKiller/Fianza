// @trustline-agents/agent-sdk — the interface an AI agent uses to take and repay
// revenue-underwritten credit on TrustLine (Stellar), settled in USDC.
//
// An agent holds its own Stellar key, so the whole lifecycle is agent-driven:
//   const tl = new TrustLineAgent(secret, { apiBaseUrl, contracts });
//   await tl.register();
//   await tl.underwrite();                 // backend scores + publishes on-chain
//   const { limitUsdc } = await tl.creditLine();
//   await tl.borrow(5);  /* ...work... */  await tl.repay(5);
//
// On-chain writes (register/borrow/repay) are signed by the agent's own key.
// Reads (creditLine/vaultState) are simulate-only. Scoring/underwriting is
// delegated to the TrustLine backend (the trusted underwriter, v1).

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

export interface TrustLineContracts {
  registry: string;
  creditLine: string;
  vault: string;
}

export interface TrustLineOptions {
  /** Soroban RPC url (default: testnet). */
  rpcUrl?: string;
  /** Network passphrase (default: testnet). */
  networkPassphrase?: string;
  /** TrustLine underwriting API base url (default: http://localhost:8787). */
  apiBaseUrl?: string;
  /** Contract ids. If omitted, resolved from the backend `/config`. */
  contracts?: Partial<TrustLineContracts>;
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

export interface TxResult {
  txHash: string;
  returnValue: unknown;
  explorerUrl: string;
}

export class TrustLineAgent {
  readonly keypair: Keypair;
  private server: rpc.Server;
  private passphrase: string;
  private apiBaseUrl: string;
  private contracts: TrustLineContracts | null = null;
  private optContracts: Partial<TrustLineContracts>;
  private usdcSacId: string | null = null;

  constructor(secret: string, opts: TrustLineOptions = {}) {
    this.keypair = Keypair.fromSecret(secret);
    this.passphrase = opts.networkPassphrase ?? TESTNET_PASSPHRASE;
    this.server = new rpc.Server(opts.rpcUrl ?? TESTNET_RPC);
    this.apiBaseUrl = opts.apiBaseUrl ?? "http://localhost:8787";
    this.optContracts = opts.contracts ?? {};
    const c = this.optContracts;
    if (c.registry && c.creditLine && c.vault) {
      this.contracts = c as TrustLineContracts;
    }
  }

  /** This agent's Stellar public key. */
  publicKey(): string {
    return this.keypair.publicKey();
  }

  /** Resolve contract ids (from opts or the backend `/config`), cached. */
  async ensureContracts(): Promise<TrustLineContracts> {
    if (this.contracts) return this.contracts;
    const cfg = await this.apiGet<{
      scoreRegistryContractId?: string;
      creditLineContractId?: string;
      lendingVaultContractId?: string;
    }>("/config");
    const c: Partial<TrustLineContracts> = {
      registry: this.optContracts.registry ?? cfg.scoreRegistryContractId,
      creditLine: this.optContracts.creditLine ?? cfg.creditLineContractId,
      vault: this.optContracts.vault ?? cfg.lendingVaultContractId,
    };
    if (!c.registry || !c.creditLine || !c.vault) {
      throw new Error(
        "TrustLine contract ids unavailable from /config — pass them via opts.contracts.",
      );
    }
    this.contracts = c as TrustLineContracts;
    return this.contracts;
  }

  /** USDC Stellar Asset Contract id (from the backend `/config`), cached. */
  private async usdcSac(): Promise<string> {
    if (this.usdcSacId) return this.usdcSacId;
    const cfg = await this.apiGet<{ usdcSac: string }>("/config");
    if (!cfg.usdcSac) throw new Error("usdcSac unavailable from /config");
    this.usdcSacId = cfg.usdcSac;
    return this.usdcSacId;
  }

  // ---- Underwriting (delegated to the backend) ----

  /** Live x402 revenue index for this agent. */
  async revenue(fromLedger?: number): Promise<unknown> {
    const q = fromLedger ? `?fromLedger=${fromLedger}` : "";
    return this.apiGet(`/agent/${this.publicKey()}/revenue${q}`);
  }

  /** Run the full underwriting pass (revenue → proof → score → publish). */
  async underwrite(
    opts: { skipProof?: boolean; fromLedger?: number } = {},
  ): Promise<any> {
    const q = new URLSearchParams();
    if (opts.skipProof) q.set("skipProof", "true");
    if (opts.fromLedger) q.set("fromLedger", String(opts.fromLedger));
    const qs = q.toString();
    return this.apiPost(
      `/agent/${this.publicKey()}/underwrite${qs ? `?${qs}` : ""}`,
    );
  }

  /** Convenience: register on-chain, then run an underwriting pass. */
  async onboard(opts: { skipProof?: boolean; fromLedger?: number } = {}): Promise<{
    register: TxResult;
    underwrite: any;
  }> {
    const register = await this.register();
    const underwrite = await this.underwrite(opts);
    return { register, underwrite };
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
    // to have been deposited by a lender. On testnet the TrustLine treasury is
    // the lender-of-first-resort and seeds the exact shortfall on demand; on
    // mainnet (no treasury) this is a no-op and a real lender must have funded
    // the vault. Best-effort and non-throwing — see ensureLiquidity.
    await this.ensureLiquidity(usdc);
    return this.invoke(c.vault, "borrow", [
      this.addr(this.publicKey()),
      this.i128(toStroops(usdc)),
    ]);
  }

  /** Repay `usdc` (interest first → lender yield, then principal). */
  async repay(usdc: number): Promise<TxResult> {
    assertPositiveAmount(usdc, "repay amount");
    const c = await this.ensureContracts();
    return this.invoke(c.vault, "repay", [
      this.addr(this.publicKey()),
      this.i128(toStroops(usdc)),
    ]);
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

  private async read(
    contractId: string,
    method: string,
    args: xdr.ScVal[],
  ): Promise<unknown> {
    const acct = await this.server.getAccount(this.publicKey());
    const tx = new TransactionBuilder(acct, {
      fee: BASE_FEE,
      networkPassphrase: this.passphrase,
    })
      .addOperation(new Contract(contractId).call(method, ...args))
      .setTimeout(30)
      .build();
    const sim = await this.server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) {
      throw new Error(`${method} simulation failed: ${sim.error}`);
    }
    const retval = sim.result?.retval;
    return retval ? scValToNative(retval) : null;
  }

  private async invoke(
    contractId: string,
    method: string,
    args: xdr.ScVal[],
  ): Promise<TxResult> {
    const acct = await this.server.getAccount(this.publicKey());
    const tx = new TransactionBuilder(acct, {
      fee: BASE_FEE,
      networkPassphrase: this.passphrase,
    })
      .addOperation(new Contract(contractId).call(method, ...args))
      .setTimeout(TimeoutInfinite)
      .build();
    const prepared = await this.server.prepareTransaction(tx);
    prepared.sign(this.keypair);
    const sent = await this.server.sendTransaction(prepared);
    if (sent.status === "ERROR") {
      throw new TxError(`${method} submit failed`, method, sent.errorResult);
    }
    let got = await this.server.getTransaction(sent.hash);
    for (let i = 0; i < 40 && got.status === "NOT_FOUND"; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      got = await this.server.getTransaction(sent.hash);
    }
    if (got.status !== "SUCCESS") {
      throw new TxError(`${method} did not succeed: ${got.status}`, method, got);
    }
    return {
      txHash: sent.hash,
      returnValue: got.returnValue ? scValToNative(got.returnValue) : null,
      explorerUrl: `https://stellar.expert/explorer/testnet/tx/${sent.hash}`,
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
   * Ask the TrustLine treasury (testnet lender-of-first-resort) to seed this
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
