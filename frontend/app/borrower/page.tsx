"use client";

// Borrower — TrustLine.dc.html "LIVING LEDGER" cockpit. Wired to the live
// underwriting API, connected wallet, and the real lending_vault contract —
// same data/actions as before this redesign, restyled.

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
import TLShell from "@/components/tl/TLShell";
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
  // Registration is the required FIRST step (score_registry.register) — a new
  // agent that skips it and clicks Draw hits a bare contract error with no
  // explanation. Read on-chain and surface it as an explicit stepper instead.
  const [isRegistered, setIsRegistered] = useState<boolean | null>(null);

  const fromLedgerNum = fromLedger.trim() ? Number(fromLedger.trim()) : undefined;

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

  const loadRegistration = useCallback(
    async (addr: string) => {
      const registryId = walletConfig?.scoreRegistryContractId;
      if (!registryId || !address) {
        setIsRegistered(null);
        return;
      }
      try {
        const registered = (await readContract({
          contractId: registryId,
          method: "is_registered",
          args: [sc.address(addr)],
          sourcePublicKey: address,
        })) as boolean;
        setIsRegistered(registered);
      } catch {
        setIsRegistered(null); // unknown — don't block on a read failure
      }
    },
    [walletConfig, address],
  );

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
        if (prior.status === "fulfilled") setResult(prior.value);
        else if (prior.reason instanceof ApiError && prior.reason.status !== 404) {
          setError(prior.reason.message);
        }
        await Promise.all([loadVaultState(addr), loadRegistration(addr)]);
      } finally {
        setLoadingRevenue(false);
      }
    },
    [loadVaultState, loadRegistration],
  );

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
  const limit = score?.limitUsdc ?? 0;
  const owed = vaultState ? Number(vaultState.amount_owed) / 1e7 : 0;
  const utilPct = limit > 0 ? Math.min(100, Math.round((owed / limit) * 100)) : 0;

  if (!address) {
    return (
      <TLShell>
        <main className="mx-auto flex w-full max-w-[1160px] flex-1 items-center justify-center px-[30px] py-[14vh]">
          <ConnectPrompt />
        </main>
      </TLShell>
    );
  }

  return (
    <TLShell>
      <main className="mx-auto w-full max-w-[1160px] px-[30px] pb-20 pt-11">
        {error ? <Banner kind="error" text={error} /> : null}
        {notice ? <Banner kind="warn" text={notice} /> : null}

        {/* inspect bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            inspect(addrInput, fromLedger);
          }}
          className="mb-8 flex flex-col gap-3 rounded-xl border border-white/[0.08] bg-obsidian/60 p-4 lg:flex-row lg:items-end"
        >
          <label className="flex flex-1 flex-col gap-1">
            <span className="font-tl-mono text-[10px] uppercase tracking-[0.12em] text-ash">
              Agent address
            </span>
            <input
              value={addrInput}
              onChange={(e) => setAddrInput(e.target.value)}
              placeholder="G… Stellar address"
              spellCheck={false}
              className="w-full rounded-md border border-white/10 bg-void px-3 py-2 font-tl-mono text-sm text-bone outline-none transition-colors focus:border-ion"
            />
          </label>
          <label className="flex w-full flex-col gap-1 lg:w-48">
            <span className="font-tl-mono text-[10px] uppercase tracking-[0.12em] text-ash">
              From ledger (optional)
            </span>
            <input
              value={fromLedger}
              onChange={(e) => setFromLedger(e.target.value)}
              inputMode="numeric"
              placeholder="latest ~1000"
              className="w-full rounded-md border border-white/10 bg-void px-3 py-2 font-tl-mono text-sm text-bone outline-none transition-colors focus:border-ion"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loadingRevenue}
              className="rounded-md bg-nectar px-4 py-2 font-tl-sans text-sm font-semibold text-obsidian transition-colors hover:bg-ion disabled:opacity-60"
            >
              {loadingRevenue ? "Loading…" : "Load"}
            </button>
            <button
              type="button"
              onClick={loadTestAgent}
              disabled={loadingRevenue}
              className="rounded-md border border-white/10 px-4 py-2 font-tl-mono text-xs text-ash transition-colors hover:text-bone disabled:opacity-60"
              title="Load a known agent with real, retained x402 revenue"
            >
              Test agent
            </button>
          </div>
        </form>

        {readOnly ? (
          <div className="mb-8 flex items-center gap-2 rounded-lg border border-ion/20 bg-ion/5 p-3 font-tl-mono text-xs text-ash">
            <ShieldCheck size={16} className="shrink-0 text-ion" />
            <span>
              Inspecting another agent (read-only). Revenue indexing and
              underwriting are public; draw/repay require connecting as this
              agent.
            </span>
          </div>
        ) : null}

        {/* header */}
        <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <div className="mb-2 font-tl-mono text-[11px] tracking-[0.2em] text-nectar">
              / BORROWER COCKPIT
            </div>
            <h1 className="break-all font-tl-serif text-2xl tracking-[-0.01em] text-bone sm:text-[34px]">
              {shortAddr(target || address)}
            </h1>
          </div>
          <div className="text-right">
            <div className="font-tl-mono text-[10px] tracking-[0.1em] text-ash">
              SCORE / TIER
            </div>
            <div className="font-tl-sans text-xl font-bold text-bone sm:text-2xl">
              {score ? score.score : "—"} ·{" "}
              <span className="text-ion">{score ? tierLabel(score.tier).replace("Tier ", "") : "—"}</span>
            </div>
          </div>
        </div>

        {/* cell + controls */}
        <div className="mt-8 grid grid-cols-1 items-center gap-8 md:grid-cols-[280px_1fr] md:gap-11">
          <UtilizationCell pct={utilPct} defaulted={!!vaultState?.defaulted} />

          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap gap-8">
              <Figure label="CREDIT LINE" value={score ? usdc(limit) : "—"} color="#FFB020" />
              <Figure label="DRAWN" value={vaultState ? usdc(owed) : "—"} color="#F4F1E9" />
              <Figure
                label="HEADROOM"
                value={score ? usdc(Math.max(0, limit - owed)) : "—"}
                color="#58F0C8"
              />
            </div>

            <VaultActions
              hasLimit={!!score && limit > 0}
              limit={limit}
              readOnly={readOnly}
              defaulted={!!vaultState?.defaulted}
              aprBps={score?.aprBps}
              isRegistered={isRegistered}
              hasRevenueSignal={!!score && score.revenueUsdc > 0}
              onAction={() => target && load(target, fromLedgerNum)}
            />
          </div>
        </div>

        {/* revenue proofs */}
        <div className="mt-14">
          <div className="mb-4 font-tl-mono text-[10px] tracking-[0.16em] text-ash">
            REVENUE PROOFS · funding the line
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <ProofCard
              id="on-chain"
              amt={revenue ? usdc(revenue.totalRevenueUsdc) : loadingRevenue ? "…" : "—"}
              note={revenue ? `${revenue.distinctPayers} payer(s) · x402` : "not indexed"}
              color="#58F0C8"
            />
            <OffchainProofCard
              result={result}
              underwriting={underwriting}
              onSubmitProof={() => runUnderwrite(false)}
              onOnchainOnly={() => runUnderwrite(true)}
            />
            <ProofCard
              id="repayment history"
              amt={score ? `${score.repayments.onTime}/${score.repayments.total}` : "—"}
              note={
                score?.defaulted
                  ? "defaulted · score collapsed"
                  : score && score.components.historyDelta
                    ? `${score.components.historyDelta > 0 ? "+" : ""}${score.components.historyDelta} to score`
                    : "on-time repayments"
              }
              color={score?.defaulted ? "#FF5C4D" : "#FFB020"}
            />
          </div>
        </div>

        {/* score breakdown */}
        <div className="mt-14">
          <div className="mb-4 font-tl-mono text-[10px] tracking-[0.16em] text-ash">
            SCORE BREAKDOWN
          </div>
          <ScoreBreakdown result={result} />
        </div>

        {/* activity */}
        <div className="mt-14">
          <div className="mb-4 font-tl-mono text-[10px] tracking-[0.16em] text-ash">
            ACTIVITY
          </div>
          <ActivityFeed result={result} />
        </div>
      </main>
    </TLShell>
  );
}

