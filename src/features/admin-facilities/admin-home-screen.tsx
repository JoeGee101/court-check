import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useAdminFacilities } from '@/features/admin-facilities/use-admin-facilities';
import { useAuth } from '@/features/auth/session-provider';
import { useDeleteAccount } from '@/features/profile/use-delete-account';

export function AdminHomeScreen() {
  const router = useRouter();
  const { error: accountError, signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const signOutInFlight = useRef(false);
  const {
    error: facilityLoadError,
    facilities,
    isInitialLoading: isLoadingFacilities,
    refreshOnFocus,
  } = useAdminFacilities();
  const {
    deleteAccountError,
    isDeletingAccount,
    requestDeleteAccount,
  } = useDeleteAccount({ blocked: isSigningOut });
  const facilityCounts = useMemo(
    () => ({
      active: facilities.filter((facility) => facility.is_active).length,
      total: facilities.length,
    }),
    [facilities],
  );

  useFocusEffect(
    useCallback(() => {
      void refreshOnFocus();
    }, [refreshOnFocus]),
  );

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
          <View style={styles.managementCard}>
            <View style={styles.managementHeader}>
              <View style={styles.managementIcon}>
                <CourtCheckSymbol android="location_city" color={colors.teal} ios="building.2" size={25} />
              </View>
              <View style={styles.managementCopy}>
                <Text style={styles.managementTitle}>Facilities</Text>
                <Text style={styles.managementDescription}>
                  Review court information and control player availability.
                </Text>
              </View>
            </View>

            <View style={styles.facilityStats}>
              <FacilityStat
                label="Total facilities"
                loading={isLoadingFacilities}
                unavailable={Boolean(facilityLoadError)}
                value={facilityCounts.total}
              />
              <View style={styles.statDivider} />
              <FacilityStat
                label="Active for players"
                loading={isLoadingFacilities}
                unavailable={Boolean(facilityLoadError)}
                value={facilityCounts.active}
              />
            </View>

            {facilityLoadError && !isLoadingFacilities ? (
              <Text accessibilityLiveRegion="polite" style={styles.summaryError}>
                Facility summary unavailable. Open Facilities to retry.
              </Text>
            ) : null}

            <View style={styles.managementActions}>
              <Pressable
                accessibilityHint="Opens facility management"
                accessibilityRole="button"
                accessibilityState={{ disabled: isDeletingAccount }}
                disabled={isDeletingAccount}
                onPress={() => router.push('/(admin)/admin/facilities')}
                style={({ pressed }) => [
                  styles.manageButton,
                  isDeletingAccount && styles.disabled,
                  pressed && !isDeletingAccount && styles.pressed,
                ]}>
                <Text style={styles.manageButtonText}>Manage</Text>
                <CourtCheckSymbol android="arrow_forward" color={colors.white} ios="arrow.right" size={17} />
              </Pressable>
              <Pressable
                accessibilityLabel="Create Facility"
                accessibilityRole="button"
                accessibilityState={{ disabled: isDeletingAccount }}
                disabled={isDeletingAccount}
                onPress={() => router.push('/(admin)/admin/facilities/new')}
                style={({ pressed }) => [
                  styles.createButton,
                  isDeletingAccount && styles.disabled,
                  pressed && !isDeletingAccount && styles.pressed,
                ]}>
                <CourtCheckSymbol android="add" color={colors.tealDark} ios="plus" size={17} />
                <Text style={styles.createButtonText}>Create Facility</Text>
              </Pressable>
            </View>
          </View>

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

          <View style={styles.accountSection}>
            <Text style={styles.sectionLabel}>Account</Text>
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
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function FacilityStat({
  label,
  loading,
  unavailable,
  value,
}: {
  label: string;
  loading: boolean;
  unavailable: boolean;
  value: number;
}) {
  return (
    <View style={styles.facilityStat}>
      {loading ? (
        <ActivityIndicator color={colors.teal} size="small" />
      ) : unavailable ? (
        <Text style={styles.statValue}>—</Text>
      ) : (
        <Text style={styles.statValue}>{value}</Text>
      )}
      <Text style={styles.statLabel}>{label}</Text>
    </View>
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
  body: { minHeight: 560, flex: 1, gap: spacing.lg, padding: spacing.xl },
  sectionLabel: {
    color: colors.inkMuted,
    fontSize: typeScale.eyebrow,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  managementCard: {
    gap: spacing.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.xl,
    backgroundColor: colors.card,
    ...shadows.card,
  },
  managementHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
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
  facilityStats: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingVertical: spacing.xs,
    borderRadius: radii.lg,
    backgroundColor: colors.tealTint,
  },
  facilityStat: { minWidth: 0, flex: 1, alignItems: 'center', justifyContent: 'center' },
  statDivider: { width: StyleSheet.hairlineWidth, backgroundColor: '#B7D8D5' },
  statValue: { color: colors.tealDark, fontSize: 24, fontWeight: '900', fontVariant: ['tabular-nums'] },
  statLabel: { marginTop: 3, color: colors.inkMuted, fontSize: 11.5, fontWeight: '700' },
  summaryError: { color: colors.danger, fontSize: 12, lineHeight: 17, textAlign: 'center' },
  managementActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  manageButton: {
    minHeight: controlHeights.default,
    flex: 1,
    minWidth: 124,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.teal,
  },
  manageButtonText: { color: colors.white, fontSize: 13.5, fontWeight: '900' },
  createButton: {
    minHeight: controlHeights.default,
    minWidth: 132,
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.teal,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
  },
  createButtonText: { color: colors.tealDark, fontSize: 13.5, fontWeight: '900' },
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
  accountSection: { gap: spacing.md, marginTop: spacing.lg, paddingTop: spacing.lg },
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
