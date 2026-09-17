import { useRouter } from 'expo-router';
import type { AndroidSymbol, SFSymbol } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CourtCheckSymbol } from '@/components/ui/courtcheck-symbol';
import { colors, controlHeights, radii, shadows, spacing, typeScale } from '@/constants/theme';
import { useAuth } from '@/features/auth/session-provider';
import { updateMyProfile } from '@/features/profile/profile-api';
import type { CourtCheckProfile, ExperienceLevel } from '@/types/user';

const EXPERIENCE_OPTIONS: readonly { label: string; value: ExperienceLevel }[] = [
  { label: 'Newbie', value: 'newbie' },
  { label: 'Beginner', value: 'beginner' },
  { label: 'Intermediate', value: 'intermediate' },
  { label: 'Advanced', value: 'advanced' },
  { label: 'Pro', value: 'pro' },
];

const EXPERIENCE_LABELS = Object.fromEntries(
  EXPERIENCE_OPTIONS.map((option) => [option.value, option.label]),
) as Record<ExperienceLevel, string>;

type ProfileForm = {
  baselineEmail: string;
  baselineExperienceLevel: ExperienceLevel;
  baselineUpdatedAt: string;
  email: string;
  experienceLevel: ExperienceLevel;
  observedProfileUpdatedAt: string;
};

type Feedback = {
  message: string;
  tone: 'error' | 'success';
};

type SymbolName = {
  android: AndroidSymbol;
  ios: SFSymbol;
};

