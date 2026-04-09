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
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { Button, Input } from "../../components/common";
import { useAppTranslation } from "../../hooks/useAppTranslation";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import { supabase } from "../../services/supabase";
import {
  requestPhotoLibraryPermission,
  uploadClientProfileAvatar,
} from "../../services/clientAvatarUpload";
import type { UserWithProfile } from "../../types";

const ACCENT = "#E8C97A";

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
      <View style={styles.centered}>
        <LinearGradient
          colors={["#0A0E1A", "#0F172A", "#1E1B4B", "#2D1B69"]}
          style={StyleSheet.absoluteFillObject}
        />
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  if (loadError && !hasLoadedSuccessfullyRef.current) {
    return (
      <View style={styles.centered}>
        <LinearGradient
          colors={["#0A0E1A", "#0F172A", "#1E1B4B", "#2D1B69"]}
          style={StyleSheet.absoluteFillObject}
        />
        <Text style={styles.errorText}>{loadError}</Text>
        <Button title={t("common.retry")} onPress={() => void loadProfile()} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={["#0A0E1A", "#0F172A", "#1E1B4B", "#2D1B69"]}
        locations={[0, 0.35, 0.7, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: 32 + insets.bottom },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.screenSubtitle, isRTL && styles.rtlText]}>
            {t("client.profile.subtitle")}
          </Text>

          {refreshing ? (
            <View style={styles.refreshRow}>
              <ActivityIndicator size="small" color={ACCENT} />
            </View>
          ) : null}

          <View style={styles.heroCard}>
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
                <Ionicons name="person" size={48} color={ACCENT} />
              )}
              <View style={styles.avatarEditBadge}>
                <Ionicons name="camera" size={16} color="#0A0E1A" />
              </View>
            </TouchableOpacity>
            <Text style={[styles.photoHint, isRTL && styles.rtlText]}>
              {t("client.profile.photoHint")}
            </Text>
          </View>

          <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
            {t("client.profile.accountSection")}
          </Text>
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

          <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
            {t("client.profile.locationSection")}
          </Text>
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

          <Button
            title={t("client.profile.saveButton")}
            onPress={() => void handleSave()}
            loading={saving}
            disabled={!isDirty()}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0A0E1A",
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  screenSubtitle: {
    color: "rgba(181,184,201,0.95)",
    fontSize: 15,
    marginBottom: 18,
    lineHeight: 22,
  },
  heroCard: {
    alignItems: "center",
    marginBottom: 22,
  },
  avatarWrap: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 2,
    borderColor: "rgba(232,201,122,0.5)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: {
    width: "100%",
    height: "100%",
    borderRadius: 56,
  },
  avatarEditBadge: {
    position: "absolute",
    bottom: 6,
    right: 6,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#0A0E1A",
  },
  photoHint: {
    marginTop: 10,
    fontSize: 13,
    color: "rgba(181,184,201,0.9)",
    textAlign: "center",
  },
  sectionTitle: {
    color: ACCENT,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 10,
    marginTop: 4,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    padding: 14,
    marginBottom: 18,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  errorText: {
    color: "#fecaca",
    textAlign: "center",
    marginBottom: 16,
    fontSize: 15,
  },
  rtlText: {
    textAlign: "right",
    writingDirection: "rtl",
  },
  refreshRow: {
    alignItems: "center",
    marginBottom: 8,
  },
});
