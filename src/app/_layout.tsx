import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text } from 'react-native';

import { BrandedState } from '@/components/ui/branded-state';
import { colors, controlHeights, radii } from '@/constants/theme';
import { SessionProvider, useAuth } from '@/features/auth/session-provider';

export default function RootLayout() {
  return (
    <SessionProvider>
      <RootNavigator />
    </SessionProvider>
  );
}

function RootNavigator() {
  const {
    error,
    isLoading,
    isOnboardingComplete,
    profile,
    refreshProfile,
    role,
    session,
    signOut,
  } = useAuth();

  if (isLoading) {
    return (
      <BrandedState
        isLoading
        message="Restoring your secure session…"
        title="CourtCheck"
      />
    );
  }

  if (session && error && !profile) {
    return (
      <BrandedState
        actionLabel="Try again"
        message="We couldn’t load your account. Check your connection and try again."
        onAction={refreshProfile}
        title="Unable to load your account">
        <Pressable
          accessibilityRole="button"
          onPress={() => void signOut()}
          style={({ pressed }) => [styles.signOutButton, pressed && styles.pressed]}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </BrandedState>
    );
  }

  const hasCompletedAccount = Boolean(session && isOnboardingComplete && role);

  return (
    <>
      <Stack initialRouteName="index" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="legal" />
        <Stack.Protected guard={!session || !hasCompletedAccount}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={hasCompletedAccount && role === 'admin'}>
          <Stack.Screen name="(admin)" />
        </Stack.Protected>
        <Stack.Protected guard={hasCompletedAccount}>
          <Stack.Screen name="(user)" />
        </Stack.Protected>
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}

const styles = StyleSheet.create({
  signOutButton: {
    minWidth: 180,
    minHeight: controlHeights.compact,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.teal,
    borderRadius: radii.lg,
    paddingHorizontal: 20,
  },
  signOutText: {
    color: colors.teal,
    fontSize: 14,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.7,
  },
});
