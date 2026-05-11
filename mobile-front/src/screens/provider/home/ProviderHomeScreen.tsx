import React, { useMemo, useState } from "react";
import {
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import type { ProviderStackParamList } from "../../../navigation/types";
import { useAuth } from "../../../context/AuthContext";

type HomeActiveJobsScreenProps = {
  displayName: string;
  locationShort: string;
  photoUrl?: string | null;
  avatarInitials: string;
  onPressNotifications?: () => void;
  onPressCall?: () => void;
  onPressChat?: () => void;
  onPressNavigate?: () => void;
  onPressUpdateStatus?: () => void;
  onPressViewAllScheduled?: () => void;
  onPressScheduledItem?: () => void;
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function HomeActiveJobsScreen(props: HomeActiveJobsScreenProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [headerElevated, setHeaderElevated] = useState(false);

  const headerStyle = useMemo(
    () => [styles.header, headerElevated && styles.headerElevated],
    [headerElevated],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />

      <View style={headerStyle}>
        <View style={styles.headerInner}>
          <View style={styles.headerRow}>
            <View style={styles.profileBlock}>
              <View style={styles.avatarOuter}>
                <View style={styles.avatarWrap}>
                  {props.photoUrl ? (
                    <Image
                      source={{ uri: props.photoUrl }}
                      style={styles.avatar}
                    />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                      <Text style={styles.avatarInitials}>
                        {props.avatarInitials}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.onlineDot} />
              </View>
              <View style={styles.profileTextCol}>
                <Text style={styles.welcomeText}>Welcome back,</Text>
                <Text style={styles.nameText} numberOfLines={1}>
                  {props.displayName}
                </Text>
              </View>
            </View>

            <View style={styles.headerActions}>
              <View style={styles.switchRow}>
                <Switch
                  value={isOnline}
                  onValueChange={setIsOnline}
                  trackColor={{ false: "#E5E7EB", true: colors.success }}
                  thumbColor={colors.surface}
                />
              </View>

              <TouchableOpacity
                onPress={props.onPressNotifications}
                activeOpacity={0.85}
                style={styles.iconButton}
              >
                <Text style={styles.iconText}>📕</Text>
                <View style={styles.notificationDot} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.statusRow}>
            <View style={styles.statusChip}>
              <View style={styles.statusChipDot} />
              <Text style={styles.statusChipText}>
                {isOnline ? "You are Online" : "You are Offline"}
              </Text>
            </View>

            <Text style={styles.locationText} numberOfLines={1}>
              📍 {props.locationShort}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          setHeaderElevated(y > 10);
        }}
        scrollEventThrottle={16}
      >
        {/* Active Job */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Active Job</Text>
            <View style={styles.jobIdPill}>
              <Text style={styles.jobIdText}>#JOB-8821</Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.progressTrack}>
              <View style={styles.progressFill} />
            </View>

            <View style={styles.cardBody}>
              <View style={styles.jobTopRow}>
                <View style={styles.customerRow}>
                  <View style={styles.customerAvatarWrap}>
                    <Image
                      source={{
                        uri: "https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-6.jpg",
                      }}
                      style={styles.customerAvatar}
                    />
                  </View>
                  <View>
                    <Text style={styles.customerName}>Sarah Johnson</Text>
                    <View style={styles.ratingRow}>
                      <Text style={styles.ratingStar}>★</Text>
                      <Text style={styles.ratingText}>4.9 (12 jobs)</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.timerBlock}>
                  <Text style={styles.timerText}>14:20</Text>
                  <Text style={styles.timerLabel}>TIME REMAINING</Text>
                </View>
              </View>

              <View style={styles.detailsBox}>
                <View style={styles.detailRow}>
                  <View style={styles.detailIconCircle}>
                    <Text style={styles.detailIconText}>🛠️</Text>
                  </View>
                  <View style={styles.detailTextBlock}>
                    <Text style={styles.detailLabel}>SERVICE TYPE</Text>
                    <Text style={styles.detailTitle}>
                      AC Maintenance & Cleaning
                    </Text>
                    <Text style={styles.detailSub}>
                      2 Split Units • Standard Service
                    </Text>
                  </View>
                </View>

                <View style={styles.detailsDivider} />

                <View style={styles.detailRow}>
                  <View style={styles.detailIconCircle}>
                    <Text style={styles.detailIconText}>📍</Text>
                  </View>
                  <View style={styles.detailTextBlock}>
                    <Text style={styles.detailLabel}>LOCATION</Text>
                    <Text style={styles.detailTitle} numberOfLines={1}>
                      Villa 42, King Fahd Road, Riyadh
                    </Text>
                    <Text style={styles.detailSub}>
                      4.2 km away • ~12 min drive
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.actionsRow}>
                <TouchableOpacity
                  onPress={props.onPressCall}
                  activeOpacity={0.85}
                  style={styles.actionSmall}
                >
                  <Text style={styles.actionIcon}>📞</Text>
                  <Text style={styles.actionLabel}>Call</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={props.onPressChat}
                  activeOpacity={0.85}
                  style={styles.actionSmall}
                >
                  <Text style={styles.actionIcon}>💬</Text>
                  <Text style={styles.actionLabel}>Chat</Text>
                  <View style={styles.chatDot} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={props.onPressNavigate}
                  activeOpacity={0.9}
                  style={styles.actionPrimary}
                >
                  <Text style={styles.actionPrimaryIcon}>➔</Text>
                  <Text style={styles.actionPrimaryText}>Navigate</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.cardFooter}>
              <Text style={styles.footerStatusText}>
                Status:{" "}
                <Text style={styles.footerStatusAccent}>On the way</Text>
              </Text>
              <TouchableOpacity
                onPress={props.onPressUpdateStatus}
                activeOpacity={0.85}
              >
                <Text style={styles.updateStatusText}>Update Status ›</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Earnings Snapshot */}
        <View style={[styles.section, styles.sectionTight]}>
          <View style={styles.row2}>
            <View style={styles.statCard}>
              <View style={styles.statHeaderRow}>
                <View
                  style={[styles.statIconCircle, styles.statIconCircleSuccess]}
                >
                  <Text
                    style={[styles.statIconText, styles.statIconTextSuccess]}
                  >
                    👛
                  </Text>
                </View>
                <Text style={styles.statKicker}>TODAY</Text>
              </View>
              <Text style={styles.statValue}>SAR 420</Text>
              <Text style={styles.statDelta}>↗ +12% vs yesterday</Text>
            </View>

            <View style={styles.statCard}>
              <View style={styles.statHeaderRow}>
                <View
                  style={[styles.statIconCircle, styles.statIconCirclePrimary]}
                >
                  <Text
                    style={[styles.statIconText, styles.statIconTextPrimary]}
                  >
                    ✅
                  </Text>
                </View>
                <Text style={styles.statKicker}>COMPLETED</Text>
              </View>
              <Text style={styles.statValue}>3 Jobs</Text>
              <Text style={styles.statHint}>Goal: 5 jobs/day</Text>
            </View>
          </View>
        </View>

        {/* Next Scheduled */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Next Scheduled</Text>
            <TouchableOpacity
              onPress={props.onPressViewAllScheduled}
              activeOpacity={0.85}
            >
              <Text style={styles.linkText}>View All</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={props.onPressScheduledItem}
            activeOpacity={0.85}
            style={styles.scheduledCard}
          >
            <View style={styles.scheduledTimeCol}>
              <Text style={styles.scheduledDay}>TODAY</Text>
              <Text style={styles.scheduledTime}>16:00</Text>
            </View>

            <View style={styles.scheduledContent}>
              <Text style={styles.scheduledTitle} numberOfLines={1}>
                Plumbing Repair
              </Text>
              <Text style={styles.scheduledSub} numberOfLines={1}>
                Mr. Khalid • Al Malqa District
              </Text>
            </View>

            <View style={styles.scheduledArrow}>
              <Text style={styles.scheduledArrowText}>›</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Performance */}
        <View style={styles.section}>
          <View style={styles.performanceCard}>
            <View style={styles.performanceHeaderRow}>
              <View>
                <Text style={styles.performanceTitle}>Performance</Text>
                <Text style={styles.performanceSub}>Weekly Summary</Text>
              </View>
              <View style={styles.performanceBadge}>
                <Text style={styles.performanceBadgeText}>▲ Excellent</Text>
              </View>
            </View>

            <View style={styles.performanceGrid}>
              <View style={styles.performanceMetric}>
                <View style={styles.metricTrack}>
                  <View
                    style={[
                      styles.metricFill,
                      { width: "98%", backgroundColor: colors.success },
                    ]}
                  />
                </View>
                <Text style={styles.metricValue}>4.9</Text>
                <Text style={styles.metricLabel}>RATING</Text>
              </View>

              <View style={styles.performanceMetric}>
                <View style={styles.metricTrack}>
                  <View
                    style={[
                      styles.metricFill,
                      { width: "92%", backgroundColor: colors.primary },
                    ]}
                  />
                </View>
                <Text style={styles.metricValue}>92%</Text>
                <Text style={styles.metricLabel}>ACCEPTANCE</Text>
              </View>

              <View style={styles.performanceMetric}>
                <View style={styles.metricTrack}>
                  <View
                    style={[
                      styles.metricFill,
                      { width: "100%", backgroundColor: colors.warning },
                    ]}
                  />
                </View>
                <Text style={styles.metricValue}>100%</Text>
                <Text style={styles.metricLabel}>COMPLETION</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Provider Tips */}
        <View style={[styles.section, styles.sectionTips]}>
          <Text style={styles.sectionTitle}>Provider Tips</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tipsRow}
          >
            <View style={styles.tipCard}>
              <View style={[styles.tipIconCircle, styles.tipIconBlue]}>
                <Text style={[styles.tipIconText, styles.tipIconTextBlue]}>
                  📷
                </Text>
              </View>
              <View style={styles.tipTextBlock}>
                <Text style={styles.tipTitle}>Take Photos</Text>
                <Text style={styles.tipSub}>
                  Always take before & after photos to avoid disputes.
                </Text>
              </View>
            </View>

            <View style={styles.tipCard}>
              <View style={[styles.tipIconCircle, styles.tipIconPurple]}>
                <Text style={[styles.tipIconText, styles.tipIconTextPurple]}>
                  🥧
                </Text>
              </View>
              <View style={styles.tipTextBlock}>
                <Text style={styles.tipTitle}>Safety First</Text>
                <Text style={styles.tipSub}>
                  Wear your safety gear and ID badge at all times.
                </Text>
              </View>
            </View>
          </ScrollView>
        </View>

        {/* Bottom menu intentionally removed per request */}
      </ScrollView>
    </SafeAreaView>
  );
}

