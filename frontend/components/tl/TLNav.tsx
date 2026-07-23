"use client";

// Shared nav for the TrustLine.dc.html design system (landing/underwrite/
// borrower/lender). Deliberately separate from the site-wide Navbar (still
// used by docs/demo/coming-soon/waitlist on the old blue theme) so this
// redesign can't regress those pages.

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

// The docs live on a separately-hosted Mintlify site (docs.0xtrustline.online),
// not the internal Next.js /docs route — so the docs link is external.
const DOCS_URL = "https://docs.0xtrustline.online";

const LINKS: { href: string; label: string; external?: boolean; badge?: string }[] = [
  { href: "/", label: "manifesto" },
  { href: "/underwrite", label: "underwrite" },
  { href: "/demo", label: "demo" },
  { href: "/agent-demo", label: "live agent", badge: "new" },
  { href: "/borrower", label: "borrower" },
  { href: "/lender", label: "lender" },
  { href: DOCS_URL, label: "docs", external: true },
];

export default function TLNav({
  right,
}: {
  /** Right-side slot content (e.g. a wallet button). Defaults to the live-network pill. */
  right?: React.ReactNode;
}) {
  const pathname = usePathname();
  return (
    <nav className="sticky top-0 z-40 flex items-center justify-between border-b border-bone/[0.09] bg-void/[0.82] px-5 py-4 backdrop-blur-[14px] md:px-[34px]">
      <Link href="/" className="flex items-center gap-2.5">
        <span className="relative block h-9 w-9 overflow-hidden rounded-lg border border-ion/25 shadow-[0_0_14px_rgba(88,240,200,0.15)]">
          <Image
            src="/logo6.png"
            alt="TrustLine"
            fill
            sizes="36px"
            priority
            className="scale-[1.35] object-cover"
          />
        </span>
        <span className="font-tl-sans text-[15px] font-bold tracking-[-0.01em] text-bone">
          TrustLine
        </span>
      </Link>

      <div className="hidden items-center gap-1.5 font-tl-mono text-xs md:flex">
        {LINKS.map((l) => {
          // Sub-routes (e.g. /underwrite/x) keep the section tab lit.
          const active =
            !l.external &&
            (pathname === l.href ||
              (l.href !== "/" && pathname.startsWith(`${l.href}/`)));
          const className = "rounded-md px-3 py-1.5 transition-colors";
          const style = { color: active ? "#FFB020" : "#A7ADA6" };
          // External links (the Mintlify-hosted docs) use a plain anchor.
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
      </div>

      {right ?? (
        <div className="flex items-center gap-2">
          <span className="tl-anim-blink h-[7px] w-[7px] rounded-full bg-ion shadow-[0_0_8px_#58F0C8]" />
          <span className="font-tl-mono text-[11px] text-[#5a635e]">
            stellar · testnet
          </span>
        </div>
      )}
    </nav>
  );
}
