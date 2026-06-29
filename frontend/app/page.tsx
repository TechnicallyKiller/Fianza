import Link from "next/link";
import CinematicBackground from "@/components/CinematicBackground";
import BrandMark from "@/components/BrandMark";
import NotifyForm from "@/components/NotifyForm";

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden">
      <CinematicBackground />

      {/* HUD frame */}
      <div className="pointer-events-none absolute inset-3 rounded border border-on-surface-variant/15 md:inset-5" />
      <Corner className="left-3 top-3 md:left-5 md:top-5" />
      <Corner className="right-3 top-3 rotate-90 md:right-5 md:top-5" />
      <Corner className="bottom-3 left-3 -rotate-90 md:bottom-5 md:left-5" />
      <Corner className="bottom-3 right-3 rotate-180 md:bottom-5 md:right-5" />

      {/* Top HUD labels */}
      <header className="relative z-10 flex items-center justify-between px-6 pt-6 font-label-caps text-label-caps uppercase tracking-[0.2em] text-on-surface-variant/70 md:px-10">
        <span>Sector A · x402</span>
        <span className="hidden text-primary/90 sm:inline">
          TrustLine // On-chain credit for AI agents
        </span>
        <span>Node Δ · Testnet</span>
      </header>

      {/* Center stage */}
      <section className="relative z-10 flex flex-1 flex-col items-center justify-center gap-14 px-6 py-10">
        {/* Mobile: just the glowing mark + beam */}
        <div className="flex flex-col items-center gap-4 md:hidden">
          <div className="relative">
            <BrandMark className="h-20 w-auto" />
            <span className="absolute right-[-40%] top-1/2 h-[2px] w-[40%] -translate-y-1/2 bg-gradient-to-r from-[#4d8eff] to-transparent shadow-[0_0_12px_2px_rgba(77,142,255,0.45)]" />
          </div>
          <span className="font-label-caps text-label-caps uppercase tracking-[0.18em] text-on-surface">
            Score Activated
          </span>
        </div>
        {/* Desktop: full underwriting journey */}
        <Journey />

        <div className="flex flex-col items-center gap-5 text-center">
          <h1 className="text-5xl font-bold tracking-tight text-on-surface md:text-7xl">
            COMING SOON
          </h1>
          <div className="flex items-center gap-3 text-on-surface-variant">
            <span className="h-px w-8 bg-on-surface-variant/40" />
            <span className="font-label-caps text-label-caps uppercase tracking-[0.25em]">
              The line opens soon
            </span>
            <span className="h-px w-8 bg-on-surface-variant/40" />
          </div>
          <p className="max-w-md text-body-md text-on-surface-variant">
            Credit for AI agents, underwritten by revenue they can prove.
          </p>
          <div className="mt-2">
            <NotifyForm />
          </div>

          {/* Access points — preview the product + sample dashboards */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-label-caps text-label-caps uppercase tracking-[0.18em] text-on-surface-variant/60">
            <Link href="/preview" className="transition-colors hover:text-primary">
              Early preview ↗
            </Link>
            <span className="text-on-surface-variant/30">/</span>
            <Link href="/borrower" className="transition-colors hover:text-primary">
              Agent demo ↗
            </Link>
            <span className="text-on-surface-variant/30">/</span>
            <Link href="/lender" className="transition-colors hover:text-primary">
              Lender demo ↗
            </Link>
          </div>
        </div>
      </section>

      {/* Bottom HUD */}
      <footer className="relative z-10 flex items-center justify-between px-6 pb-6 font-data-md text-data-md text-on-surface-variant/50 md:px-10">
        <span>34.07°N / 118.24°W</span>
        <Diamond />
      </footer>
    </main>
  );
}

/* ---- The underwriting journey ---- */
function Journey() {
  return (
    <div className="relative hidden w-full max-w-6xl md:block md:px-8">
      {/* baseline connector */}
      <div className="absolute left-2 right-2 top-[60px] h-px bg-gradient-to-r from-transparent via-on-surface-variant/35 to-transparent md:left-8 md:right-8" />
      {/* energy beam: score → horizon */}
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
      <path
        d="M14 6 L42 6 L52 28 L42 50 L14 50 L4 28 Z"
        stroke="#adc6ff"
        strokeWidth="2"
        strokeOpacity="0.7"
      />
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

function Corner({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`pointer-events-none absolute h-5 w-5 text-primary/50 ${className}`}
      viewBox="0 0 20 20"
      fill="none"
    >
      <path d="M0 6 V0 H6" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function Diamond() {
  return (
    <svg className="h-3.5 w-3.5 text-on-surface-variant/60" viewBox="0 0 16 16" fill="none">
      <path d="M8 0 L11 8 L8 16 L5 8 Z" fill="currentColor" />
    </svg>
  );
}
