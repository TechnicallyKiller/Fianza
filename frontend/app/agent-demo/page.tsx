"use client";

// /agent-demo — the autonomous agent, live. A real LLM (free Groq by default)
// reasons in the chat; when it's short on cash it draws TrustLine credit on a
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
} from "lucide-react";

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
  llm: { model: string; hasKey: boolean };
}

const SUGGESTIONS = [
  "Give me a research note on XLM.",
  "What's driving demand for AI compute right now?",
  "Research Bitcoin's key risks this quarter.",
];

export default function AgentDemoPage() {
  const [info, setInfo] = useState<Info | null>(null);
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${AGENT_SERVER}/info`)
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => setError("Can't reach the agent server. Is agent-server.mjs running?"));
  }, []);

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
        {/* hero */}
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-4 font-tl-mono text-[11px] tracking-[0.22em] text-ion">
            / DEMO · THE AUTONOMOUS AGENT
          </div>
          <h1 className="font-tl-serif text-[min(6.5vw,46px)] font-normal leading-[1.06] tracking-[-0.02em]">
            An AI agent that{" "}
            <span className="italic text-nectar">borrows to earn</span> — and
            decides on its own.
          </h1>
          <p className="mx-auto mt-4 max-w-xl font-tl-sans text-sm leading-[1.7] text-ash">
            Ask it for research. To answer well it must buy a paid data call it
            may not be able to afford. Watch a real model reason, draw TrustLine
            credit on a live testnet transaction, deliver, and repay. Every
            money-move is clickable and real.
          </p>
          {info ? (
            <p className="mt-3 font-tl-mono text-[11px] text-ash">
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
              <EventRow key={i} ev={ev} />
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

        <p className="mt-6 text-center font-tl-mono text-[11px] leading-relaxed text-ash/70">
          Spend-to-earn, not speculation: the agent only borrows to buy an input
          for paid work, then repays from the payout. Underwritten against its
          own on-chain revenue.
        </p>
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
