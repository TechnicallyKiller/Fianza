"use client";

// /status — live service health. Pings each TrustLine service (and the Soroban
// RPC) and shows real up/down, not a claim. Refreshes on an interval. This is
// proof the stack is live, the honest way.

import { useCallback, useEffect, useState } from "react";
import TLNav from "@/components/tl/TLNav";
import { CheckCircle2, XCircle, Loader2, RefreshCw } from "lucide-react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://trustline-rpxt.onrender.com";
const AGENT_SERVER =
  process.env.NEXT_PUBLIC_AGENT_SERVER ?? "https://trustline-1.onrender.com";
const DATA_SELLER =
  process.env.NEXT_PUBLIC_DATA_SELLER ?? "https://trustline-data-seller.onrender.com";
const SOROBAN_RPC = "https://soroban-testnet.stellar.org";

type State = "up" | "down" | "checking";

interface Svc {
  key: string;
  name: string;
  desc: string;
  check: () => Promise<boolean>;
}

// Each check resolves true if the service answered OK. Kept forgiving: a
// service that 200s on any of its known endpoints counts as up.
const SERVICES: Svc[] = [
  {
    key: "backend",
    name: "Underwriting API",
    desc: "Scores agents, publishes on-chain, seeds vault liquidity",
    check: () => fetch(`${API_BASE}/health`, { cache: "no-store" }).then((r) => r.ok),
  },
  {
    key: "portfolio",
    name: "Credit book",
    desc: "Live on-chain portfolio / risk view",
    check: () => fetch(`${API_BASE}/portfolio`, { cache: "no-store" }).then((r) => r.ok),
  },
  {
    key: "agent",
    name: "Autonomous agent",
    desc: "The LLM-driven demo agent (borrow → earn → repay)",
    check: () => fetch(`${AGENT_SERVER}/info`, { cache: "no-store" }).then((r) => r.ok),
  },
  {
    key: "seller",
    name: "x402 data seller",
    desc: "The paid capability the agent buys from",
    check: () => fetch(`${DATA_SELLER}/health`, { cache: "no-store" }).then((r) => r.ok),
  },
  {
    key: "rpc",
    name: "Soroban RPC (testnet)",
    desc: "Stellar testnet — where the contracts live",
    check: () =>
      fetch(SOROBAN_RPC, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getHealth" }),
        cache: "no-store",
      })
        .then((r) => r.json())
        .then((j) => j?.result?.status === "healthy")
        .catch(() => false),
  },
];

export default function StatusPage() {
  const [states, setStates] = useState<Record<string, State>>(
    Object.fromEntries(SERVICES.map((s) => [s.key, "checking"])),
  );
  const [lastChecked, setLastChecked] = useState<string>("");
  const [refreshing, setRefreshing] = useState(false);

  const runChecks = useCallback(async () => {
    setRefreshing(true);
    setStates((prev) => {
      const n = { ...prev };
      for (const s of SERVICES) n[s.key] = "checking";
      return n;
    });
    await Promise.all(
      SERVICES.map(async (s) => {
        let up = false;
        try {
          up = await s.check();
        } catch {
          up = false;
        }
        setStates((prev) => ({ ...prev, [s.key]: up ? "up" : "down" }));
      }),
    );
    setLastChecked(new Date().toLocaleTimeString());
    setRefreshing(false);
  }, []);

  useEffect(() => {
    runChecks();
    const t = setInterval(runChecks, 30000);
    return () => clearInterval(t);
  }, [runChecks]);

  const values = Object.values(states);
  const allUp = values.every((v) => v === "up");
  const anyDown = values.some((v) => v === "down");
  const overall: State = values.some((v) => v === "checking")
    ? "checking"
    : allUp
      ? "up"
      : "down";

  return (
    <div className="tl-select relative min-h-screen bg-obsidian text-bone">
      <TLNav />
      <div className="tl-grain relative mx-auto w-full max-w-[820px] px-6 py-16 md:px-10">
        <div className="tl-anim-fadeup">
          <div className="mb-3 font-tl-mono text-[11px] tracking-[0.22em] text-ion">
            / SYSTEM STATUS
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="font-tl-serif text-[min(6vw,40px)] font-normal leading-[1.08] tracking-[-0.02em]">
              {overall === "checking" ? (
                <>Checking services…</>
              ) : allUp ? (
                <>All systems <span className="italic text-ion">operational</span>.</>
              ) : (
                <>Some services <span className="italic text-flare">degraded</span>.</>
              )}
            </h1>
            <button
              onClick={runChecks}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 font-tl-mono text-[11px] text-ash transition-colors hover:border-ion/40 disabled:opacity-50"
            >
              <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
              refresh
            </button>
          </div>
          <p className="mt-3 font-tl-mono text-[11px] text-ash">
            Live health of every TrustLine service on Stellar testnet.
            {lastChecked ? ` Last checked ${lastChecked}.` : ""}
          </p>
        </div>

        {/* overall banner */}
        <div
          className={`mt-8 flex items-center gap-3 rounded-xl border p-4 ${
            overall === "up"
              ? "border-ion/25 bg-ion/[0.06]"
              : overall === "down"
                ? "border-flare/30 bg-flare/[0.06]"
                : "border-white/[0.08] bg-void/50"
          }`}
        >
          <StatusIcon state={overall} big />
          <div>
            <div className="font-tl-sans text-sm font-semibold text-bone">
              {overall === "checking"
                ? "Pinging services…"
                : allUp
                  ? "Everything is live"
                  : anyDown
                    ? "One or more services are down"
                    : "Status unknown"}
            </div>
            <div className="font-tl-mono text-[11px] text-ash">
              Free-tier services can sleep after idle — a “down” may just be a cold
              start; hit refresh.
            </div>
          </div>
        </div>

        {/* per-service list */}
        <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.08] bg-void/50">
          {SERVICES.map((s, i) => (
            <div
              key={s.key}
              className={`flex items-center justify-between gap-4 px-4 py-4 ${
                i < SERVICES.length - 1 ? "border-b border-white/[0.05]" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <StatusIcon state={states[s.key]} />
                <div>
                  <div className="font-tl-sans text-sm text-bone">{s.name}</div>
                  <div className="font-tl-mono text-[10px] text-ash/70">{s.desc}</div>
                </div>
              </div>
              <span
                className={`font-tl-mono text-[11px] ${
                  states[s.key] === "up"
                    ? "text-ion"
                    : states[s.key] === "down"
                      ? "text-flare"
                      : "text-ash"
                }`}
              >
                {states[s.key] === "up"
                  ? "operational"
                  : states[s.key] === "down"
                    ? "down"
                    : "checking…"}
              </span>
            </div>
          ))}
        </div>

        <p className="mt-6 font-tl-mono text-[10px] leading-relaxed text-ash/60">
          This page pings each service directly from your browser — the results
          are real, not cached claims. Contracts live on Stellar testnet:
          score registry, credit line, lending vault.
        </p>
      </div>
    </div>
  );
}

function StatusIcon({ state, big }: { state: State; big?: boolean }) {
  const size = big ? 22 : 17;
  if (state === "checking") return <Loader2 size={size} className="animate-spin text-ash" />;
  if (state === "up") return <CheckCircle2 size={size} className="text-ion" />;
  return <XCircle size={size} className="text-flare" />;
}
