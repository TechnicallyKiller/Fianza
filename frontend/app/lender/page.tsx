import type { Metadata } from "next";
import DashboardChrome from "@/components/DashboardChrome";

// Sample preview of the lender (liquidity provider) dashboard.
// Source design: screens/lending.html + screens/lending.png.
// Illustrative data only — Phase 3 wires this to the live Phase 2 API + wallet.
export const metadata: Metadata = {
  title: "TrustLine — Lender dashboard (sample)",
};

const agents = [
  { addr: "GBCX...YT65", tier: "Tier A", rev: "45,000", req: "20,000", apr: "12.5%", risk: "secondary", active: true },
  { addr: "GDFQ...LP92", tier: "Tier B", rev: "18,500", req: "10,000", apr: "14.0%", risk: "tertiary", active: false },
  { addr: "GAZT...MN41", tier: "Tier C", rev: "5,200", req: "15,000", apr: "18.5%", risk: "error", active: false },
];

const riskDot: Record<string, string> = {
  secondary: "bg-secondary shadow-[0_0_8px_rgba(78,222,163,0.6)]",
  tertiary: "bg-tertiary shadow-[0_0_8px_rgba(255,185,95,0.6)]",
  error: "bg-error shadow-[0_0_8px_rgba(255,180,171,0.6)]",
};

