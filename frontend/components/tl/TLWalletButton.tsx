"use client";

// Connect/connected wallet pill, restyled for the Fianza.dc.html palette.
// Same real useWallet() plumbing as the existing WalletButton — this is a
// visual variant, not a new integration.

import { useState } from "react";
import { Wallet, LogOut, Copy, Check } from "lucide-react";
import { useWallet } from "@/components/WalletProvider";
import { shortAddr } from "@/lib/api";

export default function TLWalletButton() {
  const { address, connecting, connect, disconnect } = useWallet();
  const [copied, setCopied] = useState(false);

  if (!address) {
    return (
      <button
        onClick={connect}
        disabled={connecting}
        className="inline-flex items-center gap-2 rounded-md bg-nectar px-3 py-1.5 font-tl-sans text-xs font-semibold text-obsidian transition-colors hover:bg-ion disabled:opacity-60"
      >
        <Wallet size={13} />
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
    <div className="inline-flex items-center gap-1.5 rounded-md border border-ion/25 bg-ion/10 px-3 py-1 font-tl-mono text-xs text-ion">
      <Wallet size={13} />
      <span title={address}>{shortAddr(address)}</span>
      <button
        onClick={copy}
        className="ml-1 text-ion/70 transition-colors hover:text-ion"
        title="Copy address"
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
      <button
        onClick={disconnect}
        className="text-ion/70 transition-colors hover:text-flare"
        title="Disconnect"
      >
        <LogOut size={12} />
      </button>
    </div>
  );
}
