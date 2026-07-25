"use client";

// /agent-demo — the autonomous agent, live. A real LLM (free Groq by default)
// reasons in the chat; when it's short on cash it draws Fianza credit on a
// REAL testnet transaction, buys the data it needs, answers, and can repay.
// Every money-move shows a clickable Stellar Expert link. No terminal.
//
// This talks to agents/demo/agent-server.mjs over SSE (NEXT_PUBLIC_AGENT_SERVER).
// The LLM key + agent secret stay on that server; the browser only sends a prompt.

import { useCallback, useEffect, useRef, useState } from "react";
import TLNav from "@/components/tl/TLNav";
import {
  Loader2,
  Send,
  ExternalLink,
  Brain,
  CreditCard,
  CheckCircle2,
  Wallet,
  Sparkles,
  Droplets,
  ShieldAlert,
  SkullIcon,
} from "lucide-react";
import MainnetPanel from "./MainnetPanel";

const AGENT_SERVER =
  process.env.NEXT_PUBLIC_AGENT_SERVER || "http://localhost:3040";
const EXPLORER = (h: string) => `https://stellar.expert/explorer/testnet/tx/${h}`;

type Event =
  | { type: "start"; agent: string; priceUsdc: number }
  | { type: "thinking"; text: string }
  | { type: "tool_call"; name: string; args: any }
  | { type: "tool_result"; name: string; result: any }
  | { type: "final"; text: string }
  | { type: "done"; final: string }
  | { type: "error"; message: string };

interface Info {
  agent: string;
  researchPriceUsdc: number;
  llm: { model: string; hasKey: boolean; providers?: string[] };
  deadbeat?: string | null;
}

interface Deadbeat {
  configured: boolean;
  agent?: string;
  outstandingUsdc?: number | null;
  dueDate?: number | null;
  defaulted?: boolean | null;
}

const SUGGESTIONS = [
  "Give me a research note on XLM.",
  "What's driving demand for AI compute right now?",
  "Research Bitcoin's key risks this quarter.",
];

