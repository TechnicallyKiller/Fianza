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
        fontFamily: "var(--font-inter), Inter, sans-serif",
        themeVariables: {
          background: "#0a0e17",
          primaryColor: "#121826",
          primaryTextColor: "#dfe2ef",
          primaryBorderColor: "#4d8eff",
          lineColor: "#5a6178",
          secondaryColor: "#10b981",
          tertiaryColor: "#ffb95f",
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
      <div className="my-5 flex h-32 items-center justify-center rounded-lg border border-white/8 bg-[#0c1018] text-sm text-on-surface-variant/50">
        Rendering diagram…
      </div>
    );
  }

  return (
    <div
      className="mermaid-diagram my-5 overflow-x-auto rounded-lg border border-white/8 bg-[#0c1018] p-4"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
