// Fianza "folded F" mark — one folded amber ribbon (stem bending into the
// top arm) with a detached mint mid-arm. Reusable at any size, down to 16px.
export default function FianzaMark({
  className = "",
  glow = true,
}: {
  className?: string;
  glow?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={glow ? { filter: "drop-shadow(0 0 14px rgba(255,176,32,0.45))" } : undefined}
    >
      <path
        d="M30 90 L30 32 Q30 16 46 16 L80 16"
        stroke="#FFB020"
        strokeWidth="14"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M50 52 L74 52" stroke="#58F0C8" strokeWidth="12" strokeLinecap="round" />
    </svg>
  );
}
