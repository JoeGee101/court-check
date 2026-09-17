import { useRouter } from 'expo-router';
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
          <ActivityIndicator color="#0E7C7C" size="large" />
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
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {getUsernameInitials(profile.anonymous_username)}
              </Text>
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
                style={[styles.emailInput, !hasValidEmail && styles.invalidInput]}
                textContentType="emailAddress"
                value={form.email}
              />
              <Text style={[styles.fieldHint, !hasValidEmail && styles.validationText]}>
                {hasValidEmail
                  ? 'Used only as optional contact information, not for sign-in.'
                  : 'Enter a valid email address or leave this field blank.'}
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Account</Text>
              <View style={styles.accountCard}>
                <AccountRow label="Verified phone" value={maskPhone(user?.phone)} />
                <AccountRow
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
              {isSaving ? <ActivityIndicator color="#FFFFFF" size="small" /> : null}
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
              {isSigningOut ? <ActivityIndicator color="#A9451C" size="small" /> : null}
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
  isLast = false,
  label,
  value,
}: {
  isLast?: boolean;
  label: string;
  value: string;
}) {
  return (
    <View style={[styles.accountRow, isLast && styles.lastAccountRow]}>
      <Text style={styles.accountLabel}>{label}</Text>
      <Text style={styles.accountValue}>{value}</Text>
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
    backgroundColor: '#F3F7F6',
  },
  scrollContent: {
    paddingBottom: 42,
  },
  hero: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 34,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    backgroundColor: '#0E7C7C',
  },
  avatar: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.42)',
    borderRadius: 38,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  username: {
    marginTop: 14,
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '800',
    textAlign: 'center',
  },
  levelBadge: {
    marginTop: 9,
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  levelBadgeText: {
    color: '#FFFFFF',
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
    gap: 24,
    paddingHorizontal: 20,
    paddingTop: 26,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: '#16263D',
    fontSize: 16,
    fontWeight: '800',
  },
  sectionDescription: {
    color: '#667684',
    fontSize: 13,
    lineHeight: 19,
  },
  experienceOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  experienceOption: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#C8D5D3',
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  selectedExperienceOption: {
    borderColor: '#D76735',
    backgroundColor: '#FFF1EA',
  },
  experienceOptionText: {
    color: '#425466',
    fontSize: 14,
    fontWeight: '700',
  },
  selectedExperienceOptionText: {
    color: '#A9451C',
  },
  fieldLabel: {
    color: '#425466',
    fontSize: 13,
    fontWeight: '700',
  },
  emailInput: {
    minHeight: 52,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#C8D5D3',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    color: '#16263D',
    fontSize: 16,
  },
  invalidInput: {
    borderColor: '#C85D5D',
  },
  fieldHint: {
    color: '#667684',
    fontSize: 12,
    lineHeight: 18,
  },
  validationText: {
    color: '#9B3D3D',
  },
  accountCard: {
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#D8E3E1',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  accountRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D8E3E1',
  },
  lastAccountRow: {
    borderBottomWidth: 0,
  },
  accountLabel: {
    color: '#16263D',
    fontSize: 14,
    fontWeight: '700',
  },
  accountValue: {
    flexShrink: 1,
    color: '#667684',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
  },
  feedback: {
    marginTop: -6,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    textAlign: 'center',
  },
  successFeedback: {
    color: '#24704D',
  },
  errorFeedback: {
    color: '#9B3D3D',
  },
  saveButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderRadius: 16,
    backgroundColor: '#D76735',
    shadowColor: '#D76735',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 2,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  adminButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: '#0E7C7C',
  },
  adminButtonText: {
    color: '#FFFFFF',
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
    borderColor: '#DDB9AA',
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
  },
  signOutButtonText: {
    color: '#A9451C',
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
  unavailableTitle: {
    color: '#16263D',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  unavailableBody: {
    color: '#667684',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
});
