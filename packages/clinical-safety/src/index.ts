import type { LanguageCode, RiskLevel, SafetyAssessment } from '@swasthya/shared-types';
import { commonMedicinesInNepal, type MedicineEntry, type MedicineTier } from './medicines.js';

export { commonMedicinesInNepal };
export type { MedicineEntry, MedicineTier };
interface SafetyRule {
  id: string;
  level: RiskLevel;
  interrupt: boolean;
  templateId: string;
  phrases: RegExp[];
}
export const safetyRules: readonly SafetyRule[] = [
  { id: 'emergency-breathing-001', level: 'EMERGENCY_NOW', interrupt: true, templateId: 'emergency-general-v1', phrases: [/can'?t breathe/i, /cannot breathe/i, /difficulty breathing/i, /सास फेर्न (गाह्रो|सक्दिन)/u, /saas ferna (garo|sakdina)/i] },
  { id: 'emergency-chest-001', level: 'EMERGENCY_NOW', interrupt: true, templateId: 'emergency-general-v1', phrases: [/(?=.*chest (pain|pressure))(?=.*(severe|sweat|faint|arm|jaw))/i, /छाती.*(कडा|दुखाइ|पसिना|बेहोस)/u, /chati.*(kada|dukhai|pasina|behos)/i] },
  // Journey test 2026-08-19: "मलाई अब बाँच्न मन छैन" — the most common way a
  // Nepali speaker says it — reached the model. Widened to the phrasings
  // people actually use, in Devanagari, English and romanised Nepali. These
  // are language patterns, not clinical claims; err towards matching.
  {
    id: 'self-harm-001',
    level: 'MENTAL_HEALTH_CONCERN',
    interrupt: true,
    templateId: 'mental-health-crisis-v1',
    phrases: [
      // English
      /kill myself/i,
      /suicid/i,
      /end (my|it all|everything)/i,
      /(don'?t|do not|no longer) want to (live|be alive|be here|wake up)/i,
      /want to die/i,
      /better off dead/i,
      /(hurt|harm|cut)(ing)? myself/i,
      /no reason to (live|go on)/i,
      // Devanagari
      /आत्महत्या/u,
      /मर्न (मन|चाहन्छु|चाहन्छ|मन लाग)/u,
      /(बाँच्न|जिउन|जिउने|बाँच्ने) (मन छैन|मन लाग्दैन|इच्छा छैन|चाहन्न|चाहँदिन)/u,
      /(बाँच्नुको|जिउनुको) (अर्थ|मतलब) छैन/u,
      /आफैलाई (मार्न|हानि|चोट)/u,
      /आफूलाई (मार्न|हानि|चोट)/u,
      /मरे हुन्थ्यो/u,
      // Romanised Nepali
      /aatmahatya|atmahatya/i,
      /marna (man|chahanchu|chahanchhu|man lag)/i,
      /(bachna|bãchna|banchna|jiuna) (man chaina|man lagdaina|ichha chaina|chahanna)/i,
      /(bachnuko|jiunuko) (artha|matlab) chaina/i,
      /(aafailai|afailai|aafulai|afulai) (marna|hani|chot)/i,
      /mare hunthyo/i,
    ],
  },
  { id: 'pregnancy-warning-001', level: 'MATERNAL_CONCERN', interrupt: true, templateId: 'maternal-urgent-v1', phrases: [/(?=.*(pregnant|pregnancy))(?=.*(heavy bleeding|seizure|severe headache))/i, /(?=.*गर्भवती)(?=.*(धेरै रगत|दौरा|कडा टाउको))/u, /(?=.*garbhawati)(?=.*(dherai ragat|daura|kada tauko))/i] },
  { id: 'pediatric-warning-001', level: 'PEDIATRIC_CONCERN', interrupt: true, templateId: 'pediatric-urgent-v1', phrases: [/(?=.*(baby|infant))(?=.*(blue|not breathing|unresponsive|seizure))/i, /(?=.*बच्चा)(?=.*(नीलो|सास.*छैन|बेहोस|दौरा))/u, /(?=.*bachcha)(?=.*(nilo|saas.*chaina|behos|daura))/i] },
];
// `ne-Latn` entries are direct Romanized transliterations of the approved
// `ne` wording above them, not new copy — someone who picked Romanized
// Nepali specifically because they don't read Devanagari must still get the
// emergency instruction, not a silent fallback to a script they can't read.
export const approvedSafetyTemplates = {
  'emergency-general-v1': {
    ne: 'यो आपतकालीन अवस्था हुन सक्छ। यो एपले आपतकालीन उपचार दिन सक्दैन। अहिले नै नजिकको उपयुक्त आपतकालीन सेवामा सम्पर्क गर्नुहोस् वा नजिकको अस्पताल जानुहोस्।',
    en: 'This may be an emergency. This app cannot provide emergency care. Contact a locally verified emergency service now or go to the nearest appropriate hospital.',
    'ne-Latn': 'Yo aapatkalin awastha huna sakchha. Yo app le aapatkalin upachar dina sakdaina. Ahile nai najikko upayukta aapatkalin sewama sampark garnuhos wa najikko aspatal januhos.',
  },
  'mental-health-crisis-v1': {
    ne: 'तपाईं अहिले एक्लै नबस्नुहोस्। आफूलाई हानि पुर्‍याउन सक्ने वस्तुबाट टाढा जानुहोस् र विश्वासिलो व्यक्तिलाई तुरुन्त सम्पर्क गर्नुहोस्। तत्काल जोखिम भए नजिकको आपतकालीन सेवामा जानुहोस्।',
    en: 'Please do not stay alone right now. Move away from anything you could use to harm yourself and contact a trusted person immediately. If danger is immediate, go to the nearest emergency service.',
    'ne-Latn': 'Tapai ahile eklai nabasnuhos. Aafulai hani puryauna sakne bastu bata tadha januhos ra biswasilo byaktilai turunta sampark garnuhos. Tatkal jokhim bhaye najikko aapatkalin sewama januhos.',
  },
  'maternal-urgent-v1': {
    ne: 'गर्भावस्थामा यो लक्षण तुरुन्त जाँच गर्नुपर्ने हुन सक्छ। अहिले नै प्रसूति सेवा भएको नजिकको स्वास्थ्य संस्थामा सम्पर्क गर्नुहोस्।',
    en: 'This symptom in pregnancy may need immediate assessment. Contact the nearest facility with maternity care now.',
    'ne-Latn': 'Garbhawasthama yo lakshan turunta jaanch garnuparne huna sakchha. Ahile nai prasuti sewa bhayeko najikko swasthya sansthama sampark garnuhos.',
  },
  'pediatric-urgent-v1': {
    ne: 'बच्चाको यो लक्षण तुरुन्त जाँच गर्नुपर्ने हुन सक्छ। अहिले नै बाल आपतकालीन सेवा भएको स्वास्थ्य संस्थामा जानुहोस्।',
    en: 'This symptom in a child may need immediate assessment. Go now to a facility with pediatric emergency care.',
    'ne-Latn': 'Bachchako yo lakshan turunta jaanch garnuparne huna sakchha. Ahile nai baal aapatkalin sewa bhayeko swasthya sansthama januhos.',
  },
} as const;
type SafetyTemplateId = keyof typeof approvedSafetyTemplates;
export function assessSafety(message: string): SafetyAssessment {
  // NFKC does not fold typographic quotes to their ASCII equivalents — they
  // aren't canonically equivalent — so a phrase like `can'?t breathe` misses
  // "can’t breathe" once a phone's smart-punctuation autocorrect (the
  // default on iOS and most Android keyboards) rewrites the apostrophe.
  // Folding here protects every current and future rule's phrase, not just
  // the ones already written defensively.
  const normalized = message.normalize('NFKC').replace(/[‘’]/g, "'").trim();
  const matches = safetyRules.filter((rule) => rule.phrases.some((phrase) => phrase.test(normalized)));
  const first = matches[0];
  if (!first) return { riskLevel: 'CLINICIAN_RECOMMENDED', matchedRuleIds: [], interruptConversation: false };
  return { riskLevel: first.level, matchedRuleIds: matches.map((rule) => rule.id), interruptConversation: first.interrupt, templateId: first.templateId };
}
export function getSafetyTemplate(templateId: string, language: LanguageCode): string | null {
  if (!(templateId in approvedSafetyTemplates)) return null;
  return approvedSafetyTemplates[templateId as SafetyTemplateId][language];
}

/**
 * `detectAdvisoryTriggers` looks at a completed *answer*, not the person's
 * question — `assessSafety` above interrupts before an answer exists at all;
 * this runs after one, to decide whether it needs a "see a health worker"
 * line attached. Answers are only ever generated in `ne` or `en` (never
 * romanised `ne-Latn`), so this takes the narrower two-way type rather than
 * `LanguageCode`.
 */
export type AdvisoryLanguage = 'ne' | 'en';
export interface AdvisoryTriggers {
  /** Display names of medicines found, in `lang`, deduplicated, first-seen order. */
  medicines: string[];
  /** Whether the text instructs an action — take, apply, stop, adjust a dose. */
  givesAdvice: boolean;
  /**
   * The subset of `medicines` that are prescription-tier — antibiotics,
   * steroids, sedatives, hormonal and chronic-disease medicines. Non-empty
   * means the advisory must say "not without a doctor's prescription", not
   * merely "see a doctor first". Suffix-only matches for antibiotic classes
   * (-cillin, -mycin, -floxacin, cef-) count too.
   */
  prescriptionOnly: string[];
}
// The recognition list lives in ./medicines.ts — one source of truth for the
// detector, the reference document and any future 'what is this' card.
const medicines = commonMedicinesInNepal;

// Catches a medicine not on the named list above — pharmaceutical suffixes
// are conventionally shared across a whole drug class, so a name this list
// has never heard of still reads as "probably a medicine." टेबलेट/क्याप्सुल
// (tablet/capsule) and a bare "<number> mg" catch the dosage-form wording
// itself when no specific drug name is even given.
const genericMedicinePatterns: readonly RegExp[] = [
  /\w+cillin\b/i,
  /\w+mycin\b/i,
  /\w+floxacin\b/i,
  /\bcef\w+/i,
  /\w+prazole\b/i,
  /\w+olol\b/i,
  /\w+sartan\b/i,
  /\w+statin\b/i,
  /\d+\s?mg\b/i,
  /टेबलेट/u,
  /क्याप्सुल/u,
];
/** Suffix-only matches that are antibiotic or chronic-disease classes → prescription tier. */
const genericPrescriptionPattern = /cillin\b|mycin\b|floxacin\b|^cef|olol\b|sartan\b|statin\b|एन्टिबायोटिक|antibiotic/i;
// English, Devanagari, and romanised Nepali, in that order — matched
// regardless of `lang`, unlike the medicine names below, because whether the
// text instructs an action is the safety-relevant fact and must not be
// missed just because the model mixed a Nepali verb into an English answer.
const adviceVerbPatterns: readonly RegExp[] = [
  /\btake\b/i,
  /\bdos(e|age|ing)\b/i,
  /\bapply\b/i,
  /\bstop taking\b/i,
  /\bincrease\b/i,
  /\bdecrease\b/i,
  /लिनुहोस्/u,
  /खानुहोस्/u,
  /मात्रा/u,
  /लगाउनुहोस्/u,
  /बन्द गर्नुहोस्/u,
  /बढाउनुहोस्/u,
  /घटाउनुहोस्/u,
  /linuhos/i,
  /khanuhos/i,
  /\bmatra\b/i,
  /lagaunuhos/i,
  /banda garnuhos/i,
  /badhaunuhos/i,
  /ghataunuhos/i,
];
export function detectAdvisoryTriggers(answerText: string, lang: AdvisoryLanguage): AdvisoryTriggers {
  const normalized = answerText.normalize('NFKC');
  // Keyed by the lower-cased display name so a named match (e.g.
  // "amoxicillin") and a generic-pattern match on the same word (`-cillin`)
  // collapse into one entry instead of naming the same medicine twice.
  // display name → position of its first mention, so the output reads in the
  // order the answer named them, not the order of our list.
  const found = new Map<string, { display: string; at: number }>();
  const prescription = new Set<string>();
  const note = (key: string, display: string, at: number) => {
    const prev = found.get(key);
    if (!prev || at < prev.at) found.set(key, { display, at });
  };
  for (const entry of medicines) {
    let earliest = -1;
    for (const pattern of entry.patterns) {
      const m = pattern.exec(normalized);
      if (m && (earliest < 0 || m.index < earliest)) earliest = m.index;
    }
    if (earliest < 0) continue;
    const display = entry[lang];
    note(display.toLowerCase(), display, earliest);
    if (entry.tier === 'prescription') prescription.add(display.toLowerCase());
  }
  for (const pattern of genericMedicinePatterns) {
    const match = pattern.exec(normalized);
    if (!match) continue;
    const key = match[0].toLowerCase();
    if (!found.has(key)) note(key, match[0], match.index);
    if (genericPrescriptionPattern.test(match[0])) prescription.add(key);
  }
  const ordered = [...found.entries()].sort((a, b) => a[1].at - b[1].at);
  return {
    medicines: ordered.map(([, v]) => v.display),
    givesAdvice: adviceVerbPatterns.some((pattern) => pattern.test(normalized)),
    prescriptionOnly: ordered.filter(([key]) => prescription.has(key)).map(([, v]) => v.display),
  };
}
