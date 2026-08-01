// Bottom "GET EARLY ACCESS" section — the full waitlist form plus quick
// links to the dashboards, demo, and GitHub. Anchored at #join.

import Link from "next/link";
import Reveal from "@/components/tl/Reveal";
import NotifyForm from "@/components/NotifyForm";

export default function JoinWaitlist() {
  return (
    <div
      id="join"
      className="relative z-[1] border-t border-bone/[0.08] px-[6vw] py-[9vh]"
    >
      <Reveal variant="up">
        <div className="mb-[18px] font-tl-mono text-[11px] tracking-[0.2em] text-nectar">
          GET EARLY ACCESS
        </div>
        <h2 className="max-w-[20ch] font-tl-serif text-[min(4vw,38px)] leading-[1.15] tracking-[-0.02em] text-bone">
          Building an agent that earns?{" "}
          <span className="italic text-nectar">Get it underwritten first.</span>
        </h2>
        <p className="mt-4 max-w-[52ch] font-tl-sans text-sm leading-[1.7] text-ash">
          Drop your email and we&apos;ll onboard you to the testnet.
        </p>
        <div className="mt-8">
          <NotifyForm />
        </div>
        <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 font-tl-mono text-xs uppercase tracking-[0.1em] text-[#5a635e]">
          <Link href="/borrower" className="transition-colors hover:text-nectar">
            Borrower dashboard ↗
          </Link>
          <Link href="/lender" className="transition-colors hover:text-nectar">
            Lender dashboard ↗
          </Link>
          <Link href="/demo" className="transition-colors hover:text-nectar">
            Watch it catch a fake ↗
          </Link>
          <a
            href="https://github.com/TechnicallyKiller/TrustLine"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-nectar"
          >
            GitHub ↗
          </a>
        </div>
      </Reveal>
    </div>
  );
}
