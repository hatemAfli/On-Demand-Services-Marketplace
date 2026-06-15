import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../../context/AuthContext";
import {
  api,
  type AdminComplaintListItem,
  type AppointmentStats,
  type ComplaintStats,
  type ReviewStats,
} from "../../../services/api";
import { navigateAdminTab } from "../adminNavigation";

// ─── Design tokens (aligned with client / provider orange) ─
const ACCENT = "#EA580C";
const ACCENT_DARK = "#C2410C";
const ACCENT_DIM = "#FFF7ED";
const ACCENT_BORDER = "#FFEDD5";

const T = {
  bg: "#F4F3FA",
  surface: "#FFFFFF",
  dark: "#0F172A",
  text: "#1A1A2E",
  sub: "#64748B",
  muted: "#94A3B8",
  border: "#EBEBF5",
  borderLt: "#F1F5F9",
};

// ─── Logic (all unchanged) ────────────────────────────────
const ACTIVE_APPOINTMENT_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "RESCHEDULED",
  "EN_ROUTE",
  "IN_PROGRESS",
] as const;

const CHART_STATUSES = [
  { key: "PENDING", label: "Pending", color: "#F59E0B" },
  { key: "CONFIRMED", label: "Confirmed", color: "#3B82F6" },
  { key: "IN_PROGRESS", label: "In progress", color: "#7C5CFC" },
  { key: "COMPLETED", label: "Completed", color: "#16A34A" },
  { key: "DISPUTED", label: "Disputed", color: "#EF4444" },
] as const;

type DashboardData = {
  appointmentStats: AppointmentStats;
  complaintStats: ComplaintStats;
  reviewStats: ReviewStats;
  totalUsers: number;
  totalCompanies: number;
  newSupportMessages: number;
  pendingVerificationTotal: number;
  pendingProviderVerifications: number;
  pendingCompanyVerifications: number;
  recentComplaints: AdminComplaintListItem[];
};

type AdminDashboardStackParamList = { Dashboard: undefined };
type Nav = NativeStackNavigationProp<AdminDashboardStackParamList, "Dashboard">;

function formatToday(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatRelativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch {
    return iso;
  }
}

