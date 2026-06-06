import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { ProviderStackParamList } from "../../../navigation/types";
import { useAuth } from "../../../context/AuthContext";
import {
  isAppointmentVisibleToEmployeeProvider,
  isEmployeeProvider,
} from "../../../utils/providerEmployment";
import { useNotificationsRealtime } from "../../../context/NotificationsRealtimeContext";
import {
  api,
  mapProviderCalendarAppointmentRow,
  type AppointmentStatus,
  type ProviderCalendarAppointment,
} from "../../../services/api";

// ─── Pure logic (all unchanged) ───────────────────────────────────────────

const JOB_EXCLUDED_FROM_DAY_COUNT: AppointmentStatus[] = [
  "CANCELLED_CLIENT",
  "CANCELLED_PROVIDER",
  "REFUSED",
];

function countScheduledJobsOnDate(
  rows: ProviderCalendarAppointment[],
  dateKey: string,
  hidePendingForEmployee = false,
): number {
  return rows.filter(
    (a) =>
      a.scheduledDate === dateKey &&
      !JOB_EXCLUDED_FROM_DAY_COUNT.includes(a.status) &&
      (!hidePendingForEmployee ||
        isAppointmentVisibleToEmployeeProvider(a.status)),
  ).length;
}

function countCompletedJobsOnDate(
  rows: ProviderCalendarAppointment[],
  dateKey: string,
): number {
  return rows.filter(
    (a) => a.scheduledDate === dateKey && a.status === "COMPLETED",
  ).length;
}

function formatJobsVsYesterday(
  today: number,
  yesterday: number,
): { line: string; trend: "up" | "down" | "same" } {
  if (yesterday === 0 && today === 0)
    return { line: "Same as yesterday", trend: "same" };
  if (yesterday === 0) return { line: "↗ +100% vs yesterday", trend: "up" };
  const rawPct = ((today - yesterday) / yesterday) * 100;
  const rounded = Math.round(rawPct * 10) / 10;
  if (Math.abs(rounded) < 0.05)
    return { line: "Same as yesterday", trend: "same" };
  const arrow = rawPct >= 0 ? "↗" : "↘";
  const sign = rawPct >= 0 ? "+" : "";
  return {
    line: `${arrow} ${sign}${rounded}% vs yesterday`,
    trend: rawPct > 0 ? "up" : "down",
  };
}

