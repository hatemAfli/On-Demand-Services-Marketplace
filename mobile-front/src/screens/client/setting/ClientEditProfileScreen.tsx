import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { AuthNoticeModal, Input } from "../../../components/common";
import type { ClientStackParamList } from "../../../navigation/types";
import { useAppTranslation } from "../../../hooks/useAppTranslation";
import { useAuth } from "../../../context/AuthContext";
import { api } from "../../../services/api";
import { supabase } from "../../../services/supabase";
import {
  requestPhotoLibraryPermission,
  uploadClientProfileAvatar,
} from "../../../services/clientAvatarUpload";

type Nav = NativeStackNavigationProp<ClientStackParamList, "ClientEditProfile">;

export const ClientEditProfileScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { t, isRTL } = useAppTranslation();
  const { user, refreshUser } = useAuth();
  const insets = useSafeAreaInsets();

  const initialFirstName = user?.firstName?.trim() ?? "";
  const initialLastName = user?.lastName?.trim() ?? "";
  const initialAvatarUrl = user?.client?.imageUrl?.trim() ?? null;

  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [pickedPhoto, setPickedPhoto] = useState<{
    uri: string;
    mimeType?: string | null;
  } | null>(null);
  const [errors, setErrors] = useState<{
    firstName?: string;
    lastName?: string;
  }>({});
  const [saving, setSaving] = useState(false);
  const [noticeModal, setNoticeModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    isSuccess?: boolean;
  }>({
    visible: false,
    title: "",
    message: "",
    isSuccess: false,
  });

  const isDirty = useMemo(
    () =>
      firstName.trim() !== initialFirstName ||
      lastName.trim() !== initialLastName ||
      Boolean(pickedPhoto),
    [firstName, initialFirstName, initialLastName, lastName, pickedPhoto],
  );

  const displayAvatarUri = pickedPhoto?.uri ?? avatarUrl ?? undefined;

  const validate = () => {
    const nextErrors: { firstName?: string; lastName?: string } = {};
    if (!firstName.trim()) {
      nextErrors.firstName = t("validation.firstNameRequired");
    } else if (firstName.trim().length < 2) {
      nextErrors.firstName = t("validation.firstNameMin");
    }

    if (!lastName.trim()) {
      nextErrors.lastName = t("validation.lastNameRequired");
    } else if (lastName.trim().length < 2) {
      nextErrors.lastName = t("validation.lastNameMin");
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const onSave = async () => {
    if (!validate()) return;
    if (!isDirty) {
      navigation.goBack();
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

      let imageUrl: string | undefined = avatarUrl ?? undefined;
      if (pickedPhoto) {
        try {
          imageUrl = await uploadClientProfileAvatar(
            session.user.id,
            pickedPhoto.uri,
            { mimeType: pickedPhoto.mimeType },
          );
        } catch (uploadErr: unknown) {
          const msg =
            uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
          throw new Error(
            `${t("completeProfile.uploadPhotoFailedPrefix")} ${msg}`,
          );
        }
      }

      await api.updateClientMe({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        imageUrl,
      });
      await refreshUser();
      setAvatarUrl(imageUrl ?? null);
      setPickedPhoto(null);
      setNoticeModal({
        visible: true,
        title: t("client.profile.saveSuccessTitle"),
        message: t("client.profile.saveSuccessMessage"),
        isSuccess: true,
      });
    } catch (e: any) {
      const message =
        e?.response?.data?.message ||
        e?.message ||
        t("client.profile.saveError");
      Alert.alert(
        t("common.error"),
        Array.isArray(message) ? message.join(", ") : message,
      );
    } finally {
      setSaving(false);
    }
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

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" />

      <View style={[styles.topBackContainer, { top: insets.top + 6 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.8}
        >
          <Text style={styles.backText}>
            {isRTL ? "→" : "←"} {t("common.back")}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 60, paddingBottom: 24 + insets.bottom },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <View style={styles.headerRow}>
              <View style={styles.iconWrap}>
                <Ionicons name="person-outline" size={20} color="#EA580C" />
              </View>
              <View style={styles.headerTextWrap}>
                <Text style={[styles.title, isRTL && styles.rtlText]}>
                  {t("client.settings.editProfileTitle")}
                </Text>
              </View>
            </View>

            <View style={styles.avatarSection}>
              <TouchableOpacity
                style={styles.avatarTouchable}
                onPress={() => void handlePickPhoto()}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={t("client.profile.changePhoto")}
              >
                <View style={styles.avatarOuterRing}>
                  <View style={styles.avatarRingInner}>
                    {displayAvatarUri ? (
                      <Image
                        source={{ uri: displayAvatarUri }}
                        style={styles.avatarImg}
                      />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <Ionicons name="person" size={38} color="#F08E10" />
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.avatarEditBadge}>
                  <Ionicons name="camera" size={14} color="#FFFFFF" />
                </View>
              </TouchableOpacity>
              <Text style={[styles.changePhotoText, isRTL && styles.rtlText]}>
                {t("client.profile.changePhoto")}
              </Text>
            </View>

            <View style={styles.form}>
              <Input
                label={t("completeProfile.firstNameLabel")}
                value={firstName}
                onChangeText={(v) => {
                  setFirstName(v);
                  if (errors.firstName)
                    setErrors((prev) => ({ ...prev, firstName: undefined }));
                }}
                leftIcon="person-outline"
                autoCapitalize="words"
                error={errors.firstName}
              />
              <Input
                label={t("completeProfile.lastNameLabel")}
                value={lastName}
                onChangeText={(v) => {
                  setLastName(v);
                  if (errors.lastName)
                    setErrors((prev) => ({ ...prev, lastName: undefined }));
                }}
                leftIcon="person-outline"
                autoCapitalize="words"
                error={errors.lastName}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.saveButton,
                (!isDirty || saving) && styles.saveButtonDisabled,
              ]}
              onPress={() => void onSave()}
              disabled={!isDirty || saving}
              activeOpacity={0.9}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <View style={styles.saveButtonContent}>
                  <Ionicons name="sparkles-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.saveButtonText}>
                    {t("client.settings.saveProfileButton")}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <AuthNoticeModal
        visible={noticeModal.visible}
        onClose={() =>
          setNoticeModal({
            visible: false,
            title: "",
            message: "",
            isSuccess: false,
          })
        }
        title={noticeModal.title}
        message={noticeModal.message}
        primaryLabel={
          noticeModal.isSuccess ? t("common.success") : t("common.close")
        }
        onPrimary={() => {
          const isSuccess = noticeModal.isSuccess === true;
          setNoticeModal({
            visible: false,
            title: "",
            message: "",
            isSuccess: false,
          });
          if (isSuccess) {
            navigation.goBack();
          }
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F1F5F9" },
  container: { flex: 1 },
  topBackContainer: {
    position: "absolute",
    left: 24,
    zIndex: 10,
  },
  backButton: { paddingVertical: 8, paddingHorizontal: 8 },
  backText: { color: "#EA580C", fontSize: 16, fontWeight: "600" },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    padding: 16,
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#FFF7ED",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextWrap: { flex: 1 },
  title: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  subtitle: { marginTop: 4, fontSize: 12, color: "#64748B" },
  avatarSection: {
    alignItems: "center",
    marginBottom: 12,
  },
  avatarTouchable: {
    alignSelf: "center",
    marginBottom: 8,
    position: "relative",
  },
  avatarOuterRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#F08E10",
    padding: 4,
    shadowColor: "#F08E10",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 5,
  },
  avatarRingInner: {
    flex: 1,
    borderRadius: 46,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  avatarImg: {
    width: "100%",
    height: "100%",
    backgroundColor: "#E2E8F0",
  },
  avatarPlaceholder: {
    flex: 1,
    minHeight: 88,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FDBA74",
  },
  avatarEditBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#F08E10",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    shadowColor: "#F08E10",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  changePhotoText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#C2410C",
  },
  form: { gap: 8, marginBottom: 12 },
  saveButton: {
    alignSelf: "center",
    minWidth: 200,
    height: 48,
    borderRadius: 999,
    backgroundColor: "#EA580C",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#C2410C",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 3,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  rtlText: {
    textAlign: "right",
    writingDirection: "rtl",
  },
});
