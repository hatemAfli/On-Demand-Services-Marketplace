import React, { useEffect, useMemo, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import type { ProviderStackParamList } from "../../../navigation/types";

type NotificationTabKey = "all" | "jobs" | "schedule" | "system" | "company";

type NotificationSection = "Today" | "Yesterday" | "Older";

type NotificationVariant =
  | "jobRequest"
  | "scheduleReminder"
  | "companyAnnouncement"
  | "systemVerified"
  | "paymentReceived"
  | "missedRequest"
  | "reviewReceived";

type NotificationItem = {
  id: string;
  category: Exclude<NotificationTabKey, "all">;
  section: NotificationSection;
  variant: NotificationVariant;
  isUnread?: boolean;
};

type NotificationsScreenProps = {
  onPressSettings?: () => void;
};

const colors = {
  primary: "#F08E10",
  primaryHover: "#D97D08",
  secondary: "#10B981",
  background: "#F8FAFC",
  surface: "#FFFFFF",
  textMain: "#111827",
  textMuted: "#6B7280",
  textLight: "#9CA3AF",
  success: "#10B981",
  successDark: "#15803D",
  error: "#EF4444",
  warning: "#F59E0B",
  infoBlue: "#3B82F6",
  infoBg: "#EFF6FF",
  purpleSoft: "#EEF2FF",
  purpleText: "#4F46E5",
  border: "#E5E7EB",
  gray50: "#F9FAFB",
  gray100: "#F3F4F6",
  gray200: "#E5E7EB",
  gray300: "#D1D5DB",
  gray700: "#374151",
  gray900: "#111827",
};

const initialNotifications: NotificationItem[] = [
  {
    id: "job-request",
    category: "jobs",
    section: "Today",
    variant: "jobRequest",
    isUnread: true,
  },
  {
    id: "schedule-reminder",
    category: "schedule",
    section: "Today",
    variant: "scheduleReminder",
    isUnread: true,
  },
  {
    id: "company-announcement",
    category: "company",
    section: "Today",
    variant: "companyAnnouncement",
  },
  {
    id: "system-verified",
    category: "system",
    section: "Yesterday",
    variant: "systemVerified",
  },
  {
    id: "payment-received",
    category: "jobs",
    section: "Yesterday",
    variant: "paymentReceived",
  },
  {
    id: "missed-request",
    category: "system",
    section: "Yesterday",
    variant: "missedRequest",
  },
  {
    id: "review-received",
    category: "system",
    section: "Older",
    variant: "reviewReceived",
  },
];

const sectionOrder: NotificationSection[] = ["Today", "Yesterday", "Older"];

const tabItems = [
  { key: "all", label: "All" },
  { key: "jobs", label: "Job Requests", badge: "3" },
  { key: "schedule", label: "Schedule" },
  { key: "system", label: "System" },
  { key: "company", label: "Company", icon: "building" as const },
] as const;

function NotificationsScreenContent(props: NotificationsScreenProps) {
  const [activeTab, setActiveTab] = useState<NotificationTabKey>("all");
  const [notifications, setNotifications] = useState(initialNotifications);
  const [showJobModal, setShowJobModal] = useState(false);
  const [showOfflineIndicator, setShowOfflineIndicator] = useState(false);

  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    const showTimer = setTimeout(() => {
      setShowOfflineIndicator(true);
      hideTimer = setTimeout(() => {
        setShowOfflineIndicator(false);
      }, 3000);
    }, 5000);

    return () => {
      clearTimeout(showTimer);
      if (hideTimer) {
        clearTimeout(hideTimer);
      }
    };
  }, []);

  const visibleNotifications = useMemo(() => {
    if (activeTab === "all") {
      return notifications;
    }
    return notifications.filter((item) => item.category === activeTab);
  }, [activeTab, notifications]);

  const allRead = useMemo(
    () => notifications.every((item) => !item.isUnread),
    [notifications],
  );

  const handleMarkAllRead = () => {
    if (allRead) {
      return;
    }
    setNotifications((prev) =>
      prev.map((item) => ({ ...item, isUnread: false })),
    );
  };

  const showHeaders = activeTab === "all";

  const renderUnreadDot = (item: NotificationItem) =>
    item.isUnread ? <View style={styles.unreadDot} /> : null;

  const renderNotificationCard = (item: NotificationItem) => {
    const cardBase = [styles.cardBase, styles.cardShadow];

    switch (item.variant) {
      case "jobRequest":
        return (
          <TouchableOpacity
            key={item.id}
            onPress={() => setShowJobModal(true)}
            activeOpacity={0.92}
            style={[
              ...cardBase,
              styles.cardPrimaryBorder,
              item.isUnread && styles.cardUnread,
            ]}
          >
            <View style={styles.cardRow}>
              <View style={[styles.iconCircle, styles.iconCirclePrimary]}>
                <FontAwesome6 name="briefcase" size={14} color={colors.primary} />
              </View>
              <View style={styles.cardBody}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitleBold}>New Job Request</Text>
                  <Text style={styles.cardTime}>2m ago</Text>
                </View>
                <Text style={styles.cardMessage} numberOfLines={2}>
                  AC Maintenance required at Dubai Marina. Customer is waiting for
                  acceptance.
                </Text>
                <View style={styles.actionRow}>
                  <TouchableOpacity activeOpacity={0.9} style={styles.actionPrimary}>
                    <Text style={styles.actionPrimaryText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity activeOpacity={0.9} style={styles.actionSecondary}>
                    <Text style={styles.actionSecondaryText}>Decline</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
            {renderUnreadDot(item)}
          </TouchableOpacity>
        );
      case "scheduleReminder":
        return (
          <TouchableOpacity
            key={item.id}
            activeOpacity={0.92}
            style={[
              ...cardBase,
              styles.cardInfoBorder,
              item.isUnread && styles.cardUnread,
            ]}
          >
            <View style={styles.cardRow}>
              <View style={[styles.iconCircle, styles.iconCircleInfo]}>
                <FontAwesome6
                  name="calendar-check"
                  size={14}
                  color={colors.infoBlue}
                />
              </View>
              <View style={styles.cardBody}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitleBold}>Upcoming Job in 1 Hour</Text>
                  <Text style={styles.cardTime}>15m ago</Text>
                </View>
                <Text style={styles.cardMessage}>
                  Do not forget to head to
                  <Text style={styles.cardMessageStrong}> Villa 45, Palm Jumeirah</Text>
                  for the scheduled plumbing service.
                </Text>
                <View style={styles.inlineActionRow}>
                  <FontAwesome6
                    name="location-arrow"
                    size={10}
                    color={colors.infoBlue}
                  />
                  <Text style={styles.inlineActionText}>Navigate to location</Text>
                </View>
              </View>
            </View>
            {renderUnreadDot(item)}
          </TouchableOpacity>
        );
      case "companyAnnouncement":
        return (
          <TouchableOpacity
            key={item.id}
            activeOpacity={0.92}
            style={[...cardBase, styles.cardCompany]}
          >
            <View style={styles.cardRow}>
              <View style={[styles.iconCircle, styles.iconCircleCompany]}>
                <FontAwesome6 name="bullhorn" size={14} color={colors.purpleText} />
              </View>
              <View style={styles.cardBody}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitleBold}>Company Announcement</Text>
                  <Text style={styles.cardTimePurple}>1h ago</Text>
                </View>
                <Text style={styles.cardMessagePurple}>
                  New bonus structure effective from next week. Complete 10 jobs
                  to earn 15% extra commission.
                </Text>
                <Text style={styles.linkText}>Read Policy Document</Text>
              </View>
            </View>
            <View style={styles.cornerGlow} />
          </TouchableOpacity>
        );
      case "systemVerified":
        return (
          <TouchableOpacity
            key={item.id}
            activeOpacity={0.92}
            style={[...cardBase, styles.cardRead]}
          >
            <View style={styles.cardRow}>
              <View style={[styles.iconCircle, styles.iconCircleMuted]}>
                <FontAwesome6 name="shield-halved" size={14} color={colors.textMuted} />
              </View>
              <View style={styles.cardBody}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitleMedium}>Document Verified</Text>
                  <Text style={styles.cardTime}>Yesterday</Text>
                </View>
                <Text style={styles.cardMessage}>
                  Your Trade License has been successfully verified by the admin
                  team.
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        );
      case "paymentReceived":
        return (
          <TouchableOpacity
            key={item.id}
            activeOpacity={0.92}
            style={[...cardBase, styles.cardRead]}
          >
            <View style={styles.cardRow}>
              <View style={[styles.iconCircle, styles.iconCircleSuccess]}>
                <FontAwesome6 name="check-double" size={14} color={colors.success} />
              </View>
              <View style={styles.cardBody}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitleMedium}>Payment Received</Text>
                  <Text style={styles.cardTime}>Yesterday</Text>
                </View>
                <Text style={styles.cardMessage}>
                  You received
                  <Text style={styles.cardMessageSuccess}> AED 150.00</Text> for Job
                  #JB-9921. Wallet updated.
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        );
      case "missedRequest":
        return (
          <TouchableOpacity
            key={item.id}
            activeOpacity={0.92}
            style={[...cardBase, styles.cardErrorBorder]}
          >
            <View style={styles.cardRow}>
              <View style={[styles.iconCircle, styles.iconCircleError]}>
                <FontAwesome6
                  name="triangle-exclamation"
                  size={14}
                  color={colors.error}
                />
              </View>
              <View style={styles.cardBody}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitleBold}>Missed Job Request</Text>
                  <Text style={styles.cardTime}>Yesterday</Text>
                </View>
                <Text style={styles.cardMessage}>
                  You missed a job request. Please keep your app online to
                  maintain your acceptance rate.
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        );
      case "reviewReceived":
        return (
          <TouchableOpacity
            key={item.id}
            activeOpacity={0.92}
            style={[...cardBase, styles.cardReadStrong]}
          >
            <View style={styles.cardRow}>
              <View style={[styles.iconCircle, styles.iconCircleWarning]}>
                <FontAwesome6 name="star" size={14} color={colors.warning} />
              </View>
              <View style={styles.cardBody}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitleMedium}>New 5-Star Review!</Text>
                  <Text style={styles.cardTime}>3 days ago</Text>
                </View>
                <Text style={styles.cardMessage}>
                  {"\"Excellent service, very professional and on time.\" - Sarah J."}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        );
      default:
        return null;
    }
  };

  const renderSection = (section: NotificationSection) => {
    const items = visibleNotifications.filter((item) => item.section === section);
    if (items.length === 0) {
      return null;
    }

    return (
      <View key={section} style={styles.sectionBlock}>
        <Text style={styles.sectionHeader}>{section}</Text>
        {items.map(renderNotificationCard)}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[0]}
      >
        <View style={styles.headerWrap}>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>Notifications</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={handleMarkAllRead}
                activeOpacity={0.85}
                disabled={allRead}
              >
                <Text
                  style={[
                    styles.markAllText,
                    allRead && styles.markAllTextDisabled,
                  ]}
                >
                  {allRead ? "All caught up" : "Mark all read"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={props.onPressSettings}
                activeOpacity={0.85}
                style={styles.settingsBtn}
              >
                <FontAwesome6 name="gear" size={14} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsRow}
          >
            {tabItems.map((tab) => {
              const isActive = activeTab === tab.key;
              const isCompany = tab.key === "company";
              return (
                <TouchableOpacity
                  key={tab.key}
                  activeOpacity={0.9}
                  onPress={() => setActiveTab(tab.key)}
                  style={[
                    styles.tabBase,
                    isActive ? styles.tabActive : styles.tabInactive,
                    !isActive && isCompany && styles.tabCompanyInactive,
                  ]}
                >
                  {"icon" in tab && tab.icon ? (
                    <FontAwesome6
                      name={tab.icon}
                      size={9}
                      color={
                        isActive
                          ? "#FFFFFF"
                          : isCompany
                            ? colors.purpleText
                            : colors.textMuted
                      }
                      style={styles.tabIcon}
                    />
                  ) : null}
                  <Text
                    style={[
                      styles.tabText,
                      isActive ? styles.tabTextActive : styles.tabTextInactive,
                      !isActive && isCompany && styles.tabTextCompanyInactive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                  {"badge" in tab && tab.badge ? (
                    <View style={styles.tabBadge}>
                      <Text style={styles.tabBadgeText}>{tab.badge}</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.contentWrap}>
          {showOfflineIndicator ? (
            <View style={styles.offlineIndicator}>
              <FontAwesome6 name="wifi" size={10} color={colors.successDark} />
              <Text style={styles.offlineText}>Back online - Syncing...</Text>
            </View>
          ) : null}

          {visibleNotifications.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <FontAwesome6 name="bell-slash" size={28} color={colors.gray300} />
              </View>
              <Text style={styles.emptyTitle}>No Notifications</Text>
              <Text style={styles.emptyText}>
                You are all caught up. Check back later for updates.
              </Text>
            </View>
          ) : (
            <View style={styles.listWrap}>
              {showHeaders
                ? sectionOrder.map((section) => renderSection(section))
                : visibleNotifications.map(renderNotificationCard)}
            </View>
          )}

          <View style={styles.bottomSpacer} />
        </View>
      </ScrollView>

      <Modal
        visible={showJobModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowJobModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowJobModal(false)}
          />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Job Request Details</Text>
              <TouchableOpacity
                onPress={() => setShowJobModal(false)}
                activeOpacity={0.85}
                style={styles.modalCloseBtn}
              >
                <FontAwesome6 name="xmark" size={14} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.timerBadge}>
                <FontAwesome6
                  name="stopwatch"
                  size={12}
                  color={colors.error}
                />
                <Text style={styles.timerText}>Expires in 02:45</Text>
              </View>

              <View style={styles.customerRow}>
                <Image
                  source={{
                    uri: "https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-6.jpg",
                  }}
                  style={styles.customerAvatar}
                />
                <View>
                  <Text style={styles.customerName}>Fatima Al-Sayed</Text>
                  <View style={styles.ratingRow}>
                    <FontAwesome6 name="star" size={10} color={colors.warning} />
                    <Text style={styles.ratingText}>4.9 (12 reviews)</Text>
                  </View>
                </View>
              </View>

              <View style={styles.jobInfoCard}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Service</Text>
                  <Text style={styles.infoValue}>
                    AC Maintenance (Split Unit)
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Location</Text>
                  <Text style={styles.infoValue}>Marina Gate 2, Dubai Marina</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Est. Earnings</Text>
                  <Text style={styles.infoValueSuccess}>AED 120.00</Text>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                onPress={() => setShowJobModal(false)}
                activeOpacity={0.9}
                style={styles.modalBtnSecondary}
              >
                <Text style={styles.modalBtnSecondaryText}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowJobModal(false)}
                activeOpacity={0.9}
                style={styles.modalBtnPrimary}
              >
                <Text style={styles.modalBtnPrimaryText}>Accept Job</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

type Props = NativeStackScreenProps<
  ProviderStackParamList,
  "ProviderNotifications"
>;

export const ProviderNotificationsScreen: React.FC<Props> = ({
  navigation,
}) => (
  <NotificationsScreenContent
    onPressSettings={() => navigation.navigate("ProviderSettings")}
  />
);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  headerWrap: {
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.textMain,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  markAllText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
    marginRight: 12,
  },
  markAllTextDisabled: {
    color: colors.textMuted,
    fontWeight: "500",
  },
  settingsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.gray50,
    alignItems: "center",
    justifyContent: "center",
  },
  tabsRow: {
    paddingBottom: 4,
  },
  tabBase: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginRight: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  tabInactive: {
    backgroundColor: "transparent",
  },
  tabCompanyInactive: {
    borderWidth: 1,
    borderColor: "#E9D5FF",
    backgroundColor: "rgba(238, 242, 255, 0.5)",
  },
  tabIcon: {
    marginRight: 6,
  },
  tabText: {
    fontSize: 12,
  },
  tabTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  tabTextInactive: {
    color: colors.textMuted,
    fontWeight: "500",
  },
  tabTextCompanyInactive: {
    color: colors.purpleText,
    fontWeight: "600",
  },
  tabBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(240, 142, 16, 0.1)",
  },
  tabBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: colors.primary,
  },
  contentWrap: {
    backgroundColor: colors.gray50,
    minHeight: "100%",
  },
  offlineIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#DCFCE7",
    backgroundColor: "#ECFDF3",
  },
  offlineText: {
    fontSize: 10,
    color: colors.successDark,
    fontWeight: "600",
    marginLeft: 6,
  },
  listWrap: {
    padding: 16,
  },
  sectionBlock: {
    marginBottom: 10,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    marginBottom: 6,
    marginTop: 8,
    letterSpacing: 0.6,
  },
  cardBase: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.gray100,
    marginBottom: 12,
  },
  cardShadow: {
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardUnread: {
    backgroundColor: colors.surface,
  },
  cardPrimaryBorder: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  cardInfoBorder: {
    borderLeftWidth: 4,
    borderLeftColor: colors.infoBlue,
  },
  cardErrorBorder: {
    borderLeftWidth: 4,
    borderLeftColor: colors.error,
  },
  cardCompany: {
    backgroundColor: colors.purpleSoft,
    borderColor: "#E9D5FF",
  },
  cardRead: {
    opacity: 0.8,
  },
  cardReadStrong: {
    opacity: 0.7,
  },
  cardRow: {
    flexDirection: "row",
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  iconCirclePrimary: {
    backgroundColor: "rgba(240, 142, 16, 0.1)",
  },
  iconCircleInfo: {
    backgroundColor: colors.infoBg,
  },
  iconCircleCompany: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "#E9D5FF",
  },
  iconCircleMuted: {
    backgroundColor: colors.gray100,
  },
  iconCircleSuccess: {
    backgroundColor: "#ECFDF3",
  },
  iconCircleError: {
    backgroundColor: "#FEE2E2",
  },
  iconCircleWarning: {
    backgroundColor: "#FEF3C7",
  },
  cardBody: {
    flex: 1,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardTitleBold: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textMain,
    flex: 1,
    marginRight: 8,
  },
  cardTitleMedium: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textMain,
    flex: 1,
    marginRight: 8,
  },
  cardTime: {
    fontSize: 10,
    color: colors.textMuted,
  },
  cardTimePurple: {
    fontSize: 10,
    color: "rgba(79, 70, 229, 0.7)",
    fontWeight: "600",
  },
  cardMessage: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 6,
    lineHeight: 16,
  },
  cardMessageStrong: {
    fontWeight: "700",
    color: colors.textMain,
  },
  cardMessageSuccess: {
    fontWeight: "700",
    color: colors.success,
  },
  cardMessagePurple: {
    fontSize: 12,
    color: "rgba(17, 24, 39, 0.8)",
    marginTop: 6,
    lineHeight: 16,
  },
  actionRow: {
    flexDirection: "row",
    marginTop: 12,
  },
  actionPrimary: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
    marginRight: 8,
  },
  actionPrimaryText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  actionSecondary: {
    flex: 1,
    backgroundColor: colors.gray100,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
  },
  actionSecondaryText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  inlineActionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  inlineActionText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.infoBlue,
    marginLeft: 6,
  },
  linkText: {
    marginTop: 8,
    fontSize: 10,
    fontWeight: "700",
    color: colors.purpleText,
  },
  unreadDot: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  cornerGlow: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 48,
    height: 48,
    backgroundColor: "rgba(199, 210, 254, 0.5)",
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 24,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.gray100,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textMain,
  },
  emptyText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: 8,
    maxWidth: 220,
    lineHeight: 16,
  },
  bottomSpacer: {
    height: 24,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
  },
  modalHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textMain,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.gray50,
    alignItems: "center",
    justifyContent: "center",
  },
  modalScroll: {
    maxHeight: 420,
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  timerBadge: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 16,
  },
  timerText: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: "700",
    color: colors.error,
  },
  customerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  customerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.gray200,
    marginRight: 12,
  },
  customerName: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMain,
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  ratingText: {
    fontSize: 11,
    color: colors.textMuted,
    marginLeft: 6,
  },
  jobInfoCard: {
    backgroundColor: colors.gray50,
    borderRadius: 12,
    padding: 14,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  infoLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  infoValue: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMain,
    textAlign: "right",
    flex: 1,
    marginLeft: 12,
  },
  infoValueSuccess: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.success,
  },
  modalFooter: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
  },
  modalBtnSecondary: {
    flex: 1,
    backgroundColor: colors.gray100,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginRight: 12,
  },
  modalBtnSecondaryText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMain,
  },
  modalBtnPrimary: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  modalBtnPrimaryText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
