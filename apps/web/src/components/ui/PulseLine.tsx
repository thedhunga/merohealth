import { cn } from '@/lib/cn';

/**
 * Animated ECG trace.
 *
 * A single stroked path whose dash offset is animated, so the line appears to
 * draw itself continuously. Pure CSS on an SVG — no canvas, no library, and
 * only `stroke-dashoffset` changes, so it stays cheap. Decorative, and it
 * stops entirely under `prefers-reduced-motion`.
 */
export function PulseLine({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={cn('h-12 w-full', className)}
      fill="none"
      preserveAspectRatio="none"
      viewBox="0 0 600 60"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M0 30 H80 l12 -22 l14 44 l12 -30 l10 12 H240 l14 -26 l16 50 l12 -34 l10 10 H420 l12 -20 l14 40 l12 -28 l10 8 H600"
        pathLength={1}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        style={{
          strokeDasharray: '0.28 0.72',
          animation: 'pulse-trace 3.2s linear infinite',
        }}
      />
    </svg>
  );
}
