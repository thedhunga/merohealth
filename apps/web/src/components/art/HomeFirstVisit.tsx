/**
 * Service card art for primary care.
 *
 * A house rather than a stethoscope: primary care's distinguishing property
 * is that it is the person's first, ongoing point of contact, not a
 * specialist glyph. The horizon line running under it carries a pulse to
 * keep it a health composition rather than a plain real-estate icon.
 */
export function HomeFirstVisit({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      fill="none"
      role="presentation"
      viewBox="0 0 240 160"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect fill="#221C4B" height="160" rx="14" width="240" />

      <path
        d="M30 126 L70 126 L80 108 L88 140 L96 120 L160 126 L210 126"
        stroke="#6B5FD0"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />

      <path d="M90 60 L120 36 L150 60 Z" fill="#171233" stroke="#BDB4EE" strokeLinejoin="round" strokeWidth="4" />
      <rect fill="#171233" height="50" stroke="#BDB4EE" strokeWidth="4" width="60" x="90" y="60" />
      <rect fill="#FFFCF7" height="24" stroke="#BDB4EE" strokeWidth="2" width="16" x="112" y="86" />

      {/* Care marker on the door. */}
      <rect fill="#F4A62A" height="4" width="8" x="116" y="96" />
      <rect fill="#F4A62A" height="12" width="4" x="118" y="92" />

      <circle cx="120" cy="36" fill="#F4A62A" r="4" />
    </svg>
  );
}