// ---- sub-components ----

function ConnectPrompt() {
  const { connect, connecting, error } = useWallet();
  return (
    <div className="flex max-w-md flex-col items-center gap-4 rounded-xl border border-white/[0.08] bg-obsidian/60 p-10 text-center">
      <div className="rounded-full border border-ion/20 bg-ion/10 p-3 text-ion">
        <Wallet size={26} />
      </div>
      <h2 className="font-tl-serif text-2xl text-bone">Connect your wallet</h2>
      <p className="font-tl-sans text-sm leading-relaxed text-ash">
        Connect a Stellar wallet to index your x402 revenue, prove off-chain
        income, and view your underwritten credit line.
      </p>
      <button
        onClick={connect}
        disabled={connecting}
        className="inline-flex items-center gap-2 rounded-md bg-nectar px-5 py-2.5 font-tl-sans text-sm font-semibold text-obsidian transition-colors hover:bg-ion disabled:opacity-60"
      >
        <Wallet size={15} />
        {connecting ? "Connecting…" : "Connect wallet"}
      </button>
      {error ? <p className="font-tl-mono text-xs text-flare">{error}</p> : null}
    </div>
  );
}

function Banner({ kind, text }: { kind: "error" | "warn"; text: string }) {
  const styles =
    kind === "error" ? "border-flare/30 bg-flare/10 text-flare" : "border-nectar/30 bg-nectar/10 text-nectar";
  return (
    <div className={`mb-6 flex items-start gap-2 rounded-lg border p-3 font-tl-mono text-xs ${styles}`}>
      <AlertTriangle size={15} className="mt-0.5 shrink-0" />
      <span>{text}</span>
    </div>
  );
}

