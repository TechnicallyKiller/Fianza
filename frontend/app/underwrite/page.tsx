"use client";

// Interactive underwriter — the live demo. Paste any Stellar agent address (or
// pick a preset), hit Underwrite, and watch the real backend score it: the
// verdict, and the scam-detector's per-payer breakdown showing exactly why each
// claimed customer was counted or rejected (age · diversity · reciprocity ·
// circular). Honest agent passes; the live on-chain attacker gets zeroed.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Search,
  ExternalLink,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  api,
  usdc,
  aprPct,
  tierLabel,
  shortAddr,
  type UnderwritingResult,
  type PayerWeight,
} from "@/lib/api";

// The live on-chain circular-funding attacker built in the Track B showcase.
const ATTACKER = "GAUVEA27XMTZGBTGRETNR2RVQNFP23IP62LAB6T4GDPF5DAKL5HGCB2I";
const ATTACKER_FROM_LEDGER = 3396040;

interface Preset {
  label: string;
  hint: string;
  address: string;
  fromLedger?: number;
}

export default function UnderwritePage() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [address, setAddress] = useState("");
  const [fromLedger, setFromLedger] = useState<number | undefined>();
  const [result, setResult] = useState<UnderwritingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Presets: the demo honest/sybil agents + the live attacker.
  useEffect(() => {
    api
      .demo()
      .then((d) => {
        const p: Preset[] = [];
        if (d.honestAgent)
          p.push({ label: "Honest agent", hint: "real independent customers", address: d.honestAgent, fromLedger: d.fromLedger ?? undefined });
        if (d.sybilAgent)
          p.push({ label: "Self-pay Sybil", hint: "pays itself from its own wallets", address: d.sybilAgent, fromLedger: d.fromLedger ?? undefined });
        p.push({ label: "Live attacker", hint: "circular-funding loop, on-chain", address: ATTACKER, fromLedger: ATTACKER_FROM_LEDGER });
        setPresets(p);
      })
      .catch(() => {
        setPresets([{ label: "Live attacker", hint: "circular-funding loop, on-chain", address: ATTACKER, fromLedger: ATTACKER_FROM_LEDGER }]);
      });
  }, []);

  const run = useCallback(
    async (addr: string, fl?: number) => {
      const target = addr.trim();
      if (!target) return;
      setLoading(true);
      setError(null);
      setResult(null);
      const stages = [
        "Indexing on-chain USDC revenue…",
        "Reading the payment graph…",
        "Scoring counterparty independence…",
      ];
      let i = 0;
      setStage(stages[0]);
      const t = setInterval(() => setStage(stages[++i % stages.length]), 2200);
      try {
        const r = await api.underwrite(target, { skipProof: true, fromLedger: fl });
        setResult(r);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        clearInterval(t);
        setLoading(false);
        setStage("");
      }
    },
    [],
  );

  return (
    <div className="relative z-10 mx-auto min-h-screen w-full max-w-[1100px] px-gutter py-stack-lg">
      <div className="mb-stack-lg flex items-center justify-between">
        <Link href="/" className="text-headline-md font-bold text-on-surface">
          TrustLine
        </Link>
        <span className="rounded-full border border-secondary/30 bg-secondary/10 px-3 py-1 font-label-caps text-label-caps text-secondary">
          ● Live on Stellar testnet
        </span>
      </div>

      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-headline-lg-mobile font-headline-lg md:text-headline-lg">
          Underwrite any AI agent — live.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-body-lg text-on-surface-variant">
          Paste an agent&apos;s Stellar address, or pick one below. The engine reads
          the real chain, scores its credit, and shows you exactly which of its
          &quot;customers&quot; are real — and which are the agent paying itself.
        </p>

        {/* input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(address, fromLedger);
          }}
          className="mx-auto mt-6 flex max-w-2xl flex-col gap-2 sm:flex-row"
        >
          <input
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              setFromLedger(undefined);
            }}
            placeholder="G… agent address"
            spellCheck={false}
            className="flex-1 rounded-lg border border-outline-variant bg-surface-dim/40 px-4 py-3 font-data-md text-body-sm text-on-surface outline-none focus:border-primary/60"
          />
          <button
            type="submit"
            disabled={loading || !address.trim()}
            className="electric-blue-glow inline-flex items-center justify-center gap-2 rounded-lg bg-primary-container px-6 py-3 font-body-md font-medium text-on-primary-container transition-all hover:bg-primary hover:text-surface disabled:opacity-60"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
            Underwrite
          </button>
        </form>

        {/* presets */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {presets.map((p) => (
            <button
              key={p.address}
              onClick={() => {
                setAddress(p.address);
                setFromLedger(p.fromLedger);
                run(p.address, p.fromLedger);
              }}
              disabled={loading}
              className="group rounded-full border border-outline-variant bg-surface-dim/30 px-4 py-1.5 text-body-sm text-on-surface-variant transition-colors hover:border-primary/40 hover:text-on-surface disabled:opacity-50"
              title={p.hint}
            >
              {p.label}
              <span className="ml-1.5 text-xs text-on-surface-variant/50 group-hover:text-on-surface-variant">
                {p.hint}
              </span>
            </button>
          ))}
        </div>

        {loading ? (
          <p className="mt-3 animate-pulse text-body-sm text-on-surface-variant">{stage}</p>
        ) : null}
        {error ? (
          <p className="mt-3 text-body-sm text-error">
            {error} — the backend may be asleep (free tiers sleep ~15 min; retry in ~30s).
          </p>
        ) : null}
      </div>

      {result ? <ResultPanel result={result} /> : null}
    </div>
  );
}

