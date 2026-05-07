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

      {/* Floating back button */}
      <View style={[styles.topBackContainer, { top: insets.top + 6 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.8}
        >
          <View style={styles.backBtnInner}>
            <Ionicons
              name={isRTL ? "chevron-forward" : "chevron-back"}
              size={18}
              color="#1A1A2E"
            />
          </View>
          <Text style={[styles.backText, isRTL && styles.rtlText]}>
            {t("common.back")}
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
            { paddingTop: insets.top + 64, paddingBottom: 32 + insets.bottom },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar hero */}
          <View style={styles.avatarHero}>
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
                      <Ionicons name="person" size={40} color="#F08E10" />
                    </View>
                  )}
                </View>
              </View>
              <View style={styles.avatarEditBadge}>
                <Ionicons name="camera" size={13} color="#FFF" />
              </View>
            </TouchableOpacity>
            <Text style={[styles.avatarHeroTitle, isRTL && styles.rtlText]}>
              {t("provider.settings.editProfileTitle")}
            </Text>
          </View>

          {/* Personal info card */}
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconWrap}>
              <Ionicons name="person-outline" size={13} color="#F08E10" />
            </View>
            <Text style={[styles.sectionLabel, isRTL && styles.rtlText]}>
              {t("completeProfile.firstNameLabel").replace(" *", "")} &amp;
              location
            </Text>
          </View>
          <View style={styles.card}>
            <Input
              label={t("completeProfile.firstNameLabel")}
              value={firstName}
              onChangeText={setFirstName}
              leftIcon="person-outline"
            />
            <View style={styles.cardDivider} />
            <Input
              label={t("completeProfile.lastNameLabel")}
              value={lastName}
              onChangeText={setLastName}
              leftIcon="person-outline"
            />
            <View style={styles.cardDivider} />
            <Input
              label={t("completeProfile.cityLabel")}
              value={city}
              onChangeText={setCity}
              leftIcon="business-outline"
            />
            <View style={styles.cardDivider} />
            <Input
              label={t("completeProfile.addressLabel")}
              value={address}
              onChangeText={setAddress}
              leftIcon="location-outline"
            />
          </View>

          {/* Professional card */}
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconWrap}>
              <Ionicons name="briefcase-outline" size={13} color="#F08E10" />
            </View>
            <Text style={[styles.sectionLabel, isRTL && styles.rtlText]}>
              {t("provider.settings.editProfileProfessionalSection")}
            </Text>
          </View>
          <View style={styles.card}>
            <Input
              label={t("provider.settings.taglineLabel")}
              value={tagline}
              onChangeText={setTagline}
              placeholder={t("provider.settings.taglinePlaceholder")}
              leftIcon="megaphone-outline"
              maxLength={220}
            />
            <View style={styles.cardDivider} />
            <Input
              label={t("provider.settings.bioLabel")}
              value={bio}
              onChangeText={setBio}
              placeholder={t("provider.settings.bioPlaceholder")}
              leftIcon="document-text-outline"
              multiline
              numberOfLines={5}
            />
            <View style={styles.cardDivider} />
            <Input
              label={t("provider.settings.yearsExperienceLabel")}
              value={yearsStr}
              onChangeText={setYearsStr}
              placeholder={t("provider.settings.yearsExperiencePlaceholder")}
              leftIcon="time-outline"
              keyboardType="number-pad"
            />
            <View style={styles.cardDivider} />
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
            <View style={styles.cardDivider} />

            {/* Gender */}
            <Text style={[styles.genderFieldLabel, isRTL && styles.rtlText]}>
              {t("provider.settings.genderLabel")}
            </Text>
            <View style={styles.genderChips}>
              {(
                [
                  {
                    value: "FEMALE" as const,
                    labelKey: "provider.settings.genderFemale",
                    icon: "female-outline",
                  },
                  {
                    value: "MALE" as const,
                    labelKey: "provider.settings.genderMale",
                    icon: "male-outline",
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
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={opt.icon as any}
                      size={13}
                      color={active ? "#F08E10" : "#9B9BB0"}
                    />
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

          {/* Map card */}
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconWrap}>
              <Ionicons name="map-outline" size={13} color="#F08E10" />
            </View>
            <Text style={[styles.sectionLabel, isRTL && styles.rtlText]}>
              {t("completeProfile.addressLabel")}
            </Text>
          </View>
          <View style={styles.mapCard}>
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
                  <ActivityIndicator color="#7C5CFC" size="small" />
                ) : (
                  <Ionicons name="locate" size={22} color="#7C5CFC" />
                )}
              </TouchableOpacity>
            </View>
            {latitude && longitude ? (
              <View style={styles.coordsRow}>
                <Ionicons name="pin-outline" size={12} color="#9B9BB0" />
                <Text style={styles.coordsText}>
                  {Number(latitude).toFixed(5)}, {Number(longitude).toFixed(5)}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Save button */}
          <TouchableOpacity
            style={[
              styles.saveButton,
              (!isDirty || saving) && styles.saveButtonDisabled,
            ]}
            onPress={() => void onSave()}
            disabled={!isDirty || saving}
            activeOpacity={0.85}
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
  root: { flex: 1, backgroundColor: "#F4F3FA" },
  container: { flex: 1 },

  /* Back button */
  topBackContainer: { position: "absolute", left: 16, zIndex: 10 },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
  },
  backBtnInner: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#EBEBF5",
    shadowColor: "#1A1A2E",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  backText: {
    color: "#1A1A2E",
    fontSize: 14,
    fontWeight: "700",
  },

  /* Scroll */
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    justifyContent: "center",
  },

  /* Avatar hero */
  avatarHero: {
    alignItems: "center",
    marginBottom: 28,
    paddingTop: 8,
  },
  avatarTouchable: {
    alignSelf: "center",
    marginBottom: 14,
    position: "relative",
  },
  avatarOuterRing: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: "#F08E10",
    padding: 4,
    shadowColor: "#F08E10",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 5,
  },
  avatarRingInner: {
    flex: 1,
    borderRadius: 48,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  avatarImg: { width: "100%", height: "100%", backgroundColor: "#EBEBF5" },
  avatarPlaceholder: {
    flex: 1,
    minHeight: 88,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF7ED",
  },
  avatarEditBadge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#7C5CFC",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2.5,
    borderColor: "#FFFFFF",
    shadowColor: "#7C5CFC",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  avatarHeroTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1A1A2E",
    letterSpacing: -0.4,
  },
  avatarHeroSubtitle: {
    fontSize: 12,
    color: "#9B9BB0",
    fontWeight: "500",
    marginTop: 3,
  },

  /* Section header */
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
    marginTop: 6,
    paddingHorizontal: 2,
  },
  sectionIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: "#FFF7ED",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#F08E10",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },

  /* Card */
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EBEBF5",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    shadowColor: "#1A1A2E",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  cardDivider: {
    height: 1,
    backgroundColor: "#F4F3FA",
    marginVertical: 6,
  },

  /* Field hint */
  fieldHint: {
    fontSize: 11,
    color: "#9B9BB0",
    marginTop: 2,
    marginBottom: 2,
    fontWeight: "500",
  },

  /* Gender */
  genderFieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B6B80",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 4,
    marginBottom: 8,
  },
  genderChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  genderChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "#E8E8F0",
    backgroundColor: "#FAFAFA",
  },
  genderChipActive: {
    borderColor: "#FDBA74",
    backgroundColor: "#FFF7ED",
  },
  genderChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#9B9BB0",
  },
  genderChipTextActive: {
    color: "#F08E10",
    fontWeight: "700",
  },

  /* Map */
  mapCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EBEBF5",
    overflow: "hidden",
    marginBottom: 24,
    shadowColor: "#1A1A2E",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  mapWrap: {
    height: 260,
    position: "relative",
  },
  map: { width: "100%", height: "100%" },
  mapFab: {
    position: "absolute",
    bottom: 14,
    right: 14,
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#EBEBF5",
    shadowColor: "#7C5CFC",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 4,
  },
  mapFabDisabled: { opacity: 0.55 },
  coordsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#F4F3FA",
  },
  coordsText: {
    fontSize: 11,
    color: "#9B9BB0",
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },

  /* Save button */
  saveButton: {
    alignSelf: "center",
    minWidth: 210,
    height: 52,
    borderRadius: 999,
    backgroundColor: "#7C5CFC",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#7C5CFC",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  saveButtonDisabled: { opacity: 0.45, shadowOpacity: 0 },
  saveButtonContent: { flexDirection: "row", alignItems: "center", gap: 8 },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.2,
  },

  rtlText: { textAlign: "right", writingDirection: "rtl" },
});