export default function LenderDashboard() {
  return (
    <DashboardChrome>
      <main className="mx-auto w-full max-w-[1440px] flex-1 space-y-stack-lg px-gutter py-stack-lg">
        {/* Header */}
        <div>
          <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg">
            Lender Dashboard
          </h1>
          <p className="mt-2 font-body-md text-body-md text-on-surface-variant">
            Manage your automated credit lines and monitor agent risk exposure.
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 gap-stack-md md:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="Total Deposited" value="250,000" unit="USDC" />
          <SummaryCard label="Active Exposure" value="185,000" unit="USDC" />
          <SummaryCard label="Realized Yield" value="12,450" unit="USDC" accent />
          <SummaryCard label="Average APR" value="11.2%" />
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
                      <Th right>Req Credit</Th>
                      <Th right>Offered APR</Th>
                      <Th center>Risk</Th>
                      <Th right>Action</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/30 font-data-md text-data-md">
                    {agents.map((a) => (
                      <tr
                        key={a.addr}
                        className={`cursor-pointer transition-colors hover:bg-surface-variant/30 ${a.active ? "bg-primary/5" : ""}`}
                      >
                        <td className="flex items-center gap-3 p-4">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-outline-variant bg-gradient-to-br from-primary to-surface-container">
                            <div className="h-3 w-3 rotate-45 rounded-sm bg-surface" />
                          </div>
                          {a.addr}
                        </td>
                        <td className="p-4">
                          <span className="rounded border border-outline-variant bg-surface-container px-2 py-1 text-xs">
                            {a.tier}
                          </span>
                        </td>
                        <td className="p-4 text-right">{a.rev}</td>
                        <td className="p-4 text-right">{a.req}</td>
                        <td className="p-4 text-right text-secondary">{a.apr}</td>
                        <td className="p-4 text-center">
                          <div className={`mx-auto h-2 w-2 rounded-full ${riskDot[a.risk]}`} />
                        </td>
                        <td className="p-4 text-right">
                          {a.active ? (
                            <button className="rounded border border-primary/30 bg-primary/10 px-4 py-1.5 font-body-sm text-primary transition-colors hover:bg-primary/20">
                              Fund
                            </button>
                          ) : (
                            <button className="rounded border border-outline bg-transparent px-4 py-1.5 font-body-sm text-on-surface transition-colors hover:border-primary">
                              Fund
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
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
            <div className="glass-panel relative flex flex-col gap-stack-md overflow-hidden rounded-lg p-card-padding">
              <div className="pointer-events-none absolute right-0 top-0 -mr-16 -mt-16 h-32 w-32 rounded-full bg-primary/5 blur-3xl" />
              <div className="flex items-center gap-3 border-b border-outline-variant/50 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant bg-gradient-to-br from-primary to-surface-container">
                  <div className="h-4 w-4 rotate-45 rounded-sm bg-surface" />
                </div>
                <div>
                  <h3 className="font-body-md font-semibold">Agent Details</h3>
                  <p className="font-data-md text-on-surface-variant">GBCX...YT65</p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-label-caps text-label-caps uppercase text-on-surface-variant">
                  Underwriting History
                </h4>
                <div className="space-y-4 rounded border border-outline-variant/30 bg-surface-container-low p-4">
                  <div>
                    <span className="mb-1 block font-body-sm text-on-surface-variant">
                      30-Day Rev Trend
                    </span>
                    <div className="flex h-10 w-full items-end gap-1 opacity-80">
                      {[2, 3, 5, 4, 7, 6].map((h, i) => (
                        <div
                          key={i}
                          className="w-full rounded-t bg-primary"
                          style={{ height: `${h * 12}%`, opacity: 0.2 + i * 0.13 }}
                        />
                      ))}
                      <div className="h-full w-full rounded-t bg-primary" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-body-sm text-on-surface-variant">Track Record</span>
                    <span className="font-data-md text-sm text-secondary">12 of 12 repaid</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-body-sm text-on-surface-variant">Counterparties</span>
                    <span className="font-data-md text-sm">8 distinct entities</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4 border-t border-outline-variant/50 pt-2">
                <h4 className="font-label-caps text-label-caps uppercase text-on-surface-variant">
                  Deposit Box
                </h4>
                <div className="space-y-3">
                  <div className="relative">
                    <input
                      className="w-full rounded-md border border-outline-variant bg-surface px-4 py-3 pr-16 text-right font-data-md text-data-md text-on-surface transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      type="text"
                      defaultValue="1,000"
                    />
                    <span className="absolute right-4 top-3 font-body-sm text-on-surface-variant">
                      USDC
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-1">
                    <span className="font-body-sm text-on-surface-variant">Projected Yield</span>
                    <span className="font-data-md text-secondary">125 USDC / yr</span>
                  </div>
                  <p className="px-2 text-center font-body-sm text-xs italic text-on-surface-variant/70">
                    Isolated vault. You are exposed only to this agent&apos;s default risk.
                  </p>
                  <button className="shimmer-btn mt-2 w-full rounded-md bg-primary py-3 font-semibold text-surface shadow-[0_0_15px_rgba(173,198,255,0.15)] transition-shadow hover:shadow-[0_0_20px_rgba(173,198,255,0.25)]">
                    Deposit into isolated vault
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Positions */}
        <div className="space-y-stack-md border-t border-outline-variant/30 pt-stack-md">
          <h2 className="font-headline-md text-headline-md">Your positions</h2>
          <div className="grid grid-cols-1 gap-stack-md md:grid-cols-2 lg:grid-cols-3">
            <Position addr="GZZX...KL11" status="Active" deposited="50,000" yield_="+2,450" reps="3/6" />
            <Position addr="GQQW...ZX88" status="Active" deposited="120,000" yield_="+8,100" reps="11/12" />
            <Position addr="GBNX...YY21" status="Closed" deposited="15,000" yield_="+1,900" reps="12/12" />
          </div>
        </div>
      </main>
    </DashboardChrome>
  );
}

function SummaryCard({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: string;
  unit?: string;
  accent?: boolean;
}) {
  return (
    <div className="glass-panel flex flex-col gap-2 rounded-lg p-card-padding">
      <span className="font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant">
        {label}
      </span>
      <span className={`font-data-lg text-data-lg ${accent ? "text-secondary" : ""}`}>
        {value}
        {unit ? (
          <span className={`text-sm ${accent ? "text-secondary/70" : "text-on-surface-variant"}`}>
            {" "}
            {unit}
          </span>
        ) : null}
      </span>
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

function Position({
  addr,
  status,
  deposited,
  yield_,
  reps,
}: {
  addr: string;
  status: "Active" | "Closed";
  deposited: string;
  yield_: string;
  reps: string;
}) {
  const closed = status === "Closed";
  return (
    <div
      className={`glass-panel flex flex-col gap-4 rounded-lg border-l-4 p-card-padding ${closed ? "border-l-outline" : "border-l-secondary"}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
            Agent
          </span>
          <p className="mt-1 font-data-md text-data-md">{addr}</p>
        </div>
        <span
          className={`rounded px-2 py-1 text-xs font-medium ${
            closed
              ? "border border-outline/30 bg-surface-variant text-on-surface-variant"
              : "border border-secondary/20 bg-secondary/10 text-secondary"
          }`}
        >
          {status}
        </span>
      </div>
      <div
        className={`grid grid-cols-2 gap-4 border-t border-outline-variant/30 pt-2 ${closed ? "opacity-70" : ""}`}
      >
        <div>
          <span className="block font-label-caps text-xs uppercase text-on-surface-variant">
            Deposited
          </span>
          <span className="font-data-md">
            {deposited} <span className="text-xs text-on-surface-variant">USDC</span>
          </span>
        </div>
        <div>
          <span className="block font-label-caps text-xs uppercase text-on-surface-variant">
            Yield Earned
          </span>
          <span className="font-data-md text-secondary">{yield_}</span>
        </div>
        <div>
          <span className="block font-label-caps text-xs uppercase text-on-surface-variant">
            Repayments
          </span>
          <span className="font-data-md">{reps}</span>
        </div>
      </div>
    </div>
  );
}
