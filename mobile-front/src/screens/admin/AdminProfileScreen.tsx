import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, AuthNoticeModal } from "../../components/common";
import { useAuth } from "../../context/AuthContext";
import { COLORS } from "../../constants";

const ACCENT = "#E8C97A";

export const AdminProfileScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [errorModal, setErrorModal] = useState<{
    visible: boolean;
    message: string;
  }>({ visible: false, message: "" });

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
    } catch (error: any) {
      setErrorModal({
        visible: true,
        message: error?.message || "Failed to logout",
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: insets.top + 12,
          paddingBottom: 12 + insets.bottom,
        },
      ]}
    >
      <View style={styles.container}>
        <View style={styles.headerCard}>
          <View style={styles.iconWrap}>
            <Ionicons name="person-circle-outline" size={24} color={ACCENT} />
          </View>
          <Text style={styles.title}>Profile</Text>
          <Text style={styles.subtitle}>
            Manage admin profile settings and security preferences.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.grid}>
            {["Account Info", "Security", "Preferences", "Support"].map(
              (item) => (
                <View key={item} style={styles.actionCard}>
                  <Text style={styles.actionText}>{item}</Text>
                </View>
              ),
            )}
          </View>
        </View>

        <View style={styles.logoutWrap}>
          <Button title="Log out" onPress={handleLogout} loading={isLoggingOut} />
        </View>
      </View>

      <AuthNoticeModal
        visible={errorModal.visible}
        onClose={() => setErrorModal({ visible: false, message: "" })}
        title="Error"
        message={errorModal.message}
        primaryLabel="Close"
        onPrimary={() => setErrorModal({ visible: false, message: "" })}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 0,
    gap: 16,
  },
  headerCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    padding: 18,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(232,201,122,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  title: {
    color: COLORS.text.primary,
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 6,
  },
  subtitle: {
    color: COLORS.text.secondary,
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: "#B45309",
    fontSize: 15,
    fontWeight: "600",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  actionCard: {
    width: "48.5%",
    minHeight: 86,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  actionText: {
    color: COLORS.text.primary,
    fontSize: 14,
    fontWeight: "600",
  },
  logoutWrap: {
    marginTop: "auto",
    marginBottom: 18,
  },
});
