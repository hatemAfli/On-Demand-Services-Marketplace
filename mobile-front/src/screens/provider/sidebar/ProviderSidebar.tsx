import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  I18nManager,
  useWindowDimensions,
  Image,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ProviderStackParamList } from "../../../navigation/types";
import { useAuth } from "../../../context/AuthContext";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAppTranslation } from "../../../hooks/useAppTranslation";
import { useMessagingUnreadTotal } from "../../../hooks/useMessagingUnreadTotal";
import { useNotificationsRealtime } from "../../../context/NotificationsRealtimeContext";
import type { UserWithProfile } from "../../../types";
import { ProviderType } from "../../../types";

const SIDEBAR_BADGE_CAP = 10;

function formatSidebarBadgeCount(count: number): string {
  return count > SIDEBAR_BADGE_CAP ? "10+" : String(count);
}

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

const MENU_ITEMS = [
  {
    key: "ProviderHome",
    labelKey: "provider.sidebar.menu.home",
    icon: "home-outline",
  },
  {
    key: "ProviderDashboard",
    labelKey: "provider.sidebar.menu.dashboard",
    icon: "stats-chart-outline",
  },
  {
    key: "ProviderServices",
    labelKey: "provider.sidebar.menu.services",
    icon: "construct-outline",
  },
  {
    key: "ConversationList",
    labelKey: "provider.sidebar.menu.messages",
    icon: "chatbubbles-outline",
  },
  {
    key: "Notifications",
    labelKey: "provider.sidebar.menu.notifications",
    icon: "notifications-outline",
  },
  {
    key: "ProviderComplaints",
    labelKey: "provider.sidebar.menu.complaints",
    icon: "shield-outline",
  },
  {
    key: "ProviderCalendar",
    labelKey: "provider.sidebar.menu.schedule",
    icon: "calendar-outline",
  },
  {
    key: "ProviderReviews",
    labelKey: "provider.sidebar.menu.myReviews",
    icon: "star-outline",
  },
  {
    key: "ProviderSubscriptionPlan",
    labelKey: "provider.sidebar.menu.subscriptionPlan",
    icon: "pricetag-outline",
  },
  {
    key: "ProviderSettings",
    labelKey: "provider.sidebar.menu.settings",
    icon: "settings-outline",
  },
] as const satisfies ReadonlyArray<{
  key: keyof ProviderStackParamList;
  labelKey: string;
  icon: keyof typeof Ionicons.glyphMap;
}>;

const VERTICAL_MARGIN = 14;
const HORIZONTAL_MARGIN = 8;

