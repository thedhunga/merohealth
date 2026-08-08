/**
 * Service card art for mental health.
 *
 * Deliberately abstract: a head silhouette with calm, layered ripples
 * rather than a literal brain diagram or a stock photo of someone looking
 * pensive. The sparkle stands in for clarity without claiming a clinical
 * outcome.
 */
export function CalmMind({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      fill="none"
      role="presentation"
      viewBox="0 0 240 160"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect fill="#FDF0D8" height="160" rx="14" width="240" />

      <path
        d="M78 130 Q120 150 162 130"
        stroke="#0B4F3A"
        strokeLinecap="round"
        strokeWidth="4"
      />
      <ellipse cx="120" cy="88" fill="#FFFCF7" rx="42" ry="48" stroke="#0B4F3A" strokeWidth="4" />

      <path
        d="M84 70 q8 -10 16 0 t16 0 t16 0 t16 0"
        stroke="#17916B"
        strokeLinecap="round"
        strokeOpacity="0.8"
        strokeWidth="3"
      />
      <path
        d="M84 86 q8 -10 16 0 t16 0 t16 0 t16 0"
        stroke="#2FB287"
        strokeLinecap="round"
        strokeOpacity="0.6"
        strokeWidth="3"
      />
      <path
        d="M84 102 q8 -10 16 0 t16 0 t16 0 t16 0"
        stroke="#A9DFC9"
        strokeLinecap="round"
        strokeOpacity="0.7"
        strokeWidth="3"
      />

      <path
        d="M120 16 L123 26 L133 29 L123 32 L120 42 L117 32 L107 29 L117 26 Z"
        fill="#F4A62A"
      />
    </svg>
  );
}
