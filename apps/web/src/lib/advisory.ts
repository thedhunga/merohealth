import { detectAdvisoryTriggers } from '@swasthya/clinical-safety';

import type { ResearchAdvisory, ResearchLanguage } from '@/lib/companion-research';

/**
 * Turns a completed answer into the advisory the research route attaches to
 * its response, or `null` for an answer that neither names a medicine nor
 * instructs an action. Fails toward the generic `advice` warning rather than
 * toward silence on any detector error — the same direction
 * `clinical-safety`'s own emergency interception fails — so a bug in the
 * word-list matcher can never make a completed answer look unreviewed.
 *
 * `detect` is injectable, defaulting to the real detector, so the outage
 * path is testable without mocking `@swasthya/clinical-safety` itself —
 * the same pattern `gemini-health.ts` uses for `fetchImpl`.
 */
export function computeAdvisory(
  answer: string,
  language: ResearchLanguage,
  detect: typeof detectAdvisoryTriggers = detectAdvisoryTriggers,
): ResearchAdvisory | null {
  try {
    const { medicines, givesAdvice, prescriptionOnly } = detect(answer, language);
    if (prescriptionOnly.length > 0) {
      // Prescription-tier first so the copy names them; the rest follow.
      const rest = medicines.filter((m) => !prescriptionOnly.includes(m));
      return { kind: 'prescription', medicines: [...prescriptionOnly, ...rest] };
    }
    if (medicines.length > 0) return { kind: 'medicine', medicines };
    if (givesAdvice) return { kind: 'advice', medicines: [] };
    return null;
  } catch {
    return { kind: 'advice', medicines: [] };
  }
}
