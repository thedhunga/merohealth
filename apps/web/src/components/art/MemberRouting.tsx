/**
 * Organisation tab art for health plans.
 *
 * A membership card with a dotted route leading straight to a care cross,
 * rather than a stock photo of someone on a phone: the point of "the right
 * care sooner" is a shorter path, not a person or a device.
 */
export function MemberRouting({ className }: { className?: string }) {
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

      <rect fill="#FFFCF7" height="70" rx="10" stroke="#0B4F3A" strokeWidth="4" width="104" x="26" y="52" />
      <circle cx="50" cy="76" fill="#0B4F3A" fillOpacity="0.18" r="12" />
      <rect fill="#0B4F3A" fillOpacity="0.22" height="6" rx="3" width="46" x="70" y="66" />
      <rect fill="#0B4F3A" fillOpacity="0.16" height="6" rx="3" width="34" x="70" y="80" />

      {/* The route from card to care, sooner than the default path. */}
      <path
        d="M132 80 L200 80"
        stroke="#0B4F3A"
        strokeDasharray="2 10"
        strokeLinecap="round"
        strokeWidth="4"
      />

      <circle cx="204" cy="80" fill="#0B4F3A" r="24" />
      <path
        d="M204 68 L204 92 M192 80 L216 80"
        stroke="#F4A62A"
        strokeLinecap="round"
        strokeWidth="5"
      />
    </svg>
  );
}
