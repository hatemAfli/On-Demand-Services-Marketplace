import React, { useMemo, useRef, useState } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import MapView, { Marker, Region, PROVIDER_GOOGLE } from "react-native-maps";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import Constants, { ExecutionEnvironment } from "expo-constants";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import type { ProviderStackParamList } from "../../../navigation/types";
import type { ProviderGender } from "../../../types";
import { useAppTranslation } from "../../../hooks/useAppTranslation";
import { useAuth } from "../../../context/AuthContext";
import { Input, AuthNoticeModal } from "../../../components/common";
import { api } from "../../../services/api";
import {
  requestPhotoLibraryPermission,
  uploadClientProfileAvatar,
} from "../../../services/clientAvatarUpload";
import { supabase } from "../../../services/supabase";
import { OsmLocationPicker } from "../../../components/maps/OsmLocationPicker";

type Nav = NativeStackNavigationProp<
  ProviderStackParamList,
  "ProviderEditProfile"
>;

const USE_OSM_WEB_MAP =
  Platform.OS === "android" &&
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

const DEFAULT_REGION: Region = {
  latitude: 36.8065,
  longitude: 10.1815,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

export const ProviderEditProfileScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useAppTranslation();
  const { user, refreshUser } = useAuth();

  const initialFirstName = user?.firstName?.trim() ?? "";
  const initialLastName = user?.lastName?.trim() ?? "";
  const initialCity = user?.provider?.city?.trim() ?? "";
  const initialAddress = user?.provider?.address?.trim() ?? "";
  const initialPhotoUrl = user?.provider?.photoUrl?.trim() ?? null;
  const initialLatitude = user?.provider?.latitude?.toString() ?? "";
  const initialLongitude = user?.provider?.longitude?.toString() ?? "";
  const initialTagline = user?.provider?.tagline?.trim() ?? "";
  const initialBio = user?.provider?.bio?.trim() ?? "";
  const initialYearsStr =
    user?.provider?.yearsOfExperience != null &&
    Number.isFinite(user.provider.yearsOfExperience)
      ? String(user.provider.yearsOfExperience)
      : "";
  const initialLanguagesStr = (user?.provider?.languagesSpoken ?? [])
    .map((x) => String(x).trim())
    .filter(Boolean)
    .join(", ");
  const initialGender = (user?.provider?.gender ??
    null) as ProviderGender | null;

  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [city, setCity] = useState(initialCity);
  const [address, setAddress] = useState(initialAddress);
  const [latitude, setLatitude] = useState(initialLatitude);
  const [longitude, setLongitude] = useState(initialLongitude);
  const [tagline, setTagline] = useState(initialTagline);
  const [bio, setBio] = useState(initialBio);
  const [yearsStr, setYearsStr] = useState(initialYearsStr);
  const [languagesStr, setLanguagesStr] = useState(initialLanguagesStr);
  const [gender, setGender] = useState<ProviderGender | null>(initialGender);
  const [photoUrl, setPhotoUrl] = useState<string | null>(initialPhotoUrl);
  const [pickedPhoto, setPickedPhoto] = useState<{
    uri: string;
    mimeType?: string | null;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const mapRef = useRef<MapView | null>(null);
  const [noticeModal, setNoticeModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    isSuccess?: boolean;
  }>({ visible: false, title: "", message: "", isSuccess: false });

  const isDirty = useMemo(
    () =>
      firstName.trim() !== initialFirstName ||
      lastName.trim() !== initialLastName ||
      city.trim() !== initialCity ||
      address.trim() !== initialAddress ||
      latitude.trim() !== initialLatitude ||
      longitude.trim() !== initialLongitude ||
      tagline.trim() !== initialTagline ||
      bio.trim() !== initialBio ||
      yearsStr.trim() !== initialYearsStr ||
      languagesStr.trim() !== initialLanguagesStr ||
      (gender ?? null) !== (initialGender ?? null) ||
      Boolean(pickedPhoto),
    [
      firstName,
      lastName,
      city,
      address,
      latitude,
      longitude,
      tagline,
      bio,
      yearsStr,
      languagesStr,
      gender,
      pickedPhoto,
      initialFirstName,
      initialLastName,
      initialCity,
      initialAddress,
      initialLatitude,
      initialLongitude,
      initialTagline,
      initialBio,
      initialYearsStr,
      initialLanguagesStr,
      initialGender,
    ],
  );

  const mapRegion = useMemo<Region>(() => {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return {
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.06,
        longitudeDelta: 0.06,
      };
    }
    return DEFAULT_REGION;
  }, [latitude, longitude]);

  const markerCoordinate = useMemo(
    () => ({ latitude: mapRegion.latitude, longitude: mapRegion.longitude }),
    [mapRegion.latitude, mapRegion.longitude],
  );

  const displayAvatarUri = pickedPhoto?.uri ?? photoUrl ?? undefined;

  const applyCoords = (lat: number, lng: number) => {
    const la = Math.round(lat * 1e6) / 1e6;
    const lo = Math.round(lng * 1e6) / 1e6;
    setLatitude(String(la));
    setLongitude(String(lo));
    mapRef.current?.animateToRegion(
      {
        latitude: la,
        longitude: lo,
        latitudeDelta: 0.06,
        longitudeDelta: 0.06,
      },
      280,
    );
  };

  const onPickPhoto = async () => {
    const ok = await requestPhotoLibraryPermission();
    if (!ok)
      return Alert.alert(
        t("common.error"),
        t("completeProfile.photoPermissionDenied"),
      );
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      const asset = result.assets[0];
      setPickedPhoto({ uri: asset.uri, mimeType: asset.mimeType ?? undefined });
    }
  };

  const onUseMyLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted")
        throw new Error(t("completeProfile.locationPermissionDenied"));
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      applyCoords(pos.coords.latitude, pos.coords.longitude);
    } catch (e: any) {
      Alert.alert(
        t("common.error"),
        e?.message || t("completeProfile.locationPermissionDenied"),
      );
    } finally {
      setLocating(false);
    }
  };

  const onSave = async () => {
    if (!isDirty) return navigation.goBack();
    if (!firstName.trim())
      return Alert.alert(t("common.error"), t("validation.firstNameRequired"));
    if (!lastName.trim())
      return Alert.alert(t("common.error"), t("validation.lastNameRequired"));

    const yearsTrim = yearsStr.trim();
    let yearsOfExperience: number | null;
    if (yearsTrim === "") {
      yearsOfExperience = null;
    } else {
      const y = parseInt(yearsTrim, 10);
      if (!Number.isFinite(y) || y < 0 || y > 80) {
        return Alert.alert(
          t("common.error"),
          t("provider.settings.yearsExperienceInvalid"),
        );
      }
      yearsOfExperience = y;
    }

    const languagesSpoken = languagesStr
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    setSaving(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user?.id) throw new Error("Not signed in");

      let nextPhotoUrl: string | undefined = photoUrl ?? undefined;
      if (pickedPhoto) {
        nextPhotoUrl = await uploadClientProfileAvatar(
          session.user.id,
          pickedPhoto.uri,
          {
            mimeType: pickedPhoto.mimeType,
          },
        );
      }

      await api.updateProviderProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        city: city.trim() || undefined,
        address: address.trim() || undefined,
        latitude: latitude.trim() ? Number(latitude.trim()) : undefined,
        longitude: longitude.trim() ? Number(longitude.trim()) : undefined,
        photoUrl: nextPhotoUrl,
        tagline: tagline.trim() || null,
        bio: bio.trim() || null,
        yearsOfExperience,
        languagesSpoken,
        gender,
      });
      await refreshUser();
      setPhotoUrl(nextPhotoUrl ?? null);
      setPickedPhoto(null);
      setNoticeModal({
        visible: true,
        title: t("client.profile.saveSuccessTitle"),
        message: t("client.profile.saveSuccessMessage"),
        isSuccess: true,
      });
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        t("client.profile.saveError");
      Alert.alert(
        t("common.error"),
        Array.isArray(msg) ? msg.join(", ") : String(msg),
      );
    } finally {
      setSaving(false);
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
                <Ionicons name="person-outline" size={20} color="#4F46E5" />
              </View>
              <View style={styles.headerTextWrap}>
                <Text style={[styles.title, isRTL && styles.rtlText]}>
                  {t("provider.settings.editProfileTitle")}
                </Text>
              </View>
            </View>

            <View style={styles.avatarSection}>
              <TouchableOpacity
                style={styles.avatarTouchable}
                onPress={() => void onPickPhoto()}
                activeOpacity={0.85}
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
                  <Ionicons name="camera" size={14} color="#FFF" />
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.form}>
              <Input
                label={t("completeProfile.firstNameLabel")}
                value={firstName}
                onChangeText={setFirstName}
                leftIcon="person-outline"
              />
              <Input
                label={t("completeProfile.lastNameLabel")}
                value={lastName}
                onChangeText={setLastName}
                leftIcon="person-outline"
              />
              <Input
                label={t("completeProfile.cityLabel")}
                value={city}
                onChangeText={setCity}
                leftIcon="business-outline"
              />
              <Input
                label={t("completeProfile.addressLabel")}
                value={address}
                onChangeText={setAddress}
                leftIcon="location-outline"
              />
            </View>

            <Text style={[styles.subsectionTitle, isRTL && styles.rtlText]}>
              {t("provider.settings.editProfileProfessionalSection")}
            </Text>
            <View style={styles.form}>
              <Input
                label={t("provider.settings.taglineLabel")}
                value={tagline}
                onChangeText={setTagline}
                placeholder={t("provider.settings.taglinePlaceholder")}
                leftIcon="megaphone-outline"
                maxLength={220}
              />
              <Input
                label={t("provider.settings.bioLabel")}
                value={bio}
                onChangeText={setBio}
                placeholder={t("provider.settings.bioPlaceholder")}
                leftIcon="document-text-outline"
                multiline
                numberOfLines={5}
              />
              <Input
                label={t("provider.settings.yearsExperienceLabel")}
                value={yearsStr}
                onChangeText={setYearsStr}
                placeholder={t("provider.settings.yearsExperiencePlaceholder")}
                leftIcon="time-outline"
                keyboardType="number-pad"
              />
              <Input
                label={t("provider.settings.languagesLabel")}
                value={languagesStr}
                onChangeText={setLanguagesStr}
                placeholder={t("provider.settings.languagesPlaceholder")}
                leftIcon="language-outline"
              />
              <Text style={[styles.fieldHint, isRTL && styles.rtlText]}>
                {t("provider.settings.languagesHint")}
              </Text>
              <Text style={[styles.genderFieldLabel, isRTL && styles.rtlText]}>
                {t("provider.settings.genderLabel")}
              </Text>
              <View style={styles.genderChips}>
                {(
                  [
                    {
                      value: null as ProviderGender | null,
                      labelKey: "provider.settings.genderUnset",
                    },
                    {
                      value: "FEMALE" as const,
                      labelKey: "provider.settings.genderFemale",
                    },
                    {
                      value: "MALE" as const,
                      labelKey: "provider.settings.genderMale",
                    },
                  ] as const
                ).map((opt) => {
                  const active = (gender ?? null) === (opt.value ?? null);
                  return (
                    <TouchableOpacity
                      key={String(opt.value ?? "unset")}
                      style={[
                        styles.genderChip,
                        active && styles.genderChipActive,
                      ]}
                      onPress={() => setGender(opt.value)}
                      activeOpacity={0.85}
                    >
                      <Text
                        style={[
                          styles.genderChipText,
                          active && styles.genderChipTextActive,
                        ]}
                      >
                        {t(opt.labelKey)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.mapWrap}>
              {USE_OSM_WEB_MAP ? (
                <OsmLocationPicker
                  latitude={latitude}
                  longitude={longitude}
                  onCoordinateChange={applyCoords}
                />
              ) : (
                <MapView
                  ref={mapRef}
                  style={styles.map}
                  provider={
                    Platform.OS === "android" ? PROVIDER_GOOGLE : undefined
                  }
                  region={mapRegion}
                  onPress={(e) =>
                    applyCoords(
                      e.nativeEvent.coordinate.latitude,
                      e.nativeEvent.coordinate.longitude,
                    )
                  }
                >
                  <Marker
                    coordinate={markerCoordinate}
                    draggable
                    onDragEnd={(e) =>
                      applyCoords(
                        e.nativeEvent.coordinate.latitude,
                        e.nativeEvent.coordinate.longitude,
                      )
                    }
                  />
                </MapView>
              )}
              <TouchableOpacity
                style={[styles.mapFab, locating && styles.mapFabDisabled]}
                onPress={() => void onUseMyLocation()}
                disabled={locating}
                activeOpacity={0.85}
              >
                {locating ? (
                  <ActivityIndicator color="#0A0E1A" size="small" />
                ) : (
                  <Ionicons name="locate" size={24} color="#0A0E1A" />
                )}
              </TouchableOpacity>
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
                    {t("provider.settings.saveProfileButton")}
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
          const success = noticeModal.isSuccess === true;
          setNoticeModal({
            visible: false,
            title: "",
            message: "",
            isSuccess: false,
          });
          if (success) navigation.goBack();
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F1F5F9" },
  container: { flex: 1 },
  topBackContainer: { position: "absolute", left: 24, zIndex: 10 },
  backButton: { paddingVertical: 8, paddingHorizontal: 8 },
  backText: { color: "#4F46E5", fontSize: 16, fontWeight: "600" },
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
    backgroundColor: "#EEF2FF",
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
  avatarSection: { alignItems: "center", marginBottom: 12 },
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
  avatarImg: { width: "100%", height: "100%", backgroundColor: "#E2E8F0" },
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
  form: { gap: 8, marginBottom: 10 },
  subsectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 6,
    marginBottom: 4,
  },
  fieldHint: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: -4,
    marginBottom: 4,
  },
  genderFieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 6,
  },
  genderChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  genderChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
  },
  genderChipActive: {
    borderColor: "#6366F1",
    backgroundColor: "#EEF2FF",
  },
  genderChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
  },
  genderChipTextActive: {
    color: "#4338CA",
  },
  mapWrap: {
    height: 260,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    marginBottom: 10,
  },
  map: { width: "100%", height: "100%" },
  mapFab: {
    position: "absolute",
    bottom: 14,
    right: 14,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
  },
  mapFabDisabled: { opacity: 0.65 },
  saveButton: {
    alignSelf: "center",
    minWidth: 200,
    height: 48,
    borderRadius: 999,
    backgroundColor: "#6366F1",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#4338CA",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 3,
    marginTop: 4,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonContent: { flexDirection: "row", alignItems: "center", gap: 8 },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  rtlText: { textAlign: "right", writingDirection: "rtl" },
});
