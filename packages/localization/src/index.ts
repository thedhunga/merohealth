import type { LanguageCode } from '@swasthya/shared-types';
export const copy = {
  ne: {
    greeting: 'नमस्ते, म स्वास्थ्य साथी हुँ', homePrompt: 'आज तपाईंलाई केमा सहयोग चाहिन्छ?',
    ask: 'स्वास्थ्य प्रश्न सोध्नुहोस्', doctor: 'डाक्टरसँग कुरा गर्नुहोस्',
    medicines: 'औषधि अर्डर', record: 'मेरो स्वास्थ्य विवरण', lab: 'प्रयोगशाला जाँच',
    emergency: 'आपतकालीन सहयोग', companion: 'साथी', twin: 'मेरो स्वास्थ्य चित्र',
    care: 'सेवा खोज्नुहोस्', learn: 'कसरी चलाउने',
  },
  en: {
    greeting: 'Namaste, I am your Swasthya Sathi', homePrompt: 'What would you like help with today?',
    ask: 'Ask a health question', doctor: 'Talk to a doctor', medicines: 'Order medicines',
    record: 'My health record', lab: 'Book a laboratory test', emergency: 'Emergency help',
    companion: 'Companion', twin: 'My health picture', care: 'Find care', learn: 'How it works',
  },
  'ne-Latn': {
    greeting: 'Namaste, ma Swasthya Sathi hu', homePrompt: 'Aaja tapailai k ma sahayog chahinchha?',
    ask: 'Swasthya prasna sodhnuhos', doctor: 'Doctor sanga kura garnuhos', medicines: 'Ausadhi order',
    record: 'Mero swasthya bibaran', lab: 'Laboratory jaanch', emergency: 'Aapatkalin sahayog',
    companion: 'Sathi', twin: 'Mero swasthya chitra', care: 'Sewa khojnuhos', learn: 'Kasari chalaune',
  },
} as const;
export type CopyKey = keyof (typeof copy)['en'];
export function t(language: LanguageCode, key: CopyKey): string { return copy[language][key]; }
