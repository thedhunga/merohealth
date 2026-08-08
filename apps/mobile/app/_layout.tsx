import 'react-native-reanimated';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppStateProvider } from '@/state/app-state';
import { colors } from '@swasthya/configuration';

export default function RootLayout() {
  return (
    <AppStateProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          title: 'Mero Health - Your health, in your language',
          headerShown: false,
          contentStyle: { backgroundColor: colors.canvas },
        }}
      />
    </AppStateProvider>
  );
}
