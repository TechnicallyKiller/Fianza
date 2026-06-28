import type { Metadata } from "next";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import DashboardChrome from "@/components/DashboardChrome";

// Sample preview of the borrower (AI agent) dashboard.
// Source design: screens/dashboard.html + screens/screen_dash.png.
// Illustrative data only — Phase 3 wires this to the live Phase 2 API + wallet.
export const metadata: Metadata = {
  title: "TrustLine — Agent dashboard (sample)",
};

export default function BorrowerDashboard() {
  return (
    <DashboardChrome>
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-gutter py-stack-lg">
        {/* Summary row */}
        <div className="mb-stack-lg grid grid-cols-1 gap-stack-md md:grid-cols-4">
          <div className="glass-card glass-card-hover animate-enter flex flex-col justify-between rounded-lg p-card-padding">
            <div className="mb-stack-sm flex items-start justify-between">
              <span className="text-body-sm text-on-surface-variant">
                Credit Score
              </span>
              <span className="rounded border border-primary/20 bg-primary/10 px-2 py-1 font-label-caps text-label-caps text-primary">
                Tier B
              </span>
            </div>
            <div className="text-headline-lg font-headline-lg text-on-surface">
              720
            </div>
          </div>
          <Metric
            label="Available Credit"
            value="50,000"
            unit="USDC"
            delay="delay-100"
          />
          <Metric
            label="Currently Borrowed"
            value="12,500"
            unit="USDC"
            delay="delay-200"
          />
          <Metric
            label="Verified Trailing Revenue (30d)"
            value="25,000"
            unit="USDC"
            delay="delay-300"
          />
        </div>

        {/* Main layout */}
        <div className="grid grid-cols-1 gap-stack-lg lg:grid-cols-12">
          {/* Left column */}
          <div className="flex flex-col gap-stack-lg lg:col-span-8">
            {/* Revenue history */}
            <div className="glass-card animate-enter delay-100 flex h-[400px] flex-col rounded-lg p-card-padding">
              <div className="mb-stack-md flex items-center justify-between border-b border-white/10 pb-stack-sm">
                <h2 className="text-body-lg font-body-lg">Revenue History</h2>
                <span className="text-body-sm text-on-surface-variant">
                  on-chain x402 earnings (30d)
                </span>
              </div>
              <RevenueChart />
            </div>

            {/* Off-chain revenue */}
            <div className="glass-card animate-enter delay-200 rounded-lg p-card-padding">
              <div className="mb-stack-md border-b border-white/10 pb-stack-sm">
                <h2 className="text-body-lg font-body-lg">Off-chain Revenue</h2>
              </div>
              <div className="flex flex-col items-start justify-between gap-4 rounded border border-white/5 bg-surface-dim/30 p-4 backdrop-blur-sm md:flex-row md:items-center">
                <div className="flex items-center gap-3">
                  <div className="rounded-full border border-secondary/20 bg-secondary/10 p-2 text-secondary">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <div className="font-body-md text-on-surface">
                      zkTLS-verified Stripe revenue
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-body-sm text-on-surface-variant">
                      <CheckCircle2 size={14} className="text-secondary" />
                      <span className="font-medium text-secondary">Verified</span>
                    </div>
                  </div>
                </div>
                <button className="electric-blue-glow rounded bg-primary-container px-4 py-2 font-body-sm text-on-primary-container transition-all duration-300 hover:scale-105 hover:bg-primary hover:text-surface">
                  Submit revenue proof
                </button>
              </div>
            </div>

            {/* Score breakdown */}
            <div className="glass-card animate-enter delay-300 rounded-lg p-card-padding">
              <div className="mb-stack-md border-b border-white/10 pb-stack-sm">
                <h2 className="text-body-lg font-body-lg">Score Breakdown</h2>
              </div>
              <div className="flex flex-col gap-4">
                <ScoreBar label="Revenue Coverage Ratio" value="High" pct={85} opacity={1} />
                <ScoreBar
                  label="Distinct Counterparty Count"
                  value="Medium"
                  pct={60}
                  opacity={0.7}
                />
                <ScoreBar label="Off-chain Proof Weight" value="Low" pct={30} opacity={0.4} />
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-stack-lg lg:col-span-4">
            {/* Credit line status */}
            <div className="glass-card animate-enter delay-200 rounded-lg p-card-padding">
              <div className="mb-stack-md border-b border-white/10 pb-stack-sm">
                <h2 className="text-body-lg font-body-lg">Credit Line Status</h2>
              </div>
              <div className="mb-4 flex items-baseline justify-between">
                <span className="text-body-sm text-on-surface-variant">
                  Credit Limit
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="font-data-lg text-on-surface">50,000</span>
                  <span className="font-data-md text-body-sm text-on-surface-variant">
                    USDC
                  </span>
                </div>
              </div>
              <div className="mb-6 flex items-baseline justify-between">
                <span className="text-body-sm text-on-surface-variant">
                  APR (Fixed)
                </span>
                <span className="font-data-md text-on-surface">8.5%</span>
              </div>
              <div className="mb-6 rounded border border-white/5 bg-surface-dim/30 p-4 backdrop-blur-sm">
                <div className="mb-1 text-body-sm text-on-surface-variant">
                  Amount Drawn
                </div>
                <div className="flex items-baseline gap-2 text-headline-md">
                  <span className="font-data-lg">12,500</span>
                  <span className="font-data-md text-body-sm text-on-surface-variant">
                    USDC
                  </span>
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full border border-white/5 bg-surface-dim/50">
                  <div className="h-full w-[25%] bg-primary shadow-[0_0_10px_rgba(173,198,255,0.5)]" />
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <button className="electric-blue-glow w-full rounded bg-primary-container py-3 font-body-sm font-medium text-on-primary-container transition-all duration-300 hover:scale-[1.02] hover:bg-primary hover:text-surface">
                  Request credit
                </button>
                <button className="w-full rounded border border-white/10 bg-surface-dim/20 py-3 font-body-sm text-on-surface-variant backdrop-blur-sm transition-colors duration-200 hover:bg-surface-variant/50 hover:text-on-surface">
                  Repay
                </button>
              </div>
            </div>

            {/* Activity feed */}
            <div className="glass-card animate-enter delay-400 flex-1 rounded-lg p-card-padding">
              <div className="mb-stack-md border-b border-white/10 pb-stack-sm">
                <h2 className="text-body-lg font-body-lg">Activity Feed</h2>
              </div>
              <div className="relative flex flex-col gap-4">
                <div className="absolute bottom-2 left-2.5 top-2 w-px bg-white/10" />
                <FeedItem active title="Repaid" amount="500 USDC" meta="2 hrs ago" hash="0xab...8f9d" />
                <FeedItem title="Borrowed" amount="500 USDC" meta="Yesterday" hash="0xcd...1a2b" />
                <FeedItem title="Score updated" meta="3 days ago" />
                <FeedItem title="Registered" meta="1 week ago" hash="0xef...3c4d" />
              </div>
            </div>
          </div>
        </div>
      </main>
    </DashboardChrome>
  );
}

