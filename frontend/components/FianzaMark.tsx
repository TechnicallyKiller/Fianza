// Fianza chain-link mark — two interlocked sci-fi links (a "line of trust"),
// glowing electric-blue, with a bright core node. Reusable at any size.
export default function FianzaMark({
  className = "",
  glow = true,
}: {
  className?: string;
  glow?: boolean;
}) {
  // Chamfered horizontal "link" octagon, drawn at an (x) offset.
  const link = (x: number) =>
    `M ${x + 18},2 L ${x + 62},2 L ${x + 78},20 L ${x + 78},60 L ${x + 62},78 L ${x + 18},78 L ${x + 2},60 L ${x + 2},20 Z`;

  return (
    <svg
      viewBox="0 0 200 80"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={glow ? { filter: "drop-shadow(0 0 14px rgba(77,142,255,0.55))" } : undefined}
    >
      <defs>
        <linearGradient id="link-stroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#adc6ff" />
          <stop offset="100%" stopColor="#4d8eff" />
        </linearGradient>
      </defs>

      {/* Right link (behind) */}
      <path d={link(96)} stroke="url(#link-stroke)" strokeWidth="4" opacity="0.85" />
      {/* Left link (front) */}
      <path d={link(8)} stroke="url(#link-stroke)" strokeWidth="5" />

      {/* Inner chevrons on the left link — forward motion */}
      <path
        d="M 36,26 L 60,40 L 36,54"
        stroke="#cdddff"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 52,30 L 68,40 L 52,50"
        stroke="#7aa6ff"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.8"
      />

      {/* Bright core node where the two links join (beam origin) */}
      <circle cx="104" cy="40" r="7" fill="#dbe6ff" />
      <circle cx="104" cy="40" r="11" fill="#4d8eff" opacity="0.35" />
    </svg>
  );
}
