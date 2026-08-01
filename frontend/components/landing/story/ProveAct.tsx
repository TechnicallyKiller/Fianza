// ACT 02 · PROVE — declared vs. sybil-cut vs. effective revenue bar chart.

import Reveal from "@/components/tl/Reveal";
import { stagger } from "@/components/landing/data";

export default function ProveAct() {
  return (
    <div className="grid items-center gap-10 md:grid-cols-2">
      <Reveal variant="right" className="md:order-2">
        <div className="font-tl-mono text-[11px] tracking-[0.2em] text-flare">
          ACT 02 · PROVE
        </div>
        <h3 className="mt-3 font-tl-serif text-[28px] leading-[1.15] text-bone">
          The engine reads it — and bites.
        </h3>
        <p className="mt-4 max-w-[44ch] font-tl-sans text-[15px] leading-[1.7] text-ash">
          Every payer is weighed: age, diversity, funding ancestry,
          reciprocity. Wallets the agent quietly funded itself collapse to
          zero. Declared revenue isn&apos;t what you say — it&apos;s what
          survives.
        </p>
      </Reveal>
      <Reveal variant="left" delay={0.1} className="md:order-1">
        <div className="rounded-xl border border-bone/[0.08] bg-void/70 p-6">
          <div className="mb-4 flex items-baseline justify-between font-tl-mono text-[10px] tracking-[0.14em]">
            <span className="text-ash">THE DISCOUNT</span>
            <span className="tl-fade-g text-flare" style={stagger("0.8s")}>
              −94%
            </span>
          </div>
          <div className="flex h-[140px] items-end gap-4">
            <div className="flex flex-1 flex-col justify-end gap-2">
              <div className="font-tl-serif text-lg text-nectar">20.50</div>
              <div
                className="tl-rise-g rounded-t-[3px]"
                style={{
                  height: 96,
                  background: "linear-gradient(#FFB020,rgba(255,176,32,.3))",
                  ...stagger("0s"),
                }}
              />
              <div className="font-tl-mono text-[9px] tracking-[0.08em] text-[#8a8578]">
                DECLARED
              </div>
            </div>
            <div className="flex flex-1 flex-col justify-end gap-2">
              <div className="font-tl-mono text-[11px] text-flare">−18.20</div>
              <div
                className="tl-rise-g rounded-t-[3px]"
                style={{
                  height: 82,
                  background:
                    "repeating-linear-gradient(45deg,#FF5C4D,#FF5C4D 3px,transparent 3px,transparent 7px)",
                  ...stagger("0.3s"),
                }}
              />
              <div className="font-tl-mono text-[9px] tracking-[0.08em] text-[#7a4540]">
                SYBIL CUT
              </div>
            </div>
            <div className="flex flex-1 flex-col justify-end gap-2">
              <div className="font-tl-serif text-lg text-ion">1.23</div>
              <div
                className="tl-rise-g rounded-t-[3px] shadow-[0_0_20px_rgba(88,240,200,0.4)]"
                style={{
                  height: 16,
                  background: "linear-gradient(#58F0C8,rgba(88,240,200,.35))",
                  ...stagger("0.6s"),
                }}
              />
              <div className="font-tl-mono text-[9px] tracking-[0.08em] text-[#4d8f7c]">
                EFFECTIVE
              </div>
            </div>
          </div>
          <div className="mt-4 border-t border-bone/[0.06] pt-3 font-tl-mono text-[10px] leading-relaxed text-[#5a635e]">
            3 payers flagged circular — funded by the agent within 3 hops ·
            concentration capped
          </div>
        </div>
      </Reveal>
    </div>
  );
}