// The "living ledger" — a breathing organic cell filling with drawn credit.
function UtilizationCell({ pct, defaulted }: { pct: number; defaulted: boolean }) {
  const color = defaulted ? "#FF5C4D" : "#FFB020";
  return (
    <div className="relative mx-auto flex h-[260px] w-[260px] items-center justify-center sm:h-[300px] sm:w-[300px]">
      <div
        className="tl-anim-breathe absolute h-[240px] w-[240px] rounded-[47%_53%_55%_45%/52%_47%_53%_48%] border-2 sm:h-[280px] sm:w-[280px]"
        style={{
          borderColor: "rgba(88,240,200,.5)",
          boxShadow: "0 0 46px rgba(88,240,200,.22), inset 0 0 40px rgba(88,240,200,.07)",
        }}
      />
      <div
        className="tl-anim-breathe absolute h-[240px] w-[240px] overflow-hidden rounded-[47%_53%_55%_45%/52%_47%_53%_48%] sm:h-[280px] sm:w-[280px]"
      >
        <div
          className="absolute bottom-0 left-0 right-0 transition-[height] duration-500"
          style={{
            height: `${pct}%`,
            background: `linear-gradient(${color},${color}cc)`,
            boxShadow: `0 0 60px ${color}66`,
          }}
        />
      </div>
      <div className="relative z-[2] text-center mix-blend-difference">
        <div className="font-tl-sans text-4xl font-bold leading-[0.9] tracking-[-0.03em] text-white sm:text-5xl">
          {pct}%
        </div>
        <div className="mt-0.5 font-tl-mono text-[9px] tracking-[0.14em] text-white">
          UTILIZATION
        </div>
      </div>
      <div className="tl-anim-drift absolute right-11 top-5 h-[9px] w-[9px] rounded-full bg-ion shadow-[0_0_12px_#58F0C8]" />
      <div className="tl-anim-drift-slow absolute bottom-10 left-8 h-1.5 w-1.5 rounded-full bg-ion shadow-[0_0_10px_#58F0C8]" />
    </div>
  );
}

