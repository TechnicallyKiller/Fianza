"use client";

// /status — live service health. Calls our OWN same-origin /api/status, which
// pings each service server-side. Same-origin means privacy browsers (Brave
// Shields, Firefox strict, ad-blockers) never block it — the earlier version
// pinged *.onrender.com directly from the browser and Brave blocked those as
// third-party requests, showing a false "down." This is the robust fix.

import { useCallback, useEffect, useState } from "react";
import TLNav from "@/components/tl/TLNav";
import { CheckCircle2, XCircle, Loader2, RefreshCw } from "lucide-react";

type State = "up" | "down" | "checking";

const SERVICES = [
  { key: "backend", name: "Underwriting API", desc: "Scores agents, publishes on-chain, seeds vault liquidity" },
  { key: "portfolio", name: "Credit book", desc: "Live on-chain portfolio / risk view" },
  { key: "agent", name: "Autonomous agent", desc: "The LLM-driven demo agent (borrow → earn → repay)" },
  { key: "seller", name: "x402 data seller", desc: "The paid capability the agent buys from" },
  { key: "rpc", name: "Soroban RPC (testnet)", desc: "Stellar testnet — where the contracts live" },
];

export default function StatusPage() {
  const [states, setStates] = useState<Record<string, State>>(
    Object.fromEntries(SERVICES.map((s) => [s.key, "checking"])),
  );
  const [lastChecked, setLastChecked] = useState<string>("");
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runChecks = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    setStates((prev) => Object.fromEntries(SERVICES.map((s) => [s.key, "checking"])) as Record<string, State>);
    try {
      // Same-origin, cache-busted — no cross-origin request the browser can block.
      const res = await fetch(`/api/status?_=${Date.now()}`, { cache: "no-store" });
      const data = (await res.json()) as { services: Record<string, boolean> };
      setStates(
        Object.fromEntries(
          SERVICES.map((s) => [s.key, data.services?.[s.key] ? "up" : "down"]),
        ) as Record<string, State>,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStates(Object.fromEntries(SERVICES.map((s) => [s.key, "down"])) as Record<string, State>);
    }
    setLastChecked(new Date().toLocaleTimeString());
    setRefreshing(false);
  }, []);

  useEffect(() => {
    runChecks();
    const t = setInterval(runChecks, 45000);
    return () => clearInterval(t);
  }, [runChecks]);

  const values = Object.values(states);
  const allUp = values.length > 0 && values.every((v) => v === "up");
  const anyDown = values.some((v) => v === "down");
  const anyBusy = values.some((v) => v === "checking");
  const overall: State = anyBusy ? "checking" : allUp ? "up" : "down";

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
            Live health of every TrustLine service on Stellar testnet, checked
            server-side.{lastChecked ? ` Last checked ${lastChecked}.` : ""}
          </p>
        </div>

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
                    ? "One or more services are waking or down"
                    : "Status unknown"}
            </div>
            <div className="font-tl-mono text-[11px] text-ash">
              Free-tier services can sleep after idle — a “down” may be a cold
              start; hit refresh.
            </div>
          </div>
        </div>

        {error ? (
          <p className="mt-3 font-tl-mono text-xs text-flare">status check error: {error}</p>
        ) : null}

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
          Checks run server-side (same-origin /api/status) so privacy browsers
          and ad-blockers can’t false-flag them. Contracts live on Stellar
          testnet: score registry, credit line, lending vault.
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
