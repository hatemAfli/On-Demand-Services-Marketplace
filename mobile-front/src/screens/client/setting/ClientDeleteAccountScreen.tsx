import React, { useRef, useState } from "react";
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
import type { ClientStackParamList } from "../../../navigation/types";
import { useAppTranslation } from "../../../hooks/useAppTranslation";
import { useAuth } from "../../../context/AuthContext";
import { api } from "../../../services/api";

type Nav = NativeStackNavigationProp<
  ClientStackParamList,
  "ClientDeleteAccount"
>;

export const ClientDeleteAccountScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { t, isRTL } = useAppTranslation();
  const { logout } = useAuth();
  const insets = useSafeAreaInsets();

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
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

  const onConfirmDelete = async () => {
    if (isSubmittingRef.current || loading) return;
    if (!password.trim()) {
      setError(t("validation.passwordRequired"));
      return;
    }
    if (password.length < 6) {
      setError(t("validation.passwordMin"));
      return;
    }

    setError(undefined);
    isSubmittingRef.current = true;
    setLoading(true);
    try {
      await api.softDeleteClientAccount({ password });
      setNoticeModal({
        visible: true,
        title: t("client.settings.deleteAccountSuccessTitle"),
        message: t("client.settings.deleteAccountSuccessMessage"),
        isSuccess: true,
      });
    } catch (e: any) {
      const status = e?.response?.status;
      const raw =
        e?.response?.data?.message ?? e?.response?.data?.error ?? e?.message;
      const message = Array.isArray(raw) ? raw.join(", ") : String(raw || "");
      if (status === 401) {
        setNoticeModal({
          visible: true,
          title: t("common.error"),
          message: t("client.settings.deleteAccountWrongPassword"),
          isSuccess: false,
        });
      } else {
        setNoticeModal({
          visible: true,
          title: t("common.error"),
          message: message || t("client.settings.deleteAccountError"),
          isSuccess: false,
        });
      }
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
                <Ionicons name="warning-outline" size={20} color="#DC2626" />
              </View>
              <View style={styles.headerTextWrap}>
                <Text style={[styles.title, isRTL && styles.rtlText]}>
                  {t("client.settings.deleteAccountTitle")}
                </Text>
                <Text style={[styles.subtitle, isRTL && styles.rtlText]}>
                  {t("client.settings.deleteAccountSubtitle")}
                </Text>
              </View>
            </View>

            <View style={styles.warningBox}>
              <Text style={[styles.warningText, isRTL && styles.rtlText]}>
                {t("client.settings.deleteAccountWarning")}
              </Text>
            </View>

            <Input
              label={t("common.password")}
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                if (error) setError(undefined);
              }}
              leftIcon="lock-closed-outline"
              secureTextEntry
              autoCapitalize="none"
              error={error}
            />

            <TouchableOpacity
              style={[
                styles.deleteButton,
                loading && styles.deleteButtonDisabled,
              ]}
              onPress={() => void onConfirmDelete()}
              disabled={loading || !password.trim()}
              activeOpacity={0.9}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <View style={styles.deleteButtonContent}>
                  <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.deleteButtonText}>
                    {t("client.settings.deleteAccountButton")}
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
        primaryLabel={
          noticeModal.isSuccess ? t("common.close") : t("common.close")
        }
        onPrimary={() => {
          const ok = noticeModal.isSuccess === true;
          setNoticeModal({
            visible: false,
            title: "",
            message: "",
            isSuccess: false,
          });
          if (ok) {
            void logout();
          }
        }}
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
  backText: { color: "#4F46E5", fontSize: 16, fontWeight: "600" },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#FECACA",
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
    marginBottom: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextWrap: { flex: 1 },
  title: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "700",
    color: "#991B1B",
    letterSpacing: -0.3,
  },
  subtitle: { marginTop: 4, fontSize: 12, color: "#64748B" },
  warningBox: {
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  warningText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#92400E",
  },
  deleteButton: {
    alignSelf: "center",
    minWidth: 200,
    height: 48,
    borderRadius: 999,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    shadowColor: "#991B1B",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 3,
  },
  deleteButtonDisabled: { opacity: 0.6 },
  deleteButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  deleteButtonText: {
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
