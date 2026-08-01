// ACT 04 · REPAY — repayment history ramping the score/tier up.

import Reveal from "@/components/tl/Reveal";
import CountUp from "@/components/tl/CountUp";
import { stagger } from "@/components/landing/data";

export default function RepayAct() {
  return (
    <div className="grid items-center gap-10 md:grid-cols-2">
      <Reveal variant="right" className="md:order-2">
        <div className="font-tl-mono text-[11px] tracking-[0.2em] text-ion">
          ACT 04 · REPAY
        </div>
        <h3 className="mt-3 font-tl-serif text-[28px] leading-[1.15] text-bone">
          Repayment becomes reputation.
        </h3>
        <p className="mt-4 max-w-[44ch] font-tl-sans text-[15px] leading-[1.7] text-ash">
          It repays as revenue lands. On-time history ramps the limit up; a
          zkTLS proof of off-chain revenue lifts the score. Miss the term,
          and the same machinery bites back — default, collapsed score,
          socialized loss.
        </p>
      </Reveal>
      <Reveal variant="left" delay={0.1} className="md:order-1">
        <div className="rounded-xl border border-bone/[0.08] bg-void/70 p-6">
          <div className="flex items-end justify-between">
            <div>
              <div className="font-tl-mono text-[10px] tracking-[0.14em] text-ash">
                SCORE
              </div>
              <div className="font-tl-sans text-[44px] font-bold leading-none text-bone">
                <CountUp from={575} to={775} duration={1800} />
              </div>
            </div>
            <div className="text-right">
              <div className="font-tl-mono text-[10px] tracking-[0.14em] text-ash">
                TIER
              </div>
              <div className="relative h-[34px] w-[26px] font-tl-serif text-[30px] leading-none">
                <span
                  className="tl-fadeout-g absolute inset-0 text-nectar"
                  style={stagger("1.4s")}
                >
                  C
                </span>
                <span
                  className="tl-fade-g absolute inset-0 text-ion"
                  style={stagger("1.5s")}
                >
                  A
                </span>
              </div>
            </div>
          </div>
          <svg
            viewBox="0 0 240 80"
            className="mt-5 h-[80px] w-full overflow-visible"
            aria-hidden
          >
            <polyline
              points="0,64 30,60 60,50 90,52 120,38 150,40 180,24 210,18 240,8"
              pathLength={340}
              fill="none"
              stroke="#58F0C8"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              className="tl-draw-g"
              style={{
                filter: "drop-shadow(0 0 5px rgba(88,240,200,.6))",
                ...stagger("0.3s"),
              }}
            />
          </svg>
          <div className="mt-3 font-tl-mono text-[10px] leading-relaxed text-[#5a635e]">
            on-time repayments recorded on-chain · zkTLS off-chain proof
            carries 1.5× weight
          </div>
        </div>
      </Reveal>
    </div>
  );
}
