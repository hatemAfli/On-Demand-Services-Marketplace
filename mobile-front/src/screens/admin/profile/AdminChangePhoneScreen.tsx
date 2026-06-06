import React, { useMemo, useState } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Text,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthNoticeModal, Input } from "../../../components/common";
import { useAuth } from "../../../context/AuthContext";
import { api } from "../../../services/api";
import type { AdminProfileStackParamList } from "./adminProfileNavigation";
import { AdminProfileSubHeader, profileScreenStyles } from "./adminProfileUi";

type Props = NativeStackScreenProps<
  AdminProfileStackParamList,
  "AdminChangePhone"
>;

export const AdminChangePhoneScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const initialPhone = user?.phoneNumber?.trim() ?? "";

  const [phoneNumber, setPhoneNumber] = useState(initialPhone);
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{
    visible: boolean;
    title: string;
    message: string;
    success?: boolean;
  }>({ visible: false, title: "", message: "" });

  const isDirty = useMemo(
    () => phoneNumber.trim() !== initialPhone,
    [phoneNumber, initialPhone],
  );

  const onSave = async () => {
    const normalized = phoneNumber.trim();
    if (!normalized) {
      setError("Phone number is required");
      return;
    }
    if (!/^\+?[0-9][0-9\s\-()]{5,}$/.test(normalized)) {
      setError("Enter a valid phone number");
      return;
    }
    if (!isDirty) {
      navigation.goBack();
      return;
    }

    setError(undefined);
    setSaving(true);
    try {
      await api.updateMyIdentity({ phoneNumber: normalized });
      await refreshUser();
      setNotice({
        visible: true,
        title: "Phone updated",
        message: "Your phone number has been saved.",
        success: true,
      });
    } catch (e: unknown) {
      const data = (e as { response?: { data?: { message?: unknown } } })
        ?.response?.data;
      const msg = data?.message;
      setNotice({
        visible: true,
        title: "Error",
        message: Array.isArray(msg)
          ? msg.join(", ")
          : typeof msg === "string"
            ? msg
            : "Could not save phone number.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={profileScreenStyles.root}>
      <AdminProfileSubHeader
        title="Change phone"
        onBack={() => navigation.goBack()}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        >
          <View style={profileScreenStyles.formCard}>
            <Text style={profileScreenStyles.formHint}>
              Include country code when possible (e.g. +216…).
            </Text>
            <Input
              label="Phone number"
              value={phoneNumber}
              onChangeText={(v) => {
                setPhoneNumber(v);
                if (error) setError(undefined);
              }}
              error={error}
              keyboardType="phone-pad"
            />
          </View>

          <TouchableOpacity
            style={[
              profileScreenStyles.saveBtn,
              (!isDirty || saving) && profileScreenStyles.saveBtnDisabled,
            ]}
            onPress={() => void onSave()}
            disabled={!isDirty || saving}
          >
            {saving ? (
              <ActivityIndicator color="#92400E" />
            ) : (
              <Text style={profileScreenStyles.saveBtnText}>Save phone</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <AuthNoticeModal
        visible={notice.visible}
        onClose={() => {
          setNotice((p) => ({ ...p, visible: false }));
          if (notice.success) navigation.goBack();
        }}
        title={notice.title}
        message={notice.message}
        primaryLabel="OK"
        onPrimary={() => {
          setNotice((p) => ({ ...p, visible: false }));
          if (notice.success) navigation.goBack();
        }}
      />
    </View>
  );
};
