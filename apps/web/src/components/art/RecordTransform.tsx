/**
 * The hero's signature artwork.
 *
 * A creased paper lab report sits behind a clean, structured record card —
 * the product's entire value proposition in one image. Deliberately not a
 * stock photo of somebody smiling at a phone, which is what every competitor
 * in this category opens with.
 *
 * The report's "writing" is drawn as illegible ink strokes rather than real
 * glyphs: the point is that the paper is unreadable, and faking Devanagari
 * text here would be both wrong and unreadable to assistive technology. The
 * whole graphic is aria-hidden and captioned by the surrounding section.
 */
export function RecordTransform({ className }: { className?: string }) {
  const rows = [
    { label: 32, value: 18, y: 150, flagged: false },
    { label: 44, value: 14, y: 186, flagged: true },
    { label: 28, value: 20, y: 222, flagged: false },
    { label: 38, value: 16, y: 258, flagged: false },
  ];

  return (
    <svg
      aria-hidden
      className={className}
      fill="none"
      role="presentation"
      viewBox="0 0 520 440"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="rt-paper" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#FFFDF8" />
          <stop offset="100%" stopColor="#EFE6D4" />
        </linearGradient>
        <linearGradient id="rt-card" x1="0" x2="0.6" y1="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#F1EFFB" />
        </linearGradient>
        <filter height="160%" id="rt-shadow" width="160%" x="-30%" y="-30%">
          <feDropShadow
            dx="0"
            dy="18"
            floodColor="#0E0B1F"
            floodOpacity="0.22"
            stdDeviation="22"
          />
        </filter>
      </defs>

      {/* The paper report: rotated, creased, illegible. */}
      <g transform="rotate(-7 250 210)">
        <rect
          fill="url(#rt-paper)"
          height="330"
          rx="6"
          width="250"
          x="34"
          y="46"
        />
        {/* Crease running down the sheet. */}
        <path d="M150 46 L162 210 L150 376" stroke="#D8CCB2" strokeWidth="2" />
        <path d="M34 214 L284 206" stroke="#D8CCB2" strokeWidth="1.5" />

        {/* Illegible handwriting. */}
        {[86, 116, 146, 176, 206, 236, 266, 296, 326].map((y, index) => (
          <path
            d={`M58 ${y} q14 -7 28 0 t28 0 t28 0 t28 0 ${index % 3 === 0 ? '' : 't28 0'}`}
            key={y}
            stroke="#8C7F66"
            strokeLinecap="round"
            strokeOpacity={index % 4 === 0 ? 0.75 : 0.45}
            strokeWidth="3"
          />
        ))}
        {/* A stamp, as on every Nepali lab report. */}
        <circle
          cx="228"
          cy="318"
          r="30"
          stroke="#C4573A"
          strokeOpacity="0.5"
          strokeWidth="3"
        />
      </g>

      {/* The structured record, floating in front. */}
      <g filter="url(#rt-shadow)">
        <rect
          fill="url(#rt-card)"
          height="300"
          rx="20"
          width="290"
          x="210"
          y="96"
        />

        {/* Header bar. */}
        <rect fill="#221C4B" height="52" rx="20" width="290" x="210" y="96" />
        <rect fill="#221C4B" height="26" width="290" x="210" y="122" />
        <circle cx="238" cy="122" fill="#F4A62A" r="7" />
        <rect fill="#FFFFFF" fillOpacity="0.85" height="7" rx="3.5" width="84" x="256" y="118" />

        {rows.map(({ label, value, y, flagged }) => (
          <g key={y}>
            <rect fill="#171429" fillOpacity="0.16" height="8" rx="4" width={label * 2} x="238" y={y} />
            <rect
              fill={flagged ? '#F4A62A' : '#3D3480'}
              height="12"
              rx="6"
              width={value * 2.4}
              x="238"
              y={y + 16}
            />
            {flagged ? (
              <rect fill="#FDF0D8" height="34" rx="8" width="252" x="228" y={y - 8} opacity="0.55" />
            ) : null}
          </g>
        ))}

        {/* Trend sparkline — the analyte series the assistant reasons over. */}
        <polyline
          points="240,352 274,342 308,346 342,326 376,330 410,306 444,296"
          stroke="#3D3480"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3.5"
        />
        {[
          [240, 352],
          [308, 346],
          [376, 330],
          [444, 296],
        ].map(([cx, cy]) => (
          <circle cx={cx} cy={cy} fill="#FFFCF7" key={`${cx}`} r="4.5" stroke="#3D3480" strokeWidth="3" />
        ))}
      </g>
    </svg>
  );
}
