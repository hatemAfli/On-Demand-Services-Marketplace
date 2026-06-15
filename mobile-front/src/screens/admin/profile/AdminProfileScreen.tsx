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
  ACCENT_DARK,
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

function statusStyle(status?: AccountStatus): {
  bg: string;
  border: string;
  dot: string;
  text: string;
} {
  switch (status) {
    case AccountStatus.ACTIVE:
      return {
        bg: "#ECFDF5",
        border: "#A7F3D0",
        dot: "#10B981",
        text: "#065F46",
      };
    case AccountStatus.PENDING:
      return {
        bg: ACCENT_DIM,
        border: ACCENT_BORDER,
        dot: ACCENT,
        text: ACCENT_DARK,
      };
    case AccountStatus.SUSPENDED:
      return {
        bg: "#FFF7ED",
        border: "#FED7AA",
        dot: "#EA580C",
        text: "#C2410C",
      };
    case AccountStatus.REJECTED:
      return {
        bg: "#FEF2F2",
        border: "#FECACA",
        dot: "#EF4444",
        text: "#B91C1C",
      };
    default:
      return {
        bg: "#F1F5F9",
        border: "#E2E8F0",
        dot: "#94A3B8",
        text: "#64748B",
      };
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
  const accountStatus = statusStyle(user?.status);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.stickyHeader}>
        <View style={styles.headerTop}>
          <View style={styles.avatarRing}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {initials(user?.firstName, user?.lastName)}
              </Text>
            </View>
          </View>
          <View style={styles.heroInfo}>
            <Text style={styles.heroName} numberOfLines={1}>
              {displayName}
            </Text>
            <View style={styles.emailRow}>
              <Ionicons name="mail-outline" size={13} color="#9B9BB0" />
              <Text style={styles.heroEmail} numberOfLines={1}>
                {user?.email ?? "—"}
              </Text>
            </View>
            <View style={styles.badgeRow}>
              <View style={styles.roleBadge}>
                <Ionicons name="shield-checkmark" size={11} color={ACCENT_DARK} />
                <Text style={styles.roleBadgeText}>Platform admin</Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: accountStatus.bg,
                    borderColor: accountStatus.border,
                  },
                ]}
              >
                <View
                  style={[styles.statusDot, { backgroundColor: accountStatus.dot }]}
                />
                <Text style={[styles.statusText, { color: accountStatus.text }]}>
                  {user?.status ? statusLabel(user.status) : "—"}
                </Text>
              </View>
            </View>
          </View>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => navigation.navigate("AdminEditProfile")}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.82}
          >
            <Ionicons name="create-outline" size={18} color={ACCENT_DARK} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
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
        <View style={styles.heroMeta}>
          <View style={styles.verifyRow}>
            <View
              style={[
                styles.verifyChip,
                user?.isEmailVerified ? styles.verifyChipOk : styles.verifyChipMuted,
              ]}
            >
              <Ionicons
                name={user?.isEmailVerified ? "checkmark-circle" : "mail-outline"}
                size={14}
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
            <View
              style={[
                styles.verifyChip,
                user?.isPhoneVerified ? styles.verifyChipOk : styles.verifyChipMuted,
              ]}
            >
              <Ionicons
                name={user?.isPhoneVerified ? "checkmark-circle" : "call-outline"}
                size={14}
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
            iconColor={ACCENT_DARK}
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
          style={styles.logoutCard}
          onPress={() => setLogoutModalVisible(true)}
          activeOpacity={0.88}
        >
          <View style={styles.logoutIconWrap}>
            <Ionicons name="log-out-outline" size={20} color="#DC2626" />
          </View>
          <View style={styles.logoutCopy}>
            <Text style={styles.logoutTitle}>Sign out</Text>
            <Text style={styles.logoutSub}>End your admin session on this device</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#FCA5A5" />
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
  root: {
    flex: 1,
    backgroundColor: "#F4F3FA",
  },
  stickyHeader: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#EBEBF5",
    zIndex: 10,
    ...Platform.select({
      ios: {
        shadowColor: "#1A1A2E",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  scroll: {
    flex: 1,
  },
  heroMeta: {
    gap: 14,
    paddingBottom: 4,
  },
  avatarRing: {
    padding: 3,
    borderRadius: 20,
    backgroundColor: ACCENT_DIM,
    borderWidth: 1.5,
    borderColor: ACCENT_BORDER,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 22,
    fontWeight: "800",
    color: ACCENT_DARK,
    letterSpacing: -0.5,
  },
  heroInfo: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  heroName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1A1A2E",
    letterSpacing: -0.4,
  },
  emailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  heroEmail: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
    color: "#9B9BB0",
  },
  editBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: ACCENT_DIM,
    borderWidth: 1.5,
    borderColor: ACCENT_BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
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
    color: ACCENT_DARK,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "800",
  },
  verifyRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  verifyChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  verifyChipOk: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  verifyChipMuted: {
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
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
    alignItems: "center",
    backgroundColor: "#F9F8FF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EBEBF5",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
    gap: 3,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: "#EBEBF5",
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#9B9BB0",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  statValue: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1A1A2E",
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
  logoutCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#FEF2F2",
    borderWidth: 1.5,
    borderColor: "#FECACA",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginTop: 4,
    ...Platform.select({
      ios: {
        shadowColor: "#DC2626",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 1 },
    }),
  },
  logoutIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FECACA",
    alignItems: "center",
    justifyContent: "center",
  },
  logoutCopy: {
    flex: 1,
    gap: 2,
  },
  logoutTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#B91C1C",
    letterSpacing: -0.2,
  },
  logoutSub: {
    fontSize: 12,
    fontWeight: "500",
    color: "#EF4444",
    lineHeight: 16,
  },
});
