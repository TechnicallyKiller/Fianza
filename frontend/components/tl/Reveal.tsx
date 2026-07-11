"use client";

// Scroll-reveal wrapper — IntersectionObserver adds `.tl-in` when the element
// enters the viewport, which (a) transitions the wrapper itself in and
// (b) gates any `.tl-*-g` child animations (bars rising, lines drawing,
// staggered fades) so they fire on scroll, not on mount. Dependency-free;
// prefers-reduced-motion is handled in globals.css.

import { useEffect, useRef, useState, type CSSProperties } from "react";

export type RevealVariant = "up" | "left" | "right" | "fade" | "scale";

export default function Reveal({
  children,
  variant = "up",
  delay = 0,
  className = "",
  once = true,
}: {
  children: React.ReactNode;
  variant?: RevealVariant;
  /** Seconds before the wrapper's own transition starts. */
  delay?: number;
  className?: string;
  /** false = re-hide when scrolled back out (replayable). */
  once?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true); // no IO support → never hide content
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) io.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [once]);

  return (
    <div
      ref={ref}
      data-variant={variant}
      className={`tl-reveal ${inView ? "tl-in" : ""} ${className}`}
      style={{ "--tl-reveal-delay": `${delay}s` } as CSSProperties}
    >
      {children}
    </div>
  );
}
