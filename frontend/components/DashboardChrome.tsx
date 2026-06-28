import Link from "next/link";
import { ArrowLeft, Wallet } from "lucide-react";

// Faithful reproduction of the dashboards' top nav (screens/*.html), wrapped in
// a "sample preview" ribbon so visitors understand this is an illustrative
// mockup, not live data yet.
export default function DashboardChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative z-10 flex min-h-screen flex-col bg-surface-container-lowest/60">
      {/* Sample-preview ribbon */}
      <div className="w-full border-b border-tertiary/20 bg-tertiary-container/10">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-gutter py-2">
          <span className="font-label-caps text-label-caps uppercase tracking-wider text-tertiary">
            Sample preview · illustrative data, not live yet
          </span>
          <Link
            href="/coming-soon"
            className="inline-flex items-center gap-1.5 font-body-sm text-on-surface-variant transition-colors hover:text-on-surface"
          >
            <ArrowLeft size={14} />
            Back
          </Link>
        </div>
      </div>

      {/* Top nav */}
      <nav className="w-full border-b border-outline-variant bg-surface/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-gutter">
          <div className="flex items-center gap-8">
            <Link
              href="/"
              className="text-headline-md font-headline-md font-bold tracking-tight text-on-surface"
            >
              TrustLine
            </Link>
            <div className="hidden gap-6 md:flex">
              <span className="cursor-default border-b-2 border-primary pb-1 font-bold text-primary">
                Dashboard
              </span>
              <span className="cursor-default font-medium text-on-surface-variant">
                Liquidity
              </span>
              <span className="cursor-default font-medium text-on-surface-variant">
                Swap
              </span>
              <span className="cursor-default font-medium text-on-surface-variant">
                Governance
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="rounded-md border border-outline-variant bg-surface-container px-3 py-1 font-data-md text-data-md text-on-surface-variant">
              Testnet
            </span>
            <span className="inline-flex items-center gap-2 rounded-md border border-primary/20 bg-primary/10 px-3 py-1 font-data-md text-data-md text-primary">
              <Wallet size={14} />
              GBEF...QHDE
            </span>
          </div>
        </div>
      </nav>

      {children}
    </div>
  );
}
