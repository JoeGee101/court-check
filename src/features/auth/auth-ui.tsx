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

type AuthScreenProps = PropsWithChildren<{
  eyebrow: string;
  title?: string;
  description: string;
  compact?: boolean;
}>;

export function AuthScreen({
  children,
  compact = false,
  description,
  eyebrow,
  title,
}: AuthScreenProps) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, compact && styles.compactContent]}
        keyboardShouldPersistTaps="handled">
        <View style={[styles.brandMark, compact && styles.compactBrandMark]}>
          <Text style={styles.brandText}>CC</Text>
        </View>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        <Text style={[styles.description, !title && styles.descriptionWithoutTitle]}>
          {description}
        </Text>
        <View style={[styles.card, compact && styles.compactCard]}>{children}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type AuthButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  variant?: 'primary' | 'secondary';
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
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.secondaryButton,
        isDisabled && styles.disabledButton,
        pressed && !isDisabled && styles.pressedButton,
      ]}>
      {isLoading ? (
        <ActivityIndicator color={variant === 'primary' ? '#FFFFFF' : '#0E7C7C'} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            variant === 'secondary' && styles.secondaryButtonText,
          ]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function AuthFeedback({ children, tone = 'error' }: {
  children: ReactNode;
  tone?: 'error' | 'success' | 'info';
}) {
  return (
    <Text
      accessibilityLiveRegion="polite"
      style={[
        styles.feedback,
        tone === 'error' && styles.errorFeedback,
        tone === 'success' && styles.successFeedback,
      ]}>
      {children}
    </Text>
  );
}

export const authStyles = StyleSheet.create({
  label: {
    color: '#16263D',
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#C8D5D3',
    borderRadius: 12,
    paddingHorizontal: 16,
    color: '#16263D',
    backgroundColor: '#FFFFFF',
    fontSize: 17,
  },
  hint: {
    color: '#667684',
    fontSize: 13,
    lineHeight: 19,
  },
  section: {
    gap: 10,
  },
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#EAF5F3',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  compactContent: {
    paddingVertical: 32,
  },
  brandMark: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    borderRadius: 18,
    backgroundColor: '#0E7C7C',
    marginBottom: 18,
  },
  brandText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  compactBrandMark: {
    width: 48,
    height: 48,
    borderRadius: 16,
    marginBottom: 16,
  },
  eyebrow: {
    color: '#D76735',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 8,
    color: '#16263D',
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
  },
  description: {
    alignSelf: 'center',
    maxWidth: 420,
    marginTop: 10,
    color: '#5B6B7C',
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center',
  },
  descriptionWithoutTitle: {
    maxWidth: 340,
    marginTop: 12,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    gap: 18,
    marginTop: 28,
    padding: 22,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    shadowColor: '#16263D',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 2,
  },
  compactCard: {
    gap: 16,
    marginTop: 24,
    padding: 0,
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  button: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingHorizontal: 18,
    backgroundColor: '#0E7C7C',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#0E7C7C',
    backgroundColor: '#FFFFFF',
  },
  disabledButton: {
    opacity: 0.45,
  },
  pressedButton: {
    opacity: 0.82,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButtonText: {
    color: '#0E7C7C',
  },
  feedback: {
    color: '#5B6B7C',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  errorFeedback: {
    color: '#A63232',
  },
  successFeedback: {
    color: '#24704D',
  },
});
