"use client";

import { useEffect, useId, useRef, useState } from "react";

// Renders a mermaid diagram client-side. Mermaid is imported dynamically so it
// never touches the server bundle. Dark theme matches the docs' navy palette;
// falls back to showing the raw source (in a normal code block) if rendering
// fails, so a bad diagram never blanks the page.
export default function Mermaid({ chart }: { chart: string }) {
  const id = useId().replace(/[:]/g, "");
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ranFor = useRef<string | null>(null);

  useEffect(() => {
    if (ranFor.current === chart) return;
    ranFor.current = chart;
    let cancelled = false;

    import("mermaid").then(async (mod) => {
      const mermaid = mod.default;
      mermaid.initialize({
        startOnLoad: false,
        theme: "dark",
        securityLevel: "strict",
        fontFamily: "var(--font-display), system-ui, sans-serif",
        themeVariables: {
          background: "#0B0F0E",
          primaryColor: "#141816",
          primaryTextColor: "#F4F1E9",
          primaryBorderColor: "#58F0C8",
          lineColor: "#A7ADA6",
          secondaryColor: "#FFB020",
          tertiaryColor: "#FF5C4D",
          fontSize: "14px",
        },
      });
      try {
        const { svg } = await mermaid.render(`mmd-${id}`, chart);
        if (!cancelled) setSvg(svg);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [chart, id]);

  if (error) {
    return (
      <pre>
        <code>{chart}</code>
      </pre>
    );
  }

  if (!svg) {
    return (
      <div className="my-5 flex h-32 items-center justify-center rounded-lg border border-bone/[0.08] bg-void font-tl-mono text-sm text-ash/50">
        Rendering diagram…
      </div>
    );
  }

  return (
    <div
      className="mermaid-diagram my-5 overflow-x-auto rounded-lg border border-bone/[0.08] bg-void p-4"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
