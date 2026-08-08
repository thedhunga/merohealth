/**
 * Service card art for condition management (diabetes, weight,
 * hypertension).
 *
 * A droplet carrying its own trend line plus a separate pulse blip: the
 * three linked conditions this card fans out to share the same idea, a
 * value tracked over time with an occasional flagged reading, so one
 * droplet-and-trend motif covers all of them instead of three icons.
 */
export function VitalsTrend({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      fill="none"
      role="presentation"
      viewBox="0 0 240 160"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect fill="#D8F0E5" height="160" rx="14" width="240" />

      <path
        d="M95 34 C118 66 130 84 130 102 A35 35 0 1 1 60 102 C60 84 72 66 95 34 Z"
        fill="#FFFCF7"
        stroke="#0B4F3A"
        strokeWidth="4"
      />
      <path
        d="M72 100 L84 92 L94 96 L104 80 L116 86"
        stroke="#17916B"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
      <circle cx="104" cy="80" fill="#F4A62A" r="4.5" stroke="#FFFCF7" strokeWidth="2" />

      <path
        d="M150 80 L162 80 L168 60 L174 100 L180 80 L196 80"
        stroke="#0B4F3A"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
    </svg>
  );
}
