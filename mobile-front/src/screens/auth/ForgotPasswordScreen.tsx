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

const ACCENT = "#EA580C";
const SCREEN_BG = "#F1F5F9";

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
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
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
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.panel}>
            <View style={styles.heroIconWrap}>
              <Ionicons name="key-outline" size={22} color={ACCENT} />
            </View>
            <Text style={styles.title}>{t("auth.forgotPasswordTitle")}</Text>
            <Text style={styles.subtitle}>{t("auth.forgotPasswordSubtitle")}</Text>

            <View style={styles.form}>
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
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
              onPress={onSendLink}
              activeOpacity={0.9}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <View style={styles.primaryButtonContent}>
                  <Text style={styles.primaryButtonText}>
                    {t("auth.sendPasswordResetLink")}
                  </Text>
                  <View style={styles.primaryButtonIconWrap}>
                    <Ionicons name="mail-outline" size={18} color="#FFFFFF" />
                  </View>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {sentTo ? (
            <View style={styles.sentCard}>
              <View style={styles.sentIconWrap}>
                <Ionicons name="mail-open-outline" size={22} color={ACCENT} />
              </View>
              <Text style={styles.sentTitle}>{t("auth.resetLinkSentTitle")}</Text>
              <Text style={styles.sentText}>
                {t("auth.resetLinkSentMessage", { email: sentTo })}
              </Text>
            </View>
          ) : null}

          <View style={styles.footer}>
            <TouchableOpacity onPress={() => navigation.navigate("Login")}>
              <Text style={styles.footerLink}>{t("auth.backToLogin")}</Text>
            </TouchableOpacity>
          </View>
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
  panel: {
    width: "100%",
    alignSelf: "stretch",
    backgroundColor: SCREEN_BG,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    marginTop: 8,
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
    marginBottom: 14,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.4,
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 20,
    fontSize: 13,
    lineHeight: 20,
    color: "#64748B",
  },
  form: {
    marginBottom: 20,
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
  sentCard: {
    marginTop: 8,
    marginHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FFEDD5",
    backgroundColor: "#FFF7ED",
    padding: 16,
    gap: 8,
  },
  sentIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FFEDD5",
  },
  sentTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#9A3412",
  },
  sentText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#C2410C",
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
