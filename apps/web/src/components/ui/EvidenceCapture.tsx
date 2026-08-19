'use client';

import type { ChangeEvent } from 'react';

/**
 * Extracted from `clinicians/RegisterView.tsx`, its only prior home, once
 * `account/IdentityVerification.tsx` needed the identical single-photo
 * capture control for a document image — same DRY call
 * `Testimonials.tsx`→`EditorialImage` and `google-drive-store.ts`→
 * `hosted-store.ts`'s shared `filename.ts` already made for a second real
 * caller of one-off UI.
 *
 * A hidden file input triggered by its own visible `<label>` — the standard
 * accessible pattern for styling a file picker without JS click-forwarding.
 * `capture="environment"` opens the device camera directly on a phone
 * browser while still falling back to a plain file picker on desktop; there
 * is no live-preview camera flow on the web the way `apps/mobile`'s
 * `expo-camera` capture screen has one.
 */
export interface CapturedFile {
  file: File;
  previewUrl: string;
}

export function EvidenceCapture({
  captured,
  chooseLabel,
  changeLabel,
  hint,
  id,
  label,
  onCapture,
}: {
  captured: CapturedFile | null;
  chooseLabel: string;
  changeLabel: string;
  hint: string;
  id: string;
  label: string;
  onCapture: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <div>
        <p className="font-semibold text-ink">{label}</p>
        <p className="text-sm text-ink-soft">{hint}</p>
      </div>
      {captured ? (
        <img
          alt={label}
          className="aspect-[3/2] w-full rounded-xl object-cover"
          src={captured.previewUrl}
        />
      ) : null}
      <label
        className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-pill bg-indigo-100 px-4 py-2 text-sm font-semibold text-indigo-800 hover:bg-indigo-200"
        htmlFor={id}
      >
        {captured ? changeLabel : chooseLabel}
      </label>
      <input
        accept="image/*"
        capture="environment"
        className="sr-only"
        id={id}
        onChange={onCapture}
        type="file"
      />
    </div>
  );
}
