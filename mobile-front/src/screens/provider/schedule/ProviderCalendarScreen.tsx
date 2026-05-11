import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { COLORS } from "../../../constants";
import { useProviderSidebarOpen } from "../../../navigation/ProviderSidebarContext";
import type { ProviderStackParamList } from "../../../navigation/types";
import { useAppTranslation } from "../../../hooks/useAppTranslation";
import {
  api,
  type AppointmentStatus,
  type ProviderCalendarAppointment,
} from "../../../services/api";
import i18n from "../../../i18n";

type Props = NativeStackScreenProps<ProviderStackParamList, "ProviderCalendar">;

type TranslationRow = { locale: string; name: string };

const WEEKDAY_SHORT = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
] as const;

function toYyyyMmDd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfIsoWeekMonday(ref: Date): Date {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

function endOfIsoWeekSunday(weekStartMonday: Date): Date {
  return addDays(weekStartMonday, 6);
}

function normalizeScheduledDateKey(v: unknown): string {
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) {
    return v.slice(0, 10);
  }
  if (v instanceof Date) {
    return toYyyyMmDd(v);
  }
  return "";
}

function pickName(translations: TranslationRow[] | undefined): string {
  if (!translations?.length) return "";
  const preferAr = i18n.language?.startsWith("ar");
  const loc = preferAr ? "AR" : "EN";
  const row =
    translations.find((t) => t.locale === loc) ??
    translations.find((t) => t.locale === "EN") ??
    translations[0];
  return row?.name ?? "";
}

function mapRawToCalendarAppointment(
  raw: unknown,
): ProviderCalendarAppointment | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = r.id;
  if (typeof id !== "string") return null;

  const scheduledDate = normalizeScheduledDateKey(r.scheduledDate);
  if (!scheduledDate) return null;

  const status = r.status as AppointmentStatus;
  const scheduledTime =
    typeof r.scheduledTime === "string" ? r.scheduledTime : "00:00";
  const durationMinutes =
    typeof r.durationMinutes === "number" ? r.durationMinutes : null;
  const notes =
    typeof r.notes === "string" ? r.notes : ((r.notes as null) ?? null);

  let serviceName = "";
  let categoryName = "";
  const gs = r.givenService;
  if (gs && typeof gs === "object") {
    const g = gs as Record<string, unknown>;
    if (typeof g.serviceName === "string") serviceName = g.serviceName;
    if (typeof g.categoryName === "string") categoryName = g.categoryName;
    const svc = g.service;
    if (svc && typeof svc === "object") {
      const s = svc as Record<string, unknown>;
      const tr = s.translations as TranslationRow[] | undefined;
      const cat = s.category as Record<string, unknown> | undefined;
      if (!serviceName) serviceName = pickName(tr);
      if (cat && typeof cat === "object") {
        const ctr = cat.translations as TranslationRow[] | undefined;
        if (!categoryName) categoryName = pickName(ctr);
      }
    }
  }

  let firstName = "";
  let lastName = "";
  let imageUrl: string | null = null;
  const client = r.client;
  if (client && typeof client === "object") {
    const c = client as Record<string, unknown>;
    if (typeof c.imageUrl === "string") imageUrl = c.imageUrl;
    else if (c.imageUrl === null) imageUrl = null;
    const user = c.user;
    if (user && typeof user === "object") {
      const u = user as Record<string, unknown>;
      if (typeof u.firstName === "string") firstName = u.firstName;
      if (typeof u.lastName === "string") lastName = u.lastName;
    }
  }

  return {
    id,
    status,
    scheduledDate,
    scheduledTime,
    durationMinutes,
    notes,
    givenService: {
      serviceName: serviceName || "Service",
      categoryName: categoryName || "Category",
    },
    client: {
      firstName,
      lastName,
      imageUrl,
    },
  };
}

function statusAccent(status: AppointmentStatus): string {
  switch (status) {
    case "PENDING":
      return "#F59E0B";
    case "CONFIRMED":
      return COLORS.info;
    case "IN_PROGRESS":
      return "#7C3AED";
    case "COMPLETED":
      return COLORS.secondary;
    case "CANCELLED_CLIENT":
    case "CANCELLED_PROVIDER":
    case "REFUSED":
    case "DISPUTED":
      return COLORS.error;
    case "RESCHEDULED":
      return "#EA580C";
    case "EN_ROUTE":
      return "#6366F1";
    default:
      return COLORS.gray[400];
  }
}

