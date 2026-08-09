import { councilRegistry } from '@swasthya/credentialing';
import type { CouncilKey } from '@swasthya/shared-types';

/**
 * Locale-appropriate display name for a council. Extracted from
 * `RegisterView.tsx` so `VerifiedBadge.tsx` can render the same name without
 * duplicating the ne/en switch.
 */
export function councilName(key: CouncilKey, locale: string): string {
  const council = councilRegistry[key];
  return locale === 'ne' ? council.nameNe : council.nameEn;
}
