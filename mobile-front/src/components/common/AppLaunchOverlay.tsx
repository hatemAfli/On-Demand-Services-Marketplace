// src/components/common/AppLaunchOverlay.tsx

import React, { useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTranslation } from "../../hooks/useAppTranslation";
import { COLORS } from "../../constants";

const BRAND = "ServeMe";
const ACCENT = "#C9A84C";
const ACCENT_SOFT = "#E8C97A";

export const AppLaunchOverlay: React.FC = () => {
  const { t, isRTL } = useAppTranslation();
  const insets = useSafeAreaInsets();

  const letters = useMemo(() => BRAND.split(""), []);
  const letterProgress = useRef(letters.map(() => new Animated.Value(0))).current;
  const underlineScale = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const orbPulse = useRef(new Animated.Value(0.4)).current;
  const orbRotate = useRef(new Animated.Value(0)).current;
  const dot1 = useRef(new Animated.Value(0.35)).current;
  const dot2 = useRef(new Animated.Value(0.35)).current;
  const dot3 = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const letterStagger = Animated.stagger(
      52,
      letterProgress.map((v) =>
        Animated.spring(v, {
          toValue: 1,
          friction: 7,
          tension: 90,
          useNativeDriver: true,
        }),
      ),
    );

    const afterLetters = Animated.parallel([
      Animated.timing(underlineScale, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 420,
        delay: 120,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);

    Animated.sequence([letterStagger, afterLetters]).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(orbPulse, {
          toValue: 0.75,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(orbPulse, {
          toValue: 0.4,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();

    const rotationLoop = Animated.loop(
      Animated.timing(orbRotate, {
        toValue: 1,
        duration: 14000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    rotationLoop.start();

    const stagger = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, {
            toValue: 1,
            duration: 340,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0.35,
            duration: 340,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      );

    const a1 = stagger(dot1, 0);
    const a2 = stagger(dot2, 130);
    const a3 = stagger(dot3, 260);
    a1.start();
    a2.start();
    a3.start();

    return () => {
      pulse.stop();
      rotationLoop.stop();
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [
    letters.length,
    letterProgress,
    underlineScale,
    taglineOpacity,
    orbPulse,
    orbRotate,
    dot1,
    dot2,
    dot3,
  ]);

  const orbSpin = orbRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={["#FFFFFF", "#F8FAFC", "#EEF2FF"]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <Animated.View
        style={[
          styles.orb,
          {
            opacity: orbPulse,
            transform: [{ rotate: orbSpin }],
          },
        ]}
      />

      <View style={styles.center}>
        <View
          style={[styles.brandRow, isRTL && styles.brandRowRtl]}
          accessibilityRole="text"
        >
          {letters.map((ch, i) => {
            const p = letterProgress[i];
            const opacity = p!;
            const translateY = opacity.interpolate({
              inputRange: [0, 1],
              outputRange: [18, 0],
            });
            const isAccent = i >= letters.length - 2;
            return (
              <Animated.Text
                key={`${ch}-${i}`}
                style={[
                  styles.brandLetter,
                  isAccent && styles.brandLetterAccent,
                  {
                    opacity,
                    transform: [{ translateY }],
                  },
                ]}
              >
                {ch}
              </Animated.Text>
            );
          })}
        </View>

        <View style={styles.underlineWrap}>
          <Animated.View
            style={[
              styles.underline,
              {
                transform: [{ scaleX: underlineScale }],
              },
            ]}
          />
        </View>

        <Animated.Text
          style={[
            styles.tagline,
            isRTL && styles.rtlText,
            { opacity: taglineOpacity },
          ]}
        >
          {t("welcome.tagline")}
        </Animated.Text>
      </View>

      <View
        style={[
          styles.footer,
          { paddingBottom: Math.max(insets.bottom, 16) + 8 },
        ]}
      >
        <View style={styles.dotsRow}>
          <Animated.View style={[styles.dot, { opacity: dot1 }]} />
          <Animated.View style={[styles.dot, { opacity: dot2 }]} />
          <Animated.View style={[styles.dot, { opacity: dot3 }]} />
        </View>
        <Text style={[styles.loading, isRTL && styles.rtlText]}>
          {t("common.loading")}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: Platform.OS === "android" ? 9999 : 0,
    justifyContent: "center",
    alignItems: "center",
  },
  orb: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(99, 102, 241, 0.08)",
    top: "22%",
  },
  center: {
    alignItems: "center",
    paddingHorizontal: 32,
    maxWidth: 360,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    flexWrap: "nowrap",
  },
  brandRowRtl: {
    /* Brand word stays LTR */
    direction: "ltr",
  },
  brandLetter: {
    fontSize: 44,
    fontWeight: "800",
    color: COLORS.primary,
    letterSpacing: -0.5,
    fontFamily: Platform.OS === "ios" ? "System" : "sans-serif",
  },
  brandLetterAccent: {
    color: ACCENT,
  },
  underlineWrap: {
    width: 200,
    height: 4,
    marginTop: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  underline: {
    width: "100%",
    height: 4,
    borderRadius: 2,
    backgroundColor: ACCENT_SOFT,
  },
  tagline: {
    marginTop: 20,
    fontSize: 16,
    color: COLORS.text.secondary,
    textAlign: "center",
    lineHeight: 24,
    fontWeight: "500",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  dotsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  loading: {
    fontSize: 14,
    color: COLORS.text.tertiary,
    fontWeight: "500",
  },
  rtlText: {
    writingDirection: "rtl",
    textAlign: "center",
  },
});
