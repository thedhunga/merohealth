import { describe, expect, it } from 'vitest';

import { hasAsset } from './assets';
import { testimonialKeys } from '@/content/home';

/**
 * `EditorialImage` (and `hasVideo`) decide photo-vs-fallback purely on this
 * boolean, so proving it against the repo's actual `public/imagery` state is
 * what "confirm the fallback renders cleanly" (queue item C) comes down to —
 * no jsdom/testing-library render is needed to exercise the branch that
 * matters. Two of the four testimonial portraits are known-missing right
 * now (Higgsfield credits exhausted mid-batch, see agent-progress.md); this
 * test pins that split so a future asset drop is visible as a test change
 * rather than a silent behavior shift.
 */
describe('hasAsset', () => {
  it('finds a portrait that has actually landed in public/imagery', () => {
    expect(hasAsset('/imagery/portrait-sabina.webp')).toBe(true);
    expect(hasAsset('/imagery/portrait-prakash.webp')).toBe(true);
  });

  it('reports missing for portraits still pending generation', () => {
    expect(hasAsset('/imagery/portrait-raju.webp')).toBe(false);
    expect(hasAsset('/imagery/portrait-mina.webp')).toBe(false);
  });

  it('agrees with the filesystem for every key Testimonials actually renders', () => {
    const landed = testimonialKeys.filter((key) => hasAsset(`/imagery/portrait-${key}.webp`));
    // Asserts against the known split rather than just "some are missing" —
    // a regression that flips which two exist should fail this test too.
    expect(landed.sort()).toEqual(['prakash', 'sabina']);
  });

  it('refuses a path outside the public root', () => {
    expect(hasAsset('/../package.json')).toBe(false);
    expect(hasAsset('not-absolute.webp')).toBe(false);
  });

  it('reports missing for a path that is well-formed but does not exist', () => {
    expect(hasAsset('/imagery/does-not-exist.webp')).toBe(false);
  });
});
