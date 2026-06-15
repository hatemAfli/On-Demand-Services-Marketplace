import React, { useMemo, useRef, useState } from "react";
import { View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AuthNoticeModal, Input } from "../../../components/common";
import { supabase } from "../../../services/supabase";
import type { AdminProfileStackParamList } from "./adminProfileNavigation";
import {
  AdminFormCard,
  AdminFormCardHeader,
  AdminFormSaveButton,
  AdminSettingsFormLayout,
  adminFormStyles,
} from "./adminProfileUi";

type Props = NativeStackScreenProps<
  AdminProfileStackParamList,
  "AdminChangePassword"
>;

export const AdminChangePasswordScreen: React.FC<Props> = ({ navigation }) => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<{
    password?: string;
    confirmPassword?: string;
  }>({});
  const [loading, setLoading] = useState(false);
  const isSubmittingRef = useRef(false);
  const [notice, setNotice] = useState<{
    visible: boolean;
    title: string;
    message: string;
    success?: boolean;
  }>({ visible: false, title: "", message: "" });

  const isDirty = useMemo(
    () => password.trim().length > 0 || confirmPassword.trim().length > 0,
    [password, confirmPassword],
  );

  const validate = () => {
    const next: typeof errors = {};
    if (!password) next.password = "Password is required";
    else if (password.length < 6) next.password = "At least 6 characters";
    if (!confirmPassword) next.confirmPassword = "Please confirm your password";
    else if (confirmPassword !== password)
      next.confirmPassword = "Passwords do not match";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSave = async () => {
    if (isSubmittingRef.current || loading) return;
    if (!validate()) return;

    isSubmittingRef.current = true;
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword("");
      setConfirmPassword("");
      setErrors({});
      setNotice({
        visible: true,
        title: "Password updated",
        message: "Your password was changed successfully.",
        success: true,
      });
    } catch (e: unknown) {
      setNotice({
        visible: true,
        title: "Error",
        message:
          e instanceof Error ? e.message : "Could not update password.",
      });
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <AdminSettingsFormLayout onBack={() => navigation.goBack()}>
      <AdminFormCard>
        <AdminFormCardHeader
          icon="lock-closed-outline"
          title="Change password"
          subtitle="Choose a strong password you do not use elsewhere"
        />

        <View style={adminFormStyles.form}>
          <Input
            label="Password"
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
            }}
            leftIcon="lock-closed-outline"
            secureTextEntry
            autoCapitalize="none"
            error={errors.password}
          />
          <Input
            label="Confirm password"
            value={confirmPassword}
            onChangeText={(v) => {
              setConfirmPassword(v);
              if (errors.confirmPassword)
                setErrors((p) => ({ ...p, confirmPassword: undefined }));
            }}
            leftIcon="lock-closed-outline"
            secureTextEntry
            autoCapitalize="none"
            error={errors.confirmPassword}
          />
        </View>

        <AdminFormSaveButton
          label="Save password"
          onPress={() => void onSave()}
          disabled={!isDirty}
          loading={loading}
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
