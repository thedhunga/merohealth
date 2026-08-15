import 'react-native-reanimated';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppStateProvider, useAppState } from '@/state/app-state';
import { colors } from '@swasthya/configuration';
import { t } from '@swasthya/localization';

/**
 * Split out of `RootLayout` so it can call `useAppState()` — `RootLayout`
 * itself renders `AppStateProvider`, so its own render scope sits outside
 * the context and can never read `language`.
 */
function RootStack() {
  const { language } = useAppState();
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          title: t(language, 'appTitle'),
          headerShown: false,
          contentStyle: { backgroundColor: colors.canvas },
        }}
      />
    </>
  );
}

export default function RootLayout() {
  return (
    <AppStateProvider>
      <RootStack />
    </AppStateProvider>
  );
}
