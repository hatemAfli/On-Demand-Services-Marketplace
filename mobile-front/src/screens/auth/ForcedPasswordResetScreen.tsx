import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AuthNoticeModal, Input } from "../../components/common";
import { useAuth } from "../../context/AuthContext";
import { useAppTranslation } from "../../hooks/useAppTranslation";
import { supabase } from "../../services/supabase";

const ACCENT = "#EA580C";
const SCREEN_BG = "#F1F5F9";

/**
 * Shown after the user opens the password-reset email link.
 * Same layout as `LoginScreen`; on success clears recovery gate and returns to the app.
 */
export const ForcedPasswordResetScreen: React.FC = () => {
  const { t, isRTL } = useAppTranslation();
  const insets = useSafeAreaInsets();
  const { clearPendingPasswordRecovery, refreshUser } = useAuth();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<{
    password?: string;
    confirmPassword?: string;
  }>({});
  const [loading, setLoading] = useState(false);
  const isSubmittingRef = useRef(false);
  const [noticeModal, setNoticeModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    isSuccess?: boolean;
  }>({
    visible: false,
    title: "",
    message: "",
    isSuccess: false,
  });

  const isDirty = useMemo(
    () => password.trim().length > 0 || confirmPassword.trim().length > 0,
    [password, confirmPassword],
  );

  const validate = () => {
    const nextErrors: { password?: string; confirmPassword?: string } = {};
    if (!password) {
      nextErrors.password = t("validation.passwordRequired");
    } else if (password.length < 6) {
      nextErrors.password = t("validation.passwordMin");
    }
    if (!confirmPassword) {
      nextErrors.confirmPassword = t("validation.confirmPasswordRequired");
    } else if (confirmPassword !== password) {
      nextErrors.confirmPassword = t("validation.passwordMismatch");
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const onSave = async () => {
    if (isSubmittingRef.current || loading) return;
    if (!validate()) return;

    isSubmittingRef.current = true;
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        throw new Error(error.message || t("common.error"));
      }

      await clearPendingPasswordRecovery();
      await refreshUser();

      setPassword("");
      setConfirmPassword("");
      setErrors({});

      const msg = t("auth.resetPasswordSuccessMessage");
      if (Platform.OS === "android") {
        ToastAndroid.show(msg, ToastAndroid.LONG);
      } else {
        Alert.alert(t("common.success"), msg);
      }
    } catch (e: any) {
      setNoticeModal({
        visible: true,
        title: t("common.error"),
        message: e?.message || t("common.error"),
        isSuccess: false,
      });
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

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
              paddingTop: insets.top + 48,
              paddingBottom: 16 + insets.bottom,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.panel}>
            <View style={styles.heroRow}>
              <View style={styles.heroIconWrap}>
                <Ionicons name="lock-closed-outline" size={22} color={ACCENT} />
              </View>
              <View style={styles.heroTextWrap}>
                <Text style={[styles.title, isRTL && styles.rtlText]}>
                  {t("auth.resetPasswordForcedTitle")}
                </Text>
                <Text style={[styles.subtitle, isRTL && styles.rtlText]}>
                  {t("auth.resetPasswordForcedSubtitle")}
                </Text>
              </View>
            </View>

            <View style={styles.hintBanner}>
              <Ionicons name="information-circle-outline" size={18} color={ACCENT} />
              <Text style={[styles.hintText, isRTL && styles.rtlText]}>
                {t("auth.resetPasswordForcedHint")}
              </Text>
            </View>

            <View style={styles.form}>
              <Input
                label={t("common.password")}
                placeholder={t("common.password")}
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  if (errors.password) {
                    setErrors((prev) => ({ ...prev, password: undefined }));
                  }
                }}
                leftIcon="lock-closed-outline"
                secureTextEntry
                autoCapitalize="none"
                error={errors.password}
              />
              <Input
                label={t("common.confirmPassword")}
                placeholder={t("common.confirmPassword")}
                value={confirmPassword}
                onChangeText={(v) => {
                  setConfirmPassword(v);
                  if (errors.confirmPassword) {
                    setErrors((prev) => ({
                      ...prev,
                      confirmPassword: undefined,
                    }));
                  }
                }}
                leftIcon="lock-closed-outline"
                secureTextEntry
                autoCapitalize="none"
                error={errors.confirmPassword}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                (!isDirty || loading) && styles.primaryButtonDisabled,
              ]}
              onPress={() => void onSave()}
              disabled={!isDirty || loading}
              activeOpacity={0.9}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <View style={styles.primaryButtonContent}>
                  <Text style={styles.primaryButtonText}>
                    {t("auth.resetPasswordUpdateButton")}
                  </Text>
                  <View style={styles.primaryButtonIconWrap}>
                    <Ionicons
                      name="checkmark-outline"
                      size={18}
                      color="#FFFFFF"
                    />
                  </View>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <AuthNoticeModal
        visible={noticeModal.visible}
        onClose={() =>
          setNoticeModal({
            visible: false,
            title: "",
            message: "",
            isSuccess: false,
          })
        }
        title={noticeModal.title}
        message={noticeModal.message}
        primaryLabel={t("common.close")}
        onPrimary={() =>
          setNoticeModal({
            visible: false,
            title: "",
            message: "",
            isSuccess: false,
          })
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
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 0,
    justifyContent: "center",
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
  heroRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16,
  },
  heroIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FFEDD5",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTextWrap: {
    flex: 1,
    paddingTop: 2,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.4,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 20,
    color: "#64748B",
  },
  hintBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FFEDD5",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 20,
  },
  hintText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: "#9A3412",
    fontWeight: "600",
  },
  form: {
    marginBottom: 20,
    marginTop: 4,
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
  rtlText: {
    textAlign: "right",
    writingDirection: "rtl",
  },
});
