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
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import { Button, Input, LanguageSwitcher } from "../../components/common";
import { useAppTranslation } from "../../hooks/useAppTranslation";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ACCENT = "#E8C97A";

interface CompleteProfileClientScreenProps {
  navigation: NativeStackNavigationProp<any>;
}

export const CompleteProfileClientScreen: React.FC<
  CompleteProfileClientScreenProps
> = ({ navigation }) => {
  const { completeRegistration, isLoading } = useAuth();
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

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [currentStep, setCurrentStep] = useState(1);

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
    if (currentStep === 1) {
      if (validateStep1()) {
        setCurrentStep(2);
      }
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

  const handleSubmit = async () => {
    if (!validateStep2()) return;

    try {
      const profileData = {
        phoneNumber: formData.phoneNumber || undefined,
        firstName: formData.firstName,
        lastName: formData.lastName,
        role: "CLIENT",
        client: {
          city: formData.city,
          address: formData.address || undefined,
          latitude: formData.latitude ? Number(formData.latitude) : undefined,
          longitude: formData.longitude
            ? Number(formData.longitude)
            : undefined,
        },
      };

      await completeRegistration(profileData);
    } catch (error: any) {
      Alert.alert(
        t("common.error"),
        error.message || t("completeProfile.submitError"),
      );
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
        <Ionicons name="person-circle-outline" size={56} color={ACCENT} />
        <Text style={[styles.stepTitle, isRTL && styles.rtlText]}>
          {t("completeProfile.step1Title")}
        </Text>
        <Text style={[styles.stepSubtitle, isRTL && styles.rtlText]}>
          {t("completeProfile.step1Subtitle")}
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
          {t("completeProfile.step2Title")}
        </Text>
        <Text style={[styles.stepSubtitle, isRTL && styles.rtlText]}>
          {t("completeProfile.step2Subtitle")}
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
              {t("completeProfile.title")}
            </Text>
            <Text style={[styles.subtitle, isRTL && styles.rtlText]}>
              {t("completeProfile.subtitle")}
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
            loading={isLoading}
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
  form: {
    gap: 8,
  },
  coordinatesContainer: {
    flexDirection: "row",
    gap: 12,
  },
  coordinateInput: {
    flex: 1,
  },
  locationTip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(232,201,122,0.10)",
    padding: 12,
    borderRadius: 12,
    gap: 10,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "rgba(232,201,122,0.22)",
  },
  locationTipText: {
    flex: 1,
    fontSize: 13,
    color: "#E8E6F0",
    lineHeight: 18,
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
