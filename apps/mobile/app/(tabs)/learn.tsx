import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Speech from 'expo-speech';
import {
  Captions,
  Check,
  ChevronDown,
  Clock3,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  WifiOff,
} from 'lucide-react-native';
import { trainingLessons } from '@swasthya/training-content';
import { colors, radii, spacing } from '@swasthya/configuration';
import { Screen, SectionTitle } from '@/components/ui';
import { useAppState } from '@/state/app-state';

const walkthroughSteps = [
  {
    eyebrow: 'STEP 1 · ASK',
    title: 'आफ्नो कुरा आवाज वा शब्दमा भन्नुहोस्',
    body: 'मुख्य कुरा मात्र सुरुमा भन्नुहोस्। साथीले आवश्यक परे एक–एक छोटो प्रश्न सोध्छ।',
    accent: colors.irisBright,
  },
  {
    eyebrow: 'STEP 2 · UNDERSTAND',
    title: 'सुरक्षा संकेत पहिले हेरिन्छ',
    body: 'गम्भीर संकेत भेटिए सामान्य कुराकानी रोकिन्छ र तुरुन्त सहायता खोज्ने बाटो देखाइन्छ।',
    accent: colors.saffron,
  },
  {
    eyebrow: 'STEP 3 · CONNECT',
    title: 'उपयुक्त सेवा रोज्नुहोस्',
    body: 'डाक्टर, अस्पताल, ल्याब वा घरमै सेवा—स्रोत र ताजापन देखिने गरी खोज्नुहोस्।',
    accent: colors.mintStrong,
  },
];

