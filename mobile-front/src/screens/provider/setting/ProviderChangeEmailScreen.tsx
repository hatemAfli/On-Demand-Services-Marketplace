import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { AuthNoticeModal, Input } from "../../../components/common";
import type { ProviderStackParamList } from "../../../navigation/types";
import { useAppTranslation } from "../../../hooks/useAppTranslation";
import { useAuth } from "../../../context/AuthContext";
import { api } from "../../../services/api";
import { getAuthRedirectUrl, supabase } from "../../../services/supabase";

type Nav = NativeStackNavigationProp<
  ProviderStackParamList,
  "ProviderChangeEmail"
>;

export const ProviderChangeEmailScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { t, isRTL } = useAppTranslation();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const currentEmail = user?.email?.trim() ?? "";
  const [email, setEmail] = useState(currentEmail);
  const [error, setError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);
  const [modal, setModal] = useState<{ visible: boolean; message: string }>({
    visible: false,
    message: "",
  });

  const isDirty = useMemo(
    () => email.trim().toLowerCase() !== currentEmail.toLowerCase(),
    [email, currentEmail],
  );

  const onSave = async () => {
    if (isSubmittingRef.current || loading || sentTo) return;

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError(t("validation.emailRequired"));
      return;
    }
    if (!/\S+@\S+\.\S+/.test(normalizedEmail)) {
      setError(t("validation.emailInvalid"));
      return;
    }
    if (normalizedEmail === currentEmail.toLowerCase()) {
      setError(t("provider.settings.changeEmailSameError"));
      return;
    }

    setError(undefined);
    isSubmittingRef.current = true;
    setLoading(true);
    try {
      await api.checkEmailChangeAvailability({ email: normalizedEmail });

      const { error: updateError } = await supabase.auth.updateUser(
        { email: normalizedEmail },
        { emailRedirectTo: `${getAuthRedirectUrl()}?flow=email-change` },
      );

      if (updateError) {
        throw new Error(updateError.message || t("common.error"));
      }

      setSentTo(normalizedEmail);
    } catch (e: any) {
      const status = e?.response?.status;
      const rawMessage = String(e?.response?.data?.message || e?.message || "");
      if (
        status === 409 ||
        rawMessage.toLowerCase().includes("already in use")
      ) {
        setModal({
          visible: true,
          message: t("provider.settings.changeEmailUsedError"),
        });
        return;
      }
      setModal({
        visible: true,
        message: rawMessage || t("common.error"),
      });
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" />

      <View style={[styles.topBackContainer, { top: insets.top + 6 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.8}
        >
          <Text style={styles.backText}>
            {isRTL ? "→" : "←"} {t("common.back")}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 60, paddingBottom: 24 + insets.bottom },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <View style={styles.headerRow}>
              <View style={styles.iconWrap}>
                <Ionicons name="mail-outline" size={20} color="#EA580C" />
              </View>
              <View style={styles.headerTextWrap}>
                <Text style={[styles.title, isRTL && styles.rtlText]}>
                  {t("provider.settings.changeEmailTitle")}
                </Text>
                <Text style={[styles.subtitle, isRTL && styles.rtlText]}>
                  {t("provider.settings.changeEmailSubtitle")}
                </Text>
              </View>
            </View>

            <Input
              label={t("common.email")}
              placeholder={t("common.email")}
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                if (error) setError(undefined);
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              leftIcon="mail-outline"
              error={error}
            />

            <TouchableOpacity
              style={[
                styles.saveButton,
                (!isDirty || loading || Boolean(sentTo)) &&
                  styles.saveButtonDisabled,
              ]}
              onPress={() => void onSave()}
              disabled={!isDirty || loading || Boolean(sentTo)}
              activeOpacity={0.9}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <View style={styles.saveButtonContent}>
                  <Ionicons name="sparkles-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.saveButtonText}>
                    {t("provider.settings.saveEmailButton")}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {sentTo ? (
            <View style={styles.sentCard}>
              <Ionicons name="mail-open-outline" size={24} color="#EA580C" />
              <Text style={styles.sentTitle}>
                {t("provider.settings.changeEmailCheckTitle")}
              </Text>
              <Text style={styles.sentText}>
                {t("provider.settings.changeEmailCheckMessage", {
                  email: sentTo,
                })}
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <AuthNoticeModal
        visible={modal.visible}
        onClose={() => setModal({ visible: false, message: "" })}
        title={t("common.error")}
        message={modal.message}
        primaryLabel={t("common.close")}
        onPrimary={() => setModal({ visible: false, message: "" })}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F1F5F9" },
  container: { flex: 1 },
  topBackContainer: {
    position: "absolute",
    left: 24,
    zIndex: 10,
  },
  backButton: { paddingVertical: 8, paddingHorizontal: 8 },
  backText: { color: "#EA580C", fontSize: 16, fontWeight: "600" },
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
    backgroundColor: "#FFF7ED",
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
  saveButton: {
    alignSelf: "center",
    minWidth: 200,
    height: 48,
    borderRadius: 999,
    backgroundColor: "#EA580C",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#C2410C",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 3,
    marginTop: 10,
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
  sentCard: {
    marginTop: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FFEDD5",
    backgroundColor: "#FFF7ED",
    padding: 14,
    gap: 8,
  },
  sentTitle: { fontSize: 16, fontWeight: "700", color: "#9A3412" },
  sentText: { fontSize: 13, color: "#C2410C" },
  rtlText: {
    textAlign: "right",
    writingDirection: "rtl",
  },
});
