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
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { AuthNoticeModal, Input } from "../../components/common";
import { useAuth } from "../../context/AuthContext";
import { useAppTranslation } from "../../hooks/useAppTranslation";
import { supabase } from "../../services/supabase";

/**
 * Shown after the user opens the password-reset email link.
 * Same layout as `ClientChangePasswordScreen`; on success clears recovery gate and returns to the app.
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
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" />

      <View style={[styles.topHint, { top: insets.top + 6 }]}>
        <Text style={[styles.hintText, isRTL && styles.rtlText]}>
          {t("auth.resetPasswordForcedHint")}
        </Text>
      </View>

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 52, paddingBottom: 24 + insets.bottom },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <View style={styles.headerRow}>
              <View style={styles.iconWrap}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color="#4F46E5"
                />
              </View>
              <View style={styles.headerTextWrap}>
                <Text style={[styles.title, isRTL && styles.rtlText]}>
                  {t("auth.resetPasswordForcedTitle")}
                </Text>
                <Text style={[styles.subtitle, isRTL && styles.rtlText]}>
                  {t("auth.resetPasswordForcedSubtitle")}
                </Text>
              </View>
            </View>

            <View style={styles.form}>
              <Input
                label={t("common.password")}
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
                styles.saveButton,
                (!isDirty || loading) && styles.saveButtonDisabled,
              ]}
              onPress={() => void onSave()}
              disabled={!isDirty || loading}
              activeOpacity={0.9}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <View style={styles.saveButtonContent}>
                  <Ionicons name="sparkles-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.saveButtonText}>
                    {t("auth.resetPasswordUpdateButton")}
                  </Text>
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F1F5F9" },
  container: { flex: 1 },
  topHint: {
    position: "absolute",
    left: 24,
    right: 24,
    zIndex: 10,
  },
  hintText: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  card: {
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextWrap: { flex: 1 },
  title: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  subtitle: { marginTop: 4, fontSize: 12, color: "#64748B" },
  form: { gap: 8, marginBottom: 12 },
  saveButton: {
    alignSelf: "center",
    minWidth: 200,
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
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  rtlText: {
    textAlign: "right",
    writingDirection: "rtl",
  },
});
