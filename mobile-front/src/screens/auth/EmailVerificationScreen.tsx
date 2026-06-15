// src/screens/auth/EmailVerificationScreen.tsx

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
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

const ACCENT = "#EA580C";
const ACCENT_SOFT = "#FFEDD5";
const SCREEN_BG = "#F1F5F9";

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

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
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
      <StatusBar
        barStyle="dark-content"
        translucent
        backgroundColor="transparent"
      />
      <View style={[styles.topBackContainer, { top: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate("Login")}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.backText}>← {t("auth.backToLogin")}</Text>
        </TouchableOpacity>
      </View>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + 64,
              paddingBottom: 16 + insets.bottom,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.panel}>
            <View style={styles.iconWrap}>
              <Ionicons name="mail-open-outline" size={34} color={ACCENT} />
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
              style={[
                styles.primaryButton,
                isChecking && styles.primaryButtonDisabled,
              ]}
              onPress={handleCheckVerification}
              activeOpacity={0.9}
              disabled={isChecking}
            >
              {isChecking ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <View style={styles.primaryButtonContent}>
                  <Text style={styles.primaryButtonText}>
                    {t("auth.verifyEmailAction")}
                  </Text>
                  <View style={styles.primaryButtonIconWrap}>
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={18}
                      color="#FFFFFF"
                    />
                  </View>
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

            <View style={styles.tipsSection}>
              <Text style={[styles.tipTitle, isRTL && styles.rtlText]}>
                {t("auth.tipsTitle")}
              </Text>
              <Text style={[styles.tipText, isRTL && styles.rtlText]}>
                • {t("auth.emailTipSpam")}
              </Text>
              <Text style={[styles.tipText, isRTL && styles.rtlText]}>
                • {t("auth.emailTipAddress", { email })}
              </Text>
              <Text style={[styles.tipText, isRTL && styles.rtlText]}>
                • {t("auth.emailTipExpiry")}
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

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
    backgroundColor: SCREEN_BG,
  },
  topBackContainer: {
    position: "absolute",
    left: 24,
    zIndex: 10,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 0,
    justifyContent: "center",
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    minHeight: 44,
    justifyContent: "center",
  },
  backText: {
    color: ACCENT,
    fontSize: 16,
    fontWeight: "600",
  },
  panel: {
    width: "100%",
    alignSelf: "stretch",
    backgroundColor: SCREEN_BG,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    marginTop: 8,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: ACCENT_SOFT,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    alignSelf: "center",
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  description: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 6,
  },
  email: {
    fontSize: 14,
    fontWeight: "700",
    color: ACCENT,
    marginBottom: 12,
    textAlign: "center",
  },
  instruction: {
    fontSize: 13,
    color: "#475569",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  primaryButton: {
    width: "100%",
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 20,
  },
  primaryButtonDisabled: {
    opacity: 0.65,
  },
  primaryButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  primaryButtonIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  resendContainer: {
    alignItems: "center",
    marginBottom: 28,
  },
  resendText: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 6,
  },
  resendLink: {
    fontSize: 13,
    color: ACCENT,
    fontWeight: "600",
  },
  countdown: {
    fontSize: 13,
    color: "#94A3B8",
  },
  tipsSection: {
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  tipTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 10,
    marginTop: 16,
  },
  tipText: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 8,
    lineHeight: 18,
  },
  rtlText: {
    textAlign: "right",
    writingDirection: "rtl",
  },
});
