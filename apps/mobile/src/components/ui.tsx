import { useEffect } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type PressableProps,
  type ScrollViewProps,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight } from 'lucide-react-native';
import { colors, radii, spacing } from '@swasthya/configuration';
import type { LanguageCode } from '@swasthya/shared-types';
import type { LucideIcon } from 'lucide-react-native';

export function Screen({ children, contentContainerStyle, ...props }: ScrollViewProps) {
  const { width } = useWindowDimensions();
  return (
    <ScrollView
      contentContainerStyle={[
        styles.screen,
        { paddingHorizontal: width >= 720 ? spacing.xxl : spacing.lg },
        contentContainerStyle,
      ]}
      showsVerticalScrollIndicator={false}
      {...props}
    >
      {children}
    </ScrollView>
  );
}

export function SathiOrb({ language, size = 68 }: { language: LanguageCode; size?: number }) {
  const progress = useSharedValue(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!reduced) {
      progress.value = withRepeat(
        withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
    }
  }, [progress, reduced]);

  const animated = useAnimatedStyle(() => ({
    transform: [
      { translateY: reduced ? 0 : progress.value * -7 },
      { scale: reduced ? 1 : 1 + progress.value * 0.035 },
      { rotate: `${reduced ? 0 : progress.value * 2}deg` },
    ],
  }));

  return (
    <Animated.View
      accessible
      accessibilityLabel={language === 'en' ? 'Swasthya Sathi companion' : 'स्वास्थ्य साथी'}
      style={[styles.orbWrap, { height: size, width: size }, animated]}
    >
      <View
        style={[
          styles.orbOuterRing,
          {
            borderRadius: size / 2,
            height: size,
            width: size,
          },
        ]}
      />
      <LinearGradient
        colors={[colors.saffronSoft, colors.mintStrong, colors.primarySoft]}
        end={{ x: 1, y: 1 }}
        style={[
          styles.orb,
          {
            borderRadius: size / 2,
            height: size * 0.78,
            left: size * 0.11,
            top: size * 0.11,
            width: size * 0.78,
          },
        ]}
      >
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          style={[
            styles.orbCore,
            {
              borderRadius: size,
              height: size * 0.34,
              width: size * 0.34,
            },
          ]}
        />
        <View
          style={[
            styles.orbHighlight,
            {
              borderRadius: size,
              height: size * 0.13,
              right: size * 0.16,
              top: size * 0.13,
              width: size * 0.13,
            },
          ]}
        />
      </LinearGradient>
    </Animated.View>
  );
}

interface ActionCardProps extends PressableProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  tone?: 'default' | 'danger' | 'warm' | 'forest' | 'jade';
  badge?: string;
}

export function ActionCard({
  icon: Icon,
  title,
  subtitle,
  tone = 'default',
  badge,
  ...props
}: ActionCardProps) {
  // Five tones, all within the forest/jade/marigold family — the previous
  // 'blue'/'violet' names mapped to off-brand hues the health-tech-blue rule
  // forbids, so the tones were renamed to match what they actually render.
  const palette =
    tone === 'danger'
      ? [colors.dangerSoft, colors.danger]
      : tone === 'warm'
        ? [colors.saffronSoft, colors.saffronDeep]
        : tone === 'forest'
          ? [colors.mintFaint, colors.primaryDeep]
          : tone === 'jade'
            ? [colors.mintStrong, colors.info]
            : [colors.mint, colors.primary];

  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.actionCard,
        { backgroundColor: palette[0], opacity: pressed ? 0.76 : 1 },
      ]}
      {...props}
    >
      <View style={[styles.actionIcon, { borderColor: `${palette[1]}18` }]}>
        <Icon color={palette[1]} size={23} strokeWidth={2.1} />
      </View>
      <View style={styles.actionText}>
        {badge ? <Text style={[styles.actionBadge, { color: palette[1] }]}>{badge}</Text> : null}
        <Text style={styles.actionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.actionSubtitle}>{subtitle}</Text> : null}
      </View>
      <ChevronRight color={palette[1]} size={18} />
    </Pressable>
  );
}

// Moved to its own file, `Pill.tsx` — see that file's doc comment for why.
export { Pill } from './Pill';

export function SectionTitle({
  eyebrow,
  title,
  body,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
}) {
  return (
    <View style={styles.sectionTitle}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.h2}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
    </View>
  );
}

export const uiStyles = StyleSheet.create({
  h1: {
    color: colors.ink,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1.1,
    lineHeight: 43,
  },
  body: { color: colors.muted, fontSize: 16, lineHeight: 25 },
  label: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.xl,
    shadowColor: colors.primaryDark,
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: spacing.xl,
    shadowColor: colors.primary,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
  },
  primaryButtonText: { color: 'white', fontSize: 16, fontWeight: '900' },
});

const styles = StyleSheet.create({
  screen: {
    alignSelf: 'center',
    backgroundColor: colors.canvas,
    flexGrow: 1,
    gap: spacing.xl,
    maxWidth: 1180,
    paddingBottom: 124,
    paddingTop: spacing.xl,
    width: '100%',
  },
  orbWrap: { position: 'relative' },
  orbOuterRing: {
    borderColor: 'rgba(169,223,201,.35)',
    borderWidth: 1,
    position: 'absolute',
  },
  orb: {
    alignItems: 'center',
    elevation: 4,
    justifyContent: 'center',
    position: 'absolute',
    shadowColor: colors.primary,
    shadowOffset: { height: 9, width: 0 },
    shadowOpacity: 0.23,
    shadowRadius: 22,
  },
  orbCore: { alignItems: 'center', justifyContent: 'center' },
  orbHighlight: { backgroundColor: 'rgba(255,255,255,.8)', position: 'absolute' },
  actionCard: {
    alignItems: 'center',
    borderRadius: 20,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 92,
    padding: spacing.lg,
  },
  actionIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,.78)',
    borderRadius: 17,
    borderWidth: 1,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  actionText: { flex: 1, gap: 3 },
  actionBadge: { fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  actionTitle: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  actionSubtitle: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  sectionTitle: { gap: spacing.sm },
  eyebrow: { color: colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  h2: { color: colors.ink, fontSize: 28, fontWeight: '900', letterSpacing: -0.7, lineHeight: 35 },
  body: { color: colors.muted, fontSize: 15, lineHeight: 23 },
});
