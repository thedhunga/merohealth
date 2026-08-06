import type { RiskLevel, SafetyAssessment } from '@swasthya/shared-types';
interface SafetyRule {
  id: string;
  level: RiskLevel;
  interrupt: boolean;
  templateId: string;
  phrases: RegExp[];
}
export const safetyRules: readonly SafetyRule[] = [
  { id: 'emergency-breathing-001', level: 'EMERGENCY_NOW', interrupt: true, templateId: 'emergency-general-v1', phrases: [/can'?t breathe/i, /cannot breathe/i, /difficulty breathing/i, /सास फेर्न (गाह्रो|सक्दिन)/u, /saas ferna (garo|sakdina)/i] },
  { id: 'emergency-chest-001', level: 'EMERGENCY_NOW', interrupt: true, templateId: 'emergency-general-v1', phrases: [/chest (pain|pressure).*(severe|sweat|faint|arm|jaw)/i, /छाती.*(कडा|दुखाइ|पसिना|बेहोस)/u] },
  { id: 'self-harm-001', level: 'MENTAL_HEALTH_CONCERN', interrupt: true, templateId: 'mental-health-crisis-v1', phrases: [/kill myself/i, /suicide/i, /end my life/i, /आत्महत्या/u, /मर्न मन लाग/u, /aatmahatya/i] },
  { id: 'pregnancy-warning-001', level: 'MATERNAL_CONCERN', interrupt: true, templateId: 'maternal-urgent-v1', phrases: [/(pregnant|pregnancy).*(heavy bleeding|seizure|severe headache)/i, /गर्भवती.*(धेरै रगत|दौरा|कडा टाउको)/u] },
  { id: 'pediatric-warning-001', level: 'PEDIATRIC_CONCERN', interrupt: true, templateId: 'pediatric-urgent-v1', phrases: [/(baby|infant).*(blue|not breathing|unresponsive|seizure)/i, /बच्चा.*(नीलो|सास.*छैन|बेहोस|दौरा)/u] },
];
export const approvedSafetyTemplates = {
  'emergency-general-v1': {
    ne: 'यो आपतकालीन अवस्था हुन सक्छ। यो एपले आपतकालीन उपचार दिन सक्दैन। अहिले नै नजिकको उपयुक्त आपतकालीन सेवामा सम्पर्क गर्नुहोस् वा नजिकको अस्पताल जानुहोस्।',
    en: 'This may be an emergency. This app cannot provide emergency care. Contact a locally verified emergency service now or go to the nearest appropriate hospital.',
  },
  'mental-health-crisis-v1': {
    ne: 'तपाईं अहिले एक्लै नबस्नुहोस्। आफूलाई हानि पुर्‍याउन सक्ने वस्तुबाट टाढा जानुहोस् र विश्वासिलो व्यक्तिलाई तुरुन्त सम्पर्क गर्नुहोस्। तत्काल जोखिम भए नजिकको आपतकालीन सेवामा जानुहोस्।',
    en: 'Please do not stay alone right now. Move away from anything you could use to harm yourself and contact a trusted person immediately. If danger is immediate, go to the nearest emergency service.',
  },
  'maternal-urgent-v1': {
    ne: 'गर्भावस्थामा यो लक्षण तुरुन्त जाँच गर्नुपर्ने हुन सक्छ। अहिले नै प्रसूति सेवा भएको नजिकको स्वास्थ्य संस्थामा सम्पर्क गर्नुहोस्।',
    en: 'This symptom in pregnancy may need immediate assessment. Contact the nearest facility with maternity care now.',
  },
  'pediatric-urgent-v1': {
    ne: 'बच्चाको यो लक्षण तुरुन्त जाँच गर्नुपर्ने हुन सक्छ। अहिले नै बाल आपतकालीन सेवा भएको स्वास्थ्य संस्थामा जानुहोस्।',
    en: 'This symptom in a child may need immediate assessment. Go now to a facility with pediatric emergency care.',
  },
} as const;
type SafetyTemplateId = keyof typeof approvedSafetyTemplates;
export function assessSafety(message: string): SafetyAssessment {
  const normalized = message.normalize('NFKC').trim();
  const matches = safetyRules.filter((rule) => rule.phrases.some((phrase) => phrase.test(normalized)));
  const first = matches[0];
  if (!first) return { riskLevel: 'CLINICIAN_RECOMMENDED', matchedRuleIds: [], interruptConversation: false };
  return { riskLevel: first.level, matchedRuleIds: matches.map((rule) => rule.id), interruptConversation: first.interrupt, templateId: first.templateId };
}
export function getSafetyTemplate(templateId: string, language: 'ne' | 'en'): string | null {
  if (!(templateId in approvedSafetyTemplates)) return null;
  return approvedSafetyTemplates[templateId as SafetyTemplateId][language];
}