export const ProviderHomeScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<ProviderStackParamList>>();
  const { user } = useAuth();

  const { displayName, locationShort, photoUrl, avatarInitials } =
    useMemo(() => {
      const name =
        [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
        "Provider";
      const city = user?.provider?.city?.trim();
      const addr = user?.provider?.address?.trim();
      let loc = "";
      if (city && addr) loc = `${city}, ${addr}`;
      else if (city) loc = city;
      else if (addr) loc = addr;
      else loc = "Add your location in profile";
      const url = user?.provider?.photoUrl?.trim() || null;
      return {
        displayName: name,
        locationShort: loc,
        photoUrl: url,
        avatarInitials: initialsFromName(name),
      };
    }, [user]);

  return (
    <HomeActiveJobsScreen
      displayName={displayName}
      locationShort={locationShort}
      photoUrl={photoUrl}
      avatarInitials={avatarInitials}
      onPressNotifications={() => navigation.navigate("ProviderNotifications")}
      onPressCall={() => {}}
      onPressChat={() => navigation.navigate("ProviderMessages")}
      onPressNavigate={() => navigation.navigate("ProviderCalendar")}
      onPressUpdateStatus={() => navigation.navigate("ProviderCalendar")}
      onPressViewAllScheduled={() => navigation.navigate("ProviderCalendar")}
      onPressScheduledItem={() => navigation.navigate("ProviderCalendar")}
    />
  );
};

