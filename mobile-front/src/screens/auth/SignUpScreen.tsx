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
import { LinearGradient } from "expo-linear-gradient";
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
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />
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
            <Text style={[styles.title, isRTL && styles.rtlText]}>
              {t("auth.createAccount")}
            </Text>
            <Text style={[styles.subtitle, isRTL && styles.rtlText]}>
              {t("auth.joinToday")}
            </Text>
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
                    <Text style={styles.roleIcon}>{role.icon}</Text>
                    <Text
                      style={[
                        styles.roleLabel,
                        selectedRole === role.value && styles.roleLabelActive,
                      ]}
                    >
                      {role.label}
                    </Text>
                    <Text
                      style={[
                        styles.roleDescription,
                        selectedRole === role.value &&
                          styles.roleDescriptionActive,
                      ]}
                    >
                      {role.description}
                    </Text>

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
    backgroundColor: "#0A0E1A",
  },
  container: {
    flex: 1,
  },
  panel: {
    borderRadius: 18,
    borderWidth: 1.2,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.07)",
    padding: 16,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  header: {
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
    color: "#E8C97A",
    fontSize: 17,
    fontWeight: "600",
  },
  title: {
    fontSize: 34,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#B5B8C9",
  },
  modeToggle: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.10)",
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
    backgroundColor: "rgba(232,201,122,0.16)",
  },
  modeText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#C2C6D8",
  },
  modeTextActive: {
    color: "#E8C97A",
  },
  form: {
    marginBottom: 24,
  },
  roleSection: {
    marginBottom: 32,
  },
  roleTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
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
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.16)",
    position: "relative",
  },
  roleCardActive: {
    borderColor: "#E8C97A",
    backgroundColor: "rgba(232,201,122,0.14)",
  },
  roleIcon: {
    fontSize: 32,
    marginBottom: 12,
  },
  roleLabel: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  roleLabelActive: {
    color: "#E8C97A",
  },
  roleDescription: {
    fontSize: 14,
    color: "#B5B8C9",
  },
  roleDescriptionActive: {
    color: "#FFFFFF",
  },
  checkmark: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#E8C97A",
    alignItems: "center",
    justifyContent: "center",
  },
  checkmarkText: {
    color: "#1A102E",
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
    color: "#B5B8C9",
  },
  footerLink: {
    fontSize: 14,
    color: "#E8C97A",
    fontWeight: "600",
  },
  rtlText: {
    textAlign: "right",
    writingDirection: "rtl",
  },
});
