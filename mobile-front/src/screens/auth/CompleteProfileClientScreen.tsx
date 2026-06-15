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
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import { Input } from "../../components/common";
import { useAppTranslation } from "../../hooks/useAppTranslation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../services/supabase";
import {
  requestPhotoLibraryPermission,
  uploadClientProfileAvatar,
} from "../../services/clientAvatarUpload";

const ACCENT = "#EA580C";
const ACCENT_LIGHT = "#FFF7ED";
const ACCENT_BORDER = "#FDBA74";
const SCREEN_BG = "#F1F5F9";

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
      <View style={[styles.topBackContainer, { top: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.navBackButton}
          onPress={handleNavigateBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.navBackText}>← {t("common.back")}</Text>
        </TouchableOpacity>
      </View>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + 64,
              paddingBottom: 120 + insets.bottom,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.panel}>
            <View style={styles.photoBlock}>
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
                  <Ionicons name="camera-outline" size={28} color={ACCENT} />
                )}
                <View style={styles.photoBadge}>
                  <Ionicons name="add" size={16} color="#FFFFFF" />
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
              />
            </View>
          </View>
        </ScrollView>

        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom - 40, 4), paddingTop: 12 },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.submitButton,
              isSubmitting && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            activeOpacity={0.9}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <View style={styles.submitButtonContent}>
                <Text style={styles.submitButtonText}>
                  {t("completeProfile.completeButton")}
                </Text>
                <View style={styles.submitButtonIconWrap}>
                  <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                </View>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: SCREEN_BG,
  },
  topBackContainer: {
    position: "absolute",
    left: 24,
    zIndex: 10,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 0,
  },
  navBackButton: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    minHeight: 44,
    justifyContent: "center",
  },
  navBackText: {
    color: ACCENT,
    fontSize: 16,
    fontWeight: "600",
  },
  panel: {
    width: "100%",
    alignSelf: "stretch",
    backgroundColor: SCREEN_BG,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    minHeight: 400,
  },
  photoBlock: {
    alignItems: "center",
    marginBottom: 16,
  },
  photoCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: ACCENT_LIGHT,
    borderWidth: 2,
    borderColor: ACCENT_BORDER,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  photoImage: {
    width: "100%",
    height: "100%",
    borderRadius: 42,
  },
  photoBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  photoHint: {
    marginTop: 8,
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
    paddingHorizontal: 8,
  },
  form: {
    gap: 8,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    backgroundColor: SCREEN_BG,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  submitButton: {
    width: "100%",
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 3,
  },
  submitButtonDisabled: {
    opacity: 0.65,
  },
  submitButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  submitButtonIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  rtlText: {
    textAlign: "right",
    writingDirection: "rtl",
  },
});
