"use client";

import { useState } from "react";

// "Notify me" capture — opens a prefilled mail to the operator. No backend.
export default function NotifyForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    const subject = encodeURIComponent("TrustLine — early access");
    const body = encodeURIComponent(`Notify me at: ${email}`);
    window.location.href = `mailto:divyanshhkalra1234@gmail.com?subject=${subject}&body=${body}`;
    setSent(true);
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-md items-center gap-2">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email"
        className="flex-1 rounded border border-outline-variant/70 bg-[#0a0e17]/70 px-4 py-2.5 font-data-md text-data-md text-on-surface placeholder:text-on-surface-variant/50 backdrop-blur-sm transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <button
        type="submit"
        className="electric-blue-glow whitespace-nowrap rounded bg-primary-container px-5 py-2.5 font-label-caps text-label-caps uppercase tracking-wider text-on-primary-container transition-all duration-300 hover:scale-[1.02] hover:bg-primary hover:text-surface"
      >
        {sent ? "Sent ✓" : "Notify me"}
      </button>
    </form>
  );
}
