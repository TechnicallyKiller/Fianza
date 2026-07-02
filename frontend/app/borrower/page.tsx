"use client";

// Borrower (AI-agent) dashboard — wired to the live Phase-2 underwriting API and
// the connected wallet. Design: screens/dashboard.html + screens/screen_dash.png.
//
// Live now: indexed x402 revenue, the full underwrite pass (revenue → zkTLS proof
// → score → attestation), score/tier/limit/APR, and the score breakdown.
// Gated on Phase-4 deploy: the on-chain credit-line draw/repay calls (they fire
// the moment /config exposes creditLineContractId).

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Wallet,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import DashboardChrome from "@/components/DashboardChrome";
import { useWallet } from "@/components/WalletProvider";
import {
  api,
  ApiError,
  aprPct,
  usdc,
  shortAddr,
  tierLabel,
  type IndependenceResult,
  type RevenueReport,
  type UnderwritingResult,
} from "@/lib/api";
import { STELLAR_EXPERT_TX, invokeContract, readContract, sc } from "@/lib/stellar";

// Mirrors lending_vault::VaultState (contracts/lending_vault/src/lib.rs).
interface VaultState {
  liquidity: bigint;
  principal: bigint;
  amount_owed: bigint;
  reserve: bigint;
  total_shares: bigint;
  total_assets: bigint;
  yield_pool: bigint;
  realized_loss: bigint;
  limit: bigint;
  apr_bps: number;
  utilization_bps: number;
  due_date: bigint;
  defaulted: boolean;
}

// A known agent with real, retained x402 revenue (PROJECT_LOG §3) — handy for
// demoing the live pipeline without holding any private key.
const TEST_AGENT = "GCW6JEZSI64YMCARRROUPJVLIE5JFRNKRZVZYSKHQOQCVZN6RV3CYPAF";
const TEST_AGENT_FROM_LEDGER = "3326960";

