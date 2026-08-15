import { describe, expect, it } from 'vitest';
import { t } from './index';
describe('localization', () => {
  it('ships real Nepali primary labels', () => {
    expect(t('ne', 'ask')).toBe('स्वास्थ्य प्रश्न सोध्नुहोस्');
    expect(t('ne', 'emergency')).not.toMatch(/TODO|placeholder/i);
  });

  it('translates the document title for every language, not just English', () => {
    expect(t('en', 'appTitle')).toBe('Mero Health - Your health, in your language');
    expect(t('ne', 'appTitle')).not.toBe(t('en', 'appTitle'));
    expect(t('ne-Latn', 'appTitle')).not.toBe(t('en', 'appTitle'));
  });
});
