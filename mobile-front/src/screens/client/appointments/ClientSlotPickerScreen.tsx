import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import type { ClientStackParamList } from "../../../navigation/types";
import { COLORS } from "../../../constants";
import { api } from "../../../services/api";

type Props = NativeStackScreenProps<ClientStackParamList, "ClientSlotPicker">;

// ─── Constants (unchanged) ────────────────────────────────
const NOTES_MAX = 500;
const MAX_PHOTOS = 5;
const DATE_STRIP_DAYS = 22;

// ─── Design tokens ─────────────────────────────────────────
const C = {
  bg: "#F7F8FC",
  white: "#FFFFFF",
  border: "#EAECF4",
  borderLight: "#F0F2F8",
  text: "#0F172A",
  textSub: "#64748B",
  textLight: "#94A3B8",
  accent: "#4F46E5",
  accentBg: "#EEF2FF",
  accentBorder: "#C7D2FE",
  accentLight: "rgba(79,70,229,0.08)",
  success: "#059669",
  successBg: "#ECFDF5",
  error: "#DC2626",
  errorBg: "#FFF1F1",
  warning: "#D97706",
  warningBg: "#FFFBEB",
  shadow: "rgba(79,70,229,0.10)",
  cardShadow: "rgba(0,0,0,0.06)",
};

