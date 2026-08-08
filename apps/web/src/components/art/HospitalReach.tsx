/**
 * Organisation tab art for hospitals and health systems.
 *
 * A hospital cross with signal rings extending outward, rather than a
 * stock photo of a patient's bedside: the point is a physical facility's
 * capability reaching beyond its own walls, not the bed itself.
 */
export function HospitalReach({ className }: { className?: string }) {
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

      {/* Signal rings, widest first so the cross reads as their origin. */}
      <path d="M78 80 A48 48 0 0 1 174 80" stroke="#0B4F3A" strokeLinecap="round" strokeOpacity="0.18" strokeWidth="5" />
      <path d="M92 80 A34 34 0 0 1 160 80" stroke="#0B4F3A" strokeLinecap="round" strokeOpacity="0.32" strokeWidth="5" />

      <rect fill="#FFFCF7" height="72" rx="10" stroke="#0B4F3A" strokeWidth="4" width="84" x="84" y="60" />
      <path
        d="M126 76 L126 108 M110 92 L142 92"
        stroke="#C4573A"
        strokeLinecap="round"
        strokeWidth="7"
      />

      <circle cx="196" cy="80" fill="#F4A62A" r="6" />
      <circle cx="184" cy="56" fill="#F4A62A" fillOpacity="0.6" r="4" />
    </svg>
  );
}