function Figure({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div className="font-tl-mono text-[9px] tracking-[0.1em] text-ash">{label}</div>
      <div className="font-tl-sans text-[28px] font-bold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function VaultActions({
  hasLimit,
  limit,
  readOnly,
  defaulted,
  aprBps,
  isRegistered,
  hasRevenueSignal,
  onAction,
}: {
  hasLimit: boolean;
  limit: number;
  readOnly: boolean;
  defaulted: boolean;
  aprBps?: number;
  /** null = unknown (read failed/not yet loaded) — don't block on it. */
  isRegistered: boolean | null;
  /** Has the underwriter found ANY effective revenue for this agent yet. */
  hasRevenueSignal: boolean;
  onAction: () => void;
}) {
  const { address, config } = useWallet();
  const deployed = !!config?.lendingVaultContractId;
  const [amount, setAmount] = useState("5");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tx, setTx] = useState<string | null>(null);

  const box = "rounded-xl border border-white/[0.09] bg-obsidian/60 p-[22px]";

  if (readOnly) {
    return (
      <div className={box}>
        <p className="text-center font-tl-mono text-xs text-ash">
          Connect as this agent to draw or repay its credit line.
        </p>
      </div>
    );
  }
  if (!deployed || !address) {
    return (
      <div className={box}>
        <p className="text-center font-tl-mono text-xs text-ash">
          Connect your wallet to draw or repay your credit line.
        </p>
      </div>
    );
  }

  const num = Math.max(0, Number(amount || "0"));
  const stroops = () => BigInt(Math.round(num * 1e7));
  const apr = aprBps ? aprPct(aprBps) : "—";

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

  // Onboarding sequence: register → get underwritten (a real revenue signal
  // + a credit line) → draw. Show it explicitly instead of burying "register"
  // as a footnote and letting a new agent hit a bare contract error on Draw.
  const registeredKnown = isRegistered !== null;
  const steps: { label: string; done: boolean }[] = [
    { label: "Register on-chain", done: isRegistered === true },
    { label: "Get underwritten (earn a revenue signal)", done: hasRevenueSignal },
    { label: "Draw against your credit line", done: hasLimit },
  ];
  const onboardingIncomplete = registeredKnown && !isRegistered;

  return (
    <div className={box}>
      {registeredKnown ? (
        <div className="mb-4 flex flex-col gap-2 rounded-lg border border-white/[0.07] bg-obsidian/40 p-3">
          {steps.map((s, i) => (
            <div key={s.label} className="flex items-center gap-2.5 font-tl-mono text-xs">
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border font-tl-mono text-[10px]"
                style={{
                  borderColor: s.done ? "#58F0C8" : "#3a3f3c",
                  color: s.done ? "#58F0C8" : "#5a635e",
                  background: s.done ? "rgba(88,240,200,.08)" : "transparent",
                }}
              >
                {s.done ? "✓" : i + 1}
              </span>
              <span style={{ color: s.done ? "#bcbeb8" : "#8a8f89" }}>{s.label}</span>
            </div>
          ))}
        </div>
      ) : null}
      {onboardingIncomplete ? (
        <div className="mb-4 rounded-lg border border-nectar/25 bg-nectar/[0.06] p-3.5">
          <p className="mb-2.5 font-tl-mono text-xs leading-[1.6] text-ash">
            This wallet isn&apos;t registered yet — that&apos;s step 1, required
            before anything else works.
          </p>
          <button
            onClick={register}
            disabled={!!busy}
            className="w-full rounded-lg bg-nectar py-2.5 font-tl-sans text-sm font-semibold text-obsidian transition-colors hover:bg-[#ffbf40] disabled:opacity-50"
          >
            {busy === "register" ? "Registering…" : "Register on-chain →"}
          </button>
        </div>
      ) : null}
      <div className="mb-3.5 flex items-baseline justify-between">
        <span className="font-tl-mono text-[11px] tracking-[0.08em] text-ash">
          DRAW AGAINST HEADROOM
        </span>
        <span className="font-tl-sans text-[15px] font-bold text-nectar">
          {usdc(num)} USDC
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={Math.max(1, Math.round(limit))}
        step={Math.max(0.1, Math.round(limit) / 100 || 1)}
        value={Math.min(num, Math.max(1, limit))}
        onChange={(e) => setAmount(e.target.value)}
        className="tl-range mb-4 w-full"
      />
      <div className="flex flex-wrap gap-2.5">
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          className="w-24 rounded-md border border-white/10 bg-void px-2.5 py-2 text-right font-tl-mono text-sm text-bone outline-none focus:border-ion"
        />
        <button
          onClick={borrow}
          disabled={!hasLimit || onboardingIncomplete || !!busy}
          title={onboardingIncomplete ? "Register first (step 1 above)" : undefined}
          className="flex-1 rounded-lg bg-nectar py-3 font-tl-sans text-sm font-semibold text-obsidian transition-colors hover:bg-[#ffbf40] disabled:opacity-50"
        >
          {busy === "borrow" ? "Drawing…" : `Draw ${usdc(num)}`}
        </button>
        <button
          onClick={repay}
          disabled={onboardingIncomplete || !!busy}
          className="flex-1 rounded-lg border border-ion/40 py-3 font-tl-sans text-sm font-semibold text-ion transition-colors hover:bg-ion/10 disabled:opacity-50"
        >
          {busy === "repay" ? "Repaying…" : `Repay ${usdc(num)}`}
        </button>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-white/[0.07] pt-3.5 font-tl-mono text-xs">
        <span className="text-ash">dynamic APR (utilization)</span>
        <span style={{ color: defaulted ? "#FF5C4D" : "#FFB020" }}>{apr}</span>
      </div>
      {!onboardingIncomplete && registeredKnown ? (
        <button
          onClick={register}
          disabled={!!busy}
          className="mt-3 w-full text-center font-tl-mono text-xs text-ash transition-colors hover:text-bone"
        >
          {busy === "register" ? "Registering…" : "Re-register on-chain"}
        </button>
      ) : null}
      {!hasLimit && !onboardingIncomplete && registeredKnown ? (
        <p className="mt-2 text-center font-tl-mono text-[11px] text-ash">
          No independent revenue yet — earn from ≥3 distinct payers, then
          re-underwrite above to open a credit line.
        </p>
      ) : null}
      {defaulted ? (
        <p className="mt-2 text-center font-tl-mono text-xs text-flare">
          ⚠ Defaulted — frozen out of further borrowing.
        </p>
      ) : null}
      {tx ? (
        <div className="mt-2 text-center">
          <TxLink hash={tx} />
        </div>
      ) : null}
      {err ? <p className="mt-2 break-words text-center font-tl-mono text-xs text-flare">{err}</p> : null}
    </div>
  );
}

