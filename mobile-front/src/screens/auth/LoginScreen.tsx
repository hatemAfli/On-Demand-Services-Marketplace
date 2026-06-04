// src/screens/auth/LoginScreen.tsx

import React, { useState } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { useAuth, getRoleFromSession } from "../../context/AuthContext";
import {
  AuthNoticeModal,
  Input,
} from "../../components/common";
import { useAppTranslation } from "../../hooks/useAppTranslation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AuthStackParamList } from "../../navigation/types";

const ACCENT = "#EA580C";
const SCREEN_BG = "#F1F5F9";

type LoginMode = "email" | "phone";

interface LoginScreenProps {
  navigation: NativeStackNavigationProp<AuthStackParamList, "Login">;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const { loginWithEmail, loginWithPhone, isLoading } = useAuth();
  const { t } = useAppTranslation();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<LoginMode>("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{
    email?: string;
    phone?: string;
    password?: string;
  }>({});
  const [errorModal, setErrorModal] = useState<{
    visible: boolean;
    message: string;
  }>({ visible: false, message: "" });

  const validate = (): boolean => {
    const newErrors: typeof errors = {};

    if (mode === "email") {
      if (!email) {
        newErrors.email = t("validation.emailRequired");
      } else if (!/\S+@\S+\.\S+/.test(email)) {
        newErrors.email = t("validation.emailInvalid");
      }
    } else {
      if (!phone) {
        newErrors.phone = t("validation.phoneRequired");
      } else if (!/^\+?[\d\s-()]+$/.test(phone)) {
        newErrors.phone = t("validation.phoneInvalid");
      }
    }

    if (!password) {
      newErrors.password = t("validation.passwordRequired");
    } else if (password.length < 6) {
      newErrors.password = t("validation.passwordMin");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;

    try {
      if (mode === "email") {
        const { needsProfileCompletion, session: s } = await loginWithEmail(
          email,
          password,
        );
        if (needsProfileCompletion && s) {
          navigation.reset({
            index: 0,
            routes: [
              {
                name: "CompleteProfile",
                params: { role: getRoleFromSession(s) },
              },
            ],
          });
        }
      } else {
        const { needsProfileCompletion, session: s } = await loginWithPhone(
          phone,
          password,
        );
        if (needsProfileCompletion && s) {
          navigation.reset({
            index: 0,
            routes: [
              {
                name: "CompleteProfile",
                params: { role: getRoleFromSession(s) },
              },
            ],
          });
        }
      }
    } catch (error: any) {
      setErrorModal({
        visible: true,
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
          onPress={() => navigation.navigate("Welcome")}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.backText}>← {t("common.back")}</Text>
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
        >
          <View style={styles.panel}>
            {/* Mode Toggle */}
            <View style={styles.modeToggle}>
              <TouchableOpacity
                style={[
                  styles.modeButton,
                  mode === "email" && styles.modeButtonActive,
                ]}
                onPress={() => setMode("email")}
              >
                <Text
                  style={[
                    styles.modeText,
                    mode === "email" && styles.modeTextActive,
                  ]}
                >
                  {t("common.email")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modeButton,
                  mode === "phone" && styles.modeButtonActive,
                ]}
                onPress={() => setMode("phone")}
              >
                <Text
                  style={[
                    styles.modeText,
                    mode === "phone" && styles.modeTextActive,
                  ]}
                >
                  {t("common.phone")}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Input Fields */}
            <View style={styles.form}>
              {mode === "email" ? (
                <Input
                  label={t("common.email")}
                  placeholder={t("common.email")}
                  value={email}
                  onChangeText={setEmail}
                  leftIcon="mail-outline"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  error={errors.email}
                />
              ) : (
                <Input
                  label={t("common.phone")}
                  placeholder={t("common.phone")}
                  value={phone}
                  onChangeText={setPhone}
                  leftIcon="call-outline"
                  keyboardType="phone-pad"
                  error={errors.phone}
                />
              )}

              <Input
                label={t("common.password")}
                placeholder={t("common.password")}
                value={password}
                onChangeText={setPassword}
                leftIcon="lock-closed-outline"
                secureTextEntry
                error={errors.password}
              />

              <TouchableOpacity
                style={styles.forgotPassword}
                onPress={() => navigation.navigate("ForgotPassword")}
              >
                <Text style={styles.forgotPasswordText}>
                  {t("auth.forgotPassword")}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              activeOpacity={0.9}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <View style={styles.loginButtonContent}>
                  <Text style={styles.loginButtonText}>{t("common.login")}</Text>
                  <View style={styles.loginButtonIconWrap}>
                    <Ionicons name="log-in-outline" size={18} color="#FFFFFF" />
                  </View>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>{t("auth.noAccount")} </Text>
            <TouchableOpacity onPress={() => navigation.navigate("SignUp")}>
              <Text style={styles.footerLink}>{t("common.register")}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <AuthNoticeModal
        visible={errorModal.visible}
        onClose={() => setErrorModal({ visible: false, message: "" })}
        title={t("common.error")}
        message={errorModal.message}
        primaryLabel={t("common.close")}
        onPrimary={() => setErrorModal({ visible: false, message: "" })}
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
  panel: {
    width: "100%",
    alignSelf: "stretch",
    backgroundColor: SCREEN_BG,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    marginTop: 8,
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
  modeToggle: {
    flexDirection: "row",
    backgroundColor: "#E2E8F0",
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 8,
  },
  modeButtonActive: {
    backgroundColor: "#FFFFFF",
  },
  modeText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  modeTextActive: {
    color: ACCENT,
  },
  form: {
    marginBottom: 20,
    marginTop: 8,
  },
  forgotPassword: {
    alignSelf: "flex-end",
    marginTop: -12,
    marginBottom: 20,
  },
  forgotPasswordText: {
    fontSize: 13,
    color: ACCENT,
    fontWeight: "600",
  },
  loginButton: {
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
  },
  loginButtonDisabled: {
    opacity: 0.65,
  },
  loginButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  loginButtonIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24,
    paddingHorizontal: 20,
  },
  footerText: {
    fontSize: 13,
    color: "#64748B",
  },
  footerLink: {
    fontSize: 13,
    color: ACCENT,
    fontWeight: "600",
  },
});
