// src/navigation/AppNavigator.tsx

import React from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { useAuth, getRoleFromSession } from "../context/AuthContext";
import { AuthNavigator } from "./AuthNavigator";
import { ClientDashboardScreen } from "../screens/client/ClientDashboardScreen";
import { ProviderDashboardScreen } from "../screens/provider/ProviderDashboardScreen";
import { CompanyDashboardScreen } from "../screens/company/CompanyDashboardScreen";
import { UserRole } from "../types";
import { COLORS } from "../constants";

export const AppNavigator: React.FC = () => {
  const { isAuthenticated, isLoading, user, session, needsProfileCompletion } =
    useAuth();

  if (isLoading) {
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
        return <ClientDashboardScreen />;
      case UserRole.PROVIDER:
        return <ProviderDashboardScreen />;
      case UserRole.COMPANY_ADMIN:
        return <CompanyDashboardScreen />;
      default:
        return <ClientDashboardScreen />;
    }
  };

  const navKey = isAuthenticated
    ? "main"
    : needsProfileCompletion
      ? "complete-profile"
      : "auth";

  const completeProfileRole = getRoleFromSession(session);

  return (
    <NavigationContainer key={navKey}>
      {isAuthenticated ? (
        renderDashboard()
      ) : (
        <AuthNavigator
          initialRouteName={
            needsProfileCompletion ? "CompleteProfile" : "Welcome"
          }
          completeProfileInitialParams={
            needsProfileCompletion
              ? { role: completeProfileRole }
              : undefined
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
