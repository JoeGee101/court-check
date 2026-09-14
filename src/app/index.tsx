import { Redirect } from 'expo-router';

import { useAuth } from '@/features/auth/session-provider';

export default function IndexScreen() {
  const { isOnboardingComplete, role, session } = useAuth();

  if (!session) {
    return <Redirect href="/(auth)" />;
  }

  if (!isOnboardingComplete) {
    return <Redirect href="/(auth)/onboarding" />;
  }

  if (role === 'admin') {
    return <Redirect href="/(admin)/admin" />;
  }

  return <Redirect href="/(user)/boards" />;
}
