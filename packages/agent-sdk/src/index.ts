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

const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";
const TESTNET_RPC = "https://soroban-testnet.stellar.org";

const toStroops = (usdc: number | bigint): bigint =>
  typeof usdc === "bigint" ? usdc : BigInt(Math.round(usdc * 1e7));
const fromStroops = (s: bigint | string | number): number =>
  Number(BigInt(s)) / 1e7;

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
  totalDepositedUsdc: number;
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
      totalDepositedUsdc: fromStroops(s.total_deposited as bigint),
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
    if (bal < priceUsdc) {
      const need = Math.ceil((priceUsdc - bal) * 100) / 100;
      if (opts.maxDraw != null && need > opts.maxDraw) {
        throw new Error(`x402 shortfall ${need} USDC exceeds maxDraw ${opts.maxDraw}`);
      }
      await this.borrow(need);
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
    const c = await this.ensureContracts();
    return this.invoke(c.vault, "borrow", [
      this.addr(this.publicKey()),
      this.i128(toStroops(usdc)),
    ]);
  }

  /** Repay `usdc` (interest first → lender yield, then principal). */
  async repay(usdc: number): Promise<TxResult> {
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
      throw new Error(`${method} submit failed: ${JSON.stringify(sent.errorResult)}`);
    }
    let got = await this.server.getTransaction(sent.hash);
    for (let i = 0; i < 40 && got.status === "NOT_FOUND"; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      got = await this.server.getTransaction(sent.hash);
    }
    if (got.status !== "SUCCESS") {
      throw new Error(`${method} did not succeed: ${got.status}`);
    }
    return {
      txHash: sent.hash,
      returnValue: got.returnValue ? scValToNative(got.returnValue) : null,
      explorerUrl: `https://stellar.expert/explorer/testnet/tx/${sent.hash}`,
    };
  }

  private async apiGet<T = any>(path: string): Promise<T> {
    const res = await fetch(`${this.apiBaseUrl}${path}`);
    if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
    return res.json() as Promise<T>;
  }
  private async apiPost<T = any>(path: string): Promise<T> {
    const res = await fetch(`${this.apiBaseUrl}${path}`, { method: "POST" });
    if (!res.ok) throw new Error(`POST ${path} → ${res.status}`);
    return res.json() as Promise<T>;
  }
}
