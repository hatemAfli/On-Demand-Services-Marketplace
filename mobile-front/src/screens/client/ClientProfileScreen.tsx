import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  StatusBar,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { Button, Input } from "../../components/common";
import { COLORS } from "../../constants";
import { useAppTranslation } from "../../hooks/useAppTranslation";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import { supabase } from "../../services/supabase";
import {
  requestPhotoLibraryPermission,
  uploadClientProfileAvatar,
} from "../../services/clientAvatarUpload";
import type { UserWithProfile } from "../../types";

const PAGE_BG = "#F8FAFC";
const CARD_BORDER = "#F3F4F6";
const INDIGO_SOFT = "#EEF2FF";

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  city: string;
  address: string;
};

const emptyForm: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  phoneNumber: "",
  city: "",
  address: "",
};

export const ClientProfileScreen: React.FC = () => {
  const { t, isRTL } = useAppTranslation();
  const { refreshUser } = useAuth();
  const insets = useSafeAreaInsets();

  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [initialSnapshot, setInitialSnapshot] = useState<FormState | null>(
    null,
  );
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [initialAvatarUrl, setInitialAvatarUrl] = useState<string | null>(null);
  const [pickedPhoto, setPickedPhoto] = useState<{
    uri: string;
    mimeType?: string | null;
  } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  /** After first successful load, refetches use a silent refresh (no full-screen spinner). */
  const hasLoadedSuccessfullyRef = useRef(false);

  const loadProfile = useCallback(async () => {
    const silent = hasLoadedSuccessfullyRef.current;
    setLoadError(null);
    if (silent) {
      setRefreshing(true);
    } else {
      setInitialLoading(true);
    }
    try {
      const res = await api.getClientMe();
      const u = res.data as UserWithProfile;
      const next: FormState = {
        firstName: u.firstName ?? "",
        lastName: u.lastName ?? "",
        email: u.email ?? "",
        phoneNumber: u.phoneNumber ?? "",
        city: u.client?.city ?? "",
        address: u.client?.address ?? "",
      };
      setForm(next);
      setInitialSnapshot(next);
      const img = u.client?.imageUrl ?? null;
      setAvatarUrl(img);
      setInitialAvatarUrl(img);
      setPickedPhoto(null);
      setErrors({});
      hasLoadedSuccessfullyRef.current = true;
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? (e instanceof Error ? e.message : "");
      const text = msg || t("client.profile.loadError");
      if (silent) {
        Alert.alert(t("common.error"), text);
      } else {
        setLoadError(text);
      }
    } finally {
      if (silent) {
        setRefreshing(false);
      } else {
        setInitialLoading(false);
      }
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile]),
  );

  const updateField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const n = { ...prev };
        delete n[key];
        return n;
      });
    }
  };

  const displayAvatarUri = pickedPhoto?.uri ?? avatarUrl ?? undefined;

  const isDirty = (): boolean => {
    if (pickedPhoto) return true;
    if (!initialSnapshot) return false;
    return (
      form.firstName !== initialSnapshot.firstName ||
      form.lastName !== initialSnapshot.lastName ||
      form.email !== initialSnapshot.email ||
      form.phoneNumber !== initialSnapshot.phoneNumber ||
      form.city !== initialSnapshot.city ||
      form.address !== initialSnapshot.address
    );
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) {
      e.firstName = t("validation.firstNameRequired");
    } else if (form.firstName.trim().length < 2) {
      e.firstName = t("validation.firstNameMin");
    }
    if (!form.lastName.trim()) {
      e.lastName = t("validation.lastNameRequired");
    } else if (form.lastName.trim().length < 2) {
      e.lastName = t("validation.lastNameMin");
    }
    if (!form.email.trim()) {
      e.email = t("validation.emailRequired");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      e.email = t("validation.emailInvalid");
    }
    if (form.phoneNumber && !/^\+?[\d\s-()]+$/.test(form.phoneNumber)) {
      e.phoneNumber = t("validation.phoneInvalid");
    }
    if (!form.city.trim()) {
      e.city = t("validation.cityRequired");
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handlePickPhoto = async () => {
    try {
      const ok = await requestPhotoLibraryPermission();
      if (!ok) {
        Alert.alert(
          t("common.error"),
          t("completeProfile.photoPermissionDenied"),
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        const asset = result.assets[0];
        setPickedPhoto({
          uri: asset.uri,
          mimeType: asset.mimeType ?? undefined,
        });
      }
    } catch (err: unknown) {
      Alert.alert(
        t("common.error"),
        err instanceof Error
          ? err.message
          : t("completeProfile.photoPermissionDenied"),
      );
    }
  };

  const handleSave = async () => {
    if (!validate()) return;
    if (!isDirty()) {
      Alert.alert(t("common.error"), t("client.profile.noChanges"));
      return;
    }

    setSaving(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        throw new Error("Not signed in");
      }

      let imageUrl: string | undefined =
        avatarUrl ?? undefined;

      if (pickedPhoto) {
        try {
          imageUrl = await uploadClientProfileAvatar(
            session.user.id,
            pickedPhoto.uri,
            { mimeType: pickedPhoto.mimeType },
          );
        } catch (uploadErr: unknown) {
          const msg =
            uploadErr instanceof Error
              ? uploadErr.message
              : String(uploadErr);
          throw new Error(
            `${t("completeProfile.uploadPhotoFailedPrefix")} ${msg}`,
          );
        }
      }

      const payload: Record<string, string | undefined> = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phoneNumber: form.phoneNumber.trim() || undefined,
        city: form.city.trim(),
        address: form.address.trim() || undefined,
      };

      if (pickedPhoto || imageUrl !== initialAvatarUrl) {
        payload.imageUrl = imageUrl;
      }

      await api.updateClientMe(payload);
      await refreshUser();

      setPickedPhoto(null);
      setAvatarUrl(imageUrl ?? null);
      setInitialAvatarUrl(imageUrl ?? null);
      setInitialSnapshot({ ...form });
      setErrors({});

      Alert.alert(
        t("client.profile.saveSuccessTitle"),
        t("client.profile.saveSuccessMessage"),
      );
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message ??
        (err instanceof Error ? err.message : "");
      const flat =
        typeof msg === "string"
          ? msg
          : Array.isArray(msg)
            ? msg.join(", ")
            : t("client.profile.saveError");
      Alert.alert(t("common.error"), flat);
    } finally {
      setSaving(false);
    }
  };

  if (initialLoading && !hasLoadedSuccessfullyRef.current) {
    return (
      <SafeAreaView style={styles.centeredSafe} edges={["bottom"]}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (loadError && !hasLoadedSuccessfullyRef.current) {
    return (
      <SafeAreaView style={styles.centeredSafe} edges={["bottom"]}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.errorIconWrap}>
          <Ionicons name="cloud-offline-outline" size={40} color={COLORS.gray[400]} />
        </View>
        <Text style={styles.errorTitle}>{t("common.error")}</Text>
        <Text style={styles.errorText}>{loadError}</Text>
        <Button title={t("common.retry")} onPress={() => void loadProfile()} />
      </SafeAreaView>
    );
  }

  const displayName = [form.firstName, form.lastName]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" ");

  return (
    <SafeAreaView style={styles.safeRoot} edges={["bottom"]}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: 28 + insets.bottom },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {refreshing ? (
            <View style={styles.refreshRow}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.refreshLabel}>{t("client.profile.refreshing")}</Text>
            </View>
          ) : null}

          <View style={styles.heroCard}>
            <View style={styles.heroBlob} />
            <TouchableOpacity
              style={styles.avatarWrap}
              onPress={handlePickPhoto}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t("client.profile.changePhoto")}
            >
              {displayAvatarUri ? (
                <Image
                  source={{ uri: displayAvatarUri }}
                  style={styles.avatarImg}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={44} color={COLORS.primary} />
                </View>
              )}
              <View style={styles.avatarEditBadge}>
                <Ionicons name="camera" size={15} color={COLORS.white} />
              </View>
            </TouchableOpacity>
            {displayName.length > 0 ? (
              <Text style={[styles.displayName, isRTL && styles.rtlText]}>
                {displayName}
              </Text>
            ) : null}
          </View>

          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
              {t("client.profile.accountSection")}
            </Text>
            <View style={styles.sectionRule} />
          </View>
          <View style={styles.card}>
            <Input
              label={t("completeProfile.firstNameLabel")}
              value={form.firstName}
              onChangeText={(v) => updateField("firstName", v)}
              leftIcon="person-outline"
              error={errors.firstName}
              autoCapitalize="words"
            />
            <Input
              label={t("completeProfile.lastNameLabel")}
              value={form.lastName}
              onChangeText={(v) => updateField("lastName", v)}
              leftIcon="person-outline"
              error={errors.lastName}
              autoCapitalize="words"
            />
            <Input
              label={t("common.email")}
              value={form.email}
              onChangeText={(v) => updateField("email", v)}
              leftIcon="mail-outline"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              error={errors.email}
            />
            <Input
              label={t("completeProfile.phoneLabel")}
              value={form.phoneNumber}
              onChangeText={(v) => updateField("phoneNumber", v)}
              leftIcon="call-outline"
              keyboardType="phone-pad"
              error={errors.phoneNumber}
            />
          </View>

          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
              {t("client.profile.locationSection")}
            </Text>
            <View style={styles.sectionRule} />
          </View>
          <View style={styles.card}>
            <Input
              label={t("completeProfile.cityLabel")}
              value={form.city}
              onChangeText={(v) => updateField("city", v)}
              leftIcon="business-outline"
              error={errors.city}
              autoCapitalize="words"
            />
            <Input
              label={t("completeProfile.addressLabel")}
              value={form.address}
              onChangeText={(v) => updateField("address", v)}
              leftIcon="home-outline"
              multiline
              numberOfLines={3}
            />
          </View>

          {isDirty() ? (
            <View style={styles.dirtyPill}>
              <View style={styles.dirtyDot} />
              <Text style={styles.dirtyPillText}>
                {t("client.profile.unsavedHint")}
              </Text>
            </View>
          ) : null}

          <Button
            title={t("client.profile.saveButton")}
            onPress={() => void handleSave()}
            loading={saving}
            disabled={!isDirty()}
            style={styles.saveButton}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeRoot: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  heroCard: {
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    paddingVertical: 28,
    paddingHorizontal: 20,
    marginBottom: 28,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  heroBlob: {
    position: "absolute",
    top: -36,
    right: -28,
    width: 140,
    height: 140,
    borderRadius: 48,
    backgroundColor: INDIGO_SOFT,
    transform: [{ rotate: "12deg" }],
  },
  avatarWrap: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: INDIGO_SOFT,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 3,
    borderColor: COLORS.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  avatarPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: INDIGO_SOFT,
  },
  avatarImg: {
    width: "100%",
    height: "100%",
    borderRadius: 52,
  },
  avatarEditBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: COLORS.white,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  displayName: {
    marginTop: 14,
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.text.primary,
    textAlign: "center",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },
  sectionTitle: {
    color: COLORS.text.primary,
    fontSize: 18,
    fontWeight: "800",
  },
  sectionRule: {
    flex: 1,
    height: 1,
    backgroundColor: CARD_BORDER,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: 16,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  dirtyPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 8,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    marginTop: 12,
    marginBottom: 8,
  },
  dirtyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.warning,
  },
  dirtyPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#92400E",
  },
  saveButton: {
    marginTop: 8,
    borderRadius: 16,
  },
  centeredSafe: {
    flex: 1,
    backgroundColor: PAGE_BG,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  errorIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text.primary,
    marginBottom: 8,
  },
  errorText: {
    color: COLORS.text.secondary,
    textAlign: "center",
    marginBottom: 20,
    fontSize: 15,
    lineHeight: 22,
  },
  rtlText: {
    textAlign: "right",
    writingDirection: "rtl",
  },
  refreshRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 14,
  },
  refreshLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text.secondary,
  },
});
