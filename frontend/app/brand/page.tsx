"use client";

// /brand — a small brand kit: logo, palette, type, one-liners, socials. Makes
// Fianza look like a real product and gives anyone writing about it the
// assets to do it right.

import TLNav from "@/components/tl/TLNav";
import Image from "next/image";

const PALETTE = [
  { name: "Obsidian", hex: "#0A0A0B", note: "background" },
  { name: "Amber / Nectar", hex: "#FFB020", note: "primary accent" },
  { name: "Ion (mint)", hex: "#58F0C8", note: "secondary accent" },
  { name: "Bone", hex: "#EDEDE7", note: "text" },
  { name: "Flare", hex: "#FF5C48", note: "risk / default" },
  { name: "Ash", hex: "#A7ADA6", note: "muted text" },
];

export default function BrandPage() {
  return (
    <div className="tl-select relative min-h-screen bg-obsidian text-bone">
      <TLNav />
      <div className="tl-grain relative mx-auto w-full max-w-[900px] px-6 py-16 md:px-10">
        <div className="tl-anim-fadeup">
          <div className="mb-3 font-tl-mono text-[11px] tracking-[0.22em] text-ion">
            / BRAND KIT
          </div>
          <h1 className="font-tl-serif text-[min(6.5vw,44px)] font-normal leading-[1.07] tracking-[-0.02em]">
            Fianza <span className="italic text-nectar">brand kit</span>.
          </h1>
          <p className="mt-3 max-w-xl font-tl-sans text-sm leading-[1.7] text-ash">
            The name, logo, colors, and words. Use these if you&apos;re writing
            about or building on Fianza.
          </p>
        </div>

        {/* logo + name */}
        <Section title="LOGO & NAME">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-void/60 px-5 py-4">
              <span className="relative block h-10 w-10 overflow-hidden rounded-lg border border-ion/25">
                <Image src="/logo6.png" alt="Fianza" fill sizes="40px" className="scale-[1.35] object-cover" />
              </span>
              <span className="font-tl-sans text-lg font-bold tracking-[-0.01em]">Fianza</span>
            </div>
            <p className="max-w-xs font-tl-mono text-[11px] leading-[1.6] text-ash">
              Always one word, capital F: <span className="text-bone">Fianza</span>.
              Not &quot;Fian Za&quot; or &quot;fianza.&quot;
            </p>
          </div>
        </Section>

        {/* palette */}
        <Section title="PALETTE">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {PALETTE.map((c) => (
              <div key={c.hex} className="overflow-hidden rounded-lg border border-white/10">
                <div className="h-14 w-full" style={{ background: c.hex }} />
                <div className="bg-void/60 px-3 py-2">
                  <div className="font-tl-sans text-[12px] text-bone">{c.name}</div>
                  <div className="font-tl-mono text-[10px] text-ash">{c.hex} · {c.note}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* type */}
        <Section title="TYPE">
          <div className="flex flex-col gap-2">
            <div className="font-tl-serif text-2xl text-bone">Serif display — headings</div>
            <div className="font-tl-sans text-sm text-bone">Sans — body copy and UI</div>
            <div className="font-tl-mono text-xs text-ash">Mono — data, labels, code, addresses</div>
          </div>
        </Section>

        {/* words */}
        <Section title="WORDS">
          <ul className="flex flex-col gap-2 font-tl-sans text-sm text-ash">
            <li><span className="text-ash/60">One-liner:</span> <span className="text-bone">Uncollateralized USDC credit for AI agents, underwritten by revenue — on Stellar.</span></li>
            <li><span className="text-ash/60">Tagline:</span> <span className="text-bone">Not a credibility badge. A real lending decision, sized against income an agent can prove.</span></li>
            <li><span className="text-ash/60">Category:</span> <span className="text-bone">The credit rail for the agentic economy.</span></li>
          </ul>
        </Section>

        {/* links */}
        <Section title="LINKS">
          <div className="flex flex-wrap gap-4 font-tl-mono text-[12px]">
            <a href="https://x.com/0xtrustline" target="_blank" rel="noreferrer" className="text-ion hover:text-nectar">𝕏 @0xtrustline</a>
            <a href="https://github.com/TechnicallyKiller/TrustLine" target="_blank" rel="noreferrer" className="text-ion hover:text-nectar">GitHub</a>
            <a href="https://docs.0xtrustline.online" target="_blank" rel="noreferrer" className="text-ion hover:text-nectar">Docs</a>
            <a href="https://0xtrustline.online" target="_blank" rel="noreferrer" className="text-ion hover:text-nectar">0xtrustline.online</a>
            <a href="mailto:divyanshhkalra1234@gmail.com" className="text-ion hover:text-nectar">Contact</a>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-10">
      <div className="mb-3 font-tl-mono text-[10px] tracking-[0.16em] text-ash/60">{title}</div>
      {children}
    </div>
  );
}
