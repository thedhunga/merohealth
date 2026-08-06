import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Captions, ChevronDown, Clock3, Play, WifiOff } from 'lucide-react-native';
import { trainingLessons } from '@swasthya/training-content';
import { colors, radii, spacing } from '@swasthya/configuration';
import { Screen, SectionTitle } from '@/components/ui';
import { useAppState } from '@/state/app-state';
export default function LearnScreen() {
  const { lowBandwidth, setLowBandwidth, language } = useAppState();
  const [expanded, setExpanded] = useState<string | null>('meet-sathi');
  return <Screen>
    <SectionTitle eyebrow="SHORT, HUMAN-REVIEWED LESSONS" title="एप कसरी चलाउने" body="एक मिनेटजति छोटा पाठ। भिडियो नचले पनि हरेक कुरा पढ्न सकिन्छ।" />
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: lowBandwidth }} onPress={() => setLowBandwidth(!lowBandwidth)} style={styles.bandwidth}><WifiOff color={colors.primary} /><View style={{ flex: 1 }}><Text style={styles.bandwidthTitle}>कम डाटा मोड</Text><Text style={styles.meta}>भिडियो स्वतः नचलाउने र पहिले पाठ देखाउने</Text></View><View style={[styles.switch, lowBandwidth && styles.switchOn]}><View style={[styles.knob, lowBandwidth && styles.knobOn]} /></View></Pressable>
    <View style={styles.notice}><Captions color={colors.info} /><Text style={styles.noticeText}>भिडियो निर्माण र चिकित्सा समीक्षा बाँकी छ। समीक्षा नभएको सामग्री प्ले हुँदैन; स्क्रिप्ट र प्लेयर संरचना तयार छ।</Text></View>
    <View style={styles.lessons}>{trainingLessons.map((lesson, index) => {
      const open = expanded === lesson.id;
      return <View key={lesson.id} style={styles.lesson}><Pressable onPress={() => setExpanded(open ? null : lesson.id)} style={styles.lessonTop}><View style={styles.poster}><Text style={styles.number}>{index + 1}</Text><View style={styles.play}><Play color="white" fill="white" size={15} /></View></View><View style={{ flex: 1 }}><Text style={styles.title}>{language === 'en' ? lesson.titleEn : lesson.titleNe}</Text><View style={styles.row}><Clock3 color={colors.muted} size={13} /><Text style={styles.meta}>{lesson.durationSeconds} सेकेन्ड · {lesson.reviewStatus.replaceAll('_', ' ')}</Text></View></View><ChevronDown color={colors.muted} /></Pressable>{open ? <View style={styles.transcript}><Text style={styles.transcriptLabel}>पढेर सिक्नुहोस्</Text><Text style={styles.transcriptText}>{language === 'en' ? lesson.transcriptEn : lesson.transcriptNe}</Text></View> : null}</View>;
    })}</View>
  </Screen>;
}
const styles = StyleSheet.create({
  bandwidth: { alignItems: 'center', backgroundColor: colors.mint, borderRadius: radii.md, flexDirection: 'row', gap: spacing.md, minHeight: 74, padding: spacing.lg }, bandwidthTitle: { color: colors.primaryDark, fontSize: 14, fontWeight: '900' }, meta: { color: colors.muted, fontSize: 10 }, switch: { backgroundColor: '#AAB8B5', borderRadius: 14, height: 28, padding: 3, width: 48 }, switchOn: { backgroundColor: colors.primary }, knob: { backgroundColor: 'white', borderRadius: 11, height: 22, width: 22 }, knobOn: { marginLeft: 20 },
  notice: { backgroundColor: '#EAF2FB', borderRadius: radii.md, flexDirection: 'row', gap: spacing.md, padding: spacing.md }, noticeText: { color: colors.info, flex: 1, fontSize: 11, lineHeight: 17 }, lessons: { gap: spacing.md }, lesson: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radii.lg, borderWidth: 1, overflow: 'hidden' }, lessonTop: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, padding: spacing.md }, poster: { alignItems: 'center', backgroundColor: colors.primaryDark, borderRadius: radii.md, height: 66, justifyContent: 'center', width: 88 }, number: { color: 'rgba(255,255,255,.25)', fontSize: 32, fontWeight: '900', position: 'absolute', right: 8, top: -2 }, play: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 18, height: 36, justifyContent: 'center', width: 36 }, title: { color: colors.ink, fontSize: 15, fontWeight: '900' }, row: { flexDirection: 'row', gap: 5, marginTop: spacing.sm }, transcript: { backgroundColor: colors.canvas, gap: spacing.sm, padding: spacing.lg }, transcriptLabel: { color: colors.primary, fontSize: 11, fontWeight: '900' }, transcriptText: { color: colors.ink, fontSize: 13, lineHeight: 21 },
});