export default function AgentDemoPage() {
  const [network, setNetwork] = useState<"testnet" | "mainnet">("testnet");
  const [info, setInfo] = useState<Info | null>(null);
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Operator controls: drain the agent's cash, and the default scenario.
  const [draining, setDraining] = useState(false);
  const [drainMsg, setDrainMsg] = useState<string | null>(null);
  const [deadbeat, setDeadbeat] = useState<Deadbeat | null>(null);
  const [defaulting, setDefaulting] = useState(false);
  const [defaultTx, setDefaultTx] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${AGENT_SERVER}/info`)
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => setError("Can't reach the agent server. Is agent-server.mjs running?"));
  }, []);

  // Poll the deadbeat status so the default panel shows live state.
  const refreshDeadbeat = useCallback(() => {
    fetch(`${AGENT_SERVER}/deadbeat`)
      .then((r) => r.json())
      .then(setDeadbeat)
      .catch(() => {});
  }, []);
  useEffect(() => {
    refreshDeadbeat();
    const t = setInterval(refreshDeadbeat, 15000);
    return () => clearInterval(t);
  }, [refreshDeadbeat]);

  const drain = useCallback(async () => {
    setDraining(true);
    setDrainMsg(null);
    try {
      const r = await fetch(`${AGENT_SERVER}/drain`, { method: "POST" }).then((x) => x.json());
      setDrainMsg(
        r.drained
          ? `Swept $${r.sweptUsdc} — agent is cash-poor again ($${r.balanceUsdc}). Next run will draw credit.`
          : r.reason || "nothing to drain",
      );
    } catch (e) {
      setDrainMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setDraining(false);
    }
  }, []);

  const triggerDefault = useCallback(async () => {
    setDefaulting(true);
    setError(null);
    try {
      const r = await fetch(`${AGENT_SERVER}/default`, { method: "POST" }).then((x) => x.json());
      if (r.error) throw new Error(r.error);
      setDefaultTx(r.txHash);
      refreshDeadbeat();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDefaulting(false);
    }
  }, [refreshDeadbeat]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [events]);

  const run = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || running) return;
      setRunning(true);
      setError(null);
      setEvents([]);

      try {
        const res = await fetch(`${AGENT_SERVER}/run`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ request: q }),
        });
        if (!res.ok || !res.body) throw new Error(`agent server ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const chunks = buf.split("\n\n");
          buf = chunks.pop() || "";
          for (const chunk of chunks) {
            const line = chunk.split("\n").find((l) => l.startsWith("data: "));
            if (!line) continue;
            try {
              const ev = JSON.parse(line.slice(6)) as Event;
              setEvents((prev) => [...prev, ev]);
            } catch {
              /* ignore malformed keep-alive */
            }
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setRunning(false);
      }
    },
    [running],
  );

  return (
    <div className="tl-select relative min-h-screen bg-obsidian text-bone">
      <TLNav />
      <div className="tl-grain relative mx-auto w-full max-w-[900px] px-6 py-14 md:px-10">
        {/* network tabs */}
        <div className="tl-anim-fadeup mx-auto mb-8 flex max-w-2xl items-center justify-center gap-2">
          <button
            onClick={() => setNetwork("testnet")}
            className={`rounded-full border px-4 py-1.5 font-tl-mono text-[11px] tracking-[0.1em] transition-colors ${
              network === "testnet"
                ? "border-ion/40 bg-ion/[0.1] text-ion"
                : "border-white/10 text-ash hover:border-white/20"
            }`}
          >
            TESTNET · full agent loop
          </button>
          <button
            onClick={() => setNetwork("mainnet")}
            className={`rounded-full border px-4 py-1.5 font-tl-mono text-[11px] tracking-[0.1em] transition-colors ${
              network === "mainnet"
                ? "border-flare/40 bg-flare/[0.1] text-flare"
                : "border-white/10 text-ash hover:border-white/20"
            }`}
          >
            MAINNET · real funds
          </button>
        </div>

        {network === "mainnet" ? (
          <MainnetPanel />
        ) : (
        <>
        {/* hero */}
        <div className="tl-anim-fadeup mx-auto max-w-2xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-ion/20 bg-ion/[0.06] px-3 py-1 font-tl-mono text-[10px] tracking-[0.2em] text-ion">
            <span
              className={`h-[6px] w-[6px] rounded-full shadow-[0_0_8px_currentColor] ${
                info ? "tl-anim-blink bg-ion" : "bg-ash"
              }`}
            />
            {info ? "AGENT ONLINE" : "CONNECTING…"}
          </div>
          <h1 className="font-tl-serif text-[min(6.5vw,46px)] font-normal leading-[1.06] tracking-[-0.02em]">
            An AI agent that{" "}
            <span className="tl-anim-breathe inline-block italic text-nectar">
              borrows to earn
            </span>{" "}
            — and decides on its own.
          </h1>
          <p className="mx-auto mt-4 max-w-xl font-tl-sans text-sm leading-[1.7] text-ash">
            Ask it for research. To answer well it must buy a paid data call it
            may not be able to afford. Watch a real model reason, draw Fianza
            credit on a live testnet transaction, deliver, and repay. Every
            money-move is clickable and real.
          </p>

          {/* how-it-works strip */}
          <div className="mx-auto mt-6 flex max-w-lg flex-wrap items-center justify-center gap-x-2 gap-y-2 font-tl-mono text-[10px] text-ash">
            {["check credit", "draw credit", "buy data", "get paid", "repay ↑"].map(
              (step, i, arr) => (
                <span key={step} className="inline-flex items-center gap-2">
                  <span className="rounded-md border border-white/[0.08] bg-void/60 px-2 py-1 text-bone/80">
                    {step}
                  </span>
                  {i < arr.length - 1 ? <span className="text-ion/50">→</span> : null}
                </span>
              ),
            )}
          </div>

          {info ? (
            <p className="mt-4 font-tl-mono text-[11px] text-ash/80">
              agent {short(info.agent)} · data call ~${info.researchPriceUsdc} ·{" "}
              model {info.llm?.model}
            </p>
          ) : null}
        </div>

        {/* transcript */}
        <div
          ref={scrollRef}
          className="mt-10 max-h-[52vh] overflow-y-auto rounded-xl border border-white/[0.08] bg-void/60 p-4"
        >
          {events.length === 0 && !running ? (
            <p className="py-10 text-center font-tl-mono text-xs text-ash">
              Ask the agent something to begin.
            </p>
          ) : null}
          <div className="flex flex-col gap-3">
            {events.map((ev, i) => (
              <div key={i} className="tl-anim-fadeup">
                <EventRow ev={ev} />
              </div>
            ))}
            {running ? (
              <div className="flex items-center gap-2 font-tl-mono text-xs text-ash">
                <Loader2 size={13} className="animate-spin" />
                agent working… (real testnet tx take a few seconds)
              </div>
            ) : null}
          </div>
        </div>

        {error ? (
          <p className="mt-3 font-tl-mono text-xs text-flare">{error}</p>
        ) : null}

        {/* suggestions */}
        {events.length === 0 ? (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => run(s)}
                disabled={running}
                className="rounded-full border border-white/10 px-3 py-1.5 font-tl-sans text-xs text-ash transition-colors hover:border-nectar/50 hover:text-bone disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}

        {/* input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(prompt);
          }}
          className="mt-5 flex items-center gap-2"
        >
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask the agent for market research…"
            disabled={running}
            className="flex-1 rounded-lg border border-white/10 bg-obsidian px-4 py-3 font-tl-sans text-sm text-bone placeholder:text-ash/60 focus:border-nectar/60 focus:outline-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={running || !prompt.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-nectar px-5 py-3 font-tl-sans text-sm font-semibold text-obsidian transition-colors hover:bg-ion disabled:opacity-60"
          >
            {running ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Ask
          </button>
        </form>

        {/* operator controls: drain + default scenario */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* drain */}
          <div className="rounded-xl border border-white/[0.08] bg-void/50 p-4">
            <div className="mb-1 flex items-center gap-2 font-tl-mono text-[11px] tracking-[0.14em] text-ion">
              <Droplets size={13} /> DRAIN AGENT CASH
            </div>
            <p className="mb-3 font-tl-sans text-[11px] leading-[1.5] text-ash">
              Sweep the agent&apos;s spare cash so the next run must draw credit —
              the money moment. A real testnet payment.
            </p>
            <button
              onClick={drain}
              disabled={draining}
              className="group relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-lg border border-ion/30 bg-ion/[0.07] px-4 py-2.5 font-tl-sans text-sm font-semibold text-ion transition-colors hover:bg-ion/[0.14] disabled:opacity-60"
            >
              {/* sweep shimmer */}
              <span
                className={`pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-ion/25 to-transparent ${
                  draining ? "tl-anim-scan" : "group-hover:translate-x-full group-hover:transition-transform group-hover:duration-700"
                }`}
              />
              {draining ? <Loader2 size={15} className="animate-spin" /> : <Droplets size={15} />}
              {draining ? "Sweeping…" : "Drain to cash-poor"}
            </button>
            {drainMsg ? (
              <p className="tl-anim-fadeup mt-2 font-tl-mono text-[10px] leading-[1.5] text-ash">
                {drainMsg}
              </p>
            ) : null}
          </div>

          {/* default scenario */}
          <div
            className={`rounded-xl border p-4 transition-colors ${
              deadbeat?.defaulted
                ? "border-flare/40 bg-flare/[0.07]"
                : "border-flare/20 bg-void/50"
            }`}
          >
            <div className="mb-1 flex items-center gap-2 font-tl-mono text-[11px] tracking-[0.14em] text-flare">
              <ShieldAlert size={13} /> WHAT IF IT DOESN&apos;T PAY?
            </div>
            {deadbeat?.defaulted ? (
              <div className="tl-anim-fadeup">
                <p className="mb-2 flex items-center gap-2 font-tl-sans text-sm font-semibold text-flare">
                  <SkullIcon size={15} /> Agent defaulted — lenders took the loss.
                </p>
                <p className="mb-2 font-tl-sans text-[11px] leading-[1.5] text-ash">
                  The loan went unpaid past its due date. On-chain: the reserve
                  absorbed what it could, the rest was written off (lenders&apos;
                  share value drops), and this agent is now frozen out of credit.
                </p>
                {defaultTx ? <TxLink label="mark_default" hash={defaultTx} /> : null}
              </div>
            ) : (
              <>
                <p className="mb-3 font-tl-sans text-[11px] leading-[1.5] text-ash">
                  {deadbeat?.configured
                    ? `A staged agent owes $${deadbeat.outstandingUsdc ?? "?"} and won't repay. Once its loan is overdue, anyone can mark it defaulted — the loss is socialized to lenders, priced into the APR.`
                    : "Not staged. Run stage-default.mjs ~6 min before, then trigger the default live."}
                </p>
                <button
                  onClick={triggerDefault}
                  disabled={defaulting || !deadbeat?.configured}
                  className="tl-anim-breathe inline-flex w-full items-center justify-center gap-2 rounded-lg border border-flare/40 bg-flare/[0.1] px-4 py-2.5 font-tl-sans text-sm font-semibold text-flare transition-colors hover:bg-flare/20 disabled:animate-none disabled:opacity-50"
                >
                  {defaulting ? <Loader2 size={15} className="animate-spin" /> : <ShieldAlert size={15} />}
                  {defaulting ? "Marking default…" : "Trigger default"}
                </button>
              </>
            )}
          </div>
        </div>

        <p className="mt-6 text-center font-tl-mono text-[11px] leading-relaxed text-ash/70">
          Spend-to-earn, not speculation: the agent only borrows to buy an input
          for paid work, then repays from the payout. Underwritten against its
          own on-chain revenue.
        </p>
        </>
        )}
      </div>
    </div>
  );
}

