"use client";

// Global footer for the TrustLine (amber) design system — persistent across the
// site so the brand, socials, and a small brand-kit are always one scroll away.
// Also surfaces a tiny live-status pill that links to /status.

import Link from "next/link";
import { useEffect, useState } from "react";

const X_HANDLE = "0xtrustline";
const CONTACT_EMAIL = "divyanshhkalra1234@gmail.com";

export default function TLFooter() {
  // Lightweight liveness ping so the footer can show a real status dot.
  const [live, setLive] = useState<boolean | null>(null);
  useEffect(() => {
    let done = false;
    // Same-origin /api/status (server-side checks) — avoids privacy-browser
    // blocking of a direct cross-origin *.onrender.com ping.
    fetch(`/api/status?_=${Date.now()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { services?: Record<string, boolean> }) => {
        if (!done) setLive(!!d.services?.backend);
      })
      .catch(() => {
        if (!done) setLive(false);
      });
    return () => {
      done = true;
    };
  }, []);

  return (
    <footer className="relative mt-24 border-t border-bone/[0.08] bg-void/40">
      <div className="mx-auto grid w-full max-w-[1100px] grid-cols-1 gap-8 px-6 py-12 md:grid-cols-[1.4fr_1fr_1fr] md:px-10">
        {/* brand + one-liner + status */}
        <div>
          <div className="flex items-center gap-2.5">
            <span className="font-tl-sans text-[15px] font-bold tracking-[-0.01em] text-bone">
              TrustLine
            </span>
            <Link
              href="/status"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2 py-0.5 font-tl-mono text-[10px] text-ash transition-colors hover:border-ion/40"
            >
              <span
                className={`h-[6px] w-[6px] rounded-full ${
                  live === null
                    ? "bg-ash"
                    : live
                      ? "tl-anim-blink bg-ion shadow-[0_0_6px_#58F0C8]"
                      : "bg-flare"
                }`}
              />
              {live === null ? "checking…" : live ? "all systems live" : "degraded"}
            </Link>
          </div>
          <p className="mt-3 max-w-xs font-tl-sans text-[13px] leading-[1.6] text-ash">
            Uncollateralized USDC credit for AI agents, underwritten by revenue —
            on Stellar. Live on testnet.
          </p>
          <div className="mt-4 flex items-center gap-3 font-tl-mono text-[11px]">
            <a
              href={`https://x.com/${X_HANDLE}`}
              target="_blank"
              rel="noreferrer"
              className="text-ash transition-colors hover:text-nectar"
            >
              𝕏 @{X_HANDLE}
            </a>
            <a
              href="https://github.com/TechnicallyKiller/TrustLine"
              target="_blank"
              rel="noreferrer"
              className="text-ash transition-colors hover:text-nectar"
            >
              GitHub
            </a>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-ash transition-colors hover:text-nectar"
            >
              Contact
            </a>
          </div>
        </div>

        {/* product links */}
        <div>
          <div className="mb-3 font-tl-mono text-[10px] tracking-[0.16em] text-ash/60">
            PRODUCT
          </div>
          <ul className="flex flex-col gap-2 font-tl-sans text-[13px] text-ash">
            <li><Link href="/agent-demo" className="hover:text-bone">Live agent demo</Link></li>
            <li><Link href="/portfolio" className="hover:text-bone">Credit book</Link></li>
            <li><Link href="/demo" className="hover:text-bone">Underwriting demo</Link></li>
            <li><Link href="/status" className="hover:text-bone">Status</Link></li>
            <li>
              <a href="https://docs.0xtrustline.online" target="_blank" rel="noreferrer" className="hover:text-bone">
                Docs
              </a>
            </li>
          </ul>
        </div>

        {/* build on it + brand kit */}
        <div>
          <div className="mb-3 font-tl-mono text-[10px] tracking-[0.16em] text-ash/60">
            BUILD ON IT
          </div>
          <ul className="flex flex-col gap-2 font-tl-mono text-[11px] text-ash">
            <li className="text-bone/80">npx @trustline-agents/skill</li>
            <li>npm i @trustline-agents/agent-sdk</li>
            <li>pip install trustline-agent-sdk</li>
          </ul>
          <Link
            href="/brand"
            className="mt-4 inline-block font-tl-mono text-[11px] text-ion hover:text-nectar"
          >
            Brand kit →
          </Link>
        </div>
      </div>

      <div className="border-t border-bone/[0.06]">
        <div className="mx-auto flex w-full max-w-[1100px] flex-col items-start justify-between gap-2 px-6 py-4 font-tl-mono text-[10px] text-ash/50 md:flex-row md:items-center md:px-10">
          <span>© 2026 TrustLine · MIT · built by Divyanshh Kalra</span>
          <span>Stellar · Soroban · x402 · USDC · testnet</span>
        </div>
      </div>
    </footer>
  );
}
