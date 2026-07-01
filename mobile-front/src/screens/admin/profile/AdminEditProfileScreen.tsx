import React, { useMemo, useState } from "react";
import { View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AuthNoticeModal, Input } from "../../../components/common";
import { useAuth } from "../../../context/AuthContext";
import { api } from "../../../services/api";
import type { AdminProfileStackParamList } from "./adminProfileNavigation";
import {
  AdminFormCard,
  AdminFormCardHeader,
  AdminFormSaveButton,
  AdminProfileInitialsAvatar,
  AdminSettingsFormLayout,
  adminFormStyles,
  initials,
} from "./adminProfileUi";

type Props = NativeStackScreenProps<AdminProfileStackParamList, "AdminEditProfile">;

export const AdminEditProfileScreen: React.FC<Props> = ({ navigation }) => {
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
    else if (firstName.trim().length < 2) next.firstName = "At least 2 characters";
    if (!lastName.trim()) next.lastName = "Last name is required";
    else if (lastName.trim().length < 2) next.lastName = "At least 2 characters";
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
      await api.updateAdminMe({
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
    <AdminSettingsFormLayout onBack={() => navigation.goBack()}>
      <AdminFormCard>
        <AdminFormCardHeader
          icon="person-outline"
          title="Edit profile"
          subtitle="Update how your name appears across the admin panel"
        />

        <AdminProfileInitialsAvatar
          label={initials(firstName, lastName)}
        />

        <View style={adminFormStyles.form}>
          <Input
            label="First name"
            value={firstName}
            onChangeText={(v) => {
              setFirstName(v);
              if (errors.firstName) setErrors((p) => ({ ...p, firstName: undefined }));
            }}
            leftIcon="person-outline"
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
            leftIcon="person-outline"
            error={errors.lastName}
            autoCapitalize="words"
          />
        </View>

        <AdminFormSaveButton
          label="Save profile"
          onPress={() => void onSave()}
          disabled={!isDirty}
          loading={saving}
        />
      </AdminFormCard>

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
    </AdminSettingsFormLayout>
  );
};
