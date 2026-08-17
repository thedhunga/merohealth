import { classifyDomain } from '@swasthya/intent-router';
import type { DomainClassification } from '@swasthya/intent-router';

import type { ResearchLanguage } from '@/lib/companion-research';

/**
 * Wraps `classifyDomain` for the research route: fails toward `HEALTH` on
 * any classifier error, never toward `OFF_TOPIC` — a bug in the deterministic
 * word-list matcher must never itself block a real question from reaching
 * the model. Same fail-open direction the ledger specifies for this task
 * ("treated as HEALTH — fail open on helpfulness") and the same shape as
 * `computeAdvisory`'s injectable-detector pattern, so the outage path is
 * testable without mocking `@swasthya/intent-router`.
 */
export function classifyMessageDomain(
  text: string,
  language: ResearchLanguage,
  classify: typeof classifyDomain = classifyDomain,
): DomainClassification {
  try {
    return classify(text, language);
  } catch {
    return 'HEALTH';
  }
}
