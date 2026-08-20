import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Beaker,
  Bell,
  CalendarDays,
  Camera,
  FileHeart,
  FileText,
  HeartPulse,
  MapPin,
  MessageCircle,
  Package,
  PhoneCall,
  ShieldCheck,
  Sparkles,
  Stethoscope,
} from 'lucide-react-native';
import { colors, radii, spacing } from '@swasthya/configuration';
import { t } from '@swasthya/localization';
import { ActionCard, Screen, SathiOrb } from '@/components/ui';
import { useAppState } from '@/state/app-state';

export default function HomeScreen() {
  const { language } = useAppState();
  const { width } = useWindowDimensions();
  const wide = width >= 760;

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.brandLockup}>
          <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.mark}>
            <Text style={styles.markText}>म</Text>
          </LinearGradient>
          <View>
            <Text style={styles.kicker}>MERO HEALTH</Text>
            <Text style={styles.brand}>स्वास्थ्य साथी</Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            language === 'en' ? 'Open updates and learning' : 'अपडेट र सिकाइ खोल्नुहोस्'
          }
          onPress={() => router.push('/(tabs)/learn')}
          style={styles.notification}
        >
          <Bell color={colors.ink} size={19} />
          <View style={styles.notificationDot} />
        </Pressable>
      </View>

      <LinearGradient
        colors={[colors.primary, colors.primaryDeep, colors.primaryDark]}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, wide && styles.heroWide]}
      >
        <View style={styles.heroRingOne} />
        <View style={styles.heroRingTwo} />
        <View style={styles.copy}>
          <Text style={styles.label}>
            {language === 'en' ? 'YOUR GUIDED HEALTH COMPANION' : 'तपाईंको मार्गदर्शित स्वास्थ्य साथी'}
          </Text>
          <Text style={styles.title}>{t(language, 'homePrompt')}</Text>
          <Text style={styles.body}>
            {language === 'en'
              ? 'Say it by voice or text. Sathi checks for risk first and helps you choose a useful next step.'
              : 'आवाज वा शब्दमा भन्नुहोस्। साथीले जोखिम पहिले हेर्छ र तपाईंलाई उपयोगी अर्को कदम रोज्न मद्दत गर्छ।'}
          </Text>
          <View style={styles.heroActions}>
            <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/companion')} style={styles.ask}>
              <MessageCircle color={colors.primaryDark} size={18} />
              <Text style={styles.askText}>{t(language, 'ask')}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => router.push('/consultation')} style={styles.video}>
              <Camera color="white" size={18} />
              <Text style={styles.videoText}>
                {language === 'en' ? 'Video consult' : 'भिडियो परामर्श'}
              </Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.orbColumn}>
          <SathiOrb language={language} size={wide ? 126 : 88} />
          <View style={styles.voiceChip}>
            <View style={styles.voicePulse} />
            <Text style={styles.voiceChipText}>
              {language === 'en' ? 'Voice ready' : 'आवाज तयार'}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.contextRow}>
        <View style={styles.contextCard}>
          <View style={styles.contextIcon}>
            <CalendarDays color={colors.primary} size={19} />
          </View>
          <View style={styles.contextCopy}>
            <Text style={styles.contextLabel}>{language === 'en' ? 'TODAY' : 'आज'}</Text>
            <Text style={styles.contextTitle}>
              {language === 'en' ? 'No upcoming care' : 'आगामी कुनै सेवा छैन'}
            </Text>
          </View>
        </View>
        <View style={styles.contextCard}>
          <View style={[styles.contextIcon, styles.contextIconAlt]}>
            <MapPin color={colors.info} size={19} />
          </View>
          <View style={styles.contextCopy}>
            <Text style={styles.contextLabel}>
              {language === 'en' ? 'CARE NETWORK' : 'सेवा सञ्जाल'}
            </Text>
            <Text style={styles.contextTitle}>
              {language === 'en' ? 'Explore verified demo listings' : 'प्रमाणित डेमो सूची हेर्नुहोस्'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.sectionHead}>
        <View>
          <Text style={styles.sectionEyebrow}>
            {language === 'en' ? 'ONE PLACE, CLEAR NEXT STEPS' : 'एउटै ठाउँ, स्पष्ट अर्को कदम'}
          </Text>
          <Text style={styles.section}>
            {language === 'en' ? 'What do you need?' : 'तपाईंलाई के चाहिन्छ?'}
          </Text>
        </View>
        <Text style={styles.sectionHint}>
          {language === 'en' ? 'Tap any card to explore' : 'हेर्न कुनै पनि कार्ड थिच्नुहोस्'}
        </Text>
      </View>

      <View style={[styles.actions, wide && styles.actionsWide]}>
        <View style={styles.actionColumn}>
          <ActionCard
            badge={language === 'en' ? 'AVAILABLE' : 'उपलब्ध'}
            icon={Stethoscope}
            onPress={() => router.push('/(tabs)/care')}
            subtitle={
              language === 'en'
                ? 'Doctors, hospitals and home service'
                : 'डाक्टर, अस्पताल र घरमै सेवा'
            }
            title={t(language, 'doctor')}
          />
          <ActionCard
            badge={language === 'en' ? 'PATIENT-CONTROLLED' : 'बिरामी-नियन्त्रित'}
            icon={FileHeart}
            onPress={() => router.push('/(tabs)/twin')}
            subtitle={
              language === 'en'
                ? 'Your health picture, one step at a time'
                : 'एक–एक कदममा आफ्नो स्वास्थ्य चित्र'
            }
            title={t(language, 'record')}
            tone="jade"
          />
          <ActionCard
            badge={language === 'en' ? 'GUIDED PREVIEW' : 'मार्गदर्शित पूर्वावलोकन'}
            icon={Beaker}
            onPress={() => router.push('/(tabs)/learn')}
            subtitle={
              language === 'en'
                ? 'Lessons on tests, prep and results'
                : 'जाँच, तयारी र नतिजा बुझ्ने पाठ'
            }
            title={t(language, 'lab')}
            tone="forest"
          />
          <ActionCard
            badge={language === 'en' ? 'PHOTOGRAPH & CONFIRM' : 'फोटो खिच्नुहोस् र पुष्टि गर्नुहोस्'}
            icon={FileText}
            onPress={() => router.push('/records')}
            subtitle={
              language === 'en'
                ? 'Photograph a lab report or prescription to add it'
                : 'ल्याब रिपोर्ट वा प्रेस्क्रिप्सन खिचेर थप्नुहोस्'
            }
            title={t(language, 'documents')}
          />
        </View>
        <View style={styles.actionColumn}>
          <ActionCard
            badge={language === 'en' ? 'VIDEO ROOM' : 'भिडियो कोठा'}
            icon={Camera}
            onPress={() => router.push('/consultation')}
            subtitle={
              language === 'en' ? 'See the camera and call controls' : 'क्यामेरा र कल नियन्त्रण हेर्नुहोस्'
            }
            title={language === 'en' ? 'Talk over video' : 'भिडियोमा कुरा गर्नुहोस्'}
            tone="forest"
          />
          <ActionCard
            badge={language === 'en' ? 'WORKFLOW PREVIEW' : 'प्रक्रिया पूर्वावलोकन'}
            icon={Package}
            onPress={() => router.push('/(tabs)/learn')}
            subtitle={
              language === 'en'
                ? 'From prescription to pharmacy, the process'
                : 'प्रेस्क्रिप्सनबाट फार्मेसीसम्मको प्रक्रिया'
            }
            title={t(language, 'medicines')}
            tone="warm"
          />
          <ActionCard
            badge={language === 'en' ? 'SAFETY INTERRUPT' : 'सुरक्षा अवरोध'}
            icon={PhoneCall}
            onPress={() =>
              router.push({ pathname: '/(tabs)/companion', params: { demo: 'emergency' } })
            }
            subtitle={
              language === 'en' ? 'Immediate steps for serious signs' : 'गम्भीर संकेतका लागि तुरुन्त कदम'
            }
            title={t(language, 'emergency')}
            tone="danger"
          />
        </View>
      </View>

      <View style={[styles.healthStory, wide && styles.healthStoryWide]}>
        <View style={styles.healthStoryIcon}>
          <HeartPulse color="white" size={26} />
        </View>
        <View style={styles.healthStoryCopy}>
          <Text style={styles.healthStoryKicker}>
            {language === 'en' ? 'YOUR HEALTH STORY' : 'तपाईंको स्वास्थ्य कथा'}
          </Text>
          <Text style={styles.healthStoryTitle}>
            {language === 'en'
              ? 'A useful picture grows one confirmed fact at a time.'
              : 'उपयोगी चित्र एक–एक पुष्टि भएको तथ्यबाट बन्छ।'}
          </Text>
          <Text style={styles.healthStoryBody}>
            {language === 'en'
              ? 'No mysterious score. No prediction pretending to be certainty. You can skip, correct, and control future sharing.'
              : 'कुनै रहस्यमय अंक छैन। निश्चितताको नक्कल गर्ने भविष्यवाणी छैन। तपाईं छोड्न, सच्याउन र भविष्यको साझेदारी नियन्त्रण गर्न सक्नुहुन्छ।'}
          </Text>
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/twin')} style={styles.storyButton}>
          <Sparkles color={colors.primaryDark} size={17} />
          <Text style={styles.storyButtonText}>
            {language === 'en' ? 'Build my picture' : 'मेरो चित्र बनाउनुहोस्'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.trust}>
        <ShieldCheck color={colors.primary} size={22} />
        <View style={styles.trustCopy}>
          <Text style={styles.trustTitle}>
            {language === 'en' ? 'Sathi is not a doctor' : 'साथी डाक्टर होइन'}
          </Text>
          <Text style={styles.trustBody}>
            {language === 'en'
              ? 'It helps you find information, preparation and services. Diagnosis, treatment and prescriptions are done by authorised health workers.'
              : 'जानकारी, तयारी र सेवा खोज्न मद्दत गर्छ। निदान, उपचार र प्रेस्क्रिप्सन अधिकृत स्वास्थ्यकर्मीले गर्छन्।'}
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  brandLockup: { alignItems: 'center', flexDirection: 'row', gap: 11 },
  mark: { alignItems: 'center', borderRadius: 14, height: 46, justifyContent: 'center', width: 46 },
  markText: { color: 'white', fontSize: 22, fontWeight: '900' },
  kicker: { color: colors.primary, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  brand: { color: colors.ink, fontSize: 20, fontWeight: '900', marginTop: 1 },
  notification: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 19,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    position: 'relative',
    width: 46,
  },
  notificationDot: {
    backgroundColor: colors.danger,
    borderColor: 'white',
    borderRadius: 5,
    borderWidth: 2,
    height: 9,
    position: 'absolute',
    right: 8,
    top: 8,
    width: 9,
  },
  hero: {
    borderRadius: 30,
    gap: spacing.lg,
    overflow: 'hidden',
    padding: spacing.xl,
    position: 'relative',
  },
  heroWide: { alignItems: 'center', flexDirection: 'row', minHeight: 330, padding: spacing.xxl },
  heroRingOne: {
    borderColor: 'rgba(169,223,201,.16)',
    borderRadius: 170,
    borderWidth: 1,
    height: 340,
    position: 'absolute',
    right: -80,
    top: -110,
    width: 340,
  },
  heroRingTwo: {
    borderColor: 'rgba(244,166,42,.12)',
    borderRadius: 110,
    borderWidth: 1,
    height: 220,
    position: 'absolute',
    right: -10,
    top: -20,
    width: 220,
  },
  copy: { flex: 1, gap: spacing.sm, zIndex: 1 },
  label: { color: colors.mintStrong, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: 'white', fontSize: 31, fontWeight: '900', letterSpacing: -0.8, lineHeight: 38 },
  body: { color: colors.mint, fontSize: 13, lineHeight: 21, maxWidth: 600 },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: spacing.sm },
  ask: {
    alignItems: 'center',
    backgroundColor: colors.mint,
    borderRadius: 15,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 50,
    paddingHorizontal: spacing.lg,
  },
  askText: { color: colors.primaryDark, fontWeight: '900' },
  video: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,.12)',
    borderColor: 'rgba(255,255,255,.18)',
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 50,
    paddingHorizontal: spacing.lg,
  },
  videoText: { color: 'white', fontSize: 12, fontWeight: '900' },
  orbColumn: { alignItems: 'center', gap: spacing.md, zIndex: 1 },
  voiceChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(3,33,36,.48)',
    borderRadius: radii.pill,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  voicePulse: { backgroundColor: colors.irisBright, borderRadius: 4, height: 7, width: 7 },
  voiceChipText: { color: colors.mint, fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  contextRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  contextCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 19,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minWidth: 250,
    padding: spacing.md,
  },
  contextIcon: {
    alignItems: 'center',
    backgroundColor: colors.mint,
    borderRadius: 15,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  contextIconAlt: { backgroundColor: colors.mintFaint },
  contextCopy: { flex: 1 },
  contextLabel: { color: colors.muted, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  contextTitle: { color: colors.ink, fontSize: 12, fontWeight: '800', marginTop: 3 },
  sectionHead: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between' },
  sectionEyebrow: { color: colors.primary, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  section: { color: colors.ink, fontSize: 25, fontWeight: '900', marginTop: 4 },
  sectionHint: { color: colors.muted, fontSize: 10 },
  actions: { gap: spacing.md },
  actionsWide: { flexDirection: 'row' },
  actionColumn: { flex: 1, gap: spacing.md },
  healthStory: {
    backgroundColor: colors.mintFaint,
    borderRadius: radii.lg,
    gap: spacing.md,
    padding: spacing.xl,
  },
  healthStoryWide: { alignItems: 'center', flexDirection: 'row' },
  healthStoryIcon: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 22,
    height: 60,
    justifyContent: 'center',
    width: 60,
  },
  healthStoryCopy: { flex: 1 },
  healthStoryKicker: { color: colors.info, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  healthStoryTitle: { color: colors.ink, fontSize: 18, fontWeight: '900', marginTop: 5 },
  healthStoryBody: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 6 },
  storyButton: {
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 15,
    flexDirection: 'row',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
  },
  storyButtonText: { color: colors.primaryDark, fontSize: 12, fontWeight: '900' },
  trust: {
    alignItems: 'flex-start',
    backgroundColor: colors.mint,
    borderRadius: radii.lg,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
  },
  trustCopy: { flex: 1 },
  trustTitle: { color: colors.primaryDark, fontWeight: '900' },
  trustBody: { color: colors.primaryDark, fontSize: 12, lineHeight: 19, marginTop: 4 },
});
