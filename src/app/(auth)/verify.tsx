import { Redirect, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { AuthButton, AuthFeedback, AuthScreen, authStyles } from '@/features/auth/auth-ui';
import { usePhoneAuth } from '@/features/auth/phone-auth-context';
import { maskPhone, requestPhoneOtp, verifyPhoneOtp } from '@/features/auth/phone-otp';

const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyPhoneScreen() {
  const router = useRouter();
  const { clearVerification, markOtpSent, otpSentAt, phoneE164 } = usePhoneAuth();
  const [token, setToken] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<'error' | 'success'>('error');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [currentTime, setCurrentTime] = useState(otpSentAt ?? 0);
  const operationInFlight = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!phoneE164 || !otpSentAt) {
    return <Redirect href="/(auth)" />;
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
      setFeedback(getErrorMessage(verificationError));
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
    } catch (resendError) {
      setFeedbackTone('error');
      setFeedback(getErrorMessage(resendError));
    } finally {
      operationInFlight.current = false;
      setIsResending(false);
    }
  };

  const handleChangeNumber = () => {
    clearVerification();
    router.replace('/(auth)');
  };

  return (
    <AuthScreen
      description={`Enter the code sent to ${maskPhone(phoneE164)}.`}
      eyebrow="SMS verification"
      title="Enter your code">
      <View style={authStyles.section}>
        <Text style={authStyles.label}>6-digit verification code</Text>
        <TextInput
          accessibilityLabel="6-digit SMS verification code"
          autoComplete="sms-otp"
          editable={!isVerifying && !isResending}
          keyboardType="number-pad"
          maxLength={6}
          onChangeText={(value) => {
            setToken(value.replace(/\D/g, '').slice(0, 6));
            setFeedback(null);
          }}
          onSubmitEditing={() => void handleVerify()}
          placeholder="000000"
          returnKeyType="done"
          style={[authStyles.input, styles.codeInput]}
          textContentType="oneTimeCode"
          value={token}
        />
        <Text style={authStyles.hint}>
          Use the most recent code. Codes expire for your security.
        </Text>
      </View>

      {feedback ? <AuthFeedback tone={feedbackTone}>{feedback}</AuthFeedback> : null}
      <AuthButton
        disabled={token.length !== 6 || isResending}
        isLoading={isVerifying}
        onPress={() => void handleVerify()}
        title="Verify and continue"
      />
      <AuthButton
        disabled={resendSeconds > 0 || isVerifying}
        isLoading={isResending}
        onPress={() => void handleResend()}
        title={resendSeconds > 0 ? `Resend in ${resendSeconds}s` : 'Resend code'}
        variant="secondary"
      />
      <AuthButton
        disabled={isVerifying || isResending}
        onPress={handleChangeNumber}
        title="Change phone number"
        variant="secondary"
      />
    </AuthScreen>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

const styles = StyleSheet.create({
  codeInput: {
    fontSize: 25,
    fontWeight: '700',
    letterSpacing: 10,
    textAlign: 'center',
  },
});
