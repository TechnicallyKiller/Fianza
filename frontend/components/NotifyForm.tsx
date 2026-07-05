"use client";

import { useState } from "react";
import { API_BASE_URL } from "@/lib/api";

// Early-access waitlist capture — POSTs the email to the backend's /waitlist
// endpoint (persisted to Postgres). Genuine capture, not a mailto.
export default function NotifyForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || state === "busy") return;
    setState("busy");
    setMsg(null);
    try {
      const res = await fetch(`${API_BASE_URL}/waitlist`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, source: "landing" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Something went wrong. Try again.");
      }
      const body = await res.json();
      setState("done");
      setMsg(body.added ? "You're on the list." : "You're already on the list.");
    } catch (err) {
      setState("error");
      setMsg(err instanceof Error ? err.message : "Couldn't reach the server.");
    }
  }

  if (state === "done") {
    return (
      <p className="font-body-md text-secondary" role="status">
        {msg} We&apos;ll be in touch.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-md flex-col items-center gap-2">
      <div className="flex w-full items-center gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email"
          className="flex-1 rounded-md border border-outline-variant/70 bg-[#0a0e17]/70 px-4 py-2.5 font-data-md text-data-md text-on-surface placeholder:text-on-surface-variant/50 backdrop-blur-sm transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          type="submit"
          disabled={state === "busy"}
          className="whitespace-nowrap rounded-md bg-primary-container px-6 py-2.5 font-medium text-on-primary-container transition-colors hover:bg-primary hover:text-surface disabled:opacity-60"
        >
          {state === "busy" ? "Joining…" : "Join"}
        </button>
      </div>
      {state === "error" && msg ? (
        <p className="w-full text-left font-body-sm text-xs text-error">{msg}</p>
      ) : null}
    </form>
  );
}
