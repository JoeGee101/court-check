import { Stack } from 'expo-router';

import { useAuth } from '@/features/auth/session-provider';

export default function AuthLayout() {
  const { isOnboardingComplete, session } = useAuth();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="index" />
      </Stack.Protected>
      <Stack.Protected guard={Boolean(session && !isOnboardingComplete)}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
    </Stack>
  );
}
