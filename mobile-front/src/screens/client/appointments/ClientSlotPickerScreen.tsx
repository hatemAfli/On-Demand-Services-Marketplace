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
import { useAuth } from "../../../context/AuthContext";
import { api } from "../../../services/api";
import { uploadAppointmentRequestPhotos } from "../../../services/appointmentRequestPhotosUpload";

type Props = NativeStackScreenProps<ClientStackParamList, "ClientSlotPicker">;

// ─── Constants (unchanged) ────────────────────────────────
const NOTES_MAX = 500;
const MAX_PHOTOS = 5;
const DATE_STRIP_DAYS = 22;
/** Avoid device locale (e.g. French) for booking copy shown to the client. */
const BOOKING_DATE_LOCALE = "en-US";

// ─── Design tokens ─────────────────────────────────────────
const C = {
  bg: "#F1F5F9",
  white: "#ffffff",
  border: "#e5e7eb",
  borderLight: "#f3f4f6",
  text: "#111827",
  textSub: "#6b7280",
  textLight: "#9ca3af",
  accent: "#EA580C",
  accentBg: "#FFF7ED",
  accentBorder: "#FFEDD5",
  accentLight: "rgba(234,88,12,0.08)",
  success: "#059669",
  successBg: "#ECFDF5",
  error: "#DC2626",
  errorBg: "#FFF1F1",
  warning: "#D97706",
  warningBg: "#FFFBEB",
  warningBorder: "#FDE68A",
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

function normalizeDayOffApiDate(raw: string): string {
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return raw.slice(0, 10);
}

/** `ymd` → reason text, or `null` when blocked with no reason. */
type DaysOffByDate = Record<string, string | null>;

function isDateDayOff(map: DaysOffByDate, ymd: string): boolean {
  return Object.prototype.hasOwnProperty.call(map, ymd);
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

type SlotPickerItem = {
  time: string;
  status: "available" | "reserved";
};

/** Generic business-hour slots for "any provider" company bookings (08:00–18:00). */
function generateGenericSlots(): SlotPickerItem[] {
  const out: SlotPickerItem[] = [];
  for (let h = 8; h <= 18; h += 1) {
    const time = `${String(h).padStart(2, "0")}:00`;
    out.push({ time, status: "available" });
  }
  return out;
}

function normalizeSlotsResponse(data: unknown): SlotPickerItem[] {
  if (Array.isArray(data)) {
    return data
      .filter((entry): entry is string => typeof entry === "string")
      .map((time) => ({ time, status: "available" as const }));
  }
  if (data && typeof data === "object" && "slots" in data) {
    const slots = (data as { slots?: unknown }).slots;
    if (!Array.isArray(slots)) return [];
    return slots
      .map((entry) => {
        if (typeof entry === "string") {
          return { time: entry, status: "available" as const };
        }
        if (entry && typeof entry === "object" && "time" in entry) {
          const row = entry as { time?: unknown; status?: unknown };
          const time = typeof row.time === "string" ? row.time : "";
          const status = row.status === "reserved" ? "reserved" : "available";
          return time ? { time, status } : null;
        }
        return null;
      })
      .filter((row): row is SlotPickerItem => row !== null);
  }
  return [];
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
window.setPickerPosition=function(la,ln,notify){
marker.setLatLng([la,ln]);
map.setView([la,ln],Math.max(map.getZoom(),15));
if(notify)send(la,ln);
};
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
    companyId,
  } = route.params;
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  // "Any available provider" company booking: no concrete provider, so we offer
  // generic business-hour slots and the company admin assigns someone free.
  const isCompanyAnyProvider = !!companyId && !providerId;

  const duration = useMemo(
    () => Math.max(1, estimatedDurationMinutes || 60),
    [estimatedDurationMinutes],
  );

  // ── State (all unchanged) ─────────────────────────────────
  const [selectedDate, setSelectedDate] = useState(() => formatYmd(new Date()));
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotPickerItem[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [datesWithNoSlots, setDatesWithNoSlots] = useState<Set<string>>(
    () => new Set(),
  );
  const [daysOffByDate, setDaysOffByDate] = useState<DaysOffByDate>({});
  const [daysOffLoading, setDaysOffLoading] = useState(false);

  // ── Location state ──────────────────────────────────────────
  const [clientLat, setClientLat] = useState<number | null>(null);
  const [clientLng, setClientLng] = useState<number | null>(null);
  const [locationLabel, setLocationLabel] = useState("Current location");
  const [locationAddress, setLocationAddress] = useState(
    "Loading your location…",
  );
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);
  const [pickerLat, setPickerLat] = useState<number>(36.75);
  const [pickerLng, setPickerLng] = useState<number>(3.06);
  const [locatingOnMap, setLocatingOnMap] = useState(false);
  const pickerWebRef = useRef<WebView>(null);

  useEffect(() => {
    (async () => {
      setLocationLoading(true);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setLocationAddress("Tap Change to set your service location");
          setLocationLabel("Location required");
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
        setLocationAddress("Tap Change to set your service location");
        setLocationLabel("Location required");
      } finally {
        setLocationLoading(false);
      }
    })();
  }, []);

  const hasLocationSet = useMemo(
    () =>
      !locationLoading &&
      clientLat !== null &&
      clientLng !== null &&
      Number.isFinite(clientLat) &&
      Number.isFinite(clientLng),
    [locationLoading, clientLat, clientLng],
  );

  const openLocationPicker = useCallback(() => {
    setPickerLat(clientLat ?? 36.75);
    setPickerLng(clientLng ?? 3.06);
    setLocationPickerVisible(true);
  }, [clientLat, clientLng]);

  const ensureLocationForBooking = useCallback(() => {
    if (hasLocationSet) return true;
    openLocationPicker();
    return false;
  }, [hasLocationSet, openLocationPicker]);

  const goToMyLocationOnMap = useCallback(async () => {
    if (locatingOnMap) return;
    setLocatingOnMap(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Location permission",
          "Allow location access to center the map on your position.",
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setPickerLat(lat);
      setPickerLng(lng);
      pickerWebRef.current?.injectJavaScript(
        `window.setPickerPosition(${lat},${lng},true); true;`,
      );
    } catch {
      Alert.alert(
        "Could not get location",
        "Check that location services are enabled and try again.",
      );
    } finally {
      setLocatingOnMap(false);
    }
  }, [locatingOnMap]);

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

  useEffect(() => {
    if (isCompanyAnyProvider || !providerId) {
      setDaysOffByDate({});
      setDaysOffLoading(false);
      return;
    }
    let cancelled = false;
    const from = dateStrip[0];
    const to = dateStrip[dateStrip.length - 1];
    setDaysOffLoading(true);
    void api
      .getProviderDaysOff(providerId, { from, to })
      .then((res) => {
        if (cancelled) return;
        const rows = Array.isArray(res.data) ? res.data : [];
        const map: DaysOffByDate = {};
        for (const row of rows) {
          const key = normalizeDayOffApiDate(row.date);
          if (key) map[key] = row.reason?.trim() || null;
        }
        setDaysOffByDate(map);
      })
      .catch(() => {
        if (!cancelled) setDaysOffByDate({});
      })
      .finally(() => {
        if (!cancelled) setDaysOffLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [providerId, isCompanyAnyProvider, dateStrip]);

  const isSelectedDateDayOff = isDateDayOff(daysOffByDate, selectedDate);
  const selectedDayOffReason = isSelectedDateDayOff
    ? daysOffByDate[selectedDate]
    : null;

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

    // No concrete provider → offer generic slots (admin assigns later).
    if (isCompanyAnyProvider || !providerId) {
      setSlots(generateGenericSlots());
      setSlotsLoading(false);
      return () => {
        cancelled = true;
      };
    }

    if (isDateDayOff(daysOffByDate, dateToFetch)) {
      setSlots([]);
      setSlotsLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setSlotsLoading(true);
    void api
      .getAvailableSlots(providerId, dateToFetch, duration)
      .then((res) => {
        if (cancelled) return;
        const list = normalizeSlotsResponse(res.data);
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
  }, [providerId, selectedDate, duration, isCompanyAnyProvider, daysOffByDate]);

  useEffect(() => {
    if (!selectedTime) return;
    const now = new Date();
    const selected = slots.find((slot) => slot.time === selectedTime);
    if (
      !selected ||
      selected.status === "reserved" ||
      isSlotStartInPast(selectedDate, selectedTime, now)
    ) {
      setSelectedTime(null);
    }
  }, [selectedDate, selectedTime, slots, nowCoarse]);

  // ── Formatted dates (unchanged logic) ────────────────────
  const formattedSectionDate = useMemo(() => {
    try {
      return parseYmd(selectedDate).toLocaleDateString(BOOKING_DATE_LOCALE, {
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
      const datePart = d.toLocaleDateString(BOOKING_DATE_LOCALE, {
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
    if (!hasLocationSet) {
      openLocationPicker();
      return;
    }
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
        providerId: providerId ?? undefined,
        companyId: companyId ?? undefined,
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
    companyId,
    providerName,
    serviceName,
    selectedDate,
    selectedTime,
    notes,
    photoUris,
    submitting,
    navigation,
    user?.id,
    clientLat,
    clientLng,
    hasLocationSet,
    openLocationPicker,
  ]);

  const onBottomBarPress = useCallback(() => {
    if (submitting) return;
    if (!hasLocationSet) {
      openLocationPicker();
      return;
    }
    if (!selectedTime) return;
    void onSubmit();
  }, [submitting, hasLocationSet, openLocationPicker, selectedTime, onSubmit]);

  // ── Derived ───────────────────────────────────────────────
  const selectedDateObj = useMemo(() => parseYmd(selectedDate), [selectedDate]);
  const nowForSlots = useMemo(() => new Date(nowCoarse), [nowCoarse]);
  const bookableSlotCount = useMemo(
    () =>
      slots.filter(
        (slot) =>
          slot.status === "available" &&
          !isSlotStartInPast(selectedDate, slot.time, nowForSlots),
      ).length,
    [slots, selectedDate, nowForSlots],
  );

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.root}>
        {/* ── Header ── */}
        <View style={s.header}>
          <View style={s.headerSide}>
            <TouchableOpacity
              style={s.headerIconBtn}
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="chevron-back" size={22} color="#1A1A2E" />
            </TouchableOpacity>
          </View>
          <View style={s.headerCenter}>
            <Text style={s.headerTitle}>Confirm Booking</Text>
          </View>
          <View style={s.headerSide} />
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
          {isCompanyAnyProvider ? (
            <View style={s.companyHint}>
              <Ionicons name="information-circle" size={16} color={C.accent} />
              <Text style={s.companyHintText}>
                {providerName} will assign an available provider for your chosen
                time.
              </Text>
            </View>
          ) : null}

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
            <View
              style={[
                s.locationCard,
                !hasLocationSet && !locationLoading && s.locationCardRequired,
              ]}
            >
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
                const isDayOff = isDateDayOff(daysOffByDate, ymd);
                const dow = isToday ? "Today" : WEEKDAY_SHORT[d.getDay()];
                const dom = d.getDate();
                const mon = MONTH_SHORT[d.getMonth()];

                return (
                  <TouchableOpacity
                    key={ymd}
                    onPress={() => setSelectedDate(ymd)}
                    style={[
                      s.dateCard,
                      isDayOff && !isSelected && s.dateCardDayOff,
                      isDayOff && isSelected && s.dateCardDayOffActive,
                      !isDayOff && isSelected && s.dateCardActive,
                    ]}
                    activeOpacity={0.82}
                  >
                    <View
                      style={[
                        s.dateCardBody,
                        isDayOff && s.dateCardBodyDayOff,
                      ]}
                    >
                      {isDayOff ? (
                        <Text
                          style={[
                            s.dateOffLabel,
                            isSelected && s.dateOffLabelActive,
                          ]}
                          numberOfLines={1}
                        >
                          Day off
                        </Text>
                      ) : null}
                      <Text
                        style={[
                          s.dateTop,
                          isDayOff && s.dateTopCompact,
                          isSelected && !isDayOff && s.dateTopActive,
                          isDayOff && !isSelected && s.dateTopDayOff,
                          isDayOff && isSelected && s.dateTopDayOffActive,
                        ]}
                      >
                        {dow}
                      </Text>
                      <Text
                        style={[
                          s.dateDay,
                          isDayOff && s.dateDayCompact,
                          isSelected && !isDayOff && s.dateDayActive,
                          isDayOff && !isSelected && s.dateDayDayOff,
                          isDayOff && isSelected && s.dateDayDayOffActive,
                        ]}
                      >
                        {dom}
                      </Text>
                      <Text
                        style={[
                          s.dateMonth,
                          isDayOff && s.dateMonthCompact,
                          isSelected && !isDayOff && s.dateMonthActive,
                          isDayOff && !isSelected && s.dateMonthDayOff,
                          isDayOff && isSelected && s.dateMonthDayOffActive,
                        ]}
                      >
                        {mon}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {!hasLocationSet && !locationLoading ? (
              <View style={s.locationRequiredBanner}>
                <Ionicons name="location-outline" size={16} color={C.accent} />
                <Text style={s.locationRequiredText}>
                  Set your location above before choosing a time slot.
                </Text>
              </View>
            ) : null}

            {/* ── Time slots grid ── */}
            {daysOffLoading && !isCompanyAnyProvider && providerId ? (
              <View style={s.slotsLoading}>
                <ActivityIndicator color={C.warning} size="small" />
                <Text style={s.slotsLoadingText}>Loading schedule…</Text>
              </View>
            ) : isSelectedDateDayOff ? (
              <View style={s.dayOffPanel}>
                <View style={s.dayOffIconWrap}>
                  <Ionicons
                    name="calendar-clear-outline"
                    size={28}
                    color={C.warning}
                  />
                </View>
                <Text style={s.dayOffTitle}>Provider day off</Text>
                <Text style={s.dayOffSub}>
                  {providerName} is not available on {formattedSectionDate}.
                </Text>
                {selectedDayOffReason ? (
                  <View style={s.dayOffReasonBox}>
                    <Text style={s.dayOffReasonLabel}>Reason</Text>
                    <Text style={s.dayOffReasonText}>
                      {selectedDayOffReason}
                    </Text>
                  </View>
                ) : (
                  <Text style={s.dayOffNoReason}>
                    No additional details were provided.
                  </Text>
                )}
                <Text style={s.dayOffHint}>
                  Please choose another date to continue booking.
                </Text>
              </View>
            ) : slotsLoading ? (
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
            ) : (
              <>
                {bookableSlotCount === 0 ? (
                  <Text style={s.slotsHint}>
                    {slots.some((slot) => slot.status === "reserved")
                      ? "All open times are reserved or in the past."
                      : "All remaining slots are in the past. Choose another date."}
                  </Text>
                ) : null}
                <View style={s.timeGrid}>
                  {slots.map((slot) => {
                    const { time: t, status } = slot;
                    const past = isSlotStartInPast(selectedDate, t, nowForSlots);
                    const reserved = status === "reserved";
                    const sel = t === selectedTime;
                    const disabled = past || reserved;
                    const blockedByLocation = !hasLocationSet;
                    return (
                      <TouchableOpacity
                        key={t}
                        style={[
                          s.timeSlot,
                          sel && s.timeSlotActive,
                          past && s.timeSlotDisabled,
                          reserved && s.timeSlotReserved,
                          blockedByLocation && s.timeSlotBlocked,
                        ]}
                        onPress={() => {
                          if (blockedByLocation) {
                            ensureLocationForBooking();
                            return;
                          }
                          if (!disabled) setSelectedTime(t);
                        }}
                        disabled={disabled}
                        activeOpacity={0.85}
                      >
                        <Text
                          style={[
                            s.timeSlotText,
                            sel && s.timeSlotTextActive,
                            past && s.timeSlotTextDisabled,
                            reserved && s.timeSlotTextReserved,
                          ]}
                        >
                          {t}
                        </Text>
                        {reserved ? (
                          <Text style={s.reservedTag}>Reserved</Text>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
          </View>

          {!isSelectedDateDayOff ? (
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
          ) : null}
        </ScrollView>

        {/* ── Bottom sticky bar ── */}
        <View
          style={[s.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}
        >
          <View style={s.bottomBarContent}>
            <TouchableOpacity
              style={[
                s.confirmButton,
                submitting && s.confirmButtonDisabled,
                !hasLocationSet && !submitting && s.confirmButtonLocation,
                hasLocationSet &&
                  !selectedTime &&
                  !submitting &&
                  s.confirmButtonDisabled,
              ]}
              onPress={onBottomBarPress}
              disabled={submitting}
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
                  <Ionicons
                    name={
                      !hasLocationSet && !selectedTime
                        ? "location-outline"
                        : "arrow-forward"
                    }
                    size={14}
                    color={C.white}
                  />
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
            <View style={s.pickerHeaderSide}>
              <TouchableOpacity
                onPress={() => setLocationPickerVisible(false)}
                style={s.pickerBack}
              >
                <Ionicons name="close" size={22} color={C.text} />
              </TouchableOpacity>
            </View>
            <Text style={s.pickerTitle}>Pick your location</Text>
            <View style={s.pickerHeaderSide} />
          </View>

          <View style={s.pickerMapWrap}>
            <WebView
              ref={pickerWebRef}
              style={s.pickerMap}
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
            <TouchableOpacity
              style={s.locateMeBtn}
              onPress={() => {
                void goToMyLocationOnMap();
              }}
              disabled={locatingOnMap}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Center map on my location"
            >
              {locatingOnMap ? (
                <ActivityIndicator size="small" color={C.accent} />
              ) : (
                <Ionicons name="locate" size={22} color={C.accent} />
              )}
            </TouchableOpacity>
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
  headerSide: {
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1A1A2E",
    textAlign: "center",
  },

  // ── Scroll ───────────────────────────────────────────────
  scroll: { flex: 1, backgroundColor: C.bg },
  scrollContent: { paddingBottom: 160 },

  // ── Company hint banner ──────────────────────────────────
  companyHint: {
    marginTop: 20,
    marginHorizontal: 20,
    padding: 12,
    borderRadius: 14,
    backgroundColor: C.accentBg,
    borderWidth: 1,
    borderColor: C.accentBorder,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  companyHintText: {
    flex: 1,
    fontSize: 12,
    color: C.accent,
    fontWeight: "600",
    lineHeight: 17,
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
  locationCardRequired: {
    borderColor: C.accentBorder,
    backgroundColor: C.accentBg,
  },
  locationRequiredBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: C.accentBg,
    borderWidth: 1,
    borderColor: C.accentBorder,
  },
  locationRequiredText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: C.accent,
    lineHeight: 17,
  },
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
    backgroundColor: C.accent,
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
    minHeight: 88,
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
    overflow: "hidden",
  },
  dateCardBody: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  dateCardBodyDayOff: {
    paddingVertical: 8,
    gap: 1,
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
  dateTopCompact: {
    marginBottom: 2,
    fontSize: 9,
  },
  dateTopActive: { color: C.white },
  dateDay: {
    fontSize: 22,
    fontWeight: "700",
    color: C.text,
  },
  dateDayCompact: {
    fontSize: 18,
    lineHeight: 22,
  },
  dateDayActive: { color: C.white },
  dateMonth: {
    fontSize: 10,
    color: C.textLight,
    fontWeight: "500",
    marginTop: 4,
  },
  dateMonthCompact: {
    marginTop: 2,
    fontSize: 9,
  },
  dateMonthActive: { color: C.white },
  dateCardDayOff: {
    backgroundColor: C.warningBg,
    borderColor: C.warningBorder,
    minHeight: 96,
  },
  dateCardDayOffActive: {
    backgroundColor: C.warning,
    borderColor: C.warning,
    shadowColor: C.warning,
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 4,
  },
  dateOffLabel: {
    fontSize: 8,
    fontWeight: "800",
    color: C.warning,
    letterSpacing: 0.3,
    textTransform: "uppercase",
    marginBottom: 3,
    maxWidth: "100%",
    textAlign: "center",
  },
  dateOffLabelActive: {
    color: "rgba(255,255,255,0.95)",
  },
  dateTopDayOff: { color: C.warning },
  dateTopDayOffActive: { color: "rgba(255,255,255,0.9)" },
  dateDayDayOff: { color: "#92400E" },
  dateDayDayOffActive: { color: C.white },
  dateMonthDayOff: { color: "#B45309" },
  dateMonthDayOffActive: { color: "rgba(255,255,255,0.85)" },
  dayOffPanel: {
    marginTop: 8,
    padding: 20,
    borderRadius: 16,
    backgroundColor: C.warningBg,
    borderWidth: 1,
    borderColor: C.warningBorder,
    alignItems: "center",
  },
  dayOffIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.white,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  dayOffTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#92400E",
    marginBottom: 6,
  },
  dayOffSub: {
    fontSize: 13,
    color: C.textSub,
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 14,
  },
  dayOffReasonBox: {
    width: "100%",
    padding: 12,
    borderRadius: 12,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.warningBorder,
    marginBottom: 10,
  },
  dayOffReasonLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: C.warning,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  dayOffReasonText: {
    fontSize: 14,
    color: C.text,
    lineHeight: 20,
    fontWeight: "500",
  },
  dayOffNoReason: {
    fontSize: 12,
    color: C.textLight,
    fontStyle: "italic",
    marginBottom: 10,
    textAlign: "center",
  },
  dayOffHint: {
    fontSize: 12,
    color: "#B45309",
    fontWeight: "600",
    textAlign: "center",
  },

  // ── Time slots grid ──────────────────────────────────────
  timeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  slotsHint: {
    fontSize: 12,
    color: C.textSub,
    fontWeight: "500",
    marginBottom: 10,
    lineHeight: 17,
  },
  timeSlot: {
    width: "30%" as unknown as number,
    minWidth: 92,
    paddingVertical: 11,
    paddingHorizontal: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.white,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
  },
  timeSlotReserved: {
    backgroundColor: "rgba(254, 226, 226, 0.72)",
    borderColor: "#FECACA",
  },
  timeSlotBlocked: {
    opacity: 0.45,
  },
  reservedTag: {
    marginTop: 3,
    fontSize: 9,
    fontWeight: "800",
    color: "#DC2626",
    letterSpacing: 0.4,
    textTransform: "uppercase",
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
  timeSlotTextReserved: {
    color: "#B91C1C",
    fontWeight: "600",
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
  confirmButtonLocation: {
    backgroundColor: C.accent,
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  pickerHeaderSide: {
    width: 38,
    alignItems: "center",
    justifyContent: "center",
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
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
    color: C.text,
    textAlign: "center",
  },
  pickerMapWrap: {
    flex: 1,
    position: "relative",
  },
  pickerMap: {
    flex: 1,
  },
  locateMeBtn: {
    position: "absolute",
    right: 16,
    bottom: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
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
    backgroundColor: C.accent,
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
