// src/screens/auth/EmailVerificationScreen.tsx

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../services/supabase";
import { getAuthRedirectUrl } from "../../services/supabase";
import {
  AuthNoticeModal,
  Button,
  LanguageSwitcher,
} from "../../components/common";

import { UserRole } from "../../types";
import type { AuthStackParamList } from "../../navigation/types";
import { useAppTranslation } from "../../hooks/useAppTranslation";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface EmailVerificationScreenProps {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<AuthStackParamList, "EmailVerification">;
}

export const EmailVerificationScreen: React.FC<
  EmailVerificationScreenProps
> = ({ navigation, route }) => {
  const { t, isRTL } = useAppTranslation();
  const insets = useSafeAreaInsets();
  const email = route.params?.email ?? "";
  const role = route.params?.role ?? UserRole.CLIENT;
  const [isChecking, setIsChecking] = useState(false);
  const [canResend, setCanResend] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [noticeModal, setNoticeModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
  }>({ visible: false, title: "", message: "" });

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
        const { data: userData, error: userError } = await supabase.auth.getUser(
          data.session.access_token,
        );
        if (userError) throw userError;

        if (userData.user?.email_confirmed_at) {
          navigation.replace("CompleteProfile", { role });
          return;
        }
      }

      setNoticeModal({
        visible: true,
        title: t("common.error"),
        message: t("auth.emailVerifyNeedReopen"),
      });
    } catch (error: any) {
      setNoticeModal({
        visible: true,
        title: t("common.error"),
        message: error?.message || "An error occurred",
      });
    } finally {
      setIsChecking(false);
    }
  };

  const handleResendEmail = async () => {
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: getAuthRedirectUrl(),
        },
      });

      if (error) throw error;

      setNoticeModal({
        visible: true,
        title: t("common.success"),
        message: t("auth.verificationEmailSent"),
      });
      setCanResend(false);
      setCountdown(60);
    } catch (error: any) {
      setNoticeModal({
        visible: true,
        title: t("common.error"),
        message: error?.message || "An error occurred",
      });
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={["#0A0E1A", "#0F172A", "#1E1B4B", "#2D1B69"]}
        locations={[0, 0.35, 0.7, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 18,
            paddingBottom: Math.max(insets.bottom, 12) + 24,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <TouchableOpacity
            style={styles.backButtonInline}
            onPress={() => navigation.navigate("Login")}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.backInlineText}>← {t("auth.backToLogin")}</Text>
          </TouchableOpacity>
          <LanguageSwitcher />
        </View>

        <View style={styles.panel}>
          <View style={styles.iconWrap}>
            <Ionicons name="mail-open-outline" size={42} color="#E8C97A" />
          </View>

          <Text style={[styles.title, isRTL && styles.rtlText]}>
            {t("auth.verifyEmail")}
          </Text>
          <Text style={[styles.description, isRTL && styles.rtlText]}>
            {t("auth.verificationSentTo")}
          </Text>
          <Text style={[styles.email, isRTL && styles.rtlText]}>{email}</Text>
          <Text style={[styles.instruction, isRTL && styles.rtlText]}>
            {t("auth.emailVerifyInstruction")}
          </Text>

          <Button
            title={t("auth.verifyEmailAction")}
            onPress={handleCheckVerification}
            loading={isChecking}
            style={styles.button}
          />

          <View style={styles.resendContainer}>
            <Text style={[styles.resendText, isRTL && styles.rtlText]}>
              {t("auth.didNotReceiveEmail")}
            </Text>
            {canResend ? (
              <TouchableOpacity onPress={handleResendEmail}>
                <Text style={styles.resendLink}>{t("auth.resendEmail")}</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.countdown}>
                {t("auth.resendIn", { count: countdown })}
              </Text>
            )}
          </View>

          <View style={styles.tipCard}>
            <Text style={styles.tipTitle}>{t("auth.tipsTitle")}</Text>
            <Text style={styles.tipText}>{t("auth.emailTipSpam")}</Text>
            <Text style={styles.tipText}>{t("auth.emailTipAddress", { email })}</Text>
            <Text style={styles.tipText}>{t("auth.emailTipExpiry")}</Text>
          </View>
        </View>
      </ScrollView>

      <AuthNoticeModal
        visible={noticeModal.visible}
        onClose={() =>
          setNoticeModal({ visible: false, title: "", message: "" })
        }
        title={noticeModal.title}
        message={noticeModal.message}
        primaryLabel={t("common.close")}
        onPrimary={() =>
          setNoticeModal({ visible: false, title: "", message: "" })
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0A0E1A",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  backButtonInline: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    minHeight: 44,
    justifyContent: "center",
  },
  backInlineText: {
    color: "#E8C97A",
    fontSize: 15,
    fontWeight: "600",
  },
  panel: {
    borderRadius: 18,
    borderWidth: 1.2,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.07)",
    padding: 18,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(232,201,122,0.14)",
    borderWidth: 1,
    borderColor: "rgba(232,201,122,0.32)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
    alignSelf: "center",
  },
  title: {
    fontSize: 30,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 10,
  },
  description: {
    fontSize: 16,
    color: "#B5B8C9",
    textAlign: "center",
    marginBottom: 8,
  },
  email: {
    fontSize: 15,
    fontWeight: "600",
    color: "#E8C97A",
    marginBottom: 14,
    textAlign: "center",
  },
  instruction: {
    fontSize: 14,
    color: "#C7CBDA",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  button: {
    marginBottom: 18,
  },
  resendContainer: {
    alignItems: "center",
    marginBottom: 18,
  },
  resendText: {
    fontSize: 14,
    color: "#B5B8C9",
    marginBottom: 8,
  },
  resendLink: {
    fontSize: 14,
    color: "#E8C97A",
    fontWeight: "600",
  },
  countdown: {
    fontSize: 14,
    color: "#9BA3BD",
  },
  tipCard: {
    backgroundColor: "rgba(12, 26, 56, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    padding: 16,
    borderRadius: 12,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  tipText: {
    fontSize: 13,
    color: "#C7CBDA",
    marginBottom: 4,
  },
  rtlText: {
    textAlign: "right",
    writingDirection: "rtl",
  },
});

