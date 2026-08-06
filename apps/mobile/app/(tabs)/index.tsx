import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Beaker, CircleHelp, FileHeart, MessageCircle, Package, PhoneCall, Stethoscope } from 'lucide-react-native';
import { colors, radii, spacing } from '@swasthya/configuration';
import { t } from '@swasthya/localization';
import { ActionCard, Screen, SathiOrb } from '@/components/ui';
import { useAppState } from '@/state/app-state';
export default function HomeScreen() {
  const { language } = useAppState();
  return <Screen>
    <View style={styles.header}><View><Text style={styles.kicker}>शुभ दिन · Good day</Text><Text style={styles.brand}>स्वास्थ्य साथी</Text></View><View style={styles.avatar}><Text style={styles.avatarText}>A</Text></View></View>
    <View style={styles.hero}><View style={styles.copy}><Text style={styles.label}>GUIDED HEALTH COMPANION</Text><Text style={styles.title}>{t(language, 'homePrompt')}</Text><Text style={styles.body}>म तपाईंको कुरा एक–एक कदममा बुझ्छु। आपतकालीन संकेत भए तुरुन्त सहायता देखाउँछु।</Text><Pressable onPress={() => router.push('/(tabs)/companion')} style={styles.ask}><MessageCircle color="white" size={18} /><Text style={styles.askText}>{t(language, 'ask')}</Text></Pressable></View><SathiOrb size={70} /></View>
    <Text style={styles.section}>छिटो सेवा</Text>
    <View style={styles.actions}>
      <ActionCard icon={Stethoscope} title={t(language, 'doctor')} subtitle="समय लिनुहोस् वा उपलब्धता हेर्नुहोस्" onPress={() => router.push('/(tabs)/care')} />
      <ActionCard icon={Package} title={t(language, 'medicines')} subtitle="वैध प्रेस्क्रिप्सनबाट मात्र" tone="warm" />
      <ActionCard icon={FileHeart} title={t(language, 'record')} subtitle="तपाईंको नियन्त्रणमा रहेको स्वास्थ्य चित्र" onPress={() => router.push('/(tabs)/twin')} />
      <ActionCard icon={Beaker} title={t(language, 'lab')} subtitle="जाँच र घरमै नमुना सङ्कलन" />
      <ActionCard icon={PhoneCall} title={t(language, 'emergency')} subtitle="गम्भीर संकेतका लागि तुरुन्त कदम" tone="danger" onPress={() => router.push({ pathname: '/(tabs)/companion', params: { demo: 'emergency' } })} />
    </View>
    <View style={styles.trust}><CircleHelp color={colors.primary} size={20} /><View style={{ flex: 1 }}><Text style={styles.trustTitle}>साथी डाक्टर होइन</Text><Text style={styles.trustBody}>यसले जानकारी र सेवा खोज्न मद्दत गर्छ। निदान र उपचार स्वास्थ्यकर्मीले गर्छन्।</Text></View></View>
  </Screen>;
}
const styles = StyleSheet.create({
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, kicker: { color: colors.muted, fontSize: 12, fontWeight: '700' }, brand: { color: colors.ink, fontSize: 21, fontWeight: '900' }, avatar: { alignItems: 'center', backgroundColor: colors.saffronSoft, borderRadius: 22, height: 44, justifyContent: 'center', width: 44 }, avatarText: { color: '#7A4C00', fontWeight: '900' },
  hero: { alignItems: 'center', backgroundColor: colors.primaryDark, borderRadius: radii.lg, flexDirection: 'row', gap: spacing.md, padding: spacing.lg }, copy: { flex: 1, gap: spacing.sm }, label: { color: colors.mintStrong, fontSize: 10, fontWeight: '900' }, title: { color: 'white', fontSize: 22, fontWeight: '900', lineHeight: 29 }, body: { color: '#DCECE7', fontSize: 13, lineHeight: 19 }, ask: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.primary, borderRadius: radii.pill, flexDirection: 'row', gap: spacing.sm, minHeight: 46, paddingHorizontal: spacing.lg }, askText: { color: 'white', fontWeight: '900' },
  section: { color: colors.ink, fontSize: 22, fontWeight: '900' }, actions: { gap: spacing.md }, trust: { alignItems: 'flex-start', backgroundColor: colors.mint, borderRadius: radii.md, flexDirection: 'row', gap: spacing.md, padding: spacing.lg }, trustTitle: { color: colors.primaryDark, fontWeight: '900' }, trustBody: { color: colors.primaryDark, fontSize: 13, lineHeight: 19, marginTop: 4 },
});
