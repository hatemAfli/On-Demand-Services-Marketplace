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
import { useAuth } from "../../../context/AuthContext";
import { api } from "../../../services/api";
import { uploadAppointmentRequestPhotos } from "../../../services/appointmentRequestPhotosUpload";

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

/** True when `ymd` is the same local calendar day as `ref`. */
function isSameLocalCalendarDay(ymd: string, ref: Date): boolean {
  return ymd === formatYmd(ref);
}

/**
 * For the given calendar day, true if the slot start (local) is strictly before `now`.
 * Only applies when `ymd` is today; future days always return false.
 */
function isSlotStartInPast(ymd: string, slotHHmm: string, now: Date): boolean {
  if (!isSameLocalCalendarDay(ymd, now)) return false;
  const parts = slotHHmm.trim().split(":");
  if (parts.length < 2) return false;
  const hh = Number(parts[0]);
  const mm = Number(parts[1]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return false;
  const slotStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0, 0);
  return slotStart.getTime() < now.getTime();
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
  disabled,
  onPress,
}: {
  time: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const scale = React.useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    if (disabled) return;
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
        style={[
          s.slotChip,
          disabled && s.slotChipDisabled,
          selected && !disabled && s.slotChipSelected,
        ]}
        onPress={handlePress}
        activeOpacity={disabled ? 1 : 0.85}
        disabled={disabled}
      >
        {selected && !disabled && <View style={s.slotChipDot} />}
        <Text
          style={[
            s.slotChipText,
            disabled && s.slotChipTextDisabled,
            selected && !disabled && s.slotChipTextSelected,
          ]}
        >
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
  const { user } = useAuth();

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

  // Re-evaluate "past" slots while viewing today (e.g. user keeps screen open).
  const [nowCoarse, setNowCoarse] = useState(() => Date.now());
  useEffect(() => {
    if (isSameLocalCalendarDay(selectedDate, new Date())) {
      setNowCoarse(Date.now());
    }
  }, [selectedDate]);
  useEffect(() => {
    if (!isSameLocalCalendarDay(selectedDate, new Date())) return;
    const id = setInterval(() => setNowCoarse(Date.now()), 30_000);
    return () => clearInterval(id);
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

  useEffect(() => {
    if (!selectedTime) return;
    const now = new Date();
    if (isSlotStartInPast(selectedDate, selectedTime, now)) {
      setSelectedTime(null);
    }
  }, [selectedDate, selectedTime, slots, nowCoarse]);

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
    if (isSlotStartInPast(selectedDate, selectedTime, new Date())) {
      Alert.alert("Time passed", "Pick a time that has not started yet.");
      return;
    }
    setSubmitting(true);
    try {
      let photoUrls: string[] | undefined;
      if (photoUris.length) {
        const clientId = user?.id;
        if (!clientId) {
          Alert.alert("Sign in required", "Log in to attach photos to your request.");
          return;
        }
        const batchId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        photoUrls = await uploadAppointmentRequestPhotos(
          clientId,
          batchId,
          photoUris,
        );
      }

      const res = await api.createAppointment({
        givenServiceId,
        providerId,
        scheduledDate: selectedDate,
        scheduledTime: selectedTime,
        notes: notes.trim() || undefined,
        photoUrls: photoUrls?.length ? photoUrls : undefined,
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
        photoUris.length
          ? "Photos could not be uploaded or the request failed. Check your connection and try again."
          : "Check your connection and try again.",
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
    user?.id,
  ]);

  // ── Derived ───────────────────────────────────────────────
  const selectedDateObj = useMemo(() => parseYmd(selectedDate), [selectedDate]);
  const nowForSlots = useMemo(() => new Date(nowCoarse), [nowCoarse]);
  const bookableSlotCount = useMemo(
    () =>
      slots.filter((t) => !isSlotStartInPast(selectedDate, t, nowForSlots)).length,
    [slots, selectedDate, nowForSlots],
  );
  const slotsCount = slots.length;

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
            <Ionicons name="chevron-back" size={20} color="#1A1A2E" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Book a slot</Text>
          <View style={s.headerRightSpacer} />
        </View>

        {/* ── Provider recap bar ── */}
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
                      isToday && !isSelected && s.dateCellToday,
                      isSelected && s.dateCellSelected,
                    ]}
                    onPress={() => setSelectedDate(ymd)}
                    activeOpacity={0.82}
                  >
                    <Text
                      style={[
                        s.dateDow,
                        isSelected && s.dateDowSelected,
                        isToday && !isSelected && s.dateDowToday,
                      ]}
                    >
                      {dow}
                    </Text>
                    <Text
                      style={[
                        s.dateDom,
                        isSelected && s.dateDomSelected,
                        isToday && !isSelected && s.dateDomToday,
                      ]}
                    >
                      {dom}
                    </Text>
                    {hasNoSlots && !isSelected && <View style={s.emptyDot} />}
                    {isSelected &&
                      !hasNoSlots &&
                      !slotsLoading &&
                      bookableSlotCount > 0 && (
                        <View style={s.slotsCountPill}>
                          <Text style={s.slotsCountText}>{bookableSlotCount}</Text>
                        </View>
                      )}
                    {isToday && !isSelected && <View style={s.todayDot} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* ── Date headline ── */}
          <View style={s.dateHeadlineRow}>
            <View>
              <Text style={s.dateHeadlineDay}>
                {WEEKDAY_SHORT[selectedDateObj.getDay()]}
              </Text>
              <Text style={s.dateHeadlineFull}>
                {selectedDateObj.getDate()}{" "}
                {MONTH_SHORT[selectedDateObj.getMonth()]}{" "}
                {selectedDateObj.getFullYear()}
              </Text>
            </View>
            {!slotsLoading && bookableSlotCount > 0 && (
              <View style={s.availableCountBadge}>
                <Ionicons name="checkmark-circle" size={12} color={C.success} />
                <Text style={s.availableCountText}>
                  {bookableSlotCount} available
                </Text>
              </View>
            )}
            {!slotsLoading && bookableSlotCount === 0 && slotsCount > 0 && (
              <View style={s.unavailableBadge}>
                <Ionicons name="time-outline" size={12} color={C.warning} />
                <Text style={s.unavailableText}>Earlier times passed</Text>
              </View>
            )}
            {!slotsLoading && slotsCount === 0 && (
              <View style={s.unavailableBadge}>
                <Ionicons name="close-circle" size={12} color={C.error} />
                <Text style={s.unavailableText}>No slots</Text>
              </View>
            )}
          </View>

          {/* ── Slots card ── */}
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
                    size={24}
                    color={C.textLight}
                  />
                </View>
                <Text style={s.noSlotsTitle}>No availability</Text>
                <Text style={s.noSlotsSub}>
                  This provider has no open slots on this day.{"\n"}Try another
                  date.
                </Text>
              </View>
            ) : bookableSlotCount === 0 ? (
              <View style={s.noSlotsWrap}>
                <View style={s.noSlotsIconBox}>
                  <Ionicons name="time-outline" size={24} color={C.textLight} />
                </View>
                <Text style={s.noSlotsTitle}>No times left today</Text>
                <Text style={s.noSlotsSub}>
                  All remaining slots for this day are in the past.{"\n"}Choose
                  another date.
                </Text>
              </View>
            ) : (
              <>
                <Text style={s.slotGridLabel}>Select a time</Text>
                <View style={s.slotGrid}>
                  {slots.map((t) => {
                    const past = isSlotStartInPast(selectedDate, t, nowForSlots);
                    return (
                      <SlotChip
                        key={t}
                        time={t}
                        selected={t === selectedTime}
                        disabled={past}
                        onPress={() => setSelectedTime(t)}
                      />
                    );
                  })}
                </View>
              </>
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
              <View
                style={[
                  s.addPhotosIconBox,
                  photoUris.length >= MAX_PHOTOS && s.addPhotosIconBoxDisabled,
                ]}
              >
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
  safe: { flex: 1, backgroundColor: "#FAFAF9" },
  root: { flex: 1, backgroundColor: "#F4F3FA" },

  // ── Header ──────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FAFAF9",
  },
  headerBack: {
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
    fontSize: 17,
    fontWeight: "800",
    color: "#1A1A2E",
    letterSpacing: -0.4,
  },
  headerRightSpacer: { width: 40 },

  // ── Provider recap bar ───────────────────────────────────
  recapBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#EBEBF5",
    shadowColor: "#1A1A2E",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  recapAvatarWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#EDE9FE",
    borderWidth: 2,
    borderColor: "#C4B5FD",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    shadowColor: "#7C5CFC",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  recapAvatarText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#7C5CFC",
  },
  recapName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1A1A2E",
    letterSpacing: -0.2,
  },
  recapService: {
    fontSize: 12,
    color: "#9B9BB0",
    marginTop: 1,
    fontWeight: "500",
  },
  durationBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#EDE9FE",
    borderWidth: 1,
    borderColor: "#C4B5FD",
    flexShrink: 0,
  },
  durationBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#7C5CFC",
  },

  // ── Scroll ───────────────────────────────────────────────
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, gap: 4 },

  // ── Section header ───────────────────────────────────────
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 22,
    marginBottom: 10,
  },
  sectionBar: {
    width: 3,
    height: 36,
    borderRadius: 2,
    backgroundColor: "#7C5CFC",
    marginTop: 1,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1A1A2E",
    letterSpacing: -0.2,
  },
  sectionSub: {
    fontSize: 12,
    color: "#9B9BB0",
    marginTop: 2,
    fontWeight: "500",
  },

  // ── Date strip ───────────────────────────────────────────
  dateStripWrap: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#EBEBF5",
    paddingVertical: 12,
    paddingHorizontal: 4,
    shadowColor: "#1A1A2E",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  dateStripContent: { gap: 6, paddingHorizontal: 8 },
  dateCell: {
    width: 52,
    paddingVertical: 11,
    borderRadius: 16,
    backgroundColor: "#F9F8FF",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    borderWidth: 1,
    borderColor: "#EBEBF5",
    minHeight: 72,
  },
  dateCellToday: {
    borderColor: "#C4B5FD",
    backgroundColor: "#F5F3FF",
    borderWidth: 1.5,
  },
  dateCellSelected: {
    backgroundColor: "#7C5CFC",
    borderColor: "#7C5CFC",
    shadowColor: "#7C5CFC",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  dateDow: {
    fontSize: 10,
    fontWeight: "700",
    color: "#C4C4C4",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  dateDowToday: { color: "#7C5CFC" },
  dateDowSelected: { color: "rgba(255,255,255,0.7)" },
  dateDom: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1A1A2E",
    fontVariant: ["tabular-nums"],
  },
  dateDomToday: { color: "#7C5CFC" },
  dateDomSelected: { color: "#FFFFFF" },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#7C5CFC",
  },
  emptyDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#F43F5E",
  },
  slotsCountPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.3)",
    minWidth: 20,
    alignItems: "center",
  },
  slotsCountText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  // ── Date headline ────────────────────────────────────────
  dateHeadlineRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 16,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  dateHeadlineDay: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9B9BB0",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  dateHeadlineFull: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1A1A2E",
    letterSpacing: -0.5,
    marginTop: 2,
  },
  availableCountBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#6EE7B7",
  },
  availableCountText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#059669",
  },
  unavailableBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  unavailableText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#DC2626",
  },

  // ── Slots card ───────────────────────────────────────────
  slotsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#EBEBF5",
    padding: 16,
    minHeight: 100,
    shadowColor: "#1A1A2E",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  slotGridLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9B9BB0",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  slotsLoading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    gap: 10,
  },
  slotsLoadingText: {
    fontSize: 13,
    color: "#9B9BB0",
    fontWeight: "500",
  },
  noSlotsWrap: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 8,
  },
  noSlotsIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#F4F3FA",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#EBEBF5",
    marginBottom: 4,
  },
  noSlotsTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1A1A2E",
  },
  noSlotsSub: {
    fontSize: 12,
    color: "#9B9BB0",
    textAlign: "center",
    lineHeight: 18,
    fontWeight: "500",
  },
  slotGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  slotChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#F5F3FF",
    borderWidth: 1.5,
    borderColor: "#C4B5FD",
  },
  slotChipSelected: {
    backgroundColor: "#7C5CFC",
    borderColor: "#7C5CFC",
    shadowColor: "#7C5CFC",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  slotChipDisabled: {
    opacity: 0.5,
    backgroundColor: "#F1F5F9",
    borderColor: "#E2E8F0",
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
    color: "#7C5CFC",
    fontVariant: ["tabular-nums"],
  },
  slotChipTextDisabled: {
    color: "#94A3B8",
  },
  slotChipTextSelected: { color: "#FFFFFF" },

  // ── Notes card ───────────────────────────────────────────
  notesCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#EBEBF5",
    overflow: "hidden",
    shadowColor: "#1A1A2E",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  notesInput: {
    minHeight: 112,
    padding: 16,
    fontSize: 14,
    color: "#1A1A2E",
    lineHeight: 22,
    fontWeight: "400",
  },
  notesFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#F4F3FA",
    backgroundColor: "#FAFAF9",
  },
  notesHintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  notesHint: {
    fontSize: 11,
    color: "#C4C4C4",
    fontWeight: "500",
  },
  charCounter: {
    fontSize: 11,
    color: "#C4C4C4",
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },

  // ── Photos card ──────────────────────────────────────────
  photosCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#EBEBF5",
    overflow: "hidden",
    shadowColor: "#1A1A2E",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  thumbRow: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 4,
    gap: 10,
  },
  thumbWrap: { position: "relative" },
  thumb: {
    width: 80,
    height: 80,
    borderRadius: 14,
    backgroundColor: "#F4F3FA",
  },
  thumbOverlay: {
    position: "absolute",
    inset: 0,
    borderRadius: 14,
    backgroundColor: "transparent",
  },
  thumbRemove: {
    position: "absolute",
    top: -5,
    right: -5,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#1A1A2E",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  addPhotosBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  addPhotosBtnDisabled: { opacity: 0.45 },
  addPhotosIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#EDE9FE",
    borderWidth: 1,
    borderColor: "#C4B5FD",
    alignItems: "center",
    justifyContent: "center",
  },
  addPhotosIconBoxDisabled: {
    backgroundColor: "#F4F4F8",
    borderColor: "#E8E8F0",
  },
  addPhotosText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#7C5CFC",
  },

  // ── Bottom bar ───────────────────────────────────────────
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingTop: 14,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#EBEBF5",
    shadowColor: "#1A1A2E",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 10,
  },
  bottomRecap: { flex: 1 },
  bottomRecapLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#C4C4C4",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  bottomRecapValue: {
    marginTop: 3,
    fontSize: 14,
    fontWeight: "800",
    color: "#1A1A2E",
    letterSpacing: -0.2,
  },
  bottomRecapPlaceholder: {
    marginTop: 3,
    fontSize: 13,
    color: "#C4C4C4",
    fontWeight: "500",
  },
  sendBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: "#7C5CFC",
    minWidth: 152,
    justifyContent: "center",
    shadowColor: "#7C5CFC",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  sendBtnDisabled: {
    backgroundColor: "#E8E8F0",
    shadowOpacity: 0,
    elevation: 0,
  },
  sendBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
  sendBtnArrow: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
});
