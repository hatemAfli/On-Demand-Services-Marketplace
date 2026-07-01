// src/screens/auth/CompleteProfileCompanyScreen.tsx

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
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
  Modal,
  Pressable,
  useWindowDimensions,
} from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import MapView, { Marker, Region, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import {
  Input,
  AuthNoticeModal,
} from "../../components/common";
import { useAppTranslation } from "../../hooks/useAppTranslation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../services/supabase";
import { requestPhotoLibraryPermission } from "../../services/clientAvatarUpload";
import {
  uploadProviderVerificationDocument,
  isImageMimeOrPath,
} from "../../services/providerDocumentUpload";
import {
  PROVIDER_DOCUMENT_TYPES,
  type ProviderDocumentType,
} from "../../types/documents";
import { OsmLocationPicker } from "../../components/maps/OsmLocationPicker";
import { LegalAcceptanceField } from "../../components/auth/LegalAcceptanceField";
import { useRegistrationLegalAcceptance } from "../../hooks/useRegistrationLegalAcceptance";
import type { AuthStackParamList } from "../../navigation/types";

const ACCENT = "#EA580C";
const ACCENT_SOFT = "#FFEDD5";
const ACCENT_BORDER = "#FDBA74";
const STEP_GREEN = "#10B981";
const STEP_TRACK = "#E2E8F0";
const SCREEN_BG = "#F1F5F9";
const TOTAL_STEPS = 3;

const USE_OSM_WEB_MAP =
  Platform.OS === "android" &&
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

const MAP_ZOOM_DELTA = 0.035;
const MAP_MIN_HEIGHT = 320;
const MAP_MAX_HEIGHT = 440;

const DEFAULT_MAP_REGION: Region = {
  latitude: 36.8065,
  longitude: 10.1815,
  latitudeDelta: MAP_ZOOM_DELTA,
  longitudeDelta: MAP_ZOOM_DELTA,
};

type PendingDoc = {
  id: string;
  localUri: string;
  mimeType?: string | null;
  fileName?: string | null;
  documentType: ProviderDocumentType;
};

interface CompleteProfileCompanyScreenProps {
  navigation: NativeStackNavigationProp<AuthStackParamList>;
}

export const CompleteProfileCompanyScreen: React.FC<
  CompleteProfileCompanyScreenProps
> = ({ navigation }) => {
  const { completeRegistration } = useAuth();
  const { t, isRTL } = useAppTranslation();
  const insets = useSafeAreaInsets();
  const legal = useRegistrationLegalAcceptance();
  const [legalError, setLegalError] = useState<string | undefined>();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const mapHeight = Math.min(
    Math.max(screenHeight * 0.38, MAP_MIN_HEIGHT),
    MAP_MAX_HEIGHT,
  );
  const mapWidth = screenWidth - 40;

  const [formData, setFormData] = useState({
    phoneNumber: "",
    firstName: "",
    lastName: "",
    companyName: "",
    city: "",
    address: "",
    latitude: "",
    longitude: "",
    taxId: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [currentStep, setCurrentStep] = useState(1);
  const [pendingDocs, setPendingDocs] = useState<PendingDoc[]>([]);
  const [typePickerVisible, setTypePickerVisible] = useState(false);
  const [docSourceModalVisible, setDocSourceModalVisible] = useState(false);
  const [pendingPick, setPendingPick] = useState<{
    uri: string;
    mimeType?: string | null;
    fileName?: string | null;
  } | null>(null);
  const [notice, setNotice] = useState<{
    visible: boolean;
    title: string;
    message: string;
  }>({ visible: false, title: "", message: "" });

  const mapRef = useRef<MapView | null>(null);
  const [mapRegion, setMapRegion] = useState<Region>(DEFAULT_MAP_REGION);
  const [locating, setLocating] = useState(false);
  const [parentScrollEnabled, setParentScrollEnabled] = useState(true);

  const releaseMapTouch = useCallback(() => {
    setParentScrollEnabled(true);
  }, []);

  const captureMapTouch = useCallback(() => {
    setParentScrollEnabled(false);
  }, []);

  const applyCoords = useCallback(
    (lat: number, lng: number, options?: { animate?: boolean }) => {
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
        latitudeDelta: MAP_ZOOM_DELTA,
        longitudeDelta: MAP_ZOOM_DELTA,
      };
      setMapRegion(nextRegion);
      if (options?.animate !== false) {
        mapRef.current?.animateToRegion(nextRegion, 280);
      }
    },
    [],
  );

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
        latitudeDelta: MAP_ZOOM_DELTA,
        longitudeDelta: MAP_ZOOM_DELTA,
      };
      setMapRegion(next);
      const tmr = setTimeout(() => {
        mapRef.current?.animateToRegion(next, 350);
      }, 150);
      return () => clearTimeout(tmr);
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
    if (
      formData.phoneNumber.trim() &&
      !/^\+?[\d\s-()]+$/.test(formData.phoneNumber)
    ) {
      newErrors.phoneNumber = t("validation.phoneInvalid");
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const newErrors: { [key: string]: string } = {};
    if (!formData.companyName.trim()) {
      newErrors.companyName = t("validation.companyNameRequired");
    }
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

  const validateStep3 = (): boolean => {
    const newErrors: { [key: string]: string } = {};
    if (!formData.taxId.trim()) {
      newErrors.taxId = t("validation.taxIdRequired");
    }
    if (pendingDocs.length === 0) {
      newErrors.documents = t("completeProfile.documentsRequired");
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (currentStep === 1 && validateStep1()) setCurrentStep(2);
    else if (currentStep === 2 && validateStep2()) setCurrentStep(3);
  };

  const handleStepBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleNavigateBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("Welcome");
  };

  const handleAddVerificationDoc = () => setDocSourceModalVisible(true);

  const pickVerificationFromGallery = async () => {
    setDocSourceModalVisible(false);
    try {
      const ok = await requestPhotoLibraryPermission();
      if (!ok) {
        setNotice({
          visible: true,
          title: t("common.error"),
          message: t("completeProfile.photoPermissionDenied"),
        });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.9,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        const asset = result.assets[0];
        setPendingPick({
          uri: asset.uri,
          mimeType: asset.mimeType ?? undefined,
          fileName: null,
        });
        setTypePickerVisible(true);
      }
    } catch (e: unknown) {
      setNotice({
        visible: true,
        title: t("common.error"),
        message:
          e instanceof Error
            ? e.message
            : t("completeProfile.photoPermissionDenied"),
      });
    }
  };

  const pickVerificationFromFiles = async () => {
    setDocSourceModalVisible(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        type: [
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ],
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setPendingPick({
        uri: asset.uri,
        mimeType: asset.mimeType ?? undefined,
        fileName: asset.name,
      });
      setTypePickerVisible(true);
    } catch (e: unknown) {
      setNotice({
        visible: true,
        title: t("common.error"),
        message:
          e instanceof Error
            ? e.message
            : t("completeProfile.documentPickError"),
      });
    }
  };

  const labelForDocType = useCallback(
    (dt: string) => {
      const map: Record<string, string> = {
        IDENTITY: t("completeProfile.docTypeIdentity"),
        LICENSE: t("completeProfile.docTypeLicense"),
        QUALIFICATION: t("completeProfile.docTypeQualification"),
        INSURANCE: t("completeProfile.docTypeInsurance"),
        OTHER: t("completeProfile.docTypeOther"),
      };
      return map[dt] ?? dt;
    },
    [t],
  );

  const confirmDocType = (documentType: ProviderDocumentType) => {
    if (!pendingPick) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setPendingDocs((prev) => [
      ...prev,
      {
        id,
        localUri: pendingPick.uri,
        mimeType: pendingPick.mimeType,
        fileName: pendingPick.fileName ?? null,
        documentType,
      },
    ]);
    setPendingPick(null);
    setTypePickerVisible(false);
    setErrors((prev) => {
      const next = { ...prev };
      delete next.documents;
      return next;
    });
  };

  const removePendingDoc = (id: string) => {
    setPendingDocs((prev) => prev.filter((d) => d.id !== id));
  };

  const handleSubmit = async () => {
    if (!validateStep1() || !validateStep2() || !validateStep3()) return;

    let legalAcceptances;
    try {
      legalAcceptances = legal.requireForSubmit();
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : t("auth.legalAcceptanceRequired");
      setLegalError(message);
      setNotice({
        visible: true,
        title: t("common.error"),
        message,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        throw new Error("Not signed in");
      }
      const uid = session.user.id;
      const email = session.user.email?.trim();
      if (!email) {
        throw new Error(t("completeProfile.companyEmailMissing"));
      }

      const docPayload: { type: string; fichierUrl: string }[] = [];
      for (const d of pendingDocs) {
        const url = await uploadProviderVerificationDocument(uid, d.localUri, {
          mimeType: d.mimeType,
          fileName: d.fileName,
        });
        docPayload.push({ type: d.documentType, fichierUrl: url });
      }

      const profileData = {
        phoneNumber: formData.phoneNumber.trim() || undefined,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        role: "COMPANY_ADMIN" as const,
        legalAcceptances,
        companyAdmin: {
          company: {
            companyName: formData.companyName.trim(),
            taxId: formData.taxId.trim(),
            city: formData.city.trim(),
            address: formData.address.trim() || undefined,
            latitude: formData.latitude
              ? Number(formData.latitude)
              : undefined,
            longitude: formData.longitude
              ? Number(formData.longitude)
              : undefined,
            serviceZones: [] as string[],
          },
          verification: {
            documents: docPayload,
          },
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
      setNotice({
        visible: true,
        title: t("common.error"),
        message:
          error instanceof Error
            ? error.message
            : t("completeProfile.submitError"),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepNavigator = () => {
    const steps = [
      t("completeProfile.companyStep1Title"),
      t("completeProfile.companyStep2Title"),
      t("completeProfile.companyStep3Title"),
    ];

    return (
      <View style={styles.stepNavigator}>
        <Text style={[styles.stepProgressCaption, isRTL && styles.rtlText]}>
          {t("completeProfile.stepProgress", {
            current: currentStep,
            total: TOTAL_STEPS,
          })}
        </Text>
        <View
          style={[styles.stepTrackRow, isRTL && styles.stepTrackRowRtl]}
        >
          {steps.map((label, index) => {
            const stepNumber = index + 1;
            const isActive = currentStep === stepNumber;
            const isDone = currentStep > stepNumber;
            const connectorDone = index > 0 && currentStep > index;

            return (
              <React.Fragment key={`company-step-${stepNumber}`}>
                {index > 0 ? (
                  <View
                    style={[
                      styles.stepConnector,
                      connectorDone && styles.stepConnectorDone,
                    ]}
                  />
                ) : null}
                <View
                  style={[
                    styles.stepCircle,
                    isDone && styles.stepCircleDone,
                    isActive && styles.stepCircleActive,
                    !isDone && !isActive && styles.stepCirclePending,
                  ]}
                >
                  {isDone ? (
                    <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                  ) : (
                    <Text
                      style={[
                        styles.stepCircleNum,
                        isActive && styles.stepCircleNumOnAccent,
                      ]}
                    >
                      {stepNumber}
                    </Text>
                  )}
                </View>
              </React.Fragment>
            );
          })}
        </View>
        <View style={[styles.stepLabelsRow, isRTL && styles.stepLabelsRowRtl]}>
          {steps.map((label, index) => {
            const stepNumber = index + 1;
            const isActive = currentStep === stepNumber;
            const isDone = currentStep > stepNumber;
            return (
              <Text
                key={`company-step-label-${stepNumber}`}
                style={[
                  styles.stepLabel,
                  isActive && styles.stepLabelActive,
                  isDone && styles.stepLabelDone,
                  isRTL && styles.rtlText,
                ]}
                numberOfLines={2}
              >
                {label}
              </Text>
            );
          })}
        </View>
      </View>
    );
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.form}>
        <Input
          label={t("completeProfile.firstNameLabel")}
          placeholder={t("completeProfile.firstNamePlaceholder")}
          value={formData.firstName}
          onChangeText={(v) => updateField("firstName", v)}
          leftIcon="person-outline"
          error={errors.firstName}
          autoCapitalize="words"
        />
        <Input
          label={t("completeProfile.lastNameLabel")}
          placeholder={t("completeProfile.lastNamePlaceholder")}
          value={formData.lastName}
          onChangeText={(v) => updateField("lastName", v)}
          leftIcon="person-outline"
          error={errors.lastName}
          autoCapitalize="words"
        />
        <Input
          label={t("completeProfile.phoneLabel")}
          placeholder={t("completeProfile.phonePlaceholder")}
          value={formData.phoneNumber}
          onChangeText={(v) => updateField("phoneNumber", v)}
          leftIcon="call-outline"
          keyboardType="phone-pad"
          error={errors.phoneNumber}
        />
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.form}>
        <Input
          label={t("completeProfile.companyNameFieldLabel")}
          placeholder={t("completeProfile.companyNameFieldPlaceholder")}
          value={formData.companyName}
          onChangeText={(v) => updateField("companyName", v)}
          leftIcon="storefront-outline"
          error={errors.companyName}
        />
        <Input
          label={t("completeProfile.cityLabel")}
          placeholder={t("completeProfile.cityPlaceholder")}
          value={formData.city}
          onChangeText={(v) => updateField("city", v)}
          leftIcon="business-outline"
          error={errors.city}
          autoCapitalize="words"
        />
        <Input
          label={t("completeProfile.addressLabel")}
          placeholder={t("completeProfile.addressPlaceholder")}
          value={formData.address}
          onChangeText={(v) => updateField("address", v)}
          leftIcon="home-outline"
        />
        {Platform.OS === "web" ? (
          <View style={styles.webMapFallback}>
            <Text style={[styles.mapSectionTitle, isRTL && styles.rtlText]}>
              {t("completeProfile.mapLocationTitle")}
            </Text>
            <View style={styles.coordinatesContainer}>
              <View style={styles.coordinateInput}>
                <Input
                  label={t("completeProfile.latitudeLabel")}
                  value={formData.latitude}
                  onChangeText={(v) => updateField("latitude", v)}
                  keyboardType="decimal-pad"
                  error={errors.latitude}
                />
              </View>
              <View style={styles.coordinateInput}>
                <Input
                  label={t("completeProfile.longitudeLabel")}
                  value={formData.longitude}
                  onChangeText={(v) => updateField("longitude", v)}
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
            <View
              style={[
                styles.mapWrap,
                { width: mapWidth, height: mapHeight },
              ]}
              onTouchStart={captureMapTouch}
              onTouchEnd={releaseMapTouch}
              onTouchCancel={releaseMapTouch}
            >
              {USE_OSM_WEB_MAP ? (
                <OsmLocationPicker
                  latitude={formData.latitude}
                  longitude={formData.longitude}
                  onCoordinateChange={(lat, lng) =>
                    applyCoords(lat, lng, { animate: false })
                  }
                  height={mapHeight}
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
                  scrollEnabled
                  zoomEnabled
                  zoomTapEnabled
                  rotateEnabled={false}
                  pitchEnabled={false}
                  scrollDuringRotateOrZoomEnabled
                  moveOnMarkerPress={false}
                  onPanDrag={captureMapTouch}
                  onRegionChangeComplete={releaseMapTouch}
                >
                  <Marker
                    coordinate={markerCoordinate}
                    draggable
                    anchor={{ x: 0.5, y: 1 }}
                    tracksViewChanges={false}
                    onDragStart={captureMapTouch}
                    onDragEnd={(e) => {
                      releaseMapTouch();
                      applyCoords(
                        e.nativeEvent.coordinate.latitude,
                        e.nativeEvent.coordinate.longitude,
                        { animate: false },
                      );
                    }}
                  />
                </MapView>
              )}
              <TouchableOpacity
                style={[styles.mapFab, locating && styles.mapFabDisabled]}
                onPress={() => void handleUseMyLocation()}
                disabled={locating}
              >
                {locating ? (
                  <ActivityIndicator color="#0A0E1A" size="small" />
                ) : (
                  <Ionicons name="locate" size={26} color="#0A0E1A" />
                )}
              </TouchableOpacity>
            </View>
            {(errors.latitude || errors.longitude) && (
              <Text style={styles.mapError}>
                {errors.latitude || errors.longitude}
              </Text>
            )}
          </View>
        )}
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Input
        label={t("completeProfile.taxIdLabel")}
        placeholder={t("completeProfile.taxIdPlaceholder")}
        value={formData.taxId}
        onChangeText={(v) => updateField("taxId", v)}
        leftIcon="receipt-outline"
        error={errors.taxId}
        autoCapitalize="characters"
      />
      <Text
        style={[
          styles.sectionLabel,
          { marginTop: 16 },
          isRTL && styles.rtlText,
        ]}
      >
        {t("completeProfile.companyVerificationDocsTitle")}
      </Text>
      <Text style={[styles.sectionHint, isRTL && styles.rtlText]}>
        {t("completeProfile.companyVerificationDocsHint")}
      </Text>
      {pendingDocs.map((d) => (
        <View key={d.id} style={styles.docRow}>
          {isImageMimeOrPath(d.mimeType, d.localUri) ? (
            <Image source={{ uri: d.localUri }} style={styles.docThumb} />
          ) : (
            <View style={styles.docThumbPlaceholder}>
              <Ionicons name="document-text-outline" size={28} color={ACCENT} />
            </View>
          )}
          <View style={styles.docRowText}>
            <Text style={[styles.docRowTitle, isRTL && styles.rtlText]}>
              {labelForDocType(d.documentType)}
            </Text>
            {d.fileName ? (
              <Text
                style={[styles.docFileName, isRTL && styles.rtlText]}
                numberOfLines={1}
              >
                {d.fileName}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity onPress={() => removePendingDoc(d.id)}>
            <Ionicons name="trash-outline" size={22} color="#fecaca" />
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity
        style={styles.addDocButton}
        onPress={() => void handleAddVerificationDoc()}
      >
        <Ionicons name="add-circle-outline" size={22} color={ACCENT} />
        <Text style={[styles.addDocButtonText, isRTL && styles.rtlText]}>
          {t("completeProfile.addVerificationDoc")}
        </Text>
      </TouchableOpacity>
      {errors.documents ? (
        <Text style={styles.fieldError}>{errors.documents}</Text>
      ) : null}
      <View style={[styles.pendingNotice, { marginTop: 16 }]}>
        <Ionicons name="time-outline" size={22} color={ACCENT} />
        <View style={styles.pendingNoticeText}>
          <Text style={[styles.pendingNoticeTitle, isRTL && styles.rtlText]}>
            {t("completeProfile.companyPendingTitle")}
          </Text>
          <Text
            style={[styles.pendingNoticeDescription, isRTL && styles.rtlText]}
          >
            {t("completeProfile.companyPendingDescription")}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      <StatusBar
        barStyle="dark-content"
        translucent
        backgroundColor="transparent"
      />
      <View style={[styles.topBackContainer, { top: insets.top + 8 }]}>
        <TouchableOpacity style={styles.navBackButton} onPress={handleNavigateBack}>
          <Text style={styles.navBackText}>← {t("common.back")}</Text>
        </TouchableOpacity>
      </View>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          scrollEnabled={parentScrollEnabled}
          nestedScrollEnabled
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
            {renderStepNavigator()}
            {currentStep === 1
              ? renderStep1()
              : currentStep === 2
                ? renderStep2()
                : renderStep3()}
          </View>
        </ScrollView>
        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom - 40, 4), paddingTop: 8 },
          ]}
        >
          {legal.needsUi && currentStep === TOTAL_STEPS ? (
            <LegalAcceptanceField
              navigation={navigation}
              accepted={legal.accepted}
              onAcceptedChange={(value) => {
                legal.setAccepted(value);
                setLegalError(undefined);
              }}
              onVersionIdsReady={legal.setVersionIds}
              error={legalError}
            />
          ) : null}

          {currentStep > 1 && (
            <TouchableOpacity
              style={styles.stepBackButton}
              onPress={handleStepBack}
              accessibilityRole="button"
              accessibilityLabel={t("completeProfile.previousStep")}
              activeOpacity={0.85}
            >
              <Ionicons
                name={isRTL ? "chevron-forward" : "chevron-back"}
                size={20}
                color={ACCENT}
              />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[
              styles.stepPrimaryButton,
              currentStep > 1
                ? styles.stepPrimaryButtonWithBack
                : styles.stepPrimaryButtonFull,
              currentStep === TOTAL_STEPS &&
                isSubmitting &&
                styles.stepPrimaryButtonDisabled,
            ]}
            onPress={
              currentStep < TOTAL_STEPS ? handleNext : () => void handleSubmit()
            }
            disabled={currentStep === TOTAL_STEPS && isSubmitting}
            accessibilityRole="button"
            accessibilityLabel={
              currentStep < TOTAL_STEPS
                ? t("common.next")
                : t("completeProfile.completeButton")
            }
            activeOpacity={0.9}
          >
            {currentStep === TOTAL_STEPS && isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.stepPrimaryButtonText}>
                  {currentStep < TOTAL_STEPS
                    ? t("common.next")
                    : t("completeProfile.completeButton")}
                </Text>
                <View style={styles.stepPrimaryIconWrap}>
                  <Ionicons
                    name={
                      currentStep < TOTAL_STEPS
                        ? isRTL
                          ? "arrow-back"
                          : "arrow-forward"
                        : "checkmark"
                    }
                    size={18}
                    color="#FFFFFF"
                  />
                </View>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={docSourceModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDocSourceModalVisible(false)}
      >
        <Pressable
          style={styles.typeModalBackdrop}
          onPress={() => setDocSourceModalVisible(false)}
        >
          <Pressable
            style={styles.typeModalCard}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.typeModalTitle, isRTL && styles.rtlText]}>
              {t("completeProfile.docSourceModalTitle")}
            </Text>
            <TouchableOpacity
              style={styles.typeModalRow}
              onPress={() => void pickVerificationFromGallery()}
            >
              <Ionicons name="images-outline" size={22} color={ACCENT} />
              <Text style={[styles.typeModalRowText, isRTL && styles.rtlText]}>
                {t("completeProfile.addDocFromGallery")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.typeModalRow}
              onPress={() => void pickVerificationFromFiles()}
            >
              <Ionicons name="folder-open-outline" size={22} color={ACCENT} />
              <Text style={[styles.typeModalRowText, isRTL && styles.rtlText]}>
                {t("completeProfile.addDocFromFiles")}
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={typePickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setTypePickerVisible(false);
          setPendingPick(null);
        }}
      >
        <Pressable
          style={styles.typeModalBackdrop}
          onPress={() => {
            setTypePickerVisible(false);
            setPendingPick(null);
          }}
        >
          <Pressable
            style={styles.typeModalCard}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.typeModalTitle, isRTL && styles.rtlText]}>
              {t("completeProfile.docTypeModalTitle")}
            </Text>
            {PROVIDER_DOCUMENT_TYPES.map((dt) => (
              <TouchableOpacity
                key={dt}
                style={styles.typeModalRow}
                onPress={() => confirmDocType(dt)}
              >
                <Text
                  style={[styles.typeModalRowText, isRTL && styles.rtlText]}
                >
                  {labelForDocType(dt)}
                </Text>
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <AuthNoticeModal
        visible={notice.visible}
        onClose={() => setNotice((n) => ({ ...n, visible: false }))}
        title={notice.title}
        message={notice.message}
        primaryLabel={t("common.close")}
        onPrimary={() => setNotice((n) => ({ ...n, visible: false }))}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SCREEN_BG },
  topBackContainer: {
    position: "absolute",
    left: 24,
    zIndex: 10,
  },
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 0 },
  navBackButton: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    minHeight: 44,
    justifyContent: "center",
  },
  navBackText: { color: ACCENT, fontSize: 16, fontWeight: "600" },
  panel: {
    width: "100%",
    alignSelf: "stretch",
    backgroundColor: SCREEN_BG,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    minHeight: 400,
  },
  stepNavigator: {
    marginBottom: 28,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  stepProgressCaption: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 16,
    textAlign: "center",
  },
  stepTrackRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 4,
  },
  stepTrackRowRtl: {
    flexDirection: "row-reverse",
  },
  stepConnector: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: STEP_TRACK,
    marginHorizontal: 6,
    marginBottom: 0,
  },
  stepConnectorDone: {
    backgroundColor: STEP_GREEN,
  },
  stepCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  stepCirclePending: {
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: STEP_TRACK,
  },
  stepCircleActive: {
    backgroundColor: ACCENT,
    borderWidth: 2,
    borderColor: ACCENT,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  stepCircleDone: {
    backgroundColor: STEP_GREEN,
    borderWidth: 2,
    borderColor: STEP_GREEN,
  },
  stepCircleNum: {
    fontSize: 15,
    fontWeight: "800",
    color: "#64748B",
  },
  stepCircleNumOnAccent: {
    color: "#FFFFFF",
  },
  stepLabelsRow: {
    flexDirection: "row",
    marginTop: 12,
    width: "100%",
  },
  stepLabelsRowRtl: {
    flexDirection: "row-reverse",
  },
  stepLabel: {
    flex: 1,
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "600",
    textAlign: "center",
    paddingHorizontal: 2,
    lineHeight: 15,
  },
  stepLabelActive: {
    color: "#C2410C",
    fontWeight: "800",
  },
  stepLabelDone: {
    color: STEP_GREEN,
    fontWeight: "700",
  },
  stepContainer: { marginBottom: 8 },
  stepHeader: { alignItems: "center", marginBottom: 24 },
  stepTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111827",
    marginTop: 12,
    marginBottom: 6,
  },
  stepSubtitle: { fontSize: 14, color: "#4B5563" },
  form: { gap: 8 },
  mapSection: { marginTop: 4, marginBottom: 4 },
  webMapFallback: { marginTop: 4 },
  mapSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  mapWrap: {
    width: "100%",
    alignSelf: "center",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
  },
  map: { ...StyleSheet.absoluteFillObject },
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
  },
  mapFabDisabled: { opacity: 0.65 },
  mapError: { marginTop: 6, fontSize: 12, color: "#DC2626" },
  coordinatesContainer: { flexDirection: "row", gap: 12 },
  coordinateInput: { flex: 1 },
  sectionLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
  },
  sectionHint: {
    fontSize: 13,
    color: "#4B5563",
    marginBottom: 12,
    lineHeight: 18,
  },
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#F9FAFB",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  docThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#E5E7EB",
  },
  docThumbPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },
  docRowText: { flex: 1 },
  docRowTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  docFileName: { marginTop: 4, fontSize: 11, color: "#9CA3AF" },
  addDocButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: ACCENT,
    borderStyle: "dashed",
    marginTop: 4,
  },
  addDocButtonText: { color: ACCENT, fontSize: 15, fontWeight: "600" },
  fieldError: { marginTop: 8, fontSize: 12, color: "#DC2626" },
  pendingNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFFBEB",
    padding: 12,
    borderRadius: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  pendingNoticeText: { flex: 1 },
  pendingNoticeTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#92400E",
    marginBottom: 4,
  },
  pendingNoticeDescription: {
    fontSize: 12,
    color: "#374151",
    lineHeight: 17,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: SCREEN_BG,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    flexDirection: "row",
    gap: 10,
    alignItems: "stretch",
  },
  stepBackButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: ACCENT_BORDER,
    backgroundColor: ACCENT_SOFT,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  stepPrimaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: ACCENT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    gap: 8,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 3,
  },
  stepPrimaryButtonFull: { flex: 1 },
  stepPrimaryButtonWithBack: { flex: 1 },
  stepPrimaryButtonDisabled: { opacity: 0.65 },
  stepPrimaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  stepPrimaryIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  rtlText: { textAlign: "right", writingDirection: "rtl" },
  typeModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.32)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  typeModalCard: {
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingVertical: 8,
    maxHeight: "70%",
  },
  typeModalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  typeModalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E7EB",
  },
  typeModalRowText: { fontSize: 16, color: "#374151", flex: 1 },
});
