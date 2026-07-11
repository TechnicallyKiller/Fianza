"use client";

// Landing — TrustLine.dc.html "THE MEMBRANE" split hero + manifesto + loop.
// Renders at both / and /waitlist (see app/waitlist/page.tsx).

import Image from "next/image";
import Link from "next/link";
import TLNav from "@/components/tl/TLNav";
import NotifyForm from "@/components/NotifyForm";

const LOOP = [
  { n: "1", t: "Earn", d: "x402 USDC + off-chain", c: "#FFB020" },
  { n: "2", t: "Prove", d: "graph + zkTLS proof", c: "#58F0C8" },
  { n: "3", t: "Score", d: "effective revenue", c: "#58F0C8" },
  { n: "4", t: "Borrow", d: "draw the line", c: "#FFB020" },
  { n: "5", t: "Repay", d: "as it earns", c: "#FFB020" },
];

export default function Home() {
  return (
    <div className="tl-select relative min-h-screen bg-obsidian text-bone">
      <TLNav />

      <div className="tl-grain tl-anim-fadeup relative">
        {/* ===== split hero ===== */}
        <div className="relative z-[1] grid grid-cols-1 md:grid-cols-[1fr_3px_1fr] md:min-h-[74vh]">
          {/* human side */}
          <div className="relative flex flex-col justify-center bg-bone px-[6vw] py-[10vh] text-obsidian">
            <div className="mb-[26px] font-tl-mono text-[11px] tracking-[0.16em] text-[#8a8578]">
              HUMAN · CAPITAL · TRUST →
            </div>
            <div className="font-tl-serif text-[min(15vw,86px)] font-semibold leading-[0.9] tracking-[-0.025em] text-obsidian">
              Warm
              <br />
              money.
            </div>
            <div className="mt-1 font-tl-serif text-[min(15vw,86px)] font-normal italic leading-[0.9] tracking-[-0.025em] text-nectar">
              Real trust.
            </div>
            <p className="mt-[30px] max-w-[340px] font-tl-serif text-[15px] leading-[1.6] text-[#5b564a]">
              Lenders supply USDC into an agent&apos;s own isolated vault and
              earn yield as it repays — capital that flows to machines that
              have proven they earn.
            </p>
          </div>

          {/* seam */}
          <div className="tl-anim-seam hidden bg-gradient-to-b from-nectar to-ion shadow-[0_0_30px_3px_rgba(88,240,200,0.4)] md:block" />
          <div className="h-[3px] w-full bg-gradient-to-r from-nectar to-ion md:hidden" />

          {/* machine side */}
          <div className="relative flex flex-col justify-center overflow-hidden bg-void px-[6vw] py-[10vh] text-right">
            <div className="mb-[26px] font-tl-mono text-[11px] tracking-[0.16em] text-[#4d564f]">
              ← MACHINE · PROOF · SPEED
            </div>
            <div className="font-tl-serif text-[min(15vw,86px)] font-semibold leading-[0.9] tracking-[-0.025em] text-bone">
              Cold
              <br />
              proof.
            </div>
            <div className="mt-1 font-tl-serif text-[min(15vw,86px)] font-normal italic leading-[0.9] tracking-[-0.025em] text-ion">
              Machine speed.
            </div>
            <p className="ml-auto mt-[30px] max-w-[340px] font-tl-serif text-[15px] leading-[1.6] text-[#7d857e]">
              Agents prove revenue on-chain, get scored by an adversarial
              engine, and draw credit in seconds — not a bank&apos;s
              underwriting cycle.
            </p>
            <div className="mt-[26px] flex items-center justify-end gap-2 font-tl-mono text-[10px] leading-[1.7] text-[#3d463f]">
              <span className="tl-anim-blink h-[6px] w-[6px] rounded-full bg-ion" />
              verified on Stellar testnet · settles in seconds
            </div>
          </div>
        </div>

        {/* ===== brand band — the line of credit, made literal ===== */}
        <div className="relative z-[1] overflow-hidden border-y border-bone/[0.08] bg-obsidian">
          <div className="relative h-[220px] w-full sm:h-[280px] lg:h-[320px]">
            <Image
              src="/logo6.png"
              alt="TrustLine emblem — a proven revenue signal resolving into a live line of credit"
              fill
              priority
              sizes="100vw"
              className="object-cover object-center"
            />
            {/* soft edges so the logo's frame melts into the page */}
            <div className="pointer-events-none absolute inset-y-0 left-0 w-[14%] bg-gradient-to-r from-obsidian to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-obsidian/80 to-transparent" />
            <div className="absolute bottom-6 left-[6vw] max-w-[24ch]">
              <div className="mb-2 font-tl-mono text-[11px] tracking-[0.2em] text-ion">
                THE TRUSTLINE
              </div>
              <div className="font-tl-serif text-xl leading-[1.15] text-bone sm:text-2xl">
                One proven signal in — a live line of credit out.
              </div>
            </div>
          </div>
        </div>

        {/* ===== manifesto ===== */}
        <div className="relative z-[1] max-w-[1100px] border-b border-bone/[0.08] px-[6vw] py-[9vh]">
          <div className="mb-[26px] font-tl-mono text-[11px] tracking-[0.2em] text-ion">
            THE MANIFESTO
          </div>
          <h1 className="max-w-[15ch] font-tl-serif text-[min(5.5vw,58px)] font-normal leading-[1.08] tracking-[-0.02em] text-bone">
            Credit that <span className="italic text-nectar">thinks</span>{" "}
            and settles at <span className="text-ion">machine speed.</span>
          </h1>
          <p className="mt-[30px] max-w-[56ch] font-tl-sans text-base leading-[1.7] text-ash">
            An autonomous agent earns real revenue. Today that revenue is
            stranded — no bank underwrites a bot, and collateralized DeFi
            asks it to already be rich. TrustLine reads the agent&apos;s
            provable, on-chain income, discounts everything it can&apos;t
            verify, and extends an{" "}
            <span className="text-bone">uncollateralized</span> USDC credit
            line it can draw against and repay as it earns. Underwriting
            that runs in seconds, and bites when the revenue is fake.
          </p>
        </div>

        {/* ===== lifecycle strip ===== */}
        <div className="relative z-[1] px-[6vw] py-[8vh]">
          <div className="mb-9 font-tl-mono text-[11px] tracking-[0.2em] text-ash">
            THE LOOP · earn → prove → score → borrow → repay
          </div>
          <div className="relative grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5 lg:gap-0">
            <div className="absolute left-[6%] right-[6%] top-[15px] hidden h-[2px] bg-gradient-to-r from-nectar via-ion to-nectar lg:block" />
            {LOOP.map((step, i) => (
              <div
                key={step.n}
                className="tl-anim-fadeup relative pr-5"
                style={{ animationDelay: `${i * 0.08}s` }}
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
                <div className="font-tl-mono text-xs text-[#5a635e]">
                  {step.d}
                </div>
              </div>
            ))}
          </div>

          <Link
            href="/underwrite"
            className="mt-[60px] inline-flex items-center gap-3 rounded-lg bg-nectar px-[26px] py-4 font-tl-sans text-[15px] font-semibold text-obsidian transition-colors hover:bg-ion"
          >
            Underwrite a live address <span className="font-tl-mono">→</span>
          </Link>
          <div className="mt-[18px] font-tl-mono text-xs text-[#5a635e]">
            paste any Stellar address — watch the verdict resolve
          </div>
        </div>

        {/* ===== join / waitlist ===== */}
        <div id="join" className="relative z-[1] border-t border-bone/[0.08] px-[6vw] py-[9vh]">
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
        </div>

        <footer className="border-t border-bone/[0.08] py-8 text-center font-tl-mono text-xs text-[#4d564f]">
          © TrustLine — Stellar testnet
        </footer>
      </div>
    </div>
  );
}
