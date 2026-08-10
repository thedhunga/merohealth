/**
 * Service card art for round-the-clock care.
 *
 * A single dial split into day and night rather than a clock-face icon: the
 * point is availability at any hour, not the time of day itself. A pulse
 * line crosses the diameter to tie "always open" back to a health signal
 * instead of leaving it as a generic time metaphor.
 */
export function AroundTheClockCare({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      fill="none"
      role="presentation"
      viewBox="0 0 240 160"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect fill="#DEDAF7" height="160" rx="14" width="240" />

      <circle cx="120" cy="80" fill="#FFFCF7" r="54" stroke="#221C4B" strokeWidth="4" />
      <path d="M120 26 A54 54 0 0 1 120 134 Z" fill="#171233" />

      {/* Night-half stars. */}
      <circle cx="142" cy="55" fill="#FFFCF7" fillOpacity="0.8" r="2" />
      <circle cx="153" cy="76" fill="#FFFCF7" fillOpacity="0.7" r="1.6" />
      <circle cx="140" cy="101" fill="#FFFCF7" fillOpacity="0.75" r="1.8" />

      {/* Day-half sun rays. */}
      <path
        d="M78 42 L84 48 M68 56 L76 58 M68 104 L76 102"
        stroke="#F4A62A"
        strokeLinecap="round"
        strokeWidth="3"
      />

      {/* Hour ticks at 12/3/6/9. */}
      <path
        d="M120 26 L120 32 M174 80 L168 80 M120 134 L120 128 M66 80 L72 80"
        stroke="#221C4B"
        strokeLinecap="round"
        strokeWidth="3"
      />

      {/* The pulse crossing the dial. */}
      <path
        d="M66 80 L85 80 L92 58 L100 100 L108 66 L116 80 L174 80"
        stroke="#3D3480"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
      <circle cx="120" cy="80" fill="#F4A62A" r="4.5" />
    </svg>
  );
}
