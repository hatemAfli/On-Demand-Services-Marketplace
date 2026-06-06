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
import { useAuth } from "../../../context/AuthContext";
import { api } from "../../../services/api";
import { getAuthRedirectUrl, supabase } from "../../../services/supabase";
import type { AdminProfileStackParamList } from "./adminProfileNavigation";
import {
  AdminProfileSubHeader,
  profileScreenStyles,
} from "./adminProfileUi";

type Props = NativeStackScreenProps<AdminProfileStackParamList, "AdminChangeEmail">;

export const AdminChangeEmailScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const currentEmail = user?.email?.trim() ?? "";

  const [email, setEmail] = useState(currentEmail);
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);
  const [notice, setNotice] = useState({ visible: false, message: "" });

  const isDirty = useMemo(
    () => email.trim().toLowerCase() !== currentEmail.toLowerCase(),
    [email, currentEmail],
  );

  const onSave = async () => {
    if (isSubmittingRef.current || loading || sentTo) return;

    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      setError("Email is required");
      return;
    }
    if (!/\S+@\S+\.\S+/.test(normalized)) {
      setError("Enter a valid email address");
      return;
    }
    if (normalized === currentEmail.toLowerCase()) {
      setError("Enter a different email address");
      return;
    }

    setError(undefined);
    isSubmittingRef.current = true;
    setLoading(true);
    try {
      await api.checkEmailChangeAvailability({ email: normalized });
      const { error: updateError } = await supabase.auth.updateUser(
        { email: normalized },
        { emailRedirectTo: `${getAuthRedirectUrl()}?flow=email-change` },
      );
      if (updateError) throw updateError;
      setSentTo(normalized);
    } catch (e: unknown) {
      const data = (e as { response?: { data?: { message?: unknown } } })
        ?.response?.data;
      const msg = data?.message ?? (e instanceof Error ? e.message : null);
      setNotice({
        visible: true,
        message: Array.isArray(msg)
          ? msg.join(", ")
          : typeof msg === "string"
            ? msg
            : "Could not start email change.",
      });
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <View style={profileScreenStyles.root}>
      <AdminProfileSubHeader
        title="Change email"
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
            {sentTo ? (
              <Text style={profileScreenStyles.formHint}>
                We sent a confirmation link to {sentTo}. Open it to finish updating
                your email, then sign in again if needed.
              </Text>
            ) : (
              <>
                <Text style={profileScreenStyles.formHint}>
                  Current email: {currentEmail || "—"}. You will receive a
                  confirmation link at the new address.
                </Text>
                <Input
                  label="New email"
                  value={email}
                  onChangeText={(v) => {
                    setEmail(v);
                    if (error) setError(undefined);
                  }}
                  error={error}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </>
            )}
          </View>

          {!sentTo ? (
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
                <Text style={profileScreenStyles.saveBtnText}>Send confirmation</Text>
              )}
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <AuthNoticeModal
        visible={notice.visible}
        onClose={() => setNotice({ visible: false, message: "" })}
        title="Error"
        message={notice.message}
        primaryLabel="Close"
        onPrimary={() => setNotice({ visible: false, message: "" })}
      />
    </View>
  );
};
