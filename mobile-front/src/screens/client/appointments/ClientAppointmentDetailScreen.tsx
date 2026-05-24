import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  type ViewStyle,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ClientStackParamList } from "../../../navigation/types";
import { COLORS } from "../../../constants";
import { ConfirmModal } from "../../../components/common";
import { api, type AppointmentStatus } from "../../../services/api";
import i18n from "../../../i18n";
import {
  pickApiStringArray,
  unwrapAppointmentApiPayload,
} from "../../../utils/parseApiStringArray";

type ClientAppointmentConfirmModal =
  | { kind: "cancel_request" }
  | { kind: "cancel_confirmed" }
  | { kind: "decline_reschedule" }
  | { kind: "accept_reschedule" };

type Props = NativeStackScreenProps<
  ClientStackParamList,
  "ClientAppointmentDetail"
>;

const REF_PHOTO_CAROUSEL_GAP = 12;

export type ClientAppointmentDetailModel = {
  id: string;
  providerId: string;
  givenServiceId: string;
  status: AppointmentStatus;
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
  cancelledBy: string | null;
  givenService: {
    serviceName: string;
    categoryName: string;
    price: number;
    pricingType: string;
    estimatedDurationMinutes: number | null;
  };
  provider: {
    firstName: string;
    lastName: string;
    photoUrl: string | null;
    tagline: string | null;
    city: string;
  };
  confirmations: Array<{ role: string; type: string; confirmedAt: string }>;
  /** Set when status is DISPUTED and a complaint exists for this appointment. */
  complaintId: string | null;
};

function pickLocaleName(
  translations: { locale: string; name: string }[] | undefined,
): string {
  if (!translations?.length) return "";
  const want = i18n.language?.startsWith("ar") ? "AR" : "EN";
  return (
    translations.find((t) => t.locale === want)?.name ??
    translations[0]?.name ??
    ""
  );
}

