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
import { COLORS } from "../../../constants";
import {
  AuthNoticeModal,
  ConfirmModal,
  PhotoCarousel,
} from "../../../components/common";
import type { ProviderStackParamList } from "../../../navigation/types";
import { useAuth } from "../../../context/AuthContext";
import { useAppointmentRealtime } from "../../../hooks/useAppointmentRealtime";
import { api, type AppointmentStatus } from "../../../services/api";
import {
  uploadAppointmentInterventionPhotos,
  type InterventionPhotoPhase,
} from "../../../services/appointmentInterventionPhotosUpload";
import i18n from "../../../i18n";
import { pickApiStringArray } from "../../../utils/parseApiStringArray";

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

const RESCHEDULE_HOURS = Array.from({ length: 17 }, (_, i) =>
  String(i + 6).padStart(2, "0"),
) as string[];
const RESCHEDULE_MINUTES = ["00", "15", "30", "45"] as const;

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
        bg: "#F5F3FF",
        border: "#DDD6FE",
        text: "#6D28D9",
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
    backgroundColor: "#EEF2FF",
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
        <Ionicons name={icon} size={15} color="#6366F1" />
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
          <Ionicons name="camera-outline" size={20} color="#6366F1" />
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
  const [rescheduleHour, setRescheduleHour] = useState("09");
  const [rescheduleMinute, setRescheduleMinute] = useState("00");
  const [beforeLocalUris, setBeforeLocalUris] = useState<string[]>([]);
  const [afterLocalUris, setAfterLocalUris] = useState<string[]>([]);
  const [noticeModal, setNoticeModal] =
    useState<ProviderAppointmentNoticeModal>(null);
  const [confirmCancelVisible, setConfirmCancelVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<"status" | "details">("status");

  const loadAppointment = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (opts?.silent) {
        setStatusRefreshing(true);
      } else {
        setLoading(true);
      }
      try {
        const res = await api.getAppointmentById(appointmentId);
        setAppointment(parseAppointment(res.data));
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
    [appointmentId, navigation],
  );

  useEffect(() => {
    void loadAppointment();
  }, [loadAppointment]);

  useAppointmentRealtime(
    appointmentId,
    useCallback((raw) => {
      const parsed = parseAppointment(raw);
      if (parsed) setAppointment(parsed);
    }, []),
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

  const showTimerPhase = useMemo(() => {
    if (!appointment || appointment.status !== "IN_PROGRESS") return false;
    return !!appointment.startedAt && !waitingClientEnd;
  }, [appointment, waitingClientEnd]);

  const rescheduleDayChips = useMemo(() => {
    const out: { key: string; label: string }[] = [];
    const start = new Date();
    for (let i = 1; i <= 45; i++) {
      const d = addDays(start, i);
      out.push({
        key: toYyyyMmDd(d),
        label: d.toLocaleDateString("en-GB", {
          weekday: "short",
          day: "numeric",
          month: "short",
        }),
      });
    }
    return out;
  }, []);

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

  const onAccept = () =>
    void runAction(() =>
      api.providerRespond(appointmentId, { action: "CONFIRMED" }),
    );

  const onRefuseSubmit = () => {
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

  const onProposeReschedule = () =>
    void runAction(() =>
      api.providerRespond(appointmentId, {
        action: "RESCHEDULED",
        rescheduleDate: rescheduleDateKey,
        rescheduleTime: `${rescheduleHour}:${rescheduleMinute}`,
      }),
    );

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
        <ActivityIndicator size="large" color={COLORS.primary || "#4F46E5"} />
      </View>
    );
  }

  const banner = statusBannerMeta(appointment.status);
  const clientName =
    `${appointment.client.firstName} ${appointment.client.lastName}`.trim() ||
    "Client";
  const initials = clientInitials(
    appointment.client.firstName,
    appointment.client.lastName,
  );

  const priceLabel =
    appointment.givenService.pricingType === "HOURLY"
      ? `$${appointment.givenService.price} / hr`
      : `$${appointment.givenService.price}`;

  const appointmentRef = `#${appointment.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;

  const showTimeline = ![
    "REFUSED",
    "CANCELLED_CLIENT",
    "CANCELLED_PROVIDER",
  ].includes(appointment.status);

  const hasInterventionPhotos =
    appointment.beforePhotoUrls.length > 0 ||
    appointment.afterPhotoUrls.length > 0;

  const interventionPhotosSection = hasInterventionPhotos ? (
    <View style={[styles.card, styles.interventionPhotosCard]}>
      <SectionHeader icon="images-outline" title="Service Photos" />
      {appointment.beforePhotoUrls.length > 0 ? (
        <PhotoCarousel
          photos={appointment.beforePhotoUrls}
          groupLabel="Before"
          accessibilityLabelPrefix="Before service photo"
        />
      ) : null}
      {appointment.afterPhotoUrls.length > 0 ? (
        <PhotoCarousel
          photos={appointment.afterPhotoUrls}
          groupLabel="After"
          accessibilityLabelPrefix="After service photo"
          style={
            appointment.beforePhotoUrls.length > 0
              ? styles.interventionPhotoGroupSpaced
              : undefined
          }
        />
      ) : null}
    </View>
  ) : null;

  return (
    <View style={styles.root}>
      <View style={[styles.screenHeader, { paddingTop: insets.top + 8 }]}>
        <View style={styles.screenHeaderRow}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={20} color="#0F172A" />
          </TouchableOpacity>
          <View style={styles.screenHeaderCenter}>
            <Text style={styles.screenHeaderEyebrow}>APPOINTMENT</Text>
            <Text style={styles.screenHeaderId} numberOfLines={1}>
              {appointmentRef}
            </Text>
          </View>
          <View style={styles.headerSideSpacer} />
        </View>
        <View
          style={[
            styles.headerStatusPill,
            { backgroundColor: banner.bg, borderColor: banner.border },
          ]}
        >
          <Ionicons name={banner.icon} size={16} color={banner.text} />
          <Text style={[styles.headerStatusText, { color: banner.text }]}>
            {statusDisplayLabel(appointment.status)}
          </Text>
          {appointment.status === "EN_ROUTE" ? (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Live</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.tabBar}>
        {(["status", "details"] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.tabBtnText,
                activeTab === tab && styles.tabBtnTextActive,
              ]}
            >
              {tab === "status" ? "Order Status" : "Details"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {activeTab === "status" ? (
          <>
            {showTimeline ? (
              <View style={styles.card}>
                <SectionHeader icon="list-outline" title="Order Status" />
                {statusRefreshing ? (
                  <View style={styles.timelineLoading}>
                    <ActivityIndicator
                      size="small"
                      color={COLORS.primary || "#6366F1"}
                    />
                    <Text style={styles.timelineLoadingText}>
                      Updating status…
                    </Text>
                  </View>
                ) : (
                  <StatusTimeline
                    status={appointment.status}
                    timestamps={{
                      createdAt: appointment.createdAt,
                      confirmedAt: appointment.confirmedAt,
                      enRouteAt: appointment.enRouteAt,
                      startedAt: appointment.startedAt,
                      completedAt: appointment.completedAt,
                    }}
                  />
                )}
              </View>
            ) : null}

            {appointment.status === "PENDING" ? (
              <View style={styles.actionBlock}>
                <View style={styles.infoCard}>
                  <Ionicons name="hourglass" size={18} color="#D97706" />
                  <Text style={styles.infoCardText}>
                    New booking request from {clientName}. Accept, refuse, or
                    propose a new time.
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.btnPrimaryGreen,
                    actionLoading && styles.btnDisabled,
                  ]}
                  disabled={actionLoading}
                  onPress={onAccept}
                  activeOpacity={0.88}
                >
                  {actionLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                      <Text style={styles.btnPrimaryGreenText}>
                        Accept Appointment
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                {!refuseMode ? (
                  <TouchableOpacity
                    style={[
                      styles.btnOutlineRed,
                      actionLoading && styles.btnDisabled,
                    ]}
                    disabled={actionLoading}
                    onPress={() => setRefuseMode(true)}
                    activeOpacity={0.88}
                  >
                    <Ionicons name="close-circle-outline" size={16} color="#DC2626" />
                    <Text style={styles.btnOutlineRedText}>Refuse</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.refuseBox}>
                    <TextInput
                      style={styles.refuseInput}
                      placeholder="Reason for refusal…"
                      placeholderTextColor="#94A3B8"
                      value={refusalReason}
                      onChangeText={(text) => {
                        setRefusalReason(text);
                        if (refusalError) setRefusalError("");
                      }}
                      multiline
                    />
                    {refusalError ? (
                      <Text style={styles.refuseError}>{refusalError}</Text>
                    ) : null}
                    <TouchableOpacity
                      style={[
                        styles.btnOutlineRed,
                        actionLoading && styles.btnDisabled,
                      ]}
                      disabled={actionLoading}
                      onPress={onRefuseSubmit}
                      activeOpacity={0.88}
                    >
                      {actionLoading ? (
                        <ActivityIndicator color="#DC2626" />
                      ) : (
                        <Text style={styles.btnOutlineRedText}>
                          Confirm refusal
                        </Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.cancelLinkWrap}
                      onPress={() => {
                        setRefuseMode(false);
                        setRefusalReason("");
                        setRefusalError("");
                      }}
                      disabled={actionLoading}
                    >
                      <Text style={styles.linkMuted}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.proposeLink}
                  onPress={() => setRescheduleSheetVisible(true)}
                  disabled={actionLoading}
                >
                  <Ionicons name="time-outline" size={15} color="#6366F1" />
                  <Text style={styles.proposeLinkText}>
                    Propose a different time
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {appointment.status === "CONFIRMED" ? (
              <View style={styles.actionBlock}>
                <View style={styles.successCard}>
                  <Ionicons name="checkmark-circle" size={18} color="#059669" />
                  <Text style={styles.successCardText}>
                    Confirmed for {formatLongDate(appointment.scheduledDate)}.
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.btnPrimary,
                    actionLoading && styles.btnDisabled,
                  ]}
                  disabled={actionLoading}
                  onPress={onMarkEnRoute}
                  activeOpacity={0.88}
                >
                  {actionLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="car" size={16} color="#FFFFFF" />
                      <Text style={styles.btnPrimaryText}>Mark as En Route</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={actionLoading}
                  onPress={onCancelConfirmed}
                  style={styles.cancelLinkWrap}
                >
                  <Text style={styles.linkDanger}>Cancel appointment</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {appointment.status === "RESCHEDULED" ? (
              <View style={styles.actionBlock}>
                <View style={styles.rescheduleCard}>
                  <View style={styles.rescheduleHeader}>
                    <View style={styles.rescheduleIconWrap}>
                      <Ionicons name="calendar" size={20} color="#EA580C" />
                    </View>
                    <Text style={styles.rescheduleTitle}>
                      Awaiting client response
                    </Text>
                  </View>
                  <Text style={styles.rescheduleTime}>
                    {formatRescheduleDetail(
                      appointment.rescheduleDate,
                      appointment.rescheduleTime,
                    )}
                  </Text>
                </View>
              </View>
            ) : null}

            {appointment.status === "EN_ROUTE" ? (
              <View style={styles.actionBlock}>
                <View style={styles.enRouteCard}>
                  <View style={styles.enRouteIconWrap}>
                    <Ionicons name="car" size={28} color="#0284C7" />
                  </View>
                  <Text style={styles.enRouteText}>You are on the way</Text>
                  {appointment.enRouteAt ? (
                    <Text style={styles.enRouteSub}>
                      Departed at {formatTimeOnly(appointment.enRouteAt)}
                    </Text>
                  ) : null}
                  <Text style={styles.enRouteSub}>
                    Client has been notified
                  </Text>
                </View>

                <PhotoRow
                  uris={beforeLocalUris}
                  label="Before photos (optional)"
                  onAdd={() => void pickPhoto("before")}
                  disabled={
                    actionLoading ||
                    beforeLocalUris.length >= MAX_INTERVENTION_PHOTOS
                  }
                />

                <TouchableOpacity
                  style={[
                    styles.btnPrimary,
                    actionLoading && styles.btnDisabled,
                  ]}
                  disabled={actionLoading}
                  onPress={onStartService}
                  activeOpacity={0.88}
                >
                  {actionLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="play" size={16} color="#FFFFFF" />
                      <Text style={styles.btnPrimaryText}>Start Service</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : null}

            {appointment.status === "IN_PROGRESS" && waitingClientStart ? (
              <View style={styles.actionBlock}>
                <View style={styles.awaitingCard}>
                  <View style={styles.awaitingIconWrap}>
                    <Ionicons name="location" size={22} color="#5B21B6" />
                  </View>
                  <Text style={styles.awaitingText}>
                    Waiting for client to confirm the service has started. The
                    timer begins after they confirm.
                  </Text>
                </View>
              </View>
            ) : null}

            {showTimerPhase ? (
              <View style={styles.actionBlock}>
                <View style={styles.timerCard}>
                  <Text style={styles.timerLabel}>IN PROGRESS</Text>
                  <Text style={styles.timerLarge}>
                    {formatElapsed(elapsedSeconds)}
                  </Text>
                  <View style={styles.timerDivider} />
                  <Text style={styles.timerSub}>
                    Started{" "}
                    {appointment.startedAt
                      ? formatDateTime(appointment.startedAt)
                      : "—"}
                  </Text>
                </View>
              </View>
            ) : null}

            {appointment.status === "IN_PROGRESS" && waitingClientEnd ? (
              <View style={styles.actionBlock}>
                <View style={styles.awaitingCard}>
                  <View style={styles.awaitingIconWrap}>
                    <Ionicons name="hourglass" size={22} color="#5B21B6" />
                  </View>
                  <Text style={styles.awaitingText}>
                    Waiting for client to confirm service completion.
                  </Text>
                </View>
              </View>
            ) : null}

            {appointment.status === "IN_PROGRESS" &&
            !waitingClientStart &&
            !waitingClientEnd ? (
              <View style={styles.actionBlock}>
                <PhotoRow
                  uris={afterLocalUris}
                  label="After photos (optional)"
                  onAdd={() => void pickPhoto("after")}
                  disabled={
                    actionLoading ||
                    afterLocalUris.length >= MAX_INTERVENTION_PHOTOS
                  }
                />
                <TouchableOpacity
                  style={[
                    styles.btnPrimaryGreen,
                    actionLoading && styles.btnDisabled,
                  ]}
                  disabled={actionLoading}
                  onPress={onEndService}
                  activeOpacity={0.88}
                >
                  {actionLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons
                        name="checkmark-done"
                        size={16}
                        color="#FFFFFF"
                      />
                      <Text style={styles.btnPrimaryGreenText}>End Service</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : null}

            {appointment.status === "COMPLETED" ? (
              <View style={styles.completedBlock}>
                <View style={styles.completedCard}>
                  <View style={styles.completedIconWrap}>
                    <Ionicons
                      name="checkmark-sharp"
                      size={32}
                      color="#059669"
                    />
                  </View>
                  <Text style={styles.completedTitle}>Service Completed</Text>
                </View>

                <View style={styles.card}>
                  <SectionHeader icon="list-outline" title="Summary" />
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Started</Text>
                    <Text style={styles.summaryValue}>
                      {formatDateTime(appointment.startedAt)}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Ended</Text>
                    <Text style={styles.summaryValue}>
                      {formatDateTime(appointment.completedAt)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.summaryRow,
                      {
                        borderBottomWidth: 0,
                        paddingBottom: 0,
                        marginBottom: 0,
                      },
                    ]}
                  >
                    <Text style={styles.summaryLabel}>Duration</Text>
                    <Text style={styles.summaryValue}>
                      {appointment.durationMinutes != null
                        ? `${appointment.durationMinutes} min`
                        : "—"}
                    </Text>
                  </View>
                </View>
              </View>
            ) : null}

            {appointment.status === "REFUSED" ? (
              <View style={styles.actionBlock}>
                <View style={styles.errorCard}>
                  <View style={styles.errorIconWrap}>
                    <Ionicons name="close" size={32} color="#DC2626" />
                  </View>
                  <Text style={styles.errorTitle}>Request Refused</Text>
                  {appointment.refusalReason ? (
                    <Text style={styles.errorMessage}>
                      {appointment.refusalReason}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : null}

            {(appointment.status === "CANCELLED_CLIENT" ||
              appointment.status === "CANCELLED_PROVIDER") && (
              <View style={styles.actionBlock}>
                <View style={styles.cancelledCard}>
                  <View style={styles.cancelledIconWrap}>
                    <Ionicons name="ban" size={28} color="#4B5563" />
                  </View>
                  <Text style={styles.cancelledTitle}>
                    Appointment Cancelled
                  </Text>
                  <Text style={styles.cancelledSubtitle}>
                    {appointment.status === "CANCELLED_CLIENT"
                      ? "Cancelled by client"
                      : "Cancelled by you"}
                  </Text>
                  {appointment.cancellationReason ? (
                    <View style={styles.cancelledReasonBox}>
                      <Text style={styles.cancelledReason}>
                        "{appointment.cancellationReason}"
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            )}
          </>
        ) : null}

        {activeTab === "details" ? (
          <>
            <View style={styles.card}>
              <View style={styles.clientRow}>
                {appointment.client.imageUrl ? (
                  <Image
                    source={{ uri: appointment.client.imageUrl }}
                    style={styles.avatar}
                  />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarInitials}>{initials}</Text>
                  </View>
                )}
                <View style={styles.clientText}>
                  <Text style={styles.clientNameText}>{clientName}</Text>
                  <Text style={styles.clientSub} numberOfLines={1}>
                    Client
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <SectionHeader icon="briefcase-outline" title="Booking Details" />
              <View style={styles.serviceHeader}>
                <View style={styles.serviceInfo}>
                  <Text style={styles.serviceTitle}>
                    {appointment.givenService.serviceName}
                  </Text>
                  <View style={styles.categoryChip}>
                    <Text style={styles.categoryChipText}>
                      {appointment.givenService.categoryName}
                    </Text>
                  </View>
                </View>
                <View style={styles.priceWrap}>
                  <Text style={styles.priceTag}>{priceLabel}</Text>
                </View>
              </View>
              <DetailRow
                icon="calendar-outline"
                label="Date"
                value={formatBookingDateTime(
                  appointment.scheduledDate,
                  appointment.scheduledTime,
                )}
              />
              {appointment.givenService.estimatedDurationMinutes != null ? (
                <DetailRow
                  icon="time-outline"
                  label="Duration"
                  value={`Est. ${appointment.givenService.estimatedDurationMinutes} mins`}
                />
              ) : null}
            </View>

            {appointment.notes ? (
              <View style={styles.notesAmberCard}>
                <Text style={styles.notesAmberLabel}>Client notes</Text>
                <Text style={styles.notesAmberText}>{appointment.notes}</Text>
              </View>
            ) : null}

            {appointment.photoUrls.length > 0 ? (
              <View style={styles.card}>
                <SectionHeader icon="images-outline" title="Reference Photos" />
                <PhotoCarousel
                  photos={appointment.photoUrls}
                  accessibilityLabelPrefix="Reference photo"
                />
              </View>
            ) : null}

            {interventionPhotosSection}

            <View style={styles.card}>
              <SectionHeader icon="receipt-outline" title="Order Summary" />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>
                  {appointment.givenService.serviceName}
                </Text>
                <Text style={styles.summaryValue}>{priceLabel}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Platform Fee</Text>
                <Text style={styles.summaryValue}>$0</Text>
              </View>
              <View style={[styles.summaryRow, styles.summaryRowTotal]}>
                <Text style={styles.summaryTotalLabel}>Total</Text>
                <Text style={styles.summaryTotalValue}>{priceLabel}</Text>
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>

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
            <View style={sheetStyles.sheetHandleRow}>
              <View style={sheetStyles.sheetHandle} />
            </View>

            <View style={sheetStyles.sheetHeaderRow}>
              <View style={sheetStyles.sheetHeaderIcon}>
                <Ionicons name="calendar-outline" size={20} color="#6366F1" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={sheetStyles.sheetTitle}>Propose New Time</Text>
                <Text style={sheetStyles.sheetDesc}>
                  Pick a date and time that works better for this appointment.
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
              {rescheduleDayChips.map((chip) => {
                const sel = chip.key === rescheduleDateKey;
                return (
                  <TouchableOpacity
                    key={chip.key}
                    style={[
                      sheetStyles.dateChip,
                      sel && sheetStyles.dateChipSelected,
                    ]}
                    onPress={() => setRescheduleDateKey(chip.key)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        sheetStyles.dateChipText,
                        sel && sheetStyles.dateChipTextSelected,
                      ]}
                    >
                      {chip.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={sheetStyles.sheetSub}>Select time</Text>
            <View style={sheetStyles.timePickRow}>
              <View style={sheetStyles.timeColWrap}>
                <Text style={sheetStyles.timeColLabel}>Hour</Text>
                <ScrollView
                  style={sheetStyles.timeCol}
                  showsVerticalScrollIndicator={false}
                >
                  {RESCHEDULE_HOURS.map((h) => {
                    const sel = rescheduleHour === h;
                    return (
                      <TouchableOpacity
                        key={h}
                        style={[
                          sheetStyles.timeChip,
                          sel && sheetStyles.timeChipSelected,
                        ]}
                        onPress={() => setRescheduleHour(h)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            sheetStyles.timeChipText,
                            sel && sheetStyles.timeChipTextSelected,
                          ]}
                        >
                          {h}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
              <Text style={sheetStyles.timeColon}>:</Text>
              <View style={sheetStyles.timeColWrap}>
                <Text style={sheetStyles.timeColLabel}>Minute</Text>
                <ScrollView
                  style={sheetStyles.timeCol}
                  showsVerticalScrollIndicator={false}
                >
                  {RESCHEDULE_MINUTES.map((m) => {
                    const sel = rescheduleMinute === m;
                    return (
                      <TouchableOpacity
                        key={m}
                        style={[
                          sheetStyles.timeChip,
                          sel && sheetStyles.timeChipSelected,
                        ]}
                        onPress={() => setRescheduleMinute(m)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            sheetStyles.timeChipText,
                            sel && sheetStyles.timeChipTextSelected,
                          ]}
                        >
                          {m}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>

            <View style={sheetStyles.timePreview}>
              <View style={sheetStyles.timePreviewBadge}>
                <Ionicons name="time-outline" size={14} color="#6366F1" />
                <Text style={sheetStyles.timePreviewText}>
                  {rescheduleDayChips.find((c) => c.key === rescheduleDateKey)
                    ?.label ?? rescheduleDateKey}{" "}
                  at {rescheduleHour}:{rescheduleMinute}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[
                sheetStyles.sendBtn,
                actionLoading && styles.btnDisabled,
              ]}
              onPress={onProposeReschedule}
              disabled={actionLoading}
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
    backgroundColor: "#F8FAFC",
  },
  loadingRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
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
    fontSize: 14,
    color: "#92400E",
    lineHeight: 21,
  },
  summaryRowTotal: {
    borderBottomWidth: 0,
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  summaryTotalLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1E293B",
  },
  summaryTotalValue: {
    fontSize: 16,
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
    fontSize: 20,
    fontWeight: "700",
    color: "#6B7280",
  },
  clientText: {
    flex: 1,
    justifyContent: "center",
  },
  clientNameText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  clientSub: {
    marginTop: 4,
    fontSize: 14,
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
    fontSize: 18,
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
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.primary || "#4F46E5",
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
    backgroundColor: "#6366F1",
    borderRadius: 14,
    paddingVertical: 11,
    shadowColor: "#6366F1",
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
    fontSize: 16,
    fontWeight: "800",
    color: "#9A3412",
  },
  rescheduleTime: {
    fontSize: 15,
    fontWeight: "600",
    color: "#78350F",
    lineHeight: 22,
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
    fontSize: 18,
    fontWeight: "800",
    color: "#0369A1",
    textAlign: "center",
  },
  enRouteSub: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "500",
    color: "#075985",
    textAlign: "center",
  },
  awaitingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#F5F3FF",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DDD6FE",
    marginBottom: 16,
  },
  awaitingIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EDE9FE",
    alignItems: "center",
    justifyContent: "center",
  },
  awaitingText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#5B21B6",
    flex: 1,
    lineHeight: 19,
  },
  timerCard: {
    alignItems: "center",
    backgroundColor: "#EEF2FF",
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  timerLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#4338CA",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  timerLarge: {
    fontSize: 48,
    fontWeight: "800",
    color: COLORS.primary || "#4F46E5",
  },
  timerDivider: {
    width: 40,
    height: 4,
    backgroundColor: "#C7D2FE",
    borderRadius: 2,
    marginVertical: 16,
  },
  timerSub: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6366F1",
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
    fontSize: 20,
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
    fontSize: 15,
    color: "#6B7280",
    fontWeight: "600",
  },
  summaryValue: {
    fontSize: 15,
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
    fontSize: 18,
    fontWeight: "800",
    color: "#DC2626",
  },
  errorMessage: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: "500",
    color: "#991B1B",
    textAlign: "center",
    lineHeight: 22,
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
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  cancelledSubtitle: {
    marginTop: 4,
    fontSize: 15,
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
    fontSize: 14,
    fontStyle: "italic",
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
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
    fontSize: 14,
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
    color: "#6366F1",
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
    borderColor: "#C7D2FE",
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  addPhotoLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6366F1",
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
    backgroundColor: "#EEF2FF",
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
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  dateChipSelected: {
    backgroundColor: "#6366F1",
    borderColor: "#6366F1",
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  dateChipText: { fontSize: 13, fontWeight: "600", color: "#334155" },
  dateChipTextSelected: { color: "#FFFFFF", fontWeight: "700" },
  timePickRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 220,
    marginBottom: 4,
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  timeColWrap: { flex: 1, gap: 6 },
  timeColLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  timeCol: { flex: 1 },
  timeColon: {
    fontSize: 22,
    fontWeight: "800",
    color: "#CBD5E1",
    paddingBottom: 20,
  },
  timeChip: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    marginVertical: 2,
    marginHorizontal: 4,
  },
  timeChipSelected: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#A5B4FC",
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  timeChipText: { fontSize: 18, fontWeight: "600", color: "#94A3B8" },
  timeChipTextSelected: { color: "#6366F1", fontWeight: "800" },
  timePreview: {
    alignItems: "center",
    paddingTop: 14,
    paddingBottom: 6,
  },
  timePreviewBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  timePreviewText: { fontSize: 13, fontWeight: "700", color: "#6366F1" },
  sendBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#6366F1",
    borderRadius: 14,
    paddingVertical: 13,
    marginTop: 16,
    shadowColor: "#6366F1",
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
