import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/ui/brand-mark';
import { colors, controlHeights, radii, spacing, typeScale } from '@/constants/theme';

export function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.darkAccent} />
      <CourtLines />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.branding}>
          <BrandMark />
          <Text accessibilityRole="header" style={styles.wordmark}>
            CourtCheck
          </Text>
          <Text style={styles.statement}>
            See who&apos;s playing before you go. Real courts, real headcounts, zero invites needed.
          </Text>
        </View>

        <View style={styles.footer}>
          <View accessibilityElementsHidden style={styles.dots}>
            <View style={styles.activeDot} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/(auth)/phone')}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
            <Text style={styles.buttonText}>Get started</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

function CourtLines() {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.courtArt}>
      <View style={styles.courtBoundary} />
      <View style={styles.centerLine} />
      <View style={styles.centerNet} />
      <View style={styles.kitchenTop} />
      <View style={styles.kitchenBottom} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: colors.teal,
  },
  darkAccent: {
    position: 'absolute',
    right: -150,
    bottom: -180,
    width: 470,
    height: 560,
    borderRadius: 260,
    backgroundColor: colors.tealDeep,
    opacity: 0.5,
    transform: [{ rotate: '-12deg' }],
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingTop: 44,
    paddingBottom: 26,
  },
  branding: {
    alignItems: 'center',
    paddingTop: 12,
  },
  wordmark: {
    marginTop: 18,
    color: colors.white,
    fontSize: typeScale.display,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  statement: {
    maxWidth: 280,
    marginTop: 10,
    color: 'rgba(255,255,255,0.8)',
    fontSize: typeScale.body,
    lineHeight: 23,
    textAlign: 'center',
  },
  footer: {
    width: '100%',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 20,
  },
  activeDot: {
    width: 18,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.white,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  button: {
    minHeight: controlHeights.default,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.white,
    shadowColor: '#052E2E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 4,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  buttonText: {
    color: colors.tealDark,
    fontSize: typeScale.button,
    fontWeight: '800',
  },
  courtArt: {
    position: 'absolute',
    top: 60,
    right: 38,
    bottom: 70,
    left: 38,
    opacity: 0.15,
  },
  courtBoundary: {
    position: 'absolute',
    top: 10,
    right: 0,
    bottom: 10,
    left: 0,
    borderWidth: 3,
    borderColor: colors.white,
  },
  centerLine: {
    position: 'absolute',
    top: 10,
    bottom: 10,
    left: '50%',
    width: 3,
    marginLeft: -1.5,
    backgroundColor: colors.white,
  },
  centerNet: {
    position: 'absolute',
    top: '50%',
    right: 0,
    left: 0,
    height: 3,
    marginTop: -1.5,
    backgroundColor: colors.white,
  },
  kitchenTop: {
    position: 'absolute',
    top: '29%',
    right: 0,
    left: 0,
    height: 2,
    backgroundColor: colors.white,
  },
  kitchenBottom: {
    position: 'absolute',
    right: 0,
    bottom: '29%',
    left: 0,
    height: 2,
    backgroundColor: colors.white,
  },
});
