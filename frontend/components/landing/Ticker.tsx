// Scrolling marquee strip between the brand band and the manifesto.

import { TICKER } from "@/components/landing/data";

export default function Ticker() {
  return (
    <div className="relative z-[1] overflow-hidden border-b border-bone/[0.08] bg-void/70 py-3">
      <div className="tl-ticker font-tl-mono text-[11px] tracking-[0.24em] text-[#4d564f]">
        <span className="whitespace-nowrap">{TICKER.repeat(7)}</span>
        <span aria-hidden className="whitespace-nowrap">
          {TICKER.repeat(7)}
        </span>
      </div>
    </div>
  );
}
