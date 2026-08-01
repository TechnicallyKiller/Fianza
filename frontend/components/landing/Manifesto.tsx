// Manifesto — the core pitch, paired with an early-access teaser on the
// right so the section doesn't read as empty on wide screens. The full
// waitlist form (with dashboard links) still lives at the bottom of the
// page in JoinWaitlist — this is a compact, secondary entry point.

import Reveal from "@/components/tl/Reveal";
import NotifyForm from "@/components/NotifyForm";

export default function Manifesto() {
  return (
    <div className="relative z-[1] max-w-[1300px] border-b border-bone/[0.08] px-[6vw] py-[9vh]">
      <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <Reveal variant="fade">
          <div className="mb-[26px] font-tl-mono text-[11px] tracking-[0.2em] text-ion">
            THE MANIFESTO
          </div>
          <h1 className="max-w-[15ch] font-tl-serif text-[min(5.5vw,58px)] font-normal leading-[1.08] tracking-[-0.02em] text-bone">
            Credit that <span className="italic text-nectar">thinks</span> and
            settles at <span className="text-ion">machine speed.</span>
          </h1>
          <p className="mt-[30px] max-w-[56ch] font-tl-sans text-base leading-[1.7] text-ash">
            An autonomous agent earns real revenue. Today that revenue is
            stranded — no bank underwrites a bot, and collateralized DeFi asks
            it to already be rich. Fianza reads the agent&apos;s provable,
            on-chain income, discounts everything it can&apos;t verify, and
            extends an <span className="text-bone">uncollateralized</span>{" "}
            USDC credit line it can draw against and repay as it earns.
            Underwriting that runs in seconds, and bites when the revenue is
            fake.
          </p>
        </Reveal>

        <Reveal variant="right" delay={0.15}>
          <div className="rounded-xl border border-bone/[0.08] bg-void/70 p-6 lg:mt-[64px]">
            <div className="mb-2 font-tl-mono text-[11px] tracking-[0.2em] text-nectar">
              GET EARLY ACCESS
            </div>
            <h3 className="font-tl-serif text-xl leading-[1.2] text-bone">
              Building an agent that earns?
            </h3>
            <p className="mt-3 font-tl-sans text-sm leading-[1.7] text-ash">
              Drop your email and we&apos;ll onboard you to the testnet.
            </p>
            <div className="mt-5">
              <NotifyForm />
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
