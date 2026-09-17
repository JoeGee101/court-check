import type { PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/ui/brand-mark';
import { colors, controlHeights, radii, spacing, typeScale } from '@/constants/theme';

type BrandedStateProps = PropsWithChildren<{
  actionLabel?: string;
  isLoading?: boolean;
  message: string;
  onAction?: () => void;
  title: string;
}>;

export function BrandedState({
  actionLabel,
  children,
  isLoading = false,
  message,
  onAction,
  title,
}: BrandedStateProps) {
  return (
    <SafeAreaView style={styles.screen}>
      <View accessibilityLiveRegion="polite" style={styles.content}>
        <BrandMark compact />
        {isLoading ? <ActivityIndicator color={colors.teal} size="large" /> : null}
        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
        </View>
        {actionLabel && onAction ? (
          <Pressable
            accessibilityRole="button"
            onPress={onAction}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
            <Text style={styles.actionText}>{actionLabel}</Text>
          </Pressable>
        ) : null}
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cloud,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    padding: spacing.xxl,
  },
  copy: {
    maxWidth: 360,
    gap: spacing.sm,
  },
  title: {
    color: colors.ink,
    fontSize: typeScale.title,
    fontWeight: '800',
    textAlign: 'center',
  },
  message: {
    color: colors.inkMuted,
    fontSize: typeScale.body,
    lineHeight: 22,
    textAlign: 'center',
  },
  action: {
    minWidth: 180,
    minHeight: controlHeights.default,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    borderRadius: radii.lg,
    backgroundColor: colors.teal,
  },
  actionText: {
    color: colors.white,
    fontSize: typeScale.button,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.82,
  },
});
