// src/screens/auth/CompleteProfileProviderScreen.tsx

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
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
import Constants, { ExecutionEnvironment } from "expo-constants";
import MapView, { Marker, Region, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import { Button, Input, LanguageSwitcher } from "../../components/common";
import { useAppTranslation } from "../../hooks/useAppTranslation";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../services/supabase";
import {
  requestPhotoLibraryPermission,
  uploadClientProfileAvatar,
} from "../../services/clientAvatarUpload";
import { COLORS } from "../../constants";
import { OsmLocationPicker } from "../../components/maps/OsmLocationPicker";

const ACCENT = "#E8C97A";

/** Google Maps tiles are not available in Expo Go on Android (no API key in binary). Use OSM WebView instead. */
const USE_OSM_WEB_MAP =
  Platform.OS === "android" &&
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/** Default map center (Tunis area) when no coordinates are set yet */
const DEFAULT_MAP_REGION: Region = {
  latitude: 36.8065,
  longitude: 10.1815,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

interface CompleteProfileProviderScreenProps {
  navigation: NativeStackNavigationProp<any>;
}

export const CompleteProfileProviderScreen: React.FC<
  CompleteProfileProviderScreenProps
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
    latitude: "",
    longitude: "",
  });

  /** Local preview + MIME from picker (same upload pipeline as client → `avatars` bucket). */
  const [pickedPhoto, setPickedPhoto] = useState<{
    uri: string;
    mimeType?: string | null;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [currentStep, setCurrentStep] = useState(1);

  const mapRef = useRef<MapView | null>(null);
  const [mapRegion, setMapRegion] = useState<Region>(DEFAULT_MAP_REGION);
  const [locating, setLocating] = useState(false);

  const applyCoords = useCallback((lat: number, lng: number) => {
    const la = Math.round(lat * 1e6) / 1e6;
    const lo = Math.round(lng * 1e6) / 1e6;
    setFormData((prev) => ({
      ...prev,
      latitude: String(la),
      longitude: String(lo),
    }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.latitude;
      delete next.longitude;
      return next;
    });
    const nextRegion: Region = {
      latitude: la,
      longitude: lo,
      latitudeDelta: 0.06,
      longitudeDelta: 0.06,
    };
    setMapRegion(nextRegion);
    mapRef.current?.animateToRegion(nextRegion, 280);
  }, []);

  useEffect(() => {
    if (currentStep !== 2) return;
    const lat = parseFloat(formData.latitude);
    const lng = parseFloat(formData.longitude);
    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lng) <= 180
    ) {
      const next: Region = {
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.06,
        longitudeDelta: 0.06,
      };
      setMapRegion(next);
      const t = setTimeout(() => {
        mapRef.current?.animateToRegion(next, 350);
      }, 150);
      return () => clearTimeout(t);
    }
  }, [currentStep]);

  const markerCoordinate = useMemo(() => {
    const lat = parseFloat(formData.latitude);
    const lng = parseFloat(formData.longitude);
    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lng) <= 180
    ) {
      return { latitude: lat, longitude: lng };
    }
    return {
      latitude: mapRegion.latitude,
      longitude: mapRegion.longitude,
    };
  }, [formData.latitude, formData.longitude, mapRegion]);

  const handleMapPress = (e: {
    nativeEvent: { coordinate: { latitude: number; longitude: number } };
  }) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    applyCoords(latitude, longitude);
  };

  const handleUseMyLocation = async () => {
    try {
      setLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          t("common.error"),
          t("completeProfile.locationPermissionDenied"),
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      applyCoords(pos.coords.latitude, pos.coords.longitude);
    } catch (e: unknown) {
      Alert.alert(
        t("common.error"),
        e instanceof Error ? e.message : t("completeProfile.submitError"),
      );
    } finally {
      setLocating(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validateStep1 = (): boolean => {
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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.city.trim()) {
      newErrors.city = t("validation.cityRequired");
    }

    if (formData.latitude && isNaN(Number(formData.latitude))) {
      newErrors.latitude = t("validation.latitudeInvalid");
    }

    if (formData.longitude && isNaN(Number(formData.longitude))) {
      newErrors.longitude = t("validation.longitudeInvalid");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (currentStep === 1 && validateStep1()) {
      setCurrentStep(2);
    }
  };

  const handleStepBack = () => {
    if (currentStep === 2) {
      setCurrentStep(1);
    }
  };

  const handleNavigateBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate("Welcome");
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
    } catch (e: unknown) {
      Alert.alert(
        t("common.error"),
        e instanceof Error
          ? e.message
          : t("completeProfile.photoPermissionDenied"),
      );
    }
  };

  const handleSubmit = async () => {
    if (!validateStep2()) return;

    setIsSubmitting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        throw new Error("Not signed in");
      }

      let photoUrl: string | undefined;
      if (pickedPhoto) {
        try {
          photoUrl = await uploadClientProfileAvatar(
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
        role: "PROVIDER" as const,
        provider: {
          city: formData.city,
          address: formData.address || undefined,
          latitude: formData.latitude ? Number(formData.latitude) : undefined,
          longitude: formData.longitude
            ? Number(formData.longitude)
            : undefined,
          type: "INDEPENDENT" as const,
          photoUrl,
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

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            { width: `${(currentStep / 2) * 100}%` },
          ]}
        />
      </View>
      <Text style={[styles.progressText, isRTL && styles.rtlText]}>
        {t("completeProfile.stepProgress", { current: currentStep, total: 2 })}
      </Text>
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Ionicons name="construct-outline" size={56} color={ACCENT} />
        <Text style={[styles.stepTitle, isRTL && styles.rtlText]}>
          {t("completeProfile.providerStep1Title")}
        </Text>
        <Text style={[styles.stepSubtitle, isRTL && styles.rtlText]}>
          {t("completeProfile.providerStep1Subtitle")}
        </Text>
      </View>

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
            <Image source={{ uri: pickedPhoto.uri }} style={styles.photoImage} />
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
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Ionicons name="location-outline" size={56} color={ACCENT} />
        <Text style={[styles.stepTitle, isRTL && styles.rtlText]}>
          {t("completeProfile.providerStep2Title")}
        </Text>
        <Text style={[styles.stepSubtitle, isRTL && styles.rtlText]}>
          {t("completeProfile.providerStep2Subtitle")}
        </Text>
      </View>

      <View style={styles.form}>
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

        {Platform.OS === "web" ? (
          <View style={styles.webMapFallback}>
            <Text style={[styles.mapSectionTitle, isRTL && styles.rtlText]}>
              {t("completeProfile.mapLocationTitle")}
            </Text>
            <Text style={[styles.mapHint, isRTL && styles.rtlText]}>
              {t("completeProfile.mapLocationHint")}
            </Text>
            <View style={styles.coordinatesContainer}>
              <View style={styles.coordinateInput}>
                <Input
                  label={t("completeProfile.latitudeLabel")}
                  placeholder={t("completeProfile.latitudePlaceholder")}
                  value={formData.latitude}
                  onChangeText={(value) => updateField("latitude", value)}
                  leftIcon="navigate-outline"
                  keyboardType="decimal-pad"
                  error={errors.latitude}
                />
              </View>
              <View style={styles.coordinateInput}>
                <Input
                  label={t("completeProfile.longitudeLabel")}
                  placeholder={t("completeProfile.longitudePlaceholder")}
                  value={formData.longitude}
                  onChangeText={(value) => updateField("longitude", value)}
                  leftIcon="navigate-outline"
                  keyboardType="decimal-pad"
                  error={errors.longitude}
                />
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.mapSection}>
            <Text style={[styles.mapSectionTitle, isRTL && styles.rtlText]}>
              {t("completeProfile.mapLocationTitle")}
            </Text>
            <Text style={[styles.mapHint, isRTL && styles.rtlText]}>
              {USE_OSM_WEB_MAP
                ? t("completeProfile.mapOsmExpoGoHint")
                : t("completeProfile.mapLocationHint")}
            </Text>
            <View style={styles.mapWrap}>
              {USE_OSM_WEB_MAP ? (
                <OsmLocationPicker
                  latitude={formData.latitude}
                  longitude={formData.longitude}
                  onCoordinateChange={applyCoords}
                />
              ) : (
                <MapView
                  ref={mapRef}
                  style={styles.map}
                  provider={
                    Platform.OS === "android" ? PROVIDER_GOOGLE : undefined
                  }
                  initialRegion={mapRegion}
                  onPress={handleMapPress}
                  mapType="standard"
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
                onPress={() => void handleUseMyLocation()}
                disabled={locating}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={t("completeProfile.useMyLocation")}
              >
                {locating ? (
                  <ActivityIndicator color="#0A0E1A" size="small" />
                ) : (
                  <Ionicons name="locate" size={26} color="#0A0E1A" />
                )}
              </TouchableOpacity>
            </View>
            <Text style={[styles.coordsReadout, isRTL && styles.rtlText]}>
              {t("completeProfile.coordinatesReadout", {
                lat: formData.latitude || "—",
                lng: formData.longitude || "—",
              })}
            </Text>
            {(errors.latitude || errors.longitude) && (
              <Text style={styles.mapError}>
                {errors.latitude || errors.longitude}
              </Text>
            )}
          </View>
        )}

        <View style={styles.pendingNotice}>
          <Ionicons name="time-outline" size={22} color={ACCENT} />
          <View style={styles.pendingNoticeText}>
            <Text style={[styles.pendingNoticeTitle, isRTL && styles.rtlText]}>
              {t("completeProfile.providerPendingTitle")}
            </Text>
            <Text style={[styles.pendingNoticeDescription, isRTL && styles.rtlText]}>
              {t("completeProfile.providerPendingDescription")}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={["#0A0E1A", "#0F172A", "#1E1B4B", "#2D1B69"]}
        locations={[0, 0.35, 0.7, 1]}
        style={StyleSheet.absoluteFillObject}
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

          <View style={styles.pageHeader}>
            <Text style={[styles.title, isRTL && styles.rtlText]}>
              {t("completeProfile.providerTitle")}
            </Text>
            <Text style={[styles.subtitle, isRTL && styles.rtlText]}>
              {t("completeProfile.providerSubtitle")}
            </Text>
          </View>

          <View style={styles.panel}>
            {renderProgressBar()}
            {currentStep === 1 ? renderStep1() : renderStep2()}
          </View>
        </ScrollView>

        <View
          style={[
            styles.footer,
            { paddingBottom: 16 + insets.bottom, paddingTop: 16 },
          ]}
        >
          {currentStep === 2 && (
            <Button
              title={t("completeProfile.previousStep")}
              onPress={handleStepBack}
              variant="outline"
              fullWidth={false}
              style={styles.footerBackButton}
              textStyle={styles.footerOutlineText}
            />
          )}

          <Button
            title={
              currentStep === 1
                ? t("common.next")
                : t("completeProfile.completeButton")
            }
            onPress={currentStep === 1 ? handleNext : handleSubmit}
            loading={currentStep === 2 && isSubmitting}
            fullWidth={false}
            style={{
              ...styles.submitButton,
              flex: currentStep === 2 ? 2 : 1,
            }}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0A0E1A",
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
  pageHeader: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#B5B8C9",
  },
  panel: {
    borderRadius: 18,
    borderWidth: 1.2,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.07)",
    padding: 16,
  },
  progressContainer: {
    marginBottom: 24,
  },
  progressBar: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFill: {
    height: "100%",
    backgroundColor: ACCENT,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 13,
    color: "#B5B8C9",
    textAlign: "center",
  },
  stepContainer: {
    marginBottom: 8,
  },
  stepHeader: {
    alignItems: "center",
    marginBottom: 24,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#FFFFFF",
    marginTop: 12,
    marginBottom: 6,
  },
  stepSubtitle: {
    fontSize: 14,
    color: "#B5B8C9",
  },
  photoBlock: {
    alignItems: "center",
    marginBottom: 20,
  },
  photoLabel: {
    alignSelf: "stretch",
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.white,
    marginBottom: 10,
  },
  photoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 2,
    borderColor: "rgba(232,201,122,0.45)",
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
    borderColor: "#0A0E1A",
  },
  photoHint: {
    marginTop: 10,
    fontSize: 13,
    color: "#B5B8C9",
    textAlign: "center",
    paddingHorizontal: 8,
  },
  form: {
    gap: 8,
  },
  mapSection: {
    marginTop: 4,
    marginBottom: 4,
  },
  webMapFallback: {
    marginTop: 4,
  },
  mapSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  mapHint: {
    fontSize: 13,
    color: "#B5B8C9",
    lineHeight: 19,
    marginBottom: 12,
  },
  mapWrap: {
    height: 260,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(232,201,122,0.35)",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  map: {
    width: "100%",
    height: "100%",
  },
  mapFab: {
    position: "absolute",
    bottom: 14,
    end: 14,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
  },
  mapFabDisabled: {
    opacity: 0.65,
  },
  coordsReadout: {
    marginTop: 10,
    fontSize: 12,
    color: "rgba(232,201,122,0.95)",
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  mapError: {
    marginTop: 6,
    fontSize: 12,
    color: "#fecaca",
  },
  coordinatesContainer: {
    flexDirection: "row",
    gap: 12,
  },
  coordinateInput: {
    flex: 1,
  },
  pendingNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(232,201,122,0.10)",
    padding: 12,
    borderRadius: 12,
    gap: 10,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "rgba(232,201,122,0.22)",
  },
  pendingNoticeText: {
    flex: 1,
  },
  pendingNoticeTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#F3E5B8",
    marginBottom: 4,
  },
  pendingNoticeDescription: {
    fontSize: 12,
    color: "#E8E6F0",
    lineHeight: 17,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    backgroundColor: "rgba(10,14,26,0.94)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.10)",
    flexDirection: "row",
    gap: 12,
    alignItems: "stretch",
  },
  footerBackButton: {
    flex: 1,
    borderColor: ACCENT,
  },
  footerOutlineText: {
    color: ACCENT,
  },
  submitButton: {
    minWidth: 0,
  },
  rtlText: {
    textAlign: "right",
    writingDirection: "rtl",
  },
});
