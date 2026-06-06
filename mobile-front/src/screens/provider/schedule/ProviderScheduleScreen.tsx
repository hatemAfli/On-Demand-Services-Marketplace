import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { COLORS } from "../../../constants";
import { useAuth } from "../../../context/AuthContext";
import type { ProviderStackParamList } from "../../../navigation/types";
import { isEmployeeProvider } from "../../../utils/providerEmployment";
import {
  api,
  type ProviderAvailabilityDay,
  type ProviderAvailabilityDayOfWeek,
} from "../../../services/api";

type Props = NativeStackScreenProps<ProviderStackParamList, "ProviderSchedule">;

const ACCENT = "#EA580C";
const ACCENT_DARK = "#C2410C";
const ACCENT_LIGHT = "#FFF7ED";
const ACCENT_BORDER = "#FFEDD5";
const SCREEN_BG = "#F1F5F9";

type ScheduleDay = {
  dayOfWeek: ProviderAvailabilityDayOfWeek;
  isWorking: boolean;
  startTime: string;
  endTime: string;
};

const DAY_ORDER: ProviderAvailabilityDayOfWeek[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

const DAY_DISPLAY_NAME: Record<ProviderAvailabilityDayOfWeek, string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
  SUNDAY: "Sunday",
};

const DAY_SHORT: Record<ProviderAvailabilityDayOfWeek, string> = {
  MONDAY: "Mon",
  TUESDAY: "Tue",
  WEDNESDAY: "Wed",
  THURSDAY: "Thu",
  FRIDAY: "Fri",
  SATURDAY: "Sat",
  SUNDAY: "Sun",
};

const DEFAULT_SCHEDULE: ScheduleDay[] = DAY_ORDER.map((dayOfWeek) => ({
  dayOfWeek,
  isWorking: dayOfWeek !== "SATURDAY" && dayOfWeek !== "SUNDAY",
  startTime: "08:00",
  endTime: "18:00",
}));

const HOURS = Array.from({ length: 24 }, (_, i) =>
  String(i).padStart(2, "0"),
) as string[];

const MINUTES = ["00", "15", "30", "45"];

/** Wheel shows exactly three rows; center row is the selected value. */
const PICKER_ROW_HEIGHT = 52;
const PICKER_WHEEL_HEIGHT = PICKER_ROW_HEIGHT * 3;

function padHHmm(hour: string, minute: string): string {
  return `${hour}:${minute}`;
}

function parseHHmm(value: string): { hour: string; minute: string } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const hh = String(Number(m[1])).padStart(2, "0");
  const mm = m[2].padStart(2, "0");
  const miNum = Number(mm);
  if (miNum > 59) return null;
  return { hour: hh, minute: mm };
}

function minutesSinceMidnight(hhmm: string): number {
  const p = parseHHmm(hhmm);
  if (!p) return 0;
  return Number(p.hour) * 60 + Number(p.minute);
}

function normalizeScheduleFromApi(
  rows: ProviderAvailabilityDay[],
): ScheduleDay[] {
  const byDay = new Map(rows.map((r) => [r.dayOfWeek, r]));
  return DAY_ORDER.map((dayOfWeek) => {
    const row = byDay.get(dayOfWeek);
    if (!row) {
      const d = DEFAULT_SCHEDULE.find((x) => x.dayOfWeek === dayOfWeek)!;
      return { ...d };
    }
    return {
      dayOfWeek,
      isWorking: row.isWorking,
      startTime: row.startTime,
      endTime: row.endTime,
    };
  });
}

function showSuccessToast(message: string) {
  if (Platform.OS === "android") {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  } else {
    Alert.alert("", message);
  }
}

type PickerTarget = { dayIndex: number; field: "start" | "end" };

