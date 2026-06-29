"use client";

import { useEffect, useRef } from "react";

// Deep-space backdrop: an opaque navy base with nebula glows (CSS) and a
// twinkling canvas starfield. Sits behind the landing content.
export default function CinematicBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let stars: { x: number; y: number; r: number; a: number; tw: number }[] = [];
    let raf = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.floor((window.innerWidth * window.innerHeight) / 6000);
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        r: Math.random() * 1.3 + 0.2,
        a: Math.random() * 0.6 + 0.2,
        tw: Math.random() * 0.02 + 0.003,
      }));
    };

    let t = 0;
    const draw = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (const s of stars) {
        const alpha = reduce ? s.a : s.a + Math.sin(t * s.tw * 60 + s.x) * 0.25;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(210,224,255,${Math.max(0.05, Math.min(0.9, alpha))})`;
        ctx.fill();
      }
      t += 1;
      if (!reduce) raf = requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-[#05070d]">
      {/* nebula glows */}
      <div className="absolute -left-40 top-0 h-[60vh] w-[60vh] rounded-full bg-[#1b2c5a]/40 blur-[120px]" />
      <div className="absolute right-[-10%] top-1/3 h-[70vh] w-[70vh] rounded-full bg-[#21407e]/30 blur-[140px]" />
      <div className="absolute bottom-[-20%] left-1/3 h-[50vh] w-[50vh] rounded-full bg-[#142a55]/30 blur-[120px]" />
      {/* central vignette so content stays legible */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(3,5,10,0.7)_100%)]" />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