function statusBadge(status: AppointmentStatus): {
  bg: string;
  fg: string;
  label: string;
} {
  switch (status) {
    case "PENDING":
      return { bg: "#FEF3C7", fg: "#B45309", label: "Pending" };
    case "CONFIRMED":
      return { bg: "#DBEAFE", fg: "#1D4ED8", label: "Confirmed" };
    case "IN_PROGRESS":
      return { bg: "#EDE9FE", fg: "#6D28D9", label: "In progress" };
    case "COMPLETED":
      return { bg: "#D1FAE5", fg: "#047857", label: "Done" };
    case "CANCELLED_CLIENT":
    case "CANCELLED_PROVIDER":
      return { bg: "#FEE2E2", fg: "#B91C1C", label: "Cancelled" };
    case "REFUSED":
      return { bg: "#FEE2E2", fg: "#991B1B", label: "Refused" };
    case "RESCHEDULED":
      return { bg: "#FFEDD5", fg: "#C2410C", label: "Rescheduled" };
    case "EN_ROUTE":
      return { bg: "#E0E7FF", fg: "#4338CA", label: "En route" };
    default:
      return { bg: COLORS.gray[100], fg: COLORS.gray[600], label: "Status" };
  }
}

function clientInitials(first: string, last: string): string {
  const a = first.trim().charAt(0).toUpperCase();
  const b = last.trim().charAt(0).toUpperCase();
  if (a && b) return `${a}${b}`;
  return (a || b || "?").slice(0, 2);
}

function formatSectionHeading(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  if (!y || !m || !d) return yyyyMmDd;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}

