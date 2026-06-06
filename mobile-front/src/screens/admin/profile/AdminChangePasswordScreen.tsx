import React, { useMemo, useRef, useState } from "react";
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
import { supabase } from "../../../services/supabase";
import type { AdminProfileStackParamList } from "./adminProfileNavigation";
import {
  AdminProfileSubHeader,
  profileScreenStyles,
} from "./adminProfileUi";

type Props = NativeStackScreenProps<
  AdminProfileStackParamList,
  "AdminChangePassword"
>;

export const AdminChangePasswordScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
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
    <View style={profileScreenStyles.root}>
      <AdminProfileSubHeader
        title="Change password"
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
              Choose a strong password you do not use elsewhere.
            </Text>
            <Input
              label="New password"
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
              }}
              error={errors.password}
              secureTextEntry
              autoCapitalize="none"
            />
            <Input
              label="Confirm password"
              value={confirmPassword}
              onChangeText={(v) => {
                setConfirmPassword(v);
                if (errors.confirmPassword)
                  setErrors((p) => ({ ...p, confirmPassword: undefined }));
              }}
              error={errors.confirmPassword}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity
            style={[
              profileScreenStyles.saveBtn,
              (!isDirty || loading) && profileScreenStyles.saveBtnDisabled,
            ]}
            onPress={() => void onSave()}
            disabled={!isDirty || loading}
          >
            {loading ? (
              <ActivityIndicator color="#92400E" />
            ) : (
              <Text style={profileScreenStyles.saveBtnText}>Update password</Text>
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
