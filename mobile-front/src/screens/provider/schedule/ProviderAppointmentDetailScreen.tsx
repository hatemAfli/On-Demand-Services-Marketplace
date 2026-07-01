import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthNoticeModal, ConfirmModal } from "../../../components/common";
import { ProviderAppointmentDetailView } from "./ProviderAppointmentDetailView";
import type { ProviderStackParamList } from "../../../navigation/types";
import { useAuth } from "../../../context/AuthContext";
import {
  isAppointmentVisibleToEmployeeProvider,
  isEmployeeProvider,
} from "../../../utils/providerEmployment";
import { useAppointmentRealtime } from "../../../hooks/useAppointmentRealtime";
import { api, type AppointmentStatus } from "../../../services/api";
import {
  uploadAppointmentInterventionPhotos,
  type InterventionPhotoPhase,
} from "../../../services/appointmentInterventionPhotosUpload";
import i18n from "../../../i18n";
import { pickApiStringArray } from "../../../utils/parseApiStringArray";
import {
  type DaysOffByDate,
  type SlotPickerItem,
  formatYmd,
  isDateDayOff,
  isSameLocalCalendarDay,
  isSlotStartInPast,
  normalizeDayOffApiDate,
  normalizeSlotsResponse,
} from "../../../utils/appointmentSlots";

type Props = NativeStackScreenProps<
  ProviderStackParamList,
  "ProviderAppointmentDetail"
>;

type ProviderAppointmentNoticeModal = {
  title: string;
  message: string;
  primaryLabel: string;
  onPrimary?: () => void;
} | null;

type TranslationRow = { locale: string; name: string };
type ConfirmationRow = { role: string; type: string };

const MAX_INTERVENTION_PHOTOS = 10;

const ACCENT = "#EA580C";
const ACCENT_DARK = "#C2410C";
const ACCENT_LIGHT = "#FFF7ED";
const ACCENT_BORDER = "#FFEDD5";
const SCREEN_BG = "#F1F5F9";

type ProviderAppointmentDetailModel = {
  id: string;
  status: string;
  scheduledDate: string;
  scheduledTime: string;
  notes: string | null;
  photoUrls: string[];
  refusalReason: string | null;
  rescheduleDate: string | null;
  rescheduleTime: string | null;
  createdAt: string | null;
  confirmedAt: string | null;
  enRouteAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMinutes: number | null;
  beforePhotoUrls: string[];
  afterPhotoUrls: string[];
  cancellationReason: string | null;
  latitude: number | null;
  longitude: number | null;
  givenService: {
    serviceName: string;
    categoryName: string;
    price: number;
    pricingType: string;
    estimatedDurationMinutes: number | null;
  };
  client: { firstName: string; lastName: string; imageUrl: string | null };
  confirmations: ConfirmationRow[];
};

function pickName(translations: TranslationRow[] | undefined): string {
  if (!translations?.length) return "";
  const preferAr = i18n.language?.startsWith("ar");
  const loc = preferAr ? "AR" : "EN";
  return (
    translations.find((t) => t.locale === loc)?.name ??
    translations.find((t) => t.locale === "EN")?.name ??
    translations[0]?.name ??
    ""
  );
}

function toIsoString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function normalizeDateKey(v: unknown): string {
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  return "";
}

function parseConfirmations(raw: unknown): ConfirmationRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((x) => ({ role: String(x.role ?? ""), type: String(x.type ?? "") }));
}

