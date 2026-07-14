"use client";

// Code block with a hover copy button. Wraps the <pre> that react-markdown
// produces; the copied text is read from the DOM so it's always exactly what
// the reader sees.

import { useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

export default function CodeBlock({
  children,
}: {
  children?: React.ReactNode;
}) {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const text = preRef.current?.innerText ?? "";
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable (permissions/http) — button just no-ops */
    }
  };

  return (
    <div className="doc-codeblock group">
      <pre ref={preRef}>{children}</pre>
      <button
        onClick={copy}
        aria-label="Copy code"
        className="absolute right-2.5 top-2.5 rounded-md border border-bone/10 bg-obsidian/90 p-1.5 text-ash opacity-0 transition-opacity hover:text-ion focus:opacity-100 group-hover:opacity-100"
      >
        {copied ? <Check size={13} className="text-ion" /> : <Copy size={13} />}
      </button>
    </div>
  );
}
