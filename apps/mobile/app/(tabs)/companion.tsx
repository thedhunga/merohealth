import { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  ExternalLink,
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
import { ProfileSwitcher } from '@/components/ProfileSwitcher';
import { useAppState } from '@/state/app-state';
import { classifyCompanionCapture, type CompanionCapture } from '@/lib/companion-capture';

const DEFAULT_ANSWER_TEXT =
  'Symptoms can have many causes. Consider duration, severity, and other signs with a qualified health professional.';

interface ResearchResult {
  provider: 'perplexity-sonar';
  status: 'complete' | 'setup-required' | 'unavailable';
  answer: string | null;
  citations: Array<{ title: string; url: string; snippet?: string; date?: string }>;
  relatedQuestions: string[];
  disclaimer: string;
  externalHealthHubUrl: string;
}

export default function CompanionScreen() {
  const params = useLocalSearchParams<{ demo?: string }>();
  const {
    language,
    captureUtterance,
    hasConsent,
    grantConsentAndCapture,
    actingSubjects,
    activeSubject,
    switchActingSubject,
  } = useAppState();
  const [message, setMessage] = useState(
    params.demo === 'emergency' ? 'मलाई सास फेर्न गाह्रो छ' : '',
  );
  const [submitted, setSubmitted] = useState(false);
  const [research, setResearch] = useState<ResearchResult | null>(null);
  const [isResearching, setIsResearching] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);
  // Set when "this didn't help" is tapped on an answer, so the *next*
  // submission is classified as a CORRECTION rather than a fresh question —
  // see `classifyCompanionCapture`.
  const [isRephrasing, setIsRephrasing] = useState(false);
  const [lastAssistantText, setLastAssistantText] = useState<string | null>(null);
  // language-corpus.md §2's "ask there rather than at signup": held here
  // until the person answers the inline ask, rather than captured (or
  // dropped) immediately.
  const [pendingCorrection, setPendingCorrection] = useState<CompanionCapture | null>(null);
  const [correctionAskDismissed, setCorrectionAskDismissed] = useState(false);
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

  const submitQuestion = async () => {
    setSubmitted(true);
    setResearch(null);
    // language-corpus.md §2: natural phrasing of a symptom is the valuable
    // signal, independent of what the safety check does with it — so this
    // runs for every submission. A rephrase after "this didn't help" is
    // classified as a CORRECTION instead — the highest-value, cheapest row.
    const capture = classifyCompanionCapture({
      message,
      isRephrase: isRephrasing,
      precedingAssistantText: lastAssistantText,
    });
    setIsRephrasing(false);
    if (capture.kind === 'CORRECTION' && !hasConsent('MODEL_TRAINING_TEXT') && !correctionAskDismissed) {
      // Ask right here, at the moment the correction happened, instead of
      // silently dropping it the way an unconsented USER_MESSAGE is dropped —
      // that is the entire point of this task per language-corpus.md §2.
      setPendingCorrection(capture);
    } else {
      // Already consented, or already declined the ask this session: either
      // way `captureUtterance` is the right call — it is a no-op without a
      // live grant, so a repeat decline stays silent rather than nagging.
      captureUtterance(capture);
    }
    const safety = assessSafety(message);
    if (safety.interruptConversation) return;
    setIsResearching(true);
    try {
      const configuredApiUrl = process.env['EXPO_PUBLIC_API_URL']?.replace(/\/$/, '');
      const researchEndpoint = configuredApiUrl
        ? `${configuredApiUrl}/v1/companion/research`
        : '/api/companion/research';
      const response = await fetch(researchEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, language }),
      });
      if (!response.ok) throw new Error('Research request failed');
      const payload = (await response.json()) as { research: ResearchResult | null };
      setResearch(payload.research);
    } catch {
      setResearch({
        provider: 'perplexity-sonar',
        status: 'unavailable',
        answer: null,
        citations: [],
        relatedQuestions: [],
        disclaimer:
          language === 'en'
            ? 'General health information only. This is not a diagnosis or treatment recommendation.'
            : 'General health information only. This is not a diagnosis or treatment recommendation.',
        externalHealthHubUrl: 'https://www.perplexity.ai/health',
      });
    } finally {
      setIsResearching(false);
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

      <ProfileSwitcher
        active={activeSubject}
        language={language}
        onSwitch={switchActingSubject}
        subjects={actingSubjects}
      />

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
              <Text style={styles.stepLabel}>
                {isRephrasing ? 'STEP 1 · REPHRASE' : 'STEP 1 · WHAT MATTERS NOW'}
              </Text>
              <Text style={styles.question}>
                {isRephrasing ? 'फरक शब्दमा भन्नुहोस्' : 'आज के भइरहेको छ?'}
              </Text>
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
              onPress={() => void submitQuestion()}
              style={[styles.send, message.trim().length < 3 && styles.disabled]}
            >
              <Text style={styles.sendText}>सुरक्षित रूपमा जाँच्नुहोस्</Text>
              <Send color="white" size={18} />
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/consent')}
            style={styles.privacyCard}
          >
            <View style={styles.privacyDot} />
            <Text style={styles.privacy}>
              यो डेमोले उत्तर स्थायी रेकर्डमा राख्दैन। राख्नु वा साझा गर्नु अघि छुट्टै अनुमति
              मागिन्छ — यहाँ हेर्नुहोस्।
            </Text>
          </Pressable>
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
            {isResearching ? (
              <View accessibilityLiveRegion="polite" style={styles.researching}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.researchingText}>Searching trusted sources…</Text>
              </View>
            ) : (
              <>
                <Text style={styles.question}>
                  {research?.status === 'complete'
                    ? 'Evidence-backed information'
                    : 'General information'}
                </Text>
                <Text style={styles.answer}>{research?.answer ?? DEFAULT_ANSWER_TEXT}</Text>
                {research?.citations.length ? (
                  <View style={styles.citationList}>
                    <Text style={styles.citationHeading}>Sources</Text>
                    {research.citations.map((citation, index) => (
                      <Pressable
                        key={citation.url}
                        onPress={() => void Linking.openURL(citation.url)}
                        style={styles.citation}
                      >
                        <BookOpen color={colors.info} size={17} />
                        <Text numberOfLines={2} style={styles.citationText}>
                          {index + 1}. {citation.title}
                        </Text>
                        <ExternalLink color={colors.info} size={15} />
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <Pressable
                    onPress={() =>
                      void Linking.openURL(
                        research?.externalHealthHubUrl ?? 'https://www.perplexity.ai/health',
                      )
                    }
                    style={styles.perplexityButton}
                  >
                    <BookOpen color="white" size={18} />
                    <Text style={styles.perplexityButtonText}>Open Perplexity Health</Text>
                    <ExternalLink color="white" size={16} />
                  </Pressable>
                )}
                <View style={styles.warning}>
                  <AlertTriangle color={colors.saffronDeep} size={18} />
                  <Text style={styles.warningText}>
                    {research?.disclaimer ??
                      'General information only—not a diagnosis or treatment recommendation. See a qualified clinician for new or worsening symptoms.'}
                  </Text>
                </View>
              </>
            )}
          </View>
          <View style={styles.source}>
            <BookOpen color={colors.info} size={20} />
            <Text style={styles.sourceText}>
              Approved Demonstration Health Guide, v1 · उत्पादनका लागि होइन
            </Text>
          </View>

          {pendingCorrection ? (
            <View style={styles.correctionAsk}>
              <Text style={styles.correctionAskTitle}>
                {language === 'en'
                  ? 'Keep this exchange to improve Nepali answers?'
                  : 'यो कुराकानी नेपाली जवाफ सुधार्न राख्न मिल्छ?'}
              </Text>
              <Text style={styles.correctionAskBody}>
                {language === 'en'
                  ? 'The earlier answer missed the point and you rephrased. That pair helps the assistant learn Nepali phrasing. Nothing is kept without a yes, and this can be turned off anytime from the consent screen.'
                  : 'अघिल्लो जवाफले नबुझेकोले तपाईंले फरक शब्दमा सोध्नुभयो। यस्तै जोडीले सहायकलाई नेपाली भाषा बुझ्न सघाउँछ। तपाईंको हो नभनी केही राखिँदैन, र यो सहमति स्क्रिनबाट जुनसुकै बेला बन्द गर्न सकिन्छ।'}
              </Text>
              <View style={styles.correctionAskRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    grantConsentAndCapture(pendingCorrection);
                    setPendingCorrection(null);
                  }}
                  style={styles.correctionAskYes}
                >
                  <Text style={styles.correctionAskYesText}>
                    {language === 'en' ? 'Yes, keep it' : 'हो, राख्नुहोस्'}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setCorrectionAskDismissed(true);
                    setPendingCorrection(null);
                  }}
                  style={styles.correctionAskNo}
                >
                  <Text style={styles.correctionAskNoText}>
                    {language === 'en' ? 'No thanks' : 'पर्दैन'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <Pressable
            onPress={() => {
              setLastAssistantText(research?.answer ?? DEFAULT_ANSWER_TEXT);
              setIsRephrasing(true);
              setSubmitted(false);
              setMessage('');
              setVoiceStatus(null);
              setResearch(null);
            }}
            style={styles.rephraseButton}
          >
            <Text style={styles.rephraseButtonText}>
              {language === 'en'
                ? "This didn't help — ask differently"
                : 'यसले मद्दत गरेन, फरक शब्दमा सोध्नुहोस्'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              setSubmitted(false);
              setMessage('');
              setVoiceStatus(null);
              setResearch(null);
              setIsRephrasing(false);
              setLastAssistantText(null);
              setPendingCorrection(null);
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
    backgroundColor: colors.surface,
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
  emergencyKicker: { color: colors.dangerSoft, fontSize: 11, fontWeight: '900' },
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
  emergencyNote: { color: colors.dangerSoft, fontSize: 11 },
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
  warningText: { color: colors.saffronDeep, flex: 1, fontSize: 13, lineHeight: 20 },
  source: {
    backgroundColor: colors.mintFaint,
    borderRadius: radii.md,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
  },
  sourceText: { color: colors.info, flex: 1, fontSize: 12 },
  researching: {
    alignItems: 'center',
    backgroundColor: colors.mint,
    borderRadius: radii.md,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 86,
    padding: spacing.lg,
  },
  researchingText: { color: colors.primaryDark, fontSize: 13, fontWeight: '800' },
  researchLabel: { color: colors.primary, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  citationList: { gap: spacing.sm },
  citationHeading: { color: colors.ink, fontSize: 13, fontWeight: '900' },
  citation: {
    alignItems: 'center',
    backgroundColor: colors.mintFaint,
    borderRadius: 13,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 50,
    paddingHorizontal: spacing.md,
  },
  citationText: { color: colors.info, flex: 1, fontSize: 12, fontWeight: '700', lineHeight: 17 },
  perplexityButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryDark,
    borderRadius: radii.md,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 50,
    paddingHorizontal: spacing.lg,
  },
  perplexityButtonText: { color: 'white', fontSize: 13, fontWeight: '900' },
  correctionAsk: {
    backgroundColor: colors.mint,
    borderRadius: radii.lg,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  correctionAskTitle: { color: colors.primaryDark, fontSize: 14, fontWeight: '900' },
  correctionAskBody: { color: colors.primaryDark, fontSize: 12, lineHeight: 18 },
  correctionAskRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  correctionAskYes: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
  },
  correctionAskYesText: { color: 'white', fontSize: 13, fontWeight: '900' },
  correctionAskNo: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,.75)',
    borderRadius: radii.md,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
  },
  correctionAskNoText: { color: colors.primaryDark, fontSize: 13, fontWeight: '900' },
  rephraseButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 50,
  },
  rephraseButtonText: { color: colors.primaryDark, fontSize: 13, fontWeight: '900' },
});
