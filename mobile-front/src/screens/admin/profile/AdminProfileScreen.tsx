import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthNoticeModal } from "../../../components/common";
import { useAuth } from "../../../context/AuthContext";
import { api } from "../../../services/api";
import { AccountStatus } from "../../../types";
import type { AdminProfileStackParamList } from "./adminProfileNavigation";
import {
  ACCENT,
  ACCENT_DIM,
  ACCENT_BORDER,
  ProfileMenuRow,
  initials,
  profileScreenStyles,
} from "./adminProfileUi";

const APP_VERSION =
  Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? "1.0.0";

type Nav = NativeStackNavigationProp<AdminProfileStackParamList, "Profile">;

function formatMemberSince(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function statusLabel(status: AccountStatus): string {
  switch (status) {
    case AccountStatus.ACTIVE:
      return "Active";
    case AccountStatus.PENDING:
      return "Pending";
    case AccountStatus.SUSPENDED:
      return "Suspended";
    case AccountStatus.REJECTED:
      return "Blocked";
    case AccountStatus.DELETED:
      return "Deleted";
    default:
      return status;
  }
}

export const AdminProfileScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { user, logout, refreshUser } = useAuth();

  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);
  const [inAppNotifications, setInAppNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [errorModal, setErrorModal] = useState({ visible: false, message: "" });

  const displayName = useMemo(
    () =>
      [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
      "Platform Admin",
    [user?.firstName, user?.lastName],
  );

  const loadExtras = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await api.getUnreadCount();
      setUnreadCount(res.data?.count ?? 0);
    } catch {
      setUnreadCount(0);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshUser();
      void loadExtras();
    }, [refreshUser, loadExtras]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshUser(), loadExtras()]);
    setRefreshing(false);
  }, [refreshUser, loadExtras]);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
    } catch (error: unknown) {
      setErrorModal({
        visible: true,
        message:
          error instanceof Error ? error.message : "Could not sign out. Try again.",
      });
    } finally {
      setIsLoggingOut(false);
      setLogoutModalVisible(false);
    }
  };

  const permissionsCount = user?.platformAdmin?.permissions?.length ?? 0;

  return (
    <View style={[profileScreenStyles.root, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[
          profileScreenStyles.scroll,
          { paddingBottom: 24 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={ACCENT}
          />
        }
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {initials(user?.firstName, user?.lastName)}
              </Text>
            </View>
            <View style={styles.heroInfo}>
              <Text style={styles.heroName}>{displayName}</Text>
              <Text style={styles.heroEmail} numberOfLines={1}>
                {user?.email ?? "—"}
              </Text>
              <View style={styles.badgeRow}>
                <View style={styles.roleBadge}>
                  <Ionicons name="shield-checkmark" size={11} color="#92400E" />
                  <Text style={styles.roleBadgeText}>Platform admin</Text>
                </View>
                <View style={styles.statusBadge}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>
                    {user?.status ? statusLabel(user.status) : "—"}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.verifyRow}>
            <View style={styles.verifyChip}>
              <Ionicons
                name={user?.isEmailVerified ? "mail" : "mail-outline"}
                size={13}
                color={user?.isEmailVerified ? "#059669" : "#94A3B8"}
              />
              <Text
                style={[
                  styles.verifyText,
                  !user?.isEmailVerified && styles.verifyMuted,
                ]}
              >
                Email {user?.isEmailVerified ? "verified" : "unverified"}
              </Text>
            </View>
            <View style={styles.verifyChip}>
              <Ionicons
                name={user?.isPhoneVerified ? "call" : "call-outline"}
                size={13}
                color={user?.isPhoneVerified ? "#059669" : "#94A3B8"}
              />
              <Text
                style={[
                  styles.verifyText,
                  !user?.isPhoneVerified && styles.verifyMuted,
                ]}
              >
                Phone {user?.isPhoneVerified ? "verified" : "unverified"}
              </Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Member since</Text>
              <Text style={styles.statValue}>
                {formatMemberSince(user?.createdAt)}
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Permissions</Text>
              <Text style={styles.statValue}>{permissionsCount || "Full"}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Unread</Text>
              {statsLoading ? (
                <ActivityIndicator size="small" color={ACCENT} style={{ marginTop: 4 }} />
              ) : (
                <Text style={styles.statValue}>{unreadCount}</Text>
              )}
            </View>
          </View>
        </View>

        <Text style={profileScreenStyles.sectionLabel}>Account</Text>
        <View style={profileScreenStyles.card}>
          <ProfileMenuRow
            icon="user"
            iconBg={ACCENT_DIM}
            iconColor="#92400E"
            title="Edit profile"
            subtitle="Update your name and display info"
            onPress={() => navigation.navigate("AdminEditProfile")}
          />
          <View style={profileScreenStyles.divider} />
          <ProfileMenuRow
            icon="envelope"
            iconBg="#EFF6FF"
            iconColor="#2563EB"
            title="Change email"
            subtitle={user?.email ?? "Update sign-in email"}
            onPress={() => navigation.navigate("AdminChangeEmail")}
          />
          <View style={profileScreenStyles.divider} />
          <ProfileMenuRow
            icon="phone"
            iconBg="#ECFDF5"
            iconColor="#059669"
            title="Change phone"
            subtitle={user?.phoneNumber?.trim() || "Add a phone number"}
            onPress={() => navigation.navigate("AdminChangePhone")}
          />
        </View>

        <Text style={profileScreenStyles.sectionLabel}>Security</Text>
        <View style={profileScreenStyles.card}>
          <ProfileMenuRow
            icon="lock"
            iconBg="#FEF2F2"
            iconColor="#DC2626"
            title="Change password"
            subtitle="Update your sign-in password"
            onPress={() => navigation.navigate("AdminChangePassword")}
          />
          <View style={profileScreenStyles.divider} />
          <ProfileMenuRow
            icon="bell"
            iconBg="#FFF7ED"
            iconColor="#EA580C"
            title="Notifications"
            subtitle={
              unreadCount > 0
                ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
                : "View platform notifications"
            }
            onPress={() => navigation.navigate("AdminNotifications")}
          />
        </View>

        <Text style={profileScreenStyles.sectionLabel}>App preferences</Text>
        <View style={profileScreenStyles.card}>
          <View style={styles.prefRow}>
            <View style={styles.prefLeft}>
              <View style={[styles.prefIcon, { backgroundColor: "#FFF7ED" }]}>
                <Ionicons name="notifications-outline" size={16} color="#EA580C" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.prefTitle}>In-app alerts</Text>
                <Text style={styles.prefSub}>Show alerts inside the app</Text>
              </View>
            </View>
            <Switch
              value={inAppNotifications}
              onValueChange={setInAppNotifications}
              trackColor={{ false: "#CBD5E1", true: ACCENT_BORDER }}
              thumbColor="#FFFFFF"
            />
          </View>
          <View style={profileScreenStyles.divider} />
          <View style={styles.prefRow}>
            <View style={styles.prefLeft}>
              <View style={[styles.prefIcon, { backgroundColor: "#EFF6FF" }]}>
                <Ionicons name="mail-unread-outline" size={16} color="#2563EB" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.prefTitle}>Email alerts</Text>
                <Text style={styles.prefSub}>Important updates by email</Text>
              </View>
            </View>
            <Switch
              value={emailNotifications}
              onValueChange={setEmailNotifications}
              trackColor={{ false: "#CBD5E1", true: ACCENT_BORDER }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        <Text style={profileScreenStyles.sectionLabel}>Support & legal</Text>
        <View style={profileScreenStyles.card}>
          <ProfileMenuRow
            icon="file-lines"
            iconBg="#F1F5F9"
            iconColor="#475569"
            title="Terms of service"
            subtitle="Platform usage terms"
            onPress={() => navigation.navigate("AdminTerms")}
          />
          <View style={profileScreenStyles.divider} />
          <ProfileMenuRow
            icon="shield-halved"
            iconBg="#F5F3FF"
            iconColor="#7C3AED"
            title="Privacy policy"
            subtitle="How we handle your data"
            onPress={() => navigation.navigate("AdminPrivacy")}
          />
          <View style={profileScreenStyles.divider} />
          <ProfileMenuRow
            icon="tag"
            iconBg="#F1F5F9"
            iconColor="#64748B"
            title="App version"
            subtitle="ServeMe admin mobile"
            trailing={<Text style={styles.versionText}>v{APP_VERSION}</Text>}
          />
        </View>

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => setLogoutModalVisible(true)}
          activeOpacity={0.88}
        >
          <Ionicons name="log-out-outline" size={18} color="#DC2626" />
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>

      <AuthNoticeModal
        visible={logoutModalVisible}
        onClose={() => !isLoggingOut && setLogoutModalVisible(false)}
        title="Sign out?"
        message="You will need to sign in again to access the admin panel."
        primaryLabel={isLoggingOut ? "Signing out…" : "Sign out"}
        onPrimary={() => void handleLogout()}
        showDismissLink
        dismissLabel="Cancel"
      />

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
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 18,
    gap: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: { elevation: 3 },
    }),
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: ACCENT_DIM,
    borderWidth: 2,
    borderColor: ACCENT_BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 26,
    fontWeight: "800",
    color: "#92400E",
  },
  heroInfo: {
    flex: 1,
    gap: 4,
  },
  heroName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.4,
  },
  heroEmail: {
    fontSize: 13,
    fontWeight: "500",
    color: "#64748B",
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: ACCENT_DIM,
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#92400E",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  statusText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#065F46",
  },
  verifyRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  verifyChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  verifyText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#059669",
  },
  verifyMuted: {
    color: "#94A3B8",
  },
  statsRow: {
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    paddingVertical: 12,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
    gap: 3,
  },
  statDivider: {
    width: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 4,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  statValue: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  prefRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  prefLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  prefIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  prefTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  prefSub: {
    fontSize: 12,
    fontWeight: "500",
    color: "#94A3B8",
    marginTop: 1,
  },
  versionText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 14,
    paddingVertical: 15,
    marginTop: 4,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#DC2626",
  },
});
