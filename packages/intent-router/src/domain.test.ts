import { describe, expect, it } from 'vitest';

import { classifyDomain } from './domain';

describe('classifyDomain', () => {
  it.each([
    // -- HEALTH: symptoms --------------------------------------------------
    ['I have had a fever for two days', 'en', 'HEALTH'],
    ['मलाई दुई दिनदेखि ज्वरो आएको छ', 'ne', 'HEALTH'],
    ['I keep getting headaches in the morning', 'en', 'HEALTH'],
    ['मेरो टाउको दुख्ने भइरहेको छ', 'ne', 'HEALTH'],
    ['jwaro ra khoki aayeko cha', 'ne', 'HEALTH'],
    ['I have a persistent cough and sore throat', 'en', 'HEALTH'],
    ['बच्चालाई पखाला लागेको छ', 'ne', 'HEALTH'],
    ['I feel dizzy and nauseous after eating', 'en', 'HEALTH'],
    // -- HEALTH: body parts --------------------------------------------------
    ['I have chest pain when I climb stairs', 'en', 'HEALTH'],
    ['मेरो पेट दुखेको छ', 'ne', 'HEALTH'],
    ['my kidney function report looks abnormal', 'en', 'HEALTH'],
    // -- HEALTH: tests / documents -------------------------------------------
    ['can you explain my blood test report', 'en', 'HEALTH'],
    ['मेरो एक्स-रे रिपोर्ट के भन्छ', 'ne', 'HEALTH'],
    ['what does an MRI show for a knee injury', 'en', 'HEALTH'],
    // -- HEALTH: named conditions ---------------------------------------------
    ['how do I manage my diabetes', 'en', 'HEALTH'],
    ['मलाई उच्च रक्तचाप छ, के गर्ने', 'ne', 'HEALTH'],
    ['what triggers an asthma attack', 'en', 'HEALTH'],
    ['थाइरोइडको लक्षण के के हुन्छ', 'ne', 'HEALTH'],
    // -- HEALTH: generic clinical words -------------------------------------
    ['should I see a doctor about this rash', 'en', 'HEALTH'],
    ['नजिकैको अस्पताल कहाँ छ', 'ne', 'HEALTH'],
    ['what is the right dosage for this medicine', 'en', 'HEALTH'],

    // -- HEALTH_ADJACENT: the ledger's own tricky cases ----------------------
    ['my daughter is sad and won’t talk to me', 'en', 'HEALTH_ADJACENT'],
    ['how do I cook dal for a diabetic', 'en', 'HEALTH_ADJACENT'],
    ['मेरी छोरी अचेल एक्लो महसुस गर्छिन्', 'ne', 'HEALTH_ADJACENT'],
    ['what should I cook for someone with high blood pressure', 'en', 'HEALTH_ADJACENT'],
    ['I have been feeling very stressed about work lately', 'en', 'HEALTH_ADJACENT'],
    ['मलाई राति निद्रा लाग्दैन', 'ne', 'HEALTH_ADJACENT'],
    ['my elderly father seems lonely since my mother passed', 'en', 'HEALTH_ADJACENT'],
    ['is yoga good for beginners', 'en', 'HEALTH_ADJACENT'],
    ['मेरो श्रीमानलाई काममा धेरै तनाव छ', 'ne', 'HEALTH_ADJACENT'],
    ['what is a good diet for a new mother', 'en', 'HEALTH_ADJACENT'],

    // -- OFF_TOPIC ------------------------------------------------------------
    ['who won the match yesterday', 'en', 'OFF_TOPIC'],
    ['भोलिको मौसम कस्तो हुन्छ', 'ne', 'OFF_TOPIC'],
    ['when is the next election', 'en', 'OFF_TOPIC'],
    ['निर्वाचनको मिति कहिले हो', 'ne', 'OFF_TOPIC'],
    ['can you help me debug this python code', 'en', 'OFF_TOPIC'],
    ['मेरो गृहकार्य गर्न सहयोग गर्नुहोस्', 'ne', 'OFF_TOPIC'],
    ['what is the stock market doing today', 'en', 'OFF_TOPIC'],
    ['who is the lead actor in that new movie', 'en', 'OFF_TOPIC'],
    ['कुन चलचित्र हेर्ने राम्रो होला', 'ne', 'OFF_TOPIC'],
    ['is it going to rain tomorrow', 'en', 'OFF_TOPIC'],
    ['who scored the winning goal', 'en', 'OFF_TOPIC'],

    // -- health signal wins over an off-topic word in the same sentence -----
    ['will the rain make my asthma worse', 'en', 'HEALTH'],
    ['के खेल खेल्दा मेरो घुँडाको दुखाइ बढ्न सक्छ', 'ne', 'HEALTH'],

    // -- UNSURE: nothing recognisable either way -----------------------------
    ['tell me something interesting', 'en', 'UNSURE'],
    ['hmm okay', 'en', 'UNSURE'],
    ['के हुन्छ त', 'ne', 'UNSURE'],
  ] as const)('classifies %j (%s) as %s', (text, lang, expected) => {
    expect(classifyDomain(text, lang)).toBe(expected);
  });

  it('does not match a romanised Nepali health word against an English-locale message', () => {
    // "daktar" (doctor) is a real romanised-Nepali word, but gated behind
    // lang === 'ne' — see the comment on HEALTH_PATTERNS_ROMANIZED_NE. An
    // English-locale caller passing text that happens to contain it should
    // not get a false HEALTH match from that alone.
    expect(classifyDomain('daktar who invented the printing press', 'en')).toBe('UNSURE');
  });

  it('still recognises the same romanised word when lang is ne', () => {
    expect(classifyDomain('nearby daktar kaha cha', 'ne')).toBe('HEALTH');
  });
});
