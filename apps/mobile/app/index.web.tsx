import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
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

// Three journey steps, three brand tiers — forest, jade, marigold — instead
// of the arbitrary blue/violet accents this screen used before. `saffronDeep`
// is a muted marigold, matching the quiet marigold-on-marigold-100 badge
// convention `apps/web`'s PartnerMarquee already established rather than
// spending the loud `saffron` itself outside the hero's one CTA.
const journey = [
  {
    number: '01',
    icon: Mic,
    title: 'आफ्नै भाषामा भन्नुहोस्',
    body: 'नेपाली, रोमन नेपाली, अंग्रेजी वा मिसाएर—आवाज वा अक्षरमा आफ्नो कुरा भन्नुहोस्।',
    color: colors.mint,
    accent: colors.primary,
  },
  {
    number: '02',
    icon: BrainCircuit,
    title: 'स्वास्थ्य चित्र बनाउनुहोस्',
    body: 'साथीले तपाईंको सहमतिमा आवश्यक कुरा मात्र एक–एक स्पष्ट कदममा जोड्छ।',
    color: colors.mintFaint,
    accent: colors.info,
  },
  {
    number: '03',
    icon: Stethoscope,
    title: 'सही सेवासम्म पुग्नुहोस्',
    body: 'उपयुक्त सेवा खोज्नुहोस्, भेटघाटको तयारी गर्नुहोस् र आफूले चाहेको कुरा मात्र बाँड्नुहोस्।',
    color: colors.saffronSoft,
    accent: colors.saffronDeep,
  },
];

const services = [
  {
    icon: Stethoscope,
    label: 'डाक्टर र विशेषज्ञ',
    detail: 'खोज्नुहोस्, बुझ्नुहोस् र तयारी गर्नुहोस्',
    tone: colors.mint,
  },
  {
    icon: Building2,
    label: 'नजिकको स्वास्थ्य सेवा',
    detail: 'अस्पताल, क्लिनिक र घरमै सेवा',
    tone: colors.mintFaint,
  },
  {
    icon: FileHeart,
    label: 'तपाईंको स्वास्थ्य कथा',
    detail: 'आफैले बुझ्न सक्ने विवरण',
    tone: colors.canvas,
  },
  {
    icon: Video,
    label: 'भिडियो परामर्श',
    detail: 'निजी कक्षको नमुना',
    tone: colors.saffronSoft,
  },
];