function parseAppointment(raw: unknown): ProviderAppointmentDetailModel | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = r.id;
  if (typeof id !== "string") return null;
  const status = typeof r.status === "string" ? r.status : "UNKNOWN";
  let serviceName = "";
  let categoryName = "";
  let price = 0;
  let pricingType = "";
  let estimatedDurationMinutes: number | null = null;
  const gs = r.givenService;
  if (gs && typeof gs === "object") {
    const g = gs as Record<string, unknown>;
    if (typeof g.price === "number") price = g.price;
    if (typeof g.pricingType === "string") pricingType = g.pricingType;
    if (g.estimatedDurationMinutes != null) {
      estimatedDurationMinutes = Number(g.estimatedDurationMinutes);
    }
    const svc = g.service;
    if (svc && typeof svc === "object") {
      const s = svc as Record<string, unknown>;
      serviceName = pickName(s.translations as TranslationRow[] | undefined);
      const cat = s.category as Record<string, unknown> | undefined;
      if (cat && typeof cat === "object") {
        categoryName = pickName(
          cat.translations as TranslationRow[] | undefined,
        );
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
    scheduledDate: normalizeDateKey(r.scheduledDate),
    scheduledTime: typeof r.scheduledTime === "string" ? r.scheduledTime : "",
    notes: typeof r.notes === "string" ? r.notes : null,
    photoUrls: pickApiStringArray(r, "photoUrls", "photo_urls"),
    refusalReason: typeof r.refusalReason === "string" ? r.refusalReason : null,
    rescheduleDate: r.rescheduleDate
      ? normalizeDateKey(r.rescheduleDate)
      : null,
    rescheduleTime:
      typeof r.rescheduleTime === "string" ? r.rescheduleTime : null,
    createdAt: toIsoString(r.createdAt),
    confirmedAt: toIsoString(r.confirmedAt),
    enRouteAt: toIsoString(r.enRouteAt),
    startedAt: toIsoString(r.startedAt),
    completedAt: toIsoString(r.completedAt),
    durationMinutes:
      typeof r.durationMinutes === "number" ? r.durationMinutes : null,
    beforePhotoUrls: pickApiStringArray(
      r,
      "beforePhotoUrls",
      "before_photo_urls",
    ),
    afterPhotoUrls: pickApiStringArray(r, "afterPhotoUrls", "after_photo_urls"),
    cancellationReason:
      typeof r.cancellationReason === "string" ? r.cancellationReason : null,
    latitude: typeof r.latitude === "number" ? r.latitude : null,
    longitude: typeof r.longitude === "number" ? r.longitude : null,
    givenService: {
      serviceName: serviceName || "Service",
      categoryName: categoryName || "Category",
      price,
      pricingType,
      estimatedDurationMinutes,
    },
    client: { firstName, lastName, imageUrl },
    confirmations: parseConfirmations(r.confirmations),
  };
}

function clientInitials(first: string, last: string): string {
  const a = first.trim().charAt(0).toUpperCase();
  const b = last.trim().charAt(0).toUpperCase();
  if (a && b) return `${a}${b}`;
  return (a || b || "?").slice(0, 2);
}

function parseYmdLocal(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function combineLocalDateTime(dateYmd: string, timeHm: string): Date {
  const [y, mo, d] = dateYmd.split("-").map(Number);
  const parts = timeHm.split(":");
  const hh = Number(parts[0]) || 0;
  const mm = Number(parts[1]) || 0;
  return new Date(y, (mo || 1) - 1, d || 1, hh, mm, 0, 0);
}

/** True when the booked start time is strictly before now (pending slot expired). */
function isScheduledSlotPast(scheduledDate: string, scheduledTime: string): boolean {
  if (!scheduledDate || !scheduledTime) return false;
  try {
    return combineLocalDateTime(scheduledDate, scheduledTime).getTime() < Date.now();
  } catch {
    return false;
  }
}

function formatBookingDateTime(
  scheduledDate: string,
  scheduledTime: string,
): string {
  try {
    const d = parseYmdLocal(scheduledDate);
    const day = d.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    return `${day} · ${scheduledTime}`;
  } catch {
    return `${scheduledDate} · ${scheduledTime}`;
  }
}

function formatLongDate(ymd: string | null): string {
  if (!ymd) return "";
  try {
    return parseYmdLocal(ymd).toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return ymd;
  }
}

function formatRescheduleDetail(
  rescheduleDate: string | null,
  rescheduleTime: string | null,
): string {
  if (!rescheduleDate || !rescheduleTime) return "";
  return `${formatLongDate(rescheduleDate)} at ${rescheduleTime}`;
}

function formatTimeOnly(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function toYyyyMmDd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

function hasConfirmation(
  confirmations: ConfirmationRow[],
  role: string,
  type: string,
) {
  return confirmations.some((c) => c.role === role && c.type === type);
}

const RESCHEDULE_DATE_STRIP_DAYS = 45;
const RESCHEDULE_WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const RESCHEDULE_MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function statusBannerMeta(status: string): {
  bg: string;
  border: string;
  text: string;
  icon: keyof typeof Ionicons.glyphMap;
} {
  switch (status) {
    case "PENDING":
      return {
        bg: "#FFFBEB",
        border: "#FDE68A",
        text: "#B45309",
        icon: "hourglass-outline",
      };
    case "CONFIRMED":
      return {
        bg: "#F0F9FF",
        border: "#BAE6FD",
        text: "#0369A1",
        icon: "checkmark-circle-outline",
      };
    case "RESCHEDULED":
      return {
        bg: "#FFF7ED",
        border: "#FED7AA",
        text: "#C2410C",
        icon: "calendar-outline",
      };
    case "EN_ROUTE":
      return {
        bg: "#F0F9FF",
        border: "#BAE6FD",
        text: "#0369A1",
        icon: "car-outline",
      };
    case "IN_PROGRESS":
      return {
        bg: ACCENT_LIGHT,
        border: ACCENT_BORDER,
        text: ACCENT_DARK,
        icon: "construct-outline",
      };
    case "COMPLETED":
      return {
        bg: "#ECFDF5",
        border: "#A7F3D0",
        text: "#047857",
        icon: "checkmark-done-outline",
      };
    case "REFUSED":
      return {
        bg: "#FEF2F2",
        border: "#FECACA",
        text: "#DC2626",
        icon: "close-circle-outline",
      };
    case "CANCELLED_CLIENT":
    case "CANCELLED_PROVIDER":
      return {
        bg: "#F8FAFC",
        border: "#E2E8F0",
        text: "#64748B",
        icon: "ban-outline",
      };
    default:
      return {
        bg: "#F8FAFC",
        border: "#E2E8F0",
        text: "#64748B",
        icon: "ellipse-outline",
      };
  }
}

function statusDisplayLabel(status: string): string {
  switch (status) {
    case "PENDING":
      return "Awaiting response";
    case "CONFIRMED":
      return "Confirmed";
    case "EN_ROUTE":
      return "En route";
    case "IN_PROGRESS":
      return "In progress";
    case "COMPLETED":
      return "Completed";
    case "REFUSED":
      return "Refused";
    case "CANCELLED_CLIENT":
      return "Cancelled by client";
    case "CANCELLED_PROVIDER":
      return "Cancelled by you";
    case "RESCHEDULED":
      return "Reschedule proposed";
    default:
      return status.replace(/_/g, " ");
  }
}

const STATUS_STEPS: { key: AppointmentStatus; label: string }[] = [
  { key: "PENDING", label: "Order Sent" },
  { key: "CONFIRMED", label: "Confirmed" },
  { key: "EN_ROUTE", label: "On the way" },
  { key: "IN_PROGRESS", label: "Service Started" },
  { key: "COMPLETED", label: "Completed" },
];

const STATUS_ORDER: AppointmentStatus[] = [
  "PENDING",
  "CONFIRMED",
  "EN_ROUTE",
  "IN_PROGRESS",
  "COMPLETED",
];

function timelineStatusKey(status: string): AppointmentStatus {
  if (status === "RESCHEDULED") return "CONFIRMED";
  if (STATUS_ORDER.includes(status as AppointmentStatus)) {
    return status as AppointmentStatus;
  }
  return "PENDING";
}

type TimelineProgress = {
  doneThrough: number;
  activeIdx: number;
};

function getTimelineProgress(status: string): TimelineProgress {
  const idx = STATUS_ORDER.indexOf(timelineStatusKey(status));
  const lastIdx = STATUS_STEPS.length - 1;

  if (idx < 0) {
    return { doneThrough: -1, activeIdx: 0 };
  }

  if (idx >= lastIdx) {
    return { doneThrough: lastIdx, activeIdx: -1 };
  }

  return { doneThrough: idx, activeIdx: idx + 1 };
}

function getStepState(
  stepIdx: number,
  { doneThrough, activeIdx }: TimelineProgress,
): "done" | "active" | "pending" {
  if (stepIdx <= doneThrough) return "done";
  if (activeIdx >= 0 && stepIdx === activeIdx) return "active";
  return "pending";
}

type TimelineTimestamps = {
  createdAt: string | null;
  confirmedAt: string | null;
  enRouteAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
};

function getTimelineStepMeta(
  stepKey: AppointmentStatus,
  state: "done" | "active" | "pending",
  status: string,
  times: TimelineTimestamps,
): string | null {
  switch (stepKey) {
    case "PENDING":
      return times.createdAt
        ? `Sent at ${formatDateTime(times.createdAt)}`
        : null;
    case "CONFIRMED":
      if (state === "active" && status === "PENDING") {
        return "Awaiting your response";
      }
      return times.confirmedAt && state !== "pending"
        ? `Confirmed at ${formatDateTime(times.confirmedAt)}`
        : null;
    case "EN_ROUTE":
      return times.enRouteAt && state !== "pending"
        ? `Departed at ${formatDateTime(times.enRouteAt)}`
        : null;
    case "IN_PROGRESS":
      return times.startedAt && state !== "pending"
        ? `Started at ${formatDateTime(times.startedAt)}`
        : null;
    case "COMPLETED":
      return times.completedAt && status === "COMPLETED"
        ? `Completed at ${formatDateTime(times.completedAt)}`
        : null;
    default:
      return null;
  }
}

const TIMELINE_HEIGHT = 220;

const detailUi = StyleSheet.create({
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  sectionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: ACCENT_LIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#94A3B8",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F8FAFC",
  },
  detailRowIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  detailRowLabel: {
    fontSize: 12,
    color: "#94A3B8",
    width: 72,
  },
  detailRowValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#1E293B",
    textAlign: "right",
  },
  timelineWrap: {
    position: "relative",
    paddingVertical: 4,
    minHeight: TIMELINE_HEIGHT,
  },
  timelineTrack: {
    position: "absolute",
    left: 10,
    top: 12,
    bottom: 12,
    width: 2,
    backgroundColor: "#F1F5F9",
    borderRadius: 1,
  },
  timelineProgress: {
    position: "absolute",
    left: 10,
    top: 12,
    width: 2,
    backgroundColor: "#34D399",
    borderRadius: 1,
  },
  timelineSteps: { gap: 20 },
  timelineStep: { flexDirection: "row", alignItems: "center", gap: 14 },
  timelineDotDone: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
  },
  timelineDotActive: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#34D399",
    alignItems: "center",
    justifyContent: "center",
  },
  timelineDotActiveInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FFFFFF",
  },
  timelineDotPending: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#E2E8F0",
  },
  timelineStepTextWrap: { flex: 1 },
  timelineStepDone: {},
  timelineStepLabel: { fontSize: 14, fontWeight: "600", color: "#64748B" },
  timelineStepLabelActive: { fontWeight: "800", color: "#0F172A" },
  timelineStepLabelPending: { fontWeight: "500", color: "#94A3B8" },
  timelineStepLabelDone: {
    fontWeight: "600",
    color: "#64748B",
  },
  timelineStepMeta: {
    fontSize: 11,
    fontWeight: "600",
    color: "#10B981",
    marginTop: 2,
  },
});

