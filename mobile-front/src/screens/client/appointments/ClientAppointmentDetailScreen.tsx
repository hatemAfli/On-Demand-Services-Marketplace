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
  Image,
  ScrollView,
  StyleSheet,
  Text,
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
import { useAppTranslation } from "../../../hooks/useAppTranslation";
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

export type ClientAppointmentDetailModel = {
  id: string;
  providerId: string;
  status: AppointmentStatus;
  scheduledDate: string;
  scheduledTime: string;
  notes: string | null;
  photoUrls: string[];
  refusalReason: string | null;
  rescheduleDate: string | null;
  rescheduleTime: string | null;
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

  return {
    id: String(raw.id),
    providerId: String(raw.providerId ?? ""),
    status: raw.status as AppointmentStatus,
    scheduledDate: toYmd(raw.scheduledDate as string) ?? "",
    scheduledTime: String(raw.scheduledTime ?? ""),
    notes: (raw.notes as string | null) ?? null,
    photoUrls: pickApiStringArray(raw, "photoUrls", "photo_urls"),
    refusalReason: (raw.refusalReason as string | null) ?? null,
    rescheduleDate: toYmd(raw.rescheduleDate as string | null),
    rescheduleTime: (raw.rescheduleTime as string | null) ?? null,
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
    afterPhotoUrls: pickApiStringArray(raw, "afterPhotoUrls", "after_photo_urls"),
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
  text: string;
  icon: keyof typeof Ionicons.glyphMap;
} {
  switch (status) {
    case "PENDING":
      return { bg: "#FFFBEB", text: "#D97706", icon: "time-outline" };
    case "CONFIRMED":
      return {
        bg: "#EFF6FF",
        text: "#0284C7",
        icon: "checkmark-circle-outline",
      };
    case "RESCHEDULED":
      return { bg: "#FFF7ED", text: "#EA580C", icon: "calendar-outline" };
    case "EN_ROUTE":
      return { bg: "#EFF6FF", text: "#0284C7", icon: "car-outline" };
    case "IN_PROGRESS":
      return { bg: "#EEF2FF", text: "#4F46E5", icon: "construct-outline" };
    case "COMPLETED":
      return { bg: "#ECFDF5", text: "#059669", icon: "checkmark-done-outline" };
    case "REFUSED":
      return { bg: "#FEF2F2", text: "#DC2626", icon: "close-circle-outline" };
    case "CANCELLED_CLIENT":
    case "CANCELLED_PROVIDER":
      return { bg: "#F3F4F6", text: "#6B7280", icon: "ban-outline" };
    case "DISPUTED":
      return { bg: "#FEF2F2", text: "#DC2626", icon: "flag" };
    default:
      return { bg: "#F3F4F6", text: "#6B7280", icon: "ellipse-outline" };
  }
}

function statusLabel(status: AppointmentStatus): string {
  return status.replace(/_/g, " ");
}

export const ClientAppointmentDetailScreen: React.FC<Props> = ({
  route,
  navigation,
}) => {
  const { appointmentId } = route.params;
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { t } = useAppTranslation();
  const interventionThumbSize = Math.floor((windowWidth - 32 - 36 - 12) / 2);

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
    navigation.setOptions({
      title: t("client.screenTitles.ClientAppointmentDetail"),
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBack}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color={COLORS.text?.primary || "#111827"}
          />
        </TouchableOpacity>
      ),
    });
  }, [navigation, t]);

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
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIconWrap}>
          <Ionicons
            name="images-outline"
            size={16}
            color={COLORS.primary || "#4F46E5"}
          />
        </View>
        <Text style={styles.sectionTitle}>Service photos</Text>
      </View>
      {appointment.beforePhotoUrls.length > 0 ? (
        <View style={styles.interventionPhotoGroup}>
          <Text style={styles.gridLabel}>Before</Text>
          <View style={styles.grid}>
            {appointment.beforePhotoUrls.map((uri) => (
              <Image
                key={uri}
                source={{ uri }}
                style={[
                  styles.gridImg,
                  {
                    width: interventionThumbSize,
                    height: interventionThumbSize,
                  },
                ]}
              />
            ))}
          </View>
        </View>
      ) : null}
      {appointment.afterPhotoUrls.length > 0 ? (
        <View
          style={[
            styles.interventionPhotoGroup,
            appointment.beforePhotoUrls.length > 0
              ? styles.interventionPhotoGroupSpaced
              : null,
          ]}
        >
          <Text style={styles.gridLabel}>After</Text>
          <View style={styles.grid}>
            {appointment.afterPhotoUrls.map((uri) => (
              <Image
                key={uri}
                source={{ uri }}
                style={[
                  styles.gridImg,
                  {
                    width: interventionThumbSize,
                    height: interventionThumbSize,
                  },
                ]}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  ) : null;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Banner */}
        {appointment.status === "DISPUTED" ? (
          <View style={styles.disputedStatusBanner}>
            <View style={styles.disputedStatusIconWrap}>
              <Ionicons
                name="flag"
                size={24}
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
                onPress={() => navigation.navigate("ClientMyComplaints")}
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
        ) : (
          <View style={[styles.statusBanner, { backgroundColor: banner.bg }]}>
            <View style={styles.statusBadgeIcon}>
              <Ionicons name={banner.icon} size={22} color={banner.text} />
            </View>
            <Text style={[styles.statusBannerText, { color: banner.text }]}>
              {statusLabel(appointment.status)}
            </Text>
          </View>
        )}

        {/* Provider Card */}
        <View style={styles.card}>
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
                  <Ionicons name="location-sharp" size={14} color="#9CA3AF" />
                  <Text style={styles.city}>{appointment.provider.city}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* Service & Booking Details Card */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconWrap}>
              <Ionicons
                name="briefcase"
                size={16}
                color={COLORS.primary || "#4F46E5"}
              />
            </View>
            <Text style={styles.sectionTitle}>Booking Details</Text>
          </View>

          <View style={styles.serviceHeader}>
            <View style={styles.serviceInfo}>
              <Text style={styles.serviceTitle}>
                {appointment.givenService.serviceName || "Service"}
              </Text>
              <Text style={styles.category}>
                {appointment.givenService.categoryName || "Uncategorized"}
              </Text>
            </View>
            <View style={styles.priceWrap}>
              <Text style={styles.priceTag}>{priceLabel}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailList}>
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="calendar-clear" size={18} color="#6B7280" />
              </View>
              <Text style={styles.detailText}>
                {formatBookingDateTime(
                  appointment.scheduledDate,
                  appointment.scheduledTime,
                )}
              </Text>
            </View>

            {appointment.givenService.estimatedDurationMinutes != null ? (
              <View style={styles.detailRow}>
                <View style={styles.detailIcon}>
                  <Ionicons name="time" size={18} color="#6B7280" />
                </View>
                <Text style={styles.detailText}>
                  Est. {appointment.givenService.estimatedDurationMinutes}{" "}
                  minutes
                </Text>
              </View>
            ) : null}
          </View>

          {appointment.notes ? (
            <View style={styles.notesSection}>
              <Text style={styles.notesLabel}>Notes for provider</Text>
              <View style={styles.notesBox}>
                <Text style={styles.notes}>{appointment.notes}</Text>
              </View>
            </View>
          ) : null}

          {appointment.photoUrls.length > 0 ? (
            <View style={styles.photosSection}>
              <Text style={styles.photosLabel}>Reference photos</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.photoRow}
              >
                {appointment.photoUrls.map((uri) => (
                  <Image key={uri} source={{ uri }} style={styles.photoThumb} />
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>

        {interventionPhotosSection}

        {/* Action Blocks - Status Specific */}
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
                <Text style={styles.rescheduleTitle}>New time proposed</Text>
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
                  onPress={() => setConfirmModal({ kind: "accept_reschedule" })}
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
                Your provider is on the way!
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
              style={[styles.btnPrimary, actionLoading && styles.btnDisabled]}
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
              style={[styles.btnPrimary, actionLoading && styles.btnDisabled]}
              disabled={actionLoading}
              onPress={() =>
                void runAction(() =>
                  api.clientConfirm(appointmentId, { type: "END" }),
                )
              }
            >
              <Ionicons name="checkmark-done" size={20} color="#FFFFFF" />
              <Text style={styles.btnPrimaryText}>
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
                <Ionicons name="checkmark-sharp" size={32} color="#059669" />
              </View>
              <Text style={styles.completedTitle}>Service Completed</Text>
            </View>

            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconWrap}>
                  <Ionicons
                    name="list"
                    size={16}
                    color={COLORS.primary || "#4F46E5"}
                  />
                </View>
                <Text style={styles.sectionTitle}>Summary</Text>
              </View>

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
                  { borderBottomWidth: 0, paddingBottom: 0, marginBottom: 0 },
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
                  <Text style={styles.reviewPromoBtnText}>Leave a review</Text>
                  <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ) : alreadyReviewed ? (
              <View style={styles.reviewedChip}>
                <Ionicons name="checkmark-circle" size={16} color="#047857" />
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
              <Text style={styles.btnPrimaryText}>Find Another Provider</Text>
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
              <Text style={styles.cancelledTitle}>Appointment Cancelled</Text>
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
              <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
              <Text style={styles.btnPrimaryText}>Book Again</Text>
            </TouchableOpacity>
          </View>
        )}
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
    backgroundColor: "#F4F4F5",
  },
  loadingRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F4F5",
  },
  headerBack: {
    marginLeft: 4,
    padding: 8,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  statusBadgeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  statusBannerText: {
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
  },
  disputedStatusBanner: {
    flexDirection: "row",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 16,
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
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
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
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F3F4F6",
  },
  avatarFallback: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
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
    backgroundColor: COLORS.primary || "#4F46E5",
    borderRadius: 16,
    minHeight: 54,
    shadowColor: COLORS.primary || "#4F46E5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
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
  interventionPhotoGroup: {},
  interventionPhotoGroupSpaced: {
    marginTop: 16,
  },
  gridLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: "#374151",
    marginBottom: 12,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  gridImg: {
    width: "48%",
    aspectRatio: 1,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
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
