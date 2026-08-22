import { describe, expect, it } from 'vitest';
import { approvedSafetyTemplates, assessSafety, commonMedicinesInNepal, detectAdvisoryTriggers, getSafetyTemplate } from './index';
describe('clinical safety routing', () => {
  it.each([
    ['I cannot breathe', 'EMERGENCY_NOW'], ["I can't breathe", 'EMERGENCY_NOW'],
    ['I can’t breathe', 'EMERGENCY_NOW'], ['मलाई सास फेर्न गाह्रो छ', 'EMERGENCY_NOW'],
    ['ma saas ferna sakdina', 'EMERGENCY_NOW'], ['I have severe chest pain and I am sweating', 'EMERGENCY_NOW'],
    ['I have severe chest pain', 'EMERGENCY_NOW'],
    ['छाती दुखाइ र पसिना आइरहेको छ', 'EMERGENCY_NOW'],
    ['chati ma kada dukhai ra pasina aairaheko cha', 'EMERGENCY_NOW'],
    ['I want to kill myself', 'MENTAL_HEALTH_CONCERN'],
    ['मलाई आत्महत्या गर्न मन लाग्छ', 'MENTAL_HEALTH_CONCERN'],
    ['मलाई मर्न मन लाग्छ', 'MENTAL_HEALTH_CONCERN'],
    ['malai marna man lagcha', 'MENTAL_HEALTH_CONCERN'],
    // Journey test 2026-08-19: the phrasings people actually use.
    ['मलाई अब बाँच्न मन छैन', 'MENTAL_HEALTH_CONCERN'],
    ['जिउन मन लाग्दैन', 'MENTAL_HEALTH_CONCERN'],
    ['म मर्न चाहन्छु', 'MENTAL_HEALTH_CONCERN'],
    ['बाँच्नुको अर्थ छैन जस्तो लाग्छ', 'MENTAL_HEALTH_CONCERN'],
    ['आफैलाई चोट पुर्‍याउन मन लाग्छ', 'MENTAL_HEALTH_CONCERN'],
    ["I don't want to live anymore", 'MENTAL_HEALTH_CONCERN'],
    ['I want to die', 'MENTAL_HEALTH_CONCERN'],
    ['I keep thinking about hurting myself', 'MENTAL_HEALTH_CONCERN'],
    ['malai aba bachna man chaina', 'MENTAL_HEALTH_CONCERN'],
    ['jiuna man lagdaina', 'MENTAL_HEALTH_CONCERN'],
    ['I am pregnant and have heavy bleeding', 'MATERNAL_CONCERN'],
    ['I have a severe headache, I am pregnant', 'MATERNAL_CONCERN'],
    ['धेरै रगत बगिरहेको छ, गर्भवती छु', 'MATERNAL_CONCERN'],
    ['ma garbhawati chu ra dherai ragat bagirako cha', 'MATERNAL_CONCERN'],
    ['My baby is blue and not breathing', 'PEDIATRIC_CONCERN'],
    ['not breathing, my baby is', 'PEDIATRIC_CONCERN'],
    ['दौरा आयो, बच्चालाई', 'PEDIATRIC_CONCERN'],
    ['bachcha nilo bhayo ra saas pheraiRaheko chaina', 'PEDIATRIC_CONCERN'],
  ])('interrupts for %s', (message, expected) => {
    const result = assessSafety(message);
    expect(result.riskLevel).toBe(expected);
    expect(result.interruptConversation).toBe(true);
    expect(result.templateId).toBeTruthy();
  });
  it('does not interrupt for a benign message', () => {
    expect(assessSafety('What is a normal blood pressure range?')).toEqual({
      riskLevel: 'CLINICIAN_RECOMMENDED', matchedRuleIds: [], interruptConversation: false,
    });
  });
  it.each([
    ['I want to kill  myself', 'MENTAL_HEALTH_CONCERN'],
    ['I want to kill\nmyself', 'MENTAL_HEALTH_CONCERN'],
    ['I want to kill\tmyself', 'MENTAL_HEALTH_CONCERN'],
    ['I want to kill\u200bmyself', 'MENTAL_HEALTH_CONCERN'],
    ['I  cannot   breathe', 'EMERGENCY_NOW'],
    ['मलाई सास फेर्न\u200bगाह्रो छ', 'EMERGENCY_NOW'],
  ])(
    'still interrupts for %s despite irregular whitespace or a zero-width character between the matching words',
    (message, expected) => {
      const result = assessSafety(message);
      expect(result.riskLevel).toBe(expected);
      expect(result.interruptConversation).toBe(true);
    },
  );
  it('never fabricates a template', () => expect(getSafetyTemplate('made-up', 'en')).toBeNull());
  it('returns the approved template text for every known id and language', () => {
    for (const templateId of Object.keys(approvedSafetyTemplates) as (keyof typeof approvedSafetyTemplates)[]) {
      for (const language of ['ne', 'en', 'ne-Latn'] as const) {
        expect(getSafetyTemplate(templateId, language)).toBe(approvedSafetyTemplates[templateId][language]);
      }
    }
  });
  it('never leaves a template with identical wording across ne, en and ne-Latn', () => {
    for (const template of Object.values(approvedSafetyTemplates)) {
      expect(template.ne).not.toBe(template.en);
      expect(template['ne-Latn']).not.toBe(template.ne);
      expect(template['ne-Latn']).not.toBe(template.en);
    }
  });
});