const colors = {
  primary: "#F08E10",
  primaryHover: "#D97D08",
  success: "#10B981",
  error: "#EF4444",
  warning: "#F59E0B",
  background: "#F8FAFC",
  surface: "#FFFFFF",
  textMain: "#111827",
  textMuted: "#6B7280",
  textLight: "#9CA3AF",
  accent: "#F4F4F5",
  input: "#F3F4F6",
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#F3F4F6",
  },
  headerElevated: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  headerInner: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  profileBlock: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  profileTextCol: {
    flex: 1,
    minWidth: 0,
  },
  avatarOuter: {
    position: "relative",
    width: 48,
    height: 48,
    marginRight: 12,
  },
  avatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: colors.surface,
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
  avatarPlaceholder: {
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontSize: 16,
    fontWeight: "800",
    color: "#4B5563",
  },
  onlineDot: {
    position: "absolute",
    right: 1,
    bottom: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  welcomeText: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.textMuted,
  },
  nameText: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.textMain,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  switchRow: {
    marginRight: 10,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontSize: 16,
    color: colors.textMain,
  },
  notificationDot: {
    position: "absolute",
    top: 10,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.error,
    borderWidth: 1,
    borderColor: colors.surface,
  },
  statusRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16,185,129,0.10)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusChipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
    marginRight: 8,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.success,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  locationText: {
    flex: 1,
    marginLeft: 10,
    minWidth: 0,
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
    textAlign: "right",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 130,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  section: {
    marginBottom: 18,
  },
  sectionTight: {
    marginBottom: 10,
  },
  sectionTips: {
    marginBottom: 0,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.textMain,
  },
  jobIdPill: {
    backgroundColor: "rgba(240,142,16,0.10)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  jobIdText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 20,
    elevation: 3,
  },
  progressTrack: {
    height: 6,
    backgroundColor: "#F3F4F6",
  },
  progressFill: {
    height: 6,
    width: "66%",
    backgroundColor: colors.primary,
    borderTopRightRadius: 999,
    borderBottomRightRadius: 999,
  },
  cardBody: {
    padding: 18,
  },
  jobTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  customerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  customerAvatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#F3F4F6",
    marginRight: 12,
  },
  customerAvatar: {
    width: "100%",
    height: "100%",
  },
  customerName: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.textMain,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  ratingStar: {
    color: colors.warning,
    fontSize: 12,
    marginRight: 6,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
  },
  timerBlock: {
    alignItems: "flex-end",
  },
  timerText: {
    fontSize: 28,
    fontWeight: "900",
    color: colors.primary,
    letterSpacing: -0.5,
  },
  timerLabel: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: "800",
    color: colors.textMuted,
    letterSpacing: 1,
  },
  detailsBox: {
    backgroundColor: "rgba(244,244,245,0.50)",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  detailIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 1,
  },
  detailIconText: {
    fontSize: 14,
  },
  detailTextBlock: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.textMuted,
    letterSpacing: 0.8,
  },
  detailTitle: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: "800",
    color: colors.textMain,
  },
  detailSub: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
  },
  detailsDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 12,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  actionSmall: {
    flex: 1,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  actionIcon: {
    fontSize: 18,
    color: colors.textMain,
    marginBottom: 4,
  },
  actionLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textMuted,
  },
  chatDot: {
    position: "absolute",
    top: 12,
    right: 14,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.error,
    borderWidth: 1,
    borderColor: colors.surface,
  },
  actionPrimary: {
    flex: 2,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  actionPrimaryIcon: {
    color: colors.surface,
    fontSize: 16,
    marginRight: 10,
  },
  actionPrimaryText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: "800",
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F9FAFB",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  footerStatusText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
  },
  footerStatusAccent: {
    color: colors.primary,
    fontWeight: "800",
  },
  updateStatusText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.primary,
  },
  row2: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 1,
  },
  statHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  statIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  statIconCircleSuccess: {
    backgroundColor: "rgba(16,185,129,0.10)",
  },
  statIconCirclePrimary: {
    backgroundColor: "rgba(240,142,16,0.10)",
  },
  statIconText: {
    fontSize: 14,
  },
  statIconTextSuccess: {
    color: colors.success,
  },
  statIconTextPrimary: {
    color: colors.primary,
  },
  statKicker: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.textMuted,
    letterSpacing: 0.8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "900",
    color: colors.textMain,
  },
  statDelta: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: "800",
    color: colors.success,
  },
  statHint: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
  },
  linkText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.primary,
  },
  scheduledCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  scheduledTimeCol: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRightWidth: 1,
    borderRightColor: "#F3F4F6",
    marginRight: 12,
  },
  scheduledDay: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.textMuted,
  },
  scheduledTime: {
    marginTop: 2,
    fontSize: 18,
    fontWeight: "900",
    color: colors.textMain,
  },
  scheduledContent: {
    flex: 1,
    minWidth: 0,
  },
  scheduledTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.textMain,
  },
  scheduledSub: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
  },
  scheduledArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F9FAFB",
    alignItems: "center",
    justifyContent: "center",
  },
  scheduledArrowText: {
    fontSize: 18,
    color: colors.textLight,
    marginTop: -2,
  },
  performanceCard: {
    backgroundColor: "#111827",
    borderRadius: 24,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 4,
  },
  performanceHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  performanceTitle: {
    color: colors.surface,
    fontSize: 18,
    fontWeight: "800",
  },
  performanceSub: {
    color: "#9CA3AF",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  performanceBadge: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  performanceBadgeText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: "900",
  },
  performanceGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  performanceMetric: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 6,
  },
  metricTrack: {
    width: "100%",
    height: 6,
    backgroundColor: "#374151",
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 10,
  },
  metricFill: {
    height: 6,
    borderRadius: 999,
  },
  metricValue: {
    color: colors.surface,
    fontSize: 20,
    fontWeight: "900",
  },
  metricLabel: {
    marginTop: 3,
    color: "#9CA3AF",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  tipsRow: {
    paddingTop: 12,
    paddingBottom: 8,
    paddingRight: 24,
  },
  tipCard: {
    width: 260,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    padding: 14,
    flexDirection: "row",
    marginRight: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 1,
  },
  tipIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  tipIconBlue: {
    backgroundColor: "#EFF6FF",
  },
  tipIconPurple: {
    backgroundColor: "#F5F3FF",
  },
  tipIconText: {
    fontSize: 16,
  },
  tipIconTextBlue: {
    color: "#3B82F6",
  },
  tipIconTextPurple: {
    color: "#8B5CF6",
  },
  tipTextBlock: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.textMain,
    marginBottom: 6,
  },
  tipSub: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
    lineHeight: 18,
  },
  rtlText: {},
});