function Metric({
  label,
  value,
  unit,
  delay,
}: {
  label: string;
  value: string;
  unit: string;
  delay: string;
}) {
  return (
    <div
      className={`glass-card glass-card-hover animate-enter ${delay} flex flex-col justify-between rounded-lg p-card-padding`}
    >
      <div className="mb-stack-sm">
        <span className="text-body-sm text-on-surface-variant">{label}</span>
      </div>
      <div className="flex items-baseline gap-2 text-headline-lg font-headline-lg text-on-surface">
        <span className="font-data-lg text-data-lg">{value}</span>
        <span className="font-data-md text-body-sm text-on-surface-variant">
          {unit}
        </span>
      </div>
    </div>
  );
}

function ScoreBar({
  label,
  value,
  pct,
  opacity,
}: {
  label: string;
  value: string;
  pct: number;
  opacity: number;
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-body-sm">
        <span className="text-on-surface-variant">{label}</span>
        <span className="font-data-md">{value}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full border border-white/5 bg-surface-dim/50 backdrop-blur-sm">
        <div
          className="h-full bg-primary shadow-[0_0_10px_rgba(173,198,255,0.5)]"
          style={{ width: `${pct}%`, opacity }}
        />
      </div>
    </div>
  );
}

function FeedItem({
  title,
  amount,
  meta,
  hash,
  active,
}: {
  title: string;
  amount?: string;
  meta: string;
  hash?: string;
  active?: boolean;
}) {
  return (
    <div className="relative z-10 flex gap-4">
      <div
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-container-low ${
          active
            ? "border border-primary shadow-[0_0_8px_rgba(173,198,255,0.3)]"
            : "border border-white/20"
        }`}
      >
        <div
          className={`rounded-full ${active ? "h-2 w-2 bg-primary" : "h-1.5 w-1.5 bg-white/20"}`}
        />
      </div>
      <div>
        <div className="flex items-center gap-1 font-body-sm text-on-surface">
          {title}
          {amount ? <span className="font-data-md text-xs">{amount}</span> : null}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-body-sm text-on-surface-variant">
          <span>{meta}</span>
          {hash ? (
            <>
              <span>•</span>
              <span className="font-data-md text-xs">{hash}</span>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// Lightweight inline area chart (no deps) — gradient fill per the design spec.
function RevenueChart() {
  return (
    <div className="relative flex-1 overflow-hidden rounded border border-white/5 bg-surface-dim/20 backdrop-blur-sm">
      <svg
        viewBox="0 0 600 240"
        preserveAspectRatio="none"
        className="h-full w-full"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="rev-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#adc6ff" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#adc6ff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0,200 L60,180 L120,185 L180,150 L240,160 L300,120 L360,130 L420,90 L480,100 L540,60 L600,55 L600,240 L0,240 Z"
          fill="url(#rev-fill)"
        />
        <path
          d="M0,200 L60,180 L120,185 L180,150 L240,160 L300,120 L360,130 L420,90 L480,100 L540,60 L600,55"
          fill="none"
          stroke="#adc6ff"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span className="pointer-events-none absolute bottom-3 right-3 font-data-md text-data-md text-on-surface-variant">
        +18% MoM
      </span>
    </div>
  );
}
