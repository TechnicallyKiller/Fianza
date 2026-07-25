"use client";

// The single top navbar used across the whole site — one consistent glass bar.
// Active section auto-detects from the route. Pass `action` for the right-side
// slot (e.g. a WalletButton on dashboards); otherwise it shows a default CTA.

import Link from "next/link";
import { usePathname } from "next/navigation";
import BrandMark from "@/components/BrandMark";

// The docs live on a separately-hosted Mintlify site (docs.0xtrustline.online),
// not the internal Next.js /docs route — so the Docs link is external.
const DOCS_URL = "https://docs.0xtrustline.online";

const LINKS: { href: string; label: string; external?: boolean }[] = [
  { href: "/underwrite", label: "Underwrite" },
  { href: "/demo", label: "Demo" },
  { href: "/lender", label: "Earn" },
  { href: "/borrower", label: "Borrow" },
  { href: DOCS_URL, label: "Docs", external: true },
];

export default function Navbar({ action }: { action?: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-50 bg-[#0a0e17]/70 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-6 md:px-12">
        <Link
          href="/"
          aria-label="Fianza home"
          className="flex shrink-0 items-center gap-2"
        >
          <BrandMark className="h-8 w-auto" />
          <span className="font-display text-xl font-semibold tracking-tight text-on-surface">
            Fianza
          </span>
          <span
            aria-label="Live on testnet"
            title="Live on testnet"
            className="ml-0.5 h-1.5 w-1.5 rounded-full bg-secondary"
          />
        </Link>

        <nav className="hidden items-center gap-10 md:flex">
          {LINKS.map((l) => {
            const active = pathname === l.href;
            const className = `font-display text-[17px] font-medium tracking-tight transition-colors ${
              active
                ? "text-on-surface"
                : "text-on-surface-variant hover:text-on-surface"
            }`;
            // External links (e.g. the Mintlify-hosted docs) use a plain anchor.
            return l.external ? (
              <a
                key={l.href}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className={className}
              >
                {l.label}
              </a>
            ) : (
              <Link key={l.href} href={l.href} className={className}>
                {l.label}
              </Link>
            );
          })}
        </nav>

        {action ?? (
          <Link
            href="/underwrite"
            className="rounded-full bg-primary-container px-6 py-2.5 font-display text-[15px] font-medium tracking-tight text-on-primary-container transition-colors hover:bg-primary hover:text-surface"
          >
            Underwrite
          </Link>
        )}
      </div>
    </header>
  );
}
