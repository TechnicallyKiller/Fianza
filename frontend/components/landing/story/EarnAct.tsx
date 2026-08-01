// ACT 01 · EARN — live-looking payment feed proving the agent's on-chain income.

import Reveal from "@/components/tl/Reveal";
import CountUp from "@/components/tl/CountUp";
import { PAYMENTS, stagger } from "@/components/landing/data";

export default function EarnAct() {
  return (
    <div className="grid items-center gap-10 md:grid-cols-2">
      <Reveal variant="left">
        <div className="font-tl-mono text-[11px] tracking-[0.2em] text-ion">
          ACT 01 · EARN
        </div>
        <h3 className="mt-3 font-tl-serif text-[28px] leading-[1.15] text-bone">
          It earns — for real.
        </h3>
        <p className="mt-4 max-w-[44ch] font-tl-sans text-[15px] leading-[1.7] text-ash">
          A research agent answers x402-priced calls. Every payment lands
          on-chain — payer, amount, ledger, hash. Nothing is declared on a
          form; everything is observable.
        </p>
      </Reveal>
      <Reveal variant="right" delay={0.1}>
        <div className="rounded-xl border border-bone/[0.08] bg-void/70 p-6">
          <div className="mb-4 flex items-baseline justify-between font-tl-mono text-[10px] tracking-[0.14em]">
            <span className="text-ash">INCOMING · USDC SAC</span>
            <span className="tl-anim-blink text-ion">● live</span>
          </div>
          <div className="flex flex-col">
            {PAYMENTS.map((p, i) => (
              <div
                key={p.id}
                className="tl-fade-g flex items-center justify-between border-t border-bone/[0.05] py-2.5 font-tl-mono text-xs"
                style={stagger(`${0.25 + i * 0.3}s`)}
              >
                <span className="flex items-center gap-2 text-ash">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      background: p.ok ? "#58F0C8" : "#FFB020",
                      boxShadow: `0 0 6px ${p.ok ? "#58F0C8" : "#FFB020"}`,
                    }}
                  />
                  {p.id}
                </span>
                <span className={p.ok ? "text-ion" : "text-nectar"}>
                  {p.amt}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 border-t border-bone/[0.06] pt-3 font-tl-mono text-[11px] text-[#5a635e]">
            total indexed ·{" "}
            <CountUp to={20.5} decimals={1} duration={1600} className="text-bone" />{" "}
            USDC · 6 distinct payers
          </div>
        </div>
      </Reveal>
    </div>
  );
}
