import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@swasthya/configuration';
import type { LanguageCode } from '@swasthya/shared-types';

/**
 * Split out of `ui.tsx` on purpose: it is the only reanimated-driven export
 * there with no `lucide-react-native` import anywhere in its own module —
 * that import fails to load under `react-test-renderer` + vitest today
 * (deep-imports `react-native/Libraries/...` paths Node's package-exports
 * map blocks outside Metro). That made it the second component this repo's
 * render-test harness could exercise end-to-end, after `Pill` — see
 * `SathiOrb.test.tsx` and `apps/mobile/vitest.config.ts`.
 */
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

const styles = StyleSheet.create({
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
});
