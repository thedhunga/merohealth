/**
 * Service card art for specialty & wellness (dermatology, expert opinion).
 *
 * A magnifying glass over an annotated card rather than a generic scan
 * icon, to read as "a closer second look at something specific" rather
 * than a diagnostic device. The viewfinder corners are the only marigold
 * use, marking exactly where attention lands.
 */
export function DiagnosticFocus({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      fill="none"
      role="presentation"
      viewBox="0 0 240 160"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect fill="#0B4F3A" height="160" rx="14" width="240" />

      <rect fill="#FFFCF7" height="86" rx="8" stroke="#A9DFC9" strokeWidth="3" width="70" x="64" y="48" />
      <rect fill="#0B4F3A" fillOpacity="0.25" height="6" rx="3" width="40" x="76" y="66" />
      <rect fill="#0B4F3A" fillOpacity="0.2" height="6" rx="3" width="30" x="76" y="80" />
      <circle cx="100" cy="104" fill="#FDF0D8" r="8" stroke="#C97A12" strokeWidth="2" />

      <circle cx="150" cy="92" r="26" stroke="#A9DFC9" strokeWidth="5" />
      <line stroke="#A9DFC9" strokeLinecap="round" strokeWidth="6" x1="168" x2="188" y1="110" y2="130" />

      <path
        d="M124 78 L124 66 L136 66 M164 66 L176 66 L176 78 M124 106 L124 118 L136 118 M176 106 L176 118 L164 118"
        stroke="#F4A62A"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
    </svg>
  );
}
