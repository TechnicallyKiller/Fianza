"use client";

// Lender (liquidity provider) dashboard — wired to the live Phase-2 API.
// Design: screens/lending.html + screens/lending.png.
//
// Live now: the underwritten-agents table and per-agent underwriting detail
// (GET /agents), plus protocol-level aggregates derived from it.
// Gated on Phase-4 deploy: depositing into an isolated vault and lender
// positions/exposure/yield (these are on-chain vault state — no contract yet).

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, AlertTriangle, Info } from "lucide-react";
import DashboardChrome from "@/components/DashboardChrome";
import { useWallet } from "@/components/WalletProvider";
import { invokeContract, sc } from "@/lib/stellar";
import {
  api,
  aprPct,
  usdc,
  shortAddr,
  tierLabel,
  type AgentSummary,
  type Tier,
} from "@/lib/api";

const riskByTier: Record<Tier, string> = {
  A: "bg-secondary shadow-[0_0_8px_rgba(78,222,163,0.6)]",
  B: "bg-tertiary shadow-[0_0_8px_rgba(255,185,95,0.6)]",
  C: "bg-error shadow-[0_0_8px_rgba(255,180,171,0.6)]",
  Unrated: "bg-outline",
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

  // Protocol-level aggregates that are genuinely available from /agents.
  const totalCredit = agents.reduce((s, a) => s + a.limitUsdc, 0);
  const rated = agents.filter((a) => a.aprBps > 0);
  const avgApr = rated.length
    ? rated.reduce((s, a) => s + a.aprBps, 0) / rated.length
    : 0;

  return (
    <DashboardChrome active="Liquidity">
      <main className="mx-auto w-full max-w-[1440px] flex-1 space-y-stack-lg px-gutter py-stack-lg">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg">
              Lender Dashboard
            </h1>
            <p className="mt-2 font-body-md text-body-md text-on-surface-variant">
              Browse revenue-underwritten agents and supply liquidity to isolated
              vaults.
            </p>
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md border border-outline-variant bg-surface-container px-3 py-1.5 font-body-sm text-on-surface-variant transition-colors hover:text-on-surface disabled:opacity-60"
          >
            {loading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            Refresh
          </button>
        </div>

        {error ? (
          <div className="flex items-start gap-2 rounded-lg border border-error/30 bg-error/10 p-3 font-body-sm text-error">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {/* Summary cards */}
        <div className="grid grid-cols-1 gap-stack-md md:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="Agents Underwritten" value={String(agents.length)} />
          <SummaryCard
            label="Total Credit Available"
            value={usdc(totalCredit)}
            unit="USDC"
          />
          <SummaryCard
            label="Average APR"
            value={avgApr ? aprPct(avgApr) : "—"}
            accent
          />
          <SummaryCard label="Your Deposits" value="—" gated />
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 gap-stack-lg lg:grid-cols-12">
          {/* Agents table */}
          <div className="space-y-stack-md lg:col-span-8">
            <h2 className="font-headline-md text-headline-md">
              Agents seeking credit
            </h2>
            <div className="glass-panel overflow-hidden rounded-lg">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-outline-variant/50 bg-surface-container-low/50">
                      <Th>Agent</Th>
                      <Th>Tier</Th>
                      <Th right>Verified Rev</Th>
                      <Th right>Credit Line</Th>
                      <Th right>APR</Th>
                      <Th center>Risk</Th>
                      <Th right>Action</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/30 font-data-md text-data-md">
                    {loading && agents.length === 0 ? (
                      <EmptyRow>
                        <Loader2 size={16} className="mx-auto animate-spin" />
                      </EmptyRow>
                    ) : agents.length === 0 ? (
                      <EmptyRow>
                        No agents underwritten yet. Underwrite one from the
                        borrower dashboard, then refresh.
                      </EmptyRow>
                    ) : (
                      agents.map((a) => {
                        const active = a.agent === selected;
                        return (
                          <tr
                            key={a.agent}
                            onClick={() => setSelected(a.agent)}
                            className={`cursor-pointer transition-colors hover:bg-surface-variant/30 ${active ? "bg-primary/5" : ""}`}
                          >
                            <td className="flex items-center gap-3 p-4">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-outline-variant bg-gradient-to-br from-primary to-surface-container">
                                <div className="h-3 w-3 rotate-45 rounded-sm bg-surface" />
                              </div>
                              <span title={a.agent}>{shortAddr(a.agent)}</span>
                            </td>
                            <td className="p-4">
                              <span className="rounded border border-outline-variant bg-surface-container px-2 py-1 text-xs">
                                {tierLabel(a.tier)}
                              </span>
                            </td>
                            <td className="p-4 text-right">{usdc(a.revenueUsdc)}</td>
                            <td className="p-4 text-right">{usdc(a.limitUsdc)}</td>
                            <td className="p-4 text-right text-secondary">
                              {a.aprBps ? aprPct(a.aprBps) : "—"}
                            </td>
                            <td className="p-4 text-center">
                              <div
                                className={`mx-auto h-2 w-2 rounded-full ${riskByTier[a.tier]}`}
                                title={tierLabel(a.tier)}
                              />
                            </td>
                            <td className="p-4 text-right">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelected(a.agent);
                                }}
                                className="rounded border border-outline bg-transparent px-4 py-1.5 font-body-sm text-on-surface transition-colors hover:border-primary"
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Agent details / deposit box */}
          <div className="space-y-stack-md lg:col-span-4">
            <h2 className="select-none font-headline-md text-headline-md text-transparent">
              _
            </h2>
            <AgentDetail agent={selectedAgent} />
          </div>
        </div>

        {/* Positions (gated) */}
        <div className="space-y-stack-md border-t border-outline-variant/30 pt-stack-md">
          <h2 className="font-headline-md text-headline-md">Your positions</h2>
          <div className="glass-panel flex items-center gap-3 rounded-lg p-card-padding font-body-sm text-on-surface-variant">
            <Info size={16} className="shrink-0 text-primary" />
            Your isolated-vault positions, exposure, and realized yield appear
            here once the lending vault is deployed to testnet (Phase 4).
          </div>
        </div>
      </main>
    </DashboardChrome>
  );
}

// ---- Sub-components ----

function AgentDetail({ agent }: { agent: AgentSummary | null }) {
  const { config, address } = useWallet();
  const vaultDeployed = !!config?.lendingVaultContractId;

  if (!agent) {
    return (
      <div className="glass-panel rounded-lg p-card-padding font-body-sm text-on-surface-variant">
        Select an agent to see its underwriting detail and supply liquidity.
      </div>
    );
  }

  return (
    <div className="glass-panel relative flex flex-col gap-stack-md overflow-hidden rounded-lg p-card-padding">
      <div className="pointer-events-none absolute right-0 top-0 -mr-16 -mt-16 h-32 w-32 rounded-full bg-primary/5 blur-3xl" />
      <div className="flex items-center gap-3 border-b border-outline-variant/50 pb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant bg-gradient-to-br from-primary to-surface-container">
          <div className="h-4 w-4 rotate-45 rounded-sm bg-surface" />
        </div>
        <div>
          <h3 className="font-body-md font-semibold">Agent Details</h3>
          <p className="font-data-md text-on-surface-variant" title={agent.agent}>
            {shortAddr(agent.agent)}
          </p>
        </div>
        <span className="ml-auto rounded border border-primary/20 bg-primary/10 px-2 py-1 font-label-caps text-label-caps text-primary">
          {tierLabel(agent.tier)}
        </span>
      </div>

      <div className="space-y-4">
        <h4 className="font-label-caps text-label-caps uppercase text-on-surface-variant">
          Underwriting
        </h4>
        <div className="space-y-3 rounded border border-outline-variant/30 bg-surface-container-low p-4">
          <DetailRow label="Credit Score" value={String(agent.score)} />
          <DetailRow
            label="Verified Revenue"
            value={`${usdc(agent.revenueUsdc)} USDC`}
          />
          <DetailRow
            label="Credit Line"
            value={`${usdc(agent.limitUsdc)} USDC`}
          />
          <DetailRow
            label="Offered APR"
            value={agent.aprBps ? aprPct(agent.aprBps) : "—"}
            accent
          />
          <DetailRow
            label="Distinct Counterparties"
            value={String(agent.distinctPayers)}
          />
          <DetailRow
            label="Underwritten"
            value={new Date(agent.underwroteAt * 1000).toLocaleDateString()}
          />
        </div>
      </div>

      {/* Deposit box (gated until the vault is deployed in Phase 4) */}
      <div className="space-y-4 border-t border-outline-variant/50 pt-2">
        <h4 className="font-label-caps text-label-caps uppercase text-on-surface-variant">
          Supply liquidity
        </h4>
        <p className="px-1 text-center font-body-sm text-xs italic text-on-surface-variant/70">
          Isolated vault — you are exposed only to this agent&apos;s default risk.
        </p>
        {vaultDeployed ? (
          <DepositBox agentAddress={agent.agent} hasLine={agent.limitUsdc > 0} />
        ) : (
          <div className="rounded border border-tertiary/20 bg-tertiary-container/10 p-3 text-center font-body-sm text-tertiary">
            Deposits open once the lending vault is deployed to testnet (Phase 4).
          </div>
        )}
      </div>
    </div>
  );
}

function DepositBox({
  agentAddress,
  hasLine,
}: {
  agentAddress: string;
  hasLine: boolean;
}) {
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
    <div className="space-y-3">
      <div className="relative">
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          className="w-full rounded-md border border-outline-variant bg-surface px-4 py-3 pr-16 text-right font-data-md text-data-md text-on-surface transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <span className="absolute right-4 top-3 font-body-sm text-on-surface-variant">
          USDC
        </span>
      </div>
      <button
        onClick={deposit}
        disabled={!address || !hasLine || busy}
        className="shimmer-btn mt-1 w-full rounded-md bg-primary py-3 font-semibold text-surface shadow-[0_0_15px_rgba(173,198,255,0.15)] transition-shadow hover:shadow-[0_0_20px_rgba(173,198,255,0.25)] disabled:opacity-60"
      >
        {!address
          ? "Connect wallet to deposit"
          : busy
            ? "Depositing…"
            : "Deposit into isolated vault"}
      </button>
      {tx ? (
        <a
          href={`https://stellar.expert/explorer/testnet/tx/${tx}`}
          target="_blank"
          rel="noreferrer"
          className="block text-center font-data-md text-xs text-primary/80 hover:text-primary"
        >
          deposited · {tx.slice(0, 8)}… ↗
        </a>
      ) : null}
      {err ? (
        <p className="break-words text-center font-body-sm text-xs text-error">
          {err}
        </p>
      ) : null}
    </div>
  );
}

function DetailRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-body-sm text-on-surface-variant">{label}</span>
      <span className={`font-data-md text-sm ${accent ? "text-secondary" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  unit,
  accent,
  gated,
}: {
  label: string;
  value: string;
  unit?: string;
  accent?: boolean;
  gated?: boolean;
}) {
  return (
    <div className="glass-panel flex flex-col gap-2 rounded-lg p-card-padding">
      <span className="font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant">
        {label}
      </span>
      <span
        className={`font-data-lg text-data-lg ${accent ? "text-secondary" : ""} ${gated ? "text-on-surface-variant/50" : ""}`}
      >
        {value}
        {unit ? (
          <span
            className={`text-sm ${accent ? "text-secondary/70" : "text-on-surface-variant"}`}
          >
            {" "}
            {unit}
          </span>
        ) : null}
      </span>
      {gated ? (
        <span className="font-body-sm text-xs text-on-surface-variant/50">
          after Phase 4
        </span>
      ) : null}
    </div>
  );
}

function Th({
  children,
  right,
  center,
}: {
  children: React.ReactNode;
  right?: boolean;
  center?: boolean;
}) {
  return (
    <th
      className={`p-4 font-label-caps text-label-caps text-on-surface-variant ${
        right ? "text-right" : center ? "text-center" : ""
      }`}
    >
      {children}
    </th>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <tr>
      <td
        colSpan={7}
        className="p-8 text-center font-body-sm text-on-surface-variant"
      >
        {children}
      </td>
    </tr>
  );
}
