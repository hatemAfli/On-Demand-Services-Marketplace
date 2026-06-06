import React, { useCallback, useLayoutEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ProviderStackParamList } from "../../../navigation/types";
import { useAuth } from "../../../context/AuthContext";
import { useAppTranslation } from "../../../hooks/useAppTranslation";
import {
  api,
  type AppointmentStatus,
  type ProviderCalendarAppointment,
  type ProviderDashboardResponse,
} from "../../../services/api";
import { isEmployeeProvider } from "../../../utils/providerEmployment";
import { formatRating, statusAccent } from "./providerDashboardUtils";

type Nav = NativeStackNavigationProp<
  ProviderStackParamList,
  "ProviderDashboard"
>;

const C = {
  accent: "#EA580C",
  accentDark: "#C2410C",
  accentLight: "#FFF7ED",
  accentBorder: "#FFEDD5",
  amber: "#EA580C",
  amberDark: "#C2410C",
  amberLight: "#FFF7ED",
  amberBorder: "#FFEDD5",
  bg: "#F1F5F9",
  surface: "#FFFFFF",
  text: "#1A1A2E",
  sub: "#6B7280",
  muted: "#9CA3AF",
  border: "#E5E7EB",
  success: "#10B981",
  error: "#EF4444",
  blue: "#0284C7",
  purple: "#EA580C",
};

type QuickActionRoute =
  | "ProviderCalendar"
  | "ProviderSchedule"
  | "ProviderReviews"
  | "ProviderComplaints"
  | "ProviderServices"
  | "ConversationList"
  | "ProviderInvitations";

type QuickAction = {
  route: QuickActionRoute;
  icon: keyof typeof Ionicons.glyphMap;
  labelKey: string;
  color: string;
  bg: string;
  badge?: number;
};

function navigateQuickAction(nav: Nav, route: QuickActionRoute) {
  switch (route) {
    case "ProviderCalendar":
      nav.navigate("ProviderCalendar");
      break;
    case "ProviderSchedule":
      nav.navigate("ProviderSchedule");
      break;
    case "ProviderReviews":
      nav.navigate("ProviderReviews");
      break;
    case "ProviderComplaints":
      nav.navigate("ProviderComplaints");
      break;
    case "ProviderServices":
      nav.navigate("ProviderServices");
      break;
    case "ConversationList":
      nav.navigate("ConversationList");
      break;
    case "ProviderInvitations":
      nav.navigate("ProviderInvitations");
      break;
  }
}

function initials(first?: string | null, last?: string | null): string {
  const a = (first ?? "").trim()[0] ?? "";
  const b = (last ?? "").trim()[0] ?? "";
  const s = (a + b).toUpperCase();
  return s || "?";
}

function formatApptWhen(a: ProviderCalendarAppointment): string {
  try {
    const [y, m, d] = a.scheduledDate.split("-").map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1);
    const day = dt.toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    return `${day} · ${a.scheduledTime}`;
  } catch {
    return `${a.scheduledDate} · ${a.scheduledTime}`;
  }
}

function statusLabel(
  status: AppointmentStatus,
  t: (key: string) => string,
): string {
  const key = `provider.dashboard.status.${status}`;
  const translated = t(key);
  return translated === key ? status.replace(/_/g, " ") : translated;
}

