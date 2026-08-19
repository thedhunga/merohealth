import { describe, expect, it } from 'vitest';
import { normaliseContact } from './contact.js';

describe('normaliseContact', () => {
  it('normalises a bare Nepali mobile number', () => {
    expect(normaliseContact('9812345678')).toBe('9812345678');
  });

  it('strips a +977 country code', () => {
    expect(normaliseContact('+977 981-234-5678')).toBe('9812345678');
  });

  it('lower-cases an email', () => {
    expect(normaliseContact('Sunita@Example.com')).toBe('sunita@example.com');
  });

  it('returns null for an empty string', () => {
    expect(normaliseContact('   ')).toBeNull();
  });

  it('returns null for a contact that is neither a Nepali mobile nor an email', () => {
    expect(normaliseContact('not-a-contact')).toBeNull();
    expect(normaliseContact('12345')).toBeNull();
  });
});
