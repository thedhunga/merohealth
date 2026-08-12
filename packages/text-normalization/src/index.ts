/* ------------------------------------------------------------------ *
 * Text normalization
 *
 * Was `normalizeLabel`, copy-pasted verbatim into `medication-safety` and
 * `population-health` (each comment pointing at the other as "the
 * original"), the same DRY-drift risk class already paid down once for
 * `storage-adapters`'s filename sanitization. Extracted here so the two
 * callers can no longer silently diverge on this exact rule.
 * ------------------------------------------------------------------ */

/**
 * NFKC + case-fold, so two labels for the same substance or condition match
 * regardless of capitalisation or Unicode composition (e.g. a precomposed
 * Devanagari vowel sign versus its decomposed combining-mark equivalent).
 * Deliberately *not* a clinical synonym matcher — it never asserts that two
 * distinct labels mean the same thing, only that the same label written two
 * ways is the same string.
 */
export function normalizeLabel(label: string): string {
  return label.normalize('NFKC').trim().toLowerCase();
}
