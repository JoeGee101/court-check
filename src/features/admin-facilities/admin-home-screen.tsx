import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/ui/brand-mark';
import { CourtCheckSymbol } from '@/components/ui/courtcheck-symbol';
import { colors, controlHeights, radii, shadows, spacing, typeScale } from '@/constants/theme';
import { useAuth } from '@/features/auth/session-provider';
import { useDeleteAccount } from '@/features/profile/use-delete-account';

export function AdminHomeScreen() {
  const router = useRouter();
  const { error: accountError, signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const signOutInFlight = useRef(false);
  const {
    deleteAccountError,
    isDeletingAccount,
    requestDeleteAccount,
  } = useDeleteAccount({ blocked: isSigningOut });

  useEffect(() => {
    if (!signOutInFlight.current || !accountError) {
      return;
    }

    signOutInFlight.current = false;
    setIsSigningOut(false);
    setSignOutError('Couldn’t sign out. Please try again.');
  }, [accountError]);

  const handleSignOut = async () => {
    if (signOutInFlight.current || isDeletingAccount) {
      return;
    }

    signOutInFlight.current = true;
    setIsSigningOut(true);
    setSignOutError(null);

    try {
      await signOut();
    } catch {
      signOutInFlight.current = false;
      setIsSigningOut(false);
      setSignOutError('Couldn’t sign out. Please try again.');
    }
  };

  const requestSignOut = () => {
    if (signOutInFlight.current || isDeletingAccount) {
      return;
    }

    Alert.alert('Sign out?', 'Are you sure you want to sign out of CourtCheck?', [
      { style: 'cancel', text: 'Cancel' },
      {
        onPress: () => void handleSignOut(),
        style: 'destructive',
        text: 'Sign Out',
      },
    ]);
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <BrandMark />
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>Admin</Text>
            <Text accessibilityRole="header" style={styles.title}>CourtCheck Admin</Text>
            <Text style={styles.subtitle}>
              Keep public court information accurate and available to players.
            </Text>
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.sectionLabel}>Management</Text>
          <Pressable
            accessibilityHint="Opens facility management"
            accessibilityRole="button"
            accessibilityState={{ disabled: isDeletingAccount }}
            disabled={isDeletingAccount}
            onPress={() => router.push('/(admin)/admin/facilities')}
            style={({ pressed }) => [
              styles.managementCard,
              isDeletingAccount && styles.disabled,
              pressed && !isDeletingAccount && styles.pressed,
            ]}>
            <View style={styles.managementIcon}>
              <CourtCheckSymbol android="location_city" color={colors.teal} ios="building.2" size={25} />
            </View>
            <View style={styles.managementCopy}>
              <Text style={styles.managementTitle}>Facilities</Text>
              <Text style={styles.managementDescription}>
                Review court information and control player availability.
              </Text>
            </View>
            <CourtCheckSymbol android="chevron_right" color={colors.inkMuted} ios="chevron.right" size={18} />
          </Pressable>

          <Pressable
            accessibilityHint="Opens the CourtCheck player experience without changing your role"
            accessibilityRole="button"
            accessibilityState={{ disabled: isDeletingAccount }}
            disabled={isDeletingAccount}
            onPress={() => router.push('/(user)/boards')}
            style={({ pressed }) => [
              styles.playerButton,
              isDeletingAccount && styles.disabled,
              pressed && !isDeletingAccount && styles.pressed,
            ]}>
            <CourtCheckSymbol android="sports_tennis" color={colors.tealDark} ios="figure.pickleball" size={19} />
            <Text style={styles.playerButtonText}>Open Player Area</Text>
          </Pressable>

          {deleteAccountError || signOutError ? (
            <Text accessibilityLiveRegion="polite" style={styles.errorText}>
              {deleteAccountError ?? signOutError}
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityState={{
              busy: isSigningOut,
              disabled: isSigningOut || isDeletingAccount,
            }}
            disabled={isSigningOut || isDeletingAccount}
            onPress={requestSignOut}
            style={({ pressed }) => [
              styles.signOutButton,
              (isSigningOut || isDeletingAccount) && styles.disabled,
              pressed && !isSigningOut && !isDeletingAccount && styles.pressed,
            ]}>
            {isSigningOut ? (
              <ActivityIndicator color={colors.orange} size="small" />
            ) : (
              <CourtCheckSymbol android="logout" color={colors.orange} ios="rectangle.portrait.and.arrow.right" size={18} />
            )}
            <Text style={styles.signOutText}>{isSigningOut ? 'Signing out…' : 'Sign Out'}</Text>
          </Pressable>

          <View style={styles.dangerSection}>
            <View style={styles.dangerCopy}>
              <Text style={styles.dangerTitle}>Delete your account</Text>
              <Text style={styles.dangerDescription}>
                Permanently remove your CourtCheck account and access.
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Delete CourtCheck account"
              accessibilityRole="button"
              accessibilityState={{
                busy: isDeletingAccount,
                disabled: isSigningOut || isDeletingAccount,
              }}
              disabled={isSigningOut || isDeletingAccount}
              onPress={() => {
                setSignOutError(null);
                requestDeleteAccount();
              }}
              style={({ pressed }) => [
                styles.deleteAccountButton,
                (isSigningOut || isDeletingAccount) && styles.disabled,
                pressed && !isSigningOut && !isDeletingAccount && styles.pressed,
              ]}>
              {isDeletingAccount ? (
                <ActivityIndicator color={colors.danger} size="small" />
              ) : (
                <CourtCheckSymbol
                  android="delete_forever"
                  color={colors.danger}
                  ios="trash"
                  size={18}
                />
              )}
              <Text style={styles.deleteAccountText}>
                {isDeletingAccount ? 'Deleting account…' : 'Delete Account'}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cloud },
  content: { flexGrow: 1 },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    backgroundColor: colors.tealDark,
  },
  heroCopy: { minWidth: 0, flex: 1 },
  eyebrow: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: typeScale.eyebrow,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: { marginTop: 5, color: colors.white, fontSize: 28, fontWeight: '900' },
  subtitle: { marginTop: 7, color: 'rgba(255,255,255,0.8)', fontSize: 13.5, lineHeight: 19 },
  body: { flex: 1, gap: spacing.lg, padding: spacing.xl },
  sectionLabel: {
    color: colors.inkMuted,
    fontSize: typeScale.eyebrow,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  managementCard: {
    minHeight: 112,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.xl,
    backgroundColor: colors.card,
    ...shadows.card,
  },
  managementIcon: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: colors.tealTint,
  },
  managementCopy: { minWidth: 0, flex: 1 },
  managementTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  managementDescription: { marginTop: 4, color: colors.inkMuted, fontSize: 13, lineHeight: 18 },
  playerButton: {
    minHeight: controlHeights.default,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderWidth: 1.5,
    borderColor: colors.teal,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
  },
  playerButtonText: { color: colors.tealDark, fontSize: typeScale.button, fontWeight: '800' },
  signOutButton: {
    minHeight: controlHeights.default,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderWidth: 1,
    borderColor: '#EDC9BA',
    borderRadius: radii.lg,
    backgroundColor: colors.card,
  },
  signOutText: { color: colors.orange, fontSize: typeScale.button, fontWeight: '800' },
  dangerSection: {
    gap: 12,
    marginTop: spacing.sm,
    paddingTop: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  dangerCopy: { gap: 4 },
  dangerTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  dangerDescription: { color: colors.inkMuted, fontSize: 12, lineHeight: 18 },
  deleteAccountButton: {
    minHeight: controlHeights.default,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderWidth: 1,
    borderColor: '#E7BABA',
    borderRadius: radii.lg,
    backgroundColor: colors.card,
  },
  deleteAccountText: { color: colors.danger, fontSize: typeScale.button, fontWeight: '800' },
  errorText: { color: colors.danger, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.55 },
});
