'use client';

import { Mic } from 'lucide-react';

import { cn } from '@/lib/cn';

export type MicHeroState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'unavailable';

interface MicHeroProps {
  state: MicHeroState;
  label: string;
  onClick: () => void;
}

const DISC_TONE: Record<MicHeroState, string> = {
  idle: 'bg-marigold-500 text-indigo-950 hover:bg-marigold-300',
  listening: 'bg-danger-100 text-danger-500',
  thinking: 'animate-pulse bg-indigo-800 text-white motion-reduce:animate-none',
  speaking: 'bg-indigo-100 text-indigo-800',
  // `text-indigo-700`, not `text-ink-soft`: `bg-indigo-100` is a fixed brand
  // tint (see `globals.css`'s dark-theme comment), and `ink-soft` flips to a
  // light colour in dark mode that would go illegible against it.
  unavailable: 'cursor-not-allowed bg-indigo-100 text-indigo-700',
};

/**
 * Round seven, task P: the mic disc `HomeScreen` and `FirstVisitScreen` each
 * rendered their own copy of (task O's last log entry flagged absorbing that
 * duplication as this task's job, not O's). `listening` reuses the exact
 * `bg-danger-100 text-danger-500` pairing `GetCareFlow`'s own mic button
 * already uses for the same state; `thinking`/`speaking` mirror
 * `LoadingPanel` and the playback-active Listen button there too — one state
 * vocabulary, not a second one invented for this component.
 *
 * `thinking`/`speaking` are not reachable from either caller yet: both still
 * hand off to `/get-care` the instant the disc is tapped, before any state
 * past `idle`/`unavailable` could render. They are part of the contract
 * anyway — this component's job is to be correct for whoever plugs in a live
 * listener next (starting with `GetCareFlow` itself), not just today's two
 * callers.
 */
export function MicHero({ state, label, onClick }: MicHeroProps) {
  const disabled = state === 'unavailable';

  return (
    <div className="flex flex-col items-center">
      <div className="relative grid place-items-center">
        {state === 'listening' ? (
          // The pulsing ring, separate from the disc itself, so the disc's
          // own background can stay a flat `listening` tone instead of
          // pulsing its fill (which would fight the ring for attention).
          // `motion-reduce:animate-none` leaves it visible but still — a
          // static ring, per the round's motion budget — rather than
          // vanishing the one cue that recording is live.
          <span
            aria-hidden
            className="absolute inset-0 animate-ping rounded-full bg-danger-500/30 motion-reduce:animate-none"
          />
        ) : null}
        <button
          aria-label={label}
          className={cn(
            'relative grid size-28 place-items-center rounded-full shadow-lift transition-transform duration-150 active:scale-95',
            DISC_TONE[state],
          )}
          disabled={disabled}
          onClick={onClick}
          type="button"
        >
          <Mic aria-hidden className="size-10" />
        </button>
      </div>
      {disabled ? (
        <p className="mt-3 max-w-[24ch] text-center text-sm text-ink-soft">{label}</p>
      ) : (
        <p className="mt-3 text-base font-bold text-ink">{label}</p>
      )}
    </div>
  );
}
