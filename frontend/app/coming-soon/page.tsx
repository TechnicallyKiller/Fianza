import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "TrustLine — Dashboards launching soon",
  description:
    "The TrustLine borrower and lender dashboards are being wired to live Stellar testnet data. Coming soon.",
};

const pipeline = [
  { label: "Soroban contracts", done: false },
  { label: "Underwriting engine", done: false },
  { label: "x402 settlement", done: true },
  { label: "Reclaim zkTLS proofs", done: true },
  { label: "Dashboards", done: false },
];

export default function ComingSoon() {
  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-[1440px] flex-1 items-center justify-center px-gutter py-16">
        <div className="glass-card animate-enter w-full max-w-2xl rounded-xl p-card-padding text-center md:p-12">
          <span className="inline-flex items-center gap-2 rounded-full border border-tertiary/30 bg-tertiary-container/20 px-3 py-1 font-label-caps text-label-caps text-tertiary">
            Coming soon · Stellar testnet
          </span>

          <h1 className="mt-6 text-headline-lg font-headline-lg text-on-surface md:text-display-lg md:[font-size:48px] md:[line-height:56px]">
            The dashboards are almost here.
          </h1>

          <p className="mx-auto mt-5 max-w-lg text-body-lg text-on-surface-variant">
            We&apos;re wiring the borrower and lender dashboards to live Stellar
            testnet data — real revenue indexing, on-chain scores, and credit
            lines that settle over x402. The two hardest pieces are already
            validated on testnet.
          </p>

          {/* Build pipeline */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {pipeline.map((p) => (
              <span
                key={p.label}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-data-md text-data-md ${
                  p.done
                    ? "border-secondary/30 bg-secondary/10 text-secondary"
                    : "border-white/10 bg-surface-dim/30 text-on-surface-variant"
                }`}
              >
                {p.done ? <Check size={12} /> : null}
                {p.label}
              </span>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded border border-white/10 bg-surface-dim/20 px-6 py-3 font-body-md text-on-surface-variant backdrop-blur-sm transition-colors duration-200 hover:border-primary/40 hover:text-on-surface"
            >
              <ArrowLeft size={18} />
              Back to home
            </Link>
            <a
              href="mailto:divyanshhkalra1234@gmail.com?subject=TrustLine%20early%20access"
              className="electric-blue-glow inline-flex items-center gap-2 rounded bg-primary-container px-6 py-3 font-body-md font-medium text-on-primary-container transition-all duration-300 hover:scale-[1.02] hover:bg-primary hover:text-surface"
            >
              Request early access
            </a>
          </div>

          {/* Sample dashboard previews */}
          <div className="mt-10 border-t border-white/10 pt-8">
            <p className="font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant">
              Sneak peek
            </p>
            <h2 className="mt-2 text-headline-md font-headline-md text-on-surface">
              See how the dashboards will look
            </h2>
            <p className="mx-auto mt-2 max-w-md text-body-sm text-on-surface-variant">
              Interactive sample views with illustrative data — a preview of the
              real product, not yet wired to live testnet data.
            </p>
            <div className="mt-5 grid grid-cols-1 gap-stack-md sm:grid-cols-2">
              <Link
                href="/borrower"
                className="glass-card glass-card-hover group flex items-center justify-between rounded-lg p-card-padding text-left"
              >
                <span>
                  <span className="block text-body-md font-medium text-on-surface">
                    AI agent dashboard
                  </span>
                  <span className="block text-body-sm text-on-surface-variant">
                    Score, revenue & credit line
                  </span>
                </span>
                <ArrowRight
                  size={18}
                  className="text-primary transition-transform group-hover:translate-x-1"
                />
              </Link>
              <Link
                href="/lender"
                className="glass-card glass-card-hover group flex items-center justify-between rounded-lg p-card-padding text-left"
              >
                <span>
                  <span className="block text-body-md font-medium text-on-surface">
                    Lender dashboard
                  </span>
                  <span className="block text-body-sm text-on-surface-variant">
                    Agents, vaults & yield
                  </span>
                </span>
                <ArrowRight
                  size={18}
                  className="text-primary transition-transform group-hover:translate-x-1"
                />
              </Link>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
