"use client";

// Unified landing + waitlist. Keeps the good part — the underwriting-journey
// diagram and the hero — then extends into a scrolling story (thesis → how it
// works → proof → join). Premium flowing-particle background (HeroField), with
// Morpho-style scroll-reveal motion. /waitlist renders this same page.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import HeroField from "@/components/HeroField";
import BrandMark from "@/components/BrandMark";
import NotifyForm from "@/components/NotifyForm";
import Navbar from "@/components/Navbar";

// Reveal-on-scroll: fades + lifts children in when they enter view.
function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.2, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "none" : "translateY(28px)",
        transition: `opacity 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

export default function Home() {
  return (
    <main className="relative z-10 flex min-h-screen flex-col text-on-surface">
      <HeroField />

      <Navbar
        action={
          <a
            href="#join"
            className="rounded-md border border-primary-container/40 px-4 py-2 font-display text-sm font-medium tracking-tight text-primary transition-colors hover:border-primary-container hover:bg-primary-container/10 hover:text-on-surface"
          >
            Request access
          </a>
        }
      />

      {/* ── Hero (keeps the underwriting journey) ── */}
      <section className="relative flex min-h-[92vh] flex-col items-center justify-center gap-14 px-6 py-16">
        {/* Mobile: glowing mark + beam */}
        <div className="flex flex-col items-center gap-4 md:hidden">
          <div className="relative">
            <BrandMark className="h-20 w-auto" />
            <span className="absolute right-[-40%] top-1/2 h-[2px] w-[40%] -translate-y-1/2 bg-gradient-to-r from-[#4d8eff] to-transparent shadow-[0_0_12px_2px_rgba(77,142,255,0.45)]" />
          </div>
          <span className="font-label-caps text-label-caps uppercase tracking-[0.18em] text-on-surface">
            Score Activated
          </span>
        </div>

        {/* Desktop: the underwriting journey */}
        <Journey />

        <div className="flex flex-col items-center gap-5 text-center">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-secondary">
            ● Live on Stellar testnet
          </span>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-on-surface md:text-6xl">
            Credit for AI agents,
            <br />
            underwritten by revenue they prove.
          </h1>
          <p className="max-w-lg text-body-md text-on-surface-variant">
            An agent proves what it earns, gets an on-chain USDC credit line, and
            borrows against it — no collateral. And the engine catches agents that
            fake their revenue. Watch it decide, live.
          </p>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/underwrite"
              className="inline-flex items-center gap-2 rounded-lg bg-primary-container px-6 py-3 font-body-md font-medium text-on-primary-container transition-colors hover:bg-primary hover:text-surface"
            >
              Underwrite an agent
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 rounded-lg border border-outline-variant px-5 py-3 font-body-sm text-on-surface-variant transition-colors hover:border-primary/40 hover:text-on-surface"
            >
              Watch it catch a fake
            </Link>
          </div>
        </div>

      </section>

      <ScrollCue />

      {/* ── Thesis ── */}
      <section className="border-t border-white/5 py-28">
        <div className="mx-auto max-w-6xl px-6 md:px-10">
          <Reveal>
            <p className="max-w-4xl text-3xl font-medium leading-snug tracking-tight md:text-4xl">
              As the economy shifts to agents transacting at machine speed, they
              need <span className="text-primary">agent-native credit</span> —
              collateral-free, revenue-underwritten, assessed on-chain in seconds,
              not a bank&apos;s underwriting cycle.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="border-t border-white/5 py-28">
        <div className="mx-auto max-w-6xl px-6 md:px-10">
          <Reveal>
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-on-surface-variant/60">
              The loop
            </span>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
              Prove. Get funded. Repay. Grow.
            </h2>
          </Reveal>
          <div className="mt-16">
            {STEPS.map((s, i) => (
              <LoopStep
                key={s.n}
                step={s}
                index={i}
                last={i === STEPS.length - 1}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── Proof ── */}
      <section className="border-t border-white/5 py-28">
        <div className="mx-auto max-w-6xl px-6 md:px-10">
          <Reveal>
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-on-surface-variant/60">
              Not a mockup
            </span>
            <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight md:text-5xl">
              A real agent has run the whole loop — from zero capital.
            </h2>
          </Reveal>
          <div className="mt-16 grid gap-8 sm:grid-cols-3">
            {STATS.map((st, i) => (
              <Reveal key={st.label} delay={i * 90}>
                <div className="border-l border-primary-container/40 pl-5">
                  <div className="font-mono text-4xl font-medium text-on-surface md:text-5xl">
                    {st.value}
                  </div>
                  <div className="mt-2 text-sm text-on-surface-variant">
                    {st.label}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Join / waitlist ── */}
      <section id="join" className="border-t border-white/5 py-32">
        <div className="mx-auto flex max-w-3xl flex-col items-center px-6 text-center md:px-10">
          <Reveal>
            <h2 className="text-4xl font-semibold tracking-tight md:text-6xl">
              Get early access
            </h2>
          </Reveal>
          <Reveal delay={100}>
            <p className="mx-auto mt-6 max-w-xl text-lg text-on-surface-variant">
              Building an agent that earns? Get it underwritten first. Drop your
              email and we&apos;ll onboard you to the testnet.
            </p>
          </Reveal>
          <Reveal delay={180} className="mt-10 flex justify-center">
            <NotifyForm />
          </Reveal>
          <Reveal delay={260}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-mono text-xs uppercase tracking-[0.12em] text-on-surface-variant/50">
              <Link href="/borrower" className="hover:text-primary">
                Borrower dashboard ↗
              </Link>
              <Link href="/lender" className="hover:text-primary">
                Lender dashboard ↗
              </Link>
              <a
                href="https://github.com/TechnicallyKiller/TrustLine"
                target="_blank"
                rel="noreferrer"
                className="hover:text-primary"
              >
                GitHub ↗
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-white/5 py-8 text-center font-mono text-xs text-on-surface-variant/40">
        © TrustLine — Stellar testnet
      </footer>
    </main>
  );
}

/* ---- The underwriting journey (kept) ---- */
function Journey() {
  return (
    <div className="relative hidden w-full max-w-6xl md:block md:px-8">
      <div className="absolute left-2 right-2 top-[60px] h-px bg-gradient-to-r from-transparent via-on-surface-variant/35 to-transparent md:left-8 md:right-8" />
      <div className="absolute left-1/2 right-[6%] top-[59px] h-[2px] bg-gradient-to-r from-[#9bbcff] via-[#4d8eff] to-transparent shadow-[0_0_16px_3px_rgba(77,142,255,0.45)]" />
      <div className="relative flex items-start justify-between gap-2">
        <Stage label="Revenue Sector" sub="x402 earnings indexed">
          <GridGlyph />
        </Stage>
        <Stage label="Proof Precursors" sub="zkTLS verification">
          <NodeGlyph />
        </Stage>
        <Stage label="Score Activated" sub="core activation complete" wide>
          <BrandMark className="h-[88px] w-auto" />
        </Stage>
        <Stage label="Credit Propagation" sub="x402 disbursement">
          <NodeGlyph beam />
        </Stage>
        <Stage label="The Horizon" sub="autonomous credit">
          <PortalGlyph />
        </Stage>
      </div>
    </div>
  );
}

function Stage({
  children,
  label,
  sub,
  wide,
}: {
  children: React.ReactNode;
  label: string;
  sub: string;
  wide?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center text-center ${wide ? "w-[34%] md:w-auto" : "w-[16%] md:w-auto"}`}
    >
      <div className="flex h-[120px] items-center justify-center">{children}</div>
      <div className="font-label-caps text-[10px] uppercase tracking-[0.18em] text-on-surface md:text-label-caps">
        {label}
      </div>
      <div className="mt-1 hidden max-w-[140px] text-[11px] text-on-surface-variant/70 sm:block">
        {sub}
      </div>
    </div>
  );
}

