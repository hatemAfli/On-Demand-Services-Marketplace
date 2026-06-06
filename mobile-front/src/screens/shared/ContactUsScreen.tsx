import React, { useLayoutEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { AuthNoticeModal } from "../../components/common";
import { useAuth } from "../../context/AuthContext";
import { useAppTranslation } from "../../hooks/useAppTranslation";
import { api } from "../../services/api";

export const ContactUsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { t, isRTL } = useAppTranslation();

  const defaultName = useMemo(
    () =>
      [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() || "",
    [user?.firstName, user?.lastName],
  );

  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(user?.email ?? "");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t("support.contactTitle"),
      headerTitleAlign: "center",
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ marginLeft: 8, padding: 4 }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={24} color="#1A1A2E" />
        </TouchableOpacity>
      ),
      headerRight: () => <View style={{ width: 40, marginRight: 8 }} />,
    });
  }, [navigation, t]);

  const onSubmit = async () => {
    setError(null);
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedSubject = subject.trim();
    const trimmedMessage = message.trim();

    if (trimmedName.length < 2) {
      setError(t("support.contactNameRequired"));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError(t("support.contactEmailInvalid"));
      return;
    }
    if (trimmedSubject.length < 3) {
      setError(t("support.contactSubjectRequired"));
      return;
    }
    if (trimmedMessage.length < 10) {
      setError(t("support.contactMessageRequired"));
      return;
    }

    setSubmitting(true);
    try {
      await api.submitSupportMessage({
        name: trimmedName,
        email: trimmedEmail,
        subject: trimmedSubject,
        message: trimmedMessage,
      });
      setSubject("");
      setMessage("");
      setSuccessVisible(true);
    } catch {
      setError(t("support.contactSubmitError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.heroIconWrap}>
              <Ionicons name="mail-outline" size={24} color="#EA580C" />
            </View>
            <Text style={[styles.heroTitle, isRTL && styles.rtl]}>
              {t("support.contactHeroTitle")}
            </Text>
            <Text style={[styles.heroSub, isRTL && styles.rtl]}>
              {t("support.contactHeroSub")}
            </Text>
          </View>

          <View style={styles.formCard}>
            <Field
              label={t("support.contactName")}
              value={name}
              onChangeText={setName}
              isRTL={isRTL}
            />
            <Field
              label={t("support.contactEmail")}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              isRTL={isRTL}
            />
            <Field
              label={t("support.contactSubject")}
              value={subject}
              onChangeText={setSubject}
              isRTL={isRTL}
            />
            <Field
              label={t("support.contactMessage")}
              value={message}
              onChangeText={setMessage}
              multiline
              isRTL={isRTL}
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
              onPress={() => void onSubmit()}
              disabled={submitting}
              activeOpacity={0.9}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitText}>{t("support.contactSubmit")}</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <AuthNoticeModal
        visible={successVisible}
        onClose={() => {
          setSuccessVisible(false);
          navigation.goBack();
        }}
        title={t("support.contactSuccessTitle")}
        message={t("support.contactSuccessMessage")}
        primaryLabel={t("common.close")}
        onPrimary={() => {
          setSuccessVisible(false);
          navigation.goBack();
        }}
      />
    </SafeAreaView>
  );
};

function Field({
  label,
  value,
  onChangeText,
  multiline,
  keyboardType,
  autoCapitalize,
  isRTL,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  multiline?: boolean;
  keyboardType?: "default" | "email-address";
  autoCapitalize?: "none" | "sentences";
  isRTL: boolean;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.label, isRTL && styles.rtl]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? (multiline ? "sentences" : "words")}
        style={[
          styles.input,
          multiline && styles.inputMultiline,
          isRTL && styles.rtl,
        ]}
        placeholderTextColor="#94A3B8"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAFC" },
  flex: { flex: 1 },
  content: { padding: 20, paddingBottom: 32 },
  hero: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FFEDD5",
  },
  heroIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#FFF7ED",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0F172A",
    marginBottom: 6,
  },
  heroSub: {
    fontSize: 13,
    lineHeight: 20,
    color: "#64748B",
    fontWeight: "600",
  },
  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  fieldWrap: { marginBottom: 14 },
  label: {
    fontSize: 12,
    fontWeight: "800",
    color: "#475569",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
    backgroundColor: "#F8FAFC",
  },
  inputMultiline: {
    minHeight: 120,
    textAlignVertical: "top",
  },
  errorText: {
    color: "#DC2626",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 10,
  },
  submitBtn: {
    marginTop: 6,
    backgroundColor: "#EA580C",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    shadowColor: "#C2410C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
  rtl: { textAlign: "right" },
});