function toYmd(value: string | Date | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const day = String(d.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }
    return null;
  }
  const d = value as Date;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toIsoString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function normalizeDetail(
  raw: Record<string, unknown>,
): ClientAppointmentDetailModel {
  const gs = raw.givenService as Record<string, unknown> | undefined;
  const service = gs?.service as
    | {
        translations?: { locale: string; name: string }[];
        category?: { translations?: { locale: string; name: string }[] };
      }
    | undefined;
  const prov = raw.provider as
    | {
        photoUrl?: string | null;
        tagline?: string | null;
        city?: string | null;
        user?: { firstName?: string | null; lastName?: string | null };
      }
    | undefined;

  const confRaw = raw.confirmations as
    | Array<{ role: string; type: string; confirmedAt: Date | string }>
    | undefined;

  const confirmations =
    confRaw?.map((c) => ({
      role: c.role,
      type: c.type,
      confirmedAt:
        c.confirmedAt instanceof Date
          ? c.confirmedAt.toISOString()
          : String(c.confirmedAt),
    })) ?? [];

  const complaintsRaw = raw.complaints as Array<{ id?: string }> | undefined;
  const complaintIdFromList =
    complaintsRaw?.[0]?.id != null ? String(complaintsRaw[0].id) : null;
  const complaintIdTopLevel =
    typeof raw.complaintId === "string" ? raw.complaintId : null;

  const givenServiceId = String(
    raw.givenServiceId ?? gs?.id ?? "",
  ).trim();

  return {
    id: String(raw.id),
    providerId: String(raw.providerId ?? ""),
    givenServiceId,
    status: raw.status as AppointmentStatus,
    scheduledDate: toYmd(raw.scheduledDate as string) ?? "",
    scheduledTime: String(raw.scheduledTime ?? ""),
    notes: (raw.notes as string | null) ?? null,
    photoUrls: pickApiStringArray(raw, "photoUrls", "photo_urls"),
    refusalReason: (raw.refusalReason as string | null) ?? null,
    rescheduleDate: toYmd(raw.rescheduleDate as string | null),
    rescheduleTime: (raw.rescheduleTime as string | null) ?? null,
    createdAt: toIsoString(raw.createdAt),
    confirmedAt: toIsoString(raw.confirmedAt),
    enRouteAt: toIsoString(raw.enRouteAt),
    startedAt: toIsoString(raw.startedAt),
    completedAt: toIsoString(raw.completedAt),
    durationMinutes:
      raw.durationMinutes != null ? Number(raw.durationMinutes) : null,
    beforePhotoUrls: pickApiStringArray(
      raw,
      "beforePhotoUrls",
      "before_photo_urls",
    ),
    afterPhotoUrls: pickApiStringArray(
      raw,
      "afterPhotoUrls",
      "after_photo_urls",
    ),
    cancellationReason: (raw.cancellationReason as string | null) ?? null,
    cancelledBy: (raw.cancelledBy as string | null) ?? null,
    givenService: {
      serviceName: pickLocaleName(service?.translations),
      categoryName: pickLocaleName(service?.category?.translations),
      price: Number(gs?.price ?? 0),
      pricingType: String(gs?.pricingType ?? ""),
      estimatedDurationMinutes:
        gs?.estimatedDurationMinutes != null
          ? Number(gs.estimatedDurationMinutes)
          : null,
    },
    provider: {
      firstName: prov?.user?.firstName?.trim() ?? "",
      lastName: prov?.user?.lastName?.trim() ?? "",
      photoUrl: prov?.photoUrl ?? null,
      tagline: prov?.tagline?.trim() ?? null,
      city: prov?.city?.trim() ?? "",
    },
    confirmations,
    complaintId: complaintIdFromList ?? complaintIdTopLevel,
  };
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

function getClientAppointmentConfirmCopy(
  kind: ClientAppointmentConfirmModal["kind"],
  appt: ClientAppointmentDetailModel,
): {
  title: string;
  message: string;
  cancelLabel: string;
  confirmLabel: string;
  confirmVariant: "primary" | "destructive";
} {
  const rescheduleLine = formatRescheduleDetail(
    appt.rescheduleDate,
    appt.rescheduleTime,
  );
  switch (kind) {
    case "cancel_request":
      return {
        title: "Cancel request?",
        message: "The provider will no longer see this booking request.",
        cancelLabel: "Keep request",
        confirmLabel: "Cancel",
        confirmVariant: "destructive",
      };
    case "cancel_confirmed":
      return {
        title: "Cancel appointment?",
        message: "You may be subject to the provider's cancellation policy.",
        cancelLabel: "Keep",
        confirmLabel: "Cancel appointment",
        confirmVariant: "destructive",
      };
    case "decline_reschedule":
      return {
        title: "Decline new time?",
        message:
          "Your visit will stay at the originally scheduled date and time.",
        cancelLabel: "Go back",
        confirmLabel: "Decline proposal",
        confirmVariant: "destructive",
      };
    case "accept_reschedule":
      return {
        title: "Accept new time?",
        message: rescheduleLine
          ? `Your appointment will move to ${rescheduleLine}.`
          : "Your appointment will move to the proposed new time.",
        cancelLabel: "Go back",
        confirmLabel: "Accept",
        confirmVariant: "primary",
      };
    default:
      return {
        title: "",
        message: "",
        cancelLabel: "Close",
        confirmLabel: "OK",
        confirmVariant: "primary",
      };
  }
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

function hasConf(
  a: ClientAppointmentDetailModel,
  role: string,
  type: string,
): boolean {
  return a.confirmations.some((c) => c.role === role && c.type === type);
}

function formatElapsed(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function statusBannerMeta(status: AppointmentStatus): {
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
    case "DISPUTED":
      return {
        bg: "#FEF2F2",
        border: "#FECACA",
        text: "#DC2626",
        icon: "flag",
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

function statusLabel(status: AppointmentStatus): string {
  return status.replace(/_/g, " ");
}

const STATUS_STEPS: { key: AppointmentStatus; label: string }[] = [
  { key: "PENDING", label: "Order Sent" },
  { key: "CONFIRMED", label: "Provider Confirmed" },
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

function timelineStatusKey(status: AppointmentStatus): AppointmentStatus {
  if (status === "RESCHEDULED") return "CONFIRMED";
  if (STATUS_ORDER.includes(status)) return status;
  return "PENDING";
}

type TimelineProgress = {
  doneThrough: number;
  activeIdx: number;
};

/**
 * Completed steps (through `doneThrough`) show a checkmark.
 * The green line runs to `activeIdx`; that step shows the active green circle.
 * COMPLETED: all checkmarks and a full green track.
 */
function getTimelineProgress(status: AppointmentStatus): TimelineProgress {
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
  status: AppointmentStatus,
  times: TimelineTimestamps,
): string | null {
  switch (stepKey) {
    case "PENDING":
      return times.createdAt
        ? `Sent at ${formatDateTime(times.createdAt)}`
        : null;
    case "CONFIRMED":
      if (state === "active" && status === "PENDING") {
        return "Waiting for provider";
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
  status: AppointmentStatus;
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

type AppointmentPhotoCarouselProps = {
  photos: string[];
  accessibilityLabelPrefix: string;
  groupLabel?: string;
  style?: ViewStyle;
};

function AppointmentPhotoCarousel({
  photos,
  accessibilityLabelPrefix,
  groupLabel,
  style,
}: AppointmentPhotoCarouselProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const lightboxRef = useRef<FlatList<string>>(null);

  const carouselLayout = useMemo(() => {
    const cardInset = 16 * 2 + 20 * 2;
    const slideW = Math.max(200, windowWidth - cardInset);
    const slideH = Math.round(slideW * 0.56);
    const snapInterval = slideW + REF_PHOTO_CAROUSEL_GAP;
    return { slideW, slideH, snapInterval };
  }, [windowWidth]);

  useEffect(() => {
    setCarouselIndex(0);
  }, [photos]);

  useEffect(() => {
    if (!lightboxOpen || photos.length === 0) return;
    const idx = Math.min(Math.max(0, lightboxIndex), photos.length - 1);
    const id = setTimeout(() => {
      try {
        lightboxRef.current?.scrollToIndex({ index: idx, animated: false });
      } catch {
        /* layout not ready */
      }
    }, 32);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- index read from opening render only
  }, [lightboxOpen, photos.length]);

  if (photos.length === 0) return null;

  return (
    <View style={style}>
      {groupLabel ? (
        <Text style={photoCarouselStyles.groupLabel}>{groupLabel}</Text>
      ) : null}
      <FlatList
        data={photos}
        keyExtractor={(uri, index) => `${uri}-${index}`}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={carouselLayout.snapInterval}
        snapToAlignment="start"
        disableIntervalMomentum
        ItemSeparatorComponent={() => (
          <View style={{ width: REF_PHOTO_CAROUSEL_GAP }} />
        )}
        renderItem={({ item: uri, index }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${accessibilityLabelPrefix} ${index + 1} of ${photos.length}. Opens full screen.`}
            onPress={() => {
              setLightboxIndex(index);
              setLightboxOpen(true);
            }}
            style={[
              photoCarouselStyles.slide,
              {
                width: carouselLayout.slideW,
                height: carouselLayout.slideH,
              },
            ]}
          >
            <Image
              source={{ uri }}
              style={photoCarouselStyles.slideImage}
              resizeMode="cover"
            />
          </Pressable>
        )}
        onMomentumScrollEnd={(e) => {
          const snap = carouselLayout.snapInterval;
          const idx = Math.round(e.nativeEvent.contentOffset.x / snap);
          setCarouselIndex(
            Math.min(photos.length - 1, Math.max(0, idx)),
          );
        }}
      />
      {photos.length > 1 ? (
        <View style={photoCarouselStyles.dotsRow}>
          {photos.map((uri, i) => (
            <View
              key={`${uri}-dot-${i}`}
              style={[
                photoCarouselStyles.dot,
                i === carouselIndex && photoCarouselStyles.dotActive,
              ]}
            />
          ))}
        </View>
      ) : null}

      <Modal
        visible={lightboxOpen}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => setLightboxOpen(false)}
      >
        <View style={photoCarouselStyles.lightboxRoot}>
          <StatusBar barStyle="light-content" />
          <FlatList
            ref={lightboxRef}
            style={photoCarouselStyles.lightboxList}
            data={photos}
            keyExtractor={(uri, index) => `lb-${uri}-${index}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialNumToRender={3}
            onScrollToIndexFailed={({ index }) => {
              setTimeout(() => {
                try {
                  lightboxRef.current?.scrollToIndex({
                    index,
                    animated: false,
                  });
                } catch {
                  /* noop */
                }
              }, 120);
            }}
            getItemLayout={(_, index) => ({
              length: windowWidth,
              offset: windowWidth * index,
              index,
            })}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(
                e.nativeEvent.contentOffset.x / windowWidth,
              );
              setLightboxIndex(
                Math.min(photos.length - 1, Math.max(0, idx)),
              );
            }}
            renderItem={({ item: uri }) => (
              <View
                style={[
                  photoCarouselStyles.lightboxPage,
                  { width: windowWidth, height: windowHeight },
                ]}
              >
                <Image
                  source={{ uri }}
                  style={{
                    width: windowWidth,
                    height: Math.max(280, Math.floor(windowHeight * 0.82)),
                  }}
                  resizeMode="contain"
                />
              </View>
            )}
          />
          <TouchableOpacity
            style={[
              photoCarouselStyles.lightboxCloseBtn,
              { top: insets.top + 10 },
            ]}
            onPress={() => setLightboxOpen(false)}
            activeOpacity={0.85}
            accessibilityLabel="Close photo"
          >
            <Ionicons name="close" size={26} color="#FFFFFF" />
          </TouchableOpacity>
          {photos.length > 1 ? (
            <View
              pointerEvents="none"
              style={[
                photoCarouselStyles.lightboxCounter,
                { bottom: insets.bottom + 20 },
              ]}
            >
              <Text style={photoCarouselStyles.lightboxCounterText}>
                {lightboxIndex + 1} / {photos.length}
              </Text>
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const photoCarouselStyles = StyleSheet.create({
  groupLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: "#374151",
    marginBottom: 12,
  },
  slide: {
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...Platform.select({
      ios: {
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  slideImage: {
    width: "100%",
    height: "100%",
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#E2E8F0",
  },
  dotActive: {
    width: 18,
    borderRadius: 4,
    backgroundColor: "#6366F1",
  },
  lightboxRoot: {
    flex: 1,
    backgroundColor: "#0A0A0F",
  },
  lightboxList: {
    flex: 1,
    width: "100%",
    backgroundColor: "#0A0A0F",
  },
  lightboxPage: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0A0A0F",
  },
  lightboxCloseBtn: {
    position: "absolute",
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    zIndex: 2,
  },
  lightboxCounter: {
    position: "absolute",
    alignSelf: "center",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  lightboxCounterText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.4,
  },
});

export const ClientAppointmentDetailScreen: React.FC<Props> = ({
  route,
  navigation,
}) => {
  const { appointmentId } = route.params;
  const insets = useSafeAreaInsets();
  const [appointment, setAppointment] =
    useState<ClientAppointmentDetailModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmModal, setConfirmModal] =
    useState<ClientAppointmentConfirmModal | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [canReview, setCanReview] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [checkingReview, setCheckingReview] = useState(false);
  const [activeTab, setActiveTab] = useState<"status" | "details">("status");

  const loadAppointment = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      try {
        const res = await api.getAppointmentById(appointmentId);
        setAppointment(normalizeDetail(unwrapAppointmentApiPayload(res.data)));
      } catch {
        if (!opts?.silent) {
          setAppointment(null);
          Alert.alert(
            "Could not load",
            "This appointment could not be loaded.",
            [{ text: "OK", onPress: () => navigation.goBack() }],
          );
        }
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [appointmentId, navigation],
  );

  useEffect(() => {
    void loadAppointment();
  }, [loadAppointment]);

  const hasClientStart = appointment
    ? hasConf(appointment, "CLIENT", "START")
    : false;
  const hasProviderEnd = appointment
    ? hasConf(appointment, "PROVIDER", "END")
    : false;
  const hasClientEnd = appointment
    ? hasConf(appointment, "CLIENT", "END")
    : false;

  const runElapsedTimer =
    appointment?.status === "IN_PROGRESS" &&
    hasClientStart &&
    !hasProviderEnd &&
    appointment.startedAt;

  const runPolling =
    appointment?.status === "IN_PROGRESS" && hasClientStart && !hasProviderEnd;

  useEffect(() => {
    if (!runElapsedTimer || !appointment?.startedAt) {
      setElapsedSeconds(0);
      return;
    }
    const startMs = new Date(appointment.startedAt).getTime();
    const tick = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [runElapsedTimer, appointment?.startedAt]);

  useEffect(() => {
    if (!runPolling) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    pollRef.current = setInterval(() => {
      void loadAppointment({ silent: true });
    }, 15000);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [runPolling, loadAppointment]);

  useEffect(() => {
    if (appointment?.status !== "COMPLETED") {
      setCanReview(false);
      setAlreadyReviewed(false);
      setCheckingReview(false);
      return;
    }
    let cancelled = false;
    setCheckingReview(true);
    setCanReview(false);
    setAlreadyReviewed(false);
    void api
      .checkCanReview(appointmentId)
      .then((res) => {
        if (cancelled) return;
        setCanReview(res.data.canReview);
        setAlreadyReviewed(res.data.alreadyReviewed);
      })
      .catch(() => {
        if (!cancelled) {
          setCanReview(false);
          setAlreadyReviewed(false);
        }
      })
      .finally(() => {
        if (!cancelled) setCheckingReview(false);
      });
    return () => {
      cancelled = true;
    };
  }, [appointmentId, appointment?.status]);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const providerFullName = useMemo(() => {
    if (!appointment) return "";
    const n =
      `${appointment.provider.firstName} ${appointment.provider.lastName}`.trim();
    return n || "Provider";
  }, [appointment]);

  const runAction = useCallback(
    async (fn: () => Promise<unknown>, opts?: { onSuccess?: () => void }) => {
      setActionLoading(true);
      try {
        await fn();
        await loadAppointment({ silent: true });
        opts?.onSuccess?.();
      } catch {
        Alert.alert("Something went wrong", "Please try again.");
      } finally {
        setActionLoading(false);
      }
    },
    [loadAppointment],
  );

  if (loading || !appointment) {
    return (
      <View style={styles.loadingRoot}>
        <ActivityIndicator size="large" color={COLORS.primary || "#4F46E5"} />
      </View>
    );
  }

  const banner = statusBannerMeta(appointment.status);
  const initials =
    `${appointment.provider.firstName?.[0] ?? ""}${appointment.provider.lastName?.[0] ?? ""}`.toUpperCase() ||
    "?";

  const priceLabel =
    appointment.givenService.pricingType === "HOURLY"
      ? `$${appointment.givenService.price} / hr`
      : `$${appointment.givenService.price}`;

  const fileComplaintParams = {
    appointmentId: appointment.id,
    providerName:
      `${appointment.provider.firstName} ${appointment.provider.lastName}`.trim(),
    serviceName: appointment.givenService.serviceName,
  };

  const openProviderProfile = () => {
    if (!appointment.givenServiceId) {
      Alert.alert(
        "Unavailable",
        "Provider profile is not available for this booking.",
      );
      return;
    }
    navigation.navigate("ClientProviderProfile", {
      givenServiceId: appointment.givenServiceId,
    });
  };

  const openComplaintDetail = async () => {
    let complaintId = appointment.complaintId;
    if (!complaintId) {
      try {
        const res = await api.getMyComplaints();
        const items = Array.isArray(res.data) ? res.data : [];
        for (const raw of items) {
          if (!raw || typeof raw !== "object") continue;
          const row = raw as Record<string, unknown>;
          if (
            row.appointmentId === appointment.id &&
            typeof row.id === "string"
          ) {
            complaintId = row.id;
            break;
          }
        }
      } catch {
        Alert.alert(
          "Could not load complaint",
          "Please try again from My complaints.",
        );
        return;
      }
    }
    if (complaintId) {
      navigation.navigate("ClientComplaintDetail", { complaintId });
    } else {
      navigation.navigate("ClientMyComplaints");
    }
  };

  const showReportProblemLink =
    appointment.status === "COMPLETED" ||
    appointment.status === "IN_PROGRESS" ||
    appointment.status === "EN_ROUTE" ||
    appointment.status === "DISPUTED";

  const reportProblemLink = (opts?: { marginTop?: number }) =>
    showReportProblemLink ? (
      <TouchableOpacity
        style={[
          styles.reportProblemLinkRow,
          opts?.marginTop != null ? { marginTop: opts.marginTop } : null,
        ]}
        onPress={() =>
          navigation.navigate("ClientFileComplaint", fileComplaintParams)
        }
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      >
        <Ionicons
          name="flag-outline"
          size={16}
          color={COLORS.error || "#EF4444"}
        />
        <Text style={styles.reportProblemLinkText}>Report a problem</Text>
      </TouchableOpacity>
    ) : null;

  const showAwaitingClientStart =
    appointment.status === "IN_PROGRESS" && !hasClientStart;

  const showTimerPhase =
    appointment.status === "IN_PROGRESS" && hasClientStart && !hasProviderEnd;

  const showConfirmComplete =
    appointment.status === "IN_PROGRESS" && hasProviderEnd && !hasClientEnd;

  const hasInterventionPhotos =
    appointment.beforePhotoUrls.length > 0 ||
    appointment.afterPhotoUrls.length > 0;

  const interventionPhotosSection = hasInterventionPhotos ? (
    <View style={[styles.card, styles.interventionPhotosCard]}>
      <SectionHeader icon="images-outline" title="Service Photos" />
      {appointment.beforePhotoUrls.length > 0 ? (
        <AppointmentPhotoCarousel
          photos={appointment.beforePhotoUrls}
          groupLabel="Before"
          accessibilityLabelPrefix="Before service photo"
        />
      ) : null}
      {appointment.afterPhotoUrls.length > 0 ? (
        <AppointmentPhotoCarousel
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

  const appointmentRef = `#${appointment.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
  const showTimeline = ![
    "REFUSED",
    "CANCELLED_CLIENT",
    "CANCELLED_PROVIDER",
    "DISPUTED",
  ].includes(appointment.status);

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
            {statusLabel(appointment.status)}
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
      >
        {activeTab === "status" ? (
          <>
            {showTimeline ? (
              <View style={styles.card}>
                <SectionHeader icon="list-outline" title="Order Status" />
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
              </View>
            ) : null}

            {appointment.status === "DISPUTED" ? (
              <View style={styles.disputedStatusBanner}>
                <View style={styles.disputedStatusIconWrap}>
                  <Ionicons
                    name="flag"
                    size={22}
                    color={COLORS.error || "#EF4444"}
                  />
                </View>
                <View style={styles.disputedTextWrap}>
                  <Text style={styles.disputedStatusTitle}>
                    Complaint in progress
                  </Text>
                  <Text style={styles.disputedStatusSubtitle}>
                    A complaint has been filed for this appointment. Our team is
                    reviewing it.
                  </Text>
                  <TouchableOpacity
                    onPress={() => void openComplaintDetail()}
                    hitSlop={{ top: 8, bottom: 8 }}
                    style={styles.disputedViewComplaintBtn}
                  >
                    <Text style={styles.disputedViewComplaintLink}>
                      View details
                    </Text>
                    <Ionicons
                      name="arrow-forward"
                      size={14}
                      color={COLORS.error || "#EF4444"}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {appointment.status === "PENDING" ? (
              <View style={styles.actionBlock}>
                <View style={styles.infoCard}>
                  <Ionicons name="hourglass" size={22} color="#D97706" />
                  <Text style={styles.infoCardText}>
                    Waiting for {providerFullName} to confirm your request.
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.btnOutlineRed,
                    actionLoading && styles.btnDisabled,
                  ]}
                  disabled={actionLoading}
                  onPress={() => setConfirmModal({ kind: "cancel_request" })}
                >
                  <Text style={styles.btnOutlineRedText}>Cancel Request</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {appointment.status === "CONFIRMED" ? (
              <View style={styles.actionBlock}>
                <View style={styles.successCard}>
                  <Ionicons name="checkmark-circle" size={22} color="#059669" />
                  <Text style={styles.successCardText}>
                    Confirmed for {formatLongDate(appointment.scheduledDate)}.
                  </Text>
                </View>
                <TouchableOpacity
                  disabled={actionLoading}
                  onPress={() => setConfirmModal({ kind: "cancel_confirmed" })}
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
                      New time proposed
                    </Text>
                  </View>
                  <Text style={styles.rescheduleTime}>
                    {formatRescheduleDetail(
                      appointment.rescheduleDate,
                      appointment.rescheduleTime,
                    )}
                  </Text>
                  <View style={styles.rescheduleButtonRow}>
                    <TouchableOpacity
                      style={[
                        styles.btnOutlineRed,
                        styles.flex1,
                        actionLoading && styles.btnDisabled,
                      ]}
                      disabled={actionLoading}
                      onPress={() =>
                        setConfirmModal({ kind: "decline_reschedule" })
                      }
                    >
                      <Text style={styles.btnOutlineRedText}>Decline</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.btnPrimaryGreen,
                        styles.flex1,
                        actionLoading && styles.btnDisabled,
                      ]}
                      disabled={actionLoading}
                      onPress={() =>
                        setConfirmModal({ kind: "accept_reschedule" })
                      }
                    >
                      <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                      <Text style={styles.btnPrimaryGreenText}>Accept</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ) : null}

            {appointment.status === "EN_ROUTE" ? (
              <View style={styles.actionBlock}>
                <View style={styles.enRouteCard}>
                  <View style={styles.enRouteIconWrap}>
                    <Ionicons name="car" size={28} color="#0284C7" />
                  </View>
                  <Text style={styles.enRouteText}>
                    Provider is on the way!
                  </Text>
                  {appointment.enRouteAt ? (
                    <Text style={styles.enRouteSub}>
                      Departed at {formatTimeOnly(appointment.enRouteAt)}
                    </Text>
                  ) : null}
                </View>
                {reportProblemLink({ marginTop: 12 })}
              </View>
            ) : null}

            {showAwaitingClientStart ? (
              <View style={styles.actionBlock}>
                <View style={styles.awaitingCard}>
                  <View style={styles.awaitingIconWrap}>
                    <Ionicons name="location" size={22} color="#5B21B6" />
                  </View>
                  <Text style={styles.awaitingText}>
                    Provider has arrived. Please confirm to start the service.
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.btnPrimary,
                    actionLoading && styles.btnDisabled,
                  ]}
                  disabled={actionLoading}
                  onPress={() =>
                    void runAction(() =>
                      api.clientConfirm(appointmentId, { type: "START" }),
                    )
                  }
                >
                  <Ionicons name="play" size={18} color="#FFFFFF" />
                  <Text style={styles.btnPrimaryText}>Start Service</Text>
                </TouchableOpacity>
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

            {showConfirmComplete ? (
              <View style={styles.actionBlock}>
                <TouchableOpacity
                  style={[
                    styles.btnPrimaryGreen,
                    actionLoading && styles.btnDisabled,
                  ]}
                  disabled={actionLoading}
                  onPress={() =>
                    void runAction(() =>
                      api.clientConfirm(appointmentId, { type: "END" }),
                    )
                  }
                >
                  <Ionicons name="checkmark-done" size={20} color="#FFFFFF" />
                  <Text style={styles.btnPrimaryGreenText}>
                    Confirm Service Complete
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {appointment.status === "IN_PROGRESS"
              ? reportProblemLink({ marginTop: 12 })
              : null}

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

                {checkingReview ? (
                  <View style={styles.reviewCheckRow}>
                    <ActivityIndicator size="small" color="#D97706" />
                  </View>
                ) : canReview && !alreadyReviewed ? (
                  <View style={styles.reviewPromoCard}>
                    <View style={styles.reviewPromoHeader}>
                      <View style={styles.reviewPromoIconWrap}>
                        <Ionicons name="star" size={24} color="#D97706" />
                      </View>
                      <View style={styles.reviewPromoHeaderText}>
                        <Text style={styles.reviewPromoTitle}>
                          How was your experience?
                        </Text>
                        <Text style={styles.reviewPromoSub}>
                          Help others by sharing your feedback.
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.reviewPromoBtn}
                      activeOpacity={0.88}
                      onPress={() =>
                        navigation.navigate("ClientLeaveReview", {
                          appointmentId: appointment.id,
                          providerName:
                            `${appointment.provider.firstName} ${appointment.provider.lastName}`.trim(),
                          serviceName: appointment.givenService.serviceName,
                          providerPhoto: appointment.provider.photoUrl ?? null,
                        })
                      }
                    >
                      <Text style={styles.reviewPromoBtnText}>
                        Leave a review
                      </Text>
                      <Ionicons
                        name="arrow-forward"
                        size={16}
                        color="#FFFFFF"
                      />
                    </TouchableOpacity>
                  </View>
                ) : alreadyReviewed ? (
                  <View style={styles.reviewedChip}>
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color="#047857"
                    />
                    <Text style={styles.reviewedChipText}>
                      You reviewed this appointment
                    </Text>
                  </View>
                ) : null}

                {reportProblemLink({ marginTop: 14 })}
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
                <TouchableOpacity
                  style={styles.btnPrimary}
                  onPress={() => {
                    navigation.popToTop();
                    navigation.navigate("ClientSearchProvider", undefined);
                  }}
                >
                  <Ionicons name="search" size={18} color="#FFFFFF" />
                  <Text style={styles.btnPrimaryText}>
                    Find Another Provider
                  </Text>
                </TouchableOpacity>
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
                      ? "Cancelled by you"
                      : "Cancelled by provider"}
                  </Text>
                  {appointment.cancellationReason ? (
                    <View style={styles.cancelledReasonBox}>
                      <Text style={styles.cancelledReason}>
                        "{appointment.cancellationReason}"
                      </Text>
                    </View>
                  ) : null}
                </View>
                <TouchableOpacity
                  style={styles.btnPrimary}
                  onPress={() => {
                    navigation.popToTop();
                    navigation.navigate("ClientHome");
                  }}
                >
                  <Ionicons
                    name="add-circle-outline"
                    size={20}
                    color="#FFFFFF"
                  />
                  <Text style={styles.btnPrimaryText}>Book Again</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        ) : null}

        {activeTab === "details" ? (
          <>
            <Pressable
              style={({ pressed }) => [
                styles.card,
                styles.providerCardPressable,
                pressed && appointment.givenServiceId && styles.cardPressed,
              ]}
              onPress={openProviderProfile}
              disabled={!appointment.givenServiceId}
              accessibilityRole="button"
              accessibilityLabel={`View ${providerFullName} profile`}
            >
              <View style={styles.providerRow}>
                {appointment.provider.photoUrl ? (
                  <Image
                    source={{ uri: appointment.provider.photoUrl }}
                    style={styles.avatar}
                  />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarInitials}>{initials}</Text>
                  </View>
                )}
                <View style={styles.providerText}>
                  <Text style={styles.providerName}>{providerFullName}</Text>
                  {appointment.provider.tagline ? (
                    <Text style={styles.tagline} numberOfLines={1}>
                      {appointment.provider.tagline}
                    </Text>
                  ) : null}
                  {appointment.provider.city ? (
                    <View style={styles.cityRow}>
                      <Ionicons
                        name="location-outline"
                        size={14}
                        color="#94A3B8"
                      />
                      <Text style={styles.city}>
                        {appointment.provider.city}
                      </Text>
                    </View>
                  ) : null}
                </View>
                {appointment.givenServiceId ? (
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color="#94A3B8"
                  />
                ) : null}
              </View>
            </Pressable>

            <View style={styles.card}>
              <SectionHeader icon="briefcase-outline" title="Booking Details" />
              <View style={styles.serviceHeader}>
                <View style={styles.serviceInfo}>
                  <Text style={styles.serviceTitle}>
                    {appointment.givenService.serviceName || "Service"}
                  </Text>
                  <View style={styles.categoryChip}>
                    <Text style={styles.categoryChipText}>
                      {appointment.givenService.categoryName || "Uncategorized"}
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
              {appointment.provider.city ? (
                <DetailRow
                  icon="location-outline"
                  label="City"
                  value={appointment.provider.city}
                />
              ) : null}
            </View>

            {appointment.notes ? (
              <View style={styles.notesAmberCard}>
                <Text style={styles.notesAmberLabel}>Notes for provider</Text>
                <Text style={styles.notesAmberText}>{appointment.notes}</Text>
              </View>
            ) : null}

            {appointment.photoUrls.length > 0 ? (
              <View style={styles.card}>
                <SectionHeader icon="images-outline" title="Reference Photos" />
                <AppointmentPhotoCarousel
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

            {appointment.status === "PENDING" ||
            appointment.status === "CONFIRMED" ? (
              <TouchableOpacity
                style={[
                  styles.btnCancelFull,
                  actionLoading && styles.btnDisabled,
                ]}
                disabled={actionLoading}
                onPress={() =>
                  setConfirmModal(
                    appointment.status === "PENDING"
                      ? { kind: "cancel_request" }
                      : { kind: "cancel_confirmed" },
                  )
                }
              >
                <Text style={styles.btnCancelFullText}>Cancel Appointment</Text>
              </TouchableOpacity>
            ) : null}

            {reportProblemLink()}
          </>
        ) : null}
      </ScrollView>

      {confirmModal ? (
        <ConfirmModal
          visible
          onDismiss={() => !actionLoading && setConfirmModal(null)}
          loading={actionLoading}
          {...getClientAppointmentConfirmCopy(confirmModal.kind, appointment)}
          onConfirm={() => {
            const close = () => setConfirmModal(null);
            switch (confirmModal.kind) {
              case "cancel_request":
              case "cancel_confirmed":
                void runAction(() => api.cancelAppointment(appointmentId, {}), {
                  onSuccess: close,
                });
                break;
              case "decline_reschedule":
                void runAction(
                  () =>
                    api.clientRespondReschedule(appointmentId, {
                      action: "CANCELLED_CLIENT",
                    }),
                  { onSuccess: close },
                );
                break;
              case "accept_reschedule":
                void runAction(
                  () =>
                    api.clientRespondReschedule(appointmentId, {
                      action: "CONFIRMED",
                    }),
                  { onSuccess: close },
                );
                break;
              default:
                close();
            }
          }}
        />
      ) : null}

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
  /** Balances back button so title stays centered; no visible control. */
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
  disputedStatusBanner: {
    flexDirection: "row",
    borderRadius: 24,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    gap: 12,
  },
  disputedStatusIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  disputedTextWrap: {
    flex: 1,
  },
  disputedStatusTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#991B1B",
    marginBottom: 4,
  },
  disputedStatusSubtitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#B91C1C",
    lineHeight: 20,
    marginBottom: 10,
  },
  disputedViewComplaintBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  disputedViewComplaintLink: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.error || "#EF4444",
  },
  reportProblemLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
  },
  reportProblemLinkText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.error || "#EF4444",
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
  providerCardPressable: {
    marginBottom: 12,
  },
  cardPressed: {
    opacity: 0.92,
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
  btnCancelFull: {
    marginBottom: 8,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
    alignItems: "center",
  },
  btnCancelFullText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#EF4444",
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
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  sectionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(79, 70, 229, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#374151",
    letterSpacing: 0.3,
  },
  providerRow: {
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
  providerText: {
    flex: 1,
    justifyContent: "center",
  },
  providerName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  tagline: {
    marginTop: 4,
    fontSize: 14,
    color: "#6B7280",
  },
  cityRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  city: {
    fontSize: 13,
    color: "#9CA3AF",
    fontWeight: "500",
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
  category: {
    marginTop: 4,
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
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
  divider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginVertical: 16,
  },
  detailList: {
    gap: 12,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  detailIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  detailText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
  },
  notesSection: {
    marginTop: 20,
  },
  notesLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  notesBox: {
    padding: 16,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  notes: {
    fontSize: 15,
    color: "#374151",
    lineHeight: 22,
  },
  photosSection: {
    marginTop: 20,
  },
  photosLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  photoRow: {
    gap: 12,
  },
  photoThumb: {
    width: 110,
    height: 110,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
  },
  actionBlock: {
    marginBottom: 16,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  infoCardText: {
    fontSize: 15,
    color: "#92400E",
    fontWeight: "600",
    flex: 1,
    lineHeight: 22,
  },
  successCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  successCardText: {
    fontSize: 15,
    color: "#065F46",
    fontWeight: "600",
    flex: 1,
    lineHeight: 22,
  },
  btnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#6366F1",
    borderRadius: 16,
    minHeight: 52,
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 4,
  },
  btnPrimaryText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
  btnOutlineRed: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
    borderRadius: 16,
    minHeight: 54,
  },
  btnOutlineRedText: {
    color: "#DC2626",
    fontWeight: "700",
    fontSize: 16,
  },
  btnPrimaryGreen: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.secondary || "#10B981",
    borderRadius: 16,
    minHeight: 54,
  },
  btnPrimaryGreenText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
  btnDisabled: {
    opacity: 0.65,
  },
  flex1: {
    flex: 1,
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
    marginBottom: 20,
    lineHeight: 22,
  },
  rescheduleButtonRow: {
    flexDirection: "row",
    gap: 12,
  },
  cancelLinkWrap: {
    alignItems: "center",
    paddingVertical: 12,
  },
  linkDanger: {
    color: "#DC2626",
    fontWeight: "700",
    fontSize: 15,
  },
  enRouteCard: {
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "#BFDBFE",
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
    fontSize: 15,
    fontWeight: "600",
    color: "#5B21B6",
    flex: 1,
    lineHeight: 22,
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
  reviewCheckRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 16,
    minHeight: 28,
  },
  reviewPromoCard: {
    backgroundColor: "#FFFBEB",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  reviewPromoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 16,
  },
  reviewPromoIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "rgba(217, 119, 6, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  reviewPromoHeaderText: {
    flex: 1,
  },
  reviewPromoTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#92400E",
  },
  reviewPromoSub: {
    marginTop: 4,
    fontSize: 14,
    color: "#B45309",
    fontWeight: "500",
    lineHeight: 20,
  },
  reviewPromoBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#D97706",
    borderRadius: 14,
    minHeight: 48,
  },
  reviewPromoBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
  reviewedChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 6,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(5, 150, 105, 0.25)",
  },
  reviewedChipText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#047857",
  },
  interventionPhotosCard: {
    marginTop: 16,
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
});
