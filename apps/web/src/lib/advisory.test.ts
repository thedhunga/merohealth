import { describe, expect, it } from 'vitest';

import { computeAdvisory } from './advisory';

describe('computeAdvisory', () => {
  it('returns the medicine variant when a medicine is named', () => {
    expect(computeAdvisory('Take two paracetamol tablets every six hours.', 'en')).toEqual({
      kind: 'medicine',
      medicines: ['paracetamol'],
    });
  });

  it('returns the generic advice variant when no medicine is named but the text instructs an action', () => {
    expect(computeAdvisory('Increase your water intake and rest more.', 'en')).toEqual({
      kind: 'advice',
      medicines: [],
    });
  });

  it('returns null for an answer that neither names a medicine nor instructs an action', () => {
    expect(computeAdvisory('Blood pressure varies naturally throughout the day.', 'en')).toBeNull();
  });

  it('falls back to the generic advice variant, never to null, when the detector throws', () => {
    const throwingDetector = () => {
      throw new Error('detector unavailable');
    };
    expect(computeAdvisory('Anything at all.', 'en', throwingDetector)).toEqual({
      kind: 'advice',
      medicines: [],
    });
  });
});

describe('prescription tier', () => {
  it('names prescription-tier medicines first and uses the firmer kind', () => {
    const r = computeAdvisory('जीवनजल दिनुहोस् र चिकित्सकले भने मात्र मोक्स लिनुहोस्।', 'ne');
    expect(r?.kind).toBe('prescription');
    expect(r?.medicines[0]).toBe('एमोक्सिसिलिन');
    expect(r?.medicines).toContain('जीवनजल (ORS)');
  });

  it('stays at "medicine" when only OTC-tier medicines are named', () => {
    const r = computeAdvisory('Take Cetamol for the fever and drink ORS.', 'en');
    expect(r?.kind).toBe('medicine');
    expect(r?.medicines).toEqual(['paracetamol', 'ORS']);
  });
});