function WheelPicker({
  label,
  values,
  selected,
  onSelect,
}: {
  label: string;
  values: string[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const idx = values.indexOf(selected);
    if (idx < 0) return;
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: idx * PICKER_ROW_HEIGHT,
        animated: false,
      });
    }, 60);
    return () => clearTimeout(timer);
  }, [selected, values]);

  const syncFromOffset = (y: number) => {
    const idx = Math.round(y / PICKER_ROW_HEIGHT);
    const clamped = Math.max(0, Math.min(values.length - 1, idx));
    const next = values[clamped];
    if (next !== selected) onSelect(next);
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    syncFromOffset(e.nativeEvent.contentOffset.y);
  };

  return (
    <View style={styles.pickerColWrap}>
      <Text style={styles.pickerColLabel}>{label}</Text>
      <View style={[styles.pickerWheelFrame, { height: PICKER_WHEEL_HEIGHT }]}>
        <View
          style={[
            styles.pickerWheelHighlight,
            {
              height: PICKER_ROW_HEIGHT,
              top: PICKER_ROW_HEIGHT,
            },
          ]}
          pointerEvents="none"
        />
        <ScrollView
          ref={scrollRef}
          style={{ height: PICKER_WHEEL_HEIGHT }}
          showsVerticalScrollIndicator={false}
          snapToInterval={PICKER_ROW_HEIGHT}
          decelerationRate="fast"
          nestedScrollEnabled
          contentContainerStyle={{
            paddingVertical: PICKER_ROW_HEIGHT,
          }}
          onMomentumScrollEnd={onScrollEnd}
          onScrollEndDrag={onScrollEnd}
        >
          {values.map((value) => {
            const isActive = value === selected;
            return (
              <TouchableOpacity
                key={value}
                style={[
                  styles.pickerWheelRow,
                  { height: PICKER_ROW_HEIGHT },
                  isActive && styles.pickerWheelRowActive,
                ]}
                onPress={() => {
                  onSelect(value);
                  const idx = values.indexOf(value);
                  if (idx >= 0) {
                    scrollRef.current?.scrollTo({
                      y: idx * PICKER_ROW_HEIGHT,
                      animated: true,
                    });
                  }
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.pickerItemText,
                    isActive && styles.pickerItemTextActive,
                  ]}
                >
                  {value}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

export const ProviderScheduleScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isEmployee = isEmployeeProvider(user);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleDay[]>(DEFAULT_SCHEDULE);
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  const [pickHour, setPickHour] = useState("08");
  const [pickMinute, setPickMinute] = useState("00");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getMyAvailability();
      const rows = Array.isArray(res.data) ? res.data : [];
      setSchedule(normalizeScheduleFromApi(rows));
    } catch {
      Alert.alert("Error", "Could not load your schedule. Please try again.");
      setSchedule(DEFAULT_SCHEDULE);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openPicker = useCallback(
    (dayIndex: number, field: "start" | "end") => {
      const row = schedule[dayIndex];
      const raw = field === "start" ? row.startTime : row.endTime;
      const parsed = parseHHmm(raw);
      setPickHour(parsed?.hour ?? "08");
      setPickMinute(
        parsed && MINUTES.includes(parsed.minute) ? parsed.minute : "00",
      );
      setPicker({ dayIndex, field });
    },
    [schedule],
  );

  const confirmPicker = useCallback(() => {
    if (!picker) return;
    const next = padHHmm(pickHour, pickMinute);
    setSchedule((prev) =>
      prev.map((row, i) =>
        i === picker.dayIndex
          ? {
              ...row,
              [picker.field === "start" ? "startTime" : "endTime"]: next,
            }
          : row,
      ),
    );
    setPicker(null);
  }, [picker, pickHour, pickMinute]);

  const toggleWorking = useCallback((dayIndex: number) => {
    setSchedule((prev) =>
      prev.map((row, i) =>
        i === dayIndex ? { ...row, isWorking: !row.isWorking } : row,
      ),
    );
  }, []);

  const validateWorkingRanges = useCallback(() => {
    for (const row of schedule) {
      if (!row.isWorking) continue;
      const start = minutesSinceMidnight(row.startTime);
      const end = minutesSinceMidnight(row.endTime);
      if (end <= start) {
        Alert.alert(
          "Invalid times",
          `${DAY_DISPLAY_NAME[row.dayOfWeek]}: end time must be after start time.`,
        );
        return false;
      }
    }
    return true;
  }, [schedule]);

  const handleSave = useCallback(async () => {
    if (isEmployee) {
      Alert.alert(
        "Schedule managed by company",
        "Your company admin manages your working hours.",
      );
      return;
    }
    if (!validateWorkingRanges()) return;
    setSaving(true);
    try {
      const payload = {
        days: schedule.map((d) => ({
          dayOfWeek: d.dayOfWeek,
          isWorking: d.isWorking,
          startTime: d.isWorking ? d.startTime : "08:00",
          endTime: d.isWorking ? d.endTime : "18:00",
        })),
      };
      const res = await api.upsertAvailability(payload);
      const rows = Array.isArray(res.data) ? res.data : [];
      setSchedule(normalizeScheduleFromApi(rows));
      showSuccessToast("Schedule saved");
    } catch {
      Alert.alert("Error", "Could not save schedule. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [schedule, validateWorkingRanges, isEmployee]);

  const pickerTitle = useMemo(() => {
    if (!picker) return "";
    const day = DAY_DISPLAY_NAME[schedule[picker.dayIndex].dayOfWeek];
    return picker.field === "start" ? `${day} · Start` : `${day} · End`;
  }, [picker, schedule]);

  const workingCount = useMemo(
    () => schedule.filter((d) => d.isWorking).length,
    [schedule],
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" backgroundColor={SCREEN_BG} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.85}
        >
          <Ionicons name="chevron-back" size={22} color="#1A1A2E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Schedule</Text>
        <View style={styles.headerRightSpacer} />
      </View>

      {/* ── Subtitle + working count badge ── */}
      <View style={styles.subtitleRow}>
        <Text style={styles.subtitle}>
          {isEmployee
            ? "Your working hours are set by your company admin. You can view them below."
            : "Set your weekly hours. Clients only see slots inside these windows."}
        </Text>
        <View style={styles.workingBadge}>
          <Text style={styles.workingBadgeText}>{workingCount} days on</Text>
        </View>
      </View>

      {!isEmployee ? (
      <TouchableOpacity
        style={styles.manageDaysOffBtn}
        onPress={() => navigation.navigate("ProviderDaysOff")}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Manage days off"
      >
        <View style={styles.manageDaysOffLeft}>
          <View style={styles.manageDaysOffIcon}>
            <Ionicons name="moon-outline" size={16} color={ACCENT} />
          </View>
          <Text style={styles.manageDaysOffText}>Manage days off</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color="#C4C4C4" />
      </TouchableOpacity>
      ) : null}

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={ACCENT} />
          <Text style={styles.loaderText}>Loading schedule…</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 104 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {schedule.map((day, index) => {
            const isWeekend =
              day.dayOfWeek === "SATURDAY" || day.dayOfWeek === "SUNDAY";
            return (
              <View
                key={day.dayOfWeek}
                style={[styles.dayCard, !day.isWorking && styles.dayCardOff]}
              >
                {/* Day header row */}
                <View style={styles.dayRow}>
                  <View style={styles.dayLabelGroup}>
                    <View
                      style={[
                        styles.dayShortBadge,
                        day.isWorking
                          ? styles.dayShortBadgeOn
                          : styles.dayShortBadgeOff,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayShortText,
                          day.isWorking
                            ? styles.dayShortTextOn
                            : styles.dayShortTextOff,
                        ]}
                      >
                        {DAY_SHORT[day.dayOfWeek]}
                      </Text>
                    </View>
                    <View>
                      <Text
                        style={[
                          styles.dayName,
                          !day.isWorking && styles.dayNameOff,
                        ]}
                      >
                        {DAY_DISPLAY_NAME[day.dayOfWeek]}
                      </Text>
                      {isWeekend && !day.isWorking && (
                        <Text style={styles.weekendLabel}>Weekend</Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.switchRow}>
                    <Text
                      style={[
                        styles.switchLabel,
                        day.isWorking && styles.switchLabelOn,
                      ]}
                    >
                      {day.isWorking ? "Working" : "Off"}
                    </Text>
                    <Switch
                      value={day.isWorking}
                      onValueChange={() => toggleWorking(index)}
                      disabled={isEmployee}
                      trackColor={{ false: "#E8E8F0", true: ACCENT_BORDER }}
                      thumbColor={day.isWorking ? ACCENT : "#F4F4F8"}
                      ios_backgroundColor="#E8E8F0"
                    />
                  </View>
                </View>

                {/* Time pickers or day-off strip */}
                {day.isWorking ? (
                  <View style={styles.timesRow}>
                    {(["start", "end"] as const).map((field) => {
                      const timeValue =
                        field === "start" ? day.startTime : day.endTime;
                      return (
                        <TouchableOpacity
                          key={field}
                          style={styles.timeBtn}
                          onPress={() => !isEmployee && openPicker(index, field)}
                          activeOpacity={isEmployee ? 1 : 0.8}
                          disabled={isEmployee}
                        >
                          <Text style={styles.timeBtnLabel}>
                            {field === "start" ? "Start" : "End"}
                          </Text>
                          <View style={styles.timeBtnValueRow}>
                            <Text style={styles.timeBtnValue}>{timeValue}</Text>
                            <View style={styles.timeBtnChevron}>
                              <Ionicons
                                name="chevron-down"
                                size={13}
                                color={ACCENT}
                              />
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  <View style={styles.dayOffRow}>
                    <Ionicons name="moon" size={13} color="#C4C4C4" />
                    <Text style={styles.dayOffText}>
                      Not available this day
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {!isEmployee ? (
      <View
        style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}
      >
        <TouchableOpacity
          style={[
            styles.saveBtn,
            (loading || saving) && styles.saveBtnDisabled,
          ]}
          onPress={() => void handleSave()}
          disabled={loading || saving}
          activeOpacity={0.88}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              <Text style={styles.saveBtnText}>Save Schedule</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
      ) : null}

      {/* ── Time picker modal ── */}
      <Modal
        visible={picker !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setPicker(null)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setPicker(null)}
        >
          <View style={styles.modalCard}>
            {/* Handle */}
            <View style={styles.modalHandle} />

            {/* Title */}
            <Text style={styles.modalTitle}>{pickerTitle}</Text>

            {/* Current preview */}
            <View style={styles.pickerPreview}>
              <Text style={styles.pickerPreviewText}>
                {pickHour}:{pickMinute}
              </Text>
            </View>

            {/* Hour / minute wheels (3 visible rows each) */}
            <View style={styles.pickerColumns}>
              <WheelPicker
                label="Hour"
                values={HOURS}
                selected={pickHour}
                onSelect={setPickHour}
              />
              <View style={styles.pickerColSep}>
                <Text style={styles.pickerColSepText}>:</Text>
              </View>
              <WheelPicker
                label="Min"
                values={MINUTES}
                selected={pickMinute}
                onSelect={setPickMinute}
              />
            </View>

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setPicker(null)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={confirmPicker}
              >
                <Text style={styles.modalConfirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: SCREEN_BG,
  },

  /* ── Header ── */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: SCREEN_BG,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#EBEBF5",
    shadowColor: "#1A1A2E",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "800",
    color: "#1A1A2E",
    letterSpacing: -0.4,
  },
  headerRightSpacer: { width: 40 },

  /* ── Subtitle row ── */
  subtitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 18,
    paddingBottom: 10,
    gap: 10,
  },
  subtitle: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: "#9B9BB0",
    fontWeight: "500",
  },
  workingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FFEDD5",
    flexShrink: 0,
  },
  workingBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#EA580C",
  },

  /* ── Days-off shortcut ── */
  manageDaysOffBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EBEBF5",
    shadowColor: "#1A1A2E",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  manageDaysOffLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  manageDaysOffIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#FFF7ED",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FFEDD5",
  },
  manageDaysOffText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1A1A2E",
  },

  /* ── Loading ── */
  loaderWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  loaderText: {
    fontSize: 14,
    color: "#9B9BB0",
    fontWeight: "600",
  },

  /* ── Scroll ── */
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 10,
  },

  /* ── Day card ── */
  dayCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EBEBF5",
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: "#1A1A2E",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  dayCardOff: {
    backgroundColor: SCREEN_BG,
    borderColor: "#F0EEF8",
  },

  /* Day row */
  dayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dayLabelGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dayShortBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  dayShortBadgeOn: {
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FFEDD5",
  },
  dayShortBadgeOff: {
    backgroundColor: "#F4F4F8",
    borderWidth: 1,
    borderColor: "#E8E8F0",
  },
  dayShortText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  dayShortTextOn: { color: "#EA580C" },
  dayShortTextOff: { color: "#C4C4C4" },
  dayName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1A1A2E",
    letterSpacing: -0.2,
  },
  dayNameOff: { color: "#C4C4C4" },
  weekendLabel: {
    fontSize: 10,
    color: "#C4C4C4",
    fontWeight: "500",
    marginTop: 1,
  },

  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  switchLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#C4C4C4",
  },
  switchLabelOn: { color: "#EA580C" },

  /* Time buttons */
  timesRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  timeBtn: {
    flex: 1,
    backgroundColor: "#FFF7ED",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#FFF7ED",
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  timeBtnLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#9B9BB0",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  timeBtnValueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timeBtnValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1A1A2E",
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"],
  },
  timeBtnChevron: {
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: "#FFF7ED",
    alignItems: "center",
    justifyContent: "center",
  },

  /* Day off strip */
  dayOffRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#F9F9FC",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#E8E8F0",
  },
  dayOffText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#C4C4C4",
  },

  /* ── Footer ── */
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#EBEBF5",
    shadowColor: "#1A1A2E",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 12,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#EA580C",
    borderRadius: 999,
    paddingVertical: 16,
    shadowColor: ACCENT_DARK,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
  },
  saveBtnDisabled: { opacity: 0.45, shadowOpacity: 0 },
  saveBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.1,
  },

  /* ── Modal ── */
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(26,26,46,0.35)",
    justifyContent: "flex-end",
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: "#EBEBF5",
    shadowColor: "#1A1A2E",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 8,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E0E0EC",
    alignSelf: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1A1A2E",
    textAlign: "center",
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  pickerPreview: {
    alignSelf: "center",
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: "#FFF7ED",
    borderWidth: 1.5,
    borderColor: "#FFEDD5",
    marginBottom: 16,
  },
  pickerPreviewText: {
    fontSize: 32,
    fontWeight: "800",
    color: "#EA580C",
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
  },
  pickerColumns: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: 4,
  },
  pickerColWrap: {
    flex: 1,
  },
  pickerColLabel: {
    textAlign: "center",
    fontSize: 10,
    fontWeight: "700",
    color: "#C4C4C4",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  pickerWheelFrame: {
    overflow: "hidden",
    borderRadius: 16,
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#EBEBF5",
  },
  pickerWheelHighlight: {
    position: "absolute",
    left: 8,
    right: 8,
    borderRadius: 12,
    backgroundColor: "#FFF7ED",
    borderWidth: 1.5,
    borderColor: "#FFEDD5",
    zIndex: 0,
  },
  pickerWheelRow: {
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  pickerWheelRowActive: {},
  pickerColSep: {
    width: 28,
    alignItems: "center",
    justifyContent: "center",
    height: PICKER_WHEEL_HEIGHT,
    marginBottom: 0,
  },
  pickerColSepText: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FDBA74",
    marginTop: 22,
  },
  pickerItemText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#9B9BB0",
    fontVariant: ["tabular-nums"],
  },
  pickerItemTextActive: {
    fontSize: 22,
    color: "#EA580C",
    fontWeight: "800",
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 14,
    backgroundColor: "#F4F3FA",
    borderWidth: 1,
    borderColor: "#EBEBF5",
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#9B9BB0",
  },
  modalConfirm: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 14,
    backgroundColor: ACCENT,
    shadowColor: ACCENT_DARK,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});
