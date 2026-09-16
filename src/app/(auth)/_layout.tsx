import { Stack } from 'expo-router';

import { PhoneAuthProvider } from '@/features/auth/phone-auth-context';
import { useAuth } from '@/features/auth/session-provider';

export default function AuthLayout() {
  const { isOnboardingComplete, session } = useAuth();

  return (
    <PhoneAuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="index" />
          <Stack.Screen name="verify" />
        </Stack.Protected>
        <Stack.Protected guard={Boolean(session && !isOnboardingComplete)}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
      </Stack>
    </PhoneAuthProvider>
  );
}