export default function LearnScreen() {
  const { lowBandwidth, setLowBandwidth, language } = useAppState();
  const [expanded, setExpanded] = useState<string | null>('meet-sathi');
  const [playing, setPlaying] = useState(false);
  const [walkthroughIndex, setWalkthroughIndex] = useState(0);

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setWalkthroughIndex((current) => {
        if (current === walkthroughSteps.length - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 4200);
    return () => clearInterval(timer);
  }, [playing]);

  const currentStep = walkthroughSteps[walkthroughIndex] ?? walkthroughSteps[0]!;
  const progress = ((walkthroughIndex + 1) / walkthroughSteps.length) * 100;

  const speakCurrentStep = () => {
    void Speech.stop();
    Speech.speak(`${currentStep.title}। ${currentStep.body}`, {
      language: language === 'en' ? 'en-US' : 'ne-NP',
      rate: 0.88,
    });
  };

  const restart = () => {
    void Speech.stop();
    setWalkthroughIndex(0);
    setPlaying(true);
  };

  return (
    <Screen>
      <SectionTitle
        body="छोटो दृश्य, आवाज र पढ्न मिल्ने ट्रान्सक्रिप्ट—कम डेटा हुँदा पनि उपयोगी।"
        eyebrow="LEARN BY WATCHING, LISTENING OR READING"
        title="एप कसरी चलाउने"
      />

      <LinearGradient
        colors={[colors.primary, colors.primaryDark]}
        end={{ x: 1, y: 1 }}
        style={styles.player}
      >
        <View style={styles.playerGlow} />
        <View style={styles.playerHeader}>
          <View style={styles.playerBadge}>
            <View style={[styles.playerDot, { backgroundColor: currentStep.accent }]} />
            <Text style={styles.playerBadgeText}>INTERACTIVE WALKTHROUGH</Text>
          </View>
          <Text style={styles.playerCounter}>
            {walkthroughIndex + 1} / {walkthroughSteps.length}
          </Text>
        </View>

        <View style={styles.playerStage}>
          <View style={[styles.stageIcon, { borderColor: currentStep.accent }]}>
            <Text style={styles.stageGlyph}>{walkthroughIndex + 1}</Text>
          </View>
          <Text style={[styles.stepEyebrow, { color: currentStep.accent }]}>
            {currentStep.eyebrow}
          </Text>
          <Text style={styles.stepTitle}>{currentStep.title}</Text>
          <Text style={styles.stepBody}>{currentStep.body}</Text>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>

        <View style={styles.playerControls}>
          <Pressable
            accessibilityLabel={playing ? 'Pause walkthrough' : 'Play walkthrough'}
            onPress={() => setPlaying((current) => !current)}
            style={styles.playButton}
          >
            {playing ? (
              <Pause color={colors.primaryDark} fill={colors.primaryDark} size={17} />
            ) : (
              <Play color={colors.primaryDark} fill={colors.primaryDark} size={17} />
            )}
            <Text style={styles.playButtonText}>{playing ? 'Pause' : 'Play guide'}</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Listen to this step"
            onPress={speakCurrentStep}
            style={styles.roundControl}
          >
            <Volume2 color="white" size={19} />
          </Pressable>
          <Pressable
            accessibilityLabel="Restart walkthrough"
            onPress={restart}
            style={styles.roundControl}
          >
            <RotateCcw color="white" size={18} />
          </Pressable>
        </View>
      </LinearGradient>

      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: lowBandwidth }}
        onPress={() => setLowBandwidth(!lowBandwidth)}
        style={styles.bandwidth}
      >
        <WifiOff color={colors.primary} />
        <View style={styles.bandwidthCopy}>
          <Text style={styles.bandwidthTitle}>कम डेटा मोड</Text>
          <Text style={styles.meta}>भिडियोको सट्टा ट्रान्सक्रिप्ट र आवाज रोज्नुहोस्</Text>
        </View>
        <View style={[styles.switch, lowBandwidth && styles.switchOn]}>
          <View style={[styles.knob, lowBandwidth && styles.knobOn]} />
        </View>
      </Pressable>

      <View style={styles.notice}>
        <Captions color={colors.info} />
        <View style={styles.noticeCopy}>
          <Text style={styles.noticeTitle}>Accessible by design</Text>
          <Text style={styles.noticeText}>
            यो walkthrough काम गर्छ। उत्पादन MP4 प्रशिक्षण भिडियो, मानवीय narration र चिकित्सा
            समीक्षा अझै प्रकाशन gate भित्र छन्।
          </Text>
        </View>
      </View>

      <View style={styles.lessonHead}>
        <Text style={styles.lessonHeading}>पढेर सिक्ने पाठ</Text>
        <Text style={styles.lessonHint}>Reviewed scripts</Text>
      </View>

      <View style={styles.lessons}>
        {trainingLessons.map((lesson, index) => {
          const open = expanded === lesson.id;
          return (
            <View key={lesson.id} style={styles.lesson}>
              <Pressable
                accessibilityState={{ expanded: open }}
                onPress={() => setExpanded(open ? null : lesson.id)}
                style={styles.lessonTop}
              >
                <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.poster}>
                  <Text style={styles.number}>{index + 1}</Text>
                  <View style={styles.lessonPlay}>
                    {open ? (
                      <Check color="white" size={16} />
                    ) : (
                      <Play color="white" fill="white" size={14} />
                    )}
                  </View>
                </LinearGradient>
                <View style={styles.lessonCopy}>
                  <Text style={styles.title}>
                    {language === 'en' ? lesson.titleEn : lesson.titleNe}
                  </Text>
                  <View style={styles.row}>
                    <Clock3 color={colors.muted} size={13} />
                    <Text style={styles.meta}>
                      {lesson.durationSeconds} सेकेन्ड · {lesson.reviewStatus.replaceAll('_', ' ')}
                    </Text>
                  </View>
                </View>
                <ChevronDown color={colors.muted} />
              </Pressable>
              {open ? (
                <View style={styles.transcript}>
                  <View style={styles.transcriptHead}>
                    <Text style={styles.transcriptLabel}>READABLE TRANSCRIPT</Text>
                    <Pressable
                      accessibilityLabel="Listen to this lesson"
                      onPress={() =>
                        Speech.speak(
                          language === 'en' ? lesson.transcriptEn : lesson.transcriptNe,
                          {
                            language: language === 'en' ? 'en-US' : 'ne-NP',
                            rate: 0.88,
                          },
                        )
                      }
                      style={styles.transcriptListen}
                    >
                      <Volume2 color={colors.primary} size={17} />
                      <Text style={styles.transcriptListenText}>सुन्नुहोस्</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.transcriptText}>
                    {language === 'en' ? lesson.transcriptEn : lesson.transcriptNe}
                  </Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  player: {
    borderRadius: 28,
    minHeight: 440,
    overflow: 'hidden',
    padding: spacing.xl,
    position: 'relative',
  },
  playerGlow: {
    backgroundColor: 'rgba(169,223,201,.11)',
    borderRadius: 190,
    height: 380,
    position: 'absolute',
    right: -150,
    top: -150,
    width: 380,
  },
  playerHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  playerBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(4,34,37,.46)',
    borderRadius: radii.pill,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  playerDot: { borderRadius: 4, height: 7, width: 7 },
  playerBadgeText: { color: colors.mint, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  playerCounter: { color: colors.mintStrong, fontSize: 10, fontWeight: '900' },
  playerStage: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  stageIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,.08)',
    borderRadius: 34,
    borderWidth: 1,
    height: 76,
    justifyContent: 'center',
    width: 76,
  },
  stageGlyph: { color: 'white', fontSize: 31, fontWeight: '900' },
  stepEyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1, marginTop: 20 },
  stepTitle: { color: 'white', fontSize: 24, fontWeight: '900', marginTop: 9, textAlign: 'center' },
  stepBody: {
    color: colors.mint,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 10,
    maxWidth: 560,
    textAlign: 'center',
  },
  progressTrack: {
    backgroundColor: 'rgba(255,255,255,.13)',
    borderRadius: 4,
    height: 6,
    overflow: 'hidden',
  },
  progressFill: { backgroundColor: colors.irisBright, height: 6 },
  playerControls: { alignItems: 'center', flexDirection: 'row', gap: 9, marginTop: spacing.lg },
  playButton: {
    alignItems: 'center',
    backgroundColor: colors.mint,
    borderRadius: 15,
    flexDirection: 'row',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
  },
  playButtonText: { color: colors.primaryDark, fontSize: 12, fontWeight: '900' },
  roundControl: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,.11)',
    borderColor: 'rgba(255,255,255,.14)',
    borderRadius: 16,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  bandwidth: {
    alignItems: 'center',
    backgroundColor: colors.mint,
    borderRadius: radii.lg,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 78,
    padding: spacing.lg,
  },
  bandwidthCopy: { flex: 1 },
  bandwidthTitle: { color: colors.primaryDark, fontSize: 14, fontWeight: '900' },
  meta: { color: colors.muted, fontSize: 10 },
  switch: { backgroundColor: '#AAB8B5', borderRadius: 14, height: 28, padding: 3, width: 48 },
  switchOn: { backgroundColor: colors.primary },
  knob: { backgroundColor: 'white', borderRadius: 11, height: 22, width: 22 },
  knobOn: { marginLeft: 20 },
  notice: {
    backgroundColor: colors.mintFaint,
    borderRadius: radii.lg,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
  },
  noticeCopy: { flex: 1 },
  noticeTitle: { color: colors.info, fontSize: 12, fontWeight: '900' },
  noticeText: { color: colors.info, fontSize: 11, lineHeight: 17, marginTop: 4 },
  lessonHead: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  lessonHeading: { color: colors.ink, fontSize: 20, fontWeight: '900' },
  lessonHint: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  lessons: { gap: spacing.md },
  lesson: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  lessonTop: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, padding: spacing.md },
  poster: {
    alignItems: 'center',
    borderRadius: radii.md,
    height: 72,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 96,
  },
  number: {
    color: 'rgba(255,255,255,.18)',
    fontSize: 39,
    fontWeight: '900',
    position: 'absolute',
    right: 8,
    top: -4,
  },
  lessonPlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,.18)',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  lessonCopy: { flex: 1 },
  title: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  row: { flexDirection: 'row', gap: 5, marginTop: spacing.sm },
  transcript: { backgroundColor: colors.canvas, gap: spacing.sm, padding: spacing.lg },
  transcriptHead: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  transcriptLabel: { color: colors.primary, fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  transcriptListen: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  transcriptListenText: { color: colors.primary, fontSize: 10, fontWeight: '900' },
  transcriptText: { color: colors.ink, fontSize: 13, lineHeight: 21 },
});
