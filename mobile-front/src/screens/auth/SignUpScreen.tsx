// src/screens/auth/SignUpScreen.tsx

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
  PasswordStrengthIndicator,
} from "../../components/common";
import { COLORS } from "../../constants";
import { UserRole } from "../../types";
import { useAppTranslation } from "../../hooks/useAppTranslation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AuthStackParamList } from "../../navigation/types";

const ACCENT = "#EA580C";
const ACCENT_SOFT = "#FFEDD5";
const ACCENT_BORDER = "#FDBA74";
const SCREEN_BG = "#F1F5F9";

type SignUpMode = "email" | "phone";

interface SignUpScreenProps {
  navigation: NativeStackNavigationProp<AuthStackParamList, "SignUp">;
}

export const SignUpScreen: React.FC<SignUpScreenProps> = ({ navigation }) => {
  const {
    signUpWithEmail,
    signUpWithPhone,
    isLoading,
    syncSessionFromSupabase,
  } = useAuth();
  const { t, isRTL } = useAppTranslation();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<SignUpMode>("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

  const [errors, setErrors] = useState<{
    email?: string;
    phone?: string;
    password?: string;
    confirmPassword?: string;
    role?: string;
  }>({});

  const [duplicateModal, setDuplicateModal] = useState<{
    visible: boolean;
    variant: "use_login" | "wrong_password";
  }>({ visible: false, variant: "use_login" });
  const [errorModal, setErrorModal] = useState<{
    visible: boolean;
    message: string;
  }>({ visible: false, message: "" });

  const validate = (): boolean => {
    const newErrors: typeof errors = {};

    // Validate email or phone
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

    // Validate password
    if (!password) {
      newErrors.password = t("validation.passwordRequired");
    } else if (password.length < 6) {
      newErrors.password = t("validation.passwordMin");
    }

    // Validate confirm password
    if (!confirmPassword) {
      newErrors.confirmPassword = t("validation.confirmPasswordRequired");
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = t("validation.passwordMismatch");
    }

    // Validate role selection
    if (!selectedRole) {
      newErrors.role = t("validation.roleRequired");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignUp = async () => {
    if (!validate()) return;

    try {
      if (mode === "email") {
        const result = await signUpWithEmail(email, password, selectedRole!);

        if (result.outcome === "resumeProfile") {
          navigation.reset({
            index: 0,
            routes: [
              {
                name: "CompleteProfile",
                params: { role: getRoleFromSession(result.session) },
              },
            ],
          });
          return;
        }

        if (result.outcome === "existingAccount") {
          setDuplicateModal({ visible: true, variant: result.variant });
          return;
        }

        if (result.outcome === "new") {
          if (result.needsEmailConfirmation) {
            navigation.navigate("EmailVerification", {
              email,
              role: selectedRole!,
            });
          } else {
            await syncSessionFromSupabase();
            navigation.navigate("CompleteProfile", {
              role: selectedRole!,
            });
          }
        }
      } else {
        // Phone signup - sends OTP
        await signUpWithPhone(phone, password, selectedRole!);

        // Navigate to OTP verification screen
        navigation.navigate("OTPVerification", {
          phone,
          role: selectedRole!,
        });
      }
    } catch (error: any) {
      setErrorModal({
        visible: true,
        message: error?.message || "An error occurred",
      });
    }
  };

  const roleOptions = [
    {
      value: UserRole.CLIENT,
      label: t("auth.roleClientLabel"),
      description: t("auth.roleClientDesc"),
      icon: "👤",
    },
    {
      value: UserRole.PROVIDER,
      label: t("auth.roleProviderLabel"),
      description: t("auth.roleProviderDesc"),
      icon: "🔧",
    },
    {
      value: UserRole.COMPANY_ADMIN,
      label: t("auth.roleCompanyLabel"),
      description: t("auth.roleCompanyDesc"),
      icon: "🏢",
    },
  ];

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
              paddingBottom: Math.max(insets.bottom, 12) + 40,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
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
                  placeholder="+216 12 345 678"
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
              <PasswordStrengthIndicator password={password} />

              <Input
                label={t("common.confirmPassword")}
                placeholder={t("common.confirmPassword")}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                leftIcon="lock-closed-outline"
                secureTextEntry
                error={errors.confirmPassword}
              />
            </View>

            {/* Role Selection */}
            <View style={styles.roleSection}>
              <Text style={[styles.roleTitle, isRTL && styles.rtlText]}>
                {t("auth.roleSectionTitle")}
              </Text>
              {errors.role && (
                <Text style={styles.roleError}>{errors.role}</Text>
              )}

              <View style={styles.roleOptions}>
                {roleOptions.map((role) => (
                  <TouchableOpacity
                    key={role.value}
                    style={[
                      styles.roleCard,
                      selectedRole === role.value && styles.roleCardActive,
                    ]}
                    onPress={() => setSelectedRole(role.value)}
                  >
                    <View style={styles.roleCardRow}>
                      <Text style={styles.roleIcon}>{role.icon}</Text>
                      <View style={styles.roleTexts}>
                        <Text
                          style={[
                            styles.roleLabel,
                            selectedRole === role.value &&
                              styles.roleLabelActive,
                            isRTL && styles.rtlText,
                          ]}
                        >
                          {role.label}
                        </Text>
                        <Text
                          style={[
                            styles.roleDescription,
                            selectedRole === role.value &&
                              styles.roleDescriptionActive,
                            isRTL && styles.rtlText,
                          ]}
                        >
                          {role.description}
                        </Text>
                      </View>
                    </View>

                    {selectedRole === role.value && (
                      <View style={styles.checkmark}>
                        <Text style={styles.checkmarkText}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={styles.nextButton}
              onPress={handleSignUp}
              activeOpacity={0.9}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <View style={styles.nextButtonContent}>
                  <Ionicons
                    name={isRTL ? "arrow-back-outline" : "arrow-forward-outline"}
                    size={16}
                    color="#FFFFFF"
                  />
                  <Text style={styles.nextButtonText}>{t("common.next")}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {t("auth.alreadyHaveAccount")}{" "}
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate("Login")}>
              <Text style={styles.footerLink}>{t("common.login")}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <AuthNoticeModal
        visible={duplicateModal.visible}
        onClose={() => setDuplicateModal((s) => ({ ...s, visible: false }))}
        title={t("auth.duplicateAccountTitle")}
        message={
          duplicateModal.variant === "use_login"
            ? t("auth.duplicateAccountUseLogin")
            : t("auth.duplicateAccountWrongPassword")
        }
        primaryLabel={t("auth.goToLogin")}
        onPrimary={() => navigation.navigate("Login")}
        showDismissLink
      />

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
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 0,
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
  roleSection: {
    marginBottom: 32,
  },
  roleTitle: {
    marginLeft: 8,
    marginBottom: 12,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: "#94A3B8",
  },
  roleError: {
    fontSize: 12,
    color: COLORS.error,
    marginBottom: 8,
  },
  roleOptions: {
    gap: 12,
  },
  roleCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    position: "relative",
  },
  roleCardActive: {
    borderColor: ACCENT_BORDER,
    backgroundColor: ACCENT_SOFT,
  },
  roleCardRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingEnd: 36,
  },
  roleTexts: {
    flex: 1,
    minWidth: 0,
  },
  roleIcon: {
    fontSize: 32,
    lineHeight: 40,
    marginEnd: 14,
  },
  roleLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  roleLabelActive: {
    color: "#C2410C",
  },
  roleDescription: {
    fontSize: 12,
    color: "#64748B",
  },
  roleDescriptionActive: {
    color: "#475569",
  },
  checkmark: {
    position: "absolute",
    top: 12,
    end: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  checkmarkText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
  },
  nextButton: {
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
  nextButtonDisabled: {
    opacity: 0.65,
  },
  nextButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  nextButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  nextButtonIconWrap: {
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
    flexWrap: "wrap",
    marginTop: 24,
    paddingBottom: 8,
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
  rtlText: {
    textAlign: "right",
    writingDirection: "rtl",
  },
});
