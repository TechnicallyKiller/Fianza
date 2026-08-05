"use client";

// Shared nav for the Fianza.dc.html design system (landing/underwrite/
// borrower/lender). Deliberately separate from the site-wide Navbar (still
// used by docs/demo/coming-soon/waitlist on the old blue theme) so this
// redesign can't regress those pages.

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown, ExternalLink, Menu, X } from "lucide-react";

// The docs live on a separately-hosted Mintlify site (docs.fianza.space),
// not the internal Next.js /docs route — so the docs link is external.
const DOCS_URL = "https://docs.fianza.space";

// Trimmed to the core surfaces + mainnet/docs (explicit product call —
// keep the nav from reading as cluttered). /demo and /status are still real,
// linked pages — just reached via the footer or in-page links now, not the
// primary nav.
const LINKS: { href: string; label: string; external?: boolean; badge?: string }[] = [
  { href: "/", label: "manifesto" },
  { href: "/underwrite", label: "underwrite" },
  { href: "/agent-demo", label: "live agent", badge: "new" },
  { href: "/borrower", label: "borrower" },
  { href: "/lender", label: "lender" },
  { href: "/portfolio", label: "credit book" },
  { href: "/mainnet", label: "mainnet" },
];

// "read" groups the two long-form surfaces: the hosted docs site and the
// protocol paper. Kept as a dropdown so adding the whitepaper doesn't push the
// nav wider — it was already at its comfortable limit.
const READ_LINKS: { href: string; label: string; hint: string; external?: boolean }[] = [
  {
    href: DOCS_URL,
    label: "documentation",
    hint: "Architecture, SDK reference, contracts",
    external: true,
  },
  { href: "/whitepaper", label: "whitepaper", hint: "The protocol paper · PDF" },
];