// ─── Helpers (unchanged) ──────────────────────────────────
function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(d: Date, days: number): Date {
  const n = new Date(d);
  n.setDate(n.getDate() + days);
  return n;
}

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// ─── Section header ────────────────────────────────────────
function SectionHeader({ label, sub }: { label: string; sub?: string }) {
  return (
    <View style={s.sectionHeader}>
      <View style={s.sectionBar} />
      <View style={{ flex: 1 }}>
        <Text style={s.sectionLabel}>{label}</Text>
        {sub ? <Text style={s.sectionSub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

// ─── Slot chip ─────────────────────────────────────────────
function SlotChip({
  time,
  selected,
  onPress,
}: {
  time: string;
  selected: boolean;
  onPress: () => void;
}) {
  const scale = React.useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.spring(scale, {
        toValue: 0.92,
        useNativeDriver: true,
        speed: 40,
      }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20 }),
    ]).start();
    onPress();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[s.slotChip, selected && s.slotChipSelected]}
        onPress={handlePress}
        activeOpacity={0.85}
      >
        {selected && <View style={s.slotChipDot} />}
        <Text style={[s.slotChipText, selected && s.slotChipTextSelected]}>
          {time}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Photo thumb ───────────────────────────────────────────
function PhotoThumb({ uri, onRemove }: { uri: string; onRemove: () => void }) {
  return (
    <View style={s.thumbWrap}>
      <Image source={{ uri }} style={s.thumb} resizeMode="cover" />
      <TouchableOpacity
        style={s.thumbRemove}
        onPress={onRemove}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Ionicons name="close" size={11} color={C.white} />
      </TouchableOpacity>
      {/* Corner tint overlay */}
      <View style={s.thumbOverlay} />
    </View>
  );
}

// ─── Main Screen ───────────────────────────────────────────
export const ClientSlotPickerScreen: React.FC<Props> = ({
  route,
  navigation,
}) => {
  const {
    providerId,
    givenServiceId,
    providerName,
    serviceName,
    estimatedDurationMinutes,
  } = route.params;
  const insets = useSafeAreaInsets();

  const duration = useMemo(
    () => Math.max(1, estimatedDurationMinutes || 60),
    [estimatedDurationMinutes],
  );

  // ── State (all unchanged) ─────────────────────────────────
  const [selectedDate, setSelectedDate] = useState(() => formatYmd(new Date()));
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [datesWithNoSlots, setDatesWithNoSlots] = useState<Set<string>>(
    () => new Set(),
  );

  // ── Date strip (unchanged) ────────────────────────────────
  const dateStrip = useMemo(() => {
    const start = new Date();
    start.setHours(12, 0, 0, 0);
    return Array.from({ length: DATE_STRIP_DAYS }, (_, i) =>
      formatYmd(addDays(start, i)),
    );
  }, []);

  useEffect(() => {
    setSelectedTime(null);
  }, [selectedDate]);

  // ── Slot fetch (unchanged logic) ──────────────────────────
  useEffect(() => {
    let cancelled = false;
    const dateToFetch = selectedDate;
    setSlotsLoading(true);
    void api
      .getAvailableSlots(providerId, dateToFetch, duration)
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res.data) ? res.data : [];
        setSlots(list);
        setDatesWithNoSlots((prev) => {
          const next = new Set(prev);
          if (list.length === 0) next.add(dateToFetch);
          else next.delete(dateToFetch);
          return next;
        });
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [providerId, selectedDate, duration]);

  // ── Formatted dates (unchanged logic) ────────────────────
  const formattedSectionDate = useMemo(() => {
    try {
      return parseYmd(selectedDate).toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  const recapDateTime = useMemo(() => {
    if (!selectedTime) return null;
    try {
      const d = parseYmd(selectedDate);
      const datePart = d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
      return `${datePart} · ${selectedTime}`;
    } catch {
      return `${selectedDate} · ${selectedTime}`;
    }
  }, [selectedDate, selectedTime]);

  // ── Photo handlers (unchanged logic) ─────────────────────
  const onAddPhotos = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "Allow photo library access to attach images.",
      );
      return;
    }
    const remaining = MAX_PHOTOS - photoUris.length;
    if (remaining <= 0) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: remaining,
    });
    if (result.canceled || !result.assets?.length) return;
    const next = [
      ...photoUris,
      ...result.assets.map((a) => a.uri).filter(Boolean),
    ].slice(0, MAX_PHOTOS);
    setPhotoUris(next);
  }, [photoUris]);

  const onRemovePhoto = useCallback(
    (uri: string) => setPhotoUris((prev) => prev.filter((u) => u !== uri)),
    [],
  );

  // ── Submit (unchanged logic) ──────────────────────────────
  const onSubmit = useCallback(async () => {
    if (!selectedTime || submitting) return;
    setSubmitting(true);
    try {
      const res = await api.createAppointment({
        givenServiceId,
        providerId,
        scheduledDate: selectedDate,
        scheduledTime: selectedTime,
        notes: notes.trim() || undefined,
        photoUrls: photoUris.length ? photoUris : undefined,
      });
      const appointmentId = res.data?.id;
      if (!appointmentId) throw new Error("Missing appointment id");
      navigation.replace("ClientBookingConfirmation", {
        appointmentId,
        providerName,
        serviceName,
        scheduledDate: selectedDate,
        scheduledTime: selectedTime,
      });
    } catch {
      Alert.alert(
        "Could not send request",
        "Check your connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }, [
    givenServiceId,
    providerId,
    providerName,
    serviceName,
    selectedDate,
    selectedTime,
    notes,
    photoUris,
    submitting,
    navigation,
  ]);

  // ── Selected date info ────────────────────────────────────
  const selectedDateObj = useMemo(() => parseYmd(selectedDate), [selectedDate]);
  const slotsCount = slots.length;
  const isFullyBooked =
    !slotsLoading && slotsCount === 0 && !datesWithNoSlots.has(selectedDate);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.root}>
        {/* ── Header ── */}
        <View style={s.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={s.headerBack}
          >
            <Ionicons name="chevron-back" size={22} color={C.text} />
          </TouchableOpacity>
        </View>

        {/* ── Recap bar — provider + service ── */}
        <View style={s.recapBar}>
          <View style={s.recapAvatarWrap}>
            <Text style={s.recapAvatarText}>
              {providerName.trim().charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.recapName} numberOfLines={1}>
              {providerName}
            </Text>
            <Text style={s.recapService} numberOfLines={1}>
              {serviceName}
            </Text>
          </View>
          {/* Duration badge */}
          <View style={s.durationBadge}>
            <Ionicons name="time-outline" size={11} color={C.accent} />
            <Text style={s.durationBadgeText}>~{duration} min</Text>
          </View>
        </View>

        <ScrollView
          style={s.scroll}
          contentContainerStyle={[
            s.scrollContent,
            { paddingBottom: insets.bottom + 110 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Date strip ── */}
          <View style={s.dateStripWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.dateStripContent}
            >
              {dateStrip.map((ymd) => {
                const d = parseYmd(ymd);
                const isSelected = ymd === selectedDate;
                const isToday = ymd === formatYmd(new Date());
                const dow = WEEKDAY_SHORT[d.getDay()];
                const dom = d.getDate();
                const hasNoSlots = datesWithNoSlots.has(ymd);

                return (
                  <TouchableOpacity
                    key={ymd}
                    style={[
                      s.dateCell,
                      isSelected && s.dateCellSelected,
                      isToday && !isSelected && s.dateCellToday,
                    ]}
                    onPress={() => setSelectedDate(ymd)}
                    activeOpacity={0.82}
                  >
                    <Text style={[s.dateDow, isSelected && s.dateDowSelected]}>
                      {dow}
                    </Text>
                    <Text style={[s.dateDom, isSelected && s.dateDomSelected]}>
                      {dom}
                    </Text>
                    {isToday && !isSelected && <View style={s.todayDot} />}
                    {hasNoSlots && <View style={s.emptyDot} />}
                    {isSelected && !hasNoSlots && !slotsLoading && (
                      <Text style={s.dateSlotsHint}>{slotsCount}s</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* ── Selected date headline ── */}
          <View style={s.dateHeadlineRow}>
            <View>
              <Text style={s.dateHeadlineDay}>
                {WEEKDAY_SHORT[selectedDateObj.getDay()]},
              </Text>
              <Text style={s.dateHeadlineFull}>
                {selectedDateObj.getDate()}{" "}
                {MONTH_SHORT[selectedDateObj.getMonth()]}{" "}
                {selectedDateObj.getFullYear()}
              </Text>
            </View>
            {!slotsLoading && slotsCount > 0 && (
              <View style={s.availableCountBadge}>
                <Ionicons name="checkmark-circle" size={13} color={C.success} />
                <Text style={s.availableCountText}>{slotsCount} available</Text>
              </View>
            )}
            {!slotsLoading && slotsCount === 0 && (
              <View style={s.unavailableBadge}>
                <Ionicons name="close-circle" size={13} color={C.error} />
                <Text style={s.unavailableText}>No slots</Text>
              </View>
            )}
          </View>

          {/* ── Slots ── */}
          <View style={s.slotsCard}>
            {slotsLoading ? (
              <View style={s.slotsLoading}>
                <ActivityIndicator color={C.accent} size="small" />
                <Text style={s.slotsLoadingText}>Checking availability…</Text>
              </View>
            ) : slots.length === 0 ? (
              <View style={s.noSlotsWrap}>
                <View style={s.noSlotsIconBox}>
                  <Ionicons
                    name="calendar-outline"
                    size={22}
                    color={C.textLight}
                  />
                </View>
                <Text style={s.noSlotsTitle}>No availability</Text>
                <Text style={s.noSlotsSub}>
                  This provider has no open slots on this day.{"\n"}Try another
                  date.
                </Text>
              </View>
            ) : (
              <View style={s.slotGrid}>
                {slots.map((t) => (
                  <SlotChip
                    key={t}
                    time={t}
                    selected={t === selectedTime}
                    onPress={() => setSelectedTime(t)}
                  />
                ))}
              </View>
            )}
          </View>

          {/* ── Notes ── */}
          <SectionHeader
            label="Notes"
            sub="Describe the problem or add any details"
          />
          <View style={s.notesCard}>
            <TextInput
              style={s.notesInput}
              placeholder="E.g. The kitchen sink is leaking under the cabinet…"
              placeholderTextColor={C.textLight}
              multiline
              value={notes}
              onChangeText={(v) => setNotes(v.slice(0, NOTES_MAX))}
              textAlignVertical="top"
            />
            <View style={s.notesFooter}>
              <View style={s.notesHintRow}>
                <Ionicons
                  name="information-circle-outline"
                  size={13}
                  color={C.textLight}
                />
                <Text style={s.notesHint}>
                  The more detail, the better your match
                </Text>
              </View>
              <Text
                style={[
                  s.charCounter,
                  notes.length > NOTES_MAX * 0.9 && { color: C.warning },
                ]}
              >
                {notes.length}/{NOTES_MAX}
              </Text>
            </View>
          </View>

          {/* ── Photos ── */}
          <SectionHeader
            label="Attach photos"
            sub="Help the provider understand the issue"
          />

          <View style={s.photosCard}>
            {photoUris.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.thumbRow}
              >
                {photoUris.map((uri) => (
                  <PhotoThumb
                    key={uri}
                    uri={uri}
                    onRemove={() => onRemovePhoto(uri)}
                  />
                ))}
              </ScrollView>
            )}

            <TouchableOpacity
              style={[
                s.addPhotosBtn,
                photoUris.length >= MAX_PHOTOS && s.addPhotosBtnDisabled,
              ]}
              onPress={onAddPhotos}
              activeOpacity={0.85}
              disabled={photoUris.length >= MAX_PHOTOS}
            >
              <View style={s.addPhotosIconBox}>
                <Ionicons
                  name="camera-outline"
                  size={17}
                  color={
                    photoUris.length >= MAX_PHOTOS ? C.textLight : C.accent
                  }
                />
              </View>
              <Text
                style={[
                  s.addPhotosText,
                  photoUris.length >= MAX_PHOTOS && { color: C.textLight },
                ]}
              >
                {photoUris.length >= MAX_PHOTOS
                  ? "Maximum photos reached"
                  : `Add photos  ·  ${photoUris.length}/${MAX_PHOTOS}`}
              </Text>
              {photoUris.length < MAX_PHOTOS && (
                <Ionicons
                  name="chevron-forward"
                  size={14}
                  color={C.textLight}
                />
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* ── Bottom sticky bar ── */}
        <View
          style={[s.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}
        >
          {/* Selection recap */}
          <View style={s.bottomRecap}>
            {selectedTime ? (
              <>
                <Text style={s.bottomRecapLabel}>Your selection</Text>
                <Text style={s.bottomRecapValue} numberOfLines={1}>
                  {recapDateTime}
                </Text>
              </>
            ) : (
              <>
                <Text style={s.bottomRecapLabel}>No slot selected</Text>
                <Text style={s.bottomRecapPlaceholder}>Pick a time above</Text>
              </>
            )}
          </View>

          {/* Send button */}
          <TouchableOpacity
            style={[
              s.sendBtn,
              (!selectedTime || submitting) && s.sendBtnDisabled,
            ]}
            onPress={onSubmit}
            disabled={!selectedTime || submitting}
            activeOpacity={0.88}
          >
            {submitting ? (
              <ActivityIndicator color={C.white} size="small" />
            ) : (
              <>
                <Text style={s.sendBtnText}>Send Request</Text>
                <View style={s.sendBtnArrow}>
                  <Ionicons name="arrow-forward" size={14} color={C.accent} />
                </View>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

// ─── Styles ────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.white },
  root: { flex: 1, backgroundColor: C.bg },

  // ── Header ──────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerBack: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },

  // ── Recap bar ────────────────────────────────────────────
  recapBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  recapAvatarWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: C.accentBg,
    borderWidth: 1,
    borderColor: C.accentBorder,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  recapAvatarText: {
    fontSize: 16,
    fontWeight: "800",
    color: C.accent,
  },
  recapName: {
    fontSize: 14,
    fontWeight: "700",
    color: C.text,
    letterSpacing: -0.2,
  },
  recapService: { fontSize: 12, color: C.textSub, marginTop: 1 },
  durationBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: C.accentBg,
    borderWidth: 1,
    borderColor: C.accentBorder,
    flexShrink: 0,
  },
  durationBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: C.accent,
  },

  // ── Scroll ───────────────────────────────────────────────
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, gap: 4 },

  // ── Section header ───────────────────────────────────────
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 20,
    marginBottom: 10,
  },
  sectionBar: {
    width: 3,
    height: 38,
    borderRadius: 2,
    backgroundColor: C.accent,
    marginTop: 1,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: C.text,
    letterSpacing: -0.2,
  },
  sectionSub: {
    fontSize: 12,
    color: C.textSub,
    marginTop: 2,
  },

  // ── Date strip ───────────────────────────────────────────
  dateStripWrap: {
    backgroundColor: C.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 12,
    paddingHorizontal: 4,
    ...Platform.select({
      ios: {
        shadowColor: C.cardShadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 8,
      },
      android: { elevation: 1 },
    }),
  },
  dateStripContent: { gap: 6, paddingHorizontal: 8 },
  dateCell: {
    width: 50,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    borderWidth: 1,
    borderColor: C.borderLight,
    minHeight: 68,
  },
  dateCellSelected: {
    backgroundColor: C.accent,
    borderColor: C.accent,
    ...Platform.select({
      ios: {
        shadowColor: C.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },
  dateCellToday: {
    borderColor: C.accentBorder,
    backgroundColor: C.accentBg,
  },
  dateDow: {
    fontSize: 10,
    fontWeight: "700",
    color: C.textLight,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  dateDowSelected: { color: "rgba(255,255,255,0.75)" },
  dateDom: {
    fontSize: 17,
    fontWeight: "800",
    color: C.text,
  },
  dateDomSelected: { color: C.white },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.accent,
  },
  emptyDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: C.error,
  },
  dateSlotsHint: {
    fontSize: 9,
    fontWeight: "700",
    color: "rgba(255,255,255,0.65)",
  },

  // ── Date headline ────────────────────────────────────────
  dateHeadlineRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  dateHeadlineDay: {
    fontSize: 12,
    fontWeight: "600",
    color: C.textSub,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  dateHeadlineFull: {
    fontSize: 18,
    fontWeight: "800",
    color: C.text,
    letterSpacing: -0.4,
    marginTop: 1,
  },
  availableCountBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  availableCountText: {
    fontSize: 11,
    fontWeight: "700",
    color: C.success,
  },
  unavailableBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: C.errorBg,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  unavailableText: {
    fontSize: 11,
    fontWeight: "700",
    color: C.error,
  },

  // ── Slots card ───────────────────────────────────────────
  slotsCard: {
    backgroundColor: C.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    minHeight: 100,
    ...Platform.select({
      ios: {
        shadowColor: C.cardShadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 8,
      },
      android: { elevation: 1 },
    }),
  },
  slotsLoading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    gap: 10,
  },
  slotsLoadingText: {
    fontSize: 13,
    color: C.textSub,
    fontWeight: "500",
  },
  noSlotsWrap: {
    alignItems: "center",
    paddingVertical: 20,
    gap: 8,
  },
  noSlotsIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 4,
  },
  noSlotsTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: C.text,
  },
  noSlotsSub: {
    fontSize: 12,
    color: C.textSub,
    textAlign: "center",
    lineHeight: 18,
  },
  slotGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  slotChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: C.bg,
    borderWidth: 1.5,
    borderColor: C.accentBorder,
  },
  slotChipSelected: {
    backgroundColor: C.accent,
    borderColor: C.accent,
    ...Platform.select({
      ios: {
        shadowColor: C.accent,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
      },
      android: { elevation: 3 },
    }),
  },
  slotChipDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "rgba(255,255,255,0.7)",
  },
  slotChipText: {
    fontSize: 14,
    fontWeight: "700",
    color: C.accent,
  },
  slotChipTextSelected: { color: C.white },

  // ── Notes card ───────────────────────────────────────────
  notesCard: {
    backgroundColor: C.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: C.cardShadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 8,
      },
      android: { elevation: 1 },
    }),
  },
  notesInput: {
    minHeight: 108,
    padding: 14,
    fontSize: 14,
    color: C.text,
    lineHeight: 21,
  },
  notesFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: C.borderLight,
    backgroundColor: C.bg,
  },
  notesHintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  notesHint: {
    fontSize: 11,
    color: C.textLight,
  },
  charCounter: {
    fontSize: 11,
    color: C.textLight,
    fontWeight: "600",
  },

  // ── Photos card ──────────────────────────────────────────
  photosCard: {
    backgroundColor: C.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: C.cardShadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 8,
      },
      android: { elevation: 1 },
    }),
  },
  thumbRow: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 4,
    gap: 10,
  },
  thumbWrap: { position: "relative" },
  thumb: {
    width: 78,
    height: 78,
    borderRadius: 13,
    backgroundColor: C.bg,
  },
  thumbOverlay: {
    position: "absolute",
    inset: 0,
    borderRadius: 13,
    backgroundColor: "transparent",
  },
  thumbRemove: {
    position: "absolute",
    top: -5,
    right: -5,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#1F2937",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: C.white,
  },
  addPhotosBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  addPhotosBtnDisabled: { opacity: 0.5 },
  addPhotosIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: C.accentBg,
    borderWidth: 1,
    borderColor: C.accentBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  addPhotosText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: C.accent,
  },

  // ── Bottom bar ───────────────────────────────────────────
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    backgroundColor: C.white,
    borderTopWidth: 1,
    borderTopColor: C.border,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
      },
      android: { elevation: 8 },
    }),
  },
  bottomRecap: { flex: 1 },
  bottomRecapLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: C.textLight,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  bottomRecapValue: {
    marginTop: 3,
    fontSize: 14,
    fontWeight: "800",
    color: C.text,
    letterSpacing: -0.2,
  },
  bottomRecapPlaceholder: {
    marginTop: 3,
    fontSize: 13,
    color: C.textLight,
    fontWeight: "500",
  },
  sendBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: C.accent,
    minWidth: 148,
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: C.accent,
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
      android: { elevation: 6 },
    }),
  },
  sendBtnDisabled: {
    backgroundColor: "#E2E8F0",
    shadowOpacity: 0,
    elevation: 0,
  },
  sendBtnText: {
    color: C.white,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.1,
  },
  sendBtnArrow: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
});
