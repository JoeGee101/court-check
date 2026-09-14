import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Button, StyleSheet, Text, View } from 'react-native';

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
    return <SessionMessage message="Loading your CourtCheck session…" />;
  }

  if (session && error && !profile) {
    return (
      <SessionMessage message={error} title="Unable to load your account">
        <Button onPress={refreshProfile} title="Try again" />
        <Button onPress={() => void signOut()} title="Sign out" />
      </SessionMessage>
    );
  }

  const hasCompletedAccount = Boolean(session && isOnboardingComplete && role);

  return (
    <>
      <Stack initialRouteName="index" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
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

type SessionMessageProps = React.PropsWithChildren<{
  message: string;
  title?: string;
}>;

function SessionMessage({ children, message, title = 'CourtCheck' }: SessionMessageProps) {
  return (
    <View style={styles.sessionMessage}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  sessionMessage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    backgroundColor: '#F3F7F6',
  },
  title: {
    color: '#16263D',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    maxWidth: 360,
    color: '#5B6B7C',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
});
