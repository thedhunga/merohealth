import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

import {
  ArrowRight,
  BadgeCheck,
  BrainCircuit,
  Building2,
  Camera,
  Check,
  FileHeart,
  Globe2,
  HeartPulse,
  LockKeyhole,
  Mic,
  MicOff,
  Play,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Video,
  Volume2,
} from 'lucide-react-native';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as Speech from 'expo-speech';
import { colors } from '@swasthya/configuration';
import { SathiOrb } from '@/components/ui';

const journey = [
  {
    number: '01',
    icon: Mic,
    title: 'Speak naturally',
    body: 'Ask in Nepali, Romanized Nepali, English, or a mix—by voice or text.',
    color: '#DDF5EC',
    accent: colors.primary,
  },
  {
    number: '02',
    icon: BrainCircuit,
    title: 'Build your health picture',
    body: 'Sathi gathers only what matters, one clear and consented step at a time.',
    color: '#E8EEFF',
    accent: '#3659A8',
  },
  {
    number: '03',
    icon: Stethoscope,
    title: 'Move to the right care',
    body: 'Find the appropriate service, prepare for a visit, and share only what you choose.',
    color: '#FFF0D6',
    accent: '#A46008',
  },
];

const services = [
  {
    icon: Stethoscope,
    label: 'Doctors & specialists',
    detail: 'Search, compare and prepare',
    tone: '#DDF5EC',
  },
  {
    icon: Building2,
    label: 'Care near you',
    detail: 'Hospitals, clinics and home care',
    tone: '#E8EEFF',
  },
  {
    icon: FileHeart,
    label: 'Your health story',
    detail: 'A record you can understand',
    tone: '#F4E8FF',
  },
  { icon: Video, label: 'Video consultation', detail: 'Private room preview', tone: '#FFF0D6' },
];

