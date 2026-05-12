import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { ProviderStackParamList } from "../../../navigation/types";
import { useAuth } from "../../../context/AuthContext";
import {
  api,
  mapProviderCalendarAppointmentRow,
  type AppointmentStatus,
  type ProviderCalendarAppointment,
} from "../../../services/api";

const JOB_EXCLUDED_FROM_DAY_COUNT: AppointmentStatus[] = [
  "CANCELLED_CLIENT",
  "CANCELLED_PROVIDER",
  "REFUSED",
];

function countScheduledJobsOnDate(
  rows: ProviderCalendarAppointment[],
  dateKey: string,
): number {
  return rows.filter(
    (a) =>
      a.scheduledDate === dateKey &&
      !JOB_EXCLUDED_FROM_DAY_COUNT.includes(a.status),
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
  if (yesterday === 0 && today === 0) {
    return { line: "Same as yesterday", trend: "same" };
  }
  if (yesterday === 0) {
    return { line: "↗ +100% vs yesterday", trend: "up" };
  }
  const rawPct = ((today - yesterday) / yesterday) * 100;
  const rounded = Math.round(rawPct * 10) / 10;
  if (Math.abs(rounded) < 0.05) {
    return { line: "Same as yesterday", trend: "same" };
  }
  const arrow = rawPct >= 0 ? "↗" : "↘";
  const sign = rawPct >= 0 ? "+" : "";
  return {
    line: `${arrow} ${sign}${rounded}% vs yesterday`,
    trend: rawPct > 0 ? "up" : "down",
  };
}

type HomeActiveJobsScreenProps = {
  displayName: string;
  locationShort: string;
  photoUrl?: string | null;
  avatarInitials: string;
  unreadNotificationCount: number;
  activeJob: ProviderCalendarAppointment | null;
  activeJobLoading: boolean;
  timerTick: number;
  onPressNotifications?: () => void;
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

function slotEndDate(a: ProviderCalendarAppointment): Date {
  const start = combineLocalDateTime(a.scheduledDate, a.scheduledTime);
  return new Date(
    start.getTime() + slotDurationMinutes(a.durationMinutes) * 60 * 1000,
  );
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
  const da = combineLocalDateTime(a.scheduledDate, a.scheduledTime).getTime();
  const db = combineLocalDateTime(b.scheduledDate, b.scheduledTime).getTime();
  return da - db;
}

function pickHighlightAppointment(
  rows: ProviderCalendarAppointment[],
  now: Date,
): ProviderCalendarAppointment | null {
  const sorted = [...rows].sort(sortBySchedule);

  const inProgress = sorted.filter((a) => a.status === "IN_PROGRESS");
  if (inProgress.length) return inProgress[0];

  const enRoute = sorted.filter((a) => a.status === "EN_ROUTE");
  const enRouteOk = enRoute.filter(
    (a) => now.getTime() <= slotEndDate(a).getTime(),
  );
  if (enRouteOk.length) return enRouteOk[0];

  const confirmed = sorted.filter((a) => a.status === "CONFIRMED");
  const windows = confirmed.map((a) => ({
    a,
    start: combineLocalDateTime(a.scheduledDate, a.scheduledTime),
    end: slotEndDate(a),
  }));

  const inside = windows.find(
    ({ start, end }) => now >= start && now < end,
  );
  if (inside) return inside.a;

  const upcoming = windows.find(({ start }) => start.getTime() > now.getTime());
  if (upcoming) return upcoming.a;

  return null;
}

const NEXT_SCHEDULE_EXCLUDED: AppointmentStatus[] = [
  "CANCELLED_CLIENT",
  "CANCELLED_PROVIDER",
  "REFUSED",
  "COMPLETED",
  "DISPUTED",
];

function isNextScheduleCandidate(a: ProviderCalendarAppointment): boolean {
  return !NEXT_SCHEDULE_EXCLUDED.includes(a.status);
}

/** Next booking after the active one (by schedule), or next upcoming after `now` if none active. */
function pickNextScheduledAfterActive(
  rows: ProviderCalendarAppointment[],
  active: ProviderCalendarAppointment | null,
  now: Date,
): ProviderCalendarAppointment | null {
  const candidates = rows.filter(isNextScheduleCandidate);
  if (!candidates.length) return null;
  const sorted = [...candidates].sort(sortBySchedule);

  if (active) {
    const t0 = combineLocalDateTime(
      active.scheduledDate,
      active.scheduledTime,
    ).getTime();
    return (
      sorted.find((a) => {
        if (a.id === active.id) return false;
        const t = combineLocalDateTime(
          a.scheduledDate,
          a.scheduledTime,
        ).getTime();
        return t > t0;
      }) ?? null
    );
  }

  const nowMs = now.getTime();
  return (
    sorted.find(
      (a) =>
        combineLocalDateTime(a.scheduledDate, a.scheduledTime).getTime() >
        nowMs,
    ) ?? null
  );
}

function formatClockSeconds(totalSeconds: number): string {
  const sec = Math.max(0, totalSeconds);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

type ActiveJobTimer = {
  main: string;
  label: string;
  progressPct: number;
  footerStatus: string;
};

function buildActiveJobTimer(
  a: ProviderCalendarAppointment,
  now: Date,
): ActiveJobTimer {
  const start = combineLocalDateTime(a.scheduledDate, a.scheduledTime);
  const durMs = slotDurationMinutes(a.durationMinutes) * 60 * 1000;
  const end = new Date(start.getTime() + durMs);

  if (a.status === "IN_PROGRESS") {
    const started = parseIsoDate(a.startedAt) ?? start;
    const elapsedSec = Math.max(
      0,
      Math.floor((now.getTime() - started.getTime()) / 1000),
    );
    const totalSec = Math.max(60, Math.floor(durMs / 1000));
    const progressPct = Math.min(100, (elapsedSec / totalSec) * 100);
    return {
      main: formatClockSeconds(elapsedSec),
      label: "TIME ELAPSED",
      progressPct,
      footerStatus: "In progress",
    };
  }

  if (a.status === "EN_ROUTE") {
    if (now < start) {
      const remain = Math.max(
        0,
        Math.floor((start.getTime() - now.getTime()) / 1000),
      );
      return {
        main: formatClockSeconds(remain),
        label: "STARTS IN",
        progressPct: 12,
        footerStatus: "En route",
      };
    }
    const remain = Math.max(
      0,
      Math.floor((end.getTime() - now.getTime()) / 1000),
    );
    const progressPct = Math.min(
      100,
      ((now.getTime() - start.getTime()) / durMs) * 100,
    );
    return {
      main: formatClockSeconds(remain),
      label: "TIME REMAINING",
      progressPct,
      footerStatus: "En route",
    };
  }

  if (now < start) {
    const remain = Math.max(
      0,
      Math.floor((start.getTime() - now.getTime()) / 1000),
    );
    return {
      main: formatClockSeconds(remain),
      label: "STARTS IN",
      progressPct: 10,
      footerStatus: "Confirmed",
    };
  }
  if (now >= start && now < end) {
    const remain = Math.max(
      0,
      Math.floor((end.getTime() - now.getTime()) / 1000),
    );
    const progressPct = Math.min(
      100,
      ((now.getTime() - start.getTime()) / durMs) * 100,
    );
    return {
      main: formatClockSeconds(remain),
      label: "TIME REMAINING",
      progressPct,
      footerStatus: "Confirmed",
    };
  }

  return {
    main: "—",
    label: "",
    progressPct: 0,
    footerStatus: "Confirmed",
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
  if (a.durationMinutes && a.durationMinutes > 0) {
    bits.push(`~${a.durationMinutes} min`);
  }
  const note = a.notes?.trim();
  if (note) {
    bits.push(note.length > 90 ? `${note.slice(0, 90)}…` : note);
  }
  if (bits.length === 0) {
    bits.push(a.givenService.categoryName);
  }
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

function HomeActiveJobsScreen(props: HomeActiveJobsScreenProps) {
  const [headerElevated, setHeaderElevated] = useState(false);

  const activeJobTimer = useMemo(() => {
    if (!props.activeJob) return null;
    return buildActiveJobTimer(props.activeJob, new Date());
  }, [props.activeJob, props.timerTick]);

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
              </View>
              <View style={styles.profileTextCol}>
                <Text style={styles.nameText} numberOfLines={1}>
                  {props.displayName}
                </Text>
              </View>
            </View>

            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={props.onPressNotifications}
                activeOpacity={0.85}
                style={styles.iconButton}
              >
                <Ionicons
                  name="notifications-outline"
                  size={22}
                  color={colors.textMain}
                />
                {props.unreadNotificationCount > 0 ? (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationBadgeText} numberOfLines={1}>
                      {props.unreadNotificationCount > 99
                        ? "99+"
                        : String(props.unreadNotificationCount)}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.statusRow}>
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
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.activeJobLoadingText}>Loading booking…</Text>
            </View>
          ) : props.activeJob && activeJobTimer ? (
            <View style={styles.card}>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.max(4, activeJobTimer.progressPct)}%` },
                  ]}
                />
              </View>

              <View style={styles.cardBody}>
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
                      <Text style={styles.customerSub} numberOfLines={2}>
                        {props.activeJob.givenService.categoryName} ·{" "}
                        {formatJobDateLabel(props.activeJob.scheduledDate)} ·{" "}
                        {props.activeJob.scheduledTime}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.timerBlock}>
                    <Text style={styles.timerText}>{activeJobTimer.main}</Text>
                    {activeJobTimer.label ? (
                      <Text style={styles.timerLabel}>{activeJobTimer.label}</Text>
                    ) : null}
                  </View>
                </View>

                <View style={styles.detailsBox}>
                  <View style={styles.detailRow}>
                    <View style={styles.detailIconCircle}>
                      <Text style={styles.detailIconText}>🛠️</Text>
                    </View>
                    <View style={styles.detailTextBlock}>
                      <Text style={styles.detailLabel}>SERVICE TYPE</Text>
                      <Text style={styles.detailTitle} numberOfLines={2}>
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
                      <Text style={styles.detailIconText}>📍</Text>
                    </View>
                    <View style={styles.detailTextBlock}>
                      <Text style={styles.detailLabel}>LOCATION</Text>
                      <Text style={styles.detailTitle} numberOfLines={2}>
                        {formatClientLocationLine(props.activeJob)}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    onPress={() => props.onCallClient(props.activeJob!.id)}
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
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() =>
                      props.onOpenAppointmentDetail(props.activeJob!.id)
                    }
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
                  <Text style={styles.footerStatusAccent}>
                    {activeJobTimer.footerStatus}
                  </Text>
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    props.onOpenAppointmentDetail(props.activeJob!.id)
                  }
                  activeOpacity={0.85}
                >
                  <Text style={styles.updateStatusText}>View details ›</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={[styles.card, styles.activeJobEmptyCard]}>
              <Text style={styles.activeJobEmptyTitle}>No active booking</Text>
              <Text style={styles.activeJobEmptySub}>
                Jobs in progress and your next confirmed visit will show here.
              </Text>
              <TouchableOpacity
                onPress={props.onPressViewAllScheduled}
                activeOpacity={0.85}
                style={styles.activeJobEmptyBtn}
              >
                <Text style={styles.activeJobEmptyBtnText}>Open schedule</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Today vs completed snapshot */}
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
                    📅
                  </Text>
                </View>
                <Text style={styles.statKicker}>TODAY</Text>
              </View>
              <Text style={styles.statValue}>
                {props.todayJobsCount}{" "}
                {props.todayJobsCount === 1 ? "Job" : "Jobs"}
              </Text>
              <Text
                style={[
                  styles.statDelta,
                  props.jobsVsYesterdayTrend === "down" && styles.statDeltaDown,
                  props.jobsVsYesterdayTrend === "same" && styles.statDeltaNeutral,
                ]}
              >
                {props.jobsVsYesterdayLabel}
              </Text>
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
              <Text style={styles.statValue}>
                {props.completedTodayCount}{" "}
                {props.completedTodayCount === 1 ? "Job" : "Jobs"}
              </Text>
              <Text style={styles.statHint}>
                Rest : {props.restJobsCount}
              </Text>
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

          {props.nextScheduledAppointment ? (
            <TouchableOpacity
              onPress={() =>
                props.onOpenAppointmentDetail(props.nextScheduledAppointment!.id)
              }
              activeOpacity={0.85}
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
                <Text style={styles.scheduledArrowText}>›</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={[styles.scheduledCard, styles.scheduledCardEmpty]}>
              <Text style={styles.scheduledEmptyText}>
                No other visits scheduled after this one in the loaded period.
              </Text>
            </View>
          )}
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
  const [unreadCount, setUnreadCount] = useState(0);
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
      let cancelled = false;
      void (async () => {
        try {
          const res = await api.getUnreadCount();
          if (!cancelled) setUnreadCount(res.data?.count ?? 0);
        } catch {
          if (!cancelled) setUnreadCount(0);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        setActiveJobLoading(true);
        try {
          const from = toYyyyMmDd(addDays(new Date(), -1));
          const to = toYyyyMmDd(addDays(new Date(), 14));
          const res = await api.getProviderCalendar(from, to);
          const rows = Array.isArray(res.data) ? res.data : [];
          const mapped = rows
            .map((row) => mapProviderCalendarAppointmentRow(row))
            .filter((x): x is ProviderCalendarAppointment => x !== null);
          if (!cancelled) {
            calendarRowsRef.current = mapped;
            setCalendarRows(mapped);
            const todayKey = toYyyyMmDd(new Date());
            const yesterdayKey = toYyyyMmDd(addDays(new Date(), -1));
            setCalendarStats({
              todayJobs: countScheduledJobsOnDate(mapped, todayKey),
              yesterdayJobs: countScheduledJobsOnDate(mapped, yesterdayKey),
              completedToday: countCompletedJobsOnDate(mapped, todayKey),
            });
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
          }
        } finally {
          if (!cancelled) setActiveJobLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const onCallClient = useCallback(async (appointmentId: string) => {
    try {
      const res = await api.getAppointmentById(appointmentId);
      const phone = extractClientPhoneFromAppointment(res.data);
      if (phone) {
        const dial = phone.replace(/\s/g, "");
        await Linking.openURL(`tel:${dial}`);
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
    (appointmentId: string) => {
      navigation.navigate("ProviderAppointmentDetail", { appointmentId });
    },
    [navigation],
  );

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

  const jobsVsYesterday = useMemo(
    () =>
      formatJobsVsYesterday(
        calendarStats.todayJobs,
        calendarStats.yesterdayJobs,
      ),
    [calendarStats.todayJobs, calendarStats.yesterdayJobs],
  );

  const restJobsCount = useMemo(
    () =>
      Math.max(0, calendarStats.todayJobs - calendarStats.completedToday),
    [calendarStats.todayJobs, calendarStats.completedToday],
  );

  const nextScheduledAppointment = useMemo(
    () =>
      pickNextScheduledAfterActive(calendarRows, activeJob, new Date()),
    [calendarRows, activeJob, timerTick],
  );

  const todayYmd = useMemo(() => toYyyyMmDd(new Date()), [timerTick]);

  return (
    <HomeActiveJobsScreen
      displayName={displayName}
      locationShort={locationShort}
      photoUrl={photoUrl}
      avatarInitials={avatarInitials}
      unreadNotificationCount={unreadCount}
      activeJob={activeJob}
      activeJobLoading={activeJobLoading}
      timerTick={timerTick}
      onPressNotifications={() => navigation.navigate("Notifications")}
      onCallClient={onCallClient}
      onPressChat={() => navigation.navigate("ProviderMessages")}
      onOpenAppointmentDetail={onOpenAppointmentDetail}
      onPressViewAllScheduled={() => navigation.navigate("ProviderCalendar")}
      nextScheduledAppointment={nextScheduledAppointment}
      todayYmd={todayYmd}
      todayJobsCount={calendarStats.todayJobs}
      jobsVsYesterdayLabel={jobsVsYesterday.line}
      jobsVsYesterdayTrend={jobsVsYesterday.trend}
      completedTodayCount={calendarStats.completedToday}
      restJobsCount={restJobsCount}
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
    justifyContent: "center",
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
  nameText: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.textMain,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  notificationBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.error,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.surface,
  },
  notificationBadgeText: {
    color: colors.surface,
    fontSize: 10,
    fontWeight: "800",
  },
  statusRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  locationText: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
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
    backgroundColor: colors.primary,
    borderTopRightRadius: 999,
    borderBottomRightRadius: 999,
  },
  activeJobLoadingCard: {
    paddingVertical: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  activeJobLoadingText: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: "600",
    color: colors.textMuted,
  },
  activeJobEmptyCard: {
    padding: 20,
  },
  activeJobEmptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.textMain,
  },
  activeJobEmptySub: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "600",
    color: colors.textMuted,
    lineHeight: 18,
  },
  activeJobEmptyBtn: {
    marginTop: 14,
    alignSelf: "flex-start",
    backgroundColor: "rgba(240,142,16,0.12)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  activeJobEmptyBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.primary,
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
    flex: 1,
    minWidth: 0,
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
  customerTextCol: {
    flex: 1,
    minWidth: 0,
  },
  customerName: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.textMain,
  },
  customerSub: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
  },
  customerAvatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E5E7EB",
  },
  customerAvatarFallbackText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#4B5563",
  },
  timerBlock: {
    flexShrink: 0,
    marginLeft: 12,
    marginRight: 6,
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
  timerDateLine: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
    textAlign: "right",
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
  statDeltaDown: {
    color: colors.error,
  },
  statDeltaNeutral: {
    color: colors.textMuted,
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
  scheduledCardEmpty: {
    flexDirection: "column",
    justifyContent: "center",
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  scheduledEmptyText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 18,
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