function ProofCard({ id, amt, note, color }: { id: string; amt: string; note: string; color: string }) {
  return (
    <div className="rounded-[10px] border border-white/[0.08] bg-obsidian/60 p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-tl-mono text-xs" style={{ color }}>
          {id}
        </span>
        <span className="h-[7px] w-[7px] rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
      </div>
      <div className="font-tl-sans text-2xl font-bold text-bone">{amt}</div>
      <div className="mt-1.5 font-tl-mono text-[10px] text-[#5a635e]">{note}</div>
    </div>
  );
}

function OffchainProofCard({
  result,
  underwriting,
  onSubmitProof,
  onOnchainOnly,
}: {
  result: UnderwritingResult | null;
  underwriting: boolean;
  onSubmitProof: () => void;
  onOnchainOnly: () => void;
}) {
  const verified = result?.proof?.verified;
  const color = verified ? "#FFB020" : "#5a635e";
  return (
    <div className="flex flex-col gap-3 rounded-[10px] border border-white/[0.08] bg-obsidian/60 p-5">
      <div className="flex items-center justify-between">
        <span className="font-tl-mono text-xs" style={{ color: verified ? "#FFB020" : "#A7ADA6" }}>
          zkTLS · stripe
        </span>
        {verified ? <CheckCircle2 size={14} className="text-nectar" /> : <ShieldAlert size={14} className="text-ash" />}
      </div>
      <div className="font-tl-sans text-2xl font-bold text-bone">
        {verified ? usdc(Number(result!.proof!.amountStroops) / 1e7) : "—"}
      </div>
      <div className="font-tl-mono text-[10px] text-[#5a635e]">
        {verified
          ? "verified · ×1.5 weight"
          : result?.proofError
            ? "attestor timeout — on-chain only"
            : "not proven yet"}
      </div>
      <div className="mt-1 flex flex-col gap-1.5">
        <button
          onClick={onSubmitProof}
          disabled={underwriting}
          title="Proves a private balance (e.g. Stripe) via zero-knowledge — takes ~60-90s"
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-nectar/90 px-3 py-2 font-tl-mono text-[11px] font-semibold text-obsidian transition-colors hover:bg-nectar disabled:opacity-60"
        >
          {underwriting ? <Loader2 size={12} className="animate-spin" /> : null}
          Submit revenue proof
        </button>
        <button
          onClick={onOnchainOnly}
          disabled={underwriting}
          className="rounded-md border border-white/10 px-3 py-2 font-tl-mono text-[11px] text-ash transition-colors hover:text-bone disabled:opacity-60"
        >
          Score on-chain only
        </button>
      </div>
    </div>
  );
}

