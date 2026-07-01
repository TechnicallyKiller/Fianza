"use client";

// Wallet + backend-config context shared by the borrower and lender dashboards.
// Holds the connected public key (persisted across reloads) and the public
// /config (network + contract ids), so any screen can wire wallet actions.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  connectWallet,
  disconnectWallet,
  restoreWallet,
} from "@/lib/stellar";
import { api, type PublicConfig } from "@/lib/api";

interface WalletContextValue {
  address: string | null;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  error: string | null;
  config: PublicConfig | null;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<PublicConfig | null>(null);

  // Re-attach a previously selected wallet, and load public config, on mount.
  useEffect(() => {
    restoreWallet().then((addr) => addr && setAddress(addr)).catch(() => {});
    api.config().then(setConfig).catch(() => setConfig(null));
  }, []);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const addr = await connectWallet();
      setAddress(addr);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // A cancelled modal isn't an error worth surfacing.
      if (!/cancel/i.test(msg)) setError(msg);
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    disconnectWallet();
    setAddress(null);
  }, []);

  return (
    <WalletContext.Provider
      value={{ address, connecting, connect, disconnect, error, config }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within <WalletProvider>");
  return ctx;
}
