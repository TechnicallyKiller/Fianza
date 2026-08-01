// The scroll-driven story — one agent's life, earn → prove → borrow → repay
// — with real testnet numbers behind each act.

import Reveal from "@/components/tl/Reveal";
import EarnAct from "@/components/landing/story/EarnAct";
import ProveAct from "@/components/landing/story/ProveAct";
import BorrowAct from "@/components/landing/story/BorrowAct";
import RepayAct from "@/components/landing/story/RepayAct";

export default function AgentStory() {
  return (
    <div className="relative z-[1] border-b border-bone/[0.08] px-[6vw] py-[10vh]">
      <Reveal variant="fade">
        <div className="mb-2 font-tl-mono text-[11px] tracking-[0.2em] text-nectar">
          ONE AGENT&apos;S STORY · real testnet numbers
        </div>
        <h2 className="max-w-[18ch] font-tl-serif text-[min(4.6vw,44px)] leading-[1.1] tracking-[-0.02em] text-bone">
          Scroll through a <span className="italic text-ion">life on the line.</span>
        </h2>
      </Reveal>

      <div className="mt-[8vh] flex flex-col gap-[11vh]">
        <EarnAct />
        <ProveAct />
        <BorrowAct />
        <RepayAct />
      </div>
    </div>
  );
}
