"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import WalletButton from "@/components/WalletButton";
import { useWallet } from "@/components/WalletProvider";

// Dashboard top nav (screens/*.html), now wired to the live wallet + backend.
// `active` highlights the current section; the network pill reflects /config.
export default function DashboardChrome({
  active = "Dashboard",
  children,
}: {
  active?: "Dashboard" | "Liquidity";
  children: React.ReactNode;
}) {
  const { config } = useWallet();
  const network = config?.network ? config.network : "Testnet";

  return (
    <div className="relative z-10 flex min-h-screen flex-col bg-surface-container-lowest/60">
      {/* Top nav */}
      <nav className="w-full border-b border-outline-variant bg-surface/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-gutter">
          <div className="flex items-center gap-8">
            <Link
              href="/"
              className="text-headline-md font-headline-md font-bold tracking-tight text-on-surface"
            >
              TrustLine
            </Link>
            <div className="hidden gap-6 md:flex">
              <NavLink href="/borrower" current={active === "Dashboard"}>
                Dashboard
              </NavLink>
              <NavLink href="/lender" current={active === "Liquidity"}>
                Liquidity
              </NavLink>
              <span className="cursor-default font-medium text-on-surface-variant/40">
                Swap
              </span>
              <span className="cursor-default font-medium text-on-surface-variant/40">
                Governance
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="rounded-md border border-outline-variant bg-surface-container px-3 py-1 font-data-md text-data-md capitalize text-on-surface-variant">
              {network}
            </span>
            <WalletButton />
          </div>
        </div>
      </nav>

      {children}

      <div className="mx-auto w-full max-w-[1440px] px-gutter pb-stack-md">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 font-body-sm text-on-surface-variant transition-colors hover:text-on-surface"
        >
          <ArrowLeft size={14} />
          Back to site
        </Link>
      </div>
    </div>
  );
}

function NavLink({
  href,
  current,
  children,
}: {
  href: string;
  current: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        current
          ? "border-b-2 border-primary pb-1 font-bold text-primary"
          : "font-medium text-on-surface-variant transition-colors hover:text-on-surface"
      }
    >
      {children}
    </Link>
  );
}
