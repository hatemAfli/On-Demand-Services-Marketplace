// src/screens/provider/ProviderDashboardScreen.tsx

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import { COLORS } from "../../constants";

export const ProviderDashboardScreen: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="construct" size={80} color={COLORS.secondary} />
        <Text style={styles.title}>Provider Dashboard</Text>
        <Text style={styles.subtitle}>Welcome, {user?.firstName}!</Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoLabel}>Email:</Text>
        <Text style={styles.infoValue}>{user?.email}</Text>

        <Text style={styles.infoLabel}>Role:</Text>
        <Text style={styles.infoValue}>{user?.role}</Text>

        <Text style={styles.infoLabel}>Status:</Text>
        <Text
          style={[
            styles.infoValue,
            user?.status === "ACTIVE"
              ? styles.statusActive
              : styles.statusPending,
          ]}
        >
          {user?.status}
        </Text>

        {user?.status === "PENDING" && (
          <View style={styles.pendingNotice}>
            <Ionicons name="time-outline" size={20} color={COLORS.warning} />
            <Text style={styles.pendingText}>
              Your account is pending admin approval
            </Text>
          </View>
        )}
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Ionicons name="log-out-outline" size={20} color={COLORS.white} />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <Text style={styles.comingSoon}>More features coming soon...</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 24,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: COLORS.text.primary,
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.text.secondary,
    marginTop: 8,
  },
  infoCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 24,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoLabel: {
    fontSize: 12,
    color: COLORS.text.secondary,
    marginTop: 12,
  },
  infoValue: {
    fontSize: 16,
    color: COLORS.text.primary,
    fontWeight: "600",
    marginTop: 4,
  },
  statusActive: {
    color: COLORS.success,
  },
  statusPending: {
    color: COLORS.warning,
  },
  pendingNotice: {
    flexDirection: "row",
    backgroundColor: COLORS.warning + "10",
    padding: 12,
    borderRadius: 8,
    gap: 8,
    marginTop: 16,
  },
  pendingText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text.secondary,
  },
  logoutButton: {
    flexDirection: "row",
    backgroundColor: COLORS.error,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  logoutText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
  },
  comingSoon: {
    textAlign: "center",
    fontSize: 14,
    color: COLORS.text.tertiary,
    marginTop: 24,
  },
});
