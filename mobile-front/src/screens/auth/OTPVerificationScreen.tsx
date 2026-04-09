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
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import {
  AuthNoticeModal,
  Button,
  LanguageSwitcher,
} from "../../components/common";

import { UserRole } from "../../types";
import type { AuthStackParamList } from "../../navigation/types";
import * as SecureStore from "expo-secure-store";
import { useAppTranslation } from "../../hooks/useAppTranslation";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface OTPVerificationScreenProps {
  navigation: NativeStackNavigationProp<any>;
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
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={["#0A0E1A", "#0F172A", "#1E1B4B", "#2D1B69"]}
        locations={[0, 0.35, 0.7, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
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
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.backInlineText}>← {t("auth.changePhone")}</Text>
            </TouchableOpacity>
            <LanguageSwitcher />
          </View>

          <View style={styles.panel}>
            <View style={styles.iconWrap}>
              <Ionicons name="chatbubble-ellipses-outline" size={42} color="#E8C97A" />
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

            <Button
              title={t("auth.verifyOtp")}
              onPress={handleVerifyOTP}
              loading={isLoading}
              style={styles.button}
            />

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
    backgroundColor: "#0A0E1A",
  },
  container: {
    flex: 1,
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
  phone: {
    fontSize: 15,
    fontWeight: "600",
    color: "#E8C97A",
    marginBottom: 22,
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
    borderWidth: 1.6,
    borderColor: "rgba(255,255,255,0.24)",
    backgroundColor: "rgba(255,255,255,0.1)",
    fontSize: 23,
    fontWeight: "600",
    textAlign: "center",
    color: "#FFFFFF",
  },
  otpInputFilled: {
    borderColor: "#E8C97A",
    backgroundColor: "rgba(232,201,122,0.16)",
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

