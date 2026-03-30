// src/screens/auth/CompleteProfileProviderScreen.tsx

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import { Button, Input } from "../../components/common";
import { COLORS } from "../../constants";

interface CompleteProfileProviderScreenProps {
  navigation: NativeStackNavigationProp<any>;
}

export const CompleteProfileProviderScreen: React.FC<
  CompleteProfileProviderScreenProps
> = ({ navigation }) => {
  const { completeRegistration, isLoading, logout } = useAuth();

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

    if (!formData.city.trim()) {
      newErrors.city = "City is required";
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

  const handleBack = () => {
    if (currentStep === 2) {
      setCurrentStep(1);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep2()) return;

    try {
      const profileData = {
        phoneNumber: formData.phoneNumber || undefined,
        firstName: formData.firstName,
        lastName: formData.lastName,
        role: "PROVIDER",
        provider: {
          city: formData.city,
          address: formData.address || undefined,
          latitude: formData.latitude ? Number(formData.latitude) : undefined,
          longitude: formData.longitude
            ? Number(formData.longitude)
            : undefined,
          type: "INDEPENDENT",
        },
      };

      await completeRegistration(profileData);
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 401) {
        await logout();
        navigation.navigate("Login");
        return;
      }
      Alert.alert("Error", error.message || "Failed to complete profile");
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
      <Text style={styles.progressText}>Step {currentStep} of 2</Text>
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Ionicons name="construct-outline" size={60} color={COLORS.secondary} />
        <Text style={styles.stepTitle}>Provider Information</Text>
        <Text style={styles.stepSubtitle}>
          Set up your professional profile
        </Text>
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
        <Ionicons name="location-outline" size={60} color={COLORS.secondary} />
        <Text style={styles.stepTitle}>Service Location</Text>
        <Text style={styles.stepSubtitle}>Where do you provide services?</Text>
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
          placeholder="Street address"
          value={formData.address}
          onChangeText={(value) => updateField("address", value)}
          leftIcon="home-outline"
          multiline
          numberOfLines={2}
        />

        <View style={styles.coordinatesContainer}>
          <View style={styles.coordinateInput}>
            <Input
              label="Latitude (Optional)"
              placeholder="36.8065"
              value={formData.latitude}
              onChangeText={(value) => updateField("latitude", value)}
              leftIcon="navigate-outline"
              keyboardType="decimal-pad"
            />
          </View>

          <View style={styles.coordinateInput}>
            <Input
              label="Longitude (Optional)"
              placeholder="10.1815"
              value={formData.longitude}
              onChangeText={(value) => updateField("longitude", value)}
              leftIcon="navigate-outline"
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <View style={styles.pendingNotice}>
          <Ionicons name="time-outline" size={24} color={COLORS.warning} />
          <View style={styles.pendingNoticeText}>
            <Text style={styles.pendingNoticeTitle}>Pending Validation</Text>
            <Text style={styles.pendingNoticeDescription}>
              Your account will be reviewed by our admin team. You'll be
              notified once approved.
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
          <Text style={styles.title}>Complete Your Profile</Text>
          <Text style={styles.subtitle}>Provider Registration</Text>
        </View>

        {renderProgressBar()}

        {currentStep === 1 ? renderStep1() : renderStep2()}
      </ScrollView>

      <View style={styles.footer}>
        {currentStep === 2 ? (
          <Button
            title="Back"
            onPress={handleBack}
            variant="outline"
            style={styles.backButton}
          />
        ) : (
          <Button
            title="Back"
            onPress={async () => {
              await logout();
              navigation.navigate("Login");
            }}
            variant="outline"
            style={styles.backButton}
          />
        )}

        <Button
          title={currentStep === 1 ? "Next" : "Complete Profile"}
          onPress={currentStep === 1 ? handleNext : handleSubmit}
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
    backgroundColor: COLORS.secondary,
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
