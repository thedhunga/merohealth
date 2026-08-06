import { describe, expect, it } from 'vitest';
import { t } from './index';
describe('localization', () => {
  it('ships real Nepali primary labels', () => {
    expect(t('ne', 'ask')).toBe('स्वास्थ्य प्रश्न सोध्नुहोस्');
    expect(t('ne', 'emergency')).not.toMatch(/TODO|placeholder/i);
  });
});
