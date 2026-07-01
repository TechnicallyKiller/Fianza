"use client";

// Self-serve demo — no wallet, no CLI. A visitor clicks "Run" and watches, live:
// an honest agent get APPROVED and a Sybil agent get DENIED, on Stellar testnet,
// plus the real settlement-tx timeline of an autonomous borrow/repay.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
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

const EXPLORER = (h: string) =>
  `https://stellar.expert/explorer/testnet/tx/${h}`;

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
      "Indexing on-chain x402 revenue…",
      "Tracing counterparty independence…",
      "Scoring & signing the underwriting…",
    ];
    let i = 0;
    setStage(stages[0]);
    const t = setInterval(() => setStage(stages[++i % stages.length]), 2600);
    try {
      const fl = info.fromLedger ?? undefined;
      const [h, s] = await Promise.all([
        api.underwrite(info.honestAgent, { skipProof: true, fromLedger: fl }),
        api.underwrite(info.sybilAgent, { skipProof: true, fromLedger: fl }),
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
    <div className="relative z-10 mx-auto min-h-screen w-full max-w-[1100px] px-gutter py-stack-lg">
      {/* nav */}
      <div className="mb-stack-lg flex items-center justify-between">
        <Link href="/" className="text-headline-md font-bold text-on-surface">
          TrustLine
        </Link>
        <span className="rounded-full border border-secondary/30 bg-secondary/10 px-3 py-1 font-label-caps text-label-caps text-secondary">
          ● Live on Stellar testnet
        </span>
      </div>

      {/* hero */}
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-headline-lg-mobile font-headline-lg md:text-headline-lg">
          Watch an AI agent take credit —
          <br />
          and a fraudster get denied.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-body-lg text-on-surface-variant">
          Real underwriting, real transactions, no wallet needed. Two agents.
          One earns from independent customers; one fakes it by paying itself.
          Press run and watch the engine decide — live.
        </p>
        <button
          onClick={run}
          disabled={running || !info?.honestAgent}
          className="electric-blue-glow mt-6 inline-flex items-center gap-2 rounded-lg bg-primary-container px-6 py-3 font-body-md font-medium text-on-primary-container transition-all duration-300 hover:scale-[1.02] hover:bg-primary hover:text-surface disabled:opacity-60"
        >
          {running ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Play size={18} />
          )}
          {running ? "Underwriting live…" : "▶ Run the live underwriting"}
        </button>
        {running ? (
          <p className="mt-3 animate-pulse text-body-sm text-on-surface-variant">
            {stage}
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 text-body-sm text-error">
            {error} — is the backend awake? (free tiers sleep; retry in ~30s)
          </p>
        ) : null}
      </div>

      {/* verdict cards */}
      <div className="mt-stack-lg grid grid-cols-1 gap-stack-md md:grid-cols-2">
        <AgentCard
          kind="honest"
          address={info?.honestAgent ?? null}
          result={honest}
          running={running}
        />
        <AgentCard
          kind="sybil"
          address={info?.sybilAgent ?? null}
          result={sybil}
          running={running}
        />
      </div>

      {/* real settlement timeline */}
      {info?.txs ? (
        <div className="mt-stack-lg">
          <h2 className="mb-1 font-headline-md text-headline-md">
            …and when it&apos;s approved, the agent borrows &amp; repays itself
          </h2>
          <p className="mb-stack-md text-body-sm text-on-surface-variant">
            Every step below is a real transaction on Stellar testnet — click any
            to verify. No human signed these; the agent did.
          </p>
          <div className="glass-card rounded-lg p-card-padding">
            <div className="flex flex-col gap-1">
              <TxStep label="Agent registers on-chain" hash={info.txs.register} />
              <TxStep label="Score published (Tier C, 7.5 USDC line)" hash={info.txs.scorePublished} />
              <TxStep label="Lender funds the isolated vault (7 USDC)" hash={info.txs.deposit} />
              <TxStep label="Agent autonomously borrows 5 USDC" hash={info.txs.borrow} highlight />
              <TxStep label="Agent repays 5 USDC (interest → lender yield)" hash={info.txs.repay} />
              <TxStep label="Hits a $3 paywall it can't afford → credit draws itself, pays over x402" hash={info.txs.drawOn402} highlight />
            </div>
          </div>
        </div>
      ) : null}

      {/* CTAs */}
      <div className="mt-stack-lg flex flex-wrap items-center justify-center gap-4 border-t border-outline-variant/30 pt-stack-md">
        <Link
          href="/borrower"
          className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-5 py-2.5 font-body-sm font-medium text-primary transition-colors hover:bg-primary/20"
        >
          Try it with your own wallet <ArrowRight size={15} />
        </Link>
        <a
          href="https://github.com/TechnicallyKiller/TrustLine"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-outline-variant px-5 py-2.5 font-body-sm text-on-surface-variant transition-colors hover:text-on-surface"
        >
          Source + agent SDK <ExternalLink size={14} />
        </a>
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

  return (
    <div
      className={`glass-card relative flex flex-col gap-4 rounded-lg p-card-padding transition-all ${
        approved === true
          ? "border-secondary/30"
          : approved === false
            ? "border-error/30"
            : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="font-body-md font-semibold text-on-surface">
            {kind === "honest" ? "Honest agent" : "Sybil agent"}
          </div>
          <div className="mt-0.5 font-data-md text-xs text-on-surface-variant">
            {address ? shortAddr(address) : "…"}
          </div>
        </div>
        <div className="text-right text-body-sm text-on-surface-variant">
          {kind === "honest"
            ? "earns from 3 independent payers"
            : "pays itself from 3 own wallets"}
        </div>
      </div>

      {/* verdict */}
      <div className="min-h-[64px]">
        {running && !result ? (
          <div className="flex items-center gap-2 text-body-md text-on-surface-variant">
            <Loader2 size={18} className="animate-spin" /> underwriting…
          </div>
        ) : approved === null ? (
          <div className="text-body-md text-on-surface-variant/60">
            press run to underwrite →
          </div>
        ) : approved ? (
          <div className="flex items-center gap-3">
            <ShieldCheck size={28} className="text-secondary" />
            <div>
              <div className="font-headline-md text-headline-md text-secondary">
                Credit approved
              </div>
              <div className="text-body-sm text-on-surface-variant">
                score {s!.score} · {tierLabel(s!.tier)} · {usdc(s!.limitUsdc)} USDC
                @ {aprPct(s!.aprBps)}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <ShieldAlert size={28} className="text-error" />
            <div>
              <div className="font-headline-md text-headline-md text-error">
                Credit denied
              </div>
              <div className="text-body-sm text-on-surface-variant">
                score {s!.score} · {tierLabel(s!.tier)} · no independent revenue
              </div>
            </div>
          </div>
        )}
      </div>

      {/* independence breakdown */}
      {ind ? (
        <div className="rounded border border-white/5 bg-surface-dim/30 p-3">
          <div className="mb-2 font-label-caps text-label-caps uppercase text-on-surface-variant">
            Counterparty independence
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
            {ind.independentPayers.length} independent · {ind.circularPayers.length}{" "}
            circular caught ·{" "}
            {usdc(Number(ind.independentRevenueStroops) / 1e7)} USDC counted
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TxStep({
  label,
  hash,
  highlight,
}: {
  label: string;
  hash?: string;
  highlight?: boolean;
}) {
  if (!hash) return null;
  return (
    <a
      href={EXPLORER(hash)}
      target="_blank"
      rel="noreferrer"
      className={`group flex items-center justify-between gap-3 rounded border border-transparent px-2 py-2 transition-colors hover:border-white/10 hover:bg-white/[0.02] ${
        highlight ? "text-on-surface" : "text-on-surface-variant"
      }`}
    >
      <span className="flex items-center gap-2 text-body-sm">
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${highlight ? "bg-primary" : "bg-white/25"}`}
        />
        {label}
      </span>
      <span className="flex items-center gap-1 font-data-md text-xs text-primary/70 group-hover:text-primary">
        {hash.slice(0, 8)}… <ExternalLink size={12} />
      </span>
    </a>
  );
}