export default function BorrowerDashboard() {
  const { address, config: walletConfig } = useWallet();

  // The agent being viewed. Defaults to the connected wallet, but any address
  // can be inspected read-only (revenue + underwrite are public, address-keyed).
  const [target, setTarget] = useState("");
  const [addrInput, setAddrInput] = useState("");
  const [fromLedger, setFromLedger] = useState("");

  const [revenue, setRevenue] = useState<RevenueReport | null>(null);
  const [result, setResult] = useState<UnderwritingResult | null>(null);
  const [vaultState, setVaultState] = useState<VaultState | null>(null);
  const [loadingRevenue, setLoadingRevenue] = useState(false);
  const [underwriting, setUnderwriting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fromLedgerNum = fromLedger.trim() ? Number(fromLedger.trim()) : undefined;

  // Live on-chain vault state (principal owed, accrued interest, etc.) — reads
  // the actual contract, not the score snapshot, so it reflects real borrows.
  const loadVaultState = useCallback(
    async (addr: string) => {
      const vaultId = walletConfig?.lendingVaultContractId;
      if (!vaultId || !address) {
        setVaultState(null);
        return;
      }
      try {
        const s = (await readContract({
          contractId: vaultId,
          method: "state",
          args: [sc.address(addr)],
          sourcePublicKey: address,
        })) as VaultState | null;
        setVaultState(s);
      } catch {
        setVaultState(null);
      }
    },
    [walletConfig, address],
  );

  // Pull live revenue + any prior underwriting result for an agent.
  const load = useCallback(
    async (addr: string, fl?: number) => {
      setError(null);
      setNotice(null);
      setRevenue(null);
      setResult(null);
      setLoadingRevenue(true);
      try {
        const [rev, prior] = await Promise.allSettled([
          api.revenue(addr, fl),
          api.agent(addr),
        ]);
        if (rev.status === "fulfilled") setRevenue(rev.value);
        else setError(rev.reason?.message ?? "Failed to index revenue");
        // 404 (never underwritten) is expected — leave result null.
        if (prior.status === "fulfilled") setResult(prior.value);
        else if (prior.reason instanceof ApiError && prior.reason.status !== 404) {
          setError(prior.reason.message);
        }
        await loadVaultState(addr);
      } finally {
        setLoadingRevenue(false);
      }
    },
    [loadVaultState],
  );

  // On wallet connect, default the inspect target to it and auto-load once.
  useEffect(() => {
    if (address && !target) {
      setTarget(address);
      setAddrInput(address);
      load(address);
    }
  }, [address, target, load]);

  const inspect = useCallback(
    (addr: string, fl: string) => {
      const a = addr.trim();
      if (!a) return;
      setTarget(a);
      setFromLedger(fl);
      load(a, fl.trim() ? Number(fl.trim()) : undefined);
    },
    [load],
  );

  const loadTestAgent = useCallback(() => {
    setAddrInput(TEST_AGENT);
    inspect(TEST_AGENT, TEST_AGENT_FROM_LEDGER);
  }, [inspect]);

  const runUnderwrite = useCallback(
    async (skipProof: boolean) => {
      if (!target) return;
      setUnderwriting(true);
      setError(null);
      setNotice(null);
      try {
        const r = await api.underwrite(target, { skipProof, fromLedger: fromLedgerNum });
        setResult(r);
        setRevenue(r.revenue);
        if (r.proofError) {
          setNotice(
            `Score updated. zkTLS proof step failed (${r.proofError}); score reflects on-chain revenue only.`,
          );
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setUnderwriting(false);
      }
    },
    [target, fromLedgerNum],
  );

  const score = result?.score;
  const readOnly = !!target && target !== address;

  if (!address) {
    return (
      <DashboardChrome active="Dashboard">
        <main className="mx-auto flex w-full max-w-[1440px] flex-1 items-center justify-center px-gutter py-stack-lg">
          <ConnectPrompt />
        </main>
      </DashboardChrome>
    );
  }

  return (
    <DashboardChrome active="Dashboard">
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-gutter py-stack-lg">
        {error ? <Banner kind="error" text={error} /> : null}
        {notice ? <Banner kind="warn" text={notice} /> : null}

        {/* Inspect bar — view/underwrite any agent (public, address-keyed reads) */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            inspect(addrInput, fromLedger);
          }}
          className="glass-card animate-enter mb-stack-md flex flex-col gap-3 rounded-lg p-4 lg:flex-row lg:items-end"
        >
          <label className="flex flex-1 flex-col gap-1">
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
              Agent address
            </span>
            <input
              value={addrInput}
              onChange={(e) => setAddrInput(e.target.value)}
              placeholder="G… Stellar address"
              spellCheck={false}
              className="w-full rounded-md border border-outline-variant bg-surface px-3 py-2 font-data-md text-data-md text-on-surface transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </label>
          <label className="flex w-full flex-col gap-1 lg:w-48">
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
              From ledger (optional)
            </span>
            <input
              value={fromLedger}
              onChange={(e) => setFromLedger(e.target.value)}
              inputMode="numeric"
              placeholder="latest ~1000"
              className="w-full rounded-md border border-outline-variant bg-surface px-3 py-2 font-data-md text-data-md text-on-surface transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loadingRevenue}
              className="electric-blue-glow rounded bg-primary-container px-4 py-2 font-body-sm font-medium text-on-primary-container transition-all duration-300 hover:scale-[1.02] hover:bg-primary hover:text-surface disabled:opacity-60"
            >
              {loadingRevenue ? "Loading…" : "Load"}
            </button>
            <button
              type="button"
              onClick={loadTestAgent}
              disabled={loadingRevenue}
              className="rounded border border-white/10 bg-surface-dim/20 px-4 py-2 font-body-sm text-on-surface-variant transition-colors hover:bg-surface-variant/50 hover:text-on-surface disabled:opacity-60"
              title="Load a known agent with real, retained x402 revenue"
            >
              Test agent
            </button>
          </div>
        </form>

        {readOnly ? (
          <div className="mb-stack-md flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 font-body-sm text-on-surface-variant">
            <ShieldCheck size={16} className="shrink-0 text-primary" />
            <span>
              Inspecting another agent (read-only). Revenue indexing and
              underwriting are public; on-chain draw/repay require connecting as
              this agent.
            </span>
          </div>
        ) : null}

        {/* Summary row */}
        <div className="mb-stack-lg grid grid-cols-1 gap-stack-md md:grid-cols-4">
          <div className="glass-card glass-card-hover animate-enter flex flex-col justify-between rounded-lg p-card-padding">
            <div className="mb-stack-sm flex items-start justify-between">
              <span className="text-body-sm text-on-surface-variant">
                Credit Score
              </span>
              {score ? (
                <span className="rounded border border-primary/20 bg-primary/10 px-2 py-1 font-label-caps text-label-caps text-primary">
                  {tierLabel(score.tier)}
                </span>
              ) : null}
            </div>
            <div className="text-headline-lg font-headline-lg text-on-surface">
              {score ? score.score : "—"}
            </div>
          </div>
          <Metric
            label="Available Credit"
            value={score ? usdc(score.limitUsdc) : "—"}
            unit="USDC"
            delay="delay-100"
          />
          <Metric
            label="Currently Borrowed"
            value={vaultState ? usdc(Number(vaultState.amount_owed) / 1e7) : "—"}
            unit="USDC"
            delay="delay-200"
          />
          <Metric
            label="Verified Trailing Revenue"
            value={revenue ? usdc(revenue.totalRevenueUsdc) : loadingRevenue ? "…" : "—"}
            unit="USDC"
            delay="delay-300"
          />
        </div>

        {/* Main layout */}
        <div className="grid grid-cols-1 gap-stack-lg lg:grid-cols-12">
          {/* Left column */}
          <div className="flex flex-col gap-stack-lg lg:col-span-8">
            {/* Revenue history */}
            <div className="glass-card animate-enter delay-100 flex h-[400px] flex-col rounded-lg p-card-padding">
              <div className="mb-stack-md flex items-center justify-between border-b border-white/10 pb-stack-sm">
                <h2 className="text-body-lg font-body-lg">Revenue History</h2>
                <span className="text-body-sm text-on-surface-variant">
                  on-chain x402 earnings
                  {revenue
                    ? ` · ledgers ${revenue.windowFromLedger}–${revenue.windowToLedger}`
                    : ""}
                </span>
              </div>
              <RevenueChart revenue={revenue} loading={loadingRevenue} />
            </div>

            {/* Off-chain revenue / proof */}
            <div className="glass-card animate-enter delay-200 rounded-lg p-card-padding">
              <div className="mb-stack-md border-b border-white/10 pb-stack-sm">
                <h2 className="text-body-lg font-body-lg">Off-chain Revenue</h2>
              </div>
              <div className="flex flex-col items-start justify-between gap-4 rounded border border-white/5 bg-surface-dim/30 p-4 backdrop-blur-sm md:flex-row md:items-center">
                <div className="flex items-center gap-3">
                  <div
                    className={`rounded-full border p-2 ${
                      result?.proof?.verified
                        ? "border-secondary/20 bg-secondary/10 text-secondary"
                        : "border-outline-variant bg-surface-container text-on-surface-variant"
                    }`}
                  >
                    {result?.proof?.verified ? (
                      <ShieldCheck size={20} />
                    ) : (
                      <ShieldAlert size={20} />
                    )}
                  </div>
                  <div>
                    <div className="font-body-md text-on-surface">
                      zkTLS-verified Stripe revenue
                    </div>
                    <ProofStatus result={result} />
                  </div>
                </div>
                <div className="flex flex-col items-stretch gap-2 sm:flex-row">
                  <button
                    onClick={() => runUnderwrite(false)}
                    disabled={underwriting}
                    className="electric-blue-glow inline-flex items-center justify-center gap-2 rounded bg-primary-container px-4 py-2 font-body-sm text-on-primary-container transition-all duration-300 hover:scale-105 hover:bg-primary hover:text-surface disabled:opacity-60"
                  >
                    {underwriting ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : null}
                    Submit revenue proof
                  </button>
                  <button
                    onClick={() => runUnderwrite(true)}
                    disabled={underwriting}
                    className="rounded border border-white/10 bg-surface-dim/20 px-4 py-2 font-body-sm text-on-surface-variant backdrop-blur-sm transition-colors hover:bg-surface-variant/50 hover:text-on-surface disabled:opacity-60"
                    title="Re-score using on-chain revenue only (skips the slow zkTLS proof)"
                  >
                    Score on-chain only
                  </button>
                </div>
              </div>
            </div>

            {/* Score breakdown */}
            <div className="glass-card animate-enter delay-300 rounded-lg p-card-padding">
              <div className="mb-stack-md border-b border-white/10 pb-stack-sm">
                <h2 className="text-body-lg font-body-lg">Score Breakdown</h2>
              </div>
              <ScoreBreakdown result={result} />
            </div>
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-stack-lg lg:col-span-4">
            {/* Credit line status */}
            <div className="glass-card animate-enter delay-200 rounded-lg p-card-padding">
              <div className="mb-stack-md border-b border-white/10 pb-stack-sm">
                <h2 className="text-body-lg font-body-lg">Credit Line Status</h2>
              </div>
              <div className="mb-4 flex items-baseline justify-between">
                <span className="text-body-sm text-on-surface-variant">
                  Credit Limit
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="font-data-lg text-on-surface">
                    {score ? usdc(score.limitUsdc) : "—"}
                  </span>
                  <span className="font-data-md text-body-sm text-on-surface-variant">
                    USDC
                  </span>
                </div>
              </div>
              <div className="mb-6 flex items-baseline justify-between">
                <span className="text-body-sm text-on-surface-variant">
                  APR (Fixed)
                </span>
                <span className="font-data-md text-on-surface">
                  {score ? aprPct(score.aprBps) : "—"}
                </span>
              </div>
              <div className="mb-6 rounded border border-white/5 bg-surface-dim/30 p-4 backdrop-blur-sm">
                <div className="mb-1 text-body-sm text-on-surface-variant">
                  Amount Drawn
                </div>
                <div className="flex items-baseline gap-2 text-headline-md">
                  <span className="font-data-lg">
                    {vaultState ? usdc(Number(vaultState.amount_owed) / 1e7) : "0"}
                  </span>
                  <span className="font-data-md text-body-sm text-on-surface-variant">
                    USDC
                  </span>
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full border border-white/5 bg-surface-dim/50">
                  <div
                    className="h-full bg-primary shadow-[0_0_10px_rgba(173,198,255,0.5)]"
                    style={{
                      width:
                        vaultState && score && score.limitUsdc > 0
                          ? `${Math.min(100, (Number(vaultState.amount_owed) / 1e7 / score.limitUsdc) * 100)}%`
                          : "0%",
                    }}
                  />
                </div>
                {vaultState?.defaulted ? (
                  <p className="mt-2 text-body-sm text-error">
                    ⚠ Defaulted — frozen out of further borrowing.
                  </p>
                ) : null}
              </div>
              <VaultActions
                hasLimit={!!score && score.limitUsdc > 0}
                readOnly={readOnly}
                onAction={() => target && load(target, fromLedgerNum)}
              />
            </div>

            {/* Activity feed */}
            <div className="glass-card animate-enter delay-400 flex-1 rounded-lg p-card-padding">
              <div className="mb-stack-md border-b border-white/10 pb-stack-sm">
                <h2 className="text-body-lg font-body-lg">Activity Feed</h2>
              </div>
              <ActivityFeed result={result} />
            </div>
          </div>
        </div>
      </main>
    </DashboardChrome>
  );
}

// ---- Sub-components ----

function ConnectPrompt() {
  const { connect, connecting, error } = useWallet();
  return (
    <div className="glass-card animate-enter flex max-w-md flex-col items-center gap-4 rounded-lg p-card-padding text-center">
      <div className="rounded-full border border-primary/20 bg-primary/10 p-3 text-primary">
        <Wallet size={28} />
      </div>
      <h2 className="text-headline-md font-headline-md">Connect your wallet</h2>
      <p className="text-body-md text-on-surface-variant">
        Connect a Stellar wallet to index your x402 revenue, prove off-chain
        income, and view your underwritten credit line.
      </p>
      <button
        onClick={connect}
        disabled={connecting}
        className="electric-blue-glow inline-flex items-center gap-2 rounded bg-primary-container px-5 py-2.5 font-body-sm font-medium text-on-primary-container transition-all duration-300 hover:scale-[1.02] hover:bg-primary hover:text-surface disabled:opacity-60"
      >
        <Wallet size={16} />
        {connecting ? "Connecting…" : "Connect wallet"}
      </button>
      {error ? <p className="text-body-sm text-error">{error}</p> : null}
    </div>
  );
}

function Banner({ kind, text }: { kind: "error" | "warn"; text: string }) {
  const styles =
    kind === "error"
      ? "border-error/30 bg-error/10 text-error"
      : "border-tertiary/30 bg-tertiary-container/10 text-tertiary";
  return (
    <div
      className={`mb-stack-md flex items-start gap-2 rounded-lg border p-3 font-body-sm ${styles}`}
    >
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      <span>{text}</span>
    </div>
  );
}

function ProofStatus({ result }: { result: UnderwritingResult | null }) {
  if (!result) {
    return (
      <div className="mt-1 text-body-sm text-on-surface-variant">
        Not yet proven
      </div>
    );
  }
  if (result.proof?.verified) {
    return (
      <div className="mt-1 flex items-center gap-2 text-body-sm">
        <span className="flex items-center gap-1 text-secondary">
          <CheckCircle2 size={14} />
          <span className="font-medium">Verified</span>
        </span>
        <span className="text-on-surface-variant">
          {usdc(Number(result.proof.amountStroops) / 1e7)} USDC
        </span>
        {result.proof.verifyTxHash ? (
          <TxLink hash={result.proof.verifyTxHash} />
        ) : null}
      </div>
    );
  }
  return (
    <div className="mt-1 text-body-sm text-tertiary">
      {result.proofError
        ? "Proof unavailable (attestor timeout) — using on-chain revenue only"
        : "Not proven in this pass"}
    </div>
  );
}

function ScoreBreakdown({ result }: { result: UnderwritingResult | null }) {
  if (!result) {
    return (
      <p className="text-body-sm text-on-surface-variant">
        Run an underwriting pass to see how your score is composed.
      </p>
    );
  }
  const s = result.score;
  // Revenue-coverage: how far effective revenue carries toward the top band.
  const coverage = Math.min(100, Math.round((s.revenueUsdc / 25_000) * 100));
  const counterparty = Math.min(
    100,
    Math.round((s.distinctPayers / s.minCounterparties) * 100),
  );
  const offchainWeight = s.components.offchainUsdc > 0 ? 100 : 0;
  return (
    <div className="flex flex-col gap-4">
      {result.independence ? (
        <IndependenceVerdict ind={result.independence} />
      ) : null}
      <ScoreBar
        label="Revenue Coverage"
        value={`${usdc(s.revenueUsdc)} USDC effective`}
        pct={coverage}
        opacity={1}
      />
      <ScoreBar
        label="Distinct Counterparties"
        value={`${s.distinctPayers} / ${s.minCounterparties} min ${
          s.onchainCounts ? "✓" : "✗"
        }`}
        pct={counterparty}
        opacity={s.onchainCounts ? 1 : 0.5}
      />
      <ScoreBar
        label="Off-chain Proof Weight"
        value={
          s.components.offchainUsdc > 0
            ? `${usdc(s.components.offchainUsdc)} USDC ×${s.components.offchainWeight}`
            : "none"
        }
        pct={offchainWeight}
        opacity={offchainWeight ? 1 : 0.4}
      />
      {!s.onchainCounts ? (
        <p className="rounded border border-tertiary/20 bg-tertiary-container/10 p-3 text-body-sm text-tertiary">
          On-chain revenue isn&apos;t counted yet: it needs at least{" "}
          {s.minCounterparties} distinct payers (you have {s.distinctPayers}).
          This is the anti-Sybil minimum.
        </p>
      ) : null}
    </div>
  );
}

// The moat, visible: which payers are independent vs circular (self-funded Sybil).
function IndependenceVerdict({ ind }: { ind: IndependenceResult }) {
  const indep = ind.independentPayers.length;
  const circ = ind.circularPayers.length;
  const clean = circ === 0;
  return (
    <div
      className={`rounded-lg border p-3 ${clean ? "border-secondary/25 bg-secondary/5" : "border-error/30 bg-error/10"}`}
    >
      <div className="mb-2 flex items-center gap-2">
        {clean ? (
          <ShieldCheck size={16} className="text-secondary" />
        ) : (
          <ShieldAlert size={16} className="text-error" />
        )}
        <span
          className={`font-body-sm font-medium ${clean ? "text-secondary" : "text-error"}`}
        >
          {clean
            ? "Counterparty independence verified"
            : `Sybil detected — ${circ} circular payer${circ > 1 ? "s" : ""} excluded`}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {ind.perPayer.map((p) => (
          <div
            key={p.payer}
            className="flex items-center justify-between gap-2 text-body-sm"
          >
            <span className="flex items-center gap-1.5">
              {p.independent ? (
                <CheckCircle2 size={13} className="shrink-0 text-secondary" />
              ) : (
                <span className="shrink-0 font-bold text-error">✕</span>
              )}
              <span className="font-data-md text-xs text-on-surface-variant">
                {shortAddr(p.payer)}
              </span>
            </span>
            <span
              className={`text-right text-xs ${p.independent ? "text-on-surface-variant" : "text-error"}`}
            >
              {p.reason}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 border-t border-white/5 pt-2 text-xs text-on-surface-variant">
        {indep} independent · {circ} circular ·{" "}
        {usdc(Number(ind.independentRevenueStroops) / 1e7)} USDC counted
      </div>
    </div>
  );
}

function VaultActions({
  hasLimit,
  readOnly,
  onAction,
}: {
  hasLimit: boolean;
  readOnly: boolean;
  onAction: () => void;
}) {
  const { address, config } = useWallet();
  const deployed = !!config?.lendingVaultContractId;
  const [amount, setAmount] = useState("5");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tx, setTx] = useState<string | null>(null);

  if (readOnly) {
    return (
      <p className="text-center text-body-sm text-on-surface-variant/70">
        Connect as this agent to draw or repay its credit line.
      </p>
    );
  }
  if (!deployed || !address) {
    return (
      <p className="text-center text-body-sm text-on-surface-variant/70">
        Connect your wallet to draw or repay your credit line.
      </p>
    );
  }

  const stroops = () => BigInt(Math.round(Number(amount || "0") * 1e7));

  const run = async (label: string, fn: () => Promise<{ txHash: string }>) => {
    setBusy(label);
    setErr(null);
    setTx(null);
    try {
      const r = await fn();
      setTx(r.txHash);
      onAction();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const register = () =>
    run("register", () =>
      invokeContract({
        contractId: config!.scoreRegistryContractId!,
        method: "register",
        args: [sc.address(address)],
        publicKey: address,
      }),
    );
  const borrow = () =>
    run("borrow", () =>
      invokeContract({
        contractId: config!.lendingVaultContractId!,
        method: "borrow",
        args: [sc.address(address), sc.i128(stroops())],
        publicKey: address,
      }),
    );
  const repay = () =>
    run("repay", () =>
      invokeContract({
        contractId: config!.lendingVaultContractId!,
        method: "repay",
        args: [sc.address(address), sc.i128(stroops())],
        publicKey: address,
      }),
    );

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          className="w-full rounded-md border border-outline-variant bg-surface px-4 py-2.5 pr-16 text-right font-data-md text-data-md text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <span className="absolute right-4 top-2.5 font-body-sm text-on-surface-variant">
          USDC
        </span>
      </div>
      <button
        onClick={borrow}
        disabled={!hasLimit || !!busy}
        className="electric-blue-glow w-full rounded bg-primary-container py-3 font-body-sm font-medium text-on-primary-container transition-all duration-300 hover:scale-[1.02] hover:bg-primary hover:text-surface disabled:opacity-60"
      >
        {busy === "borrow" ? "Drawing…" : "Request credit"}
      </button>
      <button
        onClick={repay}
        disabled={!!busy}
        className="w-full rounded border border-white/10 bg-surface-dim/20 py-3 font-body-sm text-on-surface-variant backdrop-blur-sm transition-colors hover:bg-surface-variant/50 hover:text-on-surface disabled:opacity-60"
      >
        {busy === "repay" ? "Repaying…" : "Repay"}
      </button>
      <button
        onClick={register}
        disabled={!!busy}
        className="text-center text-body-sm text-on-surface-variant/70 transition-colors hover:text-on-surface"
      >
        {busy === "register" ? "Registering…" : "Register on-chain (first time)"}
      </button>
      {tx ? (
        <div className="text-center text-body-sm">
          <TxLink hash={tx} />
        </div>
      ) : null}
      {err ? (
        <p className="break-words text-center text-body-sm text-error">{err}</p>
      ) : null}
    </div>
  );
}

function ActivityFeed({ result }: { result: UnderwritingResult | null }) {
  if (!result) {
    return (
      <p className="text-body-sm text-on-surface-variant">
        No activity yet. Submit a revenue proof to get underwritten.
      </p>
    );
  }
  const when = new Date(result.underwroteAt * 1000).toLocaleString();
  const items: { title: string; meta: string; hash?: string; active?: boolean }[] =
    [];
  if (result.submission.submitted && result.submission.txHash) {
    items.push({
      title: "Score published on-chain",
      meta: when,
      hash: result.submission.txHash,
      active: true,
    });
  }
  items.push({
    title: `Underwritten · score ${result.score.score} (${tierLabel(
      result.score.tier,
    )})`,
    meta: when,
    active: !result.submission.submitted,
  });
  if (result.proof?.verified && result.proof.verifyTxHash) {
    items.push({
      title: "zkTLS revenue proof verified",
      meta: when,
      hash: result.proof.verifyTxHash,
    });
  }
  items.push({
    title: `Revenue indexed · ${usdc(result.revenue.totalRevenueUsdc)} USDC, ${
      result.revenue.distinctPayers
    } payer(s)`,
    meta: when,
  });

  return (
    <div className="relative flex flex-col gap-4">
      <div className="absolute bottom-2 left-2.5 top-2 w-px bg-white/10" />
      {items.map((it, i) => (
        <FeedItem key={i} {...it} />
      ))}
    </div>
  );
}

function TxLink({ hash }: { hash: string }) {
  return (
    <a
      href={STELLAR_EXPERT_TX(hash)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 font-data-md text-xs text-primary/80 transition-colors hover:text-primary"
    >
      {hash.slice(0, 6)}…{hash.slice(-4)}
      <ExternalLink size={11} />
    </a>
  );
}

function Metric({
  label,
  value,
  unit,
  delay,
}: {
  label: string;
  value: string;
  unit: string;
  delay: string;
}) {
  return (
    <div
      className={`glass-card glass-card-hover animate-enter ${delay} flex flex-col justify-between rounded-lg p-card-padding`}
    >
      <div className="mb-stack-sm">
        <span className="text-body-sm text-on-surface-variant">{label}</span>
      </div>
      <div className="flex items-baseline gap-2 text-headline-lg font-headline-lg text-on-surface">
        <span className="font-data-lg text-data-lg">{value}</span>
        <span className="font-data-md text-body-sm text-on-surface-variant">
          {unit}
        </span>
      </div>
    </div>
  );
}

function ScoreBar({
  label,
  value,
  pct,
  opacity,
}: {
  label: string;
  value: string;
  pct: number;
  opacity: number;
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-body-sm">
        <span className="text-on-surface-variant">{label}</span>
        <span className="font-data-md">{value}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full border border-white/5 bg-surface-dim/50 backdrop-blur-sm">
        <div
          className="h-full bg-primary shadow-[0_0_10px_rgba(173,198,255,0.5)]"
          style={{ width: `${pct}%`, opacity }}
        />
      </div>
    </div>
  );
}

function FeedItem({
  title,
  meta,
  hash,
  active,
}: {
  title: string;
  meta: string;
  hash?: string;
  active?: boolean;
}) {
  return (
    <div className="relative z-10 flex gap-4">
      <div
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-container-low ${
          active
            ? "border border-primary shadow-[0_0_8px_rgba(173,198,255,0.3)]"
            : "border border-white/20"
        }`}
      >
        <div
          className={`rounded-full ${active ? "h-2 w-2 bg-primary" : "h-1.5 w-1.5 bg-white/20"}`}
        />
      </div>
      <div>
        <div className="font-body-sm text-on-surface">{title}</div>
        <div className="mt-0.5 flex items-center gap-2 text-body-sm text-on-surface-variant">
          <span>{meta}</span>
          {hash ? (
            <>
              <span>•</span>
              <TxLink hash={hash} />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// Inline area chart driven by real payments (cumulative USDC over the window).
function RevenueChart({
  revenue,
  loading,
}: {
  revenue: RevenueReport | null;
  loading: boolean;
}) {
  const wrap =
    "relative flex-1 overflow-hidden rounded border border-white/5 bg-surface-dim/20 backdrop-blur-sm";

  if (loading) {
    return (
      <div className={`${wrap} flex items-center justify-center`}>
        <Loader2 size={20} className="animate-spin text-on-surface-variant" />
      </div>
    );
  }
  const payments = revenue?.payments ?? [];
  if (payments.length === 0) {
    return (
      <div className={`${wrap} flex items-center justify-center`}>
        <p className="max-w-sm px-4 text-center text-body-sm text-on-surface-variant">
          No x402 revenue indexed in this window. The shared USDC SAC is
          high-traffic — narrow the window near a known payment, or earn fresh
          x402 revenue.
        </p>
      </div>
    );
  }

  // Cumulative revenue, ordered by ledger.
  const sorted = [...payments].sort((a, b) => a.ledger - b.ledger);
  let cum = 0;
  const pts = sorted.map((p) => {
    cum += Number(p.amount) / 1e7;
    return { ledger: p.ledger, cum };
  });
  const maxCum = pts[pts.length - 1].cum || 1;
  const W = 600;
  const H = 240;
  const x = (i: number) =>
    pts.length === 1 ? W : (i / (pts.length - 1)) * W;
  const y = (v: number) => H - (v / maxCum) * (H - 20) - 10;
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.cum)}`).join(" ");
  const area = `${line} L${x(pts.length - 1)},${H} L${x(0)},${H} Z`;

  return (
    <div className={wrap}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-full w-full"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="rev-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#adc6ff" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#adc6ff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#rev-fill)" />
        <path
          d={line}
          fill="none"
          stroke="#adc6ff"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
        {pts.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.cum)} r="3" fill="#adc6ff" />
        ))}
      </svg>
      <span className="pointer-events-none absolute bottom-3 right-3 font-data-md text-data-md text-on-surface-variant">
        {usdc(maxCum)} USDC · {payments.length} payment(s)
      </span>
    </div>
  );
}
