import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Mic,
  MicOff,
  Send,
  ShieldCheck,
  Volume2,
} from 'lucide-react-native';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as Speech from 'expo-speech';
import { assessSafety, getSafetyTemplate } from '@swasthya/clinical-safety';
import { colors, radii, spacing } from '@swasthya/configuration';
import { Screen, SathiOrb, uiStyles } from '@/components/ui';
import { useAppState } from '@/state/app-state';

export default function CompanionScreen() {
  const params = useLocalSearchParams<{ demo?: string }>();
  const { language } = useAppState();
  const [message, setMessage] = useState(
    params.demo === 'emergency' ? 'मलाई सास फेर्न गाह्रो छ' : '',
  );
  const [submitted, setSubmitted] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 200);
  const assessment = submitted ? assessSafety(message) : null;
  const template = assessment?.templateId
    ? getSafetyTemplate(assessment.templateId, language === 'en' ? 'en' : 'ne')
    : null;

  const toggleVoice = async () => {
    try {
      if (recorderState.isRecording) {
        await recorder.stop();
        setVoiceStatus(
          language === 'en'
            ? 'Voice note captured privately on this device. Add a short text summary to continue.'
            : 'आवाज यस उपकरणमा सुरक्षित भयो। अघि बढ्न छोटो लिखित सार थप्नुहोस्।',
        );
        return;
      }

      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setVoiceStatus(
          language === 'en'
            ? 'Microphone permission is required.'
            : 'आवाज रेकर्ड गर्न माइक्रोफोन अनुमति चाहिन्छ।',
        );
        return;
      }

      await recorder.prepareToRecordAsync();
      recorder.record();
      setVoiceStatus(
        language === 'en' ? 'Listening… tap again to stop.' : 'सुन्दैछु… रोक्न फेरि थिच्नुहोस्।',
      );
    } catch {
      setVoiceStatus(
        language === 'en'
          ? 'Voice recording is unavailable on this device.'
          : 'यस उपकरणमा आवाज रेकर्ड उपलब्ध छैन।',
      );
    }
  };

  const speakGuidance = () => {
    void Speech.stop();
    Speech.speak(
      language === 'en'
        ? 'Tell me the main thing happening today. I will help you find a safe next step.'
        : 'आज भइरहेको मुख्य कुरा भन्नुहोस्। म सुरक्षित अर्को कदम खोज्न मद्दत गर्छु।',
      { language: language === 'en' ? 'en-US' : 'ne-NP', rate: 0.9 },
    );
  };

  const speakAnswer = () => {
    void Speech.stop();
    Speech.speak(
      language === 'en'
        ? 'Symptoms can have many causes. This information does not make a diagnosis. Seek urgent help for trouble breathing, fainting, or severe chest pain.'
        : 'लक्षणका धेरै कारण हुन सक्छन्। यहाँको जानकारीले निदान गर्दैन। सास फेर्न गाह्रो, बेहोस वा कडा छाती दुखाइ भए तुरुन्त सहायता लिनुहोस्।',
      { language: language === 'en' ? 'en-US' : 'ne-NP', rate: 0.88 },
    );
  };

  return (
    <Screen keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Pressable accessibilityLabel="Go back" onPress={() => router.back()} style={styles.back}>
          <ArrowLeft color={colors.ink} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.headerKicker}>VOICE · TEXT · SAFETY ROUTING</Text>
          <Text style={styles.headerTitle}>स्वास्थ्य साथी</Text>
          <Text style={styles.meta}>सुरक्षित अर्को कदम खोजौँ</Text>
        </View>
        <SathiOrb size={52} />
      </View>

      {!submitted ? (
        <>
          <View style={styles.guide}>
            <ShieldCheck color={colors.primary} size={21} />
            <View style={styles.guideCopy}>
              <Text style={styles.guideTitle}>तपाईंको कुरा, तपाईंको नियन्त्रणमा</Text>
              <Text style={styles.guideText}>
                मुख्य कुरा लेख्नुहोस् वा निजी आवाज नोट रेकर्ड गर्नुहोस्। डेमोले आवाज अपलोड वा
                ट्रान्सक्राइब गर्दैन।
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Listen to guidance"
              onPress={speakGuidance}
              style={styles.listen}
            >
              <Volume2 color={colors.primaryDark} size={19} />
            </Pressable>
          </View>

          <View style={styles.card}>
            <View>
              <Text style={styles.stepLabel}>STEP 1 · WHAT MATTERS NOW</Text>
              <Text style={styles.question}>आज के भइरहेको छ?</Text>
            </View>

            <TextInput
              accessibilityLabel="Health question"
              multiline
              value={message}
              onChangeText={setMessage}
              placeholder="जस्तै: दुई दिनदेखि टाउको दुखिरहेको छ…"
              placeholderTextColor="#82918E"
              style={styles.input}
            />

            <View style={styles.voiceRow}>
              <Pressable
                accessibilityLabel={
                  recorderState.isRecording ? 'Stop recording' : 'Record voice note'
                }
                onPress={() => {
                  void toggleVoice();
                }}
                style={[styles.voiceButton, recorderState.isRecording && styles.voiceButtonActive]}
              >
                {recorderState.isRecording ? (
                  <MicOff color="white" size={20} />
                ) : (
                  <Mic color="white" size={20} />
                )}
                <Text style={styles.voiceButtonText}>
                  {recorderState.isRecording ? 'रेकर्ड रोक्नुहोस्' : 'आवाजमा भन्नुहोस्'}
                </Text>
              </Pressable>

              <View style={styles.miniWave}>
                {[10, 17, 25, 14, 22, 30, 16].map((height, index) => (
                  <View
                    key={index}
                    style={[
                      styles.miniWaveBar,
                      {
                        height: recorderState.isRecording ? height : 7,
                        opacity: recorderState.isRecording ? 1 : 0.28,
                      },
                    ]}
                  />
                ))}
              </View>
            </View>

            {voiceStatus ? <Text style={styles.voiceStatus}>{voiceStatus}</Text> : null}

            <Pressable
              disabled={message.trim().length < 3}
              onPress={() => setSubmitted(true)}
              style={[styles.send, message.trim().length < 3 && styles.disabled]}
            >
              <Text style={styles.sendText}>सुरक्षित रूपमा जाँच्नुहोस्</Text>
              <Send color="white" size={18} />
            </Pressable>
          </View>

          <View style={styles.privacyCard}>
            <View style={styles.privacyDot} />
            <Text style={styles.privacy}>
              यो डेमोले उत्तर स्थायी रेकर्डमा राख्दैन। राख्नु वा साझा गर्नु अघि छुट्टै अनुमति
              मागिन्छ।
            </Text>
          </View>
        </>
      ) : assessment?.interruptConversation ? (
        <View accessibilityLiveRegion="assertive" style={styles.emergency}>
          <AlertTriangle color="white" size={34} />
          <Text style={styles.emergencyKicker}>सामान्य कुराकानी रोकिएको छ</Text>
          <Text style={styles.emergencyTitle}>तुरुन्त सहायता लिनुहोस्</Text>
          <Text style={styles.emergencyBody}>{template}</Text>
          <Pressable style={styles.emergencyButton}>
            <Text style={styles.emergencyButtonText}>नजिकको उपयुक्त अस्पताल खोज्नुहोस्</Text>
          </Pressable>
          <Text style={styles.emergencyNote}>
            स्थानीय सेवा नम्बर प्रमाणित नभएसम्म एपले कुनै नम्बर देखाउँदैन।
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.card}>
            <View style={styles.answerHead}>
              <SathiOrb size={48} />
              <View style={styles.answerHeadCopy}>
                <Text style={styles.stepLabel}>GUIDED INFORMATION · NOT A DIAGNOSIS</Text>
                <Text style={styles.headerTitle}>साथीको जानकारी</Text>
              </View>
              <Pressable
                accessibilityLabel="Listen to this information"
                onPress={speakAnswer}
                style={styles.listen}
              >
                <Volume2 color={colors.primaryDark} size={19} />
              </Pressable>
            </View>
            <Text style={styles.question}>सामान्य जानकारी</Text>
            <Text style={styles.answer}>
              लक्षणका धेरै कारण हुन सक्छन्। यहाँको जानकारीले निदान गर्दैन। अवधि, गम्भीरता र अरू
              संकेत बुझेर सुरक्षित अर्को कदम छान्न मद्दत गर्न सक्छ।
            </Text>
            <View style={styles.warning}>
              <AlertTriangle color="#8A5A00" size={18} />
              <Text style={styles.warningText}>
                सास फेर्न गाह्रो, बेहोस वा कडा छाती दुखाइ भए तुरुन्त आपतकालीन सहायता लिनुहोस्।
              </Text>
            </View>
          </View>
          <View style={styles.source}>
            <BookOpen color={colors.info} size={20} />
            <Text style={styles.sourceText}>
              Approved Demonstration Health Guide, v1 · उत्पादनका लागि होइन
            </Text>
          </View>
          <Pressable
            onPress={() => {
              setSubmitted(false);
              setMessage('');
              setVoiceStatus(null);
            }}
            style={uiStyles.primaryButton}
          >
            <Text style={uiStyles.primaryButtonText}>अर्को प्रश्न सोध्नुहोस्</Text>
          </Pressable>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  back: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  headerCopy: { flex: 1 },
  headerKicker: { color: colors.primary, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  headerTitle: { color: colors.ink, fontSize: 19, fontWeight: '900', marginTop: 2 },
  meta: { color: colors.muted, fontSize: 11, marginTop: 2 },
  guide: {
    alignItems: 'center',
    backgroundColor: colors.mint,
    borderRadius: radii.lg,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
  },
  guideCopy: { flex: 1 },
  guideTitle: { color: colors.primaryDark, fontSize: 14, fontWeight: '900' },
  guideText: { color: colors.primaryDark, fontSize: 12, lineHeight: 19, marginTop: 4 },
  listen: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,.75)',
    borderRadius: 17,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  card: { ...uiStyles.card, gap: spacing.lg },
  stepLabel: { color: colors.primary, fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  question: { color: colors.ink, fontSize: 24, fontWeight: '900', marginTop: 5 },
  input: {
    backgroundColor: '#FAFCF9',
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 17,
    minHeight: 150,
    padding: spacing.lg,
    textAlignVertical: 'top',
  },
  voiceRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  voiceButton: {
    alignItems: 'center',
    backgroundColor: colors.primaryDark,
    borderRadius: radii.pill,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
  },
  voiceButtonActive: { backgroundColor: colors.danger },
  voiceButtonText: { color: 'white', fontSize: 12, fontWeight: '900' },
  miniWave: { alignItems: 'center', flexDirection: 'row', gap: 3, height: 32 },
  miniWaveBar: { backgroundColor: colors.primary, borderRadius: 3, width: 3 },
  voiceStatus: { color: colors.primaryDark, fontSize: 11, lineHeight: 17 },
  send: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 54,
  },
  sendText: { color: 'white', fontWeight: '900' },
  disabled: { opacity: 0.38 },
  privacyCard: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm },
  privacyDot: {
    backgroundColor: colors.primary,
    borderRadius: 4,
    height: 7,
    marginTop: 5,
    width: 7,
  },
  privacy: { color: colors.muted, flex: 1, fontSize: 11, lineHeight: 17 },
  emergency: {
    backgroundColor: colors.danger,
    borderRadius: radii.lg,
    gap: spacing.md,
    padding: spacing.xl,
  },
  emergencyKicker: { color: '#FFD7D3', fontSize: 11, fontWeight: '900' },
  emergencyTitle: { color: 'white', fontSize: 30, fontWeight: '900' },
  emergencyBody: { color: 'white', fontSize: 16, lineHeight: 25 },
  emergencyButton: {
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: radii.md,
    justifyContent: 'center',
    minHeight: 52,
  },
  emergencyButtonText: { color: colors.danger, fontWeight: '900' },
  emergencyNote: { color: '#FFD7D3', fontSize: 11 },
  answerHead: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  answerHeadCopy: { flex: 1 },
  answer: { color: colors.ink, fontSize: 15, lineHeight: 24 },
  warning: {
    backgroundColor: colors.saffronSoft,
    borderRadius: radii.md,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  warningText: { color: '#6F4800', flex: 1, fontSize: 13, lineHeight: 20 },
  source: {
    backgroundColor: '#EAF2FB',
    borderRadius: radii.md,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
  },
  sourceText: { color: colors.info, flex: 1, fontSize: 12 },
});
