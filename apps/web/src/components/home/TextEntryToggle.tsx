'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Keyboard } from 'lucide-react';

import { cn } from '@/lib/cn';

interface TextEntryToggleProps {
  toggleLabel: string;
  promoted: boolean;
  placeholder: string;
  submitLabel: string;
  onSubmit: (question: string) => void;
}

/**
 * Round seven, task P (second box): the text-entry control beside the mic
 * disc used to be a bare button/link that jumped straight to `/get-care`
 * with an empty field — everyone who preferred typing paid for a blank
 * screen before they could start. It now expands in place: tapping reveals
 * the input right here, and submitting hands the typed text to `/get-care`
 * pre-filled, the same way the quick chips already do. `lg:` always shows
 * the expanded input and hides the toggle — a mouse-and-keyboard visitor has
 * no reason to tap a button to reveal a field a large screen has room to
 * show already, alongside the mic, per the ledger box.
 *
 * The toggle stays mounted (not remounted) when it expands, so `autoFocus`
 * would only fire once at page load rather than when the person actually
 * asks for the field — hence the ref + effect instead.
 */
export function TextEntryToggle({ toggleLabel, promoted, placeholder, submitLabel, onSubmit }: TextEntryToggleProps) {
  const [expanded, setExpanded] = useState(false);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (expanded) inputRef.current?.focus();
  }, [expanded]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(value.trim());
  };

  return (
    <div className="mt-2 flex w-full max-w-sm flex-col items-center">
      <button
        className={cn(
          'min-h-11 items-center gap-1.5 text-sm font-semibold transition-colors lg:hidden',
          expanded ? 'hidden' : 'inline-flex',
          promoted
            ? 'rounded-pill bg-marigold-500 px-5 text-indigo-950 hover:bg-marigold-300'
            : 'px-2 text-accent-text hover:text-indigo-800',
        )}
        onClick={() => setExpanded(true)}
        type="button"
      >
        <Keyboard aria-hidden className="size-4" />
        {toggleLabel}
      </button>

      <form
        className={cn('w-full items-center gap-2', expanded ? 'flex' : 'hidden lg:flex')}
        onSubmit={handleSubmit}
      >
        <input
          className="min-h-11 flex-1 rounded-pill border border-line bg-surface px-4 text-sm text-ink placeholder:text-ink-soft focus:border-indigo-400 focus:outline-none"
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          ref={inputRef}
          type="text"
          value={value}
        />
        <button
          aria-label={submitLabel}
          className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-full bg-marigold-500 text-indigo-950 transition-colors hover:bg-marigold-300"
          type="submit"
        >
          <ArrowRight aria-hidden className="size-4" />
        </button>
      </form>
    </div>
  );
}