export default function WebWelcomeScreen() {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const compact = width < 620;
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 200);
  const [voiceMessage, setVoiceMessage] = useState('निजी आवाज नोट प्रयोग गर्न थिच्नुहोस्');
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const toggleRecording = async () => {
    setVoiceError(null);
    try {
      if (recorderState.isRecording) {
        await recorder.stop();
        setVoiceMessage('आवाज यही उपकरणमा सुरक्षित भयो · अपलोड गरिएको छैन');
        return;
      }

      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setVoiceError('आवाज नोटका लागि माइक्रोफोन अनुमति चाहिन्छ।');
        return;
      }

      await recorder.prepareToRecordAsync();
      recorder.record();
      setVoiceMessage('सुन्दैछु… सकिएपछि फेरि थिच्नुहोस्');
    } catch {
      setVoiceError('यो ब्राउजरमा आवाज रेकर्ड उपलब्ध छैन।');
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

      <View style={styles.announcement}>
        <Text style={styles.announcementText}>
          New: Evidence-backed health research is now available in Mero Health
        </Text>
        <Pressable onPress={() => router.push('/(tabs)/companion')} style={styles.announcementLink}>
          <Text style={styles.announcementLinkText}>Try it now</Text>
          <ArrowRight color={colors.primaryDark} size={15} />
        </Pressable>
      </View>

      <View style={styles.nav}>
        <Pressable
          accessibilityLabel="मेरो स्वास्थ्य गृहपृष्ठ"
          onPress={() => router.replace('/')}
          style={styles.brandLockup}
        >
          <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.brandMark}>
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
              <Text style={styles.navLink}>कसरी चलाउने</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/(tabs)/care')}>
              <Text style={styles.navLink}>स्वास्थ्य सेवा</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                router.push({ pathname: '/(tabs)/companion', params: { demo: 'emergency' } })
              }
            >
              <Text style={styles.navLink}>सुरक्षा</Text>
            </Pressable>
          </View>
        ) : null}

        <Pressable onPress={() => router.push('/(tabs)')} style={styles.navButton}>
          <Text style={styles.navButtonText}>
            {compact ? 'खोल्नुहोस्' : 'मेरो स्वास्थ्य खोल्नुहोस्'}
          </Text>
          <ArrowRight color="white" size={16} />
        </Pressable>
      </View>

      <View style={[styles.hero, wide && styles.heroWide]}>
        <View style={styles.heroCopy}>
          <View style={styles.eyebrow}>
            <View style={styles.liveDot} />
            <Text style={styles.eyebrowText}>नेपालका लागि · संसारभर उपयोगी</Text>
          </View>
          <Text style={[styles.heroTitle, compact && styles.heroTitleCompact]}>
            तपाईंको स्वास्थ्य,{'\n'}
            <Text style={styles.heroAccent}>अब बुझ्ने गरी।</Text>
          </Text>
          <Text style={styles.heroNepali}>Your health, in your language.</Text>
          <Text style={styles.heroBody}>
            सोध्न, बुझ्न, तयारी गर्न र सही सेवासँग जोडिन सकिने एउटै शान्त ठाउँ—आफ्नो स्वास्थ्य
            जानकारीमाथिको नियन्त्रण नगुमाई।
          </Text>

          <View style={[styles.heroActions, compact && styles.heroActionsCompact]}>
            <Pressable onPress={() => router.push('/(tabs)/companion')} style={styles.primaryCta}>
              <Sparkles color={colors.primaryDark} size={18} />
              <Text style={styles.primaryCtaText}>स्वास्थ्य साथीसँग कुरा गर्नुहोस्</Text>
              <ArrowRight color={colors.primaryDark} size={17} />
            </Pressable>
            <Pressable onPress={() => router.push('/consultation')} style={styles.secondaryCta}>
              <Camera color={colors.primaryDark} size={18} />
              <Text style={styles.secondaryCtaText}>भिडियो कक्ष हेर्नुहोस्</Text>
            </Pressable>
          </View>

          <View style={styles.trustRow}>
            <View style={styles.trustItem}>
              <ShieldCheck color={colors.primary} size={17} />
              <Text style={styles.trustText}>जवाफअघि सुरक्षा</Text>
            </View>
            <View style={styles.trustItem}>
              <LockKeyhole color={colors.primary} size={17} />
              <Text style={styles.trustText}>बाँड्नुअघि सहमति</Text>
            </View>
          </View>
        </View>

        <View style={[styles.heroVisual, !wide && styles.heroVisualNarrow]}>
          <View style={styles.visualCanvas}>
            <LinearGradient
              colors={[colors.primary, colors.primaryDeep, colors.primaryDark]}
              style={styles.heroBackdrop}
            />
            <View style={styles.visualGrid} />
            <View style={styles.orbitOne} />
            <View style={styles.orbitTwo} />

            <View style={styles.languageChip}>
              <Globe2 color={colors.mint} size={16} />
              <Text style={styles.languageChipText}>नेपाली पहिलो · रोमन नेपाली · English</Text>
            </View>

            <View style={styles.aiBadge}>
              <Sparkles color={colors.primaryDark} size={16} />
              <Text style={styles.aiBadgeText}>एआई स्वास्थ्य साथी · निर्णय तपाईंको</Text>
            </View>

            <View style={styles.voiceCard}>
              <Pressable
                accessibilityLabel={
                  recorderState.isRecording ? 'रेकर्ड रोक्नुहोस्' : 'आवाज नोट रेकर्ड गर्नुहोस्'
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
                  {recorderState.isRecording
                    ? 'आवाज नोट · रेकर्ड हुँदैछ'
                    : 'आवाजमै चल्ने स्वास्थ्य साथी'}
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
                <Text style={styles.doctorStatus}>स्वास्थ्य सेवासँग जोडिँदै</Text>
                <Text style={styles.doctorTitle}>आवश्यक पर्दा सही स्वास्थ्यकर्मी</Text>
              </View>
              <BadgeCheck color={colors.irisBright} size={21} />
            </View>
          </View>
        </View>
      </View>
      <View style={styles.signalStrip}>
        <View style={styles.signalItem}>
          <Text style={styles.signalValue}>3</Text>
          <Text style={styles.signalLabel}>भाषाका विकल्प</Text>
        </View>
        <View style={styles.signalDivider} />
        <View style={styles.signalItem}>
          <Text style={styles.signalValue}>1</Text>
          <Text style={styles.signalLabel}>तपाईंको नियन्त्रणमा स्वास्थ्य कथा</Text>
        </View>
        <View style={styles.signalDivider} />
        <View style={styles.signalItem}>
          <Text style={styles.signalValue}>0</Text>
          <Text style={styles.signalLabel}>स्वचालित निदान</Text>
        </View>
      </View>
      <View style={styles.careOverview}>
        <View style={styles.careOverviewHead}>
          <Text style={styles.careKicker}>CARE, ALL IN ONE PLACE</Text>
          <Text style={styles.careTitle}>The care you need, all in one place.</Text>
          <Text style={styles.careBody}>
            From a health question to finding the right care, every step stays clear, safe, and
            under your control.
          </Text>
        </View>
        <View style={[styles.careGrid, !wide && styles.stack]}>
          {services.map((service, index) => {
            const Icon = service.icon;
            return (
              <Pressable
                key={service.label}
                onPress={() =>
                  router.push(
                    index === 0
                      ? '/(tabs)/companion'
                      : index === 1
                        ? '/(tabs)/care'
                        : index === 2
                          ? '/(tabs)/twin'
                          : '/consultation',
                  )
                }
                style={({ pressed }) => [
                  styles.careCard,
                  { backgroundColor: service.tone, opacity: pressed ? 0.82 : 1 },
                ]}
              >
                <View style={styles.careCardTop}>
                  <View style={styles.careIcon}>
                    <Icon color={colors.primaryDark} size={24} />
                  </View>
                  <ArrowRight color={colors.primaryDark} size={19} />
                </View>
                <Text style={styles.careCardTitle}>{service.label}</Text>
                <Text style={styles.careCardBody}>{service.detail}</Text>
                <Text style={styles.careCardLink}>Get started</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeading}>
          <Text style={styles.sectionEyebrow}>स्वास्थ्य सेवाको स्पष्ट बाटो</Text>
          <Text style={styles.sectionTitle}>अनिश्चितताबाट उपयोगी अर्को कदमसम्म।</Text>
          <Text style={styles.sectionBody}>
            प्रविधि तपाईंअनुसार बदलिन्छ—तपाईं प्रविधिअनुसार होइन।
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

      <View style={[styles.imagerySection, !wide && styles.stack]}>
        <View
          style={[
            styles.bodyStory,
            !wide && styles.storyCardNarrow,
            compact && styles.bodyStoryCompact,
          ]}
        >
          <LinearGradient
            colors={[colors.primary, colors.primaryDeep]}
            end={{ x: 1, y: 1 }}
            style={styles.storyBackdrop}
          />
          <View style={styles.storyCopy}>
            <Text style={styles.storyKicker}>तपाईंको डिजिटल स्वास्थ्य चित्र</Text>
            <Text style={styles.storyTitle}>शरीरलाई बुझ्ने, एक–एक तथ्यबाट।</Text>
            <Text style={styles.storyBody}>
              अंग, लक्षण, औषधि र स्वास्थ्य इतिहास—तपाईंले पुष्टि गरेको जानकारी मात्र।
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.careStory,
            !wide && styles.storyCardNarrow,
            compact && styles.careStoryCompact,
          ]}
        >
          <LinearGradient
            colors={[colors.primaryDeep, colors.primaryDark]}
            end={{ x: 1, y: 1 }}
            style={styles.storyBackdrop}
          />
          <View style={styles.storyCopy}>
            <Text style={styles.storyKicker}>मानिससँग जोडिएको सेवा</Text>
            <Text style={styles.storyTitle}>एआईले तयारी गर्छ, स्वास्थ्यकर्मीले निर्णय गर्छन्।</Text>
            <Text style={styles.storyBody}>
              साथीले तपाईंको कुरा मिलाउँछ र सही सेवासम्म पुग्न मद्दत गर्छ—उपचारको ठाउँ लिँदैन।
            </Text>
          </View>
        </View>
      </View>
      <View style={[styles.bento, !wide && styles.stack]}>
        <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.bentoLead}>
          <Text style={styles.bentoKicker}>सामान्य जवाफ होइन, मार्गदर्शन</Text>
          <Text style={styles.bentoTitle}>
            कहिले रोकिएर स्वास्थ्यकर्मी खोज्नुपर्छ भन्ने बुझ्ने साथी।
          </Text>
          <Text style={styles.bentoBody}>
            गम्भीर संकेत देखिए सामान्य प्रक्रिया रोकिन्छ। उपचारसम्बन्धी निर्णय योग्य
            स्वास्थ्यकर्मीमै रहन्छ। स्रोत र अनिश्चितता सधैँ स्पष्ट देखाइन्छ।
          </Text>
          <Pressable onPress={speakIntroduction} style={styles.listenButton}>
            <Volume2 color={colors.primaryDark} size={18} />
            <Text style={styles.listenButtonText}>साथीको परिचय सुन्नुहोस्</Text>
          </Pressable>
          <View style={styles.safetyLine}>
            <Check color={colors.mintStrong} size={17} />
            <Text style={styles.safetyLineText}>अनुमानलाई निश्चित निदान बनाइँदैन</Text>
          </View>
          <View style={styles.safetyLine}>
            <Check color={colors.mintStrong} size={17} />
            <Text style={styles.safetyLineText}>स्पष्ट उद्देश्यबिना जानकारी बाँडिँदैन</Text>
          </View>
        </LinearGradient>

        <View style={styles.servicesPanel}>
          <Text style={styles.servicesEyebrow}>एउटै जोडिएको अनुभव</Text>
          <Text style={styles.servicesTitle}>स्वास्थ्य सेवा टुक्रिएको जस्तो हुनु हुँदैन।</Text>
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

      <View style={[styles.perplexityBand, !wide && styles.stack]}>
        <View style={styles.perplexityCopy}>
          <View style={styles.perplexityBadge}>
            <Sparkles color={colors.mintStrong} size={16} />
            <Text style={styles.perplexityBadgeText}>MERO HEALTH × PERPLEXITY</Text>
          </View>
          <Text style={styles.perplexityTitle}>Not just search. Health answers with sources.</Text>
          <Text style={styles.perplexityBody}>
            Mero Health screens urgent warning signs first. For safe questions, Perplexity Sonar
            finds current sources and returns an answer with citations. Records, wearables, and
            personal health trends hand off to Perplexity Health.
          </Text>
          <Pressable onPress={() => router.push('/(tabs)/companion')} style={styles.perplexityCta}>
            <Sparkles color={colors.primaryDark} size={18} />
            <Text style={styles.perplexityCtaText}>Ask with cited research</Text>
            <ArrowRight color={colors.primaryDark} size={17} />
          </Pressable>
        </View>
        <View style={styles.perplexityFeatures}>
          <View style={styles.perplexityFeature}>
            <ShieldCheck color={colors.mintStrong} size={22} />
            <View style={styles.perplexityFeatureCopy}>
              <Text style={styles.perplexityFeatureTitle}>Safety before AI</Text>
              <Text style={styles.perplexityFeatureBody}>
                Urgent signals stop the normal answer flow.
              </Text>
            </View>
          </View>
          <View style={styles.perplexityFeature}>
            <BookOpen color={colors.mintStrong} size={22} />
            <View style={styles.perplexityFeatureCopy}>
              <Text style={styles.perplexityFeatureTitle}>Citations you can open</Text>
              <Text style={styles.perplexityFeatureBody}>Inspect every source for yourself.</Text>
            </View>
          </View>
          <View style={styles.perplexityFeature}>
            <FileHeart color={colors.mintStrong} size={22} />
            <View style={styles.perplexityFeatureCopy}>
              <Text style={styles.perplexityFeatureTitle}>Personal health handoff</Text>
              <Text style={styles.perplexityFeatureBody}>
                Records and wearables continue in Perplexity Health.
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={[styles.finalCta, wide && styles.finalCtaWide]}>
        <View style={styles.finalOrb}>
          <HeartPulse color="white" size={31} />
        </View>
        <View style={styles.finalCopy}>
          <Text style={styles.finalTitle}>एउटा प्रश्नबाट सुरु गर्नुहोस्।</Text>
          <Text style={styles.finalBody}>
            नमुना जानकारी मात्र प्रयोग गरेर कार्यरत प्रदर्शन हेर्नुहोस्।
          </Text>
        </View>
        <Pressable onPress={() => router.push('/(tabs)')} style={styles.finalButton}>
          <Play color={colors.primaryDark} fill={colors.primaryDark} size={16} />
          <Text style={styles.finalButtonText}>मेरो स्वास्थ्यमा प्रवेश गर्नुहोस्</Text>
        </Pressable>
      </View>

      <View style={styles.footer}>
        <View style={styles.brandLockup}>
          <View style={styles.footerMark}>
            <Text style={styles.brandGlyph}>म</Text>
          </View>
          <Text style={styles.footerBrand}>मेरो स्वास्थ्य</Text>
        </View>
        <Text style={styles.footerNote}>
          प्रदर्शन मात्र · आपतकालीन सेवा होइन · वास्तविक बिरामीको जानकारी नदिनुहोस्
        </Text>
        <Text style={styles.footerLegal}>
          सावधानीपूर्वक प्रगतिका लागि—लापरवाह वाचाका लागि होइन।
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { backgroundColor: colors.canvas },
  page: {
    alignItems: 'center',
    backgroundColor: colors.canvas,
    minHeight: '100%',
    overflow: 'hidden',
    paddingBottom: 28,
    position: 'relative',
  },
  auroraOne: {
    backgroundColor: colors.mintStrong,
    borderRadius: 420,
    height: 620,
    opacity: 0.56,
    position: 'absolute',
    right: -280,
    top: -290,
    width: 620,
  },
  auroraTwo: {
    backgroundColor: colors.saffronSoft,
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
    shadowColor: colors.primaryDark,
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    width: 46,
  },
  brandGlyph: { color: 'white', fontSize: 23, fontWeight: '900' },
  brandName: { color: colors.ink, fontSize: 13, fontWeight: '900', letterSpacing: 1.4 },
  brandNepali: { color: colors.muted, fontSize: 11, fontWeight: '700', marginTop: 1 },
  navLinks: { alignItems: 'center', flexDirection: 'row', gap: 32 },
  navLink: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  navButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    minHeight: 45,
    paddingHorizontal: 18,
  },
  navButtonText: { color: 'white', fontSize: 13, fontWeight: '800' },
  hero: {
    backgroundColor: colors.primary,
    borderRadius: 36,
    marginTop: 12,
    overflow: 'hidden',
    paddingBottom: 34,
    paddingLeft: 18,
    paddingRight: 18,
    gap: 38,
    maxWidth: 1240,
    paddingHorizontal: 24,
    paddingTop: 48,
    width: '100%',
  },
  heroWide: { alignItems: 'center', flexDirection: 'row', minHeight: 650, paddingTop: 34 },
  heroCopy: { flex: 1, minWidth: 0 },
  eyebrow: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,.10)',
    borderColor: 'rgba(255,255,255,.18)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  liveDot: { backgroundColor: colors.irisBright, borderRadius: 5, height: 8, width: 8 },
  eyebrowText: { color: colors.mint, fontSize: 10, fontWeight: '900', letterSpacing: 1.15 },
  heroTitle: {
    color: 'white',
    fontSize: 58,
    fontWeight: '900',
    letterSpacing: -2,
    lineHeight: 68,
  },
  heroTitleCompact: { fontSize: 43, letterSpacing: -1.3, lineHeight: 54 },
  heroAccent: { color: colors.mintStrong },
  heroNepali: { color: 'white', fontSize: 24, fontWeight: '800', marginTop: 19 },
  heroBody: { color: colors.mint, fontSize: 18, lineHeight: 29, marginTop: 20, maxWidth: 590 },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 30 },
  heroActionsCompact: { alignItems: 'stretch', flexDirection: 'column' },
  // The hero's one marigold moment — the single loudest action on this
  // screen, matching apps/web's Hero CTA. `navButton` above stays a solid
  // forest pill so marigold is spent only once, per the art-direction rule.
  primaryCta: {
    alignItems: 'center',
    backgroundColor: colors.saffron,
    borderRadius: 16,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: 20,
    shadowColor: colors.primaryDark,
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
  },
  primaryCtaText: { color: colors.primaryDark, fontSize: 14, fontWeight: '900' },
  secondaryCta: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,.8)',
    borderColor: colors.line,
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
  trustText: { color: colors.mint, fontSize: 12, fontWeight: '700' },
  heroVisual: { flex: 0.93, minWidth: 0 },
  heroVisualNarrow: { minHeight: 500 },
  visualCanvas: {
    borderRadius: 36,
    height: 590,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: colors.primaryDark,
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
    borderColor: 'rgba(169,223,201,.18)',
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
    borderColor: 'rgba(244,166,42,.13)',
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
  languageChip: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(7,35,26,.74)',
    borderColor: 'rgba(169,223,201,.22)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 36,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  languageChipText: { color: colors.mint, fontSize: 11, fontWeight: '800' },
  heroBackdrop: {
    bottom: 0,
    height: '100%',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    width: '100%',
  },
  aiBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(216,240,229,.94)',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 8,
    position: 'absolute',
    right: 22,
    top: 82,
  },
  aiBadgeText: { color: colors.primaryDark, fontSize: 10, fontWeight: '900' },
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
    backgroundColor: colors.primary,
    borderRadius: 18,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  micButtonActive: { backgroundColor: colors.danger },
  voiceCopy: { flex: 1, minWidth: 0 },
  voiceLabel: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  voiceTitle: { color: colors.ink, fontSize: 13, fontWeight: '900', marginTop: 3 },
  voiceError: { color: colors.danger, fontSize: 9, marginTop: 3 },
  waveform: { alignItems: 'center', flexDirection: 'row', gap: 3, height: 40 },
  waveBar: { backgroundColor: colors.primary, borderRadius: 3, width: 3 },
  doctorCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(7,35,26,.84)',
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
    backgroundColor: colors.mintStrong,
    borderRadius: 15,
    height: 43,
    justifyContent: 'center',
    width: 43,
  },
  doctorCopy: { flex: 1 },
  doctorStatus: { color: colors.mintStrong, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  doctorTitle: { color: 'white', fontSize: 12, fontWeight: '800', marginTop: 2 },
  signalStrip: {
    alignItems: 'center',
    backgroundColor: 'white',
    borderColor: colors.line,
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
  signalValue: { color: colors.primary, fontSize: 23, fontWeight: '900' },
  signalLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
  },
  signalDivider: { backgroundColor: colors.line, height: 34, width: 1 },
  section: { maxWidth: 1240, paddingHorizontal: 24, paddingTop: 120, width: '100%' },
  sectionHeading: { alignItems: 'center', alignSelf: 'center', maxWidth: 720 },
  sectionEyebrow: { color: colors.info, fontSize: 10, fontWeight: '900', letterSpacing: 1.45 },
  sectionTitle: {
    color: colors.ink,
    fontSize: 43,
    fontWeight: '900',
    letterSpacing: -1.6,
    lineHeight: 50,
    marginTop: 14,
    textAlign: 'center',
  },
  sectionBody: { color: colors.muted, fontSize: 16, marginTop: 12, textAlign: 'center' },
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
  journeyTitle: { color: colors.ink, fontSize: 21, fontWeight: '900', marginTop: 35 },
  journeyBody: { color: colors.muted, fontSize: 14, lineHeight: 22, marginTop: 10 },
  imagerySection: {
    flexDirection: 'row',
    gap: 18,
    maxWidth: 1240,
    paddingHorizontal: 24,
    paddingTop: 110,
    width: '100%',
  },
  bodyStory: {
    borderRadius: 30,
    flex: 0.72,
    height: 620,
    overflow: 'hidden',
    position: 'relative',
  },
  careStory: {
    borderRadius: 30,
    flex: 1.28,
    height: 620,
    overflow: 'hidden',
    position: 'relative',
  },
  storyCardNarrow: { flexBasis: 'auto', flexGrow: 0, flexShrink: 0, width: '100%' },
  bodyStoryCompact: { height: 560 },
  careStoryCompact: { height: 400 },
  storyBackdrop: { height: '100%', width: '100%' },
  storyCopy: {
    bottom: 0,
    left: 0,
    padding: 28,
    position: 'absolute',
    right: 0,
  },
  storyKicker: {
    color: colors.mintStrong,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  storyTitle: {
    color: 'white',
    fontSize: 29,
    fontWeight: '900',
    lineHeight: 37,
    marginTop: 10,
    maxWidth: 580,
  },
  storyBody: {
    color: colors.mint,
    fontSize: 13,
    lineHeight: 21,
    marginTop: 10,
    maxWidth: 560,
  },
  bento: {
    flexDirection: 'row',
    gap: 18,
    maxWidth: 1240,
    paddingHorizontal: 24,
    paddingTop: 110,
    width: '100%',
  },
  bentoLead: { borderRadius: 30, flex: 0.92, minHeight: 500, padding: 30 },
  bentoKicker: { color: colors.mintStrong, fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  bentoTitle: {
    color: 'white',
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -1.2,
    lineHeight: 44,
    marginTop: 18,
  },
  bentoBody: { color: colors.mint, fontSize: 15, lineHeight: 24, marginTop: 18 },
  listenButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.mintFaint,
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
  safetyLineText: { color: colors.mint, fontSize: 12, fontWeight: '700' },
  servicesPanel: { backgroundColor: 'white', borderRadius: 30, flex: 1.08, padding: 30 },
  servicesEyebrow: { color: colors.info, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  servicesTitle: {
    color: colors.ink,
    fontSize: 31,
    fontWeight: '900',
    letterSpacing: -1,
    marginTop: 12,
  },
  servicesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 28 },
  serviceCard: { borderRadius: 19, minHeight: 145, padding: 17, width: '48%' },
  serviceLabel: { color: colors.ink, fontSize: 14, fontWeight: '900', marginTop: 18 },
  serviceDetail: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 5 },
  finalCta: {
    alignItems: 'flex-start',
    backgroundColor: colors.primaryDark,
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
    backgroundColor: colors.primary,
    borderRadius: 24,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  finalCopy: { flex: 1 },
  finalTitle: { color: 'white', fontSize: 26, fontWeight: '900' },
  finalBody: { color: colors.mint, fontSize: 13, marginTop: 5 },
  finalButton: {
    alignItems: 'center',
    backgroundColor: colors.mint,
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
    backgroundColor: colors.primary,
    borderRadius: 11,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  footerBrand: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  footerNote: { color: colors.muted, fontSize: 11, textAlign: 'center' },
  announcement: {
    alignItems: 'center',
    backgroundColor: colors.primaryDeep,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 43,
    paddingHorizontal: 18,
    width: '100%',
    zIndex: 3,
  },
  announcementText: { color: colors.mint, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  announcementLink: {
    alignItems: 'center',
    backgroundColor: colors.mintStrong,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    marginLeft: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  announcementLinkText: { color: colors.primaryDark, fontSize: 10, fontWeight: '900' },
  careOverview: { maxWidth: 1240, paddingHorizontal: 24, paddingTop: 105, width: '100%' },
  careOverviewHead: { maxWidth: 740 },
  careKicker: { color: colors.info, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  careTitle: {
    color: colors.ink,
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: -1.5,
    lineHeight: 51,
    marginTop: 14,
  },
  careBody: { color: colors.muted, fontSize: 16, lineHeight: 25, marginTop: 14, maxWidth: 660 },
  careGrid: { flexDirection: 'row', gap: 14, marginTop: 38 },
  careCard: { borderRadius: 24, flex: 1, minHeight: 270, padding: 23 },
  careCardTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  careIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,.72)',
    borderRadius: 18,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  careCardTitle: { color: colors.ink, fontSize: 20, fontWeight: '900', marginTop: 32 },
  careCardBody: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 9 },
  careCardLink: { color: colors.primary, fontSize: 12, fontWeight: '900', marginTop: 24 },
  perplexityBand: {
    backgroundColor: colors.primaryDeep,
    borderRadius: 32,
    flexDirection: 'row',
    gap: 34,
    marginTop: 110,
    maxWidth: 1192,
    overflow: 'hidden',
    padding: 38,
    width: '88%',
  },
  perplexityCopy: { flex: 1.15 },
  perplexityBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(169,223,201,.12)',
    borderColor: 'rgba(169,223,201,.22)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  perplexityBadgeText: {
    color: colors.mintStrong,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  perplexityTitle: {
    color: 'white',
    fontSize: 39,
    fontWeight: '900',
    letterSpacing: -1.2,
    lineHeight: 46,
    marginTop: 22,
  },
  perplexityBody: { color: colors.mint, fontSize: 14, lineHeight: 23, marginTop: 16 },
  perplexityCta: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.mintStrong,
    borderRadius: 15,
    flexDirection: 'row',
    gap: 9,
    marginTop: 26,
    minHeight: 52,
    paddingHorizontal: 17,
  },
  perplexityCtaText: { color: colors.primaryDark, fontSize: 13, fontWeight: '900' },
  perplexityFeatures: { flex: 0.85, gap: 13, justifyContent: 'center' },
  perplexityFeature: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,.07)',
    borderColor: 'rgba(255,255,255,.09)',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 13,
    padding: 16,
  },
  perplexityFeatureCopy: { flex: 1 },
  perplexityFeatureTitle: { color: 'white', fontSize: 13, fontWeight: '900' },
  perplexityFeatureBody: { color: colors.mint, fontSize: 11, lineHeight: 17, marginTop: 3 },
  footerLegal: { color: colors.muted, fontSize: 10, fontWeight: '700' },
});
