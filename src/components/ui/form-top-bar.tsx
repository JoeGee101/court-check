import { Pressable, StyleSheet, View } from 'react-native';

import { CourtCheckSymbol } from '@/components/ui/courtcheck-symbol';
import { colors, controlHeights, radii } from '@/constants/theme';

export function FormTopBar({ onBack, progress }: { onBack?: () => void; progress: number }) {
  const normalizedProgress = Math.min(1, Math.max(0, progress));

  return (
    <View style={styles.topBar}>
      {onBack ? (
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          hitSlop={4}
          onPress={onBack}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <CourtCheckSymbol android="chevron_left" color={colors.ink} ios="chevron.left" size={18} />
        </Pressable>
      ) : null}
      <View
        accessibilityLabel={`${Math.round(normalizedProgress * 100)} percent complete`}
        accessibilityRole="progressbar"
        accessibilityValue={{
          max: 100,
          min: 0,
          now: Math.round(normalizedProgress * 100),
        }}
        style={styles.track}>
        <View style={[styles.fill, { width: `${normalizedProgress * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 8,
  },
  backButton: {
    width: controlHeights.compact,
    height: controlHeights.compact,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radii.sm,
    backgroundColor: colors.card,
  },
  pressed: {
    opacity: 0.7,
  },
  track: {
    height: 4,
    flex: 1,
    overflow: 'hidden',
    borderRadius: 2,
    backgroundColor: colors.line,
  },
  fill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: colors.teal,
  },
});
