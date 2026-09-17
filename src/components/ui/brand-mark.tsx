import { StyleSheet, View } from 'react-native';

import { colors, radii } from '@/constants/theme';

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.tile, compact && styles.compactTile]}>
      <View style={[styles.ball, compact && styles.compactBall]}>
        {DOTS.map((position, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              compact && styles.compactDot,
              { left: position.left, top: position.top },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const DOTS = [
  { left: '28%' as const, top: '28%' as const },
  { left: '62%' as const, top: '28%' as const },
  { left: '45%' as const, top: '45%' as const },
  { left: '28%' as const, top: '62%' as const },
  { left: '62%' as const, top: '62%' as const },
];

const styles = StyleSheet.create({
  tile: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: radii.brand,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  compactTile: {
    width: 48,
    height: 48,
    borderColor: colors.teal,
    borderRadius: 15,
    backgroundColor: colors.tealTint,
  },
  ball: {
    width: 38,
    height: 38,
    borderWidth: 1.8,
    borderColor: colors.white,
    borderRadius: 19,
  },
  compactBall: {
    width: 26,
    height: 26,
    borderColor: colors.teal,
    borderRadius: 13,
  },
  dot: {
    position: 'absolute',
    width: 4,
    height: 4,
    marginLeft: -2,
    marginTop: -2,
    borderRadius: 2,
    backgroundColor: colors.white,
  },
  compactDot: {
    width: 3,
    height: 3,
    marginLeft: -1.5,
    marginTop: -1.5,
    backgroundColor: colors.teal,
  },
});

