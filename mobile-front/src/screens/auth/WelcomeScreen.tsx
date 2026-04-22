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
  gold: "#C9A84C",
  goldLight: "#E8C97A",
  white: "#FFFFFF",
} as const;

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ navigation }) => {
  const { t, language, setLanguage } = useAppTranslation();
  const welcomeLabel = language === "ar" ? "مرحبا" : "Welcome";
  const footerPrefix =
    language === "ar"
      ? "بالمتابعة، فإنك توافق على"
      : "By continuing, you agree to our";

  const heroAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;
  const btnAnim = useRef(new Animated.Value(0)).current;

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
  }, [heroAnim, contentAnim, btnAnim]);

  const subtitleMessage = t("welcome.subtitle", {
    defaultValue: "Your Gateway to seamless services",
  });

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
        barStyle="dark-content"
        translucent
        backgroundColor="transparent"
      />

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
          <View style={styles.brandBadge}>
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
          <View style={styles.headlineBlock}>
            <Text style={styles.headlineWelcome}>{welcomeLabel}</Text>
            <Text style={styles.headlineTyped}>{subtitleMessage}</Text>
          </View>
        </Animated.View>

        <Animated.View
          style={[
            styles.buttonSection,
            { opacity: btnAnim, transform: [{ translateY: btnTranslate }] },
          ]}
        >
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

          <Text style={styles.footerNote}>
            {footerPrefix}{" "}
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
    backgroundColor: COLORS.white,
  },
  safeArea: {
    flex: 1,
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
  brandText: {
    color: COLORS.white,
    fontSize: 24,
    fontWeight: "700",
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  },
  contentSection: {
    paddingHorizontal: 24,
    paddingTop: 20,
    alignItems: "center",
  },
  headlineBlock: {
    minHeight: 92,
    marginBottom: 20,
    justifyContent: "flex-start",
    alignSelf: "stretch",
    alignItems: "center",
  },
  headlineWelcome: {
    color: "#111827",
    fontSize: 36,
    fontWeight: "700",
    lineHeight: 44,
    textAlign: "center",
    alignSelf: "stretch",
  },
  headlineTyped: {
    color: "#374151",
    fontSize: 22,
    fontWeight: "500",
    lineHeight: 30,
    textAlign: "center",
    alignSelf: "stretch",
  },
  langRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 8,
  },
  langBigButton: {
    flex: 1,
    minHeight: 92,
    borderRadius: 18,
    borderWidth: 1.2,
    borderColor: "#D1D5DB",
    backgroundColor: "#F3F4F6",
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
    borderColor: "#C9A84C",
    backgroundColor: "#FEF3C7",
  },
  langBigTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
    textAlign: "center",
  },
  langBigTitleActive: {
    color: "#92400E",
  },
  langBigCode: {
    color: "#6B7280",
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
    backgroundColor: "#FFFFFF",
    height: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  footerNote: {
    marginTop: 4,
    textAlign: "center",
    color: "#6B7280",
    fontSize: 12,
    lineHeight: 18,
    alignSelf: "stretch",
  },
  footerLink: {
    color: COLORS.goldLight,
    fontWeight: "600",
  },
});

export default WelcomeScreen;
