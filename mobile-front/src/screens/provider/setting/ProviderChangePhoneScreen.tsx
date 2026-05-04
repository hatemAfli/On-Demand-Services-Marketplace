import React, { useMemo, useState } from "react";
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

type Nav = NativeStackNavigationProp<
  ProviderStackParamList,
  "ProviderChangePhone"
>;

export const ProviderChangePhoneScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { t, isRTL } = useAppTranslation();
  const { user, refreshUser } = useAuth();
  const insets = useSafeAreaInsets();

  const initialPhone = user?.phoneNumber?.trim() ?? "";
  const [phoneNumber, setPhoneNumber] = useState(initialPhone);
  const [error, setError] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
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
    () => phoneNumber.trim() !== initialPhone,
    [phoneNumber, initialPhone],
  );

  const onSave = async () => {
    const normalized = phoneNumber.trim();
    if (!normalized) {
      setError(t("validation.phoneRequired"));
      return;
    }
    if (!/^\+?[0-9][0-9\s\-()]{5,}$/.test(normalized)) {
      setError(t("validation.phoneInvalid"));
      return;
    }
    if (!isDirty) {
      navigation.goBack();
      return;
    }

    setError(undefined);
    setSaving(true);
    try {
      await api.updateProviderProfile({ phoneNumber: normalized });
      await refreshUser();
      setNoticeModal({
        visible: true,
        title: t("client.profile.saveSuccessTitle"),
        message: t("client.profile.saveSuccessMessage"),
        isSuccess: true,
      });
    } catch (e: any) {
      const message =
        e?.response?.data?.message ||
        e?.message ||
        t("client.profile.saveError");
      setNoticeModal({
        visible: true,
        title: t("common.error"),
        message: Array.isArray(message) ? message.join(", ") : message,
        isSuccess: false,
      });
    } finally {
      setSaving(false);
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
                <Ionicons name="call-outline" size={20} color="#4F46E5" />
              </View>
              <View style={styles.headerTextWrap}>
                <Text style={[styles.title, isRTL && styles.rtlText]}>
                  {t("provider.settings.changePhoneTitle")}
                </Text>
                <Text style={[styles.subtitle, isRTL && styles.rtlText]}>
                  {t("provider.settings.changePhoneSubtitle")}
                </Text>
              </View>
            </View>

            <Input
              label={t("common.phone")}
              placeholder={t("completeProfile.phonePlaceholder")}
              value={phoneNumber}
              onChangeText={(v) => {
                setPhoneNumber(v);
                if (error) setError(undefined);
              }}
              keyboardType="phone-pad"
              autoCapitalize="none"
              leftIcon="call-outline"
              error={error}
            />

            <TouchableOpacity
              style={[
                styles.saveButton,
                (!isDirty || saving) && styles.saveButtonDisabled,
              ]}
              onPress={() => void onSave()}
              disabled={!isDirty || saving}
              activeOpacity={0.9}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <View style={styles.saveButtonContent}>
                  <Ionicons name="sparkles-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.saveButtonText}>
                    {t("provider.settings.savePhoneButton")}
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
          noticeModal.isSuccess ? t("common.success") : t("common.close")
        }
        onPrimary={() => {
          const isSuccess = noticeModal.isSuccess === true;
          setNoticeModal({
            visible: false,
            title: "",
            message: "",
            isSuccess: false,
          });
          if (isSuccess) navigation.goBack();
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
  rtlText: {
    textAlign: "right",
    writingDirection: "rtl",
  },
});
