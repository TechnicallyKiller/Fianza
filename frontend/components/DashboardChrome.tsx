"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Navbar from "@/components/Navbar";
import WalletButton from "@/components/WalletButton";

// Dashboard shell — shared glass Navbar + a "back to site" footer link. The
// `active` prop is retained for call-site compatibility; the Navbar itself
// highlights the current section from the route.
export default function DashboardChrome({
  children,
}: {
  // Retained for call-site compatibility; the Navbar derives the active section
  // from the route now.
  active?: "Dashboard" | "Liquidity";
  children: React.ReactNode;
}) {
  return (
    <div className="relative z-10 flex min-h-screen flex-col bg-surface-container-lowest/60">
      <Navbar action={<WalletButton />} />

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
