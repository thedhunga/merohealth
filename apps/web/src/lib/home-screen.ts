import { healthLibraryArticles, type HealthLibraryArticle } from '@/content/healthLibrary';

export type GreetingPeriod = 'morning' | 'afternoon' | 'evening';

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
