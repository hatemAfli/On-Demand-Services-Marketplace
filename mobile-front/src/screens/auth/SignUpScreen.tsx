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
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth, getRoleFromSession } from "../../context/AuthContext";
import {
  AuthNoticeModal,
  Button,
  Input,
  LanguageSwitcher,
  PasswordStrengthIndicator,
} from "../../components/common";
import { COLORS } from "../../constants";
import { UserRole } from "../../types";
import { useAppTranslation } from "../../hooks/useAppTranslation";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type SignUpMode = "email" | "phone";

interface SignUpScreenProps {
  navigation: NativeStackNavigationProp<any>;
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
          role: selectedRole,
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
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + 20,
              paddingBottom: Math.max(insets.bottom, 12) + 40,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.topRow}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.navigate("Welcome")}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.backText}>← {t("common.back")}</Text>
              </TouchableOpacity>
              <LanguageSwitcher />
            </View>
          </View>

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

            <Button
              title={t("common.next")}
              onPress={handleSignUp}
              loading={isLoading}
            />
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
    backgroundColor: "#FFFFFF",
  },
  container: {
    flex: 1,
  },
  panel: {
    borderRadius: 18,
    borderWidth: 1.2,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    padding: 10,
    marginTop: 0,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  header: {
    minHeight: 64,
    marginBottom: 18,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  backButton: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    minHeight: 44,
    justifyContent: "center",
  },
  backText: {
    color: "#C9A84C",
    fontSize: 17,
    fontWeight: "600",
  },
  modeToggle: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 8,
  },
  modeButtonActive: {
    backgroundColor: "#FEF3C7",
  },
  modeText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  modeTextActive: {
    color: "#92400E",
  },
  form: {
    marginBottom: 24,
    marginTop: 8,
  },
  roleSection: {
    marginBottom: 32,
  },
  roleTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 16,
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
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    position: "relative",
  },
  roleCardActive: {
    borderColor: "#C9A84C",
    backgroundColor: "#FEF3C7",
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
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  roleLabelActive: {
    color: "#92400E",
  },
  roleDescription: {
    fontSize: 14,
    color: "#4B5563",
  },
  roleDescriptionActive: {
    color: "#111827",
  },
  checkmark: {
    position: "absolute",
    top: 12,
    end: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#C9A84C",
    alignItems: "center",
    justifyContent: "center",
  },
  checkmarkText: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "bold",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    marginTop: 24,
    paddingBottom: 8,
  },
  footerText: {
    fontSize: 14,
    color: "#6B7280",
  },
  footerLink: {
    fontSize: 14,
    color: "#C9A84C",
    fontWeight: "600",
  },
  rtlText: {
    textAlign: "right",
    writingDirection: "rtl",
  },
});