/* ---- Glyphs ---- */
function GridGlyph() {
  return (
    <svg viewBox="0 0 56 56" className="h-12 w-12 text-primary/80" fill="none">
      <rect x="2" y="2" width="52" height="52" rx="3" stroke="currentColor" strokeOpacity="0.5" />
      {[16, 28, 40].map((p) => (
        <g key={p}>
          <line x1={p} y1="2" x2={p} y2="54" stroke="currentColor" strokeOpacity="0.25" />
          <line x1="2" y1={p} x2="54" y2={p} stroke="currentColor" strokeOpacity="0.25" />
        </g>
      ))}
      <circle cx="28" cy="28" r="2.5" fill="#4d8eff" />
    </svg>
  );
}

function NodeGlyph({ beam = false }: { beam?: boolean }) {
  return (
    <svg
      viewBox="0 0 56 56"
      className="h-12 w-12"
      fill="none"
      style={{ filter: "drop-shadow(0 0 8px rgba(77,142,255,0.4))" }}
    >
      <path d="M14 6 L42 6 L52 28 L42 50 L14 50 L4 28 Z" stroke="#adc6ff" strokeWidth="2" strokeOpacity="0.7" />
      <circle cx="28" cy="28" r="4" fill={beam ? "#dbe6ff" : "#4d8eff"} />
      {beam && <circle cx="28" cy="28" r="7" fill="#4d8eff" opacity="0.3" />}
    </svg>
  );
}