function formatMonthTitle(weekStart: Date): string {
  return weekStart.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

function compareTime(a: string, b: string): number {
  return a.localeCompare(b);
}

export const ProviderCalendarScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const openSidebar = useProviderSidebarOpen();
  const { t } = useAppTranslation();
  const initialMonday = useMemo(() => startOfIsoWeekMonday(new Date()), []);
  const initialSelected = useMemo(() => toYyyyMmDd(new Date()), []);

  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(initialMonday);
  const [selectedDate, setSelectedDate] = useState<string>(initialSelected);
  const [appointments, setAppointments] = useState<
    ProviderCalendarAppointment[]
  >([]);
  const [daysOffKeys, setDaysOffKeys] = useState<Set<string>>(new Set());
  const [daysOffReasonByDate, setDaysOffReasonByDate] = useState<
    Map<string, string>
  >(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const weekStartKey = useMemo(
    () => toYyyyMmDd(currentWeekStart),
    [currentWeekStart],
  );

  const loadWeek = useCallback(
    async (isRefresh = false) => {
      const from = toYyyyMmDd(currentWeekStart);
      const to = toYyyyMmDd(endOfIsoWeekSunday(currentWeekStart));
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const [calendarRes, daysOffRes] = await Promise.all([
          api.getProviderCalendar(from, to),
          api.getMyDaysOff(from, to),
        ]);
        const rows = Array.isArray(calendarRes.data) ? calendarRes.data : [];
        const mapped = rows
          .map((row) => mapRawToCalendarAppointment(row))
          .filter((x): x is ProviderCalendarAppointment => x !== null);
        setAppointments(mapped);

        const dayOffRows = Array.isArray(daysOffRes.data)
          ? daysOffRes.data
          : [];
        const keys = new Set<string>();
        const reasonMap = new Map<string, string>();
        dayOffRows.forEach((row) => {
          if (
            typeof row?.date === "string" &&
            /^\d{4}-\d{2}-\d{2}/.test(row.date)
          ) {
            const key = row.date.slice(0, 10);
            keys.add(key);
            if (typeof row.reason === "string" && row.reason.trim()) {
              reasonMap.set(key, row.reason.trim());
            }
          }
        });
        setDaysOffKeys(keys);
        setDaysOffReasonByDate(reasonMap);
      } catch {
        Alert.alert("Error", "Could not load calendar. Please try again.");
        setAppointments([]);
        setDaysOffKeys(new Set());
        setDaysOffReasonByDate(new Map());
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [currentWeekStart],
  );

  useEffect(() => {
    void loadWeek(false);
  }, [weekStartKey, loadWeek]);

  const onRefresh = useCallback(() => {
    void loadWeek(true);
  }, [loadWeek]);

  const weekDays = useMemo(
    () =>
      WEEKDAY_SHORT.map((abbr, i) => {
        const d = addDays(currentWeekStart, i);
        return { abbr, date: d, key: toYyyyMmDd(d) };
      }),
    [currentWeekStart],
  );

  const daysWithAppointments = useMemo(
    () => new Set(appointments.map((a) => a.scheduledDate)),
    [appointments],
  );

  const filteredAppointments = useMemo(
    () =>
      appointments
        .filter((a) => a.scheduledDate === selectedDate)
        .slice()
        .sort((a, b) => compareTime(a.scheduledTime, b.scheduledTime)),
    [appointments, selectedDate],
  );

  const selectedDayIsOff = useMemo(
    () => daysOffKeys.has(selectedDate),
    [daysOffKeys, selectedDate],
  );
  const selectedDayOffReason = useMemo(
    () => daysOffReasonByDate.get(selectedDate) ?? "",
    [daysOffReasonByDate, selectedDate],
  );

  const todayKey = toYyyyMmDd(new Date());
  const monthTitle = useMemo(
    () => formatMonthTitle(currentWeekStart),
    [currentWeekStart],
  );
  const sectionTitle = useMemo(
    () => formatSectionHeading(selectedDate),
    [selectedDate],
  );

  const onlineCount = useMemo(
    () =>
      filteredAppointments.filter(
        (a) => a.status === "CONFIRMED" || a.status === "IN_PROGRESS",
      ).length,
    [filteredAppointments],
  );
  const doneCount = useMemo(
    () => filteredAppointments.filter((a) => a.status === "COMPLETED").length,
    [filteredAppointments],
  );
  const pendingCount = useMemo(
    () => filteredAppointments.filter((a) => a.status === "PENDING").length,
    [filteredAppointments],
  );

  const goPrevWeek = () => setCurrentWeekStart((prev) => addDays(prev, -7));
  const goNextWeek = () => setCurrentWeekStart((prev) => addDays(prev, 7));

  const goToday = () => {
    const now = new Date();
    const monday = startOfIsoWeekMonday(now);
    setSelectedDate(toYyyyMmDd(now));
    setCurrentWeekStart((prev) =>
      toYyyyMmDd(prev) === toYyyyMmDd(monday) ? prev : monday,
    );
  };

  const renderCard = ({
    item,
    index,
  }: {
    item: ProviderCalendarAppointment;
    index: number;
  }) => {
    const badge = statusBadge(item.status);
    const accent = statusAccent(item.status);
    const name =
      `${item.client.firstName} ${item.client.lastName}`.trim() || "Client";
    const duration = item.durationMinutes ? ` ? ~${item.durationMinutes}m` : "";

    return (
      <TouchableOpacity
        activeOpacity={0.92}
        style={[
          styles.timelineItem,
          item.status === "IN_PROGRESS" && styles.timelineItemActive,
        ]}
        onPress={() =>
          navigation.navigate("ProviderAppointmentDetail", {
            appointmentId: item.id,
          })
        }
      >
        <View style={styles.timeCol}>
          <Text
            style={[
              styles.timeText,
              item.status === "IN_PROGRESS" && styles.timeTextActive,
            ]}
          >
            {item.scheduledTime}
          </Text>
          {index < filteredAppointments.length - 1 ? (
            <View
              style={[
                styles.timeLine,
                item.status === "IN_PROGRESS" && styles.timeLineActive,
              ]}
            />
          ) : null}
        </View>

        <View style={styles.jobCard}>
          <View style={[styles.jobAccent, { backgroundColor: accent }]} />
          {item.client.imageUrl ? (
            <Image
              source={{ uri: item.client.imageUrl }}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarFallbackText}>
                {clientInitials(item.client.firstName, item.client.lastName)}
              </Text>
            </View>
          )}

          <View style={styles.jobBody}>
            <View style={styles.jobTopRow}>
              <Text style={styles.jobTitle} numberOfLines={1}>
                {item.givenService.serviceName}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                <Text style={[styles.statusBadgeText, { color: badge.fg }]}>
                  {badge.label}
                </Text>
              </View>
            </View>
            <Text style={styles.jobSub} numberOfLines={1}>
              {name} ? {item.givenService.categoryName}
            </Text>
            <Text style={styles.jobMeta}>
              {item.scheduledTime}
              {duration}
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={14} color={COLORS.gray[400]} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      <View style={styles.header}>
        <View style={styles.headerLeftZone}>
          <TouchableOpacity
            onPress={openSidebar}
            activeOpacity={0.85}
            style={styles.headerMenuBtn}
            hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t("client.a11y.openMenu")}
          >
            <Ionicons name="menu" size={26} color={COLORS.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Schedule
          </Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={goToday}
            activeOpacity={0.88}
            style={styles.todayBtn}
          >
            <Text style={styles.todayBtnText}>Today</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate("ProviderSchedule")}
            activeOpacity={0.88}
            style={styles.settingsBtn}
            accessibilityRole="button"
            accessibilityLabel="Schedule settings"
          >
            <Ionicons
              name="settings-outline"
              size={16}
              color={COLORS.text.secondary}
            />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={selectedDayIsOff ? [] : filteredAppointments}
        keyExtractor={(item) => item.id}
        renderItem={renderCard}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 24 },
        ]}
        ListHeaderComponent={
          <>
            <View style={styles.calendarCard}>
              <View style={styles.calendarHeader}>
                <Text style={styles.calendarTitle}>{monthTitle}</Text>
                <View style={styles.calendarActions}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={styles.navBtn}
                    onPress={goPrevWeek}
                  >
                    <Ionicons
                      name="chevron-back"
                      size={14}
                      color={COLORS.text.secondary}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={styles.navBtn}
                    onPress={goNextWeek}
                  >
                    <Ionicons
                      name="chevron-forward"
                      size={14}
                      color={COLORS.text.secondary}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.dayRow}
              >
                {weekDays.map((cell) => {
                  const selected = cell.key === selectedDate;
                  const isWeekend = cell.abbr === "Sat" || cell.abbr === "Sun";
                  const hasEvent = daysWithAppointments.has(cell.key);
                  const isDayOff = daysOffKeys.has(cell.key);
                  const isTodayCell = todayKey === cell.key;

                  return (
                    <TouchableOpacity
                      key={cell.key}
                      activeOpacity={0.9}
                      style={styles.dayItem}
                      onPress={() => setSelectedDate(cell.key)}
                    >
                      <Text
                        style={[
                          styles.dayLabel,
                          selected && styles.dayLabelActive,
                          isWeekend && styles.dayLabelWeekend,
                        ]}
                      >
                        {cell.abbr}
                      </Text>
                      <View
                        style={[
                          styles.dayCircle,
                          selected && styles.dayCircleActive,
                          isWeekend && !selected && styles.dayCircleWeekend,
                          isDayOff && styles.dayCircleOff,
                          isTodayCell && !selected && styles.dayCircleToday,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayNumber,
                            (selected || isDayOff) && styles.dayNumberOnDark,
                          ]}
                        >
                          {cell.date.getDate()}
                        </Text>
                        {hasEvent ? (
                          <View
                            style={[
                              styles.dayDot,
                              (selected || isDayOff) && styles.dayDotOnDark,
                            ]}
                          />
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.summaryCard}>
              <View style={styles.summaryGlowRight} />
              <View style={styles.summaryGlowLeft} />
              <View style={styles.summaryRow}>
                <View>
                  <Text style={styles.summaryKicker}>Today's Overview</Text>
                  <Text style={styles.summaryTitle}>
                    {filteredAppointments.length} Jobs
                  </Text>
                  <Text style={styles.summaryMeta}>
                    {doneCount} Completed | {onlineCount} Active |{" "}
                    {pendingCount} Pending
                  </Text>
                </View>
                <View style={styles.summaryRight}>
                  <Text style={styles.summaryKicker}>Selected day</Text>
                  <Text style={styles.summaryEarnings}>{sectionTitle}</Text>
                </View>
              </View>
            </View>

            <View style={styles.timelineHeader}>
              <Text style={styles.timelineTitle}>Timeline</Text>
              <TouchableOpacity
                style={styles.viewCalendarBtn}
                activeOpacity={0.86}
                onPress={goToday}
              >
                <Text style={styles.viewCalendarText}>Today</Text>
              </TouchableOpacity>
            </View>

            {loading && !refreshing ? (
              <View style={styles.loaderWrap}>
                <ActivityIndicator size="large" color={COLORS.primary} />
              </View>
            ) : null}

            {selectedDayIsOff ? (
              <View style={styles.offDayWrap}>
                <Ionicons name="moon" size={46} color={COLORS.error} />
                <Text style={styles.offDayTitle}>This is your day off</Text>
                <Text style={styles.offDayText}>
                  You have blocked this day because of this event
                  {selectedDayOffReason ? `: ${selectedDayOffReason}` : "."}
                </Text>
              </View>
            ) : null}
          </>
        }
        ListEmptyComponent={
          !loading && !selectedDayIsOff ? (
            <View style={styles.emptyWrap}>
              <Ionicons
                name="calendar-outline"
                size={44}
                color={COLORS.gray[300]}
              />
              <Text style={styles.emptyText}>No appointments for this day</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
    flexDirection: "row",
    alignItems: "center",
  },
  headerLeftZone: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    minWidth: 0,
  },
  headerMenuBtn: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  headerTitle: {
    marginLeft: 6,
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text.primary,
    flexShrink: 1,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
  },
  todayBtn: {
    backgroundColor: "rgba(240, 142, 16, 0.08)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(240, 142, 16, 0.18)",
  },
  todayBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.primary,
  },
  settingsBtn: {
    marginLeft: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.gray[50],
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.gray[100],
  },
  content: {
    paddingBottom: 24,
  },
  calendarCard: {
    backgroundColor: COLORS.white,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
  },
  calendarHeader: {
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  calendarTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text.primary,
  },
  calendarActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  navBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.gray[50],
  },
  dayRow: {
    paddingHorizontal: 20,
  },
  dayItem: {
    width: 56,
    alignItems: "center",
    marginRight: 8,
  },
  dayLabel: {
    fontSize: 10,
    fontWeight: "500",
    color: COLORS.text.secondary,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  dayLabelActive: {
    color: COLORS.primary,
    fontWeight: "700",
  },
  dayLabelWeekend: {
    color: COLORS.error,
    fontWeight: "600",
  },
  dayCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  dayCircleActive: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  dayCircleWeekend: {
    backgroundColor: COLORS.gray[50],
    borderWidth: 1,
    borderColor: COLORS.gray[100],
  },
  dayCircleOff: {
    backgroundColor: COLORS.error,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)",
  },
  dayCircleToday: {
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  dayNumber: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text.secondary,
  },
  dayNumberOnDark: {
    color: COLORS.white,
  },
  dayDot: {
    position: "absolute",
    bottom: 6,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
  },
  dayDotOnDark: {
    backgroundColor: COLORS.white,
  },
  summaryCard: {
    backgroundColor: COLORS.gray[900],
    borderRadius: 18,
    padding: 18,
    overflow: "hidden",
    marginHorizontal: 16,
    marginTop: 16,
  },
  summaryGlowRight: {
    position: "absolute",
    top: -20,
    right: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  summaryGlowLeft: {
    position: "absolute",
    bottom: -30,
    left: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(240, 142, 16, 0.2)",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryKicker: {
    fontSize: 11,
    color: COLORS.gray[300],
    fontWeight: "600",
    marginBottom: 6,
  },
  summaryTitle: {
    fontSize: 24,
    color: COLORS.white,
    fontWeight: "700",
  },
  summaryMeta: {
    fontSize: 10,
    color: COLORS.gray[300],
    marginTop: 6,
  },
  summaryRight: {
    alignItems: "flex-end",
    maxWidth: "48%",
  },
  summaryEarnings: {
    fontSize: 14,
    color: "#F5B25F",
    fontWeight: "700",
    textAlign: "right",
  },
  timelineHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    marginTop: 16,
    paddingHorizontal: 16,
  },
  timelineTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text.primary,
  },
  viewCalendarBtn: {
    backgroundColor: "rgba(240, 142, 16, 0.08)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  viewCalendarText: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.primary,
  },
  loaderWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },
  offDayWrap: {
    marginTop: 12,
    marginHorizontal: 16,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.gray[100],
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
    gap: 10,
  },
  offDayTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.text.primary,
    textAlign: "center",
  },
  offDayText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text.secondary,
    textAlign: "center",
    lineHeight: 21,
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 32,
    gap: 10,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text.secondary,
    textAlign: "center",
  },
  timelineItem: {
    flexDirection: "row",
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  timelineItemActive: {
    marginBottom: 16,
  },
  timeCol: {
    width: 52,
    alignItems: "center",
    paddingTop: 4,
  },
  timeText: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.text.secondary,
  },
  timeTextActive: {
    color: COLORS.primary,
  },
  timeLine: {
    width: 1,
    flex: 1,
    backgroundColor: COLORS.gray[200],
    marginTop: 6,
  },
  timeLineActive: {
    backgroundColor: "rgba(240, 142, 16, 0.3)",
  },
  jobCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.gray[100],
    paddingVertical: 12,
    paddingRight: 10,
    paddingLeft: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  jobAccent: {
    width: 4,
    alignSelf: "stretch",
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.gray[200],
  },
  avatarFallback: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: {
    fontSize: 10,
    fontWeight: "800",
    color: COLORS.white,
  },
  jobBody: {
    flex: 1,
    minWidth: 0,
  },
  jobTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 6,
  },
  jobTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.text.primary,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  jobSub: {
    fontSize: 10,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  jobMeta: {
    fontSize: 10,
    color: COLORS.gray[500],
    marginTop: 5,
  },
});
