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
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { WebView } from "react-native-webview";
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
  bg: "#f9fafb",
  white: "#ffffff",
  border: "#e5e7eb",
  borderLight: "#f3f4f6",
  text: "#111827",
  textSub: "#6b7280",
  textLight: "#9ca3af",
  accent: "#2563eb",
  accentBg: "#eff6ff",
  accentBorder: "#dbeafe",
  accentLight: "rgba(37,99,235,0.08)",
  success: "#059669",
  successBg: "#ECFDF5",
  error: "#DC2626",
  errorBg: "#FFF1F1",
  warning: "#D97706",
  warningBg: "#FFFBEB",
  shadow: "rgba(0,0,0,0.05)",
  cardShadow: "rgba(0,0,0,0.05)",
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
  const slotStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hh,
    mm,
    0,
    0,
  );
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

// ─── OSM map HTML builders ─────────────────────────────────
function buildMiniMapHtml(lat: number, lng: number): string {
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin=""/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
<style>html,body,#map{margin:0;padding:0;height:100%;width:100%;background:#e8ecf4;}
.leaflet-control-zoom,.leaflet-control-attribution{display:none!important;}</style>
</head><body>
<div id="map"></div>
<script>
var map=L.map('map',{zoomControl:false,attributionControl:false,dragging:false,
scrollWheelZoom:false,doubleClickZoom:false,touchZoom:false,boxZoom:false,keyboard:false})
.setView([${lat},${lng}],15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
L.marker([${lat},${lng}]).addTo(map);
</script></body></html>`;
}

function buildPickerMapHtml(lat: number, lng: number): string {
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin=""/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
<style>html,body,#map{margin:0;padding:0;height:100%;width:100%;background:#e8ecf4;}</style>
</head><body>
<div id="map"></div>
<script>
var map=L.map('map',{zoomControl:true}).setView([${lat},${lng}],15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(map);
var marker=L.marker([${lat},${lng}],{draggable:true}).addTo(map);
function send(la,ln){if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify({lat:la,lng:ln}));}
map.on('click',function(e){marker.setLatLng(e.latlng);send(e.latlng.lat,e.latlng.lng);});
marker.on('dragend',function(e){var p=e.target.getLatLng();send(p.lat,p.lng);});
</script></body></html>`;
}

// ─── Section header ────────────────────────────────────────
function SectionHeader({ label }: { label: string }) {
  return <Text style={s.sectionTitle}>{label}</Text>;
}

// ─── Photo thumb ───────────────────────────────────────────
function PhotoThumb({ uri, onRemove }: { uri: string; onRemove: () => void }) {
  return (
    <View style={s.photoPreview}>
      <Image source={{ uri }} style={s.photoImage} resizeMode="cover" />
      <TouchableOpacity
        style={s.photoOverlay}
        onPress={onRemove}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Ionicons name="trash-outline" size={14} color={C.white} />
      </TouchableOpacity>
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

  // ── Location state ──────────────────────────────────────────
  const [clientLat, setClientLat] = useState<number | null>(null);
  const [clientLng, setClientLng] = useState<number | null>(null);
  const [locationLabel, setLocationLabel] = useState("Current location");
  const [locationAddress, setLocationAddress] = useState(
    "Loading your location…",
  );
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);
  const [pickerLat, setPickerLat] = useState<number>(36.75);
  const [pickerLng, setPickerLng] = useState<number>(3.06);
  const pickerWebRef = useRef<WebView>(null);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setLocationAddress("Location permission not granted");
          return;
        }
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setClientLat(pos.coords.latitude);
        setClientLng(pos.coords.longitude);
        const [geo] = await Location.reverseGeocodeAsync({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        if (geo) {
          const parts = [geo.street, geo.city, geo.region].filter(Boolean);
          setLocationAddress(parts.join(", ") || "Location set");
          setLocationLabel(geo.name || "Current location");
        } else {
          setLocationAddress("Location set");
        }
      } catch {
        setLocationAddress("Could not get location");
      }
    })();
  }, []);

  const openLocationPicker = useCallback(() => {
    setPickerLat(clientLat ?? 36.75);
    setPickerLng(clientLng ?? 3.06);
    setLocationPickerVisible(true);
  }, [clientLat, clientLng]);

  const confirmPickerLocation = useCallback(async () => {
    setClientLat(pickerLat);
    setClientLng(pickerLng);
    setLocationPickerVisible(false);
    try {
      const [geo] = await Location.reverseGeocodeAsync({
        latitude: pickerLat,
        longitude: pickerLng,
      });
      if (geo) {
        const parts = [geo.street, geo.city, geo.region].filter(Boolean);
        setLocationAddress(parts.join(", ") || "Location set");
        setLocationLabel(geo.name || "Selected location");
      } else {
        setLocationAddress("Location set");
        setLocationLabel("Selected location");
      }
    } catch {
      setLocationAddress("Location set");
    }
  }, [pickerLat, pickerLng]);

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
          Alert.alert(
            "Sign in required",
            "Log in to attach photos to your request.",
          );
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
        latitude: clientLat ?? undefined,
        longitude: clientLng ?? undefined,
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
      slots.filter((t) => !isSlotStartInPast(selectedDate, t, nowForSlots))
        .length,
    [slots, selectedDate, nowForSlots],
  );
  const slotsCount = slots.length;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.root}>
        {/* ── Header ── */}
        <View style={s.header}>
          <View style={s.headerRow}>
            <TouchableOpacity
              style={s.headerIconBtn}
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="arrow-back" size={16} color={C.textSub} />
            </TouchableOpacity>
            <Text style={s.headerTitle}>Confirm Booking</Text>
            <View style={s.headerIconBtn}>
              <Ionicons
                name="help-circle-outline"
                size={18}
                color={C.textSub}
              />
            </View>
          </View>
        </View>

        <ScrollView
          style={s.scroll}
          contentContainerStyle={[
            s.scrollContent,
            { paddingBottom: insets.bottom + 100 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Service card ── */}
          <View style={s.serviceCard}>
            <View style={s.serviceAvatar}>
              <Text style={s.serviceAvatarText}>
                {providerName.trim().charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={s.serviceInfo}>
              <Text style={s.serviceTitle} numberOfLines={1}>
                {serviceName}
              </Text>
              <View style={s.serviceTags}>
                <View style={s.serviceTag}>
                  <Text style={s.serviceTagText}>~{duration} min</Text>
                </View>
                <View style={s.serviceTag}>
                  <Text style={s.serviceTagText}>{providerName}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* ── Location card ── */}
          <View style={s.section}>
            <View style={s.sectionHeaderRow}>
              <Text style={s.sectionTitle}>Location</Text>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={openLocationPicker}
              >
                <Text style={s.sectionAction}>Change</Text>
              </TouchableOpacity>
            </View>
            <View style={s.locationCard}>
              <View style={s.mapPreview}>
                <Image
                  source={{
                    uri: "https://storage.googleapis.com/uxpilot-auth.appspot.com/ae3b8bf38d-93fbbc8105d0201daa9a.png",
                  }}
                  style={s.mapImage}
                />
                <View style={s.mapPin}>
                  <Ionicons name="location-sharp" size={12} color={C.white} />
                </View>
              </View>
              <View style={s.locationDetails}>
                <View style={s.locationIcon}>
                  <Ionicons name="home-outline" size={14} color={C.accent} />
                </View>
                <View style={s.locationTextWrap}>
                  <Text style={s.locationTitle}>{locationLabel}</Text>
                  <Text style={s.locationText}>{locationAddress}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* ── Date & Time section ── */}
          <View style={s.section}>
            <SectionHeader label="Date & Time" />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.dateScroller}
              style={s.dateScrollerWrap}
            >
              {dateStrip.map((ymd) => {
                const d = parseYmd(ymd);
                const isSelected = ymd === selectedDate;
                const isToday = ymd === formatYmd(new Date());
                const dow = isToday ? "Today" : WEEKDAY_SHORT[d.getDay()];
                const dom = d.getDate();
                const mon = MONTH_SHORT[d.getMonth()];

                return (
                  <TouchableOpacity
                    key={ymd}
                    onPress={() => setSelectedDate(ymd)}
                    style={[s.dateCard, isSelected && s.dateCardActive]}
                    activeOpacity={0.82}
                  >
                    <Text style={[s.dateTop, isSelected && s.dateTopActive]}>
                      {dow}
                    </Text>
                    <Text style={[s.dateDay, isSelected && s.dateDayActive]}>
                      {dom}
                    </Text>
                    <Text
                      style={[s.dateMonth, isSelected && s.dateMonthActive]}
                    >
                      {mon}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* ── Time slots grid ── */}
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
                  This provider has no open slots on {formattedSectionDate}.
                  {"\n"}Try another date.
                </Text>
              </View>
            ) : bookableSlotCount === 0 ? (
              <View style={s.noSlotsWrap}>
                <View style={s.noSlotsIconBox}>
                  <Ionicons name="time-outline" size={24} color={C.textLight} />
                </View>
                <Text style={s.noSlotsTitle}>No times left today</Text>
                <Text style={s.noSlotsSub}>
                  All remaining slots are in the past.{"\n"}Choose another date.
                </Text>
              </View>
            ) : (
              <View style={s.timeGrid}>
                {slots.map((t) => {
                  const past = isSlotStartInPast(selectedDate, t, nowForSlots);
                  const sel = t === selectedTime;
                  return (
                    <TouchableOpacity
                      key={t}
                      style={[
                        s.timeSlot,
                        sel && s.timeSlotActive,
                        past && s.timeSlotDisabled,
                      ]}
                      onPress={() => {
                        if (!past) setSelectedTime(t);
                      }}
                      disabled={past}
                      activeOpacity={0.85}
                    >
                      <Text
                        style={[
                          s.timeSlotText,
                          sel && s.timeSlotTextActive,
                          past && s.timeSlotTextDisabled,
                        ]}
                      >
                        {t}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* ── Notes ── */}
          <View style={s.section}>
            <SectionHeader label="Add Details" />
            <View style={s.notesCard}>
              <TextInput
                style={s.notesInput}
                placeholder="Add notes for the provider (e.g. bring ladder, key under mat)..."
                placeholderTextColor={C.textLight}
                multiline
                value={notes}
                onChangeText={(v) => setNotes(v.slice(0, NOTES_MAX))}
                textAlignVertical="top"
              />
              <View style={s.photoRow}>
                <TouchableOpacity
                  style={[
                    s.addPhotoBtn,
                    photoUris.length >= MAX_PHOTOS && s.addPhotoBtnDisabled,
                  ]}
                  onPress={onAddPhotos}
                  disabled={photoUris.length >= MAX_PHOTOS}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name="camera-outline"
                    size={16}
                    color={
                      photoUris.length >= MAX_PHOTOS ? C.textLight : C.textSub
                    }
                  />
                  <Text style={s.addPhotoText}>
                    {photoUris.length >= MAX_PHOTOS
                      ? `${MAX_PHOTOS}/${MAX_PHOTOS}`
                      : "Add Photo"}
                  </Text>
                </TouchableOpacity>
                {photoUris.map((uri) => (
                  <PhotoThumb
                    key={uri}
                    uri={uri}
                    onRemove={() => onRemovePhoto(uri)}
                  />
                ))}
              </View>
            </View>
          </View>
        </ScrollView>

        {/* ── Bottom sticky bar ── */}
        <View
          style={[s.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}
        >
          <View style={s.bottomBarContent}>
            <TouchableOpacity
              style={[
                s.confirmButton,
                (!selectedTime || submitting) && s.confirmButtonDisabled,
              ]}
              onPress={onSubmit}
              disabled={!selectedTime || submitting}
              activeOpacity={0.9}
            >
              {submitting ? (
                <ActivityIndicator color={C.white} size="small" />
              ) : (
                <>
                  <Text style={s.confirmButtonText}>
                    {selectedTime
                      ? `Confirm Booking · ${recapDateTime}`
                      : "Select a time slot"}
                  </Text>
                  <Ionicons name="arrow-forward" size={14} color={C.white} />
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── Location picker modal ── */}
      <Modal
        visible={locationPickerVisible}
        animationType="slide"
        onRequestClose={() => setLocationPickerVisible(false)}
      >
        <SafeAreaView style={s.pickerSafe} edges={["top", "bottom"]}>
          <View style={s.pickerHeader}>
            <TouchableOpacity
              onPress={() => setLocationPickerVisible(false)}
              style={s.pickerBack}
            >
              <Ionicons name="close" size={22} color={C.text} />
            </TouchableOpacity>
            <Text style={s.pickerTitle}>Pick your location</Text>
            <View style={{ width: 38 }} />
          </View>

          <View style={{ flex: 1 }}>
            <WebView
              ref={pickerWebRef}
              style={{ flex: 1 }}
              originWhitelist={["*"]}
              source={{
                html: buildPickerMapHtml(pickerLat, pickerLng),
                baseUrl: "https://localhost",
              }}
              onMessage={(e) => {
                try {
                  const d = JSON.parse(e.nativeEvent.data) as {
                    lat?: number;
                    lng?: number;
                  };
                  if (typeof d.lat === "number" && typeof d.lng === "number") {
                    setPickerLat(d.lat);
                    setPickerLng(d.lng);
                  }
                } catch {
                  /* ignore */
                }
              }}
              javaScriptEnabled
              domStorageEnabled
              mixedContentMode="always"
              setSupportMultipleWindows={false}
            />
          </View>

          <View style={s.pickerBottom}>
            <TouchableOpacity
              style={s.pickerConfirmBtn}
              activeOpacity={0.85}
              onPress={confirmPickerLocation}
            >
              <Ionicons name="checkmark-circle" size={18} color={C.white} />
              <Text style={s.pickerConfirmText}>Confirm location</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

// ─── Styles ────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.white },
  root: { flex: 1, backgroundColor: C.bg },

  // ── Header ──────────────────────────────────────────────
  header: {
    backgroundColor: C.white,
    paddingTop: 8,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: C.text,
  },

  // ── Scroll ───────────────────────────────────────────────
  scroll: { flex: 1, backgroundColor: C.bg },
  scrollContent: { paddingBottom: 160 },

  // ── Service card ─────────────────────────────────────────
  serviceCard: {
    marginTop: 20,
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 20,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.borderLight,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  serviceAvatar: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: C.accentBg,
    borderWidth: 1.5,
    borderColor: C.accentBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  serviceAvatarText: {
    fontSize: 22,
    fontWeight: "800",
    color: C.accent,
  },
  serviceInfo: { flex: 1 },
  serviceTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: C.text,
  },
  serviceTags: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  serviceTag: {
    backgroundColor: C.borderLight,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  serviceTagText: {
    fontSize: 12,
    color: C.textSub,
    fontWeight: "500",
  },

  // ── Section ──────────────────────────────────────────────
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: C.text,
    marginBottom: 14,
  },
  sectionAction: {
    fontSize: 12,
    fontWeight: "600",
    color: C.accent,
    marginBottom: 14,
  },

  // ── Location card ────────────────────────────────────────
  locationCard: {
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 4,
    borderWidth: 1,
    borderColor: C.borderLight,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  mapPreview: {
    height: 112,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#e8ecf4",
    alignItems: "center",
    justifyContent: "center",
  },
  mapImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  } as const,
  mapPin: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F97316",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  locationDetails: {
    flexDirection: "row",
    padding: 14,
    gap: 12,
  },
  locationIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.accentBg,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  locationTextWrap: { flex: 1 },
  locationTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: C.text,
  },
  locationText: {
    fontSize: 12,
    color: C.textSub,
    marginTop: 3,
    lineHeight: 17,
  },

  // ── Date cards ───────────────────────────────────────────
  dateScrollerWrap: {
    marginHorizontal: -20,
  },
  dateScroller: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 10,
  },
  dateCard: {
    width: 72,
    height: 88,
    borderRadius: 18,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.borderLight,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  dateCardActive: {
    backgroundColor: C.accent,
    borderColor: C.accent,
    shadowColor: C.accent,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  dateTop: {
    fontSize: 10,
    color: C.textLight,
    fontWeight: "600",
    marginBottom: 4,
  },
  dateTopActive: { color: C.white },
  dateDay: {
    fontSize: 22,
    fontWeight: "700",
    color: C.text,
  },
  dateDayActive: { color: C.white },
  dateMonth: {
    fontSize: 10,
    color: C.textLight,
    fontWeight: "500",
    marginTop: 4,
  },
  dateMonthActive: { color: C.white },

  // ── Time slots grid ──────────────────────────────────────
  timeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  timeSlot: {
    width: "30%" as unknown as number,
    minWidth: 92,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.white,
    alignItems: "center",
    justifyContent: "center",
  },
  timeSlotActive: {
    backgroundColor: C.accentBg,
    borderColor: C.accent,
    borderWidth: 1.5,
  },
  timeSlotDisabled: {
    backgroundColor: C.bg,
    borderColor: "transparent",
    opacity: 0.55,
  },
  timeSlotText: {
    fontSize: 13,
    color: C.textSub,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  timeSlotTextActive: {
    color: C.accent,
    fontWeight: "700",
  },
  timeSlotTextDisabled: {
    color: C.textLight,
    fontWeight: "500",
  },

  // ── Slots loading / empty ────────────────────────────────
  slotsLoading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    gap: 10,
  },
  slotsLoadingText: {
    fontSize: 13,
    color: C.textSub,
    fontWeight: "500",
  },
  noSlotsWrap: {
    alignItems: "center",
    paddingVertical: 28,
    gap: 8,
  },
  noSlotsIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: C.borderLight,
    alignItems: "center",
    justifyContent: "center",
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
    fontWeight: "500",
  },

  // ── Notes card ───────────────────────────────────────────
  notesCard: {
    backgroundColor: C.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
  },
  notesInput: {
    minHeight: 100,
    padding: 16,
    fontSize: 14,
    color: C.textSub,
    textAlignVertical: "top",
  },
  photoRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.bg,
    borderTopWidth: 1,
    borderTopColor: C.borderLight,
    flexWrap: "wrap",
  },
  addPhotoBtn: {
    width: 64,
    height: 64,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: C.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  addPhotoBtnDisabled: { opacity: 0.4 },
  addPhotoText: {
    fontSize: 9,
    color: C.textSub,
    fontWeight: "600",
    marginTop: 4,
  },
  photoPreview: {
    width: 64,
    height: 64,
    borderRadius: 12,
    overflow: "hidden",
  },
  photoImage: {
    width: "100%",
    height: "100%",
  },
  photoOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },

  // ── Bottom bar ───────────────────────────────────────────
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: C.white,
    borderTopWidth: 1,
    borderTopColor: C.borderLight,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -4 },
    elevation: 6,
  },
  bottomBarContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  confirmButton: {
    backgroundColor: C.accent,
    borderRadius: 16,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: C.accent,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  confirmButtonDisabled: {
    backgroundColor: C.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  confirmButtonText: {
    color: C.white,
    fontWeight: "700",
    fontSize: 14,
  },

  // ── Location picker modal ────────────────────────────────
  pickerSafe: { flex: 1, backgroundColor: C.white },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  pickerBack: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: C.text,
  },
  pickerPinWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  } as const,
  pickerBottom: {
    padding: 20,
    backgroundColor: C.white,
    borderTopWidth: 1,
    borderTopColor: C.border,
    gap: 14,
  },
  pickerHint: {
    fontSize: 13,
    color: C.textSub,
    textAlign: "center",
  },
  pickerConfirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F97316",
    borderRadius: 16,
    paddingVertical: 14,
    gap: 8,
  },
  pickerConfirmText: {
    color: C.white,
    fontWeight: "700",
    fontSize: 15,
  },
});
