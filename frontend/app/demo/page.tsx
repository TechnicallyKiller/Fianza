"use client";

// Self-serve demo, restyled to the Fianza.dc.html palette — the duel:
// an honest agent gets APPROVED (nectar/ion), a Sybil agent gets DENIED
// (flare), same engine, opposite outcomes, live. No wallet, no CLI.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import TLNav from "@/components/tl/TLNav";
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  Loader2,
  Play,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import {
  api,
  usdc,
  aprPct,
  tierLabel,
  shortAddr,
  type DemoInfo,
  type UnderwritingResult,
} from "@/lib/api";

const EXPLORER = (h: string) => `https://stellar.expert/explorer/testnet/tx/${h}`;

export default function DemoPage() {
  const [info, setInfo] = useState<DemoInfo | null>(null);
  const [honest, setHonest] = useState<UnderwritingResult | null>(null);
  const [sybil, setSybil] = useState<UnderwritingResult | null>(null);
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.demo().then(setInfo).catch((e) => setError(e.message));
  }, []);

  const run = useCallback(async () => {
    if (!info?.honestAgent || !info?.sybilAgent) return;
    setRunning(true);
    setError(null);
    setHonest(null);
    setSybil(null);
    const stages = [
      "indexing on-chain x402 revenue…",
      "tracing counterparty independence…",
      "scoring & signing the underwriting…",
    ];
    let i = 0;
    setStage(stages[0]);
    const t = setInterval(() => setStage(stages[++i % stages.length]), 2600);
    try {
      // Don't pin the scan to DEMO_FROM_LEDGER — those payments have aged out of
      // the RPC's ~7-day retention window, so a stale start ledger just triggers
      // a raw RPC range error. The backend's persistent graph + Horizon fallback
      // carry the demo agents' full history instead.
      const [h, s] = await Promise.all([
        api.underwrite(info.honestAgent, { skipProof: true }),
        api.underwrite(info.sybilAgent, { skipProof: true }),
      ]);
      setHonest(h);
      setSybil(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      clearInterval(t);
      setRunning(false);
      setStage("");
    }
  }, [info]);

  return (
    <div className="tl-select relative min-h-screen bg-obsidian text-bone">
      <TLNav />
      <div className="tl-grain relative mx-auto w-full max-w-[1100px] px-6 py-16 md:px-10">
        {/* hero */}
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-5 font-tl-mono text-[11px] tracking-[0.22em] text-ion">
            / DEMO · THE DUEL
          </div>
          <h1 className="font-tl-serif text-[min(6.5vw,50px)] font-normal leading-[1.05] tracking-[-0.02em] text-bone">
            Watch an agent take{" "}
            <span className="italic text-nectar">credit</span> — and a
            fraudster get <span className="text-flare">denied</span>.
          </h1>
          <p className="mx-auto mt-5 max-w-xl font-tl-sans text-sm leading-[1.7] text-ash">
            Real underwriting, real transactions, no wallet needed. Two
            agents, same engine. One earns from independent customers; one
            fakes it by paying itself. Press run and watch the verdicts
            resolve — live.
          </p>
          <button
            onClick={run}
            disabled={running || !info?.honestAgent}
            className="mt-7 inline-flex items-center gap-2 rounded-lg bg-nectar px-6 py-3 font-tl-sans text-sm font-semibold text-obsidian transition-colors hover:bg-ion disabled:opacity-60"
          >
            {running ? <Loader2 size={17} className="animate-spin" /> : <Play size={17} />}
            {running ? "Underwriting live…" : "Run the live underwriting"}
          </button>
          {running ? (
            <p className="mt-3 animate-pulse font-tl-mono text-xs text-ash">{stage}</p>
          ) : null}
          {error ? (
            <p className="mt-3 font-tl-mono text-xs text-flare">
              {error} — is the backend awake? (free tiers sleep; retry in ~30s)
            </p>
          ) : null}
        </div>

        {/* verdict cards */}
        <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-2">
          <AgentCard kind="honest" address={info?.honestAgent ?? null} result={honest} running={running} />
          <AgentCard kind="sybil" address={info?.sybilAgent ?? null} result={sybil} running={running} />
        </div>

        {/* real settlement timeline */}
        {info?.txs ? (
          <div className="mt-14">
            <h2 className="mb-1.5 font-tl-serif text-xl text-bone sm:text-2xl">
              …and when it&apos;s approved, the agent borrows &amp; repays itself
            </h2>
            <p className="mb-5 font-tl-mono text-xs text-ash">
              Every step below is a real transaction on Stellar testnet —
              click any to verify. No human signed these; the agent did.
            </p>
            <div className="rounded-xl border border-white/[0.08] bg-void/60 p-2">
              <div className="flex flex-col gap-1">
                <TxStep label="Agent registers on-chain" hash={info.txs.register} />
                <TxStep label="Score published (Tier C, 7.5 USDC line)" hash={info.txs.scorePublished} />
                <TxStep label="Lender funds the isolated vault (7 USDC)" hash={info.txs.deposit} />
                <TxStep label="Agent autonomously borrows 5 USDC" hash={info.txs.borrow} highlight />
                <TxStep label="Agent repays 5 USDC (interest → lender yield)" hash={info.txs.repay} />
                <TxStep
                  label="Hits a $3 paywall it can't afford → credit draws itself, pays over x402"
                  hash={info.txs.drawOn402}
                  highlight
                />
              </div>
            </div>
          </div>
        ) : null}

        {/* CTAs */}
        <div className="mt-14 flex flex-wrap items-center justify-center gap-4 border-t border-white/[0.08] pt-8">
          <Link
            href="/borrower"
            className="inline-flex items-center gap-2 rounded-lg border border-ion/30 bg-ion/10 px-5 py-2.5 font-tl-sans text-sm font-semibold text-ion transition-colors hover:bg-ion/20"
          >
            Try it with your own wallet <ArrowRight size={15} />
          </Link>
          <a
            href="https://github.com/TechnicallyKiller/TrustLine"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-5 py-2.5 font-tl-mono text-xs text-ash transition-colors hover:text-bone"
          >
            Source + agent SDK <ExternalLink size={13} />
          </a>
        </div>
      </div>
    </div>
  );
}