export default function WebWelcomeScreen() {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const compact = width < 620;
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 200);
  const [voiceMessage, setVoiceMessage] = useState('Tap to try a private voice note');
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const toggleRecording = async () => {
    setVoiceError(null);
    try {
      if (recorderState.isRecording) {
        await recorder.stop();
        setVoiceMessage('Voice captured on this device · not uploaded');
        return;
      }

      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setVoiceError('Microphone permission is needed to record a voice note.');
        return;
      }

      await recorder.prepareToRecordAsync();
      recorder.record();
      setVoiceMessage('Listening… tap again when you are done');
    } catch {
      setVoiceError('Voice recording is unavailable in this browser.');
    }
  };

  const speakIntroduction = () => {
    void Speech.stop();
    Speech.speak(
      'नमस्ते। म स्वास्थ्य साथी हुँ। तपाईंको कुरा बुझेर सुरक्षित अर्को कदम खोज्न मद्दत गर्छु।',
      { language: 'ne-NP', rate: 0.88, pitch: 1 },
    );
  };

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
      style={styles.scroll}
    >
      <View style={styles.auroraOne} />
      <View style={styles.auroraTwo} />

      <View style={styles.nav}>
        <Pressable
          accessibilityLabel="Mero Health home"
          onPress={() => router.replace('/')}
          style={styles.brandLockup}
        >
          <LinearGradient colors={['#0C7C6E', '#07534C']} style={styles.brandMark}>
            <Text style={styles.brandGlyph}>म</Text>
          </LinearGradient>
          <View>
            <Text style={styles.brandName}>MERO HEALTH</Text>
            <Text style={styles.brandNepali}>मेरो स्वास्थ्य</Text>
          </View>
        </Pressable>

        {wide ? (
          <View style={styles.navLinks}>
            <Pressable onPress={() => router.push('/(tabs)/learn')}>
              <Text style={styles.navLink}>How it works</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/(tabs)/care')}>
              <Text style={styles.navLink}>Care network</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                router.push({ pathname: '/(tabs)/companion', params: { demo: 'emergency' } })
              }
            >
              <Text style={styles.navLink}>Safety</Text>
            </Pressable>
          </View>
        ) : null}

        <Pressable onPress={() => router.push('/(tabs)')} style={styles.navButton}>
          <Text style={styles.navButtonText}>{compact ? 'Open' : 'Open the experience'}</Text>
          <ArrowRight color="white" size={16} />
        </Pressable>
      </View>

      <View style={[styles.hero, wide && styles.heroWide]}>
        <View style={styles.heroCopy}>
          <View style={styles.eyebrow}>
            <View style={styles.liveDot} />
            <Text style={styles.eyebrowText}>NEPAL-FIRST · BUILT FOR EVERYWHERE</Text>
          </View>
          <Text style={[styles.heroTitle, compact && styles.heroTitleCompact]}>
            Your health,{'\n'}
            <Text style={styles.heroAccent}>understood.</Text>
          </Text>
          <Text style={styles.heroNepali}>तपाईंको स्वास्थ्य, तपाईंको भाषामा।</Text>
          <Text style={styles.heroBody}>
            One calm place to ask, understand, prepare and connect—without losing control of your
            information.
          </Text>

          <View style={[styles.heroActions, compact && styles.heroActionsCompact]}>
            <Pressable onPress={() => router.push('/(tabs)/companion')} style={styles.primaryCta}>
              <Sparkles color="white" size={18} />
              <Text style={styles.primaryCtaText}>Meet your health companion</Text>
              <ArrowRight color="white" size={17} />
            </Pressable>
            <Pressable onPress={() => router.push('/consultation')} style={styles.secondaryCta}>
              <Camera color={colors.primaryDark} size={18} />
              <Text style={styles.secondaryCtaText}>Try video room</Text>
            </Pressable>
          </View>

          <View style={styles.trustRow}>
            <View style={styles.trustItem}>
              <ShieldCheck color={colors.primary} size={17} />
              <Text style={styles.trustText}>Safety before answers</Text>
            </View>
            <View style={styles.trustItem}>
              <LockKeyhole color={colors.primary} size={17} />
              <Text style={styles.trustText}>Consent before sharing</Text>
            </View>
          </View>
        </View>

        <View style={[styles.heroVisual, !wide && styles.heroVisualNarrow]}>
          <LinearGradient
            colors={['#0A5E56', '#063B3B', '#102F46']}
            end={{ x: 1, y: 1 }}
            style={styles.visualCanvas}
          >
            <View style={styles.visualGrid} />
            <View style={styles.orbitOne} />
            <View style={styles.orbitTwo} />
            <View style={styles.orbPosition}>
              <SathiOrb size={compact ? 116 : 150} />
            </View>

            <View style={styles.languageChip}>
              <Globe2 color="#BFEBDD" size={16} />
              <Text style={styles.languageChipText}>नेपाली · English · Romanized</Text>
            </View>

            <View style={styles.voiceCard}>
              <Pressable
                accessibilityLabel={
                  recorderState.isRecording ? 'Stop recording' : 'Record a voice note'
                }
                onPress={() => {
                  void toggleRecording();
                }}
                style={[styles.micButton, recorderState.isRecording && styles.micButtonActive]}
              >
                {recorderState.isRecording ? (
                  <MicOff color="white" size={22} />
                ) : (
                  <Mic color="white" size={22} />
                )}
              </Pressable>
              <View style={styles.voiceCopy}>
                <Text style={styles.voiceLabel}>
                  {recorderState.isRecording ? 'VOICE NOTE · RECORDING' : 'VOICE-FIRST COMPANION'}
                </Text>
                <Text style={styles.voiceTitle}>{voiceMessage}</Text>
                {voiceError ? <Text style={styles.voiceError}>{voiceError}</Text> : null}
              </View>
              <View style={styles.waveform}>
                {[13, 22, 33, 18, 28, 38, 20].map((height, index) => (
                  <View
                    key={index}
                    style={[
                      styles.waveBar,
                      {
                        height: recorderState.isRecording ? height : Math.max(8, height * 0.45),
                        opacity: recorderState.isRecording ? 1 : 0.45,
                      },
                    ]}
                  />
                ))}
              </View>
            </View>

            <View style={styles.doctorCard}>
              <View style={styles.doctorAvatar}>
                <Stethoscope color={colors.primaryDark} size={20} />
              </View>
              <View style={styles.doctorCopy}>
                <Text style={styles.doctorStatus}>CARE CONNECTION</Text>
                <Text style={styles.doctorTitle}>The right professional, when needed</Text>
              </View>
              <BadgeCheck color="#7EE4C9" size={21} />
            </View>
          </LinearGradient>
        </View>
      </View>

      <View style={styles.signalStrip}>
        <View style={styles.signalItem}>
          <Text style={styles.signalValue}>3</Text>
          <Text style={styles.signalLabel}>language paths</Text>
        </View>
        <View style={styles.signalDivider} />
        <View style={styles.signalItem}>
          <Text style={styles.signalValue}>1</Text>
          <Text style={styles.signalLabel}>patient-controlled story</Text>
        </View>
        <View style={styles.signalDivider} />
        <View style={styles.signalItem}>
          <Text style={styles.signalValue}>0</Text>
          <Text style={styles.signalLabel}>autonomous diagnoses</Text>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeading}>
          <Text style={styles.sectionEyebrow}>A CLEARER WAY THROUGH HEALTHCARE</Text>
          <Text style={styles.sectionTitle}>From uncertainty to a useful next step.</Text>
          <Text style={styles.sectionBody}>
            The experience adapts to the person—not the other way around.
          </Text>
        </View>

        <View style={[styles.journeyGrid, !wide && styles.stack]}>
          {journey.map((item) => {
            const Icon = item.icon;
            return (
              <View key={item.number} style={[styles.journeyCard, { backgroundColor: item.color }]}>
                <View style={styles.journeyTop}>
                  <View style={[styles.journeyIcon, { backgroundColor: item.accent }]}>
                    <Icon color="white" size={21} />
                  </View>
                  <Text style={[styles.journeyNumber, { color: item.accent }]}>{item.number}</Text>
                </View>
                <Text style={styles.journeyTitle}>{item.title}</Text>
                <Text style={styles.journeyBody}>{item.body}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={[styles.bento, !wide && styles.stack]}>
        <LinearGradient colors={['#0B7668', '#07514B']} style={styles.bentoLead}>
          <Text style={styles.bentoKicker}>GUIDED, NOT GENERIC</Text>
          <Text style={styles.bentoTitle}>A companion that knows when to pause.</Text>
          <Text style={styles.bentoBody}>
            Emergency signals interrupt the ordinary flow. Clinical decisions stay with qualified
            professionals. Sources and uncertainty stay visible.
          </Text>
          <Pressable onPress={speakIntroduction} style={styles.listenButton}>
            <Volume2 color={colors.primaryDark} size={18} />
            <Text style={styles.listenButtonText}>Hear Sathi’s introduction</Text>
          </Pressable>
          <View style={styles.safetyLine}>
            <Check color="#BFEBDD" size={17} />
            <Text style={styles.safetyLineText}>No diagnosis masquerading as certainty</Text>
          </View>
          <View style={styles.safetyLine}>
            <Check color="#BFEBDD" size={17} />
            <Text style={styles.safetyLineText}>No sharing without an explicit purpose</Text>
          </View>
        </LinearGradient>

        <View style={styles.servicesPanel}>
          <Text style={styles.servicesEyebrow}>ONE CONNECTED EXPERIENCE</Text>
          <Text style={styles.servicesTitle}>Care should feel connected.</Text>
          <View style={styles.servicesGrid}>
            {services.map((service) => {
              const Icon = service.icon;
              return (
                <View
                  key={service.label}
                  style={[styles.serviceCard, { backgroundColor: service.tone }]}
                >
                  <Icon color={colors.primaryDark} size={21} />
                  <Text style={styles.serviceLabel}>{service.label}</Text>
                  <Text style={styles.serviceDetail}>{service.detail}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      <View style={[styles.finalCta, wide && styles.finalCtaWide]}>
        <View style={styles.finalOrb}>
          <HeartPulse color="white" size={31} />
        </View>
        <View style={styles.finalCopy}>
          <Text style={styles.finalTitle}>Start with one question.</Text>
          <Text style={styles.finalBody}>
            Explore the working demonstration with fictional information only.
          </Text>
        </View>
        <Pressable onPress={() => router.push('/(tabs)')} style={styles.finalButton}>
          <Play color={colors.primaryDark} fill={colors.primaryDark} size={16} />
          <Text style={styles.finalButtonText}>Enter Mero Health</Text>
        </Pressable>
      </View>

      <View style={styles.footer}>
        <View style={styles.brandLockup}>
          <View style={styles.footerMark}>
            <Text style={styles.brandGlyph}>म</Text>
          </View>
          <Text style={styles.footerBrand}>Mero Health</Text>
        </View>
        <Text style={styles.footerNote}>
          Demonstration only · Not an emergency service · Do not enter real patient information
        </Text>
        <Text style={styles.footerLegal}>Built for careful progress, not careless promises.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { backgroundColor: '#F6F8F3' },
  page: {
    alignItems: 'center',
    backgroundColor: '#F6F8F3',
    minHeight: '100%',
    overflow: 'hidden',
    paddingBottom: 28,
    position: 'relative',
  },
  auroraOne: {
    backgroundColor: '#CFEFE4',
    borderRadius: 420,
    height: 620,
    opacity: 0.56,
    position: 'absolute',
    right: -280,
    top: -290,
    width: 620,
  },
  auroraTwo: {
    backgroundColor: '#FFE5B3',
    borderRadius: 360,
    height: 480,
    left: -300,
    opacity: 0.34,
    position: 'absolute',
    top: 430,
    width: 480,
  },
  nav: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    maxWidth: 1240,
    paddingHorizontal: 24,
    paddingVertical: 22,
    width: '100%',
    zIndex: 2,
  },
  brandLockup: { alignItems: 'center', flexDirection: 'row', gap: 11 },
  brandMark: {
    alignItems: 'center',
    borderRadius: 14,
    height: 46,
    justifyContent: 'center',
    shadowColor: '#083F3B',
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    width: 46,
  },
  brandGlyph: { color: 'white', fontSize: 23, fontWeight: '900' },
  brandName: { color: '#0C3735', fontSize: 13, fontWeight: '900', letterSpacing: 1.4 },
  brandNepali: { color: '#647774', fontSize: 11, fontWeight: '700', marginTop: 1 },
  navLinks: { alignItems: 'center', flexDirection: 'row', gap: 32 },
  navLink: { color: '#395956', fontSize: 13, fontWeight: '700' },
  navButton: {
    alignItems: 'center',
    backgroundColor: '#0B6C61',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    minHeight: 45,
    paddingHorizontal: 18,
  },
  navButtonText: { color: 'white', fontSize: 13, fontWeight: '800' },
  hero: {
    gap: 38,
    maxWidth: 1240,
    paddingHorizontal: 24,
    paddingTop: 48,
    width: '100%',
  },
  heroWide: { alignItems: 'center', flexDirection: 'row', minHeight: 620, paddingTop: 20 },
  heroCopy: { flex: 1, minWidth: 0 },
  eyebrow: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,.76)',
    borderColor: '#D9E8E2',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  liveDot: { backgroundColor: '#14A78F', borderRadius: 5, height: 8, width: 8 },
  eyebrowText: { color: '#35605B', fontSize: 10, fontWeight: '900', letterSpacing: 1.15 },
  heroTitle: {
    color: '#0A302F',
    fontSize: 72,
    fontWeight: '900',
    letterSpacing: -3.4,
    lineHeight: 73,
  },
  heroTitleCompact: { fontSize: 47, letterSpacing: -2, lineHeight: 51 },
  heroAccent: { color: '#0B7668' },
  heroNepali: { color: '#1B514C', fontSize: 24, fontWeight: '800', marginTop: 19 },
  heroBody: { color: '#5D706D', fontSize: 18, lineHeight: 29, marginTop: 20, maxWidth: 590 },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 30 },
  heroActionsCompact: { alignItems: 'stretch', flexDirection: 'column' },
  primaryCta: {
    alignItems: 'center',
    backgroundColor: '#0B6C61',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: 20,
    shadowColor: '#0B6C61',
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
  },
  primaryCtaText: { color: 'white', fontSize: 14, fontWeight: '900' },
  secondaryCta: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,.8)',
    borderColor: '#D4E3DE',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: 20,
  },
  secondaryCtaText: { color: colors.primaryDark, fontSize: 14, fontWeight: '900' },
  trustRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, marginTop: 28 },
  trustItem: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  trustText: { color: '#496461', fontSize: 12, fontWeight: '700' },
  heroVisual: { flex: 0.93, minWidth: 0 },
  heroVisualNarrow: { minHeight: 500 },
  visualCanvas: {
    borderRadius: 36,
    height: 590,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#082F34',
    shadowOffset: { height: 24, width: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 38,
  },
  visualGrid: {
    borderColor: 'rgba(255,255,255,.08)',
    borderRadius: 30,
    borderWidth: 1,
    bottom: 22,
    left: 22,
    position: 'absolute',
    right: 22,
    top: 22,
  },
  orbitOne: {
    borderColor: 'rgba(185,237,222,.18)',
    borderRadius: 180,
    borderWidth: 1,
    height: 360,
    left: '50%',
    marginLeft: -180,
    marginTop: -180,
    position: 'absolute',
    top: '43%',
    width: 360,
  },
  orbitTwo: {
    borderColor: 'rgba(255,224,162,.13)',
    borderRadius: 125,
    borderWidth: 1,
    height: 250,
    left: '50%',
    marginLeft: -125,
    marginTop: -125,
    position: 'absolute',
    top: '43%',
    width: 250,
  },
  orbPosition: {
    alignItems: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 108,
  },
  languageChip: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(4,38,41,.74)',
    borderColor: 'rgba(191,235,221,.22)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 36,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  languageChipText: { color: '#E8F7F1', fontSize: 11, fontWeight: '800' },
  voiceCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,.96)',
    borderRadius: 21,
    bottom: 100,
    flexDirection: 'row',
    gap: 12,
    left: 22,
    padding: 14,
    position: 'absolute',
    right: 22,
  },
  micButton: {
    alignItems: 'center',
    backgroundColor: '#0B7668',
    borderRadius: 18,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  micButtonActive: { backgroundColor: '#D64B42' },
  voiceCopy: { flex: 1, minWidth: 0 },
  voiceLabel: { color: '#66807C', fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  voiceTitle: { color: '#103735', fontSize: 13, fontWeight: '900', marginTop: 3 },
  voiceError: { color: '#B42318', fontSize: 9, marginTop: 3 },
  waveform: { alignItems: 'center', flexDirection: 'row', gap: 3, height: 40 },
  waveBar: { backgroundColor: '#0B7668', borderRadius: 3, width: 3 },
  doctorCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(4,35,39,.84)',
    borderColor: 'rgba(255,255,255,.13)',
    borderRadius: 19,
    borderWidth: 1,
    bottom: 22,
    flexDirection: 'row',
    gap: 11,
    left: 40,
    padding: 12,
    position: 'absolute',
    right: 40,
  },
  doctorAvatar: {
    alignItems: 'center',
    backgroundColor: '#BFEBDD',
    borderRadius: 15,
    height: 43,
    justifyContent: 'center',
    width: 43,
  },
  doctorCopy: { flex: 1 },
  doctorStatus: { color: '#80C9B8', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  doctorTitle: { color: 'white', fontSize: 12, fontWeight: '800', marginTop: 2 },
  signalStrip: {
    alignItems: 'center',
    backgroundColor: 'white',
    borderColor: '#DFE9E4',
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 72,
    maxWidth: 1050,
    paddingHorizontal: 20,
    paddingVertical: 19,
    width: '88%',
  },
  signalItem: { alignItems: 'center', flex: 1 },
  signalValue: { color: '#0B6C61', fontSize: 23, fontWeight: '900' },
  signalLabel: {
    color: '#657875',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
  },
  signalDivider: { backgroundColor: '#DFE9E4', height: 34, width: 1 },
  section: { maxWidth: 1240, paddingHorizontal: 24, paddingTop: 120, width: '100%' },
  sectionHeading: { alignItems: 'center', alignSelf: 'center', maxWidth: 720 },
  sectionEyebrow: { color: '#0B7668', fontSize: 10, fontWeight: '900', letterSpacing: 1.45 },
  sectionTitle: {
    color: '#0A302F',
    fontSize: 43,
    fontWeight: '900',
    letterSpacing: -1.6,
    lineHeight: 50,
    marginTop: 14,
    textAlign: 'center',
  },
  sectionBody: { color: '#687B78', fontSize: 16, marginTop: 12, textAlign: 'center' },
  journeyGrid: { flexDirection: 'row', gap: 16, marginTop: 46 },
  stack: { flexDirection: 'column' },
  journeyCard: { borderRadius: 27, flex: 1, minHeight: 258, padding: 24 },
  journeyTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  journeyIcon: {
    alignItems: 'center',
    borderRadius: 17,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  journeyNumber: { fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  journeyTitle: { color: '#113A37', fontSize: 21, fontWeight: '900', marginTop: 35 },
  journeyBody: { color: '#536966', fontSize: 14, lineHeight: 22, marginTop: 10 },
  bento: {
    flexDirection: 'row',
    gap: 18,
    maxWidth: 1240,
    paddingHorizontal: 24,
    paddingTop: 110,
    width: '100%',
  },
  bentoLead: { borderRadius: 30, flex: 0.92, minHeight: 500, padding: 30 },
  bentoKicker: { color: '#A7DCD0', fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  bentoTitle: {
    color: 'white',
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -1.2,
    lineHeight: 44,
    marginTop: 18,
  },
  bentoBody: { color: '#D4EEE7', fontSize: 15, lineHeight: 24, marginTop: 18 },
  listenButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#EAF8F3',
    borderRadius: 15,
    flexDirection: 'row',
    gap: 9,
    marginBottom: 30,
    marginTop: 28,
    minHeight: 49,
    paddingHorizontal: 16,
  },
  listenButtonText: { color: colors.primaryDark, fontSize: 12, fontWeight: '900' },
  safetyLine: { alignItems: 'center', flexDirection: 'row', gap: 9, marginTop: 12 },
  safetyLineText: { color: '#E9F7F3', fontSize: 12, fontWeight: '700' },
  servicesPanel: { backgroundColor: 'white', borderRadius: 30, flex: 1.08, padding: 30 },
  servicesEyebrow: { color: '#0B7668', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  servicesTitle: {
    color: '#0A302F',
    fontSize: 31,
    fontWeight: '900',
    letterSpacing: -1,
    marginTop: 12,
  },
  servicesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 28 },
  serviceCard: { borderRadius: 19, minHeight: 145, padding: 17, width: '48%' },
  serviceLabel: { color: '#173E3B', fontSize: 14, fontWeight: '900', marginTop: 18 },
  serviceDetail: { color: '#617572', fontSize: 10, lineHeight: 15, marginTop: 5 },
  finalCta: {
    alignItems: 'flex-start',
    backgroundColor: '#102F3E',
    borderRadius: 30,
    gap: 18,
    marginTop: 110,
    maxWidth: 1192,
    padding: 28,
    width: '88%',
  },
  finalCtaWide: { alignItems: 'center', flexDirection: 'row' },
  finalOrb: {
    alignItems: 'center',
    backgroundColor: '#0B7668',
    borderRadius: 24,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  finalCopy: { flex: 1 },
  finalTitle: { color: 'white', fontSize: 26, fontWeight: '900' },
  finalBody: { color: '#C8D8DD', fontSize: 13, marginTop: 5 },
  finalButton: {
    alignItems: 'center',
    backgroundColor: '#DDF5EC',
    borderRadius: 15,
    flexDirection: 'row',
    gap: 9,
    minHeight: 51,
    paddingHorizontal: 18,
  },
  finalButtonText: { color: colors.primaryDark, fontSize: 13, fontWeight: '900' },
  footer: {
    alignItems: 'center',
    gap: 14,
    marginTop: 72,
    maxWidth: 1192,
    paddingHorizontal: 24,
    width: '100%',
  },
  footerMark: {
    alignItems: 'center',
    backgroundColor: '#0B6C61',
    borderRadius: 11,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  footerBrand: { color: '#173E3B', fontSize: 16, fontWeight: '900' },
  footerNote: { color: '#657875', fontSize: 11, textAlign: 'center' },
  footerLegal: { color: '#8A9997', fontSize: 10, fontWeight: '700' },
});