function ResultPanel({ result }: { result: UnderwritingResult }) {
  const s = result.score;
  const ind = result.independence;
  const approved = s.limitUsdc > 0;
  const claimed = result.revenue.totalRevenueUsdc;
  const counted = ind ? Number(ind.independentRevenueStroops) / 1e7 : claimed;
  const indScore = ind ? Math.round(ind.independenceScore * 100) : 100;

  return (
    <div className="mt-stack-lg grid grid-cols-1 gap-stack-md lg:grid-cols-[minmax(0,340px)_1fr]">
      {/* verdict */}
      <div
        className={`glass-card flex flex-col gap-4 rounded-lg p-card-padding ${
          approved ? "border-secondary/30" : "border-error/30"
        }`}
      >
        <div className="flex items-center gap-3">
          {approved ? (
            <ShieldCheck size={30} className="text-secondary" />
          ) : (
            <ShieldAlert size={30} className="text-error" />
          )}
          <div>
            <div className={`font-headline-md text-headline-md ${approved ? "text-secondary" : "text-error"}`}>
              {approved ? "Credit approved" : "Credit denied"}
            </div>
            <div className="font-data-md text-xs text-on-surface-variant">{shortAddr(result.agent)}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Stat label="Score" value={String(s.score)} />
          <Stat label="Tier" value={tierLabel(s.tier)} />
          <Stat label="Credit line" value={`${usdc(s.limitUsdc)} USDC`} />
          <Stat label="APR" value={s.aprBps ? aprPct(s.aprBps) : "—"} />
        </div>

        {s.defaulted ? (
          <div className="rounded border border-error/30 bg-error/10 px-3 py-2 text-body-sm text-error">
            ⚠ Defaulted on a prior loan — score collapsed below lending grade.
          </div>
        ) : null}
        {s.repayments && s.repayments.total > 0 ? (
          <div className="text-xs text-on-surface-variant">
            Repayment history: {s.repayments.onTime}/{s.repayments.total} on-time
            {s.components.historyDelta ? ` (${s.components.historyDelta > 0 ? "+" : ""}${s.components.historyDelta} to score)` : ""}
          </div>
        ) : null}
      </div>

      {/* revenue reality check + breakdown */}
      <div className="glass-card flex flex-col gap-4 rounded-lg p-card-padding">
        <div>
          <div className="mb-1 font-label-caps text-label-caps uppercase text-on-surface-variant">
            Revenue reality check
          </div>
          <div className="flex items-baseline gap-3">
            <span className="font-headline-md text-headline-md text-on-surface">
              {usdc(claimed)} <span className="text-body-sm text-on-surface-variant">claimed</span>
            </span>
            <span className="text-on-surface-variant">→</span>
            <span className={`font-headline-md text-headline-md ${counted > 0 ? "text-secondary" : "text-error"}`}>
              {usdc(counted)} <span className="text-body-sm text-on-surface-variant">counted</span>
            </span>
          </div>
          {/* independence bar */}
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-dim/50">
            <div
              className={`h-full rounded-full ${indScore >= 60 ? "bg-secondary" : indScore > 0 ? "bg-amber-400" : "bg-error"}`}
              style={{ width: `${indScore}%` }}
            />
          </div>
          <div className="mt-1 text-xs text-on-surface-variant">
            {indScore}% of claimed revenue is from genuinely independent counterparties
            {ind && ind.circularPayers.length > 0 ? ` · ${ind.circularPayers.length} circular payer(s) caught` : ""}
          </div>
        </div>

        {ind && ind.perPayer.length > 0 ? (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-3 border-b border-white/5 pb-1 text-xs text-on-surface-variant/60">
              <span>Payer</span>
              <span className="text-center" title="account age">age</span>
              <span className="text-center" title="external diversity">div</span>
              <span className="text-center" title="reciprocity (not paid back)">recip</span>
              <span className="text-right">counts</span>
            </div>
            {ind.perPayer.map((p) => (
              <PayerRow key={p.payer} p={p} />
            ))}
          </div>
        ) : (
          <div className="text-body-sm text-on-surface-variant/60">
            No counterparties indexed in this window.
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-white/5 bg-surface-dim/30 px-3 py-2">
      <div className="text-xs text-on-surface-variant">{label}</div>
      <div className="font-data-md text-body-md text-on-surface">{value}</div>
    </div>
  );
}

function PayerRow({ p }: { p: PayerWeight }) {
  const counts = p.weight > 0;
  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-x-3 gap-y-0.5 py-1">
      <div className="flex min-w-0 items-center gap-1.5">
        {counts ? (
          <CheckCircle2 size={14} className="shrink-0 text-secondary" />
        ) : (
          <XCircle size={14} className="shrink-0 text-error" />
        )}
        <span className="truncate font-data-md text-xs text-on-surface-variant">{shortAddr(p.payer)}</span>
      </div>
      <FactorDot v={p.ageFactor} />
      <FactorDot v={p.diversityFactor} />
      <FactorDot v={p.reciprocityFactor} />
      <span className={`text-right font-data-md text-xs ${counts ? "text-secondary" : "text-error"}`}>
        {usdc(Number(p.effectiveStroops) / 1e7)}
      </span>
      <div className="col-span-5 -mt-0.5 pl-[22px] text-xs text-on-surface-variant/60">{p.reason}</div>
    </div>
  );
}

// A compact 0..1 factor indicator (green→amber→red).
function FactorDot({ v }: { v: number }) {
  const color = v >= 0.66 ? "bg-secondary" : v >= 0.2 ? "bg-amber-400" : "bg-error";
  return (
    <span className="inline-flex h-6 w-8 items-center justify-center">
      <span className="relative h-1.5 w-8 overflow-hidden rounded-full bg-surface-dim/60">
        <span className={`absolute left-0 top-0 h-full rounded-full ${color}`} style={{ width: `${Math.max(6, v * 100)}%` }} />
      </span>
    </span>
  );
}
