// Typed client for the TrustLine backend (Phase 2 REST API).
//
// Types mirror the backend's response shapes exactly (backend/src/*): change one,
// change the other. All calls go to API_BASE_URL (the running Fastify server).

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8787";

export const STROOPS = 10_000_000; // 1 USDC, 7 decimals

export type Tier = "A" | "B" | "C" | "Unrated";

// ---- Response shapes (mirror backend/src) ----

export interface PublicConfig {
  network: string;
  sorobanRpcUrl: string;
  networkPassphrase: string;
  usdcSac: string;
  reclaimVerifierContractId: string;
  scoreRegistryContractId: string | null;
  // Vault / credit-line ids are wired in Phase 4; tolerated as optional here so
  // the transaction flows light up automatically once the backend exposes them.
  creditLineContractId?: string | null;
  lendingVaultContractId?: string | null;
  signer: string;
  excludeAddresses: string[];
}

export interface Payment {
  from: string;
  amount: string; // USDC stroops
  ledger: number;
  txHash: string;
}

export interface RevenueReport {
  agent: string;
  totalRevenueStroops: string;
  totalRevenueUsdc: number;
  distinctPayers: number;
  payers: string[];
  payments: Payment[];
  windowFromLedger: number;
  windowToLedger: number;
}

export interface ScoreResult {
  agent: string;
  score: number;
  tier: Tier;
  revenueStroops: string;
  revenueUsdc: number;
  limitStroops: string;
  limitUsdc: number;
  aprBps: number;
  distinctPayers: number;
  minCounterparties: number;
  onchainCounts: boolean;
  components: {
    onchainUsdc: number;
    offchainUsdc: number;
    offchainWeight: number;
  };
  issuedAt: number;
}

export interface ProofResult {
  amountMinorUnits: string;
  amountStroops: string;
  proofIdentifier: string;
  secretSafe: boolean;
  verifyTxHash: string;
  onchainStatus: string;
  verified: boolean;
}

export interface Attestation {
  signer: string;
  ephemeralSigner: boolean;
  message: string;
  signatureHex: string;
  verified: boolean;
}

export interface SubmitResult {
  submitted: boolean;
  txHash?: string;
  reason?: string;
}

export interface PayerVerdict {
  payer: string;
  revenueStroops: string;
  independent: boolean;
  reason: string;
}

export interface IndependenceResult {
  independentPayers: string[];
  circularPayers: string[];
  independentRevenueStroops: string;
  perPayer: PayerVerdict[];
  maxHops: number;
}

export interface UnderwritingResult {
  agent: string;
  revenue: RevenueReport;
  independence: IndependenceResult | null;
  proof: ProofResult | null;
  proofError: string | null;
  score: ScoreResult;
  attestation: Attestation;
  submission: SubmitResult;
  underwroteAt: number;
}

// /agents list rows (lender dashboard).
export interface AgentSummary {
  agent: string;
  score: number;
  tier: Tier;
  limitUsdc: number;
  aprBps: number;
  revenueUsdc: number;
  distinctPayers: number;
  underwroteAt: number;
}

// ---- HTTP helper ----

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch (e) {
    // Network-level failure (backend not running / CORS / offline).
    throw new ApiError(
      `Can't reach the underwriting API at ${API_BASE_URL}. Is the backend running?`,
      0,
    );
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { error?: string; message?: string };
      detail = body.error ?? body.message ?? detail;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(detail, res.status);
  }
  return (await res.json()) as T;
}

// ---- Endpoints ----

export const api = {
  health: () => request<{ ok: boolean; ts: number }>("/health"),

  config: () => request<PublicConfig>("/config"),

  signer: () => request<{ signer: string }>("/signer"),

  /** Live x402 revenue index for an agent (cheap read). */
  revenue: (address: string, fromLedger?: number) =>
    request<RevenueReport>(
      `/agent/${address}/revenue${fromLedger ? `?fromLedger=${fromLedger}` : ""}`,
    ),

  /** Full underwriting pass: index + Reclaim proof + score + attest (+ submit). */
  underwrite: (
    address: string,
    opts: { skipProof?: boolean; fromLedger?: number } = {},
  ) => {
    const q = new URLSearchParams();
    if (opts.skipProof) q.set("skipProof", "true");
    if (opts.fromLedger) q.set("fromLedger", String(opts.fromLedger));
    const qs = q.toString();
    return request<UnderwritingResult>(
      `/agent/${address}/underwrite${qs ? `?${qs}` : ""}`,
      { method: "POST" },
    );
  },

  /** Last stored underwriting result for an agent (404 if never underwritten). */
  agent: (address: string) =>
    request<UnderwritingResult>(`/agent/${address}`),

  /** All underwritten agents (lender dashboard). */
  agents: () => request<AgentSummary[]>("/agents"),
};

// ---- Formatting helpers (shared by both dashboards) ----

export function usdc(n: number, opts: { decimals?: number } = {}): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: opts.decimals ?? (Number.isInteger(n) ? 0 : 2),
    maximumFractionDigits: opts.decimals ?? 2,
  });
}

export function aprPct(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

export function shortAddr(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export function tierLabel(tier: Tier): string {
  return tier === "Unrated" ? "Unrated" : `Tier ${tier}`;
}