function EventRow({ ev }: { ev: Event }) {
  if (ev.type === "thinking") {
    return (
      <div className="flex gap-2.5">
        <Brain size={15} className="mt-0.5 shrink-0 text-ion" />
        <p className="font-tl-sans text-sm leading-[1.6] text-bone/90">{ev.text}</p>
      </div>
    );
  }

  if (ev.type === "final" || ev.type === "done") {
    const text = ev.type === "final" ? ev.text : ev.final;
    if (!text) return null;
    return (
      <div className="flex gap-2.5 rounded-lg border border-nectar/25 bg-nectar/[0.06] p-3">
        <Sparkles size={15} className="mt-0.5 shrink-0 text-nectar" />
        <p className="font-tl-sans text-sm leading-[1.65] text-bone">{text}</p>
      </div>
    );
  }

  if (ev.type === "tool_call") {
    const label =
      ev.name === "check_credit"
        ? "Checking wallet & credit line…"
        : ev.name === "buy_premium_data"
          ? `Buying premium data on "${ev.args?.topic ?? "…"}"…`
          : ev.name === "deliver_and_get_paid"
            ? "Delivering research & collecting payment…"
            : ev.name === "repay"
              ? `Repaying $${ev.args?.amountUsdc ?? "?"}…`
              : ev.name;
    return (
      <div className="flex items-center gap-2 pl-[26px] font-tl-mono text-[11px] text-ash">
        <Loader2 size={12} className="animate-spin" />
        {label}
      </div>
    );
  }

  if (ev.type === "tool_result") {
    return <ToolResult name={ev.name} result={ev.result} />;
  }

  if (ev.type === "error") {
    return <p className="font-tl-mono text-xs text-flare">error: {ev.message}</p>;
  }

  return null;
}

