"use client";

// Connect / connected wallet pill for the dashboard top nav. Mirrors the static
// pill from screens/*.html, but driven by the real wallet context.

import { useState } from "react";
import { Wallet, LogOut, Copy, Check } from "lucide-react";
import { useWallet } from "@/components/WalletProvider";
import { shortAddr } from "@/lib/api";

export default function WalletButton() {
  const { address, connecting, connect, disconnect } = useWallet();
  const [copied, setCopied] = useState(false);

  if (!address) {
    return (
      <button
        onClick={connect}
        disabled={connecting}
        className="electric-blue-glow inline-flex items-center gap-2 rounded-md bg-primary-container px-3 py-1.5 font-body-sm font-medium text-on-primary-container transition-all duration-300 hover:scale-[1.02] hover:bg-primary hover:text-surface disabled:opacity-60"
      >
        <Wallet size={14} />
        {connecting ? "Connecting…" : "Connect wallet"}
      </button>
    );
  }

  const copy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/10 px-3 py-1 font-data-md text-data-md text-primary">
      <Wallet size={14} />
      <span title={address}>{shortAddr(address)}</span>
      <button
        onClick={copy}
        className="ml-1 text-primary/70 transition-colors hover:text-primary"
        title="Copy address"
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
      <button
        onClick={disconnect}
        className="text-primary/70 transition-colors hover:text-error"
        title="Disconnect"
      >
        <LogOut size={13} />
      </button>
    </div>
  );
}