function SectionHeader({
  icon,
  title,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
}) {
  return (
    <View style={detailUi.sectionHeader}>
      <View style={detailUi.sectionIconWrap}>
        <Ionicons name={icon} size={15} color={ACCENT} />
      </View>
      <Text style={detailUi.sectionTitle}>{title}</Text>
    </View>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={detailUi.detailRow}>
      <View style={detailUi.detailRowIcon}>
        <Ionicons name={icon} size={16} color="#94A3B8" />
      </View>
      <Text style={detailUi.detailRowLabel}>{label}</Text>
      <Text style={detailUi.detailRowValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function StatusTimeline({
  status,
  timestamps,
}: {
  status: string;
  timestamps: TimelineTimestamps;
}) {
  const progress = getTimelineProgress(status);
  const totalSegments = STATUS_STEPS.length - 1;
  const lineTargetIdx =
    progress.activeIdx >= 0 ? progress.activeIdx : progress.doneThrough;
  const progressHeight =
    totalSegments > 0
      ? Math.max(
          0,
          Math.min(
            TIMELINE_HEIGHT - 24,
            (lineTargetIdx / totalSegments) * (TIMELINE_HEIGHT - 24),
          ),
        )
      : 0;

  return (
    <View style={detailUi.timelineWrap}>
      <View style={detailUi.timelineTrack} />
      <View style={[detailUi.timelineProgress, { height: progressHeight }]} />
      <View style={detailUi.timelineSteps}>
        {STATUS_STEPS.map((step, stepIdx) => {
          const state = getStepState(stepIdx, progress);
          const stepMeta = getTimelineStepMeta(
            step.key,
            state,
            status,
            timestamps,
          );
          return (
            <View key={step.key} style={detailUi.timelineStep}>
              {state === "done" ? (
                <View style={detailUi.timelineDotDone}>
                  <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                </View>
              ) : null}
              {state === "active" ? (
                <View style={detailUi.timelineDotActive}>
                  <View style={detailUi.timelineDotActiveInner} />
                </View>
              ) : null}
              {state === "pending" ? (
                <View style={detailUi.timelineDotPending} />
              ) : null}
              <View
                style={[
                  detailUi.timelineStepTextWrap,
                  state === "done" && detailUi.timelineStepDone,
                ]}
              >
                <Text
                  style={[
                    detailUi.timelineStepLabel,
                    state === "active" && detailUi.timelineStepLabelActive,
                    state === "pending" && detailUi.timelineStepLabelPending,
                    state === "done" && detailUi.timelineStepLabelDone,
                  ]}
                >
                  {step.label}
                </Text>
                {stepMeta ? (
                  <Text style={detailUi.timelineStepMeta}>{stepMeta}</Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function PhotoRow({
  uris,
  onAdd,
  label,
  disabled,
}: {
  uris: string[];
  onAdd: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <View style={styles.photoRowWrap}>
      <Text style={styles.photoRowLabel}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.photoRowScroll}
      >
        {uris.map((uri) => (
          <Image key={uri} source={{ uri }} style={styles.photoThumb} />
        ))}
        <TouchableOpacity
          style={styles.addPhotoBtn}
          onPress={onAdd}
          disabled={disabled}
          activeOpacity={0.8}
        >
          <Ionicons name="camera-outline" size={20} color={ACCENT} />
          <Text style={styles.addPhotoLabel}>Add</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

export const ProviderAppointmentDetailScreen: React.FC<Props> = ({
  navigation,
  route,
}) => {
  const { appointmentId } = route.params;
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isEmployee = isEmployeeProvider(user);

  const [appointment, setAppointment] =
    useState<ProviderAppointmentDetailModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusRefreshing, setStatusRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [refuseMode, setRefuseMode] = useState(false);
  const [refusalReason, setRefusalReason] = useState("");
  const [refusalError, setRefusalError] = useState("");
  const [rescheduleSheetVisible, setRescheduleSheetVisible] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [rescheduleDateKey, setRescheduleDateKey] = useState(() =>
    toYyyyMmDd(addDays(new Date(), 1)),
  );
  const [selectedRescheduleTime, setSelectedRescheduleTime] = useState<
    string | null
  >(null);
  const [rescheduleSlots, setRescheduleSlots] = useState<SlotPickerItem[]>([]);
  const [rescheduleSlotsLoading, setRescheduleSlotsLoading] = useState(false);
  const [rescheduleDaysOffByDate, setRescheduleDaysOffByDate] =
    useState<DaysOffByDate>({});
  const [rescheduleDaysOffLoading, setRescheduleDaysOffLoading] =
    useState(false);
  const [rescheduleNowCoarse, setRescheduleNowCoarse] = useState(() =>
    Date.now(),
  );
  const [beforeLocalUris, setBeforeLocalUris] = useState<string[]>([]);
  const [afterLocalUris, setAfterLocalUris] = useState<string[]>([]);
  const [noticeModal, setNoticeModal] =
    useState<ProviderAppointmentNoticeModal>(null);
  const [confirmCancelVisible, setConfirmCancelVisible] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [pendingClockTick, setPendingClockTick] = useState(0);

  const loadAppointment = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (opts?.silent) {
        setStatusRefreshing(true);
      } else {
        setLoading(true);
      }
      try {
        const res = await api.getAppointmentById(appointmentId);
        const parsed = parseAppointment(res.data);
        if (
          isEmployee &&
          parsed &&
          !isAppointmentVisibleToEmployeeProvider(parsed.status)
        ) {
          setAppointment(null);
          setNoticeModal({
            title: "Not available yet",
            message:
              "This booking is still pending company approval. Your admin will confirm it before you can view or start the job.",
            primaryLabel: "OK",
            onPrimary: () => navigation.goBack(),
          });
          return;
        }
        setAppointment(parsed);
      } catch {
        if (!opts?.silent) {
          setAppointment(null);
          setNoticeModal({
            title: "Error",
            message: "Could not load this appointment.",
            primaryLabel: "OK",
            onPrimary: () => navigation.goBack(),
          });
        }
      } finally {
        if (opts?.silent) {
          setStatusRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [appointmentId, navigation, isEmployee],
  );

  useEffect(() => {
    void loadAppointment();
  }, [loadAppointment]);

  useAppointmentRealtime(
    appointmentId,
    useCallback(
      (raw) => {
        const parsed = parseAppointment(raw);
        if (!parsed) return;
        if (
          isEmployee &&
          !isAppointmentVisibleToEmployeeProvider(parsed.status)
        ) {
          setAppointment(null);
          setNoticeModal({
            title: "Not available yet",
            message:
              "This booking is still pending company approval. Your admin will confirm it before you can view or start the job.",
            primaryLabel: "OK",
            onPrimary: () => navigation.goBack(),
          });
          return;
        }
        setAppointment(parsed);
      },
      [isEmployee, navigation],
    ),
  );

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    if (
      !appointment ||
      appointment.status !== "IN_PROGRESS" ||
      !appointment.startedAt
    ) {
      setElapsedSeconds(0);
      return;
    }
    const started = new Date(appointment.startedAt).getTime();
    const tick = () =>
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - started) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [appointment?.status, appointment?.startedAt, appointment?.id]);

  const waitingClientEnd = useMemo(() => {
    if (!appointment || appointment.status !== "IN_PROGRESS") return false;
    return hasConfirmation(appointment.confirmations, "PROVIDER", "END");
  }, [appointment]);

  const waitingClientStart = useMemo(() => {
    if (!appointment || appointment.status !== "IN_PROGRESS") return false;
    if (appointment.startedAt) return false;
    return (
      hasConfirmation(appointment.confirmations, "PROVIDER", "START") &&
      !hasConfirmation(appointment.confirmations, "CLIENT", "START")
    );
  }, [appointment]);

  const pendingSlotPassed = useMemo(() => {
    if (!appointment || appointment.status !== "PENDING") return false;
    return isScheduledSlotPast(
      appointment.scheduledDate,
      appointment.scheduledTime,
    );
  }, [appointment, pendingClockTick]);

  useEffect(() => {
    if (appointment?.status !== "PENDING") return;
    const id = setInterval(() => setPendingClockTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, [appointment?.status]);

  useEffect(() => {
    if (pendingSlotPassed) {
      setRefuseMode(false);
      setRefusalReason("");
      setRefusalError("");
    }
  }, [pendingSlotPassed]);

  const showTimerPhase = useMemo(() => {
    if (!appointment || appointment.status !== "IN_PROGRESS") return false;
    return !!appointment.startedAt && !waitingClientEnd;
  }, [appointment, waitingClientEnd]);

  const rescheduleDuration = useMemo(
    () =>
      Math.max(
        1,
        appointment?.givenService.estimatedDurationMinutes ?? 60,
      ),
    [appointment?.givenService.estimatedDurationMinutes],
  );

  const rescheduleDateStrip = useMemo(() => {
    const start = new Date();
    start.setHours(12, 0, 0, 0);
    const firstOffset = pendingSlotPassed ? 0 : 1;
    return Array.from({ length: RESCHEDULE_DATE_STRIP_DAYS }, (_, i) =>
      formatYmd(addDays(start, i + firstOffset)),
    );
  }, [pendingSlotPassed]);

  const rescheduleSelectedDayOff = isDateDayOff(
    rescheduleDaysOffByDate,
    rescheduleDateKey,
  );
  const rescheduleSelectedDayOffReason = rescheduleSelectedDayOff
    ? rescheduleDaysOffByDate[rescheduleDateKey]
    : null;

  const rescheduleSelectableSlots = useMemo(() => {
    const now = new Date(rescheduleNowCoarse);
    return rescheduleSlots.filter(
      (slot) =>
        slot.status === "available" &&
        !isSlotStartInPast(rescheduleDateKey, slot.time, now),
    );
  }, [rescheduleSlots, rescheduleDateKey, rescheduleNowCoarse]);

  const canSendReschedule =
    !!selectedRescheduleTime &&
    rescheduleSelectableSlots.some((s) => s.time === selectedRescheduleTime);

  useEffect(() => {
    if (!rescheduleSheetVisible) return;
    setSelectedRescheduleTime(null);
  }, [rescheduleDateKey, rescheduleSheetVisible]);

  useEffect(() => {
    if (!rescheduleSheetVisible || !user?.id) return;
    const from = rescheduleDateStrip[0];
    const to = rescheduleDateStrip[rescheduleDateStrip.length - 1];
    let cancelled = false;
    setRescheduleDaysOffLoading(true);
    void api
      .getMyDaysOff(from, to)
      .then((res) => {
        if (cancelled) return;
        const rows = Array.isArray(res.data) ? res.data : [];
        const map: DaysOffByDate = {};
        for (const row of rows) {
          const key = normalizeDayOffApiDate(row.date);
          if (key) map[key] = row.reason?.trim() || null;
        }
        setRescheduleDaysOffByDate(map);
      })
      .catch(() => {
        if (!cancelled) setRescheduleDaysOffByDate({});
      })
      .finally(() => {
        if (!cancelled) setRescheduleDaysOffLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [rescheduleSheetVisible, user?.id, rescheduleDateStrip]);

  useEffect(() => {
    if (!rescheduleSheetVisible || !user?.id) return;
    if (isDateDayOff(rescheduleDaysOffByDate, rescheduleDateKey)) {
      setRescheduleSlots([]);
      setRescheduleSlotsLoading(false);
      return;
    }
    let cancelled = false;
    setRescheduleSlotsLoading(true);
    void api
      .getMyProviderDaySlots(
        rescheduleDateKey,
        rescheduleDuration,
        appointmentId,
      )
      .then((res) => {
        if (cancelled) return;
        setRescheduleSlots(normalizeSlotsResponse(res.data));
      })
      .catch(() => {
        if (!cancelled) setRescheduleSlots([]);
      })
      .finally(() => {
        if (!cancelled) setRescheduleSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    rescheduleSheetVisible,
    user?.id,
    rescheduleDateKey,
    rescheduleDuration,
    appointmentId,
    rescheduleDaysOffByDate,
  ]);

  useEffect(() => {
    if (!rescheduleSheetVisible) return;
    if (!isSameLocalCalendarDay(rescheduleDateKey, new Date())) return;
    setRescheduleNowCoarse(Date.now());
    const id = setInterval(() => setRescheduleNowCoarse(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [rescheduleSheetVisible, rescheduleDateKey]);

  useEffect(() => {
    if (!selectedRescheduleTime) return;
    const now = new Date(rescheduleNowCoarse);
    const selected = rescheduleSlots.find(
      (s) => s.time === selectedRescheduleTime,
    );
    if (
      !selected ||
      selected.status === "reserved" ||
      isSlotStartInPast(rescheduleDateKey, selectedRescheduleTime, now)
    ) {
      setSelectedRescheduleTime(null);
    }
  }, [
    selectedRescheduleTime,
    rescheduleSlots,
    rescheduleDateKey,
    rescheduleNowCoarse,
  ]);

  const runAction = useCallback(
    async (
      fn: () => Promise<unknown>,
      opts?: { onSuccess?: () => void },
    ) => {
      setActionLoading(true);
      try {
        await fn();
        await loadAppointment({ silent: true });
        setRefuseMode(false);
        setRefusalReason("");
        setRefusalError("");
        setRescheduleSheetVisible(false);
        setShowCompletion(false);
        setBeforeLocalUris([]);
        setAfterLocalUris([]);
        opts?.onSuccess?.();
      } catch (e: unknown) {
        let msg = "";
        if (e && typeof e === "object" && "response" in e) {
          const data = (e as { response?: { data?: unknown } }).response?.data;
          if (data && typeof data === "object" && "message" in data) {
            const m = (data as { message: unknown }).message;
            if (typeof m === "string") msg = m;
            else if (Array.isArray(m)) msg = m.map(String).join(", ");
          }
        }
        setNoticeModal({
          title: "Error",
          message: msg || "Something went wrong. Please try again.",
          primaryLabel: "OK",
        });
      } finally {
        setActionLoading(false);
      }
    },
    [loadAppointment],
  );

  const onAccept = () => {
    if (pendingSlotPassed) {
      setNoticeModal({
        title: "Time has passed",
        message:
          "You can no longer accept this request at the original time. Propose a new time instead.",
        primaryLabel: "OK",
      });
      return;
    }
    void runAction(() =>
      api.providerRespond(appointmentId, { action: "CONFIRMED" }),
    );
  };

  const onRefuseSubmit = () => {
    if (pendingSlotPassed) {
      setNoticeModal({
        title: "Time has passed",
        message:
          "You can no longer refuse this request at the original time. Propose a new time instead.",
        primaryLabel: "OK",
      });
      return;
    }
    const reason = refusalReason.trim();
    if (!reason) {
      setRefusalError("Please enter a reason for refusal.");
      return;
    }
    setRefusalError("");
    void runAction(() =>
      api.providerRespond(appointmentId, {
        action: "REFUSED",
        refusalReason: reason,
      }),
    );
  };

  const openRescheduleSheet = () => {
    const defaultDate =
      rescheduleDateStrip[0] ?? formatYmd(addDays(new Date(), 1));
    setRescheduleDateKey(defaultDate);
    setSelectedRescheduleTime(null);
    setRescheduleNowCoarse(Date.now());
    setRescheduleSheetVisible(true);
  };

  const onProposeReschedule = () => {
    if (!selectedRescheduleTime || !canSendReschedule) {
      setNoticeModal({
        title: "Select a time",
        message:
          "Choose an available slot from your calendar. Reserved and past times cannot be selected.",
        primaryLabel: "OK",
      });
      return;
    }
    void runAction(() =>
      api.providerRespond(appointmentId, {
        action: "RESCHEDULED",
        rescheduleDate: rescheduleDateKey,
        rescheduleTime: selectedRescheduleTime,
      }),
    );
  };

  const onMarkEnRoute = () =>
    void runAction(() =>
      api.recordExecution(appointmentId, { action: "EN_ROUTE" }),
    );

  const onCancelConfirmed = () => setConfirmCancelVisible(true);

  const pickPhoto = async (target: "before" | "after") => {
    const currentLen =
      target === "before" ? beforeLocalUris.length : afterLocalUris.length;
    const remaining = MAX_INTERVENTION_PHOTOS - currentLen;
    if (remaining <= 0) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      setNoticeModal({
        title: "Permission needed",
        message: "Photo library access is required.",
        primaryLabel: "OK",
      });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: remaining,
    });
    if (result.canceled || !result.assets?.length) return;
    const picked = result.assets.map((a) => a.uri).filter(Boolean);
    const merge = (prev: string[]) =>
      [...prev, ...picked].slice(0, MAX_INTERVENTION_PHOTOS);
    if (target === "before") setBeforeLocalUris(merge);
    else setAfterLocalUris(merge);
  };

  const uploadLocals = async (
    uris: string[],
    phase: InterventionPhotoPhase,
  ): Promise<string[]> => {
    const providerId = user?.id;
    if (!providerId) throw new Error("Not signed in");
    return uploadAppointmentInterventionPhotos(
      providerId,
      appointmentId,
      phase,
      uris,
    );
  };

  const onStartService = () =>
    void runAction(async () => {
      const photoUrls =
        beforeLocalUris.length > 0
          ? await uploadLocals(beforeLocalUris, "before")
          : undefined;
      await api.recordExecution(appointmentId, {
        action: "START",
        ...(photoUrls?.length ? { photoUrls } : {}),
      });
    });

  const onEndService = () =>
    void runAction(async () => {
      const photoUrls =
        afterLocalUris.length > 0
          ? await uploadLocals(afterLocalUris, "after")
          : undefined;
      await api.recordExecution(appointmentId, {
        action: "END",
        ...(photoUrls?.length ? { photoUrls } : {}),
      });
    });

  if (loading || !appointment) {
    return (
      <View style={styles.loadingRoot}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  const banner = statusBannerMeta(appointment.status);
  const clientName =
    `${appointment.client.firstName} ${appointment.client.lastName}`.trim() ||
    "Client";

  const priceLabel =
    appointment.givenService.pricingType === "HOURLY"
      ? `$${appointment.givenService.price} / hr`
      : `$${appointment.givenService.price}`;

  const appointmentRef = `Job #${appointment.id.replace(/-/g, "").slice(0, 5).toUpperCase()}`;

  return (
    <View style={styles.root}>
      <ProviderAppointmentDetailView
        navigation={navigation}
        insetsTop={insets.top}
        insetsBottom={insets.bottom}
        appointment={appointment}
        appointmentRef={appointmentRef}
        statusLabel={statusDisplayLabel(appointment.status)}
        statusPillColor={banner.text}
        clientName={clientName}
        priceLabel={priceLabel}
        isEmployee={isEmployee}
        actionLoading={actionLoading}
        statusRefreshing={statusRefreshing}
        refuseMode={refuseMode}
        refusalReason={refusalReason}
        refusalError={refusalError}
        pendingSlotPassed={pendingSlotPassed}
        waitingClientStart={waitingClientStart}
        waitingClientEnd={waitingClientEnd}
        showTimerPhase={showTimerPhase}
        elapsedSeconds={elapsedSeconds}
        beforeLocalUris={beforeLocalUris}
        afterLocalUris={afterLocalUris}
        maxInterventionPhotos={MAX_INTERVENTION_PHOTOS}
        showCompletion={showCompletion}
        formatBookingDateTime={formatBookingDateTime}
        formatLongDate={formatLongDate}
        formatRescheduleDetail={formatRescheduleDetail}
        onBack={() => navigation.goBack()}
        onAccept={onAccept}
        onRefuseMode={() => setRefuseMode(true)}
        onRefuseCancel={() => {
          setRefuseMode(false);
          setRefusalReason("");
          setRefusalError("");
        }}
        onRefusalReasonChange={(text) => {
          setRefusalReason(text);
          if (refusalError) setRefusalError("");
        }}
        onRefuseSubmit={onRefuseSubmit}
        onOpenReschedule={openRescheduleSheet}
        onMarkEnRoute={onMarkEnRoute}
        onCancelConfirmed={onCancelConfirmed}
        onStartService={onStartService}
        onOpenCompletion={() => setShowCompletion(true)}
        onCloseCompletion={() => !actionLoading && setShowCompletion(false)}
        onEndService={onEndService}
        onPickBeforePhoto={() => void pickPhoto("before")}
        onPickAfterPhoto={() => void pickPhoto("after")}
        onRemoveBeforePhoto={(uri) =>
          setBeforeLocalUris((prev) => prev.filter((u) => u !== uri))
        }
        onRemoveAfterPhoto={(uri) =>
          setAfterLocalUris((prev) => prev.filter((u) => u !== uri))
        }
      />

      <Modal
        visible={rescheduleSheetVisible}
        animationType="slide"
        transparent
        onRequestClose={() =>
          !actionLoading && setRescheduleSheetVisible(false)
        }
      >
        <View style={sheetStyles.modalRoot}>
          <Pressable
            style={sheetStyles.sheetBackdrop}
            onPress={() => !actionLoading && setRescheduleSheetVisible(false)}
          />
          <View
            style={[
              sheetStyles.sheetCard,
              { paddingBottom: Math.max(insets.bottom, 24) },
            ]}
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={sheetStyles.sheetHandleRow}>
                <View style={sheetStyles.sheetHandle} />
              </View>

              <View style={sheetStyles.sheetHeaderRow}>
                <View style={sheetStyles.sheetHeaderIcon}>
                  <Ionicons name="calendar-outline" size={20} color={ACCENT} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={sheetStyles.sheetTitle}>Propose New Time</Text>
                  <Text style={sheetStyles.sheetDesc}>
                    Dates and times follow your real availability. Reserved
                    slots are already booked.
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() =>
                    !actionLoading && setRescheduleSheetVisible(false)
                  }
                  hitSlop={12}
                >
                  <Ionicons name="close" size={22} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <Text style={sheetStyles.sheetSub}>Choose a date</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={sheetStyles.dateChipsRow}
              >
                {rescheduleDateStrip.map((ymd) => {
                  const d = parseYmdLocal(ymd);
                  const isToday = isSameLocalCalendarDay(ymd, new Date());
                  const isDayOff = isDateDayOff(rescheduleDaysOffByDate, ymd);
                  const sel = ymd === rescheduleDateKey;
                  const dow = isToday
                    ? "Today"
                    : RESCHEDULE_WEEKDAY_SHORT[d.getDay()];
                  return (
                    <TouchableOpacity
                      key={ymd}
                      style={[
                        sheetStyles.dateChip,
                        isDayOff && !sel && sheetStyles.dateChipDayOff,
                        isDayOff && sel && sheetStyles.dateChipDayOffActive,
                        !isDayOff && sel && sheetStyles.dateChipSelected,
                      ]}
                      onPress={() => setRescheduleDateKey(ymd)}
                      activeOpacity={0.8}
                    >
                      {isDayOff ? (
                        <Text
                          style={[
                            sheetStyles.dateChipOffLabel,
                            sel && sheetStyles.dateChipOffLabelActive,
                          ]}
                        >
                          Day off
                        </Text>
                      ) : null}
                      <Text
                        style={[
                          sheetStyles.dateChipDow,
                          sel && !isDayOff && sheetStyles.dateChipTextSelected,
                          isDayOff && !sel && sheetStyles.dateChipDowDayOff,
                          isDayOff && sel && sheetStyles.dateChipDowDayOffActive,
                        ]}
                      >
                        {dow}
                      </Text>
                      <Text
                        style={[
                          sheetStyles.dateChipDom,
                          sel && !isDayOff && sheetStyles.dateChipTextSelected,
                          isDayOff && !sel && sheetStyles.dateChipDomDayOff,
                          isDayOff && sel && sheetStyles.dateChipDomDayOffActive,
                        ]}
                      >
                        {d.getDate()}
                      </Text>
                      <Text
                        style={[
                          sheetStyles.dateChipMon,
                          sel && !isDayOff && sheetStyles.dateChipTextSelected,
                          isDayOff && !sel && sheetStyles.dateChipMonDayOff,
                          isDayOff && sel && sheetStyles.dateChipMonDayOffActive,
                        ]}
                      >
                        {RESCHEDULE_MONTH_SHORT[d.getMonth()]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={sheetStyles.sheetSub}>Select time</Text>
              {rescheduleDaysOffLoading && !rescheduleSelectedDayOff ? (
                <View style={sheetStyles.slotsLoading}>
                  <ActivityIndicator size="small" color={ACCENT} />
                  <Text style={sheetStyles.slotsLoadingText}>
                    Loading schedule…
                  </Text>
                </View>
              ) : rescheduleSelectedDayOff ? (
                <View style={sheetStyles.dayOffPanel}>
                  <Ionicons
                    name="calendar-clear-outline"
                    size={26}
                    color="#D97706"
                  />
                  <Text style={sheetStyles.dayOffTitle}>Day off</Text>
                  <Text style={sheetStyles.dayOffSub}>
                    You marked this date as unavailable.
                  </Text>
                  {rescheduleSelectedDayOffReason ? (
                    <Text style={sheetStyles.dayOffReason}>
                      {rescheduleSelectedDayOffReason}
                    </Text>
                  ) : null}
                  <Text style={sheetStyles.dayOffHint}>
                    Choose another date to propose a time.
                  </Text>
                </View>
              ) : rescheduleSlotsLoading ? (
                <View style={sheetStyles.slotsLoading}>
                  <ActivityIndicator size="small" color={ACCENT} />
                  <Text style={sheetStyles.slotsLoadingText}>
                    Checking availability…
                  </Text>
                </View>
              ) : rescheduleSlots.length === 0 ? (
                <View style={sheetStyles.slotsEmpty}>
                  <Ionicons name="time-outline" size={28} color="#94A3B8" />
                  <Text style={sheetStyles.slotsEmptyTitle}>
                    No open slots
                  </Text>
                  <Text style={sheetStyles.slotsEmptySub}>
                    You have no working hours on this day. Pick another date.
                  </Text>
                </View>
              ) : (
                <>
                  {rescheduleSelectableSlots.length === 0 ? (
                    <Text style={sheetStyles.slotsHint}>
                      {rescheduleSlots.some((s) => s.status === "reserved")
                        ? "All open times are reserved or in the past."
                        : "All remaining slots are in the past. Choose another date."}
                    </Text>
                  ) : null}
                  <View style={sheetStyles.slotsGrid}>
                    {rescheduleSlots.map((slot) => {
                      const reserved = slot.status === "reserved";
                      const past = isSlotStartInPast(
                        rescheduleDateKey,
                        slot.time,
                        new Date(rescheduleNowCoarse),
                      );
                      const disabled = reserved || past;
                      const sel = selectedRescheduleTime === slot.time;
                      return (
                        <TouchableOpacity
                          key={slot.time}
                          style={[
                            sheetStyles.slotBtn,
                            reserved && sheetStyles.slotBtnReserved,
                            past && sheetStyles.slotBtnPast,
                            sel && sheetStyles.slotBtnSelected,
                          ]}
                          disabled={disabled}
                          onPress={() => setSelectedRescheduleTime(slot.time)}
                          activeOpacity={0.82}
                        >
                          <Text
                            style={[
                              sheetStyles.slotBtnText,
                              reserved && sheetStyles.slotBtnTextReserved,
                              past && sheetStyles.slotBtnTextPast,
                              sel && sheetStyles.slotBtnTextSelected,
                            ]}
                          >
                            {slot.time}
                          </Text>
                          {reserved ? (
                            <Text style={sheetStyles.slotReservedTag}>
                              Reserved
                            </Text>
                          ) : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              {selectedRescheduleTime && canSendReschedule ? (
                <View style={sheetStyles.timePreview}>
                  <View style={sheetStyles.timePreviewBadge}>
                    <Ionicons name="time-outline" size={14} color={ACCENT} />
                    <Text style={sheetStyles.timePreviewText}>
                      {formatLongDate(rescheduleDateKey)} at{" "}
                      {selectedRescheduleTime}
                    </Text>
                  </View>
                </View>
              ) : null}

              <TouchableOpacity
                style={[
                  sheetStyles.sendBtn,
                  (actionLoading || !canSendReschedule) && styles.btnDisabled,
                ]}
                onPress={onProposeReschedule}
                disabled={actionLoading || !canSendReschedule}
                activeOpacity={0.85}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="paper-plane" size={15} color="#FFFFFF" />
                    <Text style={sheetStyles.sendBtnText}>Send Proposal</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {noticeModal ? (
        <AuthNoticeModal
          visible
          onClose={() => setNoticeModal(null)}
          title={noticeModal.title}
          message={noticeModal.message}
          primaryLabel={noticeModal.primaryLabel}
          onPrimary={() => {
            noticeModal.onPrimary?.();
          }}
        />
      ) : null}

      <ConfirmModal
        visible={confirmCancelVisible}
        onDismiss={() => !actionLoading && setConfirmCancelVisible(false)}
        loading={actionLoading}
        title="Cancel appointment"
        message="Are you sure you want to cancel this appointment?"
        cancelLabel="No"
        confirmLabel="Yes, cancel"
        confirmVariant="destructive"
        onConfirm={() =>
          void runAction(() => api.cancelAppointment(appointmentId, {}), {
            onSuccess: () => setConfirmCancelVisible(false),
          })
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: SCREEN_BG,
  },
  loadingRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: SCREEN_BG,
  },
  screenHeader: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(226,232,240,0.9)",
  },
  screenHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  screenHeaderCenter: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  screenHeaderEyebrow: {
    fontSize: 10,
    fontWeight: "800",
    color: "#94A3B8",
    letterSpacing: 1.2,
  },
  screenHeaderId: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 2,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  headerSideSpacer: {
    width: 40,
    height: 40,
  },
  headerStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  headerStatusText: {
    fontSize: 12,
    fontWeight: "800",
    flex: 1,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: "auto",
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#38BDF8",
  },
  liveText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#0284C7",
  },
  tabBar: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    padding: 4,
    borderRadius: 16,
    backgroundColor: "rgba(226,232,240,0.7)",
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  tabBtnActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#94A3B8",
  },
  tabBtnTextActive: {
    color: "#0F172A",
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  timelineLoading: {
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  timelineLoadingText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  categoryChip: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  categoryChipText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#059669",
  },
  notesAmberCard: {
    backgroundColor: "#FFFBEB",
    borderRadius: 24,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(253,230,138,0.7)",
  },
  notesAmberLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#D97706",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  notesAmberText: {
    fontSize: 12,
    color: "#92400E",
    lineHeight: 18,
  },
  summaryRowTotal: {
    borderBottomWidth: 0,
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  summaryTotalLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#1E293B",
  },
  summaryTotalValue: {
    fontSize: 13,
    fontWeight: "900",
    color: "#059669",
  },
  clientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  avatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  avatarInitials: {
    fontSize: 16,
    fontWeight: "700",
    color: "#6B7280",
  },
  clientText: {
    flex: 1,
    justifyContent: "center",
  },
  clientNameText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111827",
  },
  clientSub: {
    marginTop: 4,
    fontSize: 12,
    color: "#6B7280",
  },
  serviceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111827",
  },
  priceWrap: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  priceTag: {
    fontSize: 13,
    fontWeight: "800",
    color: ACCENT,
  },
  actionBlock: {
    marginBottom: 16,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    marginBottom: 12,
  },
  infoCardText: {
    fontSize: 13,
    color: "#92400E",
    fontWeight: "600",
    flex: 1,
    lineHeight: 19,
  },
  successCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    marginBottom: 12,
  },
  successCardText: {
    fontSize: 13,
    color: "#065F46",
    fontWeight: "600",
    flex: 1,
    lineHeight: 19,
  },
  btnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 11,
    shadowColor: ACCENT_DARK,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  btnPrimaryText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
    letterSpacing: 0.2,
  },
  btnOutlineRed: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1.5,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
    borderRadius: 14,
    paddingVertical: 10,
    marginTop: 10,
  },
  btnOutlineRedText: {
    color: "#DC2626",
    fontWeight: "600",
    fontSize: 14,
  },
  btnPrimaryGreen: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#10B981",
    borderRadius: 14,
    paddingVertical: 11,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  btnPrimaryGreenText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
    letterSpacing: 0.2,
  },
  btnDisabled: {
    opacity: 0.65,
  },
  rescheduleCard: {
    backgroundColor: "#FFF7ED",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#FED7AA",
  },
  rescheduleHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  rescheduleIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(234, 88, 12, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  rescheduleTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#9A3412",
  },
  rescheduleTime: {
    fontSize: 12,
    fontWeight: "600",
    color: "#78350F",
    lineHeight: 18,
  },
  cancelLinkWrap: {
    alignItems: "center",
    paddingVertical: 10,
  },
  linkDanger: {
    color: "#DC2626",
    fontWeight: "600",
    fontSize: 13,
  },
  linkMuted: {
    color: "#64748B",
    fontWeight: "600",
    fontSize: 13,
  },
  enRouteCard: {
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    marginBottom: 12,
  },
  enRouteIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(2, 132, 199, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  enRouteText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0369A1",
    textAlign: "center",
  },
  itineraryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0284C7",
    borderRadius: 14,
    paddingVertical: 12,
    gap: 8,
    marginBottom: 12,
    shadowColor: "#0284C7",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  itineraryBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  enRouteSub: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "500",
    color: "#075985",
    textAlign: "center",
  },
  awaitingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: ACCENT_LIGHT,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
    marginBottom: 16,
  },
  awaitingIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ACCENT_LIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  awaitingText: {
    fontSize: 13,
    fontWeight: "600",
    color: ACCENT_DARK,
    flex: 1,
    lineHeight: 19,
  },
  timerCard: {
    alignItems: "center",
    backgroundColor: ACCENT_LIGHT,
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
  },
  timerLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: ACCENT_DARK,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  timerLarge: {
    fontSize: 48,
    fontWeight: "800",
    color: ACCENT,
  },
  timerDivider: {
    width: 40,
    height: 4,
    backgroundColor: ACCENT_BORDER,
    borderRadius: 2,
    marginVertical: 16,
  },
  timerSub: {
    fontSize: 12,
    fontWeight: "500",
    color: ACCENT,
  },
  completedBlock: {
    marginBottom: 0,
  },
  completedCard: {
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  completedIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#D1FAE5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  completedTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#065F46",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  summaryLabel: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "600",
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
  },
  interventionPhotosCard: {
    marginTop: 0,
  },
  interventionPhotoGroupSpaced: {
    marginTop: 20,
  },
  errorCard: {
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  errorIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#DC2626",
  },
  errorMessage: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "500",
    color: "#991B1B",
    textAlign: "center",
    lineHeight: 18,
  },
  cancelledCard: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cancelledIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  cancelledTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111827",
  },
  cancelledSubtitle: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "600",
    color: "#4B5563",
  },
  cancelledReasonBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    width: "100%",
    alignItems: "center",
  },
  cancelledReason: {
    fontSize: 12,
    fontStyle: "italic",
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 18,
  },
  refuseBox: {
    gap: 8,
    marginTop: 10,
  },
  refuseInput: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 14,
    minHeight: 88,
    textAlignVertical: "top",
    fontSize: 12,
    color: "#0F172A",
    backgroundColor: "#FFFFFF",
  },
  refuseError: {
    fontSize: 13,
    fontWeight: "600",
    color: "#DC2626",
  },
  proposeLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    marginTop: 4,
  },
  proposeLinkText: {
    fontSize: 13,
    fontWeight: "600",
    color: ACCENT,
  },
  photoRowWrap: {
    gap: 8,
    marginBottom: 12,
  },
  photoRowLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  photoRowScroll: {
    gap: 10,
    paddingVertical: 4,
  },
  photoThumb: {
    width: 82,
    height: 82,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
  },
  addPhotoBtn: {
    width: 82,
    height: 82,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: ACCENT_BORDER,
    backgroundColor: ACCENT_LIGHT,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  addPhotoLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: ACCENT,
  },
});

const sheetStyles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.45)",
  },
  sheetCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 8,
    maxHeight: "92%",
    borderTopWidth: 1,
    borderColor: "#EAECF4",
  },
  sheetHandleRow: { alignItems: "center", paddingBottom: 12 },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E2E8F0",
  },
  sheetHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 4,
  },
  sheetHeaderIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: ACCENT_LIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: -0.2,
  },
  sheetDesc: {
    fontSize: 12,
    color: "#64748B",
    lineHeight: 17,
    marginTop: 2,
  },
  sheetSub: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 18,
    marginBottom: 10,
  },
  dateChipsRow: { gap: 8, paddingVertical: 4 },
  dateChip: {
    minWidth: 64,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    alignItems: "center",
  },
  dateChipSelected: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
    shadowColor: ACCENT_DARK,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  dateChipDayOff: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
  },
  dateChipDayOffActive: {
    backgroundColor: "#FEF3C7",
    borderColor: "#F59E0B",
  },
  dateChipOffLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#D97706",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  dateChipOffLabelActive: { color: "#B45309" },
  dateChipDow: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
  },
  dateChipDom: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 1,
  },
  dateChipMon: {
    fontSize: 10,
    fontWeight: "600",
    color: "#94A3B8",
    marginTop: 1,
  },
  dateChipDowDayOff: { color: "#B45309" },
  dateChipDomDayOff: { color: "#92400E" },
  dateChipMonDayOff: { color: "#D97706" },
  dateChipDowDayOffActive: { color: "#92400E" },
  dateChipDomDayOffActive: { color: "#78350F" },
  dateChipMonDayOffActive: { color: "#B45309" },
  dateChipTextSelected: { color: "#FFFFFF", fontWeight: "700" },
  slotsLoading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 28,
  },
  slotsLoadingText: { fontSize: 13, color: "#64748B", fontWeight: "600" },
  dayOffPanel: {
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 12,
    backgroundColor: "#FFFBEB",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FDE68A",
    marginBottom: 8,
  },
  dayOffTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#B45309",
    marginTop: 8,
  },
  dayOffSub: {
    fontSize: 13,
    color: "#92400E",
    textAlign: "center",
    marginTop: 4,
    lineHeight: 18,
  },
  dayOffReason: {
    fontSize: 12,
    color: "#78350F",
    marginTop: 8,
    textAlign: "center",
    fontStyle: "italic",
  },
  dayOffHint: {
    fontSize: 12,
    color: "#D97706",
    marginTop: 10,
    textAlign: "center",
  },
  slotsEmpty: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 6,
  },
  slotsEmptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#334155",
  },
  slotsEmptySub: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
  },
  slotsHint: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 10,
    lineHeight: 17,
  },
  slotsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  slotBtn: {
    minWidth: "30%",
    flexGrow: 1,
    flexBasis: "30%",
    maxWidth: "32%",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    alignItems: "center",
  },
  slotBtnReserved: {
    backgroundColor: "#FFF1F1",
    borderColor: "#FECACA",
  },
  slotBtnPast: {
    opacity: 0.45,
  },
  slotBtnSelected: {
    backgroundColor: ACCENT_LIGHT,
    borderColor: ACCENT,
  },
  slotBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  slotBtnTextReserved: { color: "#DC2626" },
  slotBtnTextPast: { color: "#94A3B8" },
  slotBtnTextSelected: { color: ACCENT },
  slotReservedTag: {
    fontSize: 9,
    fontWeight: "800",
    color: "#DC2626",
    marginTop: 3,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  timePreview: {
    alignItems: "center",
    paddingTop: 14,
    paddingBottom: 6,
  },
  timePreviewBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: ACCENT_LIGHT,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  timePreviewText: { fontSize: 13, fontWeight: "700", color: ACCENT },
  sendBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 13,
    marginTop: 16,
    shadowColor: ACCENT_DARK,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  sendBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
    letterSpacing: 0.3,
  },
});
