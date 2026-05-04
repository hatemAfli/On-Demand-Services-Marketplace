// src/navigation/AppNavigator.tsx

import React from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth, getRoleFromSession } from "../context/AuthContext";
import { AuthNavigator } from "./AuthNavigator";
import { ClientOverlayNavigator } from "./ClientOverlayNavigator";
import { ClientSpaceRouter } from "./ClientSpaceRouter";
import { ProviderSpaceRouter } from "./ProviderSpaceRouter";
import { CompanySpaceRouter } from "./CompanySpaceRouter";
import { AdminNavigator } from "../screens/admin";
import { ForcedPasswordResetScreen } from "../screens/auth/ForcedPasswordResetScreen";
import { UserRole } from "../types";
import { COLORS } from "../constants";

const RecoveryStack = createNativeStackNavigator();

function PasswordRecoveryNavigator() {
  return (
    <RecoveryStack.Navigator screenOptions={{ headerShown: false }}>
      <RecoveryStack.Screen
        name="ForcedPasswordReset"
        component={ForcedPasswordResetScreen}
      />
    </RecoveryStack.Navigator>
  );
}

export const AppNavigator: React.FC = () => {
  const {
    isAuthenticated,
    isInitializing,
    user,
    session,
    needsProfileCompletion,
    pendingPasswordRecovery,
  } = useAuth();

  if (isInitializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const renderDashboard = () => {
    if (!user) return null;

    switch (user.role) {
      case UserRole.CLIENT:
        return <ClientSpaceRouter />;
      case UserRole.PROVIDER:
        return <ProviderSpaceRouter />;
      case UserRole.COMPANY_ADMIN:
        return <CompanySpaceRouter />;
      case UserRole.PLATFORM_ADMIN:
        return <AdminNavigator />;
      default:
        return <ClientOverlayNavigator />;
    }
  };

  /** Only two top-level keys so a brief session/user mismatch does not remount the whole tree. */
  const rootNavKey = isAuthenticated ? "main" : "auth";

  const completeProfileRole = getRoleFromSession(session);

  return (
    <NavigationContainer key={rootNavKey}>
      {isAuthenticated && pendingPasswordRecovery ? (
        <PasswordRecoveryNavigator />
      ) : isAuthenticated ? (
        renderDashboard()
      ) : (
        <AuthNavigator
          key={needsProfileCompletion ? "stack-profile" : "stack-guest"}
          initialRouteName={
            needsProfileCompletion ? "CompleteProfile" : "Welcome"
          }
          completeProfileInitialParams={
            needsProfileCompletion ? { role: completeProfileRole } : undefined
          }
        />
      )}
    </NavigationContainer>
  );
};
const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
  },
});
