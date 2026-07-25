"use client";

// /portfolio — Fianza's credit book. The protocol-wide risk view a real
// lending business reports: total lent, utilization, default rate, realized
// loss, reserve coverage, lender yield — all read live from on-chain vault
// state. This is what turns "a demo" into "a credit business."

import { useEffect, useState } from "react";
import TLNav from "@/components/tl/TLNav";
import { api, usdc, tierLabel, shortAddr, type Portfolio } from "@/lib/api";
import {
  Loader2,
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  Layers,
  Percent,
  ExternalLink,
  Lock,
} from "lucide-react";

const EXPLORER = (a: string) => `https://stellar.expert/explorer/testnet/account/${a}`;

export default function PortfolioPage() {
  const [p, setP] = useState<Portfolio | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = () =>
      api
        .portfolio()
        .then(setP)
        .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    load();
    const t = setInterval(load, 20000); // live refresh
    return () => clearInterval(t);
  }, []);

  return (
    <div className="tl-select relative min-h-screen bg-obsidian text-bone">
      <TLNav />
      <div className="tl-grain relative mx-auto w-full max-w-[1100px] px-6 py-14 md:px-10">
        {/* hero */}
        <div className="tl-anim-fadeup max-w-2xl">
          <div className="mb-3 font-tl-mono text-[11px] tracking-[0.22em] text-ion">
            / THE CREDIT BOOK
          </div>
          <h1 className="font-tl-serif text-[min(6.5vw,44px)] font-normal leading-[1.07] tracking-[-0.02em]">
            The whole portfolio, <span className="italic text-nectar">live on-chain</span>.
          </h1>
          <p className="mt-4 font-tl-sans text-sm leading-[1.7] text-ash">
            Every number below is read straight from the lending vaults on Stellar
            testnet — total credit outstanding, utilization, default rate,
            realized loss, and the reserve buffer that absorbs it. This is
            Fianza as a credit business, not a demo.
          </p>
        </div>

        {error ? (
          <p className="mt-8 font-tl-mono text-xs text-flare">
            {error} — is the backend awake? (free tiers sleep; retry in ~30s)
          </p>
        ) : null}

        {!p && !error ? (
          <div className="mt-16 flex items-center gap-2 font-tl-mono text-xs text-ash">
            <Loader2 size={14} className="animate-spin" /> reading the book from chain…
          </div>
        ) : null}

        {p ? (
          <>
            {/* headline stat tiles */}
            <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat
                icon={<TrendingUp size={15} />}
                label="Credit outstanding"
                value={`$${usdc(p.totalOwedUsdc)}`}
                sub={`${p.activeLoans} active loan${p.activeLoans === 1 ? "" : "s"}`}
                tone="nectar"
              />
              <Stat
                icon={<Layers size={15} />}
                label="Utilization"
                value={`${p.utilizationPct}%`}
                sub={`$${usdc(p.totalLiquidityUsdc)} lendable`}
                tone="ion"
              />
              <Stat
                icon={<AlertTriangle size={15} />}
                label="Default rate"
                value={`${p.defaultRatePct}%`}
                sub={`${p.defaults} of ${p.agents} agents`}
                tone={p.defaults > 0 ? "flare" : "ion"}
              />
              <Stat
                icon={<Percent size={15} />}
                label="Avg APR"
                value={`${(p.avgAprBps / 100).toFixed(1)}%`}
                sub="risk-priced by tier"
                tone="bone"
              />
            </div>

            {/* secondary row: the risk story */}
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat
                icon={<ShieldCheck size={15} />}
                label="Reserve buffer"
                value={`$${usdc(p.totalReserveUsdc)}`}
                sub={p.reserveCoverageX > 0 ? `${p.reserveCoverageX}× cover` : "first-loss buffer"}
                tone="ion"
                small
              />
              <Stat
                icon={<AlertTriangle size={15} />}
                label="Realized loss"
                value={`$${usdc(p.totalRealizedLossUsdc)}`}
                sub="written off to lenders"
                tone={p.totalRealizedLossUsdc > 0 ? "flare" : "bone"}
                small
              />
              <Stat
                icon={<TrendingUp size={15} />}
                label="Lender yield"
                value={`$${usdc(p.totalYieldUsdc)}`}
                sub="from repaid interest"
                tone="nectar"
                small
              />
              <Stat
                icon={<Layers size={15} />}
                label="Agents underwritten"
                value={String(p.agents)}
                sub="on real revenue"
                tone="bone"
                small
              />
            </div>

            {/* positions table */}
            <div className="mt-10">
              <h2 className="mb-3 font-tl-serif text-xl text-bone">Positions</h2>
              <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-void/50">
                <table className="w-full min-w-[640px] border-collapse font-tl-mono text-[12px]">
                  <thead>
                    <tr className="border-b border-white/[0.08] text-ash">
                      <th className="px-4 py-3 text-left font-normal">Agent</th>
                      <th className="px-4 py-3 text-left font-normal">Tier</th>
                      <th className="px-4 py-3 text-right font-normal">Owed</th>
                      <th className="px-4 py-3 text-right font-normal">Limit</th>
                      <th className="px-4 py-3 text-right font-normal">Liquidity</th>
                      <th className="px-4 py-3 text-right font-normal">APR</th>
                      <th className="px-4 py-3 text-left font-normal">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.positions.map((pos) => (
                      <tr
                        key={pos.agent}
                        className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]"
                      >
                        <td className="px-4 py-2.5">
                          <a
                            href={EXPLORER(pos.agent)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-ion hover:text-nectar"
                          >
                            {shortAddr(pos.agent)}
                            <ExternalLink size={10} />
                          </a>
                        </td>
                        <td className="px-4 py-2.5 text-bone/80">{tierLabel(pos.tier)}</td>
                        <td className="px-4 py-2.5 text-right text-bone">
                          {pos.owedUsdc > 0 ? `$${usdc(pos.owedUsdc)}` : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right text-ash">${usdc(pos.limitUsdc)}</td>
                        <td className="px-4 py-2.5 text-right text-ash">
                          ${usdc(pos.liquidityUsdc)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-ash">
                          {pos.aprBps ? `${(pos.aprBps / 100).toFixed(1)}%` : "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          {pos.defaulted ? (
                            <span className="rounded bg-flare/15 px-1.5 py-0.5 text-flare">
                              defaulted
                            </span>
                          ) : pos.owedUsdc > 0 ? (
                            <span className="rounded bg-nectar/15 px-1.5 py-0.5 text-nectar">
                              borrowing
                            </span>
                          ) : (
                            <span className="text-ash/60">idle</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* lender pool teaser — the mainnet plan */}
            <div className="mt-10 rounded-xl border border-ion/20 bg-ion/[0.05] p-5">
              <div className="mb-2 flex items-center gap-2 font-tl-mono text-[11px] tracking-[0.14em] text-ion">
                <Lock size={13} /> LENDER VIEW · COMING
              </div>
              <p className="max-w-2xl font-tl-sans text-sm leading-[1.65] text-ash">
                Today the treasury is the sole lender-of-first-resort
                (<span className="text-bone/80">{p.lenderModel}</span>). The
                mainnet product is a <span className="text-bone">pooled lender
                market</span>: deposit USDC once, pick a risk tranche (A-tier only
                at lower yield, or all-tiers for more), and earn the interest these
                agents pay — with per-agent isolation and the reserve buffer above
                as first-loss protection. Nobody hand-picks an agent to fund; the
                protocol allocates by tier.
              </p>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  sub,
  tone,
  small,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tone: "nectar" | "ion" | "flare" | "bone";
  small?: boolean;
}) {
  const toneColor = {
    nectar: "text-nectar",
    ion: "text-ion",
    flare: "text-flare",
    bone: "text-bone",
  }[tone];
  return (
    <div className="rounded-xl border border-white/[0.08] bg-void/50 p-4">
      <div className={`mb-2 flex items-center gap-1.5 font-tl-mono text-[10px] tracking-[0.12em] text-ash`}>
        <span className={toneColor}>{icon}</span>
        {label.toUpperCase()}
      </div>
      <div className={`font-tl-serif ${small ? "text-2xl" : "text-3xl"} leading-none ${toneColor}`}>
        {value}
      </div>
      <div className="mt-1.5 font-tl-mono text-[10px] text-ash/70">{sub}</div>
    </div>
  );
}