type HomeActiveJobsScreenProps = {
  activeJob: ProviderCalendarAppointment | null;
  activeJobLoading: boolean;
  timerTick: number;
  onCallClient: (appointmentId: string) => void;
  onPressChat?: () => void;
  onOpenAppointmentDetail: (appointmentId: string) => void;
  onPressViewAllScheduled?: () => void;
  nextScheduledAppointment: ProviderCalendarAppointment | null;
  todayYmd: string;
  todayJobsCount: number;
  jobsVsYesterdayLabel: string;
  jobsVsYesterdayTrend: "up" | "down" | "same";
  completedTodayCount: number;
  restJobsCount: number;
  performanceLoading: boolean;
  performanceRating: string;
  performanceAcceptPct: number;
  performanceCompletePct: number;
  performanceBadgeLabel: string;
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function toYyyyMmDd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

function combineLocalDateTime(dateYmd: string, timeHm: string): Date {
  const [y, mo, d] = dateYmd.split("-").map(Number);
  const parts = timeHm.split(":");
  const hh = Number(parts[0]) || 0;
  const mm = Number(parts[1]) || 0;
  return new Date(y, (mo || 1) - 1, d || 1, hh, mm, 0, 0);
}

function slotDurationMinutes(duration: number | null): number {
  return duration && duration > 0 ? duration : 60;
}

function slotStartDate(a: ProviderCalendarAppointment): Date {
  return combineLocalDateTime(a.scheduledDate, a.scheduledTime);
}

function slotEndDate(a: ProviderCalendarAppointment): Date {
  const start = slotStartDate(a);
  return new Date(
    start.getTime() + slotDurationMinutes(a.durationMinutes) * 60 * 1000,
  );
}

/** Scheduled visit window has fully ended (local time). */
function isAppointmentSlotPassed(
  a: ProviderCalendarAppointment,
  now: Date,
): boolean {
  return now.getTime() >= slotEndDate(a).getTime();
}

const ACTIVE_JOB_STATUSES: AppointmentStatus[] = [
  "IN_PROGRESS",
  "EN_ROUTE",
  "CONFIRMED",
];

/** Live or upcoming confirmed visit — never a slot that already ended. */
function isActiveJobCandidate(
  a: ProviderCalendarAppointment,
  now: Date,
): boolean {
  if (!ACTIVE_JOB_STATUSES.includes(a.status)) return false;
  if (a.status === "IN_PROGRESS") return true;
  if (isAppointmentSlotPassed(a, now)) return false;
  return true;
}

function parseIsoDate(d: string | null): Date | null {
  if (!d) return null;
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? null : x;
}

function sortBySchedule(
  a: ProviderCalendarAppointment,
  b: ProviderCalendarAppointment,
): number {
  return (
    combineLocalDateTime(a.scheduledDate, a.scheduledTime).getTime() -
    combineLocalDateTime(b.scheduledDate, b.scheduledTime).getTime()
  );
}

function pickHighlightAppointment(
  rows: ProviderCalendarAppointment[],
  now: Date,
): ProviderCalendarAppointment | null {
  const sorted = [...rows]
    .filter((a) => isActiveJobCandidate(a, now))
    .sort(sortBySchedule);
  if (!sorted.length) return null;

  const inProgress = sorted.filter((a) => a.status === "IN_PROGRESS");
  if (inProgress.length) return inProgress[0];

  const enRoute = sorted.filter((a) => a.status === "EN_ROUTE");
  if (enRoute.length) return enRoute[0];

  const confirmed = sorted.filter((a) => a.status === "CONFIRMED");
  const windows = confirmed.map((a) => ({
    a,
    start: slotStartDate(a),
    end: slotEndDate(a),
  }));
  const inside = windows.find(({ start, end }) => now >= start && now < end);
  if (inside) return inside.a;
  const upcoming = windows.find(({ start }) => start.getTime() > now.getTime());
  if (upcoming) return upcoming.a;
  return null;
}

/** Next visit after the current job — confirmed bookings only, still in the future. */
const NEXT_SCHEDULE_STATUSES: AppointmentStatus[] = ["CONFIRMED", "RESCHEDULED"];

function pickNextScheduledAfterActive(
  rows: ProviderCalendarAppointment[],
  active: ProviderCalendarAppointment | null,
  now: Date,
): ProviderCalendarAppointment | null {
  const nowMs = now.getTime();
  const minStartMs = active
    ? Math.max(nowMs, slotEndDate(active).getTime())
    : nowMs;

  const sorted = [...rows]
    .filter((a) => {
      if (active && a.id === active.id) return false;
      if (!NEXT_SCHEDULE_STATUSES.includes(a.status)) return false;
      if (isAppointmentSlotPassed(a, now)) return false;
      return slotStartDate(a).getTime() >= minStartMs;
    })
    .sort(sortBySchedule);

  return sorted[0] ?? null;
}

function formatClockSeconds(totalSeconds: number): string {
  const sec = Math.max(0, totalSeconds);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Negative prefix for delay display, e.g. `-05:32` = 5m 32s late. */
function formatDelayClock(lateSeconds: number): string {
  const sec = Math.max(0, lateSeconds);
  return `-${formatClockSeconds(sec)}`;
}

function isServiceNotStarted(a: ProviderCalendarAppointment): boolean {
  if (a.status === "IN_PROGRESS") return false;
  if (parseIsoDate(a.startedAt)) return false;
  return true;
}

function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatRating(value: unknown): string {
  const rating = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(rating) || rating <= 0) return "0.0";
  return rating.toFixed(1);
}

function performanceBadgeFromScore(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Great";
  if (score >= 60) return "Good";
  return "Needs attention";
}

type ActiveJobTimerVariant = "startsIn" | "delay" | "elapsed" | "remaining";

type ActiveJobTimer = {
  main: string;
  label: string;
  progressPct: number;
  footerStatus: string;
  variant: ActiveJobTimerVariant;
};

function buildStartsInTimer(
  start: Date,
  now: Date,
  footerStatus: string,
): ActiveJobTimer {
  const remain = Math.max(
    0,
    Math.floor((start.getTime() - now.getTime()) / 1000),
  );
  return {
    main: formatClockSeconds(remain),
    label: "STARTS IN",
    progressPct: Math.min(95, Math.max(8, 100 - remain / 60)),
    footerStatus,
    variant: "startsIn",
  };
}

function buildDelayTimer(
  start: Date,
  now: Date,
  footerStatus: string,
): ActiveJobTimer {
  const lateSec = Math.max(
    0,
    Math.floor((now.getTime() - start.getTime()) / 1000),
  );
  return {
    main: formatDelayClock(lateSec),
    label: "DELAY",
    progressPct: 100,
    footerStatus,
    variant: "delay",
  };
}

function buildActiveJobTimer(
  a: ProviderCalendarAppointment,
  now: Date,
): ActiveJobTimer {
  const start = slotStartDate(a);
  const durMs = slotDurationMinutes(a.durationMinutes) * 60 * 1000;
  const end = new Date(start.getTime() + durMs);

  if (a.status === "IN_PROGRESS") {
    const started = parseIsoDate(a.startedAt) ?? start;
    const elapsedSec = Math.max(
      0,
      Math.floor((now.getTime() - started.getTime()) / 1000),
    );
    const totalSec = Math.max(60, Math.floor(durMs / 1000));
    return {
      main: formatClockSeconds(elapsedSec),
      label: "TIME ELAPSED",
      progressPct: Math.min(100, (elapsedSec / totalSec) * 100),
      footerStatus: "In progress",
      variant: "elapsed",
    };
  }

  const footer =
    a.status === "EN_ROUTE" ? "En route — start service" : "Confirmed — start now";

  if (now.getTime() < start.getTime()) {
    return buildStartsInTimer(start, now, footer);
  }

  if (isServiceNotStarted(a)) {
    return buildDelayTimer(start, now, footer);
  }

  if (now < end) {
    const remain = Math.max(
      0,
      Math.floor((end.getTime() - now.getTime()) / 1000),
    );
    return {
      main: formatClockSeconds(remain),
      label: "TIME REMAINING",
      progressPct: Math.min(
        100,
        ((now.getTime() - start.getTime()) / durMs) * 100,
      ),
      footerStatus: footer,
      variant: "remaining",
    };
  }

  return {
    main: "—",
    label: "",
    progressPct: 0,
    footerStatus: footer,
    variant: "remaining",
  };
}

function formatClientLocationLine(a: ProviderCalendarAppointment): string {
  const { city, address } = a.client;
  const line = [address?.trim(), city?.trim()].filter(Boolean).join(", ");
  return line || "Location not provided";
}

function formatJobDateLabel(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  if (!y || !m || !d) return yyyyMmDd;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatServiceDetailSub(a: ProviderCalendarAppointment): string {
  const bits: string[] = [];
  if (a.durationMinutes && a.durationMinutes > 0)
    bits.push(`~${a.durationMinutes} min`);
  const note = a.notes?.trim();
  if (note) bits.push(note.length > 90 ? `${note.slice(0, 90)}…` : note);
  if (bits.length === 0) bits.push(a.givenService.categoryName);
  return bits.join(" · ");
}

function shortAppointmentRef(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

function extractClientPhoneFromAppointment(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const client = r.client;
  if (!client || typeof client !== "object") return null;
  const user = (client as Record<string, unknown>).user;
  if (!user || typeof user !== "object") return null;
  const p = (user as Record<string, unknown>).phoneNumber;
  return typeof p === "string" && p.trim() ? p.trim() : null;
}

// ─── Design tokens ─────────────────────────────────────────────────────────
const C = {
  accent: "#EA580C",
  accentDark: "#C2410C",
  accentLight: "#FFF7ED",
  accentBorder: "#FFEDD5",
  /** Legacy aliases used across this screen */
  amber: "#EA580C",
  amberDark: "#C2410C",
  amberLight: "#FFF7ED",
  amberBorder: "#FFEDD5",
  bg: "#F1F5F9",
  surface: "#FFFFFF",
  dark: "#1A1A2E",
  text: "#1A1A2E",
  sub: "#6B7280",
  muted: "#9CA3AF",
  border: "#E5E7EB",
  borderLight: "#F3F4F6",
  success: "#10B981",
  error: "#EF4444",
  blue: "#0284C7",
  purple: "#EA580C",
};

const TIPS_CAROUSEL_GAP = 14;
const TIPS_HORIZONTAL_PAD = 20;

type ProviderTipItem = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  sub: string;
  gradient: [string, string];
  iconColor: string;
  accent: string;
};

const PROVIDER_TIPS: ProviderTipItem[] = [
  {
    icon: "camera-outline",
    title: "Take Photos",
    sub: "Capture before & after shots on every job to prevent disputes.",
    gradient: ["#EFF6FF", "#FFFFFF"],
    iconColor: C.blue,
    accent: "#3B82F6",
  },
  {
    icon: "shield-checkmark-outline",
    title: "Safety First",
    sub: "Wear safety gear and your ID badge so clients feel confident.",
    gradient: ["#FFF7ED", "#FFFFFF"],
    iconColor: C.accent,
    accent: C.accent,
  },
  {
    icon: "time-outline",
    title: "Arrive On Time",
    sub: "Punctuality boosts ratings and helps you win repeat bookings.",
    gradient: ["#FFF7ED", "#FFFFFF"],
    iconColor: C.amber,
    accent: C.amber,
  },
  {
    icon: "chatbox-ellipses-outline",
    title: "Communicate Clearly",
    sub: "Message the client if you're delayed or need extra materials.",
    gradient: ["#ECFDF5", "#FFFFFF"],
    iconColor: C.success,
    accent: "#059669",
  },
  {
    icon: "checkmark-done-outline",
    title: "Confirm Completion",
    sub: "End the job only after the client confirms the work is done.",
    gradient: ["#E0F2FE", "#FFFFFF"],
    iconColor: "#0284C7",
    accent: "#0284C7",
  },
  {
    icon: "star-outline",
    title: "Ask For Feedback",
    sub: "A polite review request improves trust and profile visibility.",
    gradient: ["#FEF3C7", "#FFFFFF"],
    iconColor: "#EA580C",
    accent: "#EA580C",
  },
];

function ProviderTipsCarousel() {
  const { width: windowWidth } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);

  const cardWidth = Math.round(windowWidth - TIPS_HORIZONTAL_PAD * 2 - 36);
  const snapInterval = cardWidth + TIPS_CAROUSEL_GAP;

  return (
    <View style={tipsCarouselStyles.wrap}>
      <FlatList
        data={PROVIDER_TIPS}
        keyExtractor={(item) => item.title}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={snapInterval}
        snapToAlignment="start"
        disableIntervalMomentum
        contentContainerStyle={tipsCarouselStyles.listContent}
        ItemSeparatorComponent={() => (
          <View style={{ width: TIPS_CAROUSEL_GAP }} />
        )}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(
            e.nativeEvent.contentOffset.x / snapInterval,
          );
          setActiveIndex(
            Math.min(PROVIDER_TIPS.length - 1, Math.max(0, idx)),
          );
        }}
        renderItem={({ item, index }) => (
          <View style={[tipsCarouselStyles.cardShell, { width: cardWidth }]}>
            <LinearGradient
              colors={item.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={tipsCarouselStyles.cardGradient}
            >
              <View
                style={[
                  tipsCarouselStyles.cardAccent,
                  { backgroundColor: item.accent },
                ]}
              />
              <View style={tipsCarouselStyles.cardTopRow}>
                <View
                  style={[
                    tipsCarouselStyles.iconOrb,
                    {
                      backgroundColor: `${item.accent}18`,
                      borderColor: `${item.accent}33`,
                    },
                  ]}
                >
                  <Ionicons name={item.icon} size={22} color={item.iconColor} />
                </View>
                <Text style={tipsCarouselStyles.indexLabel}>
                  {String(index + 1).padStart(2, "0")} /{" "}
                  {String(PROVIDER_TIPS.length).padStart(2, "0")}
                </Text>
              </View>
              <Text style={tipsCarouselStyles.cardTitle}>{item.title}</Text>
              <Text style={tipsCarouselStyles.cardSub}>{item.sub}</Text>
            </LinearGradient>
          </View>
        )}
      />

      <View style={tipsCarouselStyles.dotsRow}>
        {PROVIDER_TIPS.map((tip, i) => (
          <View
            key={tip.title}
            style={[
              tipsCarouselStyles.dot,
              i === activeIndex && [
                tipsCarouselStyles.dotActive,
                { backgroundColor: tip.accent },
              ],
            ]}
          />
        ))}
      </View>

      <Text style={tipsCarouselStyles.swipeHint}>Swipe for more tips</Text>
    </View>
  );
}

