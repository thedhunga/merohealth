import { describe, expect, it } from 'vitest';

import { councilName } from '@/lib/council-name';

describe('councilName', () => {
  it('returns the Nepali name for the ne locale', () => {
    expect(councilName('NMC', 'ne')).toBe('नेपाल चिकित्सक परिषद्');
  });

  it('returns the English name for any other locale', () => {
    expect(councilName('NMC', 'en')).toBe('Nepal Medical Council');
    expect(councilName('NMC', 'ne-Latn')).toBe('Nepal Medical Council');
  });
});
