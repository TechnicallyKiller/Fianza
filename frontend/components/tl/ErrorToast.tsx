"use client";

// A dismissible popup for surfacing friendlyErrorMessage() output — replaces
// raw contract-error dumps with a short toast instead of an inline banner.

import { useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";

export default function ErrorToast({
  message,
  onDismiss,
}: {
  message: string | null;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDismiss, 8000);
    return () => clearTimeout(t);
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex max-w-sm items-start gap-2.5 rounded-lg border border-flare/30 bg-obsidian p-4 shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-flare" />
      <p className="flex-1 font-tl-mono text-xs leading-relaxed text-bone">{message}</p>
      <button
        onClick={onDismiss}
        className="shrink-0 text-ash transition-colors hover:text-bone"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}
