// Brand band — "the line of credit, made literal": the emblem image with a
// short caption overlaid on the bottom-left corner.

import Image from "next/image";
import Reveal from "@/components/tl/Reveal";

export default function BrandBand() {
  return (
    <div className="tl-sweep relative z-[1] overflow-hidden border-y border-bone/[0.08] bg-obsidian">
      <div className="relative h-[220px] w-full sm:h-[280px] lg:h-[320px]">
        <Image
          src="/brand-band.png"
          alt="Fianza emblem — a proven revenue signal resolving into a live line of credit"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        {/* soft edges so the logo's frame melts into the page */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-[14%] bg-gradient-to-r from-obsidian to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-obsidian/80 to-transparent" />
        <div className="absolute bottom-6 left-[6vw] max-w-[24ch]">
          <Reveal variant="left">
            <div className="mb-2 font-tl-mono text-[11px] tracking-[0.2em] text-ion">
              THE FIANZA
            </div>
            <div className="font-tl-serif text-xl leading-[1.15] text-bone sm:text-2xl">
              One proven signal in — a live line of credit out.
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
