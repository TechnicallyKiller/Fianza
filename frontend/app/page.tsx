"use client";

// Landing — Fianza.dc.html "THE MEMBRANE" split hero + a scroll-driven
// story (earn → get read → draw the line → build a name) + manifesto + loop.
// Scroll system: components/tl/Reveal (IntersectionObserver adds .tl-in,
// gating the .tl-*-g child animations defined in globals.css).
// Renders at both / and /waitlist (see app/waitlist/page.tsx).

import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import TLNav from "@/components/tl/TLNav";
import NotifyForm from "@/components/NotifyForm";
import Reveal from "@/components/tl/Reveal";
import CountUp from "@/components/tl/CountUp";
import ScrollProgress from "@/components/tl/ScrollProgress";

const LOOP = [
  { n: "1", t: "Earn", d: "x402 USDC + off-chain", c: "#FFB020" },
  { n: "2", t: "Prove", d: "graph + zkTLS proof", c: "#58F0C8" },
  { n: "3", t: "Score", d: "effective revenue", c: "#58F0C8" },
  { n: "4", t: "Borrow", d: "draw the line", c: "#FFB020" },
  { n: "5", t: "Repay", d: "as it earns", c: "#FFB020" },
];

// Real numbers from the live honest-agent underwrite (Scout, testnet):
// declared 20.50 USDC / 6 payers → effective 1.23 (−94%), score 575 Tier C,
// lifted to 775 Tier A by the zkTLS off-chain revenue proof.
const PAYMENTS = [
  { id: "payer·GBEF…QHDE", amt: "+0.50", ok: true },
  { id: "payer·GCW6…YPAF", amt: "+0.50", ok: true },
  { id: "payer·GAEX…SR77", amt: "+0.50", ok: true },
  { id: "payer·GBHC…RDJ6", amt: "+3.00", ok: false },
];

const TICKER = "EARN → PROVE → SCORE → BORROW → REPAY → LENDER YIELD · ";

/** Stagger helper for gated child animations. */
const d = (s: string): CSSProperties => ({ "--d": s }) as CSSProperties;

