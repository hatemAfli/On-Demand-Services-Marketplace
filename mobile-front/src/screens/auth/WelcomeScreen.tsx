import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Image,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../../navigation/types";
import { useAppTranslation } from "../../hooks/useAppTranslation";

type WelcomeScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  "Welcome"
>;

interface WelcomeScreenProps {
  navigation: WelcomeScreenNavigationProp;
}

const { height } = Dimensions.get("window");

const COLORS = {
  midnight: "#0A0E1A",
  navy: "#0F172A",
  indigo: "#1E1B4B",
  violet: "#2D1B69",
  gold: "#C9A84C",
  goldLight: "#E8C97A",
  white: "#FFFFFF",
  offWhite: "#F0EEF8",
  muted: "#8B8FA8",
  cardBg: "rgba(255,255,255,0.06)",
} as const;

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ navigation }) => {
  const { t, isRTL, language, setLanguage } = useAppTranslation();

  const heroAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;
  const btnAnim = useRef(new Animated.Value(0)).current;
  const orbTopFloat = useRef(new Animated.Value(0)).current;
  const orbMiddleFloat = useRef(new Animated.Value(0)).current;
  const orbBottomFloat = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(120, [
      Animated.spring(heroAnim, {
        toValue: 1,
        tension: 40,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(contentAnim, {
        toValue: 1,
        tension: 40,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(btnAnim, {
        toValue: 1,
        tension: 40,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    const makeFloat = (
      value: Animated.Value,
      amplitude: number,
      duration: number,
    ) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(value, {
            toValue: amplitude,
            duration,
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: -amplitude,
            duration,
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration,
            useNativeDriver: true,
          }),
        ]),
      );

    const orbTopLoop = makeFloat(orbTopFloat, 10, 2600);
    const orbMiddleLoop = makeFloat(orbMiddleFloat, 8, 3000);
    const orbBottomLoop = makeFloat(orbBottomFloat, 12, 3400);

    orbTopLoop.start();
    orbMiddleLoop.start();
    orbBottomLoop.start();

    return () => {
      orbTopLoop.stop();
      orbMiddleLoop.stop();
      orbBottomLoop.stop();
    };
  }, [
    heroAnim,
    contentAnim,
    btnAnim,
    orbTopFloat,
    orbMiddleFloat,
    orbBottomFloat,
  ]);

  const heroTranslate = heroAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-30, 0],
  });
  const contentTranslate = contentAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [40, 0],
  });
  const btnTranslate = btnAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [60, 0],
  });

  return (
    <View style={styles.root}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      <LinearGradient
        colors={[COLORS.midnight, COLORS.navy, COLORS.indigo, COLORS.violet]}
        locations={[0, 0.35, 0.7, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <Animated.View style={[styles.orbTop, { transform: [{ translateY: orbTopFloat }] }]}>
        <LinearGradient
          colors={["rgba(99,102,241,0.35)", "rgba(139,92,246,0.08)"]}
          style={styles.orbFill}
        />
      </Animated.View>
      <Animated.View
        style={[styles.orbMiddle, { transform: [{ translateY: orbMiddleFloat }] }]}
      >
        <LinearGradient
          colors={["rgba(201,168,76,0.20)", "rgba(201,168,76,0.04)"]}
          style={styles.orbFill}
        />
      </Animated.View>
      <Animated.View
        style={[styles.orbBottom, { transform: [{ translateY: orbBottomFloat }] }]}
      >
        <LinearGradient
          colors={["rgba(45,27,105,0.55)", "rgba(30,27,75,0.16)"]}
          style={styles.orbFill}
        />
      </Animated.View>

      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <Animated.View
          style={[
            styles.heroContainer,
            { opacity: heroAnim, transform: [{ translateY: heroTranslate }] },
          ]}
        >
          <Image
            source={{
              uri: "https://storage.googleapis.com/uxpilot-auth.appspot.com/b1c903e93b-4f341eebdac34b93b609.png",
            }}
            style={styles.heroImage}
            resizeMode="cover"
          />
          <LinearGradient
            colors={["transparent", "rgba(10,14,26,0.7)", COLORS.midnight]}
            style={styles.heroFade}
          />
          <View style={[styles.brandBadge, isRTL && styles.brandBadgeRtl]}>
            <Text style={styles.brandText}>ServeMe</Text>
          </View>
        </Animated.View>

        <Animated.View
          style={[
            styles.contentSection,
            {
              opacity: contentAnim,
              transform: [{ translateY: contentTranslate }],
            },
          ]}
        >
          <Text style={[styles.tagline, isRTL && styles.textRtl]}>
            {t("welcome.tagline")}
          </Text>
          <Text style={[styles.headline, isRTL && styles.textRtl]}>
            {t("welcome.title")}
          </Text>
          <Text style={[styles.subtext, isRTL && styles.textRtl]}>
            {t("welcome.subtitle")}
          </Text>

          <Text style={[styles.sectionLabel, isRTL && styles.textRtl]}>
            {t("common.selectLanguage")}
          </Text>

          <View style={styles.langRow}>
            <TouchableOpacity
              activeOpacity={0.9}
              style={[
                styles.langBigButton,
                language === "en" && styles.langBigButtonActive,
              ]}
              onPress={() => setLanguage("en")}
            >
              <Text
                style={[
                  styles.langBigTitle,
                  language === "en" && styles.langBigTitleActive,
                ]}
              >
                {t("common.english")}
              </Text>
              <Text style={styles.langBigCode}>EN</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.9}
              style={[
                styles.langBigButton,
                language === "ar" && styles.langBigButtonActive,
              ]}
              onPress={() => setLanguage("ar")}
            >
              <Text
                style={[
                  styles.langBigTitle,
                  language === "ar" && styles.langBigTitleActive,
                ]}
              >
                {t("common.arabic")}
              </Text>
              <Text style={styles.langBigCode}>AR</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        <Animated.View
          style={[
            styles.buttonSection,
            { opacity: btnAnim, transform: [{ translateY: btnTranslate }] },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => navigation.navigate("SignUp")}
          >
            <LinearGradient
              colors={[COLORS.gold, COLORS.goldLight]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryText}>{t("common.register")}</Text>
              <View style={styles.primaryArrow}>
                <Text style={styles.primaryArrowText}>→</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.secondaryButton}
            onPress={() => navigation.navigate("Login")}
          >
            <Text style={styles.secondaryText}>{t("common.login")}</Text>
          </TouchableOpacity>

          <Text style={[styles.footerNote, isRTL && styles.textRtl]}>
            {t("welcome.footerPrefix", {
              defaultValue: "By continuing, you agree to our",
            })}{" "}
            <Text
              style={styles.footerLink}
              onPress={() => navigation.navigate("Terms")}
            >
              {t("welcome.termsLabel", { defaultValue: "Terms" })}
            </Text>{" "}
            &{" "}
            <Text
              style={styles.footerLink}
              onPress={() => navigation.navigate("Privacy")}
            >
              {t("welcome.privacyLabel", { defaultValue: "Privacy Policy" })}
            </Text>
          </Text>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.midnight,
  },
  safeArea: {
    flex: 1,
  },
  orbFill: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
  },
  orbTop: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    top: -70,
    right: -90,
  },
  orbMiddle: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    top: height * 0.3,
    left: -70,
  },
  orbBottom: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    bottom: -80,
    right: -100,
  },
  heroContainer: {
    width: "100%",
    height: height * 0.36,
    overflow: "hidden",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroFade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "55%",
  },
  brandBadge: {
    position: "absolute",
    left: 24,
    bottom: 20,
  },
  brandBadgeRtl: {
    left: undefined,
    right: 24,
  },
  brandText: {
    color: COLORS.white,
    fontSize: 24,
    fontWeight: "700",
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  },
  contentSection: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  tagline: {
    color: COLORS.gold,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 8,
    fontWeight: "600",
  },
  headline: {
    color: COLORS.white,
    fontSize: 40,
    fontWeight: "700",
    marginBottom: 10,
  },
  subtext: {
    color: COLORS.muted,
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 20,
  },
  sectionLabel: {
    color: COLORS.offWhite,
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 12,
    fontWeight: "600",
  },
  langRow: {
    flexDirection: "row",
    gap: 12,
  },
  langBigButton: {
    flex: 1,
    minHeight: 92,
    borderRadius: 18,
    borderWidth: 1.4,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 6,
  },
  langBigButtonActive: {
    borderColor: COLORS.goldLight,
    backgroundColor: "rgba(201,168,76,0.20)",
  },
  langBigTitle: {
    color: COLORS.offWhite,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  langBigTitleActive: {
    color: COLORS.goldLight,
  },
  langBigCode: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.3,
  },
  buttonSection: {
    marginTop: "auto",
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 22,
    gap: 12,
  },
  primaryButton: {
    borderRadius: 16,
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  primaryText: {
    color: COLORS.midnight,
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
  },
  primaryArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(10,14,26,0.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryArrowText: {
    color: COLORS.midnight,
    fontWeight: "800",
    fontSize: 16,
  },
  secondaryButton: {
    borderRadius: 16,
    borderWidth: 1.2,
    borderColor: "rgba(232,201,122,0.45)",
    backgroundColor: "rgba(255,255,255,0.08)",
    height: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
  },
  footerNote: {
    marginTop: 4,
    textAlign: "center",
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  footerLink: {
    color: COLORS.goldLight,
    fontWeight: "600",
  },
  textRtl: {
    textAlign: "right",
    writingDirection: "rtl",
  },
});

export default WelcomeScreen;