function AgentCard({
  kind,
  address,
  result,
  running,
}: {
  kind: "honest" | "sybil";
  address: string | null;
  result: UnderwritingResult | null;
  running: boolean;
}) {
  const s = result?.score;
  const ind = result?.independence;
  const approved = s ? s.limitUsdc > 0 : null;
  const borderColor = approved === true ? "rgba(88,240,200,.3)" : approved === false ? "rgba(255,92,77,.35)" : "rgba(255,255,255,.08)";

  return (
    <div
      className="tl-anim-fadeup relative flex flex-col gap-4 rounded-xl border bg-void/60 p-6 transition-colors"
      style={{ borderColor }}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="font-tl-sans text-[15px] font-semibold text-bone">
            {kind === "honest" ? "Honest agent" : "Sybil agent"}
          </div>
          <div className="mt-0.5 font-tl-mono text-xs text-ash">{address ? shortAddr(address) : "…"}</div>
        </div>
        <div className="text-right font-tl-mono text-[11px] text-[#5a635e]">
          {kind === "honest" ? "earns from 3 independent payers" : "pays itself from 3 own wallets"}
        </div>
      </div>

      {/* verdict */}
      <div className="min-h-16">
        {running && !result ? (
          <div className="flex items-center gap-2 font-tl-mono text-sm text-ash">
            <Loader2 size={17} className="animate-spin" /> underwriting…
          </div>
        ) : approved === null ? (
          <div className="font-tl-mono text-sm text-[#4d564f]">press run to underwrite →</div>
        ) : approved ? (
          <div className="flex items-center gap-3">
            <ShieldCheck size={26} className="text-ion" />
            <div>
              <div className="font-tl-serif text-xl text-ion">Credit approved</div>
              <div className="font-tl-mono text-xs text-ash">
                score {s!.score} · {tierLabel(s!.tier)} · {usdc(s!.limitUsdc)} USDC @ {aprPct(s!.aprBps)}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <ShieldAlert size={26} className="text-flare" />
            <div>
              <div className="font-tl-serif text-xl text-flare">Credit denied</div>
              <div className="font-tl-mono text-xs text-ash">
                score {s!.score} · {tierLabel(s!.tier)} · no independent revenue
              </div>
            </div>
          </div>
        )}
      </div>

      {/* independence breakdown */}
      {ind ? (
        <div className="rounded-lg border border-white/[0.06] bg-obsidian/60 p-3.5">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="font-tl-mono text-[10px] uppercase tracking-[0.1em] text-ash">
              Counterparty independence
            </span>
            <span className="font-tl-mono text-xs text-ash">
              {Math.round(ind.independenceScore * 100)}% counted
            </span>
          </div>
          <div className="mb-3.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(2, ind.independenceScore * 100)}%`,
                background: ind.independenceScore >= 0.6 ? "#58F0C8" : ind.independenceScore > 0 ? "#FFB020" : "#FF5C4D",
              }}
            />
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
          <div className="mt-2.5 border-t border-white/[0.06] pt-2 font-tl-mono text-[11px] text-[#5a635e]">
            {ind.independentPayers.length} independent · {ind.circularPayers.length} circular caught ·{" "}
            {usdc(Number(ind.independentRevenueStroops) / 1e7)} USDC counted
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TxStep({ label, hash, highlight }: { label: string; hash?: string; highlight?: boolean }) {
  if (!hash) return null;
  return (
    <a
      href={EXPLORER(hash)}
      target="_blank"
      rel="noreferrer"
      className="group flex items-center justify-between gap-3 rounded-md border border-transparent px-3 py-2.5 transition-colors hover:border-white/[0.08] hover:bg-white/[0.02]"
    >
      <span className="flex items-center gap-2 font-tl-sans text-sm" style={{ color: highlight ? "#F4F1E9" : "#A7ADA6" }}>
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: highlight ? "#FFB020" : "rgba(255,255,255,.25)" }}
        />
        {label}
      </span>
      <span className="flex items-center gap-1 font-tl-mono text-xs text-ion/70 group-hover:text-ion">
        {hash.slice(0, 8)}… <ExternalLink size={11} />
      </span>
    </a>
  );
}