export default function Home() {
  return (
    <div className="tl-select relative min-h-screen bg-obsidian text-bone">
      <ScrollProgress />
      <TLNav />

      <div className="tl-grain relative">
        {/* ===== split hero ===== */}
        <div className="relative z-[1] grid grid-cols-1 md:grid-cols-[1fr_3px_1fr] md:min-h-[74vh]">
          {/* human side */}
          <div className="tl-anim-hero-l relative flex flex-col justify-center bg-bone px-[6vw] py-[10vh] text-obsidian">
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
          <div className="tl-anim-hero-r relative flex flex-col justify-center overflow-hidden bg-void px-[6vw] py-[10vh] text-right">
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

        {/* ===== ticker ===== */}
        <div className="relative z-[1] overflow-hidden border-b border-bone/[0.08] bg-void/70 py-3">
          <div className="tl-ticker font-tl-mono text-[11px] tracking-[0.24em] text-[#4d564f]">
            <span className="whitespace-nowrap">{TICKER.repeat(7)}</span>
            <span aria-hidden className="whitespace-nowrap">
              {TICKER.repeat(7)}
            </span>
          </div>
        </div>

        {/* ===== manifesto ===== */}
        <div className="relative z-[1] max-w-[1100px] border-b border-bone/[0.08] px-[6vw] py-[9vh]">
          <Reveal variant="fade">
            <div className="mb-[26px] font-tl-mono text-[11px] tracking-[0.2em] text-ion">
              THE MANIFESTO
            </div>
            <h1 className="max-w-[15ch] font-tl-serif text-[min(5.5vw,58px)] font-normal leading-[1.08] tracking-[-0.02em] text-bone">
              Credit that <span className="italic text-nectar">thinks</span>{" "}
              and settles at <span className="text-ion">machine speed.</span>
            </h1>
          </Reveal>
          <Reveal variant="up" delay={0.15}>
            <p className="mt-[30px] max-w-[56ch] font-tl-sans text-base leading-[1.7] text-ash">
              An autonomous agent earns real revenue. Today that revenue is
              stranded — no bank underwrites a bot, and collateralized DeFi
              asks it to already be rich. Fianza reads the agent&apos;s
              provable, on-chain income, discounts everything it can&apos;t
              verify, and extends an{" "}
              <span className="text-bone">uncollateralized</span> USDC credit
              line it can draw against and repay as it earns. Underwriting
              that runs in seconds, and bites when the revenue is fake.
            </p>
          </Reveal>
        </div>

        {/* ===== the story — one agent's life, unfolding on scroll ===== */}
        <div className="relative z-[1] border-b border-bone/[0.08] px-[6vw] py-[10vh]">
          <Reveal variant="fade">
            <div className="mb-2 font-tl-mono text-[11px] tracking-[0.2em] text-nectar">
              ONE AGENT&apos;S STORY · real testnet numbers
            </div>
            <h2 className="max-w-[18ch] font-tl-serif text-[min(4.6vw,44px)] leading-[1.1] tracking-[-0.02em] text-bone">
              Scroll through a{" "}
              <span className="italic text-ion">life on the line.</span>
            </h2>
          </Reveal>

          <div className="mt-[8vh] flex flex-col gap-[11vh]">
            {/* ACT 01 — EARN */}
            <div className="grid items-center gap-10 md:grid-cols-2">
              <Reveal variant="left">
                <div className="font-tl-mono text-[11px] tracking-[0.2em] text-ion">
                  ACT 01 · EARN
                </div>
                <h3 className="mt-3 font-tl-serif text-[28px] leading-[1.15] text-bone">
                  It earns — for real.
                </h3>
                <p className="mt-4 max-w-[44ch] font-tl-sans text-[15px] leading-[1.7] text-ash">
                  A research agent answers x402-priced calls. Every payment
                  lands on-chain — payer, amount, ledger, hash. Nothing is
                  declared on a form; everything is observable.
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
                        style={d(`${0.25 + i * 0.3}s`)}
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
                    <CountUp
                      to={20.5}
                      decimals={1}
                      duration={1600}
                      className="text-bone"
                    />{" "}
                    USDC · 6 distinct payers
                  </div>
                </div>
              </Reveal>
            </div>

            {/* ACT 02 — PROVE */}
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
                  reciprocity. Wallets the agent quietly funded itself collapse
                  to zero. Declared revenue isn&apos;t what you say — it&apos;s
                  what survives.
                </p>
              </Reveal>
              <Reveal variant="left" delay={0.1} className="md:order-1">
                <div className="rounded-xl border border-bone/[0.08] bg-void/70 p-6">
                  <div className="mb-4 flex items-baseline justify-between font-tl-mono text-[10px] tracking-[0.14em]">
                    <span className="text-ash">THE DISCOUNT</span>
                    <span className="tl-fade-g text-flare" style={d("0.8s")}>
                      −94%
                    </span>
                  </div>
                  <div className="flex h-[140px] items-end gap-4">
                    <div className="flex flex-1 flex-col justify-end gap-2">
                      <div className="font-tl-serif text-lg text-nectar">
                        20.50
                      </div>
                      <div
                        className="tl-rise-g rounded-t-[3px]"
                        style={{
                          height: 96,
                          background:
                            "linear-gradient(#FFB020,rgba(255,176,32,.3))",
                          ...d("0s"),
                        }}
                      />
                      <div className="font-tl-mono text-[9px] tracking-[0.08em] text-[#8a8578]">
                        DECLARED
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col justify-end gap-2">
                      <div className="font-tl-mono text-[11px] text-flare">
                        −18.20
                      </div>
                      <div
                        className="tl-rise-g rounded-t-[3px]"
                        style={{
                          height: 82,
                          background:
                            "repeating-linear-gradient(45deg,#FF5C4D,#FF5C4D 3px,transparent 3px,transparent 7px)",
                          ...d("0.3s"),
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
                          background:
                            "linear-gradient(#58F0C8,rgba(88,240,200,.35))",
                          ...d("0.6s"),
                        }}
                      />
                      <div className="font-tl-mono text-[9px] tracking-[0.08em] text-[#4d8f7c]">
                        EFFECTIVE
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 border-t border-bone/[0.06] pt-3 font-tl-mono text-[10px] leading-relaxed text-[#5a635e]">
                    3 payers flagged circular — funded by the agent within 3
                    hops · concentration capped
                  </div>
                </div>
              </Reveal>
            </div>

            {/* ACT 03 — BORROW */}
            <div className="grid items-center gap-10 md:grid-cols-2">
              <Reveal variant="left">
                <div className="font-tl-mono text-[11px] tracking-[0.2em] text-nectar">
                  ACT 03 · BORROW
                </div>
                <h3 className="mt-3 font-tl-serif text-[28px] leading-[1.15] text-bone">
                  The line draws itself.
                </h3>
                <p className="mt-4 max-w-[44ch] font-tl-sans text-[15px] leading-[1.7] text-ash">
                  Mid-job, the agent hits a paywall it can&apos;t afford.
                  Instead of dying, the shortfall borrows against its credit
                  line and pays over x402 — no human, no top-up, no pause.
                </p>
                <Link
                  href="/demo"
                  className="mt-5 inline-flex items-center gap-2 font-tl-mono text-xs text-ion transition-colors hover:text-nectar"
                >
                  watch this exact run live →
                </Link>
              </Reveal>
              <Reveal variant="right" delay={0.1}>
                <div className="rounded-xl border border-bone/[0.08] bg-void/70 p-6">
                  <div className="flex items-baseline justify-between font-tl-mono text-[10px] tracking-[0.14em]">
                    <span className="text-ash">CREDIT LINE</span>
                    <span className="text-nectar">open · isolated vault</span>
                  </div>
                  <div className="mt-4 h-[10px] overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="tl-grow-g h-full w-[62%] rounded-full bg-gradient-to-r from-nectar to-ion shadow-[0_0_14px_rgba(255,176,32,0.35)]"
                      style={d("0.2s")}
                    />
                  </div>
                  <div className="mt-2 flex justify-between font-tl-mono text-[9px] text-[#5a635e]">
                    <span>drawn</span>
                    <span>headroom</span>
                  </div>
                  <div
                    className="tl-fade-g mt-5 rounded-lg border border-flare/25 bg-flare/[0.05] px-4 py-3 font-tl-mono text-[11px] text-ash"
                    style={d("0.7s")}
                  >
                    402 Payment Required · 3.00 USDC — balance 0.42
                  </div>
                  <div
                    className="tl-fade-g mt-2 rounded-lg border border-ion/25 bg-ion/[0.06] px-4 py-3 font-tl-mono text-[11px] text-ion"
                    style={d("1.15s")}
                  >
                    shortfall drawn against the line → paid over x402 ✓
                  </div>
                </div>
              </Reveal>
            </div>

            {/* ACT 04 — REPAY */}
            <div className="grid items-center gap-10 md:grid-cols-2">
              <Reveal variant="right" className="md:order-2">
                <div className="font-tl-mono text-[11px] tracking-[0.2em] text-ion">
                  ACT 04 · REPAY
                </div>
                <h3 className="mt-3 font-tl-serif text-[28px] leading-[1.15] text-bone">
                  Repayment becomes reputation.
                </h3>
                <p className="mt-4 max-w-[44ch] font-tl-sans text-[15px] leading-[1.7] text-ash">
                  It repays as revenue lands. On-time history ramps the limit
                  up; a zkTLS proof of off-chain revenue lifts the score. Miss
                  the term, and the same machinery bites back — default,
                  collapsed score, socialized loss.
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
                          style={d("1.4s")}
                        >
                          C
                        </span>
                        <span
                          className="tl-fade-g absolute inset-0 text-ion"
                          style={d("1.5s")}
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
                        ...d("0.3s"),
                      }}
                    />
                  </svg>
                  <div className="mt-3 font-tl-mono text-[10px] leading-relaxed text-[#5a635e]">
                    on-time repayments recorded on-chain · zkTLS off-chain
                    proof carries 1.5× weight
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </div>

        {/* ===== lifecycle strip ===== */}
        <div className="relative z-[1] px-[6vw] py-[8vh]">
          <Reveal variant="fade">
            <div className="mb-9 font-tl-mono text-[11px] tracking-[0.2em] text-ash">
              THE LOOP · earn → prove → score → borrow → repay
            </div>
            <div className="relative grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5 lg:gap-0">
              <div
                className="tl-grow-g absolute left-[6%] right-[6%] top-[15px] hidden h-[2px] bg-gradient-to-r from-nectar via-ion to-nectar lg:block"
                style={d("0.15s")}
              />
              {LOOP.map((step, i) => (
                <div
                  key={step.n}
                  className="tl-fade-g relative pr-5"
                  style={d(`${0.2 + i * 0.12}s`)}
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

        {/* ===== join / waitlist ===== */}
        <div
          id="join"
          className="relative z-[1] border-t border-bone/[0.08] px-[6vw] py-[9vh]"
        >
          <Reveal variant="up">
            <div className="mb-[18px] font-tl-mono text-[11px] tracking-[0.2em] text-nectar">
              GET EARLY ACCESS
            </div>
            <h2 className="max-w-[20ch] font-tl-serif text-[min(4vw,38px)] leading-[1.15] tracking-[-0.02em] text-bone">
              Building an agent that earns?{" "}
              <span className="italic text-nectar">
                Get it underwritten first.
              </span>
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
          </Reveal>
        </div>

        <footer className="border-t border-bone/[0.08] py-8 text-center font-tl-mono text-xs text-[#4d564f]">
          © Fianza — Stellar testnet
        </footer>
      </div>
    </div>
  );
}
