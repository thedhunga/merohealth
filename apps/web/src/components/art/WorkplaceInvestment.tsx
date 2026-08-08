/**
 * Organisation tab art for employers.
 *
 * An office window with a rising bar series topped by a pulse, reading as
 * "investment that compounds" rather than a stock photo of colleagues at a
 * desk. The growth line is the point; the office frame is just the context.
 */
export function WorkplaceInvestment({ className }: { className?: string }) {
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

      {/* Office frame, kept schematic rather than a literal building. */}
      <rect fill="#FFFCF7" height="96" rx="10" stroke="#0B4F3A" strokeWidth="4" width="188" x="26" y="32" />
      <path d="M26 60 L214 60" stroke="#0B4F3A" strokeOpacity="0.2" strokeWidth="2" />

      {/* Rising bars: the investment compounding over time. */}
      <rect fill="#0B4F3A" fillOpacity="0.2" height="24" rx="4" width="18" x="52" y="88" />
      <rect fill="#0B4F3A" fillOpacity="0.3" height="38" rx="4" width="18" x="82" y="74" />
      <rect fill="#17916B" height="54" rx="4" width="18" x="112" y="58" />
      <rect fill="#17916B" height="70" rx="4" width="18" x="142" y="42" />

      {/* The pulse riding the top of the trend, tying growth back to health. */}
      <path
        d="M112 58 L124 58 L130 44 L138 68 L146 42 L166 42"
        stroke="#F4A62A"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3.5"
      />
    </svg>
  );
}
