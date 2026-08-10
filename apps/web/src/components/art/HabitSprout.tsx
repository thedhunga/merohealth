/**
 * Service card art for healthy habits (nutrition, sleep).
 *
 * A sprout growing from a bowl, paired with a crescent, covers both
 * children of this card — eating and rest — as one routine rather than two
 * separate icons. The dashed ring reads as the daily repetition that makes
 * something a habit rather than a one-off.
 */
export function HabitSprout({ className }: { className?: string }) {
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

      <circle
        cx="120"
        cy="80"
        opacity="0.35"
        r="58"
        stroke="#221C4B"
        strokeDasharray="4 6"
        strokeWidth="2"
      />

      <path
        d="M60 92 Q120 128 180 92 L172 96 Q120 118 68 96 Z"
        fill="#FFFCF7"
        stroke="#221C4B"
        strokeLinejoin="round"
        strokeWidth="3.5"
      />

      <line stroke="#3D3480" strokeLinecap="round" strokeWidth="4" x1="120" x2="120" y1="92" y2="54" />
      <path d="M120 64 C104 58 96 44 104 32 C118 40 122 54 120 64 Z" fill="#6B5FD0" />
      <path d="M120 64 C136 58 144 44 136 32 C122 40 118 54 120 64 Z" fill="#3D3480" />

      <path
        clipRule="evenodd"
        d="M168 42 A14 14 0 1 0 168 66 A11 11 0 1 1 168 42 Z"
        fill="#C97A12"
        fillRule="evenodd"
      />
    </svg>
  );
}