describe('detectAdvisoryTriggers', () => {
  it.each([
    // English medicine names
    ['Take two paracetamol tablets every six hours.', 'en', ['paracetamol'], true],
    ['Ibuprofen can reduce inflammation.', 'en', ['ibuprofen'], false],
    ['Give the child ORS after each loose stool.', 'en', ['ORS'], false],
    ['Cetirizine is commonly used for seasonal allergies.', 'en', ['cetirizine'], false],
    ['Omeprazole is often prescribed for acid reflux.', 'en', ['omeprazole'], false],
    ['Stop taking pantoprazole if a rash appears.', 'en', ['pantoprazole'], true],
    ['Amoxicillin is a common antibiotic for ear infections.', 'en', ['amoxicillin'], false],
    ['Metformin helps manage blood sugar in type 2 diabetes.', 'en', ['metformin'], false],
    ['Increase the amlodipine dose only under medical supervision.', 'en', ['amlodipine'], true],
    ['Losartan and salbutamol are both prescription-only in Nepal.', 'en', ['losartan', 'salbutamol'], false],
    // Devanagari medicine names
    ['ज्वरो आएमा प्यारासिटामोल लिनुहोस्।', 'ne', ['प्यारासिटामोल'], true],
    ['आइबुप्रोफेनले दुखाइ कम गर्न सक्छ।', 'ne', ['आइबुप्रोफेन'], false],
    ['पखाला लागेमा जीवनजल लिनुहोस्।', 'ne', ['जीवनजल (ORS)'], true],
    ['सेटिरिजिन एलर्जीका लागि प्रयोग हुन्छ।', 'ne', ['सेटिरिजिन'], false],
    ['एमोक्सिसिलिन ब्याक्टेरिया संक्रमणमा प्रयोग हुन्छ।', 'ne', ['एमोक्सिसिलिन'], false],
    ['मेटफर्मिनको मात्रा घटाउनुहोस्।', 'ne', ['मेटफर्मिन'], true],
    ['जिंक पखालामा सहयोगी हुन्छ।', 'ne', ['जिंक'], false],
    ['एल्बेन्डाजोल जुका हटाउन प्रयोग हुन्छ।', 'ne', ['एल्बेन्डाजोल'], false],
    // Romanised Nepali advice verbs, no named medicine
    ['ausadhi khanuhos dui choti dinma', 'ne', [], true],
    ['khurak lai bistarai badhaunuhos', 'ne', [], true],
    ['ghataunuhos matra bistarai', 'ne', [], true],
    ['banda garnuhos yo ausadhi khaan', 'ne', [], true],
    // Generic drug-name and dosage-form patterns, not on the named list
    ['This tablet is 500mg, take it twice daily.', 'en', ['500mg'], true],
    ['Cloxacillin may be prescribed for skin infections.', 'en', ['Cloxacillin'], false],
    ['Clindamycin is sometimes used for dental infections.', 'en', ['Clindamycin'], false],
    ['औषधि पसलमा टेबलेट र क्याप्सुल दुवै किसिम पाइन्छ।', 'ne', ['टेबलेट', 'क्याप्सुल'], false],
    // Mixed script — a Latin-script drug name inside a Nepali sentence, and vice versa
    ['Diabetes भएकालाई Metformin लिन सकिन्छ।', 'ne', ['मेटफर्मिन'], false],
    ['तपाईंलाई Paracetamol चाहिन्छ भने डाक्टरलाई सोध्नुहोस्।', 'ne', ['प्यारासिटामोल'], false],
    ['Take एक ट्याब्लेट Ibuprofen दिनको दुई पटक।', 'en', ['ibuprofen'], true],
    // Benign — no medicine, no instruction
    ['Blood pressure readings vary throughout the day and are not by themselves an emergency.', 'en', [], false],
  ] as const)('reads %s', (answerText, lang, expectedMedicines, expectedGivesAdvice) => {
    const result = detectAdvisoryTriggers(answerText, lang);
    expect(result.medicines).toEqual(expectedMedicines);
    expect(result.givesAdvice).toBe(expectedGivesAdvice);
  });

  it('is order-independent and deduplicates a medicine named twice', () => {
    const result = detectAdvisoryTriggers('Paracetamol helps with fever. Paracetamol is also used for pain.', 'en');
    expect(result.medicines).toEqual(['paracetamol']);
  });

  it('returns no medicines and no advice for a question, not an answer, mentioning neither', () => {
    expect(detectAdvisoryTriggers('What foods are high in iron?', 'en')).toEqual({
      medicines: [],
      givesAdvice: false,
      prescriptionOnly: [],
    });
  });
});

