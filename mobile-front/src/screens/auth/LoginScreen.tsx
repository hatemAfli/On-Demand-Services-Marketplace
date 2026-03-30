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
  Alert,
  StatusBar,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../../context/AuthContext";
import { Button, Input, LanguageSwitcher } from "../../components/common";
import { COLORS } from "../../constants";
import { useAppTranslation } from "../../hooks/useAppTranslation";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type LoginMode = "email" | "phone";

interface LoginScreenProps {
  navigation: NativeStackNavigationProp<any>;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const { loginWithEmail, loginWithPhone, isLoading } = useAuth();
  const { t, isRTL } = useAppTranslation();
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
        await loginWithEmail(email, password);
      } else {
        await loginWithPhone(phone, password);
      }
      // Navigation handled by AuthContext
    } catch (error: any) {
      Alert.alert(t("common.error"), error.message || "An error occurred");
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
              paddingTop: insets.top + 20,
              paddingBottom: 16 + insets.bottom,
            },
          ]}
          keyboardShouldPersistTaps="handled"
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
            <Text style={[styles.title, isRTL && styles.rtlText]}>{t("auth.welcomeBack")}</Text>
            <Text style={[styles.subtitle, isRTL && styles.rtlText]}>
              {t("auth.signInContinue")}
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

              <TouchableOpacity style={styles.forgotPassword}>
                <Text style={styles.forgotPasswordText}>{t("auth.forgotPassword")}</Text>
              </TouchableOpacity>
            </View>

            <Button title={t("common.login")} onPress={handleLogin} loading={isLoading} />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>{t("auth.noAccount")} </Text>
            <TouchableOpacity onPress={() => navigation.navigate("SignUp")}>
              <Text style={styles.footerLink}>{t("auth.createAccount")}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    justifyContent: "flex-start",
  },
  header: {
    marginBottom: 20,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
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
    marginBottom: 20,
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
  forgotPassword: {
    alignSelf: "flex-end",
    marginTop: -12,
    marginBottom: 24,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: "#E8C97A",
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24,
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
