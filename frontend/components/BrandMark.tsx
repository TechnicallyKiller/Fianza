"use client";

import { useEffect, useState } from "react";
import TrustLineMark from "./TrustLineMark";

const LOGO_SRC = "/logo6.png";

// Renders the real TrustLine logo from /public if it exists, otherwise falls
// back to the built-in SVG mark — verified via a preload so the page never
// flashes a broken image. The shared logo art has a dark background;
// `mix-blend-screen` drops it against the dark page, leaving the glow + beam.
export default function BrandMark({ className = "" }: { className?: string }) {
  const [status, setStatus] = useState<"loading" | "ok" | "fail">("loading");

  useEffect(() => {
    const img = new Image();
    img.onload = () => setStatus("ok");
    img.onerror = () => setStatus("fail");
    img.src = LOGO_SRC;
  }, []);

  if (status === "ok") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={LOGO_SRC}
        alt="TrustLine"
        className={`${className} select-none mix-blend-screen`}
        draggable={false}
        style={{
          // The art has a dark-navy gradient background; screen-blend can't drop
          // it fully against the near-black page, leaving a faint square. Fade
          // the edges so only the glowing mark + beam remain.
          WebkitMaskImage:
            "radial-gradient(closest-side, #000 55%, transparent 88%)",
          maskImage: "radial-gradient(closest-side, #000 55%, transparent 88%)",
        }}
      />
    );
  }
  // While loading or if the asset is absent, show the SVG mark.
  return <TrustLineMark className={className} />;
}
