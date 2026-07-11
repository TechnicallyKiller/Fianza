"use client";

// Lender — TrustLine.dc.html isolated-vaults screen. Wired to the live
// /agents API (same data as before this redesign) + the real deposit
// contract call. No simulated/fake numbers: "your positions" stays an
// honest gated note since the frontend doesn't yet read per-lender vault
// shares on-chain — same as before, restyled.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, AlertTriangle, Info } from "lucide-react";
import TLShell from "@/components/tl/TLShell";
import { useWallet } from "@/components/WalletProvider";
import { invokeContract, sc, STELLAR_EXPERT_TX } from "@/lib/stellar";
import {
  api,
  aprPct,
  usdc,
  shortAddr,
  tierLabel,
  type AgentSummary,
  type Tier,
} from "@/lib/api";

const riskColor: Record<Tier, string> = {
  A: "#58F0C8",
  B: "#FFB020",
  C: "#FF5C4D",
  Unrated: "#5a635e",
};

export default function LenderDashboard() {
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.agents();
      setAgents(list);
      setSelected((cur) => cur ?? (list[0]?.agent ?? null));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selectedAgent = useMemo(
    () => agents.find((a) => a.agent === selected) ?? null,
    [agents, selected],
  );

  const totalCredit = agents.reduce((s, a) => s + a.limitUsdc, 0);
  const rated = agents.filter((a) => a.aprBps > 0);
  const avgApr = rated.length ? rated.reduce((s, a) => s + a.aprBps, 0) / rated.length : 0;

  return (
    <TLShell>
      <main className="mx-auto w-full max-w-[1240px] px-[30px] pb-20 pt-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 font-tl-mono text-[11px] tracking-[0.2em] text-ion">
              / LENDER · ISOLATED VAULTS
            </div>
            <h1 className="font-tl-serif text-2xl tracking-[-0.01em] text-bone sm:text-[32px]">
              Supply capital to <span className="italic text-nectar">agents that earn.</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 font-tl-mono text-[11px] text-[#5a635e]">
              <span className="tl-anim-blink h-[7px] w-[7px] rounded-full bg-ion shadow-[0_0_8px_#58F0C8]" />
              live · from /agents
            </span>
            <button
              onClick={refresh}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-1.5 font-tl-mono text-xs text-ash transition-colors hover:text-bone disabled:opacity-60"
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              Refresh
            </button>
          </div>
        </div>

        {error ? (
          <div className="mb-6 flex items-start gap-2 rounded-lg border border-flare/30 bg-flare/10 p-3 font-tl-mono text-xs text-flare">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {/* stats */}
        <div className="mb-8 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          <StatCard label="AGENTS UNDERWRITTEN" value={String(agents.length)} />
          <StatCard label="TOTAL CREDIT AVAILABLE" value={usdc(totalCredit)} />
          <StatCard label="AVERAGE APR" value={avgApr ? aprPct(avgApr) : "—"} color="#58F0C8" />
          <StatCard label="YOUR DEPOSITS" value="—" note="on-chain, per-vault (see below)" />
        </div>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_380px]">
          {/* agent table */}
          <div>
            <div className="mb-3.5 font-tl-mono text-[10px] tracking-[0.16em] text-ash">
              AGENTS SEEKING CREDIT
            </div>
            <div className="mb-2 hidden grid-cols-[minmax(0,1.6fr)_60px_84px_58px_74px] gap-3.5 border-b border-white/[0.06] px-4 pb-2.5 font-tl-mono text-[9px] tracking-[0.08em] text-[#5a635e] sm:grid">
              <span>AGENT</span>
              <span>TIER</span>
              <span className="text-right">REVENUE</span>
              <span className="text-right">APR</span>
              <span className="text-right">LINE</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {loading && agents.length === 0 ? (
                <div className="flex justify-center py-10">
                  <Loader2 size={18} className="animate-spin text-ash" />
                </div>
              ) : agents.length === 0 ? (
                <div className="rounded-lg border border-white/[0.06] px-4 py-10 text-center font-tl-mono text-xs text-ash">
                  No agents underwritten yet. Underwrite one from /underwrite, then refresh.
                </div>
              ) : (
                agents.map((a, i) => {
                  const active = a.agent === selected;
                  const tc = riskColor[a.tier];
                  return (
                    <div
                      key={a.agent}
                      onClick={() => setSelected(a.agent)}
                      className="tl-anim-fadeup grid cursor-pointer grid-cols-2 items-center gap-3.5 rounded-[10px] border px-4 py-3.5 transition-colors sm:grid-cols-[minmax(0,1.6fr)_60px_84px_58px_74px]"
                      style={{
                        animationDelay: `${Math.min(i, 10) * 0.04}s`,
                        background: active ? "rgba(88,240,200,.06)" : "transparent",
                        borderColor: active ? "rgba(88,240,200,.4)" : "rgba(244,241,233,.06)",
                      }}
                    >
                      <div className="col-span-2 flex min-w-0 items-center gap-2.5 sm:col-span-1">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: tc, boxShadow: `0 0 8px ${tc}` }}
                        />
                        <span className="truncate font-tl-mono text-xs text-bone" title={a.agent}>
                          {shortAddr(a.agent)}
                        </span>
                      </div>
                      <span
                        className="w-fit justify-self-start whitespace-nowrap rounded-[5px] border px-1.5 py-0.5 font-tl-mono text-[9px] font-bold"
                        style={{ color: tc, borderColor: `${tc}55` }}
                      >
                        {tierLabel(a.tier)}
                      </span>
                      <span className="text-right font-tl-mono text-xs text-bone">{usdc(a.revenueUsdc)}</span>
                      <span className="text-right font-tl-mono text-xs text-ash">
                        {a.aprBps ? aprPct(a.aprBps) : "—"}
                      </span>
                      <span className="text-right font-tl-mono text-xs text-ash">{usdc(a.limitUsdc)}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* detail / supply */}
          <div className="sticky top-[78px]">
            <AgentDetail agent={selectedAgent} />
          </div>
        </div>

        {/* positions (honest, gated) */}
        <div className="mt-14 border-t border-white/[0.07] pt-8">
          <h2 className="mb-3 font-tl-mono text-[10px] tracking-[0.16em] text-ash">YOUR POSITIONS</h2>
          <div className="flex items-center gap-3 rounded-lg border border-white/[0.07] bg-obsidian/60 p-4 font-tl-mono text-xs text-ash">
            <Info size={15} className="shrink-0 text-ion" />
            Deposits are live on-chain per isolated vault. A dashboard reading
            your own vault shares back out isn&apos;t wired up yet — check a
            deposit&apos;s tx on Stellar Expert after depositing below.
          </div>
        </div>
      </main>
    </TLShell>
  );
}

// ---- sub-components ----

function StatCard({ label, value, color, note }: { label: string; value: string; color?: string; note?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-obsidian/60 p-[18px]">
      <div className="mb-3 font-tl-mono text-[9px] tracking-[0.12em] text-ash">{label}</div>
      <div className="font-tl-sans text-2xl font-bold" style={{ color: color ?? "#F4F1E9" }}>
        {value}
      </div>
      {note ? <div className="mt-1 font-tl-mono text-[10px] text-[#5a635e]">{note}</div> : null}
    </div>
  );
}

function AgentDetail({ agent }: { agent: AgentSummary | null }) {
  const { config } = useWallet();
  const vaultDeployed = !!config?.lendingVaultContractId;

  if (!agent) {
    return (
      <div className="rounded-[14px] border border-white/[0.08] bg-obsidian/60 p-6 font-tl-mono text-xs text-ash">
        Select an agent to see its underwriting detail and supply liquidity.
      </div>
    );
  }

  const tc = riskColor[agent.tier];

  return (
    <div className="overflow-hidden rounded-[14px] border border-ion/[0.16] bg-obsidian/70">
      <div className="flex items-start justify-between border-b border-white/[0.07] p-[22px]">
        <div className="flex items-center gap-3">
          <div
            className="h-9 w-9 rounded-[9px] border border-white/10"
            style={{ background: `linear-gradient(135deg,${tc},#060908)` }}
          />
          <div>
            <div className="font-tl-mono text-sm font-bold text-bone" title={agent.agent}>
              {shortAddr(agent.agent)}
            </div>
            <div className="font-tl-mono text-[10px] text-[#5a635e]">
              underwritten {new Date(agent.underwroteAt * 1000).toLocaleDateString()}
            </div>
          </div>
        </div>
        <span
          className="whitespace-nowrap rounded-md border px-2 py-1 font-tl-mono text-[10px] font-bold"
          style={{ color: tc, borderColor: `${tc}55` }}
        >
          {tierLabel(agent.tier)}
        </span>
      </div>

      <div className="border-b border-white/[0.07] p-5">
        <div className="mb-3.5 font-tl-mono text-[9px] tracking-[0.14em] text-ash">UNDERWRITING</div>
        <div className="flex flex-col gap-2.5 font-tl-mono text-xs">
          <DetailRow label="Credit score" value={String(agent.score)} />
          <DetailRow label="Verified revenue" value={`${usdc(agent.revenueUsdc)} USDC`} />
          <DetailRow label="Credit line" value={`${usdc(agent.limitUsdc)} USDC`} color="#FFB020" />
          <DetailRow label="Offered APR" value={agent.aprBps ? aprPct(agent.aprBps) : "—"} />
          <DetailRow label="Distinct counterparties" value={String(agent.distinctPayers)} />
        </div>
      </div>

      <div className="p-5">
        <div className="mb-4 flex items-baseline justify-between">
          <span className="font-tl-mono text-[9px] tracking-[0.14em] text-ash">SUPPLY LIQUIDITY</span>
        </div>
        {vaultDeployed ? (
          <DepositBox agentAddress={agent.agent} hasLine={agent.limitUsdc > 0} />
        ) : (
          <div className="rounded-lg border border-nectar/20 bg-nectar/10 p-3 text-center font-tl-mono text-xs text-nectar">
            Deposits open once the lending vault is deployed to testnet.
          </div>
        )}
      </div>
    </div>
  );
}

function DepositBox({ agentAddress, hasLine }: { agentAddress: string; hasLine: boolean }) {
  const { address, config } = useWallet();
  const [amount, setAmount] = useState("5");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tx, setTx] = useState<string | null>(null);

  const deposit = async () => {
    if (!address || !config?.lendingVaultContractId) return;
    setBusy(true);
    setErr(null);
    setTx(null);
    try {
      const r = await invokeContract({
        contractId: config.lendingVaultContractId,
        method: "deposit",
        args: [
          sc.address(address),
          sc.address(agentAddress),
          sc.i128(BigInt(Math.round(Number(amount || "0") * 1e7))),
        ],
        publicKey: address,
      });
      setTx(r.txHash);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="relative">
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          className="w-full rounded-md border border-nectar/30 bg-void px-4 py-3 pr-14 text-right font-tl-mono text-sm text-bone outline-none transition-colors focus:border-nectar"
        />
        <span className="absolute right-4 top-3 font-tl-mono text-xs text-ash">USDC</span>
      </div>
      <button
        onClick={deposit}
        disabled={!address || !hasLine || busy}
        className="rounded-lg bg-nectar py-3.5 font-tl-sans text-sm font-semibold text-obsidian transition-colors hover:bg-ion disabled:opacity-50"
      >
        {!address ? "Connect wallet to deposit" : busy ? "Depositing…" : "Supply USDC →"}
      </button>
      <div className="flex gap-2">
        {[1000, 5000, 25000].map((v) => (
          <button
            key={v}
            onClick={() => setAmount(String(v))}
            className="flex-1 rounded-md border border-white/[0.12] py-2 font-tl-mono text-[11px] text-ash transition-colors hover:text-bone"
          >
            ${v / 1000}k
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-center font-tl-mono text-[10px] italic leading-[1.6] text-[#5a635e]">
        Isolated risk · if this agent defaults, only this vault is impaired —
        never the pool.
      </p>
      {tx ? (
        <a
          href={STELLAR_EXPERT_TX(tx)}
          target="_blank"
          rel="noreferrer"
          className="block text-center font-tl-mono text-xs text-ion/80 hover:text-ion"
        >
          deposited · {tx.slice(0, 8)}… ↗
        </a>
      ) : null}
      {err ? <p className="break-words text-center font-tl-mono text-xs text-flare">{err}</p> : null}
      {!hasLine && address ? (
        <p className="text-center font-tl-mono text-[10px] text-flare">
          No vault opens until the model can verify independent revenue.
        </p>
      ) : null}
    </div>
  );
}

function DetailRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ash">{label}</span>
      <span style={{ color: color ?? "#F4F1E9" }}>{value}</span>
    </div>
  );
}
