"use client";

// Thin nectar→ion progress bar pinned above the nav — how far through the
// story you've scrolled. rAF-throttled scroll listener, no dependencies.

import { useEffect, useState } from "react";

export default function ScrollProgress() {
  const [p, setP] = useState(0);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setP(max > 0 ? h.scrollTop / max : 0);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[2px]">
      <div
        className="h-full w-full origin-left bg-gradient-to-r from-nectar via-ion to-ion shadow-[0_0_8px_rgba(88,240,200,0.5)]"
        style={{ transform: `scaleX(${p})` }}
      />
    </div>
  );
}