export const ProviderDashboardScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { t } = useAppTranslation();
  const { user } = useAuth();
  const isEmployee = isEmployeeProvider(user);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [dashboard, setDashboard] = useState<ProviderDashboardResponse | null>(
    null,
  );

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(false);
    try {
      const res = await api.getProviderDashboard();
      setDashboard(res.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t("provider.screenTitles.ProviderDashboard"),
      headerTitleAlign: "center",
      headerLeft: () => (
        <View style={styles.headerSide}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.headerBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="chevron-back" size={22} color={C.text} />
          </TouchableOpacity>
        </View>
      ),
      headerRight: () => (
        <View style={styles.headerSide}>
          <TouchableOpacity
            onPress={() => void load(true)}
            style={styles.headerBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel={t("provider.dashboard.refresh")}
          >
            <Ionicons name="refresh-outline" size={22} color={C.text} />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, t, load]);

  const kpi = dashboard?.kpi;
  const profile = dashboard?.profile;
  const complaints = dashboard?.complaints;
  const performance = dashboard?.performance;
  const rating = formatRating(profile?.averageRating);
  const totalReviews = profile?.totalReviews ?? 0;
  const acceptPct = performance?.acceptPct ?? 0;
  const completePct = performance?.completePct ?? 0;
  const badgeKey = performance?.badgeKey ?? "needsAttention";
  const activeComplaints = complaints?.activeComplaints ?? 0;
  const totalComplaints = complaints?.totalComplaints ?? 0;
  const pendingInvitations = dashboard?.pendingInvitations ?? 0;
  const unreadTotal = dashboard?.unreadMessages ?? 0;
  const companyName = profile?.companyName ?? null;
  const todayJobs = kpi?.todayJobs ?? 0;
  const completedToday = kpi?.completedToday ?? 0;
  const weekCompleted = kpi?.weekCompleted ?? 0;
  const remainingToday = kpi?.remainingToday ?? 0;
  const jobsTrend = kpi?.jobsTrend ?? "same";
  const jobsTrendPct = kpi?.jobsTrendPct;
  const weekBars = dashboard?.activityTrend ?? [];
  const maxBar = Math.max(1, ...weekBars.map((b) => b.count));
  const statusBreakdown = dashboard?.pipelineBreakdown ?? [];
  const upcoming = dashboard?.upcoming ?? [];

  const quickActions = useMemo((): QuickAction[] => {
    const items: QuickAction[] = [
      {
        route: "ProviderCalendar",
        icon: "calendar-outline",
        labelKey: "provider.dashboard.actions.calendar",
        color: C.blue,
        bg: "#EFF6FF",
      },
      {
        route: "ProviderSchedule",
        icon: "time-outline",
        labelKey: "provider.dashboard.actions.schedule",
        color: C.accent,
        bg: C.accentLight,
      },
      {
        route: "ProviderReviews",
        icon: "star-outline",
        labelKey: "provider.dashboard.actions.reviews",
        color: C.amber,
        bg: C.amberLight,
      },
      {
        route: "ProviderComplaints",
        icon: "shield-outline",
        labelKey: "provider.dashboard.actions.complaints",
        color: C.error,
        bg: "#FEF2F2",
        badge: activeComplaints > 0 ? activeComplaints : undefined,
      },
      {
        route: "ProviderServices",
        icon: "construct-outline",
        labelKey: "provider.dashboard.actions.services",
        color: "#059669",
        bg: "#ECFDF5",
      },
      {
        route: "ConversationList",
        icon: "chatbubbles-outline",
        labelKey: "provider.dashboard.actions.messages",
        color: "#0284C7",
        bg: "#E0F2FE",
        badge: unreadTotal > 0 ? unreadTotal : undefined,
      },
    ];
    if (!isEmployee) {
      items.push({
        route: "ProviderInvitations",
        icon: "briefcase-outline",
        labelKey: "provider.dashboard.actions.invitations",
        color: C.accentDark,
        bg: C.accentLight,
        badge: pendingInvitations > 0 ? pendingInvitations : undefined,
      });
    }
    return items;
  }, [activeComplaints, unreadTotal, pendingInvitations, isEmployee]);

  const displayName =
    [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim() ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    t("provider.dashboard.fallbackName");
  const photoUri = (profile?.photoUrl ?? user?.provider?.photoUrl)?.trim();

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={C.amber} />
        <Text style={styles.loadingText}>{t("provider.dashboard.loading")}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor={C.amber}
          />
        }
      >
        {error ? (
          <TouchableOpacity
            style={styles.errorBanner}
            onPress={() => void load(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="cloud-offline-outline" size={18} color={C.error} />
            <Text style={styles.errorText}>{t("provider.dashboard.loadError")}</Text>
          </TouchableOpacity>
        ) : null}

        {/* Hero */}
        <LinearGradient
          colors={[C.accentLight, "#FFFFFF", C.accentBorder]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroTop}>
            <View style={styles.heroTextCol}>
              <Text style={styles.heroEyebrow}>{t("provider.dashboard.eyebrow")}</Text>
              <Text style={styles.heroName} numberOfLines={2}>
                {displayName}
              </Text>
              {isEmployee && companyName ? (
                <View style={styles.companyPill}>
                  <Ionicons name="business-outline" size={12} color={C.accent} />
                  <Text style={styles.companyPillText} numberOfLines={1}>
                    {companyName}
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={styles.avatarRing}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarInitials}>
                  {initials(user?.firstName, user?.lastName)}
                </Text>
              )}
            </View>
          </View>
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStat}>
              <Ionicons name="star" size={14} color={C.amber} />
              <Text style={styles.heroStatValue}>{rating}</Text>
              <Text style={styles.heroStatLabel}>
                {t("provider.dashboard.rating", { count: totalReviews })}
              </Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{weekCompleted}</Text>
              <Text style={styles.heroStatLabel}>
                {t("provider.dashboard.weekCompleted")}
              </Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroStat}>
              <Text
                style={[
                  styles.heroStatValue,
                  activeComplaints > 0 && { color: C.error },
                ]}
              >
                {activeComplaints}
              </Text>
              <Text style={styles.heroStatLabel}>
                {t("provider.dashboard.openComplaints")}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* KPI grid */}
        <View style={styles.kpiGrid}>
          <KpiCard
            icon="today-outline"
            iconColor={C.amber}
            label={t("provider.dashboard.kpi.today")}
            value={String(todayJobs)}
            hint={trendHintFromApi(jobsTrend, jobsTrendPct, t)}
            hintColor={trendColor(jobsTrend)}
          />
          <KpiCard
            icon="checkmark-done-outline"
            iconColor={C.success}
            label={t("provider.dashboard.kpi.completedToday")}
            value={String(completedToday)}
            hint={t("provider.dashboard.kpi.remaining", {
              count: remainingToday,
            })}
          />
          <KpiCard
            icon="analytics-outline"
            iconColor={C.blue}
            label={t("provider.dashboard.kpi.acceptRate")}
            value={`${acceptPct}%`}
            hint={t("provider.dashboard.kpi.last7Days")}
          />
          <KpiCard
            icon="flag-outline"
            iconColor={C.accent}
            label={t("provider.dashboard.kpi.completeRate")}
            value={`${completePct}%`}
            hint={t(`provider.dashboard.badge.${badgeKey}`)}
          />
        </View>

        {/* 7-day activity */}
        <Section
          title={t("provider.dashboard.sections.activity")}
          dotColor={C.amber}
        >
          <View style={styles.card}>
            <WeekChart bars={weekBars} max={maxBar} />
          </View>
        </Section>

        {/* Status breakdown */}
        {statusBreakdown.length > 0 ? (
          <Section
            title={t("provider.dashboard.sections.pipeline")}
            dotColor={C.blue}
          >
            <View style={styles.card}>
              <View style={styles.chipWrap}>
                {statusBreakdown.map((item) => (
                  <View key={item.status} style={styles.chip}>
                    <View
                      style={[
                        styles.chipDot,
                        { backgroundColor: statusAccent(item.status) },
                      ]}
                    />
                    <Text style={styles.chipLabel}>
                      {statusLabel(item.status, t)}
                    </Text>
                    <Text style={styles.chipCount}>{item.count}</Text>
                  </View>
                ))}
              </View>
            </View>
          </Section>
        ) : null}

        {/* Performance */}
        <Section
          title={t("provider.dashboard.sections.performance")}
          dotColor={C.accent}
        >
          <LinearGradient
            colors={[C.accent, C.accentDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.performanceCard}
          >
            <View style={styles.perfRow}>
              <PerfMetric
                label={t("provider.dashboard.perf.rating")}
                value={rating}
                pct={Math.min(100, (Number(rating) / 5) * 100)}
                color="#FFFFFF"
                light
              />
              <PerfMetric
                label={t("provider.dashboard.perf.accept")}
                value={`${acceptPct}%`}
                pct={acceptPct}
                color={C.accentLight}
                light
              />
              <PerfMetric
                label={t("provider.dashboard.perf.complete")}
                value={`${completePct}%`}
                pct={completePct}
                color={C.accentBorder}
                light
              />
            </View>
            <View style={styles.badgeRow}>
              <View style={styles.performanceBadgePill}>
                <Text style={styles.performanceBadgeText}>
                  {t(`provider.dashboard.badge.${badgeKey}`)}
                </Text>
              </View>
              {totalComplaints > 0 ? (
                <Text style={styles.performanceComplaintsHint}>
                  {t("provider.dashboard.complaintsTotal", {
                    count: totalComplaints,
                  })}
                </Text>
              ) : null}
            </View>
          </LinearGradient>
        </Section>

        {/* Quick actions */}
        <Section
          title={t("provider.dashboard.sections.shortcuts")}
          dotColor={C.amber}
        >
          <View style={styles.actionsGrid}>
            {quickActions.map((action) => (
              <TouchableOpacity
                key={action.route}
                style={styles.actionTile}
                activeOpacity={0.85}
                onPress={() => navigateQuickAction(navigation, action.route)}
              >
                <View style={[styles.actionIcon, { backgroundColor: action.bg }]}>
                  <Ionicons name={action.icon} size={22} color={action.color} />
                  {action.badge != null && action.badge > 0 ? (
                    <View style={styles.actionBadge}>
                      <Text style={styles.actionBadgeText}>
                        {action.badge > 9 ? "9+" : String(action.badge)}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.actionLabel} numberOfLines={2}>
                  {t(action.labelKey)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Section>

        {/* Upcoming */}
        <Section
          title={t("provider.dashboard.sections.upcoming")}
          dotColor={C.success}
          actionLabel={t("provider.dashboard.viewCalendar")}
          onAction={() => navigation.navigate("ProviderCalendar")}
        >
          {upcoming.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="calendar-clear-outline" size={28} color={C.muted} />
              <Text style={styles.emptyTitle}>
                {t("provider.dashboard.upcomingEmpty")}
              </Text>
              <Text style={styles.emptySub}>
                {t("provider.dashboard.upcomingEmptySub")}
              </Text>
            </View>
          ) : (
            upcoming.map((appt, idx) => (
              <TouchableOpacity
                key={appt.id}
                style={[styles.apptRow, idx > 0 && styles.apptRowBorder]}
                activeOpacity={0.85}
                onPress={() =>
                  navigation.navigate("ProviderAppointmentDetail", {
                    appointmentId: appt.id,
                  })
                }
              >
                <View
                  style={[
                    styles.apptAccent,
                    { backgroundColor: statusAccent(appt.status) },
                  ]}
                />
                <View style={styles.apptBody}>
                  <Text style={styles.apptService} numberOfLines={1}>
                    {appt.givenService.serviceName}
                  </Text>
                  <Text style={styles.apptMeta}>{formatApptWhen(appt)}</Text>
                  <Text style={styles.apptClient} numberOfLines={1}>
                    {appt.client.firstName} {appt.client.lastName}
                  </Text>
                </View>
                <View style={styles.apptStatusPill}>
                  <Text style={styles.apptStatusText}>
                    {statusLabel(appt.status, t)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.muted} />
              </TouchableOpacity>
            ))
          )}
        </Section>

        <TouchableOpacity
          style={styles.homeLink}
          activeOpacity={0.85}
          onPress={() => navigation.navigate("ProviderHome")}
        >
          <Ionicons name="home-outline" size={18} color={C.amberDark} />
          <Text style={styles.homeLinkText}>
            {t("provider.dashboard.backToHome")}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 28 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

function trendColor(trend: "up" | "down" | "same"): string {
  if (trend === "up") return C.success;
  if (trend === "down") return C.error;
  return C.sub;
}

function trendHintFromApi(
  trend: "up" | "down" | "same",
  pct: number | null | undefined,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  if (trend === "same") return t("provider.dashboard.trend.same");
  if (pct == null) return "";
  if (trend === "up") {
    return t("provider.dashboard.trend.up", { pct });
  }
  return t("provider.dashboard.trend.down", { pct: Math.abs(pct) });
}

function Section({
  title,
  dotColor,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  dotColor: string;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderLeft}>
          <View style={[styles.sectionDot, { backgroundColor: dotColor }]} />
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        {actionLabel && onAction ? (
          <TouchableOpacity onPress={onAction} style={styles.sectionAction}>
            <Text style={styles.sectionActionText}>{actionLabel}</Text>
            <Ionicons name="chevron-forward" size={14} color={C.amber} />
          </TouchableOpacity>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function KpiCard({
  icon,
  iconColor,
  label,
  value,
  hint,
  hintColor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  label: string;
  value: string;
  hint: string;
  hintColor?: string;
}) {
  return (
    <View style={styles.kpiCard}>
      <View style={[styles.kpiIcon, { backgroundColor: `${iconColor}18` }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={[styles.kpiHint, hintColor ? { color: hintColor } : null]}>
        {hint}
      </Text>
    </View>
  );
}

function WeekChart({
  bars,
  max,
}: {
  bars: { date: string; label: string; count: number }[];
  max: number;
}) {
  return (
    <View style={styles.chartWrap}>
      <View style={styles.chartBars}>
        {bars.map((b) => {
          const h = b.count === 0 ? 4 : Math.max(12, (b.count / max) * 72);
          return (
            <View key={b.date} style={styles.chartCol}>
              <Text style={styles.chartCount}>{b.count > 0 ? b.count : ""}</Text>
              <View style={[styles.chartBar, { height: h }]} />
              <Text style={styles.chartLabel}>{b.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function PerfMetric({
  label,
  value,
  pct,
  color,
  light = false,
}: {
  label: string;
  value: string;
  pct: number;
  color: string;
  light?: boolean;
}) {
  return (
    <View style={styles.perfCol}>
      <Text style={[styles.perfValue, light && styles.perfValueLight]}>
        {value}
      </Text>
      <View style={[styles.perfTrack, light && styles.perfTrackLight]}>
        <View
          style={[styles.perfFill, { width: `${pct}%`, backgroundColor: color }]}
        />
      </View>
      <Text style={[styles.perfLabel, light && styles.perfLabelLight]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  headerSide: {
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBtn: { padding: 4 },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.bg,
    gap: 12,
  },
  loadingText: { fontSize: 14, color: C.sub, fontWeight: "600" },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  errorText: { flex: 1, fontSize: 13, color: "#B91C1C", fontWeight: "600" },
  hero: {
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.amberBorder,
    overflow: "hidden",
  },
  heroTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  heroTextCol: { flex: 1 },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: C.amberDark,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  heroName: {
    fontSize: 22,
    fontWeight: "900",
    color: C.text,
    letterSpacing: -0.4,
  },
  companyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    alignSelf: "flex-start",
    backgroundColor: C.accentLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.accentBorder,
    maxWidth: "100%",
  },
  companyPillText: { fontSize: 12, fontWeight: "700", color: C.accent },
  avatarRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.amberLight,
    borderWidth: 2,
    borderColor: C.amberBorder,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: { width: "100%", height: "100%" },
  avatarInitials: { fontSize: 18, fontWeight: "900", color: C.amberDark },
  heroStatsRow: {
    flexDirection: "row",
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(234,88,12,0.18)",
  },
  heroStat: { flex: 1, alignItems: "center", gap: 2 },
  heroStatValue: { fontSize: 18, fontWeight: "900", color: C.text },
  heroStatLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: C.sub,
    textAlign: "center",
  },
  heroDivider: { width: 1, backgroundColor: C.border, marginVertical: 2 },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 8,
  },
  kpiCard: {
    width: "48%",
    flexGrow: 1,
    minWidth: "46%",
    backgroundColor: C.surface,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  kpiIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: "900",
    color: C.text,
    letterSpacing: -0.5,
  },
  kpiLabel: { fontSize: 12, fontWeight: "700", color: C.sub, marginTop: 2 },
  kpiHint: { fontSize: 11, color: C.muted, marginTop: 4, fontWeight: "600" },
  section: { marginBottom: 18 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: C.text,
    letterSpacing: -0.3,
  },
  sectionAction: { flexDirection: "row", alignItems: "center", gap: 2 },
  sectionActionText: { fontSize: 12, fontWeight: "800", color: C.amber },
  card: {
    backgroundColor: C.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  chartWrap: { paddingVertical: 4 },
  chartBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 100,
  },
  chartCol: { flex: 1, alignItems: "center" },
  chartCount: {
    fontSize: 10,
    fontWeight: "800",
    color: C.sub,
    height: 14,
    marginBottom: 4,
  },
  chartBar: {
    width: 14,
    borderRadius: 6,
    backgroundColor: C.amber,
    minHeight: 4,
  },
  chartLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: C.muted,
    marginTop: 6,
  },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
  },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipLabel: { fontSize: 11, fontWeight: "700", color: C.sub },
  chipCount: { fontSize: 11, fontWeight: "900", color: C.text },
  performanceCard: {
    borderRadius: 18,
    padding: 16,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 6,
  },
  perfRow: { flexDirection: "row", gap: 10 },
  perfCol: { flex: 1 },
  perfValue: { fontSize: 16, fontWeight: "900", color: C.text },
  perfValueLight: { color: "#FFFFFF" },
  perfTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: "#F3F4F6",
    marginVertical: 6,
    overflow: "hidden",
  },
  perfTrackLight: { backgroundColor: "rgba(255,255,255,0.22)" },
  perfFill: { height: "100%", borderRadius: 3 },
  perfLabel: { fontSize: 10, fontWeight: "700", color: C.muted },
  perfLabelLight: { color: "rgba(255,255,255,0.78)" },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    flexWrap: "wrap",
    gap: 8,
  },
  performanceBadgePill: {
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  performanceBadgeText: { fontSize: 12, fontWeight: "800", color: "#FFFFFF" },
  performanceComplaintsHint: {
    fontSize: 11,
    color: "rgba(255,255,255,0.82)",
    fontWeight: "600",
  },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  actionTile: {
    width: "30%",
    flexGrow: 1,
    minWidth: "28%",
    alignItems: "center",
    backgroundColor: C.surface,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: C.border,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  actionBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: C.error,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
    borderWidth: 2,
    borderColor: C.surface,
  },
  actionBadgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  actionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: C.text,
    textAlign: "center",
  },
  emptyCard: {
    backgroundColor: C.surface,
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
    gap: 8,
  },
  emptyTitle: { fontSize: 15, fontWeight: "800", color: C.text },
  emptySub: {
    fontSize: 13,
    color: C.sub,
    textAlign: "center",
    lineHeight: 20,
  },
  apptRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.border,
    gap: 10,
  },
  apptRowBorder: {},
  apptAccent: { width: 4, alignSelf: "stretch", borderRadius: 2 },
  apptBody: { flex: 1, minWidth: 0 },
  apptService: { fontSize: 14, fontWeight: "800", color: C.text },
  apptMeta: { fontSize: 12, color: C.sub, marginTop: 2, fontWeight: "600" },
  apptClient: { fontSize: 11, color: C.muted, marginTop: 2 },
  apptStatusPill: {
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    maxWidth: 88,
  },
  apptStatusText: {
    fontSize: 9,
    fontWeight: "800",
    color: C.sub,
    textTransform: "uppercase",
  },
  homeLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    backgroundColor: C.amberLight,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.amberBorder,
  },
  homeLinkText: { fontSize: 14, fontWeight: "800", color: C.amberDark },
});