function ScoreBreakdown({ result }: { result: UnderwritingResult | null }) {
  if (!result) {
    return (
      <p className="font-tl-mono text-sm text-ash">
        Run an underwriting pass to see how your score is composed.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {result.independence ? <IndependenceVerdict ind={result.independence} /> : null}
    </div>
  );
}

function IndependenceVerdict({ ind }: { ind: IndependenceResult }) {
  const indep = ind.independentPayers.length;
  const circ = ind.circularPayers.length;
  const clean = circ === 0;
  return (
    <div
      className={`rounded-lg border p-4 ${clean ? "border-ion/25 bg-ion/5" : "border-flare/30 bg-flare/10"}`}
    >
      <div className="mb-3 flex items-center gap-2">
        {clean ? <ShieldCheck size={15} className="text-ion" /> : <ShieldAlert size={15} className="text-flare" />}
        <span className="font-tl-mono text-xs font-semibold" style={{ color: clean ? "#58F0C8" : "#FF5C4D" }}>
          {clean ? "Counterparty independence verified" : `Sybil detected — ${circ} circular payer${circ > 1 ? "s" : ""} excluded`}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {ind.perPayer.map((p) => (
          <div key={p.payer} className="flex items-center justify-between gap-2 font-tl-mono text-xs">
            <span className="flex items-center gap-1.5">
              {p.independent ? (
                <CheckCircle2 size={12} className="shrink-0 text-ion" />
              ) : (
                <span className="shrink-0 font-bold text-flare">✕</span>
              )}
              <span className="text-ash">{shortAddr(p.payer)}</span>
            </span>
            <span className="text-right" style={{ color: p.independent ? "#A7ADA6" : "#FF5C4D" }}>
              {p.reason}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 border-t border-white/5 pt-2 font-tl-mono text-[11px] text-ash">
        {indep} independent · {circ} circular · {usdc(Number(ind.independentRevenueStroops) / 1e7)} USDC counted
      </div>
    </div>
  );
}

function ActivityFeed({ result }: { result: UnderwritingResult | null }) {
  if (!result) {
    return <p className="font-tl-mono text-sm text-ash">No activity yet. Submit a revenue proof to get underwritten.</p>;
  }
  const when = new Date(result.underwroteAt * 1000).toLocaleString();
  const items: { title: string; meta: string; hash?: string; active?: boolean }[] = [];
  if (result.submission.submitted && result.submission.txHash) {
    items.push({ title: "Score published on-chain", meta: when, hash: result.submission.txHash, active: true });
  }
  items.push({
    title: `Underwritten · score ${result.score.score} (${tierLabel(result.score.tier)})`,
    meta: when,
    active: !result.submission.submitted,
  });
  if (result.proof?.verified && result.proof.verifyTxHash) {
    items.push({ title: "zkTLS revenue proof verified", meta: when, hash: result.proof.verifyTxHash });
  }
  items.push({
    title: `Revenue indexed · ${usdc(result.revenue.totalRevenueUsdc)} USDC, ${result.revenue.distinctPayers} payer(s)`,
    meta: when,
  });

  return (
    <div className="relative flex flex-col gap-4">
      <div className="absolute bottom-2 left-[9px] top-2 w-px bg-white/10" />
      {items.map((it, i) => (
        <div key={i} className="relative z-10 flex gap-4">
          <div
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-obsidian ${
              it.active ? "border border-ion shadow-[0_0_8px_rgba(88,240,200,0.35)]" : "border border-white/20"
            }`}
          >
            <div className={`rounded-full ${it.active ? "h-2 w-2 bg-ion" : "h-1.5 w-1.5 bg-white/20"}`} />
          </div>
          <div>
            <div className="font-tl-sans text-sm text-bone">{it.title}</div>
            <div className="mt-0.5 flex items-center gap-2 font-tl-mono text-xs text-ash">
              <span>{it.meta}</span>
              {it.hash ? (
                <>
                  <span>•</span>
                  <TxLink hash={it.hash} />
                </>
              ) : null}
            </div>
          </div>
        </div>
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
      className="inline-flex items-center gap-1 font-tl-mono text-xs text-ion/80 transition-colors hover:text-ion"
    >
      {hash.slice(0, 6)}…{hash.slice(-4)}
      <ExternalLink size={11} />
    </a>
  );
}