function ToolResult({ name, result }: { name: string; result: any }) {
  if (!result || result.error) {
    return (
      <p className="pl-[26px] font-tl-mono text-[11px] text-flare">
        {name}: {result?.error ?? "failed"}
      </p>
    );
  }

  if (name === "check_credit") {
    return (
      <div className="ml-[26px] rounded-lg border border-white/10 bg-obsidian/70 p-3">
        <div className="mb-2 flex items-center gap-2 font-tl-mono text-[11px] text-ion">
          <Wallet size={13} /> WALLET & CREDIT
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-tl-mono text-[11px] text-ash">
          <Stat label="cash balance" value={`$${result.balanceUsdc}`} />
          <Stat label="available credit" value={`$${result.availableCreditUsdc}`} />
          {result.tier != null ? <Stat label="tier" value={String(result.tier)} /> : null}
          {result.rampedLimitUsdc != null ? (
            <Stat label="usable limit" value={`$${result.rampedLimitUsdc}`} />
          ) : null}
          {result.aprBps != null ? (
            <Stat label="APR" value={`${(result.aprBps / 100).toFixed(1)}%`} />
          ) : null}
          {result.distinctPayers != null ? (
            <Stat label="payers" value={String(result.distinctPayers)} />
          ) : null}
        </div>
      </div>
    );
  }

  if (name === "buy_premium_data") {
    return (
      <div className="ml-[26px] rounded-lg border border-nectar/20 bg-obsidian/70 p-3">
        <div className="mb-2 flex items-center gap-2 font-tl-mono text-[11px] text-nectar">
          <CreditCard size={13} /> PAID FOR DATA · ${result.pricePaidUsdc}
          {result.drewCredit ? (
            <span className="rounded bg-nectar/15 px-1.5 py-0.5 text-nectar">
              drew ${result.creditDrawnUsdc} credit
            </span>
          ) : (
            <span className="text-ash">paid from cash</span>
          )}
        </div>
        {result.txHash ? <TxLink label="payment / borrow" hash={result.txHash} /> : null}
      </div>
    );
  }

  if (name === "deliver_and_get_paid") {
    return (
      <div className="ml-[26px] rounded-lg border border-ion/25 bg-obsidian/70 p-3">
        <div className="mb-1.5 flex items-center gap-2 font-tl-mono text-[11px] text-ion">
          <Wallet size={13} /> CUSTOMER PAID ${result.revenueUsdc} · job revenue
        </div>
        {result.txHash ? <TxLink label="customer payment" hash={result.txHash} /> : null}
      </div>
    );
  }

  if (name === "repay") {
    if (result.repaid === false) {
      return (
        <p className="ml-[26px] font-tl-mono text-[11px] text-ash">
          repay deferred — {result.reason}
        </p>
      );
    }
    return (
      <div className="ml-[26px] rounded-lg border border-white/10 bg-obsidian/70 p-3">
        <div className="mb-1.5 flex items-center gap-2 font-tl-mono text-[11px] text-ion">
          <CheckCircle2 size={13} /> REPAID ${result.repaidUsdc}
        </div>
        {result.txHash ? <TxLink label="repayment" hash={result.txHash} /> : null}
      </div>
    );
  }

  return null;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-ash/70">{label}</span>
      <span className="text-bone">{value}</span>
    </div>
  );
}

function TxLink({ label, hash }: { label: string; hash: string }) {
  return (
    <a
      href={EXPLORER(hash)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 font-tl-mono text-[11px] text-ion hover:text-nectar"
    >
      {label}: {hash.slice(0, 8)}…{hash.slice(-6)}
      <ExternalLink size={11} />
    </a>
  );
}

function short(a: string) {
  return a ? `${a.slice(0, 4)}…${a.slice(-4)}` : "";
}
