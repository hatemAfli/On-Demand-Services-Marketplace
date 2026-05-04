import React, { useState } from "react";
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
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { AuthNoticeModal, Input } from "../../components/common";
import type { AuthStackParamList } from "../../navigation/types";
import { useAppTranslation } from "../../hooks/useAppTranslation";
import { api } from "../../services/api";
import { getPasswordRecoveryRedirectUrl, supabase } from "../../services/supabase";

interface ForgotPasswordScreenProps {
  navigation: NativeStackNavigationProp<AuthStackParamList, "ForgotPassword">;
}

export const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({
  navigation,
}) => {
  const { t } = useAppTranslation();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [modal, setModal] = useState<{ visible: boolean; message: string }>({
    visible: false,
    message: "",
  });

  const onSendLink = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError(t("validation.emailRequired"));
      return;
    }
    if (!/\S+@\S+\.\S+/.test(normalizedEmail)) {
      setError(t("validation.emailInvalid"));
      return;
    }
    setError(undefined);
    setLoading(true);
    try {
      const lookupResponse = await api.lookupMagicLoginAccount({
        email: normalizedEmail,
      });
      if (!lookupResponse.data?.exists) {
        setModal({
          visible: true,
          message: t("auth.magicLoginAccountNotFound"),
        });
        return;
      }

      const { error: sendError } = await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        {
          redirectTo: getPasswordRecoveryRedirectUrl(),
        },
      );

      if (sendError) {
        const rawMessage = sendError.message?.toLowerCase?.() ?? "";
        if (
          rawMessage.includes("user not found") ||
          rawMessage.includes("signup is disabled") ||
          rawMessage.includes("not found")
        ) {
          setModal({
            visible: true,
            message: t("auth.magicLoginAccountNotFound"),
          });
          return;
        }
        throw new Error(sendError.message || t("common.error"));
      }

      setSentTo(normalizedEmail);
    } catch (e: any) {
      setModal({
        visible: true,
        message: e?.message || t("common.error"),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <View style={[styles.topBackContainer, { top: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
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
            { paddingTop: insets.top + 64, paddingBottom: insets.bottom + 16 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.panel}>
            <Text style={styles.title}>{t("auth.forgotPasswordTitle")}</Text>
            <Text style={styles.subtitle}>{t("auth.forgotPasswordSubtitle")}</Text>
            <Input
              label={t("common.email")}
              placeholder={t("common.email")}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              leftIcon="mail-outline"
              error={error}
            />
            <TouchableOpacity
              style={styles.sendButton}
              onPress={onSendLink}
              activeOpacity={0.9}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <View style={styles.sendButtonContent}>
                  <Ionicons name="sparkles-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.sendButtonText}>
                    {t("auth.sendPasswordResetLink")}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {sentTo ? (
            <View style={styles.sentCard}>
              <Ionicons name="mail-open-outline" size={24} color="#4F46E5" />
              <Text style={styles.sentTitle}>{t("auth.resetLinkSentTitle")}</Text>
              <Text style={styles.sentText}>
                {t("auth.resetLinkSentMessage", { email: sentTo })}
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
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F1F5F9" },
  topBackContainer: {
    position: "absolute",
    left: 24,
    zIndex: 10,
  },
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, justifyContent: "center" },
  backButton: { paddingVertical: 8, paddingHorizontal: 8 },
  backText: { color: "#4F46E5", fontSize: 16, fontWeight: "600" },
  title: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: -0.4,
  },
  subtitle: { marginTop: 6, marginBottom: 14, fontSize: 12, color: "#64748B" },
  panel: {
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
  sendButton: {
    alignSelf: "center",
    minWidth: 190,
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
  sendButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sendButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  sentCard: {
    marginTop: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    backgroundColor: "#EEF2FF",
    padding: 14,
    gap: 8,
  },
  sentTitle: { fontSize: 16, fontWeight: "700", color: "#312E81" },
  sentText: { fontSize: 13, color: "#3730A3" },
});
