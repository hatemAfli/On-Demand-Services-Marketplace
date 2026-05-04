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

const ACCENT = "#4F46E5";
const TOTAL_STEPS = 3;

const USE_OSM_WEB_MAP =
  Platform.OS === "android" &&
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

const DEFAULT_MAP_REGION: Region = {
  latitude: 36.8065,
  longitude: 10.1815,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

type PendingDoc = {
  id: string;
  localUri: string;
  mimeType?: string | null;
  fileName?: string | null;
  documentType: ProviderDocumentType;
};

interface CompleteProfileCompanyScreenProps {
  navigation: NativeStackNavigationProp<any>;
}

export const CompleteProfileCompanyScreen: React.FC<
  CompleteProfileCompanyScreenProps
> = ({ navigation }) => {
  const { completeRegistration } = useAuth();
  const { t, isRTL } = useAppTranslation();
  const insets = useSafeAreaInsets();

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
        <View style={styles.stepNavigatorRow}>
          {steps.map((label, index) => {
            const stepNumber = index + 1;
            const isActive = currentStep === stepNumber;
            const isDone = currentStep > stepNumber;
            return (
              <View key={label} style={styles.stepNavigatorItem}>
                <View
                  style={[
                    styles.stepNavigatorDot,
                    isActive && styles.stepNavigatorDotActive,
                    isDone && styles.stepNavigatorDotDone,
                  ]}
                >
                  <Text style={styles.stepNavigatorDotText}>
                    {isDone ? "✓" : stepNumber}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.stepNavigatorLabel,
                    isActive && styles.stepNavigatorLabelActive,
                  ]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Ionicons name="person-circle-outline" size={56} color={ACCENT} />
        <Text style={[styles.stepTitle, isRTL && styles.rtlText]}>
          {t("completeProfile.companyStep1Title")}
        </Text>
      </View>
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
      <View style={styles.stepHeader}>
        <Ionicons name="business-outline" size={56} color={ACCENT} />
        <Text style={[styles.stepTitle, isRTL && styles.rtlText]}>
          {t("completeProfile.companyStep2Title")}
        </Text>
      </View>
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
          multiline
          numberOfLines={2}
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
      <View style={styles.stepHeader}>
        <Ionicons name="document-text-outline" size={56} color={ACCENT} />
        <Text style={[styles.stepTitle, isRTL && styles.rtlText]}>
          {t("completeProfile.companyStep3Title")}
        </Text>
      </View>
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
                size={18}
                color="#4F46E5"
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
  root: { flex: 1, backgroundColor: "#F1F5F9" },
  topBackContainer: {
    position: "absolute",
    left: 24,
    zIndex: 10,
  },
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24 },
  navBackButton: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    minHeight: 44,
    justifyContent: "center",
  },
  navBackText: { color: ACCENT, fontSize: 16, fontWeight: "600" },
  panel: {
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
  stepNavigator: {
    marginBottom: 22,
    paddingHorizontal: 4,
  },
  stepNavigatorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  stepNavigatorItem: {
    flex: 1,
    alignItems: "center",
    gap: 7,
  },
  stepNavigatorDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: "#C7D2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  stepNavigatorDotActive: {
    backgroundColor: "#4F46E5",
    borderColor: "#4F46E5",
    transform: [{ scale: 1.05 }],
  },
  stepNavigatorDotDone: {
    backgroundColor: "#10B981",
    borderColor: "#10B981",
  },
  stepNavigatorDotText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  stepNavigatorLabel: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "600",
    textAlign: "center",
    width: "100%",
  },
  stepNavigatorLabelActive: {
    color: "#312E81",
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
  mapHint: {
    fontSize: 13,
    color: "#4B5563",
    lineHeight: 19,
    marginBottom: 12,
  },
  mapWrap: {
    height: 260,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
  },
  map: { width: "100%", height: "100%" },
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
    paddingHorizontal: 24,
    backgroundColor: "rgba(255,255,255,0.98)",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBackButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.4,
    borderColor: "#C7D2FE",
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  stepPrimaryButton: {
    height: 52,
    borderRadius: 26,
    backgroundColor: "#4F46E5",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    gap: 8,
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 12,
    elevation: 4,
  },
  stepPrimaryButtonFull: { flex: 1 },
  stepPrimaryButtonWithBack: { flex: 2 },
  stepPrimaryButtonDisabled: { opacity: 0.7 },
  stepPrimaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  stepPrimaryIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.2)",
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
