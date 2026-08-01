// ACT 03 · BORROW — the credit line drawing itself mid-job to pay an x402 call.

import Link from "next/link";
import Reveal from "@/components/tl/Reveal";
import { stagger } from "@/components/landing/data";

export default function BorrowAct() {
  return (
    <div className="grid items-center gap-10 md:grid-cols-2">
      <Reveal variant="left">
        <div className="font-tl-mono text-[11px] tracking-[0.2em] text-nectar">
          ACT 03 · BORROW
        </div>
        <h3 className="mt-3 font-tl-serif text-[28px] leading-[1.15] text-bone">
          The line draws itself.
        </h3>
        <p className="mt-4 max-w-[44ch] font-tl-sans text-[15px] leading-[1.7] text-ash">
          Mid-job, the agent hits a paywall it can&apos;t afford. Instead of
          dying, the shortfall borrows against its credit line and pays over
          x402 — no human, no top-up, no pause.
        </p>
        <Link
          href="/demo"
          className="mt-5 inline-flex items-center gap-2 font-tl-mono text-xs text-ion transition-colors hover:text-nectar"
        >
          watch this exact run live →
        </Link>
      </Reveal>
      <Reveal variant="right" delay={0.1}>
        <div className="rounded-xl border border-bone/[0.08] bg-void/70 p-6">
          <div className="flex items-baseline justify-between font-tl-mono text-[10px] tracking-[0.14em]">
            <span className="text-ash">CREDIT LINE</span>
            <span className="text-nectar">open · isolated vault</span>
          </div>
          <div className="mt-4 h-[10px] overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="tl-grow-g h-full w-[62%] rounded-full bg-gradient-to-r from-nectar to-ion shadow-[0_0_14px_rgba(255,176,32,0.35)]"
              style={stagger("0.2s")}
            />
          </div>
          <div className="mt-2 flex justify-between font-tl-mono text-[9px] text-[#5a635e]">
            <span>drawn</span>
            <span>headroom</span>
          </div>
          <div
            className="tl-fade-g mt-5 rounded-lg border border-flare/25 bg-flare/[0.05] px-4 py-3 font-tl-mono text-[11px] text-ash"
            style={stagger("0.7s")}
          >
            402 Payment Required · 3.00 USDC — balance 0.42
          </div>
          <div
            className="tl-fade-g mt-2 rounded-lg border border-ion/25 bg-ion/[0.06] px-4 py-3 font-tl-mono text-[11px] text-ion"
            style={stagger("1.15s")}
          >
            shortfall drawn against the line → paid over x402 ✓
          </div>
        </div>
      </Reveal>
    </div>
  );
}
