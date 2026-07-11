"use client";

// In-view number count-up. Starts when scrolled into view, eases out cubic.
// Carries a setTimeout safety net so the final value always lands even when
// requestAnimationFrame is throttled (backgrounded tabs) — same failure mode
// the underwrite verdict animation hit.

import { useEffect, useRef, useState } from "react";

export default function CountUp({
  to,
  from = 0,
  decimals = 0,
  duration = 1400,
  prefix = "",
  suffix = "",
  className,
}: {
  to: number;
  from?: number;
  decimals?: number;
  /** ms */
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [val, setVal] = useState(from);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVal(to); // no IO support → show the final value
      return;
    }
    let raf = 0;
    let snap: ReturnType<typeof setTimeout> | null = null;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || started.current) return;
        started.current = true;
        io.disconnect();
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          setVal(to);
          return;
        }
        const t0 = performance.now();
        const tick = (now: number) => {
          const p = Math.min(1, (now - t0) / duration);
          setVal(from + (to - from) * (1 - Math.pow(1 - p, 3)));
          if (p < 1) raf = requestAnimationFrame(tick);
          else if (snap) clearTimeout(snap);
        };
        raf = requestAnimationFrame(tick);
        snap = setTimeout(() => {
          cancelAnimationFrame(raf);
          setVal(to);
        }, duration + 400);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      if (snap) clearTimeout(snap);
    };
  }, [to, from, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {val.toFixed(decimals)}
      {suffix}
    </span>
  );
}
