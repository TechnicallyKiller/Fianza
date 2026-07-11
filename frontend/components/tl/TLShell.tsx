"use client";

// Page shell for the borrower/lender dashboards — TLNav (with a wallet pill
// on the right) + a "back to site" footer link.

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import TLNav from "@/components/tl/TLNav";
import TLWalletButton from "@/components/tl/TLWalletButton";

export default function TLShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="tl-select relative min-h-screen bg-obsidian text-bone">
      <TLNav right={<TLWalletButton />} />
      {children}
      <div className="mx-auto w-full max-w-[1160px] px-[30px] pb-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 font-tl-mono text-xs text-[#5a635e] transition-colors hover:text-bone"
        >
          <ArrowLeft size={13} />
          Back to site
        </Link>
      </div>
    </div>
  );
}
