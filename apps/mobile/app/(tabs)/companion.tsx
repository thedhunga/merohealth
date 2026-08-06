import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AlertTriangle, ArrowLeft, BookOpen, Send, ShieldCheck } from 'lucide-react-native';
import { assessSafety, getSafetyTemplate } from '@swasthya/clinical-safety';
import { colors, radii, spacing } from '@swasthya/configuration';
import { Screen, SathiOrb, uiStyles } from '@/components/ui';
import { useAppState } from '@/state/app-state';
export default function CompanionScreen() {
  const params = useLocalSearchParams<{ demo?: string }>();
  const { language } = useAppState();
  const [message, setMessage] = useState(params.demo === 'emergency' ? 'मलाई सास फेर्न गाह्रो छ' : '');
  const [submitted, setSubmitted] = useState(false);
  const assessment = submitted ? assessSafety(message) : null;
  const template = assessment?.templateId ? getSafetyTemplate(assessment.templateId, language === 'en' ? 'en' : 'ne') : null;
  return <Screen keyboardShouldPersistTaps="handled">
    <View style={styles.header}><Pressable accessibilityLabel="Go back" onPress={() => router.back()} style={styles.back}><ArrowLeft color={colors.ink} /></Pressable><View style={{ flex: 1 }}><Text style={styles.headerTitle}>स्वास्थ्य साथी</Text><Text style={styles.meta}>सुरक्षित अर्को कदम खोजौँ</Text></View><SathiOrb size={44} /></View>
    {!submitted ? <>
      <View style={styles.guide}><ShieldCheck color={colors.primary} size={20} /><Text style={styles.guideText}>एउटा मुख्य कुरा लेख्नुहोस्। आवश्यक भए म छोटो प्रश्न सोध्छु। निदान वा औषधि लेख्दिनँ।</Text></View>
      <View style={styles.card}><Text style={styles.question}>आज के भइरहेको छ?</Text><TextInput accessibilityLabel="Health question" multiline value={message} onChangeText={setMessage} placeholder="जस्तै: दुई दिनदेखि टाउको दुखिरहेको छ…" placeholderTextColor="#82918E" style={styles.input} /><Pressable disabled={message.trim().length < 3} onPress={() => setSubmitted(true)} style={[styles.send, message.trim().length < 3 && { opacity: 0.38 }]}><Text style={styles.sendText}>सुरक्षित रूपमा जाँच्नुहोस्</Text><Send color="white" size={18} /></Pressable></View>
      <Text style={styles.privacy}>यो डेमोले उत्तर स्थायी रेकर्डमा राख्दैन। राख्नु वा साझा गर्नु अघि छुट्टै अनुमति मागिन्छ।</Text>
    </> : assessment?.interruptConversation ? <View accessibilityLiveRegion="assertive" style={styles.emergency}>
      <AlertTriangle color="white" size={32} /><Text style={styles.emergencyKicker}>सामान्य कुराकानी रोकिएको छ</Text><Text style={styles.emergencyTitle}>तुरुन्त सहायता लिनुहोस्</Text><Text style={styles.emergencyBody}>{template}</Text><Pressable style={styles.emergencyButton}><Text style={styles.emergencyButtonText}>नजिकको उपयुक्त अस्पताल खोज्नुहोस्</Text></Pressable><Text style={styles.emergencyNote}>स्थानीय सेवा नम्बर प्रमाणित नभएसम्म एपले कुनै नम्बर देखाउँदैन।</Text>
    </View> : <>
      <View style={styles.card}><View style={styles.answerHead}><SathiOrb size={42} /><View><Text style={styles.headerTitle}>साथीको जानकारी</Text><Text style={styles.meta}>निदान होइन · डेमो स्रोत</Text></View></View><Text style={styles.question}>सामान्य जानकारी</Text><Text style={styles.answer}>लक्षणका धेरै कारण हुन सक्छन्। यहाँको जानकारीले निदान गर्दैन। अवधि, गम्भीरता र अरू संकेत बुझेर सुरक्षित अर्को कदम छान्न मद्दत गर्न सक्छ।</Text><View style={styles.warning}><AlertTriangle color="#8A5A00" size={18} /><Text style={styles.warningText}>सास फेर्न गाह्रो, बेहोस वा कडा छाती दुखाइ भए तुरुन्त आपतकालीन सहायता लिनुहोस्।</Text></View></View>
      <View style={styles.source}><BookOpen color={colors.info} size={20} /><Text style={styles.sourceText}>Approved Demonstration Health Guide, v1 · उत्पादनका लागि होइन</Text></View>
      <Pressable onPress={() => { setSubmitted(false); setMessage(''); }} style={uiStyles.primaryButton}><Text style={uiStyles.primaryButtonText}>अर्को प्रश्न सोध्नुहोस्</Text></Pressable>
    </>}
  </Screen>;
}
const styles = StyleSheet.create({
  header: { alignItems: 'center', flexDirection: 'row', gap: spacing.md }, back: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: 22, height: 44, justifyContent: 'center', width: 44 }, headerTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' }, meta: { color: colors.muted, fontSize: 11, marginTop: 2 },
  guide: { alignItems: 'flex-start', backgroundColor: colors.mint, borderRadius: radii.md, flexDirection: 'row', gap: spacing.md, padding: spacing.lg }, guideText: { color: colors.primaryDark, flex: 1, fontSize: 14, lineHeight: 21 },
  card: { ...uiStyles.card, gap: spacing.lg }, question: { color: colors.ink, fontSize: 21, fontWeight: '900' }, input: { borderColor: colors.line, borderRadius: radii.md, borderWidth: 1, color: colors.ink, fontSize: 17, minHeight: 150, padding: spacing.lg, textAlignVertical: 'top' }, send: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radii.md, flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', minHeight: 52 }, sendText: { color: 'white', fontWeight: '900' }, privacy: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  emergency: { backgroundColor: colors.danger, borderRadius: radii.lg, gap: spacing.md, padding: spacing.xl }, emergencyKicker: { color: '#FFD7D3', fontSize: 11, fontWeight: '900' }, emergencyTitle: { color: 'white', fontSize: 28, fontWeight: '900' }, emergencyBody: { color: 'white', fontSize: 16, lineHeight: 25 }, emergencyButton: { alignItems: 'center', backgroundColor: 'white', borderRadius: radii.md, justifyContent: 'center', minHeight: 52 }, emergencyButtonText: { color: colors.danger, fontWeight: '900' }, emergencyNote: { color: '#FFD7D3', fontSize: 11 },
  answerHead: { alignItems: 'center', flexDirection: 'row', gap: spacing.md }, answer: { color: colors.ink, fontSize: 15, lineHeight: 24 }, warning: { backgroundColor: colors.saffronSoft, borderRadius: radii.md, flexDirection: 'row', gap: spacing.sm, padding: spacing.md }, warningText: { color: '#6F4800', flex: 1, fontSize: 13, lineHeight: 20 }, source: { backgroundColor: '#EAF2FB', borderRadius: radii.md, flexDirection: 'row', gap: spacing.md, padding: spacing.lg }, sourceText: { color: colors.info, flex: 1, fontSize: 12 },
});
