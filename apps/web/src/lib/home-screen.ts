import { healthLibraryArticles, type HealthLibraryArticle } from '@/content/healthLibrary';

export type GreetingPeriod = 'morning' | 'afternoon' | 'evening';

export type HomeVariant = 'returning' | 'firstVisitLean' | 'marketing';

export type MicHeroLayout = 'voiceFirst' | 'textFirst';

/**
 * Round seven, task O (outage box): both `HomeScreen` and `FirstVisitScreen`
 * build their hero around a mic disc, but `useSpeechDictation`'s `supported`
 * flag starts `false` on every server render and on any browser without the
 * Web Speech API (Firefox, some in-app webviews) — a person on one of those
 * was tapping a mic that could never have listened. `textFirst` disables the
 * disc rather than hiding it (a dead-looking control the person can see is
 * more honest than one that silently vanished) and promotes the type action,
 * with a one-line note explaining why. Pure so both screens share one tested
 * decision instead of two copies that could drift.
 */
export function micHeroLayout(dictationSupported: boolean): MicHeroLayout {
  return dictationSupported ? 'voiceFirst' : 'textFirst';
}

/**
 * Round seven, task O (second box): which `/` a device sees.
 *
 * A device with history always gets the daily-use `HomeScreen`, in any
 * locale — history is a fact about the device, not the language. Otherwise
 * the bare (Nepali) path gets the lean first-visit screen this round asks
 * for; `/en` keeps the full marketing page, which is the front door for the
 * SEO/acquisition audience `platform-vision.md` describes English pages as
 * serving. `individuals`/`about` already carry that same material as their
 * own routes, so nothing is lost by not repeating it on the Nepali home.
 */
export function homeVariant(locale: string, isReturning: boolean): HomeVariant {
  if (isReturning) return 'returning';
  return locale === 'ne' ? 'firstVisitLean' : 'marketing';
}

/**
 * Round seven, task O: the returning-visitor home screen's greeting. Keyed
 * off the local hour rather than a lookup table so it needs no data and
 * never drifts out of sync with the device's own clock.
 */
export function greetingPeriod(hour: number): GreetingPeriod {
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

/**
 * "आजको एक कुरा" — one health-library article, rotated by calendar day
 * rather than generated. Deterministic so the same person sees the same
 * pick all day and a second device on the same day agrees; it advances on
 * its own with no schedule to run and no state to store. Days since the
 * epoch (not the day-of-month or day-of-year) so the rotation does not
 * reset or skip at a month/year boundary.
 */
export function dailyArticle(date: Date): HealthLibraryArticle {
  const daysSinceEpoch = Math.floor(date.getTime() / 86_400_000);
  const article = healthLibraryArticles[daysSinceEpoch % healthLibraryArticles.length];
  if (!article) throw new Error('healthLibraryArticles must not be empty');
  return article;
}