export function ProfileScreen() {
  const router = useRouter();
  const {
    error: accountError,
    profile,
    refreshProfile,
    role,
    signOut,
    user,
  } = useAuth();
  const [form, setForm] = useState<ProfileForm | null>(() =>
    profile?.experience_level ? createProfileForm(profile) : null,
  );
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const saveInFlight = useRef(false);
  const signOutInFlight = useRef(false);

  const normalizedEmail = normalizeEmail(form?.email ?? '');
  const hasValidEmail = normalizedEmail === null || isValidEmail(normalizedEmail);
  const hasChanges = Boolean(
    form &&
      (form.baselineEmail !== (normalizedEmail ?? '') ||
        form.baselineExperienceLevel !== form.experienceLevel),
  );

  if (
    profile?.experience_level &&
    profile.updated_at !== form?.observedProfileUpdatedAt
  ) {
    if (
      !form ||
      (!hasChanges && !isOlderTimestamp(profile.updated_at, form.baselineUpdatedAt))
    ) {
      setForm(createProfileForm(profile));
    } else {
      setForm({ ...form, observedProfileUpdatedAt: profile.updated_at });
    }
  }

  useEffect(() => {
    if (!signOutInFlight.current || !accountError) {
      return;
    }

    signOutInFlight.current = false;
    setIsSigningOut(false);
    setFeedback({ message: 'Couldn’t sign out. Please try again.', tone: 'error' });
  }, [accountError]);

  const handleSave = async () => {
    if (
      saveInFlight.current ||
      !form ||
      !hasChanges ||
      !hasValidEmail
    ) {
      return;
    }

    saveInFlight.current = true;
    setIsSaving(true);
    setFeedback(null);

    try {
      const updatedProfile = await updateMyProfile({
        email: normalizedEmail,
        experienceLevel: form.experienceLevel,
      });

      setForm(createProfileForm(updatedProfile, profile?.updated_at));
      setFeedback({ message: 'Profile updated.', tone: 'success' });
      refreshProfile();
    } catch {
      setFeedback({ message: 'Couldn’t save your changes. Please try again.', tone: 'error' });
    } finally {
      saveInFlight.current = false;
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    if (signOutInFlight.current) {
      return;
    }

    signOutInFlight.current = true;
    setIsSigningOut(true);
    setFeedback(null);

    try {
      await signOut();
    } catch {
      signOutInFlight.current = false;
      setIsSigningOut(false);
      setFeedback({ message: 'Couldn’t sign out. Please try again.', tone: 'error' });
    }
  };

  if (!profile?.experience_level || !form) {
    return (
      <SafeAreaView style={styles.screen}>
        <View accessibilityLiveRegion="polite" style={styles.unavailableState}>
          <View style={styles.unavailableIcon}>
            <ActivityIndicator color={colors.teal} size="large" />
          </View>
          <Text style={styles.unavailableTitle}>Loading your profile</Text>
          <Text style={styles.unavailableBody}>Getting your latest account details…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentLevelLabel = EXPERIENCE_LABELS[form.baselineExperienceLevel];
  const isSaveDisabled = !hasChanges || !hasValidEmail || isSaving || isSigningOut;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.screen}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <View style={styles.avatarBorder}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {getUsernameInitials(profile.anonymous_username)}
                </Text>
              </View>
            </View>
            <Text style={styles.username}>{profile.anonymous_username}</Text>
            <View style={styles.levelBadge}>
              <Text style={styles.levelBadgeText}>{currentLevelLabel}</Text>
            </View>
            <Text style={styles.usernameNote}>Your CourtCheck-generated player name</Text>
          </View>

          <View style={styles.body}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Experience level</Text>
              <Text style={styles.sectionDescription}>
                Help other players understand your current level.
              </Text>
              <View accessibilityRole="radiogroup" style={styles.experienceOptions}>
                {EXPERIENCE_OPTIONS.map((option) => {
                  const isSelected = form.experienceLevel === option.value;

                  return (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ checked: isSelected, disabled: isSaving }}
                      disabled={isSaving || isSigningOut}
                      key={option.value}
                      onPress={() => {
                        setForm((currentForm) =>
                          currentForm
                            ? { ...currentForm, experienceLevel: option.value }
                            : currentForm,
                        );
                        setFeedback(null);
                      }}
                      style={({ pressed }) => [
                        styles.experienceOption,
                        isSelected && styles.selectedExperienceOption,
                        pressed && !isSaving && styles.pressed,
                      ]}>
                      <Text
                        style={[
                          styles.experienceOptionText,
                          isSelected && styles.selectedExperienceOptionText,
                        ]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Contact</Text>
              <Text style={styles.fieldLabel}>Contact email (optional)</Text>
              <View style={[styles.emailField, !hasValidEmail && styles.invalidInput]}>
                <CourtCheckSymbol android="mail" color={colors.inkMuted} ios="envelope" size={18} />
                <TextInput
                  accessibilityLabel="Optional contact email"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  editable={!isSaving && !isSigningOut}
                  keyboardType="email-address"
                  onChangeText={(value) => {
                    setForm((currentForm) =>
                      currentForm ? { ...currentForm, email: value } : currentForm,
                    );
                    setFeedback(null);
                  }}
                  placeholder="you@example.com"
                  placeholderTextColor="#829099"
                  returnKeyType="done"
                  style={styles.emailInput}
                  textContentType="emailAddress"
                  value={form.email}
                />
              </View>
              <Text style={[styles.fieldHint, !hasValidEmail && styles.validationText]}>
                {hasValidEmail
                  ? 'Used only as optional contact information, not for sign-in.'
                  : 'Enter a valid email address or leave this field blank.'}
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Account</Text>
              <View style={styles.accountCard}>
                <AccountRow
                  icon={{ android: 'phone', ios: 'phone' }}
                  label="Verified phone"
                  value={maskPhone(user?.phone)}
                />
                <AccountRow
                  icon={{ android: 'calendar_month', ios: 'calendar' }}
                  isLast
                  label="Member since"
                  value={formatMemberSince(profile.created_at)}
                />
              </View>
            </View>

            {feedback ? (
              <Text
                accessibilityLiveRegion="polite"
                style={[
                  styles.feedback,
                  feedback.tone === 'success' ? styles.successFeedback : styles.errorFeedback,
                ]}>
                {feedback.message}
              </Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ busy: isSaving, disabled: isSaveDisabled }}
              disabled={isSaveDisabled}
              onPress={() => void handleSave()}
              style={({ pressed }) => [
                styles.saveButton,
                isSaveDisabled && styles.disabledButton,
                pressed && !isSaveDisabled && styles.pressed,
              ]}>
              {isSaving ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <CourtCheckSymbol android="check" color={colors.white} ios="checkmark" size={18} />
              )}
              <Text style={styles.saveButtonText}>
                {isSaving ? 'Saving changes…' : 'Save Changes'}
              </Text>
            </Pressable>

            {role === 'admin' ? (
              <Pressable
                accessibilityHint="Returns to the administrator interface"
                accessibilityRole="button"
                disabled={isSaving || isSigningOut}
                onPress={() => router.replace('/(admin)/admin')}
                style={({ pressed }) => [
                  styles.adminButton,
                  (isSaving || isSigningOut) && styles.disabledButton,
                  pressed && !isSaving && !isSigningOut && styles.pressed,
                ]}>
                <CourtCheckSymbol android="admin_panel_settings" color={colors.tealDark} ios="shield" size={18} />
                <Text style={styles.adminButtonText}>Return to Admin</Text>
              </Pressable>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ busy: isSigningOut, disabled: isSaving || isSigningOut }}
              disabled={isSaving || isSigningOut}
              onPress={() => void handleSignOut()}
              style={({ pressed }) => [
                styles.signOutButton,
                (isSaving || isSigningOut) && styles.disabledButton,
                pressed && !isSaving && !isSigningOut && styles.pressed,
              ]}>
              {isSigningOut ? (
                <ActivityIndicator color={colors.orange} size="small" />
              ) : (
                <CourtCheckSymbol android="logout" color={colors.orange} ios="rectangle.portrait.and.arrow.right" size={18} />
              )}
              <Text style={styles.signOutButtonText}>
                {isSigningOut ? 'Signing out…' : 'Sign Out'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function AccountRow({
  icon,
  isLast = false,
  label,
  value,
}: {
  icon: SymbolName;
  isLast?: boolean;
  label: string;
  value: string;
}) {
  return (
    <View style={[styles.accountRow, isLast && styles.lastAccountRow]}>
      <View style={styles.accountIcon}>
        <CourtCheckSymbol {...icon} color={colors.teal} size={18} />
      </View>
      <View style={styles.accountCopy}>
        <Text style={styles.accountLabel}>{label}</Text>
        <Text style={styles.accountValue}>{value}</Text>
      </View>
    </View>
  );
}

function createProfileForm(
  profile: CourtCheckProfile,
  observedProfileUpdatedAt = profile.updated_at,
): ProfileForm {
  const experienceLevel = profile.experience_level as ExperienceLevel;

  return {
    baselineEmail: profile.email ?? '',
    baselineExperienceLevel: experienceLevel,
    baselineUpdatedAt: profile.updated_at,
    email: profile.email ?? '',
    experienceLevel,
    observedProfileUpdatedAt,
  };
}

function normalizeEmail(value: string): string | null {
  return value.trim() || null;
}

function isValidEmail(value: string): boolean {
  return value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isOlderTimestamp(candidate: string, current: string): boolean {
  const candidateTime = Date.parse(candidate);
  const currentTime = Date.parse(current);
  return Number.isFinite(candidateTime) && Number.isFinite(currentTime) && candidateTime < currentTime;
}

function maskPhone(phone: string | undefined): string {
  const finalDigits = phone?.replace(/\D/g, '').slice(-4);
  return finalDigits ? `•••• ${finalDigits}` : 'Unavailable';
}

function formatMemberSince(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Unavailable';
  }

  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function getUsernameInitials(username: string): string {
  const uppercaseLetters = username.match(/[A-Z]/g)?.slice(0, 2).join('');
  return (uppercaseLetters || username.slice(0, 2)).toUpperCase();
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cloud,
  },
  scrollContent: {
    paddingBottom: 44,
  },
  hero: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: 24,
    paddingBottom: 36,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    backgroundColor: colors.teal,
  },
  avatarBorder: {
    width: 92,
    height: 92,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.55)',
    borderRadius: 46,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  avatar: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  avatarText: {
    color: colors.white,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  username: {
    marginTop: 15,
    color: colors.white,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.25,
    textAlign: 'center',
  },
  levelBadge: {
    marginTop: 9,
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  levelBadgeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '800',
  },
  usernameNote: {
    marginTop: 10,
    color: 'rgba(255, 255, 255, 0.76)',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  body: {
    gap: spacing.xxl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: typeScale.caption,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sectionDescription: {
    color: colors.inkMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  experienceOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  experienceOption: {
    minHeight: controlHeights.compact,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.pill,
    backgroundColor: colors.card,
  },
  selectedExperienceOption: {
    borderColor: colors.teal,
    backgroundColor: colors.teal,
  },
  experienceOptionText: {
    color: colors.inkMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  selectedExperienceOptionText: {
    color: colors.white,
  },
  fieldLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  emailField: {
    minHeight: controlHeights.default,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
  },
  emailInput: {
    minWidth: 0,
    flex: 1,
    paddingVertical: 12,
    color: colors.ink,
    fontSize: 16,
  },
  invalidInput: {
    borderColor: '#C85D5D',
  },
  fieldHint: {
    color: colors.inkMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  validationText: {
    color: colors.danger,
  },
  accountCard: {
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.xl,
    backgroundColor: colors.card,
  },
  accountRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  lastAccountRow: {
    borderBottomWidth: 0,
  },
  accountIcon: {
    width: 36,
    height: 36,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: colors.tealTint,
  },
  accountCopy: {
    minWidth: 0,
    flex: 1,
  },
  accountLabel: {
    color: colors.inkMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  accountValue: {
    marginTop: 3,
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  feedback: {
    marginTop: -6,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    textAlign: 'center',
  },
  successFeedback: {
    color: colors.success,
  },
  errorFeedback: {
    color: colors.danger,
  },
  saveButton: {
    minHeight: controlHeights.default,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderRadius: radii.lg,
    backgroundColor: colors.teal,
    ...shadows.button,
  },
  saveButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '800',
  },
  adminButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.teal,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
  },
  adminButtonText: {
    color: colors.tealDark,
    fontSize: 14,
    fontWeight: '800',
  },
  signOutButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#EDC9B9',
    borderRadius: radii.lg,
    backgroundColor: colors.card,
  },
  signOutButtonText: {
    color: colors.orange,
    fontSize: 14,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.58,
  },
  pressed: {
    opacity: 0.78,
  },
  unavailableState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 24,
  },
  unavailableIcon: {
    width: 62,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 31,
    backgroundColor: colors.tealTint,
  },
  unavailableTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  unavailableBody: {
    color: colors.inkMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
});