export const ProviderSidebar: React.FC<Props> = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const { t } = useAppTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const drawerWidth = Math.min(340, Math.max(280, width * 0.86));

  const profile = user as UserWithProfile | null;
  const providerType = profile?.provider?.type;
  const typeLabel =
    providerType === ProviderType.INDEPENDENT ||
    providerType === ProviderType.EMPLOYEE
      ? t(`provider.type.${providerType}`)
      : t("provider.type.unknown");

  const navigation =
    useNavigation<NativeStackNavigationProp<ProviderStackParamList>>();

  const { total: messagingUnread, refresh: refreshMessagingUnread } =
    useMessagingUnreadTotal(isOpen);
  const { unreadCount: notificationUnread, refreshUnreadCount } =
    useNotificationsRealtime();

  useEffect(() => {
    if (!isOpen) return;
    void refreshUnreadCount();
  }, [isOpen, refreshUnreadCount]);

  const handleLogout = async () => {
    onClose();
    await logout();
  };

  const marginTop = insets.top + VERTICAL_MARGIN;
  const marginBottom = insets.bottom + VERTICAL_MARGIN;

  const avatarUri = profile?.provider?.photoUrl;

  return (
    <View
      style={[
        styles.drawer,
        {
          width: drawerWidth,
          marginTop,
          marginBottom,
          marginHorizontal: HORIZONTAL_MARGIN,
          opacity: isOpen ? 1 : 0,
        },
      ]}
      pointerEvents={isOpen ? "auto" : "none"}
    >
      <View style={styles.headerGradient}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel={t("client.a11y.closeSidebar")}
        >
          <Ionicons name="close" size={24} color="#334155" />
        </TouchableOpacity>

        <View style={styles.profileBlock}>
          <View style={styles.profileTopRow}>
            <View style={styles.avatarOuter}>
              <View style={styles.avatarInner}>
                {avatarUri ? (
                  <Image
                    source={{ uri: avatarUri }}
                    style={styles.avatarImage}
                    accessibilityIgnoresInvertColors
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="construct" size={26} color="#F08E10" />
                  </View>
                )}
              </View>
            </View>

            <View style={styles.profileMeta}>
              <Text
                style={[
                  styles.nameText,
                  { textAlign: I18nManager.isRTL ? "right" : "left" },
                ]}
                numberOfLines={2}
              >
                {(profile?.firstName ?? "") + " " + (profile?.lastName ?? "")}
              </Text>
              <View style={styles.statusRow}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>
                  {t("provider.sidebar.statusProvider")}
                </Text>
              </View>
              <Text
                style={[
                  styles.typeText,
                  { textAlign: I18nManager.isRTL ? "right" : "left" },
                ]}
                numberOfLines={1}
              >
                {typeLabel}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.menuScroll}
        contentContainerStyle={[
          styles.menuScrollContent,
          { paddingBottom: Math.max(insets.bottom, 12) },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces
      >
        <Text style={styles.sectionTitle}>{t("provider.sidebar.mySpace")}</Text>

        {MENU_ITEMS.map((item) => {
          const isActive = item.key === "ProviderHome";
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.itemRow, isActive && styles.itemRowActive]}
              onPress={() => {
                navigation.navigate(item.key);
                if (item.key === "ConversationList") {
                  void refreshMessagingUnread();
                }
                if (item.key === "Notifications") {
                  void refreshUnreadCount();
                }
                onClose();
              }}
              activeOpacity={0.8}
            >
              <View style={styles.itemIconWrap}>
                <Ionicons
                  name={item.icon}
                  size={20}
                  color={isActive ? "#4338ca" : "#64748b"}
                />
                {item.key === "ConversationList" && messagingUnread > 0 ? (
                  <View style={styles.menuBadge}>
                    <Text style={styles.menuBadgeText}>
                      {formatSidebarBadgeCount(messagingUnread)}
                    </Text>
                  </View>
                ) : null}
                {item.key === "Notifications" && notificationUnread > 0 ? (
                  <View style={styles.menuDot} />
                ) : null}
              </View>
              <Text
                style={[styles.itemLabel, isActive && styles.itemLabelActive]}
              >
                {t(item.labelKey)}
              </Text>
              <Ionicons
                name={I18nManager.isRTL ? "chevron-back" : "chevron-forward"}
                size={16}
                color={isActive ? "#6366f1" : "#9ca3af"}
              />
            </TouchableOpacity>
          );
        })}

        <View style={styles.separator} />

        <TouchableOpacity
          style={[styles.itemRow, styles.logoutRow]}
          onPress={handleLogout}
          activeOpacity={0.85}
        >
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={[styles.itemLabel, styles.logoutLabel]}>
            {t("client.sidebar.logout")}
          </Text>
          <Ionicons
            name={I18nManager.isRTL ? "chevron-back" : "chevron-forward"}
            size={16}
            color="#f87171"
          />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  drawer: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    overflow: "hidden",
    flex: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 10,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  headerGradient: {
    paddingTop: 14,
    paddingBottom: 18,
    paddingHorizontal: 18,
    position: "relative",
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  closeButton: {
    position: "absolute",
    top: 10,
    end: 10,
    zIndex: 2,
    padding: 6,
    borderRadius: 999,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  profileBlock: {
    alignItems: "flex-start",
    paddingTop: 4,
    paddingEnd: 48,
    maxWidth: "100%",
  },
  profileTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  profileMeta: {
    flex: 1,
    justifyContent: "center",
  },
  avatarOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#F08E10",
    padding: 4,
    shadowColor: "#F08E10",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 5,
  },
  avatarInner: {
    flex: 1,
    borderRadius: 32,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  avatarPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF7ED",
    minHeight: 60,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
  },
  nameText: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  typeText: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
    marginTop: 4,
  },
  statusRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-start",
    alignItems: "center",
    marginTop: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22c55e",
  },
  statusText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "700",
  },
  menuScroll: {
    flex: 1,
  },
  menuScrollContent: {
    paddingHorizontal: 14,
    paddingTop: 8,
    flexGrow: 1,
  },
  sectionTitle: {
    color: "#64748b",
    fontWeight: "800",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    marginBottom: 10,
    marginStart: 10,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 14,
    gap: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 8,
  },
  itemRowActive: {
    backgroundColor: "#eef2ff",
    borderColor: "#c7d2fe",
  },
  itemLabel: {
    flex: 1,
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "800",
  },
  itemLabelActive: {
    color: "#312e81",
  },
  itemIconWrap: {
    position: "relative",
  },
  menuBadge: {
    position: "absolute",
    top: -4,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ef4444",
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  menuBadgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
  },
  menuDot: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#ef4444",
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  separator: {
    height: 1,
    backgroundColor: "#e2e8f0",
    marginTop: 14,
    marginBottom: 10,
  },
  logoutRow: {
    backgroundColor: "#fff1f2",
    borderWidth: 1,
    borderColor: "#fecdd3",
    marginTop: 4,
  },
  logoutLabel: {
    color: "#b91c1c",
  },
});