export default function TLNav({
  right,
}: {
  /** Right-side slot content (e.g. a wallet button). Defaults to the live-network pill. */
  right?: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [readOpen, setReadOpen] = useState(false);
  const readActive = READ_LINKS.some((l) => !l.external && pathname === l.href);

  // Escape closes the dropdown — it opens on hover, so a keyboard user needs a
  // way out that isn't "move the mouse away".
  useEffect(() => {
    if (!readOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setReadOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [readOpen]);

  const isActive = (l: { href: string; external?: boolean }) =>
    !l.external &&
    (pathname === l.href || (l.href !== "/" && pathname.startsWith(`${l.href}/`)));

  return (
    <>
      <nav className="sticky top-0 z-40 flex items-center justify-between border-b border-bone/[0.09] bg-void/[0.82] px-5 py-4 backdrop-blur-[14px] md:px-[34px]">
        <Link href="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <span className="relative block h-9 w-9 overflow-hidden rounded-lg border border-ion/25 shadow-[0_0_14px_rgba(88,240,200,0.15)]">
            <Image
              src="/logo6.png"
              alt="Fianza"
              fill
              sizes="36px"
              priority
              className="scale-[1.35] object-cover"
            />
          </span>
          <span className="font-tl-sans text-[15px] font-bold tracking-[-0.01em] text-bone">
            Fianza
          </span>
        </Link>

        {/* desktop links */}
        <div className="hidden items-center gap-1.5 font-tl-mono text-xs md:flex">
          {LINKS.map((l) => {
            const active = isActive(l);
            const className = "rounded-md px-3 py-1.5 transition-colors";
            const style = { color: active ? "#FFB020" : "#A7ADA6" };
            return l.external ? (
              <a
                key={l.href}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className={className}
                style={style}
              >
                {l.label}
              </a>
            ) : (
              <Link
                key={l.href}
                href={l.href}
                className={`${className} inline-flex items-center gap-1.5`}
                style={style}
              >
                {l.label}
                {l.badge ? (
                  <span className="tl-anim-blink rounded-full bg-nectar/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-nectar">
                    {l.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}

          {/* read: docs + whitepaper */}
          <div
            className="relative"
            onMouseEnter={() => setReadOpen(true)}
            onMouseLeave={() => setReadOpen(false)}
          >
            <button
              type="button"
              aria-haspopup="true"
              aria-expanded={readOpen}
              onClick={() => setReadOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nectar"
              style={{ color: readActive ? "#FFB020" : "#A7ADA6" }}
            >
              read
              <ChevronDown
                size={13}
                className="transition-transform duration-150"
                style={{ transform: readOpen ? "rotate(180deg)" : "none" }}
              />
            </button>

            {readOpen ? (
              <div className="absolute right-0 top-full z-50 w-[248px] pt-2">
                <div className="overflow-hidden rounded-xl border border-white/[0.09] bg-obsidian shadow-[0_14px_44px_rgba(0,0,0,0.5)]">
                  {READ_LINKS.map((l) =>
                    l.external ? (
                      <a
                        key={l.href}
                        href={l.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setReadOpen(false)}
                        className="flex flex-col gap-0.5 border-b border-white/[0.05] px-4 py-3 transition-colors last:border-0 hover:bg-white/[0.04]"
                      >
                        <span className="flex items-center gap-1.5 text-bone">
                          {l.label}
                          <ExternalLink size={11} className="text-[#5a635e]" />
                        </span>
                        <span className="text-[10px] leading-snug text-[#5a635e]">{l.hint}</span>
                      </a>
                    ) : (
                      <Link
                        key={l.href}
                        href={l.href}
                        onClick={() => setReadOpen(false)}
                        className="flex flex-col gap-0.5 border-b border-white/[0.05] px-4 py-3 transition-colors last:border-0 hover:bg-white/[0.04]"
                        style={{ color: pathname === l.href ? "#FFB020" : undefined }}
                      >
                        <span className={pathname === l.href ? "" : "text-bone"}>{l.label}</span>
                        <span className="text-[10px] leading-snug text-[#5a635e]">{l.hint}</span>
                      </Link>
                    ),
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* right slot: desktop only */}
        <div className="hidden md:block">
          {right ?? (
            <div className="flex items-center gap-4">
              <Link
                href="/waitlist"
                className="rounded-md border border-nectar/30 bg-nectar/10 px-3 py-1.5 font-tl-mono text-[11px] font-semibold text-nectar transition-colors hover:bg-nectar/20"
              >
                Early access
              </Link>
              <div className="flex items-center gap-2">
                <span className="tl-anim-blink h-[7px] w-[7px] rounded-full bg-ion shadow-[0_0_8px_#58F0C8]" />
                <span className="font-tl-mono text-[11px] text-[#5a635e]">
                  stellar · testnet
                </span>
              </div>
            </div>
          )}
        </div>

        {/* mobile hamburger */}
        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex items-center justify-center rounded-md border border-white/10 p-2 text-bone md:hidden"
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </nav>

      {/* mobile full-screen menu */}
      {open ? (
        <div className="fixed inset-0 top-[61px] z-30 flex flex-col bg-obsidian/97 backdrop-blur-[14px] md:hidden">
          <div className="tl-anim-fadeup flex flex-col gap-1 px-5 py-6 font-tl-mono text-sm">
            {LINKS.map((l) => {
              const active = isActive(l);
              const style = { color: active ? "#FFB020" : "#EDEDE7" };
              const cls =
                "flex items-center gap-2 rounded-lg border border-white/[0.06] bg-void/50 px-4 py-3.5 transition-colors";
              return l.external ? (
                <a
                  key={l.href}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cls}
                  style={style}
                  onClick={() => setOpen(false)}
                >
                  {l.label}
                  <span className="ml-auto text-[10px] text-ash">↗</span>
                </a>
              ) : (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cls}
                  style={style}
                  onClick={() => setOpen(false)}
                >
                  {l.label}
                  {l.badge ? (
                    <span className="tl-anim-blink rounded-full bg-nectar/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-nectar">
                      {l.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}

            {/* no dropdown on mobile — the read links sit flat in the sheet */}
            {READ_LINKS.map((l) => {
              const style = { color: !l.external && pathname === l.href ? "#FFB020" : "#EDEDE7" };
              const cls =
                "flex items-center gap-2 rounded-lg border border-white/[0.06] bg-void/50 px-4 py-3.5 transition-colors";
              return l.external ? (
                <a
                  key={l.href}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cls}
                  style={style}
                  onClick={() => setOpen(false)}
                >
                  {l.label}
                  <span className="ml-auto text-[10px] text-ash">↗</span>
                </a>
              ) : (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cls}
                  style={style}
                  onClick={() => setOpen(false)}
                >
                  {l.label}
                  <span className="ml-auto text-[10px] text-ash">PDF</span>
                </Link>
              );
            })}

            <Link
              href="/waitlist"
              className="mt-4 flex items-center justify-center rounded-lg border border-nectar/30 bg-nectar/10 px-4 py-3 font-tl-mono text-sm font-semibold text-nectar"
              onClick={() => setOpen(false)}
            >
              Early access
            </Link>
            <div className="mt-4 flex items-center gap-2 px-1">
              <span className="tl-anim-blink h-[7px] w-[7px] rounded-full bg-ion shadow-[0_0_8px_#58F0C8]" />
              <span className="font-tl-mono text-[11px] text-[#5a635e]">stellar · testnet</span>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
