// Lifecycle strip — earn → prove → score → borrow → repay — plus the
// "Underwrite a live address" CTA that follows it.

import Link from "next/link";
import Reveal from "@/components/tl/Reveal";
import { LOOP, stagger } from "@/components/landing/data";

export default function LifecycleLoop() {
  return (
    <div className="relative z-[1] px-[6vw] py-[8vh]">
      <Reveal variant="fade">
        <div className="mb-9 font-tl-mono text-[11px] tracking-[0.2em] text-ash">
          THE LOOP · earn → prove → score → borrow → repay
        </div>
        <div className="relative grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5 lg:gap-0">
          <div
            className="tl-grow-g absolute left-[6%] right-[6%] top-[15px] hidden h-[2px] bg-gradient-to-r from-nectar via-ion to-nectar lg:block"
            style={stagger("0.15s")}
          />
          {LOOP.map((step, i) => (
            <div
              key={step.n}
              className="tl-fade-g relative pr-5"
              style={stagger(`${0.2 + i * 0.12}s`)}
            >
              <div
                className="relative z-[2] flex h-8 w-8 items-center justify-center rounded-full border-2 bg-obsidian font-tl-mono text-[13px] font-bold"
                style={{ borderColor: step.c, color: step.c }}
              >
                {step.n}
              </div>
              <div className="mb-1.5 mt-4 font-tl-sans text-base font-semibold text-bone">
                {step.t}
              </div>
              <div className="font-tl-mono text-xs text-[#5a635e]">{step.d}</div>
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal variant="up" delay={0.1}>
        <Link
          href="/underwrite"
          className="mt-[60px] inline-flex items-center gap-3 rounded-lg bg-nectar px-[26px] py-4 font-tl-sans text-[15px] font-semibold text-obsidian transition-colors hover:bg-ion"
        >
          Underwrite a live address <span className="font-tl-mono">→</span>
        </Link>
        <div className="mt-[18px] font-tl-mono text-xs text-[#5a635e]">
          paste any Stellar address — watch the verdict resolve
        </div>
      </Reveal>
    </div>
  );
}
