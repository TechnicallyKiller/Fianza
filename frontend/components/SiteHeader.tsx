import Link from "next/link";

// Public top nav, matching the dashboards' header (screens/*.html): TrustLine
// wordmark, section links, Testnet pill, and a primary "Launch app" action.
export default function SiteHeader() {
  return (
    <header className="glass-card sticky top-0 z-50 w-full rounded-none border-x-0 border-t-0 border-b border-white/5">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-gutter">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="text-headline-md font-bold tracking-tight text-on-surface"
          >
            TrustLine
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            <Link
              className="font-medium text-on-surface-variant transition-colors duration-200 hover:text-primary"
              href="/underwrite"
            >
              Live demo
            </Link>
            <Link
              className="font-medium text-on-surface-variant transition-colors duration-200 hover:text-primary"
              href="/demo"
            >
              Fraud detector
            </Link>
            <Link
              className="font-medium text-on-surface-variant transition-colors duration-200 hover:text-primary"
              href="/borrower"
            >
              Borrower
            </Link>
            <Link
              className="font-medium text-on-surface-variant transition-colors duration-200 hover:text-primary"
              href="/lender"
            >
              Lender
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="rounded-full border border-tertiary/30 bg-tertiary-container/20 px-2 py-1 font-label-caps text-label-caps text-tertiary">
            Testnet
          </span>
          <Link
            href="/underwrite"
            className="electric-blue-glow rounded bg-primary-container px-4 py-2 font-body-sm font-medium text-on-primary-container transition-all duration-300 hover:scale-[1.02] hover:bg-primary hover:text-surface"
          >
            Try live demo
          </Link>
        </div>
      </div>
    </header>
  );
}
