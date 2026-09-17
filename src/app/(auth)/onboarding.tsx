import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { CourtCheckSymbol } from '@/components/ui/courtcheck-symbol';
import { colors, controlHeights, radii, typeScale } from '@/constants/theme';
import { AuthButton, AuthFeedback, AuthScreen, authStyles } from '@/features/auth/auth-ui';
import { useAuth } from '@/features/auth/session-provider';
import { completeOnboarding } from '@/features/onboarding/complete-onboarding';
import type { ExperienceLevel } from '@/types/user';

const EXPERIENCE_LEVELS: readonly { label: string; value: ExperienceLevel }[] = [
  { label: 'Newbie', value: 'newbie' },
  { label: 'Beginner', value: 'beginner' },
  { label: 'Intermediate', value: 'intermediate' },
  { label: 'Advanced', value: 'advanced' },
  { label: 'Pro', value: 'pro' },
];

export default function OnboardingScreen() {
  const { error: accountError, profile, refreshProfile, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [hasConfirmedAdult, setHasConfirmedAdult] = useState(false);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const submissionInFlight = useRef(false);
  const signOutInFlight = useRef(false);

  const handleComplete = async () => {
    if (submissionInFlight.current) {
      return;
    }

    if (!hasConfirmedAdult) {
      setFeedback('You must confirm that you are 18 or older.');
      return;
    }

    if (!experienceLevel) {
      setFeedback('Choose your experience level.');
      return;
    }

    if (email.trim() && !isValidEmail(email)) {
      setFeedback('Enter a valid email address or leave it blank.');
      return;
    }

    submissionInFlight.current = true;
    setIsSubmitting(true);
    setFeedback(null);

    try {
      await completeOnboarding({
        email: email.trim() || null,
        experienceLevel,
      });
      refreshProfile();
    } catch {
      setFeedback('We could not complete your account. Please try again.');
    } finally {
      submissionInFlight.current = false;
      setIsSubmitting(false);
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
      setFeedback('We could not sign you out. Please try again.');
    } finally {
      signOutInFlight.current = false;
      setIsSigningOut(false);
    }
  };

  return (
    <AuthScreen
      description="Other players see only your CourtCheck username and experience level — never your phone number."
      eyebrow="Account setup"
      progress={1}
      title="You're anonymous on the board">
      <View style={styles.revealCard}>
        <Text style={styles.username}>{profile?.anonymous_username ?? 'Creating your name…'}</Text>
        <Text style={styles.generatedLabel}>System-generated · can&apos;t be changed</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>What&apos;s your experience level?</Text>
        <View accessibilityRole="radiogroup" style={styles.options}>
          {EXPERIENCE_LEVELS.map((option) => {
            const isSelected = experienceLevel === option.value;

            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected, disabled: isSubmitting }}
                disabled={isSubmitting || isSigningOut}
                key={option.value}
                onPress={() => {
                  setExperienceLevel(option.value);
                  setFeedback(null);
                }}
                style={({ pressed }) => [
                  styles.option,
                  isSelected && styles.selectedOption,
                  pressed && styles.pressed,
                ]}>
                <Text style={[styles.optionText, isSelected && styles.selectedOptionText]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.emailLabelRow}>
          <Text style={authStyles.label}>Contact email</Text>
          <Text style={styles.optionalLabel}>Optional</Text>
        </View>
        <TextInput
          accessibilityLabel="Optional contact email address"
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          editable={!isSubmitting && !isSigningOut}
          keyboardType="email-address"
          onChangeText={(value) => {
            setEmail(value);
            setFeedback(null);
          }}
          placeholder="you@example.com"
          placeholderTextColor="#879492"
          returnKeyType="done"
          style={authStyles.input}
          textContentType="emailAddress"
          value={email}
        />
        <Text style={authStyles.hint}>Used only as optional contact information, not for sign-in.</Text>
      </View>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: hasConfirmedAdult, disabled: isSubmitting }}
        disabled={isSubmitting || isSigningOut}
        onPress={() => {
          setHasConfirmedAdult((isConfirmed) => !isConfirmed);
          setFeedback(null);
        }}
        style={styles.checkboxRow}>
        <View style={[styles.checkbox, hasConfirmedAdult && styles.checkedCheckbox]}>
          {hasConfirmedAdult ? (
            <CourtCheckSymbol android="check" color={colors.white} ios="checkmark" size={13} />
          ) : null}
        </View>
        <Text style={styles.checkboxLabel}>
          I confirm that I am <Text style={styles.adultEmphasis}>18 years of age or older</Text>.
        </Text>
      </Pressable>

      {feedback ? <AuthFeedback>{feedback}</AuthFeedback> : null}
      {!feedback && accountError ? (
        <AuthFeedback>We could not refresh your account. Please try again.</AuthFeedback>
      ) : null}
      <AuthButton
        disabled={!hasConfirmedAdult || !experienceLevel || isSigningOut}
        isLoading={isSubmitting}
        onPress={() => void handleComplete()}
        title="Show me nearby courts"
      />
      <AuthButton
        disabled={isSubmitting}
        isLoading={isSigningOut}
        onPress={() => void handleSignOut()}
        title="Sign out"
        variant="text"
      />
    </AuthScreen>
  );
}

function isValidEmail(value: string) {
  const normalizedEmail = value.trim();
  return normalizedEmail.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
}

const styles = StyleSheet.create({
  revealCard: {
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 18,
    paddingVertical: 24,
    borderWidth: 1.5,
    borderColor: colors.teal,
    borderRadius: radii.xl,
    backgroundColor: colors.tealTint,
  },
  username: {
    color: colors.tealDark,
    fontSize: 23,
    fontWeight: '800',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  generatedLabel: {
    color: colors.inkMuted,
    fontSize: typeScale.caption,
    lineHeight: 17,
    textAlign: 'center',
  },
  section: {
    gap: 9,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  option: {
    minHeight: controlHeights.compact,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radii.pill,
    paddingHorizontal: 15,
    backgroundColor: colors.card,
  },
  selectedOption: {
    borderColor: colors.teal,
    backgroundColor: colors.teal,
  },
  optionText: {
    color: colors.inkMuted,
    fontSize: 13.5,
    fontWeight: '700',
  },
  selectedOptionText: {
    color: colors.white,
  },
  emailLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionalLabel: {
    color: colors.inkMuted,
    fontSize: typeScale.caption,
  },
  checkboxRow: {
    minHeight: controlHeights.compact,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    borderWidth: 1.5,
    borderColor: colors.inkMuted,
    borderRadius: 5,
    backgroundColor: colors.card,
  },
  checkedCheckbox: {
    borderColor: colors.teal,
    backgroundColor: colors.teal,
  },
  checkboxLabel: {
    flex: 1,
    color: colors.inkMuted,
    fontSize: 13.5,
    lineHeight: 20,
  },
  adultEmphasis: {
    color: colors.ink,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.72,
  },
});
