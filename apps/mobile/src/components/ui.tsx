import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type PressableProps, type ScrollViewProps } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radii, spacing } from '@swasthya/configuration';
import type { LucideIcon } from 'lucide-react-native';
export function Screen({ children, ...props }: ScrollViewProps) {
  return <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false} {...props}>{children}</ScrollView>;
}
export function SathiOrb({ size = 68 }: { size?: number }) {
  const progress = useSharedValue(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!reduced) progress.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [progress, reduced]);
  const animated = useAnimatedStyle(() => ({ transform: [{ translateY: reduced ? 0 : progress.value * -6 }, { scale: reduced ? 1 : 1 + progress.value * 0.035 }] }));
  return <Animated.View accessible accessibilityLabel="Swasthya Sathi companion" style={[{ width: size, height: size }, animated]}>
    <LinearGradient colors={[colors.saffronSoft, colors.mintStrong]} style={[styles.orb, { width: size, height: size, borderRadius: size / 2 }]}>
      <View style={[styles.orbCore, { width: size * 0.46, height: size * 0.46, borderRadius: size }]} />
    </LinearGradient>
  </Animated.View>;
}
interface ActionCardProps extends PressableProps { icon: LucideIcon; title: string; subtitle?: string; tone?: 'default' | 'danger' | 'warm' }
export function ActionCard({ icon: Icon, title, subtitle, tone = 'default', ...props }: ActionCardProps) {
  const palette = tone === 'danger' ? [colors.dangerSoft, colors.danger] : tone === 'warm' ? [colors.saffronSoft, '#8A5A00'] : [colors.mint, colors.primary];
  return <Pressable accessibilityRole="button" style={({ pressed }) => [styles.actionCard, { backgroundColor: palette[0], opacity: pressed ? 0.72 : 1 }]} {...props}>
    <View style={styles.actionIcon}><Icon color={palette[1]} size={22} strokeWidth={2.2} /></View>
    <View style={styles.actionText}><Text style={styles.actionTitle}>{title}</Text>{subtitle ? <Text style={styles.actionSubtitle}>{subtitle}</Text> : null}</View>
  </Pressable>;
}
export function Pill({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.pill, selected && styles.pillSelected]}><Text style={[styles.pillText, selected && styles.pillTextSelected]}>{label}</Text></Pressable>;
}
export function SectionTitle({ eyebrow, title, body }: { eyebrow?: string; title: string; body?: string }) {
  return <View style={styles.sectionTitle}>{eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}<Text style={styles.h2}>{title}</Text>{body ? <Text style={styles.body}>{body}</Text> : null}</View>;
}
export const uiStyles = StyleSheet.create({
  h1: { color: colors.ink, fontSize: 32, fontWeight: '800', letterSpacing: -0.8, lineHeight: 39 },
  body: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  label: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radii.lg, borderWidth: 1, padding: spacing.lg },
  primaryButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radii.md, minHeight: 52, justifyContent: 'center', paddingHorizontal: spacing.xl },
  primaryButtonText: { color: 'white', fontSize: 16, fontWeight: '800' },
});
const styles = StyleSheet.create({
  screen: { backgroundColor: colors.canvas, flexGrow: 1, gap: spacing.xl, paddingBottom: 112, paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  orb: { alignItems: 'center', elevation: 3, justifyContent: 'center', shadowColor: colors.primary, shadowOpacity: 0.18, shadowRadius: 18 },
  orbCore: { backgroundColor: colors.primary },
  actionCard: { alignItems: 'center', borderRadius: radii.md, flexDirection: 'row', gap: spacing.md, minHeight: 76, padding: spacing.md },
  actionIcon: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.72)', borderRadius: 14, height: 46, justifyContent: 'center', width: 46 },
  actionText: { flex: 1, gap: 3 }, actionTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' }, actionSubtitle: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  pill: { borderColor: colors.line, borderRadius: radii.pill, borderWidth: 1, minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.lg },
  pillSelected: { backgroundColor: colors.primary, borderColor: colors.primary }, pillText: { color: colors.ink, fontWeight: '700' }, pillTextSelected: { color: 'white' },
  sectionTitle: { gap: spacing.sm }, eyebrow: { color: colors.primary, fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  h2: { color: colors.ink, fontSize: 24, fontWeight: '800', letterSpacing: -0.4, lineHeight: 31 }, body: { color: colors.muted, fontSize: 15, lineHeight: 22 },
});