const tipsCarouselStyles = StyleSheet.create({
  wrap: {
    marginHorizontal: -TIPS_HORIZONTAL_PAD,
  },
  listContent: {
    paddingHorizontal: TIPS_HORIZONTAL_PAD,
    paddingVertical: 6,
  },
  cardShell: {
    borderRadius: 22,
    shadowColor: "#1A1608",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  cardGradient: {
    borderRadius: 22,
    padding: 18,
    minHeight: 168,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.9)",
    overflow: "hidden",
  },
  cardAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  iconOrb: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  indexLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: C.muted,
    letterSpacing: 0.5,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: C.text,
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  cardSub: {
    fontSize: 13,
    fontWeight: "600",
    color: C.sub,
    lineHeight: 20,
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 14,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#D6D3D1",
  },
  dotActive: {
    width: 20,
    borderRadius: 999,
  },
  swipeHint: {
    marginTop: 8,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "700",
    color: C.muted,
    letterSpacing: 0.3,
  },
});

// ─── Presentation component ─────────────────────────────────────────────────
function HomeActiveJobsScreen(props: HomeActiveJobsScreenProps) {
  const activeJobTimer = useMemo(() => {
    if (!props.activeJob) return null;
    return buildActiveJobTimer(props.activeJob, new Date());
  }, [props.activeJob, props.timerTick]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Active Job ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderLeft}>
              <View style={styles.sectionDot} />
              <Text style={styles.sectionTitle}>Active Job</Text>
            </View>
            {props.activeJob && !props.activeJobLoading ? (
              <View style={styles.jobIdPill}>
                <Text style={styles.jobIdText}>
                  #{shortAppointmentRef(props.activeJob.id)}
                </Text>
              </View>
            ) : null}
          </View>

          {props.activeJobLoading ? (
            <View style={[styles.card, styles.activeJobLoadingCard]}>
              <ActivityIndicator color={C.amber} size="small" />
              <Text style={styles.activeJobLoadingText}>Loading booking…</Text>
            </View>
          ) : props.activeJob && activeJobTimer ? (
            <View style={styles.card}>
              {/* Progress bar */}
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    activeJobTimer.variant === "startsIn" &&
                      styles.progressFillStartsIn,
                    activeJobTimer.variant === "delay" &&
                      styles.progressFillDelay,
                    activeJobTimer.variant === "elapsed" &&
                      styles.progressFillElapsed,
                    { width: `${Math.max(4, activeJobTimer.progressPct)}%` },
                  ]}
                />
              </View>

              <View style={styles.cardBody}>
                {/* Client + timer row */}
                <View style={styles.jobTopRow}>
                  <View style={styles.customerRow}>
                    <View style={styles.customerAvatarWrap}>
                      {props.activeJob.client.imageUrl ? (
                        <Image
                          source={{ uri: props.activeJob.client.imageUrl }}
                          style={styles.customerAvatar}
                        />
                      ) : (
                        <View
                          style={[
                            styles.customerAvatar,
                            styles.customerAvatarFallback,
                          ]}
                        >
                          <Text style={styles.customerAvatarFallbackText}>
                            {initialsFromName(
                              `${props.activeJob.client.firstName} ${props.activeJob.client.lastName}`,
                            )}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.customerTextCol}>
                      <Text style={styles.customerName} numberOfLines={1}>
                        {`${props.activeJob.client.firstName} ${props.activeJob.client.lastName}`.trim() ||
                          "Client"}
                      </Text>
                      <Text style={styles.customerSub} numberOfLines={1}>
                        {props.activeJob.givenService.categoryName} ·{" "}
                        {props.activeJob.scheduledTime}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.timerBlock}>
                    <Text
                      style={[
                        styles.timerText,
                        activeJobTimer.variant === "startsIn" &&
                          styles.timerTextStartsIn,
                        activeJobTimer.variant === "delay" &&
                          styles.timerTextDelay,
                      ]}
                    >
                      {activeJobTimer.main}
                    </Text>
                    {activeJobTimer.label ? (
                      <Text
                        style={[
                          styles.timerLabel,
                          activeJobTimer.variant === "startsIn" &&
                            styles.timerLabelStartsIn,
                          activeJobTimer.variant === "delay" &&
                            styles.timerLabelDelay,
                        ]}
                      >
                        {activeJobTimer.label}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {/* Details box */}
                <View style={styles.detailsBox}>
                  <View style={styles.detailRow}>
                    <View style={styles.detailIconCircle}>
                      <Ionicons
                        name="construct-outline"
                        size={15}
                        color={C.amber}
                      />
                    </View>
                    <View style={styles.detailTextBlock}>
                      <Text style={styles.detailLabel}>SERVICE TYPE</Text>
                      <Text style={styles.detailTitle} numberOfLines={1}>
                        {props.activeJob.givenService.serviceName}
                      </Text>
                      <Text style={styles.detailSub} numberOfLines={2}>
                        {formatServiceDetailSub(props.activeJob)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.detailsDivider} />
                  <View style={styles.detailRow}>
                    <View style={styles.detailIconCircle}>
                      <Ionicons
                        name="location-outline"
                        size={15}
                        color={C.amber}
                      />
                    </View>
                    <View style={styles.detailTextBlock}>
                      <Text style={styles.detailLabel}>LOCATION</Text>
                      <Text style={styles.detailTitle} numberOfLines={2}>
                        {formatClientLocationLine(props.activeJob)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Action buttons */}
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    onPress={() => props.onCallClient(props.activeJob!.id)}
                    activeOpacity={0.85}
                    style={styles.actionSmall}
                  >
                    <Ionicons name="call-outline" size={18} color={C.sub} />
                    <Text style={styles.actionLabel}>Call</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={props.onPressChat}
                    activeOpacity={0.85}
                    style={styles.actionSmall}
                  >
                    <Ionicons
                      name="chatbubble-outline"
                      size={18}
                      color={C.sub}
                    />
                    <Text style={styles.actionLabel}>Chat</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() =>
                      props.onOpenAppointmentDetail(props.activeJob!.id)
                    }
                    activeOpacity={0.88}
                    style={styles.actionPrimary}
                  >
                    <Ionicons
                      name="navigate-outline"
                      size={16}
                      color="#FFFFFF"
                    />
                    <Text style={styles.actionPrimaryText}>Navigate</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Card footer */}
              <View style={styles.cardFooter}>
                <View style={styles.footerStatusRow}>
                  <View
                    style={[
                      styles.footerStatusDot,
                      { backgroundColor: C.amber },
                    ]}
                  />
                  <Text style={styles.footerStatusText}>
                    Status:{" "}
                    <Text style={styles.footerStatusAccent}>
                      {activeJobTimer.footerStatus}
                    </Text>
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() =>
                    props.onOpenAppointmentDetail(props.activeJob!.id)
                  }
                  activeOpacity={0.85}
                >
                  <Text style={styles.updateStatusText}>View details →</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={[styles.card, styles.activeJobEmptyCard]}>
              <View style={styles.activeJobEmptyIcon}>
                <Ionicons name="calendar-outline" size={22} color={C.muted} />
              </View>
              <View style={styles.activeJobEmptyText}>
                <Text style={styles.activeJobEmptyTitle}>
                  No active booking
                </Text>
                <Text style={styles.activeJobEmptySub}>
                  When you are en route, in progress, or within a confirmed visit
                  window, it appears here. Past bookings are not shown.
                </Text>
              </View>
              <TouchableOpacity
                onPress={props.onPressViewAllScheduled}
                activeOpacity={0.85}
                style={styles.activeJobEmptyBtn}
              >
                <Text style={styles.activeJobEmptyBtnText}>Open schedule</Text>
                <Ionicons name="arrow-forward" size={13} color={C.amber} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Stats row ── */}
        <View style={[styles.section, styles.sectionTight]}>
          <View style={styles.row2}>
            {/* Today card */}
            <View style={styles.statCard}>
              <View style={styles.statHeaderRow}>
                <View
                  style={[
                    styles.statIconCircle,
                    { backgroundColor: C.amberLight },
                  ]}
                >
                  <Ionicons name="calendar-outline" size={15} color={C.amber} />
                </View>
                <Text style={styles.statKicker}>TODAY</Text>
              </View>
              <Text style={styles.statValue}>
                {props.todayJobsCount}{" "}
                <Text style={styles.statValueUnit}>
                  {props.todayJobsCount === 1 ? "Job" : "Jobs"}
                </Text>
              </Text>
              <Text
                style={[
                  styles.statDelta,
                  props.jobsVsYesterdayTrend === "down" && styles.statDeltaDown,
                  props.jobsVsYesterdayTrend === "same" &&
                    styles.statDeltaNeutral,
                ]}
              >
                {props.jobsVsYesterdayLabel}
              </Text>
            </View>

            <View style={styles.statCardGap} />

            {/* Completed card */}
            <View style={styles.statCard}>
              <View style={styles.statHeaderRow}>
                <View
                  style={[
                    styles.statIconCircle,
                    { backgroundColor: "#D1FAE5" },
                  ]}
                >
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={15}
                    color={C.success}
                  />
                </View>
                <Text style={styles.statKicker}>DONE</Text>
              </View>
              <Text style={styles.statValue}>
                {props.completedTodayCount}{" "}
                <Text style={styles.statValueUnit}>
                  {props.completedTodayCount === 1 ? "Job" : "Jobs"}
                </Text>
              </Text>
              <Text style={styles.statHint}>
                Remaining: {props.restJobsCount}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Next Scheduled ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderLeft}>
              <View style={[styles.sectionDot, { backgroundColor: C.accent }]} />
              <Text style={styles.sectionTitle}>Next Scheduled</Text>
            </View>
            <TouchableOpacity
              onPress={props.onPressViewAllScheduled}
              activeOpacity={0.85}
              style={styles.viewAllBtn}
            >
              <Text style={styles.linkText}>View All</Text>
              <Ionicons name="chevron-forward" size={13} color={C.amber} />
            </TouchableOpacity>
          </View>

          {props.nextScheduledAppointment ? (
            <TouchableOpacity
              onPress={() =>
                props.onOpenAppointmentDetail(
                  props.nextScheduledAppointment!.id,
                )
              }
              activeOpacity={0.88}
              style={styles.scheduledCard}
            >
              <View style={styles.scheduledTimeCol}>
                <Text style={styles.scheduledDay}>
                  {props.nextScheduledAppointment.scheduledDate ===
                  props.todayYmd
                    ? "TODAY"
                    : formatJobDateLabel(
                        props.nextScheduledAppointment.scheduledDate,
                      ).toUpperCase()}
                </Text>
                <Text style={styles.scheduledTime}>
                  {props.nextScheduledAppointment.scheduledTime}
                </Text>
              </View>

              <View style={styles.scheduledContent}>
                <Text style={styles.scheduledTitle} numberOfLines={1}>
                  {props.nextScheduledAppointment.givenService.serviceName}
                </Text>
                <Text style={styles.scheduledSub} numberOfLines={1}>
                  {`${props.nextScheduledAppointment.client.firstName} ${props.nextScheduledAppointment.client.lastName}`.trim() ||
                    "Client"}{" "}
                  · {formatClientLocationLine(props.nextScheduledAppointment)}
                </Text>
              </View>

              <View style={styles.scheduledArrow}>
                <Ionicons name="chevron-forward" size={16} color={C.muted} />
              </View>
            </TouchableOpacity>
          ) : (
            <View style={[styles.scheduledCard, styles.scheduledCardEmpty]}>
              <Text style={styles.scheduledEmptyText}>
                No upcoming confirmed visits after your current job. Open the
                schedule to see later bookings.
              </Text>
            </View>
          )}
        </View>

        {/* ── Performance ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderLeft}>
              <View
                style={[styles.sectionDot, { backgroundColor: C.accent }]}
              />
              <Text style={styles.sectionTitle}>Performance</Text>
            </View>
          </View>
          <LinearGradient
            colors={[C.accent, C.accentDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.performanceCard}
          >
            <View style={styles.performanceHeaderRow}>
              <View>
                <Text style={styles.performanceTitle}>Weekly Summary</Text>
                <Text style={styles.performanceSub}>
                  Your key metrics this week
                </Text>
              </View>
              <View style={styles.performanceBadge}>
                <Ionicons
                  name="trending-up-outline"
                  size={13}
                  color="#FFFFFF"
                />
                <Text style={styles.performanceBadgeText}>
                  {props.performanceBadgeLabel}
                </Text>
              </View>
            </View>

            {props.performanceLoading ? (
              <View style={styles.performanceLoading}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.performanceLoadingText}>
                  Loading performance…
                </Text>
              </View>
            ) : (
              <View style={styles.performanceGrid}>
                {[
                  {
                    value: props.performanceRating,
                    label: "RATING",
                    pct: clampPct((Number(props.performanceRating) / 5) * 100),
                    color: "#FFFFFF",
                  },
                  {
                    value: `${props.performanceAcceptPct}%`,
                    label: "ACCEPT",
                    pct: props.performanceAcceptPct,
                    color: C.accentLight,
                  },
                  {
                    value: `${props.performanceCompletePct}%`,
                    label: "COMPLETE",
                    pct: props.performanceCompletePct,
                    color: "#FFEDD5",
                  },
                ].map((m) => (
                  <View key={m.label} style={styles.performanceMetric}>
                    <Text style={styles.metricValue}>{m.value}</Text>
                    <View style={styles.metricTrack}>
                      <View
                        style={[
                          styles.metricFill,
                          { width: `${m.pct}%`, backgroundColor: m.color },
                        ]}
                      />
                    </View>
                    <Text style={styles.metricLabel}>{m.label}</Text>
                  </View>
                ))}
              </View>
            )}
          </LinearGradient>
        </View>

        {/* ── Provider Tips ── */}
        <View style={[styles.section, styles.sectionTips]}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderLeft}>
              <View
                style={[styles.sectionDot, { backgroundColor: C.purple }]}
              />
              <Text style={styles.sectionTitle}>Provider Tips</Text>
            </View>
          </View>
          <ProviderTipsCarousel />
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Container (logic owner) ───────────────────────────────────────────────
export const ProviderHomeScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<ProviderStackParamList>>();
  const { user } = useAuth();
  const isEmployee = isEmployeeProvider(user);
  const { unreadCount, refreshUnreadCount, addNewNotificationListener } =
    useNotificationsRealtime();
  const avatarUri = user?.provider?.photoUrl?.trim();
  const [activeJob, setActiveJob] =
    useState<ProviderCalendarAppointment | null>(null);
  const [activeJobLoading, setActiveJobLoading] = useState(true);
  const [timerTick, setTimerTick] = useState(0);
  const calendarRowsRef = useRef<ProviderCalendarAppointment[]>([]);
  const [calendarRows, setCalendarRows] = useState<
    ProviderCalendarAppointment[]
  >([]);
  const [calendarStats, setCalendarStats] = useState({
    todayJobs: 0,
    yesterdayJobs: 0,
    completedToday: 0,
  });
  const [performanceLoading, setPerformanceLoading] = useState(true);
  const [performanceStats, setPerformanceStats] = useState({
    rating: "0.0",
    acceptPct: 0,
    completePct: 0,
  });

  useEffect(() => {
    const id = setInterval(() => {
      setTimerTick((n) => n + 1);
      const rows = calendarRowsRef.current;
      if (!rows.length) return;
      setActiveJob((prev) => {
        const next = pickHighlightAppointment(rows, new Date());
        return prev?.id === next?.id ? prev : next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshUnreadCount();
    }, [refreshUnreadCount]),
  );

  // Deep-link new employee invitations to the invitations screen.
  useEffect(() => {
    const unsubscribe = addNewNotificationListener((notification) => {
      if (notification.type === "EMPLOYEE_INVITATION_RECEIVED") {
        navigation.navigate("ProviderInvitations");
      }
    });
    return unsubscribe;
  }, [addNewNotificationListener, navigation]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.navHeaderActions}>
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={() => navigation.navigate("Notifications")}
            activeOpacity={0.85}
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications-outline" size={20} color="#1A1A2E" />
            {unreadCount > 0 ? (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText} numberOfLines={1}>
                  {unreadCount > 99 ? "99+" : String(unreadCount)}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={() => navigation.navigate("ProviderSettings")}
            activeOpacity={0.8}
            accessibilityLabel="Provider settings"
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            ) : (
              <Text style={styles.avatarInitialText}>
                {(user?.firstName?.[0] ?? "?").toUpperCase()}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, unreadCount, avatarUri, user?.firstName]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        setActiveJobLoading(true);
        setPerformanceLoading(true);
        try {
          const from = toYyyyMmDd(addDays(new Date(), -1));
          const to = toYyyyMmDd(addDays(new Date(), 14));
          const [calendarRes, profileRes, appointmentsRes] = await Promise.all([
            api.getProviderCalendar(from, to),
            api.getProviderProfile(),
            api.getMyAppointmentsAsProvider(),
          ]);
          const rows = Array.isArray(calendarRes.data) ? calendarRes.data : [];
          const mapped = rows
            .map((row) => mapProviderCalendarAppointmentRow(row))
            .filter((x): x is ProviderCalendarAppointment => x !== null)
            .filter(
              (a) =>
                !isEmployee ||
                isAppointmentVisibleToEmployeeProvider(a.status),
            );
          const profile = profileRes.data as {
            provider?: { averageRating?: number | string | null };
          };
          const allAppointments = Array.isArray(appointmentsRes.data)
            ? appointmentsRes.data
            : [];
          const now = new Date();
          const weekStart = addDays(now, -6);
          weekStart.setHours(0, 0, 0, 0);
          const weeklyStatuses = allAppointments
            .filter((raw) => {
              if (!raw || typeof raw !== "object") return false;
              const r = raw as Record<string, unknown>;
              const d = new Date(
                typeof r.scheduledDate === "string"
                  ? r.scheduledDate
                  : typeof r.createdAt === "string"
                    ? r.createdAt
                    : "",
              );
              if (Number.isNaN(d.getTime())) return false;
              return d >= weekStart && d <= now;
            })
            .map((raw) => {
              if (!raw || typeof raw !== "object") return null;
              const st = (raw as Record<string, unknown>).status;
              return typeof st === "string" ? (st as AppointmentStatus) : null;
            })
            .filter((s): s is AppointmentStatus => s !== null);
          const acceptedStatuses = new Set<AppointmentStatus>([
            "CONFIRMED",
            "RESCHEDULED",
            "EN_ROUTE",
            "IN_PROGRESS",
            "COMPLETED",
          ]);
          const decisionStatuses = new Set<AppointmentStatus>([
            ...acceptedStatuses,
            "REFUSED",
            "CANCELLED_PROVIDER",
          ]);
          const decided = weeklyStatuses.filter((s) => decisionStatuses.has(s)).length;
          const accepted = weeklyStatuses.filter((s) => acceptedStatuses.has(s)).length;
          const completed = weeklyStatuses.filter((s) => s === "COMPLETED").length;
          const acceptPct = decided > 0 ? clampPct((accepted / decided) * 100) : 0;
          const completePct = accepted > 0 ? clampPct((completed / accepted) * 100) : 0;
          const rating = formatRating(profile?.provider?.averageRating);
          if (!cancelled) {
            calendarRowsRef.current = mapped;
            setCalendarRows(mapped);
            const todayKey = toYyyyMmDd(new Date());
            const yesterdayKey = toYyyyMmDd(addDays(new Date(), -1));
            setCalendarStats({
              todayJobs: countScheduledJobsOnDate(
                mapped,
                todayKey,
                isEmployee,
              ),
              yesterdayJobs: countScheduledJobsOnDate(
                mapped,
                yesterdayKey,
                isEmployee,
              ),
              completedToday: countCompletedJobsOnDate(mapped, todayKey),
            });
            setPerformanceStats({ rating, acceptPct, completePct });
            setActiveJob(pickHighlightAppointment(mapped, new Date()));
          }
        } catch {
          if (!cancelled) {
            calendarRowsRef.current = [];
            setCalendarRows([]);
            setActiveJob(null);
            setCalendarStats({
              todayJobs: 0,
              yesterdayJobs: 0,
              completedToday: 0,
            });
            setPerformanceStats({
              rating: "0.0",
              acceptPct: 0,
              completePct: 0,
            });
          }
        } finally {
          if (!cancelled) {
            setActiveJobLoading(false);
            setPerformanceLoading(false);
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [isEmployee]),
  );

  const onCallClient = useCallback(async (appointmentId: string) => {
    try {
      const res = await api.getAppointmentById(appointmentId);
      const phone = extractClientPhoneFromAppointment(res.data);
      if (phone) {
        await Linking.openURL(`tel:${phone.replace(/\s/g, "")}`);
      } else {
        Alert.alert(
          "Call unavailable",
          "No phone number on file for this client.",
        );
      }
    } catch {
      Alert.alert("Error", "Could not load contact details.");
    }
  }, []);

  const onOpenAppointmentDetail = useCallback(
    (appointmentId: string) =>
      navigation.navigate("ProviderAppointmentDetail", { appointmentId }),
    [navigation],
  );

  const jobsVsYesterday = useMemo(
    () =>
      formatJobsVsYesterday(
        calendarStats.todayJobs,
        calendarStats.yesterdayJobs,
      ),
    [calendarStats.todayJobs, calendarStats.yesterdayJobs],
  );

  const restJobsCount = useMemo(
    () => Math.max(0, calendarStats.todayJobs - calendarStats.completedToday),
    [calendarStats.todayJobs, calendarStats.completedToday],
  );

  const nextScheduledAppointment = useMemo(() => {
    void timerTick;
    return pickNextScheduledAfterActive(calendarRows, activeJob, new Date());
  }, [calendarRows, activeJob, timerTick]);

  const todayYmd = useMemo(() => toYyyyMmDd(new Date()), [timerTick]);
  const performanceBadgeLabel = useMemo(() => {
    const score =
      (Number(performanceStats.rating) / 5) * 40 +
      performanceStats.acceptPct * 0.3 +
      performanceStats.completePct * 0.3;
    return performanceBadgeFromScore(score);
  }, [
    performanceStats.acceptPct,
    performanceStats.completePct,
    performanceStats.rating,
  ]);

  return (
    <HomeActiveJobsScreen
      activeJob={activeJob}
      activeJobLoading={activeJobLoading}
      timerTick={timerTick}
      onCallClient={onCallClient}
      onPressChat={() => navigation.navigate("ConversationList")}
      onOpenAppointmentDetail={onOpenAppointmentDetail}
      onPressViewAllScheduled={() => navigation.navigate("ProviderCalendar")}
      nextScheduledAppointment={nextScheduledAppointment}
      todayYmd={todayYmd}
      todayJobsCount={calendarStats.todayJobs}
      jobsVsYesterdayLabel={jobsVsYesterday.line}
      jobsVsYesterdayTrend={jobsVsYesterday.trend}
      completedTodayCount={calendarStats.completedToday}
      restJobsCount={restJobsCount}
      performanceLoading={performanceLoading}
      performanceRating={performanceStats.rating}
      performanceAcceptPct={performanceStats.acceptPct}
      performanceCompletePct={performanceStats.completePct}
      performanceBadgeLabel={performanceBadgeLabel}
    />
  );
};

// ─── Styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.bg },

  navHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 4,
    gap: 8,
  },
  notificationButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  avatarContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.amberLight,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: C.amberBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: { width: "100%", height: "100%" },
  avatarInitialText: {
    fontSize: 14,
    fontWeight: "800",
    color: C.amberDark,
  },
  notificationBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: C.error,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  notificationBadgeText: { color: "#FFFFFF", fontSize: 9, fontWeight: "800" },

  /* Scroll */
  scroll: { flex: 1, backgroundColor: C.bg },
  scrollContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 },

  /* Section */
  section: { marginBottom: 20 },
  sectionTight: { marginBottom: 12 },
  sectionTips: { marginBottom: 0 },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.amber,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: C.text,
    letterSpacing: -0.3,
  },
  viewAllBtn: { flexDirection: "row", alignItems: "center", gap: 3 },
  linkText: { fontSize: 12, fontWeight: "800", color: C.amber },
  jobIdPill: {
    backgroundColor: C.amberLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.amberBorder,
  },
  jobIdText: {
    color: C.amberDark,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  /* Card */
  card: {
    backgroundColor: C.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
    shadowColor: C.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 3,
  },
  progressTrack: { height: 5, backgroundColor: C.borderLight },
  progressFill: {
    height: 5,
    backgroundColor: C.amber,
    borderTopRightRadius: 999,
    borderBottomRightRadius: 999,
  },
  progressFillStartsIn: { backgroundColor: "#EA580C" },
  progressFillDelay: { backgroundColor: C.error },
  progressFillElapsed: { backgroundColor: C.amber },

  activeJobLoadingCard: {
    flexDirection: "row",
    paddingVertical: 28,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  activeJobLoadingText: { fontSize: 13, fontWeight: "600", color: C.sub },

  activeJobEmptyCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  activeJobEmptyIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: C.borderLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.border,
    flexShrink: 0,
  },
  activeJobEmptyText: { flex: 1 },
  activeJobEmptyTitle: { fontSize: 14, fontWeight: "700", color: C.text },
  activeJobEmptySub: {
    fontSize: 12,
    fontWeight: "500",
    color: C.sub,
    marginTop: 2,
    lineHeight: 17,
  },
  activeJobEmptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: C.amberLight,
    borderWidth: 1,
    borderColor: C.amberBorder,
    flexShrink: 0,
  },
  activeJobEmptyBtnText: { fontSize: 12, fontWeight: "800", color: C.amber },

  cardBody: { padding: 16 },
  jobTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  customerRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  customerAvatarWrap: {
    width: 46,
    height: 46,
    borderRadius: 15,
    overflow: "hidden",
    backgroundColor: C.borderLight,
    flexShrink: 0,
  },
  customerAvatar: { width: "100%", height: "100%" },
  customerAvatarFallback: {
    backgroundColor: C.amberLight,
    alignItems: "center",
    justifyContent: "center",
  },
  customerAvatarFallbackText: {
    fontSize: 15,
    fontWeight: "800",
    color: C.amberDark,
  },
  customerTextCol: { flex: 1, minWidth: 0 },
  customerName: {
    fontSize: 16,
    fontWeight: "800",
    color: C.text,
    letterSpacing: -0.2,
  },
  customerSub: { marginTop: 3, fontSize: 12, fontWeight: "500", color: C.sub },

  timerBlock: { flexShrink: 0, marginLeft: 10, alignItems: "flex-end" },
  timerText: {
    fontSize: 30,
    fontWeight: "900",
    color: C.amber,
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
  },
  timerTextStartsIn: { color: "#EA580C" },
  timerTextDelay: { color: C.error },
  timerLabel: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: "800",
    color: C.muted,
    letterSpacing: 1,
  },
  timerLabelStartsIn: { color: "#EA580C" },
  timerLabelDelay: { color: C.error },

  detailsBox: {
    backgroundColor: C.borderLight,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 14,
  },
  detailRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  detailIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: C.amberLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.amberBorder,
    flexShrink: 0,
  },
  detailTextBlock: { flex: 1 },
  detailLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: C.muted,
    letterSpacing: 0.8,
  },
  detailTitle: { marginTop: 2, fontSize: 13, fontWeight: "800", color: C.text },
  detailSub: { marginTop: 2, fontSize: 12, fontWeight: "500", color: C.sub },
  detailsDivider: { height: 1, backgroundColor: C.border, marginVertical: 10 },

  actionsRow: { flexDirection: "row", alignItems: "stretch", gap: 10 },
  actionSmall: {
    flex: 1,
    height: 52,
    borderRadius: 15,
    backgroundColor: C.borderLight,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  actionLabel: { fontSize: 10, fontWeight: "700", color: C.sub },
  actionPrimary: {
    flex: 2,
    height: 52,
    borderRadius: 15,
    backgroundColor: C.amber,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
    shadowColor: C.amber,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  actionPrimaryText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },

  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.borderLight,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  footerStatusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  footerStatusDot: { width: 7, height: 7, borderRadius: 4 },
  footerStatusText: { fontSize: 12, fontWeight: "600", color: C.sub },
  footerStatusAccent: { color: C.amber, fontWeight: "800" },
  updateStatusText: { fontSize: 12, fontWeight: "800", color: C.amber },

  /* Stats */
  row2: { flexDirection: "row", alignItems: "stretch" },
  statCardGap: { width: 12 },
  statCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    shadowColor: C.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  statHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  statIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  statKicker: {
    fontSize: 10,
    fontWeight: "800",
    color: C.muted,
    letterSpacing: 0.8,
  },
  statValue: {
    fontSize: 26,
    fontWeight: "900",
    color: C.text,
    letterSpacing: -1,
  },
  statValueUnit: {
    fontSize: 14,
    fontWeight: "700",
    color: C.sub,
    letterSpacing: 0,
  },
  statDelta: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "700",
    color: C.success,
  },
  statDeltaDown: { color: C.error },
  statDeltaNeutral: { color: C.muted },
  statHint: { marginTop: 4, fontSize: 11, fontWeight: "600", color: C.muted },

  /* Next scheduled */
  scheduledCard: {
    backgroundColor: C.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: C.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  scheduledTimeCol: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRightWidth: 1,
    borderRightColor: C.border,
    marginRight: 14,
    minWidth: 60,
  },
  scheduledDay: {
    fontSize: 10,
    fontWeight: "800",
    color: C.amber,
    letterSpacing: 0.5,
  },
  scheduledTime: {
    marginTop: 2,
    fontSize: 20,
    fontWeight: "900",
    color: C.text,
    fontVariant: ["tabular-nums"],
  },
  scheduledContent: { flex: 1, minWidth: 0, gap: 4 },
  scheduledTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: C.text,
    letterSpacing: -0.1,
  },
  scheduledSub: { fontSize: 12, fontWeight: "500", color: C.sub },
  scheduledArrow: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: C.borderLight,
    alignItems: "center",
    justifyContent: "center",
  },
  scheduledCardEmpty: {
    flexDirection: "column",
    justifyContent: "center",
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  scheduledEmptyText: {
    fontSize: 13,
    fontWeight: "500",
    color: C.sub,
    textAlign: "center",
    lineHeight: 18,
  },

  /* Performance */
  performanceCard: {
    borderRadius: 22,
    padding: 18,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 6,
  },
  performanceHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 18,
  },
  performanceTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  performanceSub: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  performanceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  performanceBadgeText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
  performanceLoading: {
    minHeight: 90,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  performanceLoadingText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: "600",
  },
  performanceGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  performanceMetric: { flex: 1, alignItems: "center", gap: 6 },
  metricValue: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  metricTrack: {
    width: "100%",
    height: 4,
    backgroundColor: "rgba(255,255,255,0.22)",
    borderRadius: 999,
    overflow: "hidden",
  },
  metricFill: { height: 4, borderRadius: 999 },
  metricLabel: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
    textAlign: "center",
  },

});
