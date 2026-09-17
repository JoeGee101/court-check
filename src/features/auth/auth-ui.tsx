import type { PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormTopBar } from '@/components/ui/form-top-bar';
import {
  colors,
  controlHeights,
  radii,
  shadows,
  spacing,
  typeScale,
} from '@/constants/theme';

type AuthScreenProps = PropsWithChildren<{
  description: ReactNode;
  eyebrow: string;
  onBack?: () => void;
  progress: number;
  title: string;
}>;

export function AuthScreen({ children, description, eyebrow, onBack, progress, title }: AuthScreenProps) {
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.screen}>
        <FormTopBar onBack={onBack} progress={progress} />
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.introduction}>
            <Text style={styles.eyebrow}>{eyebrow}</Text>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.description}>{description}</Text>
          </View>
          <View style={styles.form}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type AuthButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  variant?: 'primary' | 'secondary' | 'text';
};

export function AuthButton({
  disabled = false,
  isLoading = false,
  onPress,
  title,
  variant = 'primary',
}: AuthButtonProps) {
  const isDisabled = disabled || isLoading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy: isLoading, disabled: isDisabled }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.secondaryButton,
        variant === 'text' && styles.textButton,
        isDisabled && styles.disabledButton,
        pressed && !isDisabled && styles.pressedButton,
      ]}>
      {isLoading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.white : colors.teal} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            variant !== 'primary' && styles.secondaryButtonText,
            variant === 'text' && styles.textButtonText,
          ]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function AuthFeedback({
  children,
  tone = 'error',
}: {
  children: ReactNode;
  tone?: 'error' | 'success' | 'info';
}) {
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[
        styles.feedback,
        tone === 'error' && styles.errorFeedback,
        tone === 'success' && styles.successFeedback,
      ]}>
      <Text
        style={[
          styles.feedbackText,
          tone === 'error' && styles.errorFeedbackText,
          tone === 'success' && styles.successFeedbackText,
        ]}>
        {children}
      </Text>
    </View>
  );
}

export const authStyles = StyleSheet.create({
  label: {
    color: colors.inkMuted,
    fontSize: 12.5,
    fontWeight: '700',
  },
  input: {
    minHeight: controlHeights.default,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    color: colors.ink,
    backgroundColor: colors.card,
    fontSize: typeScale.body,
  },
  hint: {
    color: colors.inkMuted,
    fontSize: typeScale.caption,
    lineHeight: 18,
  },
  section: {
    gap: spacing.sm,
  },
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cloud,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 34,
  },
  introduction: {
    gap: 7,
  },
  eyebrow: {
    color: colors.teal,
    fontSize: typeScale.eyebrow,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.ink,
    fontSize: typeScale.title,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  description: {
    maxWidth: 420,
    color: colors.inkMuted,
    fontSize: typeScale.bodySmall,
    lineHeight: 20,
  },
  form: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    gap: spacing.lg,
    marginTop: 22,
  },
  button: {
    minHeight: controlHeights.default,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.teal,
    ...shadows.button,
  },
  secondaryButton: {
    borderWidth: 1.5,
    borderColor: colors.teal,
    backgroundColor: colors.card,
    shadowOpacity: 0,
    elevation: 0,
  },
  textButton: {
    minHeight: controlHeights.compact,
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  disabledButton: {
    opacity: 0.45,
    shadowOpacity: 0,
    elevation: 0,
  },
  pressedButton: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
  buttonText: {
    color: colors.white,
    fontSize: typeScale.button,
    fontWeight: '800',
  },
  secondaryButtonText: {
    color: colors.teal,
  },
  textButtonText: {
    fontSize: typeScale.bodySmall,
    textDecorationLine: 'underline',
  },
  feedback: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    backgroundColor: colors.card,
  },
  errorFeedback: {
    borderColor: '#E7BBBB',
    backgroundColor: '#FFF3F3',
  },
  successFeedback: {
    borderColor: '#B9DCCB',
    backgroundColor: '#F0F8F4',
  },
  feedbackText: {
    color: colors.inkMuted,
    fontSize: typeScale.bodySmall,
    lineHeight: 20,
    textAlign: 'center',
  },
  errorFeedbackText: {
    color: colors.danger,
  },
  successFeedbackText: {
    color: colors.success,
  },
});