describe('Nepal medicine lexicon — brand names people actually say, and the prescription tier', () => {
  it.each([
    // brand → generic (Latin)
    ['Cetamol le jworo ghatauncha', 'en', 'paracetamol', 'otc'],
    ['She bought Flexon from the pharmacy', 'en', 'ibuprofen', 'otc'],
    ['Omez before breakfast', 'en', 'omeprazole', 'otc'],
    ['Take Mox three times a day', 'en', 'amoxicillin', 'prescription'],
    ['Azithral 500', 'en', 'azithromycin', 'prescription'],
    ['Ciplox for the loose motion', 'en', 'ciprofloxacin', 'prescription'],
    ['Flagyl and ORS', 'en', 'metronidazole', 'prescription'],
    ['Asthalin inhaler when breathless', 'en', 'salbutamol', 'prescription'],
    ['an i-pill within 72 hours', 'en', 'emergency contraceptive pill', 'prescription'],
    ['Betnovate on the rash', 'en', 'betamethasone (steroid cream)', 'prescription'],
    ['Thyronorm every morning', 'en', 'levothyroxine', 'prescription'],
    // Devanagari, brand and generic
    ['सिटामोल दुई चक्की', 'ne', 'प्यारासिटामोल', 'otc'],
    ['ओमेज खाली पेटमा', 'ne', 'ओमेप्राजोल', 'otc'],
    ['जीवनजल र जिंक', 'ne', 'जीवनजल (ORS)', 'otc'],
    ['मोक्स तीन पटक', 'ne', 'एमोक्सिसिलिन', 'prescription'],
    ['एजिथ्रल ५००', 'ne', 'एजिथ्रोमाइसिन', 'prescription'],
    ['डायजेपाम सुत्नुअघि', 'ne', 'डायजेपाम', 'prescription'],
    ['जुकाको औषधि खुवाउनुहोस्', 'ne', 'एल्बेन्डाजोल', 'otc'],
    ['बेटाडिन लगाउनुहोस्', 'ne', 'पोभिडोन आयोडिन', 'otc'],
  ] as const)('%s → %s (%s)', (text, lang, display, tier) => {
    const r = detectAdvisoryTriggers(text, lang);
    expect(r.medicines).toContain(display);
    if (tier === 'prescription') expect(r.prescriptionOnly).toContain(display);
    else expect(r.prescriptionOnly).not.toContain(display);
  });

  it('flags an unknown antibiotic by suffix as prescription-tier', () => {
    const r = detectAdvisoryTriggers('The doctor may consider levofloxacin or cefuroxime.', 'en');
    expect(r.prescriptionOnly.map((m) => m.toLowerCase())).toEqual(expect.arrayContaining(['levofloxacin', 'cefuroxime']));
  });

  it('does not treat everyday words as medicines', () => {
    for (const s of ['Drink warm water and rest.', 'पानी धेरै पिउनुहोस् र आराम गर्नुहोस्।', 'I have no energy today', 'The Panasonic TV']) {
      expect(detectAdvisoryTriggers(s, 'ne').medicines).toEqual([]);
    }
  });

  it('every entry has both names, a category in both languages, and at least one Devanagari pattern', () => {
    for (const m of commonMedicinesInNepal) {
      expect(m.en.length).toBeGreaterThan(1);
      expect(m.ne).toMatch(/[ऀ-ॿ]/);
      expect(m.use.en.length).toBeGreaterThan(2);
      expect(m.use.ne).toMatch(/[ऀ-ॿ]/);
      expect(m.patterns.some((p) => /[ऀ-ॿ]/.test(p.source))).toBe(true);
      // No dose ever sneaks into the category label.
      expect(m.use.en).not.toMatch(/\d+\s?(mg|ml)/i);
    }
    expect(commonMedicinesInNepal.length).toBeGreaterThanOrEqual(60);
  });

  // A pattern list this size is edited far more often than it is read in
  // full — these two checks catch the two ways that editing silently breaks
  // recognition instead of raising a type error: a new/edited pattern that
  // no longer matches the very name it was written for (a bad escape, a
  // wrong Devanagari conjunct, a stray anchor), and a pattern copy-pasted
  // from one entry into another, which would misattribute a real mention.
  const genericLabelEntries = new Set(['pain-relief balm', 'cold and flu tablet']);
  it("every entry's own name is recognised by one of its own patterns, except the named generic-label entries (no single brand to match)", () => {
    for (const m of commonMedicinesInNepal) {
      if (genericLabelEntries.has(m.en)) continue;
      expect(m.patterns.some((p) => p.test(m.en))).toBe(true);
      expect(m.patterns.some((p) => p.test(m.ne))).toBe(true);
    }
  });

  it('no pattern is duplicated verbatim across two different entries', () => {
    const owner = new Map<string, string>();
    for (const m of commonMedicinesInNepal) {
      for (const p of m.patterns) {
        const key = `${p.source} ${p.flags}`;
        const existing = owner.get(key);
        expect(existing === undefined || existing === m.en, `pattern /${p.source}/${p.flags} is shared by "${existing}" and "${m.en}"`).toBe(true);
        owner.set(key, m.en);
      }
    }
  });
});

describe('one medicine, one name — across scripts', () => {
  it('does not list a named medicine twice when a suffix pattern also hits its Latin form', () => {
    const r = detectAdvisoryTriggers("'मोक्स' (Mox/Amoxicillin) एक एन्टिबायोटिक औषधि हो।", 'ne');
    expect(r.medicines).toEqual(['एमोक्सिसिलिन']);
    expect(r.prescriptionOnly).toEqual(['एमोक्सिसिलिन']);
    const o = detectAdvisoryTriggers('ओमेज (Omez/Omeprazole) एसिड कम गर्ने औषधि हो।', 'ne');
    expect(o.medicines).toEqual(['ओमेप्राजोल']);
  });
});
