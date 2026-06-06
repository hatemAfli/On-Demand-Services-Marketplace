import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthNoticeModal, Input } from "../../../components/common";
import { useAuth } from "../../../context/AuthContext";
import { api } from "../../../services/api";
import type { AdminProfileStackParamList } from "./adminProfileNavigation";
import {
  AdminProfileSubHeader,
  profileScreenStyles,
} from "./adminProfileUi";

type Props = NativeStackScreenProps<AdminProfileStackParamList, "AdminEditProfile">;

export const AdminEditProfileScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();

  const initialFirst = user?.firstName?.trim() ?? "";
  const initialLast = user?.lastName?.trim() ?? "";

  const [firstName, setFirstName] = useState(initialFirst);
  const [lastName, setLastName] = useState(initialLast);
  const [errors, setErrors] = useState<{ firstName?: string; lastName?: string }>({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{
    visible: boolean;
    title: string;
    message: string;
    success?: boolean;
  }>({ visible: false, title: "", message: "" });

  const isDirty = useMemo(
    () =>
      firstName.trim() !== initialFirst || lastName.trim() !== initialLast,
    [firstName, initialFirst, initialLast, lastName],
  );

  const validate = () => {
    const next: typeof errors = {};
    if (!firstName.trim()) next.firstName = "First name is required";
    if (!lastName.trim()) next.lastName = "Last name is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSave = async () => {
    if (!validate()) return;
    if (!isDirty) {
      navigation.goBack();
      return;
    }

    setSaving(true);
    try {
      await api.updateMyIdentity({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      await refreshUser();
      setNotice({
        visible: true,
        title: "Profile updated",
        message: "Your name has been saved.",
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
            : "Could not save profile.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={profileScreenStyles.root}>
      <AdminProfileSubHeader
        title="Edit profile"
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
              Update how your name appears across the admin panel.
            </Text>
            <Input
              label="First name"
              value={firstName}
              onChangeText={(v) => {
                setFirstName(v);
                if (errors.firstName) setErrors((p) => ({ ...p, firstName: undefined }));
              }}
              error={errors.firstName}
              autoCapitalize="words"
            />
            <Input
              label="Last name"
              value={lastName}
              onChangeText={(v) => {
                setLastName(v);
                if (errors.lastName) setErrors((p) => ({ ...p, lastName: undefined }));
              }}
              error={errors.lastName}
              autoCapitalize="words"
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
              <Text style={profileScreenStyles.saveBtnText}>Save changes</Text>
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
