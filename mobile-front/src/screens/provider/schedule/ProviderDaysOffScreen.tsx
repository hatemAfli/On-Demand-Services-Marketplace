import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
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
import type { ProviderStackParamList } from "../../../navigation/types";
import { api, type ProviderDayOffItem } from "../../../services/api";

type Props = NativeStackScreenProps<ProviderStackParamList, "ProviderDaysOff">;

export type DayOffRow = {
  id: string;
  date: string;
  reason?: string | null;
};

function dateKeyFromLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseKeyToLocalDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDaysLocal(base: Date, days: number): Date {
  const n = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  n.setDate(n.getDate() + days);
  return n;
}

function normalizeApiDate(raw: string): string {
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return raw.slice(0, 10);
}

function normalizeDayOffItem(row: ProviderDayOffItem): DayOffRow {
  return {
    id: row.id,
    date: normalizeApiDate(row.date),
    reason: row.reason ?? null,
  };
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function isSameLocalDay(a: Date, y: number, m: number, day: number): boolean {
  return a.getFullYear() === y && a.getMonth() === m && a.getDate() === day;
}

function formatListDate(key: string): string {
  const d = parseKeyToLocalDate(key);
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatStripLabel(key: string): { line1: string; line2: string } {
  const d = parseKeyToLocalDate(key);
  return {
    line1: d.toLocaleDateString("en-GB", { weekday: "short" }),
    line2: String(d.getDate()),
  };
}

const SCREEN_PAD = 16;
const GAP = 6;

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export const ProviderDaysOffScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const contentWidth = Dimensions.get("window").width - SCREEN_PAD * 2;
  const cellSize = Math.floor((contentWidth - GAP * 6) / 7);

  const [loading, setLoading] = useState(true);
  const [daysOff, setDaysOff] = useState<DayOffRow[]>([]);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [sheetVisible, setSheetVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() =>
    dateKeyFromLocal(new Date()),
  );
  const [reasonDraft, setReasonDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const todayKey = useMemo(() => dateKeyFromLocal(new Date()), []);

  const blockedByDate = useMemo(() => {
    const m = new Map<string, DayOffRow>();
    for (const row of daysOff) m.set(row.date, row);
    return m;
  }, [daysOff]);

  const loadDaysOff = useCallback(async () => {
    const from = todayKey;
    const to = dateKeyFromLocal(addDaysLocal(new Date(), 90));
    const res = await api.getMyDaysOff(from, to);
    const rows = Array.isArray(res.data) ? res.data : [];
    setDaysOff(rows.map(normalizeDayOffItem));
  }, [todayKey]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void loadDaysOff()
      .catch(() => {
        if (!cancelled) Alert.alert("Error", "Could not load days off.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadDaysOff]);

  const year = currentMonth.getFullYear();
  const monthIndex = currentMonth.getMonth();
  const dim = daysInMonth(year, monthIndex);
  const firstWeekday = new Date(year, monthIndex, 1).getDay();

  const calendarRows = useMemo(() => {
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= dim; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    const rows: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [dim, firstWeekday]);

  const monthTitle = currentMonth.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  const goPrevMonth = () => setCurrentMonth(new Date(year, monthIndex - 1, 1));
  const goNextMonth = () => setCurrentMonth(new Date(year, monthIndex + 1, 1));

  const stripDates = useMemo(() => {
    const out: string[] = [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    for (let i = 0; i <= 60; i++)
      out.push(dateKeyFromLocal(addDaysLocal(start, i)));
    return out;
  }, []);

  const upcomingBlocked = useMemo(() => {
    const start = parseKeyToLocalDate(todayKey);
    start.setHours(0, 0, 0, 0);
    return [...daysOff]
      .filter((r) => {
        const dt = parseKeyToLocalDate(r.date);
        dt.setHours(0, 0, 0, 0);
        return dt >= start;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [daysOff, todayKey]);

  const openAddSheet = useCallback((dateKey: string) => {
    setSelectedDate(dateKey);
    setReasonDraft("");
    setSheetVisible(true);
  }, []);

  const closeSheet = () => {
    setSheetVisible(false);
    setReasonDraft("");
  };

  const handleDayCellPress = (dayNum: number) => {
    const key = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
    const blocked = blockedByDate.get(key);
    if (blocked) {
      Alert.alert(
        "Day off",
        blocked.reason?.trim()
          ? blocked.reason.trim()
          : "This day is already blocked.",
      );
      return;
    }
    openAddSheet(key);
  };

  const handleSubmitAdd = async () => {
    if (blockedByDate.has(selectedDate)) {
      Alert.alert("Already blocked", "Pick another date.");
      return;
    }
    setSubmitting(true);
    try {
      await api.createDayOff({
        date: selectedDate,
        reason: reasonDraft.trim() || undefined,
      });
      await loadDaysOff();
      closeSheet();
    } catch {
      Alert.alert("Error", "Could not add day off.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingIds((prev) => new Set(prev).add(id));
    try {
      await api.deleteDayOff(id);
      setDaysOff((prev) => prev.filter((x) => x.id !== id));
    } catch {
      Alert.alert("Error", "Could not remove day off.");
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const todayDate = new Date();

  const blockedCount = upcomingBlocked.length;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFAF9" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.85}
        >
          <Ionicons name="chevron-back" size={20} color="#1A1A2E" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Days Off</Text>
          {blockedCount > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{blockedCount} blocked</Text>
            </View>
          )}
        </View>
        <View style={styles.headerRightSpacer} />
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color="#7C5CFC" />
          <Text style={styles.loaderText}>Loading your calendar…</Text>
        </View>
      ) : (
        <>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={{
              paddingHorizontal: SCREEN_PAD,
              paddingBottom: insets.bottom + 100,
              paddingTop: 8,
            }}
            showsVerticalScrollIndicator={false}
          >
            {/* ── Calendar card ── */}
            <View style={styles.calendarCard}>
              {/* Month nav */}
              <View style={styles.monthNav}>
                <TouchableOpacity
                  onPress={goPrevMonth}
                  style={styles.monthArrow}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="chevron-back" size={18} color="#7C5CFC" />
                </TouchableOpacity>
                <Text style={styles.monthTitle}>{monthTitle}</Text>
                <TouchableOpacity
                  onPress={goNextMonth}
                  style={styles.monthArrow}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="chevron-forward" size={18} color="#7C5CFC" />
                </TouchableOpacity>
              </View>

              {/* Weekday row */}
              <View style={[styles.weekdayRow, { gap: GAP }]}>
                {WEEKDAY_LABELS.map((l, i) => (
                  <View
                    key={`wd-${i}`}
                    style={[styles.weekdayCell, { width: cellSize }]}
                  >
                    <Text
                      style={[
                        styles.weekdayText,
                        (i === 0 || i === 6) && styles.weekdayTextWeekend,
                      ]}
                    >
                      {l}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Calendar grid */}
              {calendarRows.map((row, ri) => (
                <View key={ri} style={[styles.weekRow, { gap: GAP }]}>
                  {row.map((cell, ci) => {
                    if (cell === null) {
                      return (
                        <View
                          key={`e-${ri}-${ci}`}
                          style={{ width: cellSize, height: cellSize }}
                        />
                      );
                    }
                    const key = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(cell).padStart(2, "0")}`;
                    const blocked = blockedByDate.get(key);
                    const isToday = isSameLocalDay(
                      todayDate,
                      year,
                      monthIndex,
                      cell,
                    );
                    const isWeekend = ci === 0 || ci === 6;

                    return (
                      <TouchableOpacity
                        key={key}
                        style={[
                          styles.dayCell,
                          { width: cellSize, height: cellSize },
                          isWeekend && !blocked && styles.dayCellWeekend,
                          isToday && !blocked && styles.dayCellToday,
                          blocked && styles.dayCellBlocked,
                        ]}
                        onPress={() => {
                          if (blocked) {
                            Alert.alert(
                              "Day off",
                              blocked.reason?.trim()
                                ? blocked.reason.trim()
                                : "This day is blocked.",
                            );
                            return;
                          }
                          handleDayCellPress(cell);
                        }}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.dayCellNum,
                            isWeekend &&
                              !blocked &&
                              !isToday &&
                              styles.dayCellNumWeekend,
                            isToday && !blocked && styles.dayCellNumToday,
                            blocked && styles.dayCellNumBlocked,
                          ]}
                        >
                          {cell}
                        </Text>
                        {blocked && <View style={styles.dayCellDot} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}

              {/* Legend */}
              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View
                    style={[styles.legendDot, { backgroundColor: "#7C5CFC" }]}
                  />
                  <Text style={styles.legendText}>Today</Text>
                </View>
                <View style={styles.legendItem}>
                  <View
                    style={[styles.legendDot, { backgroundColor: "#F43F5E" }]}
                  />
                  <Text style={styles.legendText}>Day off</Text>
                </View>
                <View style={styles.legendItem}>
                  <View
                    style={[styles.legendDot, { backgroundColor: "#E8E8F8" }]}
                  />
                  <Text style={styles.legendText}>Weekend</Text>
                </View>
              </View>
            </View>

            {/* ── Upcoming blocked days ── */}
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Upcoming blocked days</Text>
              {blockedCount > 0 && (
                <View style={styles.sectionCountPill}>
                  <Text style={styles.sectionCountText}>{blockedCount}</Text>
                </View>
              )}
            </View>

            {upcomingBlocked.length === 0 ? (
              <View style={styles.emptyWrap}>
                <View style={styles.emptyIconRing}>
                  <Ionicons name="sunny-outline" size={24} color="#7C5CFC" />
                </View>
                <Text style={styles.emptyHintTitle}>All clear!</Text>
                <Text style={styles.emptyHint}>
                  No upcoming days off. Tap any calendar date or use + to add
                  one.
                </Text>
              </View>
            ) : (
              <View style={styles.listWrap}>
                {upcomingBlocked.map((item, index) => (
                  <View key={item.id}>
                    <View style={styles.listRow}>
                      {/* Date badge */}
                      <View style={styles.listDateBadge}>
                        <Text style={styles.listDateBadgeDay}>
                          {parseKeyToLocalDate(item.date).getDate()}
                        </Text>
                        <Text style={styles.listDateBadgeMon}>
                          {parseKeyToLocalDate(item.date).toLocaleDateString(
                            "en-GB",
                            { month: "short" },
                          )}
                        </Text>
                      </View>

                      <View style={styles.listRowText}>
                        <Text style={styles.listDate}>
                          {formatListDate(item.date)}
                        </Text>
                        {item.reason?.trim() ? (
                          <Text style={styles.listReason} numberOfLines={2}>
                            {item.reason.trim()}
                          </Text>
                        ) : (
                          <Text style={styles.listReasonEmpty}>
                            No reason specified
                          </Text>
                        )}
                      </View>

                      <TouchableOpacity
                        style={[
                          styles.trashBtn,
                          deletingIds.has(item.id) && { opacity: 0.5 },
                        ]}
                        onPress={() => void handleDelete(item.id)}
                        disabled={deletingIds.has(item.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        {deletingIds.has(item.id) ? (
                          <ActivityIndicator size="small" color="#F43F5E" />
                        ) : (
                          <Ionicons
                            name="trash-outline"
                            size={17}
                            color="#F43F5E"
                          />
                        )}
                      </TouchableOpacity>
                    </View>
                    {index < upcomingBlocked.length - 1 && (
                      <View style={styles.sep} />
                    )}
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          {/* ── FAB ── */}
          <TouchableOpacity
            style={[styles.fab, { bottom: Math.max(insets.bottom, 16) + 8 }]}
            onPress={() => openAddSheet(todayKey)}
            activeOpacity={0.88}
          >
            <Ionicons name="add" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </>
      )}

      {/* ── Add day off sheet ── */}
      <Modal
        visible={sheetVisible}
        transparent
        animationType="slide"
        onRequestClose={closeSheet}
      >
        <View style={styles.sheetRoot}>
          <Pressable style={styles.sheetBackdrop} onPress={closeSheet} />
          <View style={styles.sheetCard}>
            <View style={styles.sheetHandle} />

            <Text style={styles.sheetTitle}>Add day off</Text>
            <Text style={styles.sheetSubtitle}>Choose a date</Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.stripContent}
              keyboardShouldPersistTaps="handled"
            >
              {stripDates.map((key) => {
                const { line1, line2 } = formatStripLabel(key);
                const sel = key === selectedDate;
                const isBlocked = blockedByDate.has(key);
                return (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.stripChip,
                      sel && styles.stripChipSel,
                      isBlocked && styles.stripChipBlocked,
                    ]}
                    onPress={() => setSelectedDate(key)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.stripChipTop,
                        sel && styles.stripChipTopSel,
                        isBlocked && styles.stripChipTopBlocked,
                      ]}
                    >
                      {line1}
                    </Text>
                    <Text
                      style={[
                        styles.stripChipDay,
                        sel && styles.stripChipDaySel,
                        isBlocked && styles.stripChipDayBlocked,
                      ]}
                    >
                      {line2}
                    </Text>
                    {isBlocked && <View style={styles.stripBlockedDot} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.inputLabel}>Reason (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. National holiday, personal leave…"
              placeholderTextColor="#C4C4C4"
              value={reasonDraft}
              onChangeText={setReasonDraft}
              multiline={false}
            />

            <TouchableOpacity
              style={[styles.addBtn, submitting && styles.addBtnDisabled]}
              onPress={() => void handleSubmitAdd()}
              disabled={submitting}
              activeOpacity={0.88}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="moon" size={16} color="#FFFFFF" />
                  <Text style={styles.addBtnText}>Add Day Off</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.sheetCancel} onPress={closeSheet}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>

            {Platform.OS === "ios" ? <View style={{ height: 8 }} /> : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#FAFAF9",
  },

  /* ── Header ── */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SCREEN_PAD,
    paddingVertical: 12,
    backgroundColor: "#FAFAF9",
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
  headerCenter: {
    flex: 1,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1A1A2E",
    letterSpacing: -0.4,
  },
  headerBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  headerBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#DC2626",
  },
  headerRightSpacer: { width: 40 },

  /* ── Loader ── */
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

  scroll: { flex: 1 },

  /* ── Calendar card ── */
  calendarCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#EBEBF5",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
    marginBottom: 20,
    shadowColor: "#1A1A2E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 3,
  },

  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  monthArrow: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#F5F3FF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#EDE9FE",
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1A1A2E",
    letterSpacing: -0.3,
  },

  /* Weekday row */
  weekdayRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  weekdayCell: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  weekdayText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9B9BB0",
    letterSpacing: 0.3,
  },
  weekdayTextWeekend: {
    color: "#C4B5FD",
  },

  weekRow: {
    flexDirection: "row",
    marginBottom: GAP,
  },

  /* Day cells */
  dayCell: {
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FAFAF9",
    position: "relative",
    gap: 2,
  },
  dayCellWeekend: {
    backgroundColor: "#F5F3FF",
  },
  dayCellToday: {
    backgroundColor: "#7C5CFC",
    shadowColor: "#7C5CFC",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  dayCellBlocked: {
    backgroundColor: "#FEE2E2",
    borderWidth: 1.5,
    borderColor: "#FECACA",
  },
  dayCellNum: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1A1A2E",
  },
  dayCellNumWeekend: {
    color: "#9B8BB0",
  },
  dayCellNumToday: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  dayCellNumBlocked: {
    color: "#DC2626",
    fontWeight: "800",
  },
  dayCellDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#F43F5E",
  },

  /* Legend */
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 18,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F4F3FA",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#9B9BB0",
  },

  /* ── Section header ── */
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1A1A2E",
    letterSpacing: -0.2,
  },
  sectionCountPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  sectionCountText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#DC2626",
  },

  /* ── Empty state ── */
  emptyWrap: {
    alignItems: "center",
    paddingVertical: 28,
    gap: 8,
  },
  emptyIconRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#EDE9FE",
    borderWidth: 1.5,
    borderColor: "#C4B5FD",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyHintTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1A1A2E",
  },
  emptyHint: {
    fontSize: 13,
    color: "#9B9BB0",
    lineHeight: 19,
    textAlign: "center",
  },

  /* ── Upcoming list ── */
  listWrap: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EBEBF5",
    overflow: "hidden",
    shadowColor: "#1A1A2E",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  listDateBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  listDateBadgeDay: {
    fontSize: 15,
    fontWeight: "800",
    color: "#DC2626",
    lineHeight: 17,
  },
  listDateBadgeMon: {
    fontSize: 9,
    fontWeight: "700",
    color: "#F87171",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  listRowText: { flex: 1 },
  listDate: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1A1A2E",
    letterSpacing: -0.1,
  },
  listReason: {
    marginTop: 2,
    fontSize: 12,
    color: "#9B9BB0",
    lineHeight: 17,
  },
  listReasonEmpty: {
    marginTop: 2,
    fontSize: 12,
    color: "#D1D1E0",
    fontStyle: "italic",
  },
  trashBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FECACA",
    flexShrink: 0,
  },
  sep: {
    height: 1,
    backgroundColor: "#F4F3FA",
    marginLeft: 14,
  },

  /* ── FAB ── */
  fab: {
    position: "absolute",
    right: SCREEN_PAD,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#7C5CFC",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#7C5CFC",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
  },

  /* ── Bottom sheet ── */
  sheetRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(26,26,46,0.3)",
  },
  sheetCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 28 : 20,
    borderTopWidth: 1,
    borderColor: "#EBEBF5",
    maxHeight: "88%",
    shadowColor: "#1A1A2E",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.07,
    shadowRadius: 20,
    elevation: 12,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E0E0EC",
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1A1A2E",
    marginBottom: 2,
    letterSpacing: -0.5,
  },
  sheetSubtitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "#9B9BB0",
    marginBottom: 14,
  },

  /* Date strip */
  stripContent: {
    gap: 8,
    paddingVertical: 4,
    paddingBottom: 16,
  },
  stripChip: {
    width: 54,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#EBEBF5",
    backgroundColor: "#FAFAF9",
    alignItems: "center",
    gap: 2,
  },
  stripChipSel: {
    borderColor: "#7C5CFC",
    backgroundColor: "#EDE9FE",
  },
  stripChipBlocked: {
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
  },
  stripChipTop: {
    fontSize: 10,
    fontWeight: "700",
    color: "#9B9BB0",
  },
  stripChipTopSel: { color: "#7C5CFC" },
  stripChipTopBlocked: { color: "#F87171" },
  stripChipDay: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1A1A2E",
    fontVariant: ["tabular-nums"],
  },
  stripChipDaySel: { color: "#7C5CFC" },
  stripChipDayBlocked: { color: "#DC2626" },
  stripBlockedDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#F43F5E",
    marginTop: 1,
  },

  /* Reason input */
  inputLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#9B9BB0",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  input: {
    borderWidth: 1.5,
    borderColor: "#EBEBF5",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 13 : 11,
    fontSize: 14,
    color: "#1A1A2E",
    backgroundColor: "#FAFAF9",
    marginBottom: 18,
    fontWeight: "500",
  },

  /* Add button */
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#7C5CFC",
    borderRadius: 999,
    paddingVertical: 16,
    shadowColor: "#7C5CFC",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
  },
  addBtnDisabled: { opacity: 0.45, shadowOpacity: 0 },
  addBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.1,
  },

  sheetCancel: {
    marginTop: 12,
    alignItems: "center",
    paddingVertical: 10,
  },
  sheetCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#9B9BB0",
  },
});
