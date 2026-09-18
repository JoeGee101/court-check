import { Stack } from 'expo-router';

import { colors } from '@/constants/theme';

export default function LegalLayout() {
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: colors.cloud },
        headerBackTitle: 'Back',
        headerShadowVisible: true,
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.tealDark,
        headerTitleStyle: { color: colors.ink, fontSize: 17, fontWeight: '800' },
      }}>
      <Stack.Screen name="privacy" options={{ title: 'Privacy Policy' }} />
      <Stack.Screen name="terms" options={{ title: 'Terms of Service' }} />
    </Stack>
  );
}
