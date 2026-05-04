// src/screens/auth/OTPVerificationScreen.tsx

import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import {
  AuthNoticeModal,
} from "../../components/common";

import { UserRole } from "../../types";
import type { AuthStackParamList } from "../../navigation/types";
import * as SecureStore from "expo-secure-store";
import { useAppTranslation } from "../../hooks/useAppTranslation";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface OTPVerificationScreenProps {
  navigation: NativeStackNavigationProp<AuthStackParamList, "OTPVerification">;
  route: RouteProp<AuthStackParamList, "OTPVerification">;
}

export const OTPVerificationScreen: React.FC<OTPVerificationScreenProps> = ({
  navigation,
  route,
}) => {
  const { t, isRTL } = useAppTranslation();
  const insets = useSafeAreaInsets();
  const phone = route.params?.phone ?? "";
  const role = route.params?.role ?? UserRole.CLIENT;
  const { verifyOTP, isLoading, signUpWithPhone } = useAuth();

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [canResend, setCanResend] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [noticeModal, setNoticeModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
  }>({ visible: false, title: "", message: "" });

  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  const handleOtpChange = (value: string, index: number) => {
    // Only allow numbers
    if (value && !/^\d+$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    // Handle backspace
    if (e.nativeEvent.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOTP = async () => {
    const otpCode = otp.join("");

    if (otpCode.length !== 6) {
      setNoticeModal({
        visible: true,
        title: t("common.error"),
        message: t("validation.otpInvalid"),
      });
      return;
    }

    try {
      await verifyOTP(phone, otpCode);

      // Navigate to profile completion
      navigation.replace("CompleteProfile", { role });
    } catch (error: any) {
      setNoticeModal({
        visible: true,
        title: t("common.error"),
        message: error?.message || t("validation.otpInvalid"),
      });
      // Clear OTP inputs
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    }
  };

  const handleResendOTP = async () => {
    try {
      const password = (await SecureStore.getItemAsync("tempPassword")) ?? "";
      if (!password) {
        setNoticeModal({
          visible: true,
          title: t("common.error"),
          message: t("auth.otpSessionExpired"),
        });
        return;
      }
      await signUpWithPhone(phone, password, role);

      setNoticeModal({
        visible: true,
        title: t("common.success"),
        message: t("auth.otpSentSuccess"),
      });
      setCanResend(false);
      setCountdown(60);
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
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
          style={styles.backButtonInline}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.backInlineText}>← {t("auth.changePhone")}</Text>
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
              paddingBottom: Math.max(insets.bottom, 12) + 24,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.panel}>
            <View style={styles.iconWrap}>
              <Ionicons name="chatbubble-ellipses-outline" size={34} color="#4F46E5" />
            </View>

            <Text style={[styles.title, isRTL && styles.rtlText]}>
              {t("auth.enterOtp")}
            </Text>
            <Text style={[styles.description, isRTL && styles.rtlText]}>
              {t("auth.sentOtpTo")}
            </Text>
            <Text style={[styles.phone, isRTL && styles.rtlText]}>{phone}</Text>

            <View style={styles.otpContainer}>
              {otp.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => {
                    inputRefs.current[index] = ref;
                  }}
                  style={[styles.otpInput, digit && styles.otpInputFilled]}
                  value={digit}
                  onChangeText={(value) => handleOtpChange(value, index)}
                  onKeyPress={(e) => handleKeyPress(e, index)}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                />
              ))}
            </View>

            <TouchableOpacity
              style={styles.verifyButton}
              onPress={handleVerifyOTP}
              activeOpacity={0.9}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <View style={styles.verifyButtonContent}>
                  <Ionicons name="sparkles-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.verifyButtonText}>{t("auth.verifyOtp")}</Text>
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.resendContainer}>
              <Text style={[styles.resendText, isRTL && styles.rtlText]}>
                {t("auth.didNotReceiveCode")}
              </Text>
              {canResend ? (
                <TouchableOpacity onPress={handleResendOTP}>
                  <Text style={styles.resendLink}>{t("auth.resendOtp")}</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.countdown}>
                  {t("auth.resendIn", { count: countdown })}
                </Text>
              )}
            </View>

            <View style={styles.tipCard}>
              <Text style={styles.tipTitle}>{t("auth.tipsTitle")}</Text>
              <Text style={styles.tipText}>{t("auth.otpTipSms")}</Text>
              <Text style={styles.tipText}>{t("auth.otpTipExpiry")}</Text>
              <Text style={styles.tipText}>{t("auth.otpTipPhone", { phone })}</Text>
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
    backgroundColor: "#F1F5F9",
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
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  backButtonInline: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    minHeight: 44,
    justifyContent: "center",
  },
  backInlineText: {
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
    marginBottom: 14,
    alignSelf: "center",
  },
  title: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "700",
    color: "#0F172A",
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: -0.4,
  },
  description: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 6,
  },
  phone: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4F46E5",
    marginBottom: 16,
    textAlign: "center",
  },
  otpContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 24,
  },
  otpInput: {
    width: 46,
    height: 56,
    borderRadius: 10,
    borderWidth: 1.4,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
    fontSize: 23,
    fontWeight: "600",
    textAlign: "center",
    color: "#0F172A",
  },
  otpInputFilled: {
    borderColor: "#4F46E5",
    backgroundColor: "#EEF2FF",
  },
  verifyButton: {
    alignSelf: "center",
    minWidth: 190,
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

