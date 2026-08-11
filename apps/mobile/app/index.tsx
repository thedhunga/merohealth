import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors, radii, spacing } from '@swasthya/configuration';
import type { LanguageCode } from '@swasthya/shared-types';
import { Pill, Screen, SathiOrb, uiStyles } from '@/components/ui';
import { useAppState } from '@/state/app-state';
const choices: { code: LanguageCode; label: string; detail: string }[] = [
  { code: 'ne', label: 'नेपाली', detail: 'देवनागरी' }, { code: 'ne-Latn', label: 'Nepali', detail: 'Romanized' }, { code: 'en', label: 'English', detail: 'English' },
];
export default function WelcomeScreen() {
  const { language, setLanguage } = useAppState();
  const [step, setStep] = useState(0);
  const start = () => { void Haptics.selectionAsync(); if (step === 0) setStep(1); else router.replace('/(tabs)'); };
  return <Screen>
    <View style={styles.top}><View style={styles.mark}><Text style={styles.glyph}>स</Text></View><Text style={styles.brand}>स्वास्थ्य साथी</Text><Text style={styles.demo}>DEMO</Text></View>
    <View style={styles.hero}><SathiOrb language={language} size={96} /><Text style={uiStyles.h1}>{step === 0 ? 'स्वास्थ्य सेवा, अब एक–एक सजिलो कदममा।' : 'कुन भाषामा सहज हुन्छ?'}</Text><Text style={uiStyles.body}>{step === 0 ? 'प्रश्न बुझ्ने, सुरक्षित अर्को कदम देखाउने र सही स्वास्थ्य सेवासँग जोड्ने तपाईंको साथी।' : 'पछि जुनसुकै बेला भाषा परिवर्तन गर्न सक्नुहुन्छ।'}</Text></View>
    {step === 0 ? <View style={styles.promise}><Text style={styles.promiseTitle}>साथीले तपाईंलाई नियन्त्रणमा राख्छ</Text><Text style={styles.promiseText}>जानकारी किन चाहिन्छ पहिले देखाउँछ · उत्तर छोड्न मिल्छ · अनुमति बिना साझा हुँदैन</Text></View> : <View style={styles.languages}>{choices.map((choice) => <Pill key={choice.code} label={choice.label + ' · ' + choice.detail} selected={language === choice.code} onPress={() => setLanguage(choice.code)} />)}</View>}
    <View style={styles.footer}><Text style={styles.safety}>आपतकालीन सेवाको विकल्प होइन</Text><Pressable onPress={start} style={uiStyles.primaryButton}><Text style={uiStyles.primaryButtonText}>{step === 0 ? 'सुरु गर्नुहोस्' : 'यही भाषामा अघि बढ्नुहोस्'}</Text></Pressable></View>
  </Screen>;
}
const styles = StyleSheet.create({
  top: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm }, mark: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 10, height: 34, justifyContent: 'center', width: 34 }, glyph: { color: 'white', fontSize: 19, fontWeight: '900' }, brand: { color: colors.ink, flex: 1, fontSize: 18, fontWeight: '900' }, demo: { color: colors.muted, fontSize: 10, fontWeight: '900' },
  hero: { alignItems: 'flex-start', gap: spacing.lg, marginTop: 24 }, promise: { backgroundColor: colors.mint, borderRadius: radii.lg, gap: spacing.sm, padding: spacing.lg }, promiseTitle: { color: colors.primaryDark, fontSize: 16, fontWeight: '900' }, promiseText: { color: colors.primaryDark, fontSize: 14, lineHeight: 22 }, languages: { gap: spacing.md },
  footer: { gap: spacing.md, marginTop: 'auto' }, safety: { color: colors.muted, fontSize: 12, textAlign: 'center' },
});