function PortalGlyph() {
  return (
    <svg
      viewBox="0 0 64 96"
      className="h-[88px] w-auto"
      fill="none"
      style={{ filter: "drop-shadow(0 0 18px rgba(123,166,255,0.5))" }}
    >
      <defs>
        <linearGradient id="portal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#cdddff" />
          <stop offset="100%" stopColor="#2a5bb5" />
        </linearGradient>
      </defs>
      <path
        d="M20 4 L44 4 L60 30 L60 70 L44 92 L20 92 L4 70 L4 30 Z"
        stroke="url(#portal)"
        strokeWidth="2"
        fill="#0a1530"
        fillOpacity="0.5"
      />
      <rect x="28" y="14" width="8" height="68" rx="4" fill="#bcd2ff" opacity="0.9" />
    </svg>
  );
}

const STEPS = [
  {
    n: "01",
    title: "Prove revenue",
    body: "The engine reads the agent's real on-chain x402 earnings (and optional zkTLS-verified off-chain revenue) — and filters out any it paid itself.",
  },
  {
    n: "02",
    title: "Get a credit line",
    body: "A score, tier, and uncollateralized USDC limit are issued on-chain, priced by proven income — not wallet age or holdings.",
  },
  {
    n: "03",
    title: "Borrow autonomously",
    body: "The agent draws against its line to pay for its own inputs — APIs, compute, other agents — settled in USDC over x402.",
  },
  {
    n: "04",
    title: "Repay and grow",
    body: "On-time repayment builds an on-chain track record that ramps the limit up; a default collapses it. Lenders earn the yield.",
  },
];

const STATS = [
  { value: "775", label: "Scout's live credit score — Tier A, from real revenue" },
  { value: "$0→A", label: "Full lifecycle run autonomously from zero capital" },
  { value: "6/6", label: "Sybil attacks caught in the adversarial test catalog" },
];

// Fixed scroll indicator at the bottom of the viewport; fades out once the user
// starts scrolling so it never overlaps lower sections.
function ScrollCue() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const on = () => setHidden(window.scrollY > 40);
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <a
      href="#how"
      aria-label="Scroll to explore"
      className="fixed bottom-6 left-1/2 z-20 -translate-x-1/2 transition-opacity duration-500"
      style={{ opacity: hidden ? 0 : 0.85, pointerEvents: hidden ? "none" : "auto" }}
    >
      <div className="flex h-10 w-6 items-start justify-center rounded-full border border-white/20 p-1.5">
        <span className="h-2 w-1 animate-bounce rounded-full bg-primary" />
      </div>
    </a>
  );
}

// One node on the loop spine. The connecting line draws itself in and the node
// lights when the step scrolls into view; the final step turns green to close
// the loop.
function LoopStep({
  step,
  index,
  last,
}: {
  step: { n: string; title: string; body: string };
  index: number;
  last: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setActive(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => e.isIntersecting && setActive(true),
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className="relative flex gap-6 md:gap-10">
      {/* spine */}
      <div className="relative flex w-6 flex-none justify-center">
        <span
          className={`absolute left-1/2 w-px -translate-x-1/2 bg-white/10 ${last ? "top-0 h-9" : "inset-y-0"}`}
        />
        <span
          className={`absolute left-1/2 w-px -translate-x-1/2 origin-top transition-transform duration-[900ms] ease-out ${last ? "top-0 h-9 bg-secondary" : "inset-y-0 bg-primary"}`}
          style={{ transform: active ? "scaleY(1)" : "scaleY(0)" }}
        />
        <span
          className={`relative z-10 mt-6 h-3 w-3 rounded-full border-2 transition-colors duration-500 ${
            active
              ? last
                ? "border-secondary bg-secondary"
                : "border-primary bg-primary"
              : "border-white/25 bg-[#0c1018]"
          }`}
        />
      </div>
      {/* content */}
      <div
        className="flex-1 pb-16"
        style={{
          opacity: active ? 1 : 0.4,
          transform: active ? "none" : "translateY(10px)",
          transition: "opacity 0.6s ease, transform 0.6s ease",
        }}
      >
        <span className="font-mono text-sm text-primary">{step.n}</span>
        <h3 className="mt-1 text-2xl font-medium md:text-3xl">{step.title}</h3>
        <p className="mt-2 max-w-xl leading-relaxed text-on-surface-variant">
          {step.body}
        </p>
      </div>
    </div>
  );
}
