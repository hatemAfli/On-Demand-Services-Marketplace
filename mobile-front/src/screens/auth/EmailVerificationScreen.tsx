// src/screens/auth/EmailVerificationScreen.tsx

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../services/supabase";
import { Button, LanguageSwitcher } from "../../components/common";
import { COLORS } from "../../constants";
import { UserRole } from "../../types";
import type { AuthStackParamList } from "../../navigation/types";
import { useAppTranslation } from "../../hooks/useAppTranslation";

interface EmailVerificationScreenProps {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<AuthStackParamList, "EmailVerification">;
}

export const EmailVerificationScreen: React.FC<
  EmailVerificationScreenProps
> = ({ navigation, route }) => {
  const { t, isRTL } = useAppTranslation();
  const email = route.params?.email ?? "";
  const role = route.params?.role ?? UserRole.CLIENT;
  const [isChecking, setIsChecking] = useState(false);
  const [canResend, setCanResend] = useState(false);
  const [countdown, setCountdown] = useState(60);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  // Listen for email verification
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("Auth event:", event);

        if (event === "SIGNED_IN" && session) {
          navigation.replace("CompleteProfile", { role });
        }
      },
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [navigation, role]);

  const handleCheckVerification = async () => {
    try {
      setIsChecking(true);

      const { data, error } = await supabase.auth.getSession();

      if (error) throw error;

      if (data.session) {
        // Email is verified
        navigation.replace("CompleteProfile", { role });
      } else {
        Alert.alert(
          t("common.error"),
          "Please check your email and click the verification link.",
        );
      }
    } catch (error: any) {
      Alert.alert(t("common.error"), error.message);
    } finally {
      setIsChecking(false);
    }
  };

  const handleResendEmail = async () => {
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
      });

      if (error) throw error;

      Alert.alert(t("common.success"), "Verification email sent!");
      setCanResend(false);
      setCountdown(60);
    } catch (error: any) {
      Alert.alert(t("common.error"), error.message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.langSwitchRow}>
        <LanguageSwitcher />
      </View>
      <View style={styles.content}>
        {/* Icon */}
        <View style={styles.iconContainer}>
          <Ionicons name="mail-outline" size={80} color={COLORS.primary} />
        </View>

        {/* Title */}
        <Text style={[styles.title, isRTL && styles.rtlText]}>{t("auth.verifyEmail")}</Text>

        {/* Description */}
        <Text style={styles.description}>
          {t("auth.verificationSentTo")}
        </Text>
        <Text style={styles.email}>{email}</Text>

        <Text style={styles.instruction}>
          Click the link in your email to verify your account and continue.
        </Text>

        {/* Check Status Button */}
        <Button
          title={t("auth.verifyEmailAction")}
          onPress={handleCheckVerification}
          loading={isChecking}
          style={styles.button}
        />

        {/* Resend Email */}
        <View style={styles.resendContainer}>
          <Text style={styles.resendText}>{t("auth.didNotReceiveEmail")}</Text>

          {canResend ? (
            <TouchableOpacity onPress={handleResendEmail}>
              <Text style={styles.resendLink}>{t("auth.resendEmail")}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.countdown}>{t("auth.resendIn", { count: countdown })}</Text>
          )}
        </View>

        {/* Tips */}
        <View style={styles.tipsContainer}>
          <Text style={styles.tipsTitle}>Tips:</Text>
          <Text style={styles.tip}>• Check your spam/junk folder</Text>
          <Text style={styles.tip}>• Make sure {email} is correct</Text>
          <Text style={styles.tip}>• The link expires in 24 hours</Text>
        </View>
      </View>

      {/* Back to Login */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.navigate("Login")}
      >
        <Text style={styles.backText}>{t("auth.backToLogin")}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 24,
  },
  langSwitchRow: {
    alignItems: "flex-end",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.primary + "20",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: COLORS.text.primary,
    marginBottom: 16,
    textAlign: "center",
  },
  description: {
    fontSize: 16,
    color: COLORS.text.secondary,
    textAlign: "center",
    marginBottom: 8,
  },
  email: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.primary,
    marginBottom: 16,
    textAlign: "center",
  },
  instruction: {
    fontSize: 14,
    color: COLORS.text.secondary,
    textAlign: "center",
    marginBottom: 40,
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  button: {
    marginBottom: 24,
    width: "100%",
  },
  resendContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  resendText: {
    fontSize: 14,
    color: COLORS.text.secondary,
    marginBottom: 8,
  },
  resendLink: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: "600",
  },
  countdown: {
    fontSize: 14,
    color: COLORS.text.tertiary,
  },
  tipsContainer: {
    backgroundColor: COLORS.info + "10",
    padding: 16,
    borderRadius: 12,
    width: "100%",
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text.primary,
    marginBottom: 8,
  },
  tip: {
    fontSize: 13,
    color: COLORS.text.secondary,
    marginBottom: 4,
  },
  backButton: {
    alignSelf: "center",
    paddingVertical: 12,
  },
  backText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: "600",
  },
  rtlText: {
    textAlign: "right",
    writingDirection: "rtl",
  },
});