function personName(first: string, last: string): string {
  return `${first ?? ""} ${last ?? ""}`.trim() || "—";
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

async function fetchPendingVerificationCounts(): Promise<{
  total: number;
  providers: number;
  companies: number;
}> {
  const [pendAll, reviewAll, pendProv, reviewProv, pendComp, reviewComp] =
    await Promise.all([
      api.listAdminVerificationRequests({
        status: "PENDING",
        take: 1,
        skip: 0,
      }),
      api.listAdminVerificationRequests({
        status: "UNDER_REVIEW",
        take: 1,
        skip: 0,
      }),
      api.listAdminVerificationRequests({
        status: "PENDING",
        ownerType: "PROVIDER",
        take: 1,
        skip: 0,
      }),
      api.listAdminVerificationRequests({
        status: "UNDER_REVIEW",
        ownerType: "PROVIDER",
        take: 1,
        skip: 0,
      }),
      api.listAdminVerificationRequests({
        status: "PENDING",
        ownerType: "COMPANY",
        take: 1,
        skip: 0,
      }),
      api.listAdminVerificationRequests({
        status: "UNDER_REVIEW",
        ownerType: "COMPANY",
        take: 1,
        skip: 0,
      }),
    ]);
  return {
    total:
      (pendAll.data as { total: number }).total +
      (reviewAll.data as { total: number }).total,
    providers:
      (pendProv.data as { total: number }).total +
      (reviewProv.data as { total: number }).total,
    companies:
      (pendComp.data as { total: number }).total +
      (reviewComp.data as { total: number }).total,
  };
}

// ─── Sub-components ───────────────────────────────────────

function StatCard({
  title,
  value,
  subtitle,
  icon,
  color,
  bg,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
}) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconWrap, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
      {subtitle ? <Text style={styles.statSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function QuickActionCard({
  title,
  subtitle,
  icon,
  color,
  bg,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.quickAction}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <View style={[styles.quickActionIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={19} color={color} />
      </View>
      <Text style={styles.quickActionTitle}>{title}</Text>
      <Text style={styles.quickActionSub}>{subtitle}</Text>
      <View style={styles.quickActionChevron}>
        <Ionicons name="chevron-forward" size={12} color={T.muted} />
      </View>
    </TouchableOpacity>
  );
}

// ─── Main screen ─────────────────────────────────────────
export const AdminDashboardScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const greeting = user?.firstName?.trim()
    ? `Welcome back, ${user.firstName}`
    : "Welcome back";

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const [appointmentStatsRes, complaintStatsRes, reviewStatsRes] =
        await Promise.all([
          api.getAppointmentStats(),
          api.getComplaintStats(),
          api.getReviewStats(),
        ]);
      const [usersRes, companiesRes, supportRes, recentComplaintsRes, pending] =
        await Promise.all([
          api.listAdminUsers({ take: 1, skip: 0 }),
          api.listAdminCompanies({ take: 1, skip: 0 }),
          api.getAdminSupportMessageStats(),
          api.getAllComplaints({ take: 5, sort: "recent" }),
          fetchPendingVerificationCounts(),
        ]);
      setData({
        appointmentStats: appointmentStatsRes.data,
        complaintStats: complaintStatsRes.data,
        reviewStats: reviewStatsRes.data,
        totalUsers: (usersRes.data as { total: number }).total,
        totalCompanies: (companiesRes.data as { total: number }).total,
        newSupportMessages: supportRes.data.newCount,
        pendingVerificationTotal: pending.total,
        pendingProviderVerifications: pending.providers,
        pendingCompanyVerifications: pending.companies,
        recentComplaints: recentComplaintsRes.data.items ?? [],
      });
    } catch {
      setError("Could not load dashboard.");
      if (!opts?.silent) setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const isFirstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      void load({ silent: !isFirstFocus.current });
      isFirstFocus.current = false;
    }, [load]),
  );

  const activeAppointments = useMemo(() => {
    if (!data) return 0;
    return ACTIVE_APPOINTMENT_STATUSES.reduce(
      (sum, status) => sum + (data.appointmentStats.byStatus[status] ?? 0),
      0,
    );
  }, [data]);

  const chartRows = useMemo(() => {
    if (!data) return [];
    return CHART_STATUSES.map(({ key, label, color }) => ({
      key,
      label,
      color,
      count: data.appointmentStats.byStatus[key] ?? 0,
    }));
  }, [data]);

  const maxChartCount = useMemo(
    () => Math.max(...chartRows.map((r) => r.count), 1),
    [chartRows],
  );

  const primaryAlert = useMemo(() => {
    if (!data) return null;
    if (data.pendingVerificationTotal > 0)
      return {
        tone: "warn" as const,
        title: `${data.pendingVerificationTotal} profile${data.pendingVerificationTotal === 1 ? "" : "s"} awaiting validation`,
        message: "Review pending provider and company verification requests.",
        tab: "ValidationsTab" as const,
      };
    if (data.complaintStats.open > 0)
      return {
        tone: "danger" as const,
        title: `${data.complaintStats.open} open complaint${data.complaintStats.open === 1 ? "" : "s"}`,
        message: "Clients are waiting for a response on active complaints.",
        tab: "ComplaintsTab" as const,
      };
    if (data.appointmentStats.disputedActive > 0)
      return {
        tone: "danger" as const,
        title: `${data.appointmentStats.disputedActive} disputed appointment${data.appointmentStats.disputedActive === 1 ? "" : "s"}`,
        message: "Review appointments flagged for platform intervention.",
        tab: "ComplaintsTab" as const,
      };
    if (data.newSupportMessages > 0)
      return {
        tone: "warn" as const,
        title: `${data.newSupportMessages} new support message${data.newSupportMessages === 1 ? "" : "s"}`,
        message: "Unread messages from users need attention.",
        tab: "ProfileTab" as const,
      };
    return null;
  }, [data]);

  /* ── States ── */
  if (loading && !data) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color={ACCENT} />
          <Text style={styles.loadingText}>Loading dashboard…</Text>
        </View>
      </View>
    );
  }

  if (error && !data) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <View style={styles.errorCard}>
          <Ionicons name="cloud-offline-outline" size={32} color={T.muted} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => void load()}>
            <Ionicons name="refresh-outline" size={14} color={ACCENT_DARK} />
            <Text style={styles.retryBtnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!data) return null;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: 36 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load({ silent: true })}
            tintColor={ACCENT}
            colors={[ACCENT]}
          />
        }
      >
        {/* ── Hero header ── */}
        <View style={styles.header}>
          <View style={styles.headerIconWrap}>
            <Ionicons name="speedometer" size={22} color={ACCENT} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{greeting}</Text>
            <Text style={styles.dateLine}>{formatToday()}</Text>
          </View>
        </View>

        {/* ── Alert banner ── */}
        {primaryAlert ? (
          <TouchableOpacity
            style={[
              styles.alertBanner,
              primaryAlert.tone === "danger" && styles.alertBannerDanger,
            ]}
            activeOpacity={0.9}
            onPress={() => navigateAdminTab(navigation, primaryAlert.tab)}
          >
            <View
              style={[
                styles.alertIconWrap,
                primaryAlert.tone === "danger" && styles.alertIconWrapDanger,
              ]}
            >
              <Ionicons
                name="warning-outline"
                size={16}
                color={primaryAlert.tone === "danger" ? "#DC2626" : ACCENT_DARK}
              />
            </View>
            <View style={styles.alertBody}>
              <Text
                style={[
                  styles.alertTitle,
                  primaryAlert.tone === "danger" && styles.alertTitleDanger,
                ]}
              >
                {primaryAlert.title}
              </Text>
              <Text style={styles.alertMessage}>{primaryAlert.message}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={T.muted} />
          </TouchableOpacity>
        ) : null}

        {/* ── Key metrics ── */}
        <View style={styles.sectionRow}>
          <View style={styles.sectionDot} />
          <Text style={styles.sectionTitle}>Key metrics</Text>
        </View>
        <View style={styles.statsGrid}>
          <StatCard
            title="Pending validations"
            value={data.pendingVerificationTotal}
            subtitle={`${data.pendingProviderVerifications} providers · ${data.pendingCompanyVerifications} companies`}
            icon="shield-checkmark-outline"
            color="#6366F1"
            bg="#EEF2FF"
          />
          <StatCard
            title="Open complaints"
            value={data.complaintStats.open}
            subtitle={`${data.complaintStats.underReview} under review`}
            icon="flag-outline"
            color="#EF4444"
            bg="#FEF2F2"
          />
          <StatCard
            title="Active appointments"
            value={activeAppointments}
            subtitle={`${data.appointmentStats.total} total`}
            icon="calendar-outline"
            color="#3B82F6"
            bg="#EFF6FF"
          />
          <StatCard
            title="Completed today"
            value={data.appointmentStats.completedToday}
            subtitle={
              data.appointmentStats.averageDurationMinutes > 0
                ? `Avg. ${data.appointmentStats.averageDurationMinutes} min`
                : undefined
            }
            icon="checkmark-circle-outline"
            color="#16A34A"
            bg="#ECFDF5"
          />
          <StatCard
            title="Platform users"
            value={data.totalUsers}
            subtitle={`${data.totalCompanies} companies`}
            icon="people-outline"
            color="#8B5CF6"
            bg="#F5F3FF"
          />
          <StatCard
            title="Average rating"
            value={data.reviewStats.averageRating.toFixed(1)}
            subtitle={`${data.reviewStats.total} reviews`}
            icon="star-outline"
            color={ACCENT}
            bg={ACCENT_DIM}
          />
          <StatCard
            title="Disputed orders"
            value={data.appointmentStats.disputedActive}
            subtitle="Needs intervention"
            icon="alert-circle-outline"
            color="#DC2626"
            bg="#FEF2F2"
          />
          <StatCard
            title="Support inbox"
            value={data.newSupportMessages}
            subtitle="Unread messages"
            icon="mail-unread-outline"
            color="#0EA5E9"
            bg="#F0F9FF"
          />
        </View>

        {/* ── Quick actions ── */}
        <View style={styles.sectionRow}>
          <View style={styles.sectionDot} />
          <Text style={styles.sectionTitle}>Quick actions</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickActionsRow}
        >
          <QuickActionCard
            title="Validations"
            subtitle={`${data.pendingVerificationTotal} pending`}
            icon="shield-checkmark-outline"
            color="#6366F1"
            bg="#EEF2FF"
            onPress={() => navigateAdminTab(navigation, "ValidationsTab")}
          />
          <QuickActionCard
            title="Complaints"
            subtitle={`${data.complaintStats.open} open`}
            icon="flag-outline"
            color="#EF4444"
            bg="#FEF2F2"
            onPress={() => navigateAdminTab(navigation, "ComplaintsTab")}
          />
          <QuickActionCard
            title="Users"
            subtitle={`${data.totalUsers} registered`}
            icon="people-outline"
            color="#8B5CF6"
            bg="#F5F3FF"
            onPress={() => navigateAdminTab(navigation, "UsersTab")}
          />
        </ScrollView>

        {/* ── Appointments by status ── */}
        <View style={styles.panel}>
          <View style={styles.panelHead}>
            <Text style={styles.panelTitle}>Appointments by status</Text>
            <View style={styles.panelTotalPill}>
              <Text style={styles.panelTotalText}>
                {data.appointmentStats.total} total
              </Text>
            </View>
          </View>
          <View style={styles.chartList}>
            {chartRows.map((row) => (
              <View key={row.key} style={styles.chartRow}>
                <View
                  style={[styles.chartLabelDot, { backgroundColor: row.color }]}
                />
                <Text style={styles.chartLabel}>{row.label}</Text>
                <View style={styles.chartTrack}>
                  <View
                    style={[
                      styles.chartBar,
                      {
                        width: `${Math.max(4, (row.count / maxChartCount) * 100)}%`,
                        backgroundColor: row.color,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.chartCount}>{row.count}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Review quality ── */}
        <View style={styles.panel}>
          <View style={styles.panelHead}>
            <Text style={styles.panelTitle}>Review quality</Text>
            <View style={styles.ratingPill}>
              <Ionicons name="star" size={12} color={ACCENT} />
              <Text style={styles.ratingPillText}>
                {data.reviewStats.averageRating.toFixed(2)}
              </Text>
            </View>
          </View>
          <Text style={styles.panelSub}>
            {data.reviewStats.withReply} with provider reply ·{" "}
            {data.reviewStats.hidden} hidden
          </Text>
          <View style={styles.ratingBars}>
            {([5, 4, 3, 2, 1] as const).map((star) => {
              const count = data.reviewStats.byRating[String(star)] ?? 0;
              const pct =
                data.reviewStats.total > 0
                  ? (count / data.reviewStats.total) * 100
                  : 0;
              return (
                <View key={star} style={styles.ratingRow}>
                  <Text style={styles.ratingStar}>{star}★</Text>
                  <View style={styles.ratingTrack}>
                    <View style={[styles.ratingBar, { width: `${pct}%` }]} />
                  </View>
                  <Text style={styles.ratingCount}>{count}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* ── Recent complaints ── */}
        <View style={styles.panel}>
          <View style={styles.panelHead}>
            <Text style={styles.panelTitle}>Recent complaints</Text>
            <TouchableOpacity
              onPress={() => navigateAdminTab(navigation, "ComplaintsTab")}
              style={styles.panelLinkBtn}
            >
              <Text style={styles.panelLink}>View all</Text>
              <Ionicons name="arrow-forward" size={13} color={ACCENT} />
            </TouchableOpacity>
          </View>

          {data.recentComplaints.length === 0 ? (
            <View style={styles.emptyPanelWrap}>
              <Ionicons
                name="checkmark-circle-outline"
                size={24}
                color={ACCENT}
              />
              <Text style={styles.emptyPanel}>No complaints yet</Text>
            </View>
          ) : (
            data.recentComplaints.map((row, index) => {
              const clientName = personName(
                row.client.user.firstName,
                row.client.user.lastName,
              );
              return (
                <TouchableOpacity
                  key={row.id}
                  style={[
                    styles.recentRow,
                    index < data.recentComplaints.length - 1 &&
                      styles.recentRowBorder,
                  ]}
                  activeOpacity={0.88}
                  onPress={() =>
                    navigateAdminTab(navigation, "ComplaintsTab", {
                      screen: "AdminComplaintDetail",
                      params: { complaintId: row.id },
                    })
                  }
                >
                  <View style={styles.recentAvatar}>
                    <Text style={styles.recentAvatarText}>
                      {clientName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.recentMid}>
                    <Text style={styles.recentName} numberOfLines={1}>
                      {clientName}
                    </Text>
                    <Text style={styles.recentMeta} numberOfLines={1}>
                      {row.appointment.serviceName} ·{" "}
                      {formatRelativeTime(row.createdAt)}
                    </Text>
                  </View>
                  <View style={styles.recentStatusPill}>
                    <Text style={styles.recentStatusText}>
                      {statusLabel(row.status)}
                    </Text>
                  </View>
                  <View style={styles.recentChevron}>
                    <Ionicons
                      name="chevron-forward"
                      size={12}
                      color={T.muted}
                    />
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
};

// ─── Styles ────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },

  /* States */
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: T.bg,
    paddingHorizontal: 24,
  },
  loadingCard: {
    backgroundColor: T.surface,
    borderRadius: 20,
    padding: 36,
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderColor: T.border,
    shadowColor: "#1A1A2E",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 3,
  },
  loadingText: { fontSize: 14, color: T.sub, fontWeight: "600" },
  errorCard: {
    backgroundColor: T.surface,
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: T.border,
  },
  errorText: {
    fontSize: 14,
    color: T.sub,
    fontWeight: "600",
    textAlign: "center",
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: ACCENT_DIM,
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
  },
  retryBtnText: { fontSize: 13, fontWeight: "800", color: ACCENT_DARK },

  /* Scroll */
  scroll: { paddingHorizontal: 16, paddingTop: 14, gap: 16 },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 6,
  },
  headerIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: ACCENT_DIM,
    borderWidth: 1.5,
    borderColor: ACCENT_BORDER,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 3,
  },
  greeting: {
    fontSize: 21,
    fontWeight: "800",
    color: T.text,
    letterSpacing: -0.5,
  },
  dateLine: { fontSize: 12, fontWeight: "500", color: T.muted, marginTop: 2 },

  /* Alert banner */
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: ACCENT_DIM,
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
    borderRadius: 16,
    padding: 14,
  },
  alertBannerDanger: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  alertIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: ACCENT_DIM,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
    flexShrink: 0,
  },
  alertIconWrapDanger: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  alertBody: { flex: 1, gap: 2 },
  alertTitle: { fontSize: 13, fontWeight: "800", color: ACCENT_DARK },
  alertTitleDanger: { color: "#991B1B" },
  alertMessage: {
    fontSize: 12,
    color: T.sub,
    fontWeight: "500",
    lineHeight: 17,
  },

  /* Section header */
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: ACCENT },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: T.sub,
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  /* Stat cards grid */
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: {
    width: "48%",
    flexGrow: 1,
    minWidth: "46%",
    backgroundColor: T.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
    padding: 14,
    gap: 4,
    shadowColor: "#1A1A2E",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    ...Platform.select({ android: { elevation: 1 } }),
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  statValue: {
    fontSize: 26,
    fontWeight: "800",
    color: T.dark,
    letterSpacing: -0.8,
  },
  statTitle: { fontSize: 12, fontWeight: "700", color: T.sub },
  statSubtitle: {
    fontSize: 10,
    fontWeight: "500",
    color: T.muted,
    lineHeight: 14,
  },

  /* Quick actions */
  quickActionsRow: { gap: 10, paddingBottom: 2 },
  quickAction: {
    width: 148,
    backgroundColor: T.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
    padding: 14,
    gap: 4,
    shadowColor: "#1A1A2E",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    ...Platform.select({ android: { elevation: 1 } }),
  },
  quickActionIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  quickActionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: T.dark,
    letterSpacing: -0.2,
  },
  quickActionSub: { fontSize: 11, fontWeight: "500", color: T.muted },
  quickActionChevron: {
    position: "absolute",
    top: 14,
    right: 12,
    width: 22,
    height: 22,
    borderRadius: 8,
    backgroundColor: T.bg,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Panel */
  panel: {
    backgroundColor: T.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: T.border,
    padding: 16,
    gap: 12,
    shadowColor: "#1A1A2E",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    ...Platform.select({ android: { elevation: 1 } }),
  },
  panelHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: T.dark,
    letterSpacing: -0.3,
  },
  panelSub: { fontSize: 12, fontWeight: "500", color: T.muted, marginTop: -4 },
  panelTotalPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: T.bg,
    borderWidth: 1,
    borderColor: T.border,
  },
  panelTotalText: { fontSize: 11, fontWeight: "700", color: T.sub },
  panelLinkBtn: { flexDirection: "row", alignItems: "center", gap: 3 },
  panelLink: { fontSize: 12, fontWeight: "800", color: ACCENT },

  /* Chart */
  chartList: { gap: 10 },
  chartRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  chartLabelDot: { width: 7, height: 7, borderRadius: 4, flexShrink: 0 },
  chartLabel: { width: 76, fontSize: 12, fontWeight: "600", color: T.sub },
  chartTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: T.bg,
    overflow: "hidden",
  },
  chartBar: { height: "100%", borderRadius: 4, minWidth: 4 },
  chartCount: {
    width: 28,
    fontSize: 12,
    fontWeight: "800",
    color: T.dark,
    textAlign: "right",
  },

  /* Rating */
  ratingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: ACCENT_DIM,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
  },
  ratingPillText: { fontSize: 12, fontWeight: "800", color: ACCENT_DARK },
  ratingBars: { gap: 8 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  ratingStar: { width: 26, fontSize: 12, fontWeight: "700", color: T.sub },
  ratingTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: T.bg,
    overflow: "hidden",
  },
  ratingBar: {
    height: "100%",
    backgroundColor: ACCENT,
    borderRadius: 3,
    minWidth: 0,
  },
  ratingCount: {
    width: 24,
    fontSize: 11,
    fontWeight: "700",
    color: T.muted,
    textAlign: "right",
  },

  /* Recent complaints */
  emptyPanelWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  emptyPanel: { fontSize: 13, color: T.muted, fontWeight: "600" },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 11,
  },
  recentRowBorder: { borderBottomWidth: 1, borderBottomColor: T.borderLt },
  recentAvatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: ACCENT_DIM,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
    flexShrink: 0,
  },
  recentAvatarText: { fontSize: 15, fontWeight: "800", color: ACCENT_DARK },
  recentMid: { flex: 1, gap: 2 },
  recentName: { fontSize: 13, fontWeight: "700", color: T.dark },
  recentMeta: { fontSize: 11, fontWeight: "500", color: T.muted },
  recentStatusPill: {
    backgroundColor: T.bg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: T.border,
    flexShrink: 0,
  },
  recentStatusText: {
    fontSize: 9,
    fontWeight: "800",
    color: T.sub,
    textTransform: "capitalize",
    letterSpacing: 0.3,
  },
  recentChevron: {
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: T.bg,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
});
