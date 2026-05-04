// src/screens/auth/EmailVerificationScreen.tsx

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../services/supabase";
import { getAuthRedirectUrl } from "../../services/supabase";
import { AuthNoticeModal } from "../../components/common";

import { UserRole } from "../../types";
import type { AuthStackParamList } from "../../navigation/types";
import { useAppTranslation } from "../../hooks/useAppTranslation";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface EmailVerificationScreenProps {
  navigation: NativeStackNavigationProp<AuthStackParamList, "EmailVerification">;
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
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <View style={[styles.topBackContainer, { top: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate("Login")}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.backText}>← {t("auth.backToLogin")}</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 64,
            paddingBottom: Math.max(insets.bottom, 12) + 24,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.panel}>
          <View style={styles.iconWrap}>
            <Ionicons name="mail-open-outline" size={34} color="#4F46E5" />
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

          <TouchableOpacity
            style={styles.verifyButton}
            onPress={handleCheckVerification}
            activeOpacity={0.9}
            disabled={isChecking}
          >
            {isChecking ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <View style={styles.verifyButtonContent}>
                <Ionicons name="sparkles-outline" size={16} color="#FFFFFF" />
                <Text style={styles.verifyButtonText}>
                  {t("auth.verifyEmailAction")}
                </Text>
              </View>
            )}
          </TouchableOpacity>

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
    backgroundColor: "#F1F5F9",
  },
  topBackContainer: {
    position: "absolute",
    left: 24,
    zIndex: 10,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    minHeight: 44,
    justifyContent: "center",
  },
  backText: {
    color: "#4F46E5",
    fontSize: 16,
    fontWeight: "600",
  },
  panel: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    padding: 16,
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 1,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: "#E0E7FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    alignSelf: "center",
  },
  title: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "700",
    color: "#0F172A",
    textAlign: "center",
    marginBottom: 10,
    letterSpacing: -0.4,
  },
  description: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 6,
  },
  email: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4F46E5",
    marginBottom: 12,
    textAlign: "center",
  },
  instruction: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 18,
    lineHeight: 18,
  },
  verifyButton: {
    alignSelf: "center",
    minWidth: 210,
    height: 48,
    borderRadius: 999,
    backgroundColor: "#6366F1",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#4338CA",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 14,
  },
  verifyButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  verifyButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  resendContainer: {
    alignItems: "center",
    marginBottom: 14,
  },
  resendText: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 6,
  },
  resendLink: {
    fontSize: 13,
    color: "#4F46E5",
    fontWeight: "600",
  },
  countdown: {
    fontSize: 12,
    color: "#94A3B8",
  },
  tipCard: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    borderRadius: 16,
  },
  tipTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 8,
  },
  tipText: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 4,
  },
  rtlText: {
    textAlign: "right",
    writingDirection: "rtl",
  },
});

