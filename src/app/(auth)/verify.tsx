import { Redirect, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, controlHeights, radii, spacing, typeScale } from '@/constants/theme';
import { AuthButton, AuthFeedback, AuthScreen } from '@/features/auth/auth-ui';
import { usePhoneAuth } from '@/features/auth/phone-auth-context';
import { maskPhone, requestPhoneOtp, verifyPhoneOtp } from '@/features/auth/phone-otp';

const RESEND_COOLDOWN_SECONDS = 60;
const SAFE_VERIFICATION_ERRORS = new Set([
  'Enter the complete 6-digit code.',
  'That code is invalid or expired. Request a new code and try again.',
  'Too many verification attempts. Wait a moment before trying again.',
  'Too many code requests. Wait a moment before trying again.',
  'We could not send a verification code. Check the number and try again.',
]);

export default function VerifyPhoneScreen() {
  const router = useRouter();
  const { clearVerification, markOtpSent, otpSentAt, phoneE164 } = usePhoneAuth();
  const inputRef = useRef<TextInput>(null);
  const [token, setToken] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<'error' | 'success'>('error');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [currentTime, setCurrentTime] = useState(otpSentAt ?? 0);
  const operationInFlight = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!phoneE164 || !otpSentAt) {
    return <Redirect href="/(auth)/phone" />;
  }

  const resendSeconds = Math.max(
    0,
    Math.ceil((otpSentAt + RESEND_COOLDOWN_SECONDS * 1000 - currentTime) / 1000),
  );

  const handleVerify = async () => {
    if (operationInFlight.current) {
      return;
    }

    if (!/^\d{6}$/.test(token)) {
      setFeedbackTone('error');
      setFeedback('Enter the complete 6-digit code.');
      return;
    }

    operationInFlight.current = true;
    setIsVerifying(true);
    setFeedback(null);

    try {
      await verifyPhoneOtp(phoneE164, token);
      setFeedbackTone('success');
      setFeedback('Phone verified. Loading your account…');
    } catch (verificationError) {
      setFeedbackTone('error');
      setFeedback(getSafeVerificationError(verificationError));
    } finally {
      operationInFlight.current = false;
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (operationInFlight.current || resendSeconds > 0) {
      return;
    }

    operationInFlight.current = true;
    setIsResending(true);
    setFeedback(null);

    try {
      await requestPhoneOtp(phoneE164);
      markOtpSent();
      setCurrentTime(Date.now());
      setToken('');
      setFeedbackTone('success');
      setFeedback('A new verification code was sent.');
      inputRef.current?.focus();
    } catch (resendError) {
      setFeedbackTone('error');
      setFeedback(getSafeVerificationError(resendError));
    } finally {
      operationInFlight.current = false;
      setIsResending(false);
    }
  };

  const handleChangeNumber = () => {
    clearVerification();
    router.replace('/(auth)/phone');
  };

  return (
    <AuthScreen
      description={`Sent to ${maskPhone(phoneE164)}. Use the most recent code.`}
      eyebrow="SMS verification"
      onBack={handleChangeNumber}
      progress={2 / 3}
      title="Enter your code">
      <View style={styles.codeSection}>
        <Text style={styles.fieldLabel}>6-digit verification code</Text>
        <Pressable
          accessible={false}
          onPress={() => inputRef.current?.focus()}
          style={styles.otpRow}>
          {Array.from({ length: 6 }, (_, index) => {
            const isActiveCell = isInputFocused && index === Math.min(token.length, 5);
            return (
              <View
                key={index}
                style={[
                  styles.otpCell,
                  isActiveCell && styles.activeOtpCell,
                  token[index] && styles.filledOtpCell,
                ]}>
                <Text style={styles.otpDigit}>{token[index] ?? ''}</Text>
              </View>
            );
          })}
          <TextInput
            ref={inputRef}
            accessibilityLabel="6-digit SMS verification code"
            autoComplete="sms-otp"
            autoFocus
            caretHidden
            editable={!isVerifying && !isResending}
            keyboardType="number-pad"
            maxLength={6}
            onBlur={() => setIsInputFocused(false)}
            onChangeText={(value) => {
              setToken(value.replace(/\D/g, '').slice(0, 6));
              setFeedback(null);
            }}
            onFocus={() => setIsInputFocused(true)}
            onSubmitEditing={() => void handleVerify()}
            returnKeyType="done"
            style={styles.hiddenInput}
            textContentType="oneTimeCode"
            value={token}
          />
        </Pressable>
        <Text style={styles.securityHint}>Codes expire for your security.</Text>
      </View>

      <View style={styles.secondaryActions}>
        <Text style={styles.secondaryPrompt}>Didn&apos;t get it?</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy: isResending, disabled: resendSeconds > 0 || isVerifying }}
          disabled={resendSeconds > 0 || isVerifying}
          hitSlop={8}
          onPress={() => void handleResend()}
          style={({ pressed }) => pressed && styles.pressed}>
          <Text style={[styles.actionLink, resendSeconds > 0 && styles.disabledLink]}>
            {isResending
              ? 'Sending…'
              : resendSeconds > 0
                ? `Resend in ${resendSeconds}s`
                : 'Resend code'}
          </Text>
        </Pressable>
        <View style={styles.actionDivider} />
        <Pressable
          accessibilityRole="button"
          disabled={isVerifying || isResending}
          hitSlop={8}
          onPress={handleChangeNumber}
          style={({ pressed }) => pressed && styles.pressed}>
          <Text style={styles.actionLink}>Change number</Text>
        </Pressable>
      </View>

      {feedback ? <AuthFeedback tone={feedbackTone}>{feedback}</AuthFeedback> : null}
      <AuthButton
        disabled={token.length !== 6 || isResending}
        isLoading={isVerifying}
        onPress={() => void handleVerify()}
        title="Verify and continue"
      />
    </AuthScreen>
  );
}

function getSafeVerificationError(error: unknown) {
  if (error instanceof Error && SAFE_VERIFICATION_ERRORS.has(error.message)) {
    return error.message;
  }
  return 'We could not verify that code. Request a new code and try again.';
}

const styles = StyleSheet.create({
  codeSection: {
    gap: spacing.sm,
  },
  fieldLabel: {
    color: colors.inkMuted,
    fontSize: 12.5,
    fontWeight: '700',
  },
  otpRow: {
    position: 'relative',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  otpCell: {
    minWidth: 0,
    maxWidth: 48,
    height: 56,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radii.md,
    backgroundColor: colors.card,
  },
  activeOtpCell: {
    borderColor: colors.teal,
  },
  filledOtpCell: {
    borderColor: '#B9D6D3',
  },
  otpDigit: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    color: 'transparent',
    opacity: 0.02,
  },
  securityHint: {
    color: colors.inkMuted,
    fontSize: typeScale.caption,
    lineHeight: 18,
  },
  secondaryActions: {
    minHeight: controlHeights.compact,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryPrompt: {
    color: colors.inkMuted,
    fontSize: typeScale.bodySmall,
  },
  actionLink: {
    color: colors.teal,
    fontSize: typeScale.bodySmall,
    fontWeight: '800',
  },
  disabledLink: {
    color: '#879492',
  },
  actionDivider: {
    width: 1,
    height: 15,
    marginHorizontal: 2,
    backgroundColor: colors.line,
  },
  pressed: {
    opacity: 0.6,
  },
});
