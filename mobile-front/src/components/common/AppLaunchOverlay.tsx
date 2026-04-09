// src/components/common/AppLaunchOverlay.tsx

import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CONFIG } from "../../constants/config";
import { useAppTranslation } from "../../hooks/useAppTranslation";

const ACCENT = "#E8C97A";

export const AppLaunchOverlay: React.FC = () => {
  const { t, isRTL } = useAppTranslation();
  const insets = useSafeAreaInsets();
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.88)).current;
  const ringPulse = useRef(new Animated.Value(1)).current;
  const dot1 = useRef(new Animated.Value(0.35)).current;
  const dot2 = useRef(new Animated.Value(0.35)).current;
  const dot3 = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 7,
        tension: 65,
        useNativeDriver: true,
      }),
    ]).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(ringPulse, {
          toValue: 1.06,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(ringPulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();

    const stagger = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, {
            toValue: 1,
            duration: 320,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0.35,
            duration: 320,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      );

    const a1 = stagger(dot1, 0);
    const a2 = stagger(dot2, 140);
    const a3 = stagger(dot3, 280);
    a1.start();
    a2.start();
    a3.start();

    return () => {
      pulse.stop();
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [fade, scale, ringPulse, dot1, dot2, dot3]);

  return (
    <View style={styles.root} pointerEvents="none">
      <LinearGradient
        colors={["#0A0E1A", "#0F172A", "#1E1B4B", "#2D1B69"]}
        locations={[0, 0.35, 0.7, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <Animated.View
        style={[
          styles.center,
          {
            opacity: fade,
            transform: [{ scale }],
          },
        ]}
      >
        <Animated.View
          style={[
            styles.iconRing,
            { transform: [{ scale: ringPulse }] },
          ]}
        >
          <Ionicons name="sparkles" size={44} color={ACCENT} />
        </Animated.View>
        <Text style={[styles.title, isRTL && styles.rtlText]}>
          {CONFIG.app.name}
        </Text>
        <Text style={[styles.tagline, isRTL && styles.rtlText]}>
          {t("app.launchTagline")}
        </Text>
      </Animated.View>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom, 16) + 8,
          },
        ]}
      >
        <View style={styles.dotsRow}>
          <Animated.View style={[styles.dot, { opacity: dot1 }]} />
          <Animated.View style={[styles.dot, { opacity: dot2 }]} />
          <Animated.View style={[styles.dot, { opacity: dot3 }]} />
        </View>
        <Text style={[styles.loading, isRTL && styles.rtlText]}>
          {t("app.launchLoading")}
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
  center: {
    alignItems: "center",
    paddingHorizontal: 32,
  },
  iconRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1.5,
    borderColor: "rgba(232,201,122,0.45)",
    backgroundColor: "rgba(232,201,122,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
  },
  title: {
    fontSize: 36,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  tagline: {
    fontSize: 16,
    color: "rgba(197, 201, 220, 0.95)",
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 280,
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
    backgroundColor: ACCENT,
  },
  loading: {
    fontSize: 14,
    color: "rgba(181, 184, 201, 0.95)",
    fontWeight: "500",
  },
  rtlText: {
    writingDirection: "rtl",
    textAlign: "center",
  },
});
