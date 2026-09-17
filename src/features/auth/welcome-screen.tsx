import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandMark } from "@/components/ui/brand-mark";
import { colors, radii, spacing } from "@/constants/theme";

export function WelcomeScreen() {
  const router = useRouter();
  const { height: windowHeight } = useWindowDimensions();
  const safeAreaInsets = useSafeAreaInsets();
  const [courtDrift] = useState(() => new Animated.Value(0));
  const safeContentHeight =
    windowHeight - safeAreaInsets.top - safeAreaInsets.bottom;
  const courtHeight = Math.max(320, Math.min(540, safeContentHeight - 218));

  useEffect(() => {
    let isMounted = true;
    let courtAnimation: Animated.CompositeAnimation | null = null;

    const configureMotion = (reduceMotion: boolean) => {
      courtAnimation?.stop();
      courtDrift.stopAnimation();

      if (reduceMotion) {
        courtDrift.setValue(0);
        return;
      }

      courtAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(courtDrift, {
            duration: 10000,
            easing: Easing.inOut(Easing.sin),
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.timing(courtDrift, {
            duration: 10000,
            easing: Easing.inOut(Easing.sin),
            toValue: 0,
            useNativeDriver: true,
          }),
        ]),
      );
      courtAnimation.start();
    };

    void AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (isMounted) {
        configureMotion(reduceMotion);
      }
    });
    const reduceMotionSubscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      configureMotion,
    );

    return () => {
      isMounted = false;
      courtAnimation?.stop();
      courtDrift.stopAnimation();
      reduceMotionSubscription.remove();
    };
  }, [courtDrift]);

  const courtTransform = {
    transform: [
      {
        translateY: courtDrift.interpolate({
          inputRange: [0, 1],
          outputRange: [-1, 2],
        }),
      },
    ],
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.content}>
        <CourtLines
          animatedStyle={courtTransform}
          height={courtHeight}
          top={safeAreaInsets.top + 54}
        />
        <View style={[styles.branding, { top: safeAreaInsets.top + 34 }]}>
          <BrandMark />
          <Text accessibilityRole="header" style={styles.wordmark}>
            CourtCheck
          </Text>
          <Text style={styles.statement}>
            See who&apos;s playing before you go. Real courts, real headcounts,
            zero invites needed.
          </Text>
        </View>

        <View style={[styles.footer, { bottom: safeAreaInsets.bottom + 18 }]}>
          <View accessibilityElementsHidden style={styles.dots}>
            <View style={styles.activeDot} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/(auth)/phone")}
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.buttonText}>Get started</Text>
          </Pressable>
          <View accessibilityElementsHidden style={styles.footerReserve} />
        </View>
      </View>
    </View>
  );
}

function CourtLines({
  animatedStyle,
  height,
  top,
}: {
  animatedStyle: object;
  height: number;
  top: number;
}) {
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.courtArt, { height, top }, animatedStyle]}
    >
      <View style={styles.courtBoundary} />
      <View style={styles.centerLine} />
      <View style={styles.centerNet} />
      <View style={styles.kitchenTop} />
      <View style={styles.kitchenBottom} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: colors.tealDark,
  },
  content: {
    flex: 1,
  },
  branding: {
    position: "absolute",
    right: 32,
    left: 32,
    alignItems: "center",
  },
  wordmark: {
    marginTop: 18,
    color: colors.white,
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -0.68,
    lineHeight: 41,
    textAlign: "center",
  },
  statement: {
    maxWidth: 260,
    marginTop: 10,
    color: "rgba(255,255,255,0.78)",
    fontSize: 15,
    lineHeight: 22.5,
    textAlign: "center",
  },
  footer: {
    position: "absolute",
    right: 32,
    left: 32,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
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
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  button: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.white,
    shadowColor: "#052E2E",
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
    fontSize: 15,
    fontWeight: "800",
  },
  footerReserve: {
    height: 44,
  },
  courtArt: {
    position: "absolute",
    right: 40,
    left: 40,
    opacity: 0.16,
  },
  courtBoundary: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderWidth: 3,
    borderColor: colors.white,
  },
  centerLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: "50%",
    width: 3,
    marginLeft: -1.5,
    backgroundColor: colors.white,
  },
  centerNet: {
    position: "absolute",
    top: "50%",
    right: 0,
    left: 0,
    height: 3,
    marginTop: -1.5,
    backgroundColor: colors.white,
  },
  kitchenTop: {
    position: "absolute",
    top: "29.63%",
    right: 0,
    left: 0,
    height: 2,
    backgroundColor: colors.white,
  },
  kitchenBottom: {
    position: "absolute",
    right: 0,
    bottom: "29.63%",
    left: 0,
    height: 2,
    backgroundColor: colors.white,
  },
});
