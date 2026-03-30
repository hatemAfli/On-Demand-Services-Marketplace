// src/screens/auth/OTPVerificationScreen.tsx

import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import { Button, LanguageSwitcher } from "../../components/common";
import { COLORS } from "../../constants";
import { UserRole } from "../../types";
import type { AuthStackParamList } from "../../navigation/types";
import * as SecureStore from "expo-secure-store";
import { useAppTranslation } from "../../hooks/useAppTranslation";

interface OTPVerificationScreenProps {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<AuthStackParamList, "OTPVerification">;
}

export const OTPVerificationScreen: React.FC<OTPVerificationScreenProps> = ({
  navigation,
  route,
}) => {
  const { t, isRTL } = useAppTranslation();
  const phone = route.params?.phone ?? "";
  const role = route.params?.role ?? UserRole.CLIENT;
  const { verifyOTP, isLoading, signUpWithPhone } = useAuth();

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [canResend, setCanResend] = useState(false);
  const [countdown, setCountdown] = useState(60);

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
      Alert.alert(t("common.error"), t("validation.otpInvalid"));
      return;
    }

    try {
      await verifyOTP(phone, otpCode);

      // Navigate to profile completion
      navigation.replace("CompleteProfile", { role });
    } catch (error: any) {
      Alert.alert(t("common.error"), error.message || "Invalid OTP code");
      // Clear OTP inputs
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    }
  };

  const handleResendOTP = async () => {
    try {
      const password = (await SecureStore.getItemAsync("tempPassword")) ?? "";
      if (!password) {
        Alert.alert(
          t("common.error"),
          "Session expired. Go back and start sign up again.",
        );
        return;
      }
      await signUpWithPhone(phone, password, role);

      Alert.alert(t("common.success"), "OTP sent to your phone");
      setCanResend(false);
      setCountdown(60);
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch (error: any) {
      Alert.alert(t("common.error"), error.message);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.langSwitchRow}>
        <LanguageSwitcher />
      </View>
      <View style={styles.content}>
        {/* Icon */}
        <View style={styles.iconContainer}>
          <Ionicons name="chatbox-outline" size={80} color={COLORS.primary} />
        </View>

        {/* Title */}
        <Text style={[styles.title, isRTL && styles.rtlText]}>{t("auth.enterOtp")}</Text>

        {/* Description */}
        <Text style={styles.description}>{t("auth.sentOtpTo")}</Text>
        <Text style={styles.phone}>{phone}</Text>

        {/* OTP Inputs */}
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

        {/* Verify Button */}
        <Button
          title={t("auth.verifyOtp")}
          onPress={handleVerifyOTP}
          loading={isLoading}
          style={styles.button}
        />

        {/* Resend OTP */}
        <View style={styles.resendContainer}>
          <Text style={styles.resendText}>{t("auth.didNotReceiveCode")}</Text>

          {canResend ? (
            <TouchableOpacity onPress={handleResendOTP}>
              <Text style={styles.resendLink}>{t("auth.resendOtp")}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.countdown}>{t("auth.resendIn", { count: countdown })}</Text>
          )}
        </View>

        {/* Tips */}
        <View style={styles.tipsContainer}>
          <Text style={styles.tipsTitle}>Tips:</Text>
          <Text style={styles.tip}>• Check your SMS messages</Text>
          <Text style={styles.tip}>• The code expires in 10 minutes</Text>
          <Text style={styles.tip}>• Make sure {phone} is correct</Text>
        </View>
      </View>

      {/* Back Button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backText}>{t("auth.changePhone")}</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
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
  phone: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.primary,
    marginBottom: 40,
    textAlign: "center",
  },
  otpContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginBottom: 40,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    fontSize: 24,
    fontWeight: "600",
    textAlign: "center",
    color: COLORS.text.primary,
  },
  otpInputFilled: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + "10",
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
