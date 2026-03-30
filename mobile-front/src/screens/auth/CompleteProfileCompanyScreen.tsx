// src/screens/auth/CompleteProfileCompanyScreen.tsx

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
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import { Button, Input } from "../../components/common";
import { COLORS } from "../../constants";

interface CompleteProfileCompanyScreenProps {
  navigation: NativeStackNavigationProp<any>;
}

export const CompleteProfileCompanyScreen: React.FC<
  CompleteProfileCompanyScreenProps
> = ({ navigation }) => {
  const { completeRegistration, isLoading } = useAuth();

  const [formData, setFormData] = useState({
    // Admin personal info
    phoneNumber: "",
    firstName: "",
    lastName: "",
    // Company info — backend requires existing company UUID (invite/onboarding)
    companyId: "",
    legalName: "",
    commercialName: "",
    city: "",
    address: "",
    latitude: "",
    longitude: "",
    mainContact: "",
    serviceZone1: "",
    serviceZone2: "",
    serviceZone3: "",
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
      newErrors.firstName = "First name is required";
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = "Last name is required";
    }

    if (formData.phoneNumber && !/^\+?[\d\s-()]+$/.test(formData.phoneNumber)) {
      newErrors.phoneNumber = "Invalid phone number format";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.legalName.trim()) {
      newErrors.legalName = "Legal name is required";
    }

    if (!formData.commercialName.trim()) {
      newErrors.commercialName = "Commercial name is required";
    }

    if (!formData.companyId.trim()) {
      newErrors.companyId = "Company ID is required";
    }

    if (!formData.mainContact.trim()) {
      newErrors.mainContact = "Main contact is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep3 = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.city.trim()) {
      newErrors.city = "City is required";
    }

    if (!formData.serviceZone1.trim()) {
      newErrors.serviceZone1 = "At least one service zone is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (currentStep === 1 && validateStep1()) {
      setCurrentStep(2);
    } else if (currentStep === 2 && validateStep2()) {
      setCurrentStep(3);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep3()) return;

    try {
      const serviceZones = [
        formData.serviceZone1,
        formData.serviceZone2,
        formData.serviceZone3,
      ].filter(Boolean);

      const profileData = {
        phoneNumber: formData.phoneNumber || undefined,
        firstName: formData.firstName,
        lastName: formData.lastName,
        role: "COMPANY_ADMIN",
        companyData: {
          companyId: formData.companyId.trim(),
          legalName: formData.legalName,
          commercialName: formData.commercialName,
          city: formData.city,
          address: formData.address || undefined,
          latitude: formData.latitude ? Number(formData.latitude) : undefined,
          longitude: formData.longitude
            ? Number(formData.longitude)
            : undefined,
          serviceZones,
          mainContact: formData.mainContact,
        },
      };

      await completeRegistration(profileData);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to complete profile");
    }
  };

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            { width: `${(currentStep / 3) * 100}%` },
          ]}
        />
      </View>
      <Text style={styles.progressText}>Step {currentStep} of 3</Text>
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Ionicons
          name="person-circle-outline"
          size={60}
          color={COLORS.roles.company}
        />
        <Text style={styles.stepTitle}>Admin Information</Text>
        <Text style={styles.stepSubtitle}>Your personal details</Text>
      </View>

      <View style={styles.form}>
        <Input
          label="First Name *"
          placeholder="Enter your first name"
          value={formData.firstName}
          onChangeText={(value) => updateField("firstName", value)}
          leftIcon="person-outline"
          error={errors.firstName}
          autoCapitalize="words"
        />

        <Input
          label="Last Name *"
          placeholder="Enter your last name"
          value={formData.lastName}
          onChangeText={(value) => updateField("lastName", value)}
          leftIcon="person-outline"
          error={errors.lastName}
          autoCapitalize="words"
        />

        <Input
          label="Phone Number (Optional)"
          placeholder="+216 12 345 678"
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
        <Ionicons
          name="business-outline"
          size={60}
          color={COLORS.roles.company}
        />
        <Text style={styles.stepTitle}>Company Information</Text>
        <Text style={styles.stepSubtitle}>Legal and business details</Text>
      </View>

      <View style={styles.form}>
        <Input
          label="Legal Name *"
          placeholder="Official registered name"
          value={formData.legalName}
          onChangeText={(value) => updateField("legalName", value)}
          leftIcon="document-text-outline"
          error={errors.legalName}
        />

        <Input
          label="Commercial Name *"
          placeholder="Business/trade name"
          value={formData.commercialName}
          onChangeText={(value) => updateField("commercialName", value)}
          leftIcon="storefront-outline"
          error={errors.commercialName}
        />

        <Input
          label="Company ID *"
          placeholder="UUID from your organization"
          value={formData.companyId}
          onChangeText={(value) => updateField("companyId", value)}
          leftIcon="key-outline"
          autoCapitalize="none"
          error={errors.companyId}
        />

        <Input
          label="Main Contact *"
          placeholder="Primary contact person"
          value={formData.mainContact}
          onChangeText={(value) => updateField("mainContact", value)}
          leftIcon="person-outline"
          error={errors.mainContact}
        />
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Ionicons name="map-outline" size={60} color={COLORS.roles.company} />
        <Text style={styles.stepTitle}>Location & Coverage</Text>
        <Text style={styles.stepSubtitle}>Where you operate</Text>
      </View>

      <View style={styles.form}>
        <Input
          label="City *"
          placeholder="e.g., Tunis"
          value={formData.city}
          onChangeText={(value) => updateField("city", value)}
          leftIcon="business-outline"
          error={errors.city}
          autoCapitalize="words"
        />

        <Input
          label="Address (Optional)"
          placeholder="Office address"
          value={formData.address}
          onChangeText={(value) => updateField("address", value)}
          leftIcon="home-outline"
          multiline
          numberOfLines={2}
        />

        <View style={styles.coordinatesContainer}>
          <View style={styles.coordinateInput}>
            <Input
              label="Latitude"
              placeholder="36.8065"
              value={formData.latitude}
              onChangeText={(value) => updateField("latitude", value)}
              leftIcon="navigate-outline"
              keyboardType="decimal-pad"
            />
          </View>

          <View style={styles.coordinateInput}>
            <Input
              label="Longitude"
              placeholder="10.1815"
              value={formData.longitude}
              onChangeText={(value) => updateField("longitude", value)}
              leftIcon="navigate-outline"
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <View style={styles.serviceZonesSection}>
          <Text style={styles.serviceZonesTitle}>Service Zones</Text>
          <Text style={styles.serviceZonesSubtitle}>
            Areas where your company provides services
          </Text>

          <Input
            label="Zone 1 *"
            placeholder="e.g., Tunis, Ariana"
            value={formData.serviceZone1}
            onChangeText={(value) => updateField("serviceZone1", value)}
            leftIcon="location-outline"
            error={errors.serviceZone1}
          />

          <Input
            label="Zone 2 (Optional)"
            placeholder="e.g., Sousse, Monastir"
            value={formData.serviceZone2}
            onChangeText={(value) => updateField("serviceZone2", value)}
            leftIcon="location-outline"
          />

          <Input
            label="Zone 3 (Optional)"
            placeholder="e.g., Sfax, Mahdia"
            value={formData.serviceZone3}
            onChangeText={(value) => updateField("serviceZone3", value)}
            leftIcon="location-outline"
          />
        </View>

        <View style={styles.pendingNotice}>
          <Ionicons
            name="shield-checkmark-outline"
            size={24}
            color={COLORS.warning}
          />
          <View style={styles.pendingNoticeText}>
            <Text style={styles.pendingNoticeTitle}>
              Admin Verification Required
            </Text>
            <Text style={styles.pendingNoticeDescription}>
              Your company will be verified by our team. Legal documents may be
              requested.
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Company Registration</Text>
          <Text style={styles.subtitle}>Complete your company profile</Text>
        </View>

        {renderProgressBar()}

        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
      </ScrollView>

      <View style={styles.footer}>
        {currentStep > 1 && (
          <Button
            title="Back"
            onPress={handleBack}
            variant="outline"
            style={styles.backButton}
          />
        )}

        <Button
          title={currentStep === 3 ? "Complete Registration" : "Next"}
          onPress={currentStep === 3 ? handleSubmit : handleNext}
          loading={isLoading}
          style={styles.submitButton}
        />
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 24,
    marginTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: COLORS.text.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.text.secondary,
  },
  progressContainer: {
    marginBottom: 32,
  },
  progressBar: {
    height: 6,
    backgroundColor: COLORS.gray[200],
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFill: {
    height: "100%",
    backgroundColor: COLORS.roles.company,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: COLORS.text.secondary,
    textAlign: "center",
  },
  stepContainer: {
    marginBottom: 24,
  },
  stepHeader: {
    alignItems: "center",
    marginBottom: 32,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: "600",
    color: COLORS.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 14,
    color: COLORS.text.secondary,
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
  serviceZonesSection: {
    marginTop: 16,
    padding: 16,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  serviceZonesTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text.primary,
    marginBottom: 4,
  },
  serviceZonesSubtitle: {
    fontSize: 12,
    color: COLORS.text.secondary,
    marginBottom: 16,
  },
  pendingNotice: {
    flexDirection: "row",
    backgroundColor: COLORS.warning + "10",
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: COLORS.warning + "30",
  },
  pendingNoticeText: {
    flex: 1,
  },
  pendingNoticeTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text.primary,
    marginBottom: 4,
  },
  pendingNoticeDescription: {
    fontSize: 12,
    color: COLORS.text.secondary,
    lineHeight: 16,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexDirection: "row",
    gap: 12,
  },
  backButton: {
    flex: 1,
  },
  submitButton: {
    flex: 2,
  },
});
