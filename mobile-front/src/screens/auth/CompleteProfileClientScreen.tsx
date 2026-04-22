// src/screens/auth/CompleteProfileClientScreen.tsx

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
  StatusBar,
  Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import { Button, Input, LanguageSwitcher } from "../../components/common";
import { useAppTranslation } from "../../hooks/useAppTranslation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../services/supabase";
import {
  requestPhotoLibraryPermission,
  uploadClientProfileAvatar,
} from "../../services/clientAvatarUpload";
import { COLORS } from "../../constants";

const ACCENT = "#C9A84C";

interface CompleteProfileClientScreenProps {
  navigation: NativeStackNavigationProp<any>;
}

export const CompleteProfileClientScreen: React.FC<
  CompleteProfileClientScreenProps
> = ({ navigation }) => {
  const { completeRegistration } = useAuth();
  const { t, isRTL } = useAppTranslation();
  const insets = useSafeAreaInsets();

  const [formData, setFormData] = useState({
    phoneNumber: "",
    firstName: "",
    lastName: "",
    city: "",
    address: "",
  });

  /** Local preview + MIME from picker (used for format when uploading). */
  const [pickedPhoto, setPickedPhoto] = useState<{
    uri: string;
    mimeType?: string | null;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = t("validation.firstNameRequired");
    } else if (formData.firstName.length < 2) {
      newErrors.firstName = t("validation.firstNameMin");
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = t("validation.lastNameRequired");
    } else if (formData.lastName.length < 2) {
      newErrors.lastName = t("validation.lastNameMin");
    }

    if (formData.phoneNumber && !/^\+?[\d\s-()]+$/.test(formData.phoneNumber)) {
      newErrors.phoneNumber = t("validation.phoneInvalid");
    }

    if (!formData.city.trim()) {
      newErrors.city = t("validation.cityRequired");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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
    } catch (e: unknown) {
      Alert.alert(
        t("common.error"),
        e instanceof Error
          ? e.message
          : t("completeProfile.photoPermissionDenied"),
      );
    }
  };

  const handleNavigateBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate("Welcome");
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        throw new Error("Not signed in");
      }

      let imageUrl: string | undefined;
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

      const profileData = {
        phoneNumber: formData.phoneNumber || undefined,
        firstName: formData.firstName,
        lastName: formData.lastName,
        role: "CLIENT" as const,
        client: {
          city: formData.city,
          address: formData.address || undefined,
          imageUrl,
        },
      };

      try {
        await completeRegistration(profileData);
      } catch (apiErr: unknown) {
        const msg = apiErr instanceof Error ? apiErr.message : String(apiErr);
        throw new Error(
          `${t("completeProfile.registrationFailedPrefix")} ${msg}`,
        );
      }
    } catch (error: unknown) {
      Alert.alert(
        t("common.error"),
        error instanceof Error
          ? error.message
          : t("completeProfile.submitError"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar
        barStyle="dark-content"
        translucent
        backgroundColor="transparent"
      />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + 20,
              paddingBottom: 120 + insets.bottom,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topRow}>
            <TouchableOpacity
              style={styles.navBackButton}
              onPress={handleNavigateBack}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.navBackText}>← {t("common.back")}</Text>
            </TouchableOpacity>
            <LanguageSwitcher />
          </View>

          <View style={styles.panel}>
            <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
              {t("completeProfile.step1Title")}
            </Text>

            <View style={styles.photoBlock}>
              <Text style={[styles.photoLabel, isRTL && styles.rtlText]}>
                {t("completeProfile.profilePhotoLabel")}
              </Text>
              <TouchableOpacity
                style={styles.photoCircle}
                onPress={handlePickPhoto}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={t("completeProfile.tapToChoosePhoto")}
              >
                {pickedPhoto ? (
                  <Image
                    source={{ uri: pickedPhoto.uri }}
                    style={styles.photoImage}
                  />
                ) : (
                  <Ionicons name="camera-outline" size={36} color={ACCENT} />
                )}
                <View style={styles.photoBadge}>
                  <Ionicons name="add" size={18} color="#0b1020" />
                </View>
              </TouchableOpacity>
              <Text style={[styles.photoHint, isRTL && styles.rtlText]}>
                {t("completeProfile.profilePhotoHint")}
              </Text>
            </View>

            <View style={styles.form}>
              <Input
                label={t("completeProfile.firstNameLabel")}
                placeholder={t("completeProfile.firstNamePlaceholder")}
                value={formData.firstName}
                onChangeText={(value) => updateField("firstName", value)}
                leftIcon="person-outline"
                error={errors.firstName}
                autoCapitalize="words"
              />

              <Input
                label={t("completeProfile.lastNameLabel")}
                placeholder={t("completeProfile.lastNamePlaceholder")}
                value={formData.lastName}
                onChangeText={(value) => updateField("lastName", value)}
                leftIcon="person-outline"
                error={errors.lastName}
                autoCapitalize="words"
              />

              <Input
                label={t("completeProfile.phoneLabel")}
                placeholder={t("completeProfile.phonePlaceholder")}
                value={formData.phoneNumber}
                onChangeText={(value) => updateField("phoneNumber", value)}
                leftIcon="call-outline"
                keyboardType="phone-pad"
                error={errors.phoneNumber}
              />

              <Input
                label={t("completeProfile.cityLabel")}
                placeholder={t("completeProfile.cityPlaceholder")}
                value={formData.city}
                onChangeText={(value) => updateField("city", value)}
                leftIcon="business-outline"
                error={errors.city}
                autoCapitalize="words"
              />

              <Input
                label={t("completeProfile.addressLabel")}
                placeholder={t("completeProfile.addressPlaceholder")}
                value={formData.address}
                onChangeText={(value) => updateField("address", value)}
                leftIcon="home-outline"
                multiline
                numberOfLines={2}
              />
            </View>

            <View style={styles.locationTip}>
              <Ionicons
                name="information-circle-outline"
                size={20}
                color={ACCENT}
              />
              <Text style={[styles.locationTipText, isRTL && styles.rtlText]}>
                {t("completeProfile.locationTip")}
              </Text>
            </View>
          </View>
        </ScrollView>

        <View
          style={[
            styles.footer,
            { paddingBottom: 16 + insets.bottom, paddingTop: 16 },
          ]}
        >
          <Button
            title={t("completeProfile.completeButton")}
            onPress={handleSubmit}
            loading={isSubmitting}
            fullWidth
            style={styles.submitButton}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  navBackButton: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    minHeight: 44,
    justifyContent: "center",
  },
  navBackText: {
    color: ACCENT,
    fontSize: 17,
    fontWeight: "600",
  },
  panel: {
    borderRadius: 18,
    borderWidth: 1.2,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    padding: 16,
    marginTop: 20,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 16,
  },
  photoBlock: {
    alignItems: "center",
    marginBottom: 20,
  },
  photoLabel: {
    alignSelf: "stretch",
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 10,
  },
  photoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#F9FAFB",
    borderWidth: 2,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  photoImage: {
    width: "100%",
    height: "100%",
    borderRadius: 60,
  },
  photoBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  photoHint: {
    marginTop: 10,
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    paddingHorizontal: 8,
  },
  form: {
    gap: 8,
  },
  locationTip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    padding: 12,
    borderRadius: 12,
    gap: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  locationTipText: {
    flex: 1,
    fontSize: 13,
    color: "#374151",
    lineHeight: 18,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  submitButton: {
    minWidth: 0,
  },
  rtlText: {
    textAlign: "right",
    writingDirection: "rtl",
  },
});
