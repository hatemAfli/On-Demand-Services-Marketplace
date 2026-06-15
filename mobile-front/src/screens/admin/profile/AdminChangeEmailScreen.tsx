import React, { useMemo, useRef, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AuthNoticeModal, Input } from "../../../components/common";
import { useAuth } from "../../../context/AuthContext";
import { api } from "../../../services/api";
import { getAuthRedirectUrl, supabase } from "../../../services/supabase";
import type { AdminProfileStackParamList } from "./adminProfileNavigation";
import {
  AdminFormCard,
  AdminFormCardHeader,
  AdminFormSaveButton,
  AdminFormSentCard,
  AdminSettingsFormLayout,
} from "./adminProfileUi";

type Props = NativeStackScreenProps<AdminProfileStackParamList, "AdminChangeEmail">;

export const AdminChangeEmailScreen: React.FC<Props> = ({ navigation }) => {
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
    <AdminSettingsFormLayout onBack={() => navigation.goBack()}>
      <AdminFormCard>
        <AdminFormCardHeader
          icon="mail-outline"
          title="Change email"
          subtitle="You will receive a confirmation link at the new address"
        />

        <Input
          label="Email"
          placeholder="Email"
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            if (error) setError(undefined);
          }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          leftIcon="mail-outline"
          error={error}
        />

        <AdminFormSaveButton
          label="Save email"
          onPress={() => void onSave()}
          disabled={!isDirty || Boolean(sentTo)}
          loading={loading}
        />
      </AdminFormCard>

      {sentTo ? (
        <AdminFormSentCard
          icon="mail-open-outline"
          title="Check your inbox"
          message={`We sent a confirmation link to ${sentTo}. Open it to finish updating your email.`}
        />
      ) : null}

      <AuthNoticeModal
        visible={notice.visible}
        onClose={() => setNotice({ visible: false, message: "" })}
        title="Error"
        message={notice.message}
        primaryLabel="Close"
        onPrimary={() => setNotice({ visible: false, message: "" })}
      />
    </AdminSettingsFormLayout>
  );
};
