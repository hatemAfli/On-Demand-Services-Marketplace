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
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ClientStackParamList } from "../../../navigation/types";
import { COLORS } from "../../../constants";
import { api, type AppointmentStatus } from "../../../services/api";
import i18n from "../../../i18n";
import { useAppTranslation } from "../../../hooks/useAppTranslation";

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
    photoUrls: Array.isArray(raw.photoUrls) ? (raw.photoUrls as string[]) : [],
    refusalReason: (raw.refusalReason as string | null) ?? null,
    rescheduleDate: toYmd(raw.rescheduleDate as string | null),
    rescheduleTime: (raw.rescheduleTime as string | null) ?? null,
    enRouteAt: toIsoString(raw.enRouteAt),
    startedAt: toIsoString(raw.startedAt),
    completedAt: toIsoString(raw.completedAt),
    durationMinutes:
      raw.durationMinutes != null ? Number(raw.durationMinutes) : null,
    beforePhotoUrls: Array.isArray(raw.beforePhotoUrls)
      ? (raw.beforePhotoUrls as string[])
      : [],
    afterPhotoUrls: Array.isArray(raw.afterPhotoUrls)
      ? (raw.afterPhotoUrls as string[])
      : [],
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
      return { bg: "#FFFBEB", text: "#B45309", icon: "warning-outline" };
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
  const { t } = useAppTranslation();

  const [appointment, setAppointment] =
    useState<ClientAppointmentDetailModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadAppointment = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      try {
        const res = await api.getAppointmentById(appointmentId);
        setAppointment(normalizeDetail(res.data as Record<string, unknown>));
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

  const runAction = async (fn: () => Promise<unknown>) => {
    setActionLoading(true);
    try {
      await fn();
      await loadAppointment({ silent: true });
    } catch {
      Alert.alert("Something went wrong", "Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

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

  const showAwaitingClientStart =
    appointment.status === "IN_PROGRESS" && !hasClientStart;

  const showTimerPhase =
    appointment.status === "IN_PROGRESS" && hasClientStart && !hasProviderEnd;

  const showConfirmComplete =
    appointment.status === "IN_PROGRESS" && hasProviderEnd && !hasClientEnd;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Banner */}
        <View style={[styles.statusBanner, { backgroundColor: banner.bg }]}>
          <View style={styles.statusBannerInner}>
            <View style={styles.statusBadgeIcon}>
              <Ionicons name={banner.icon} size={20} color={banner.text} />
            </View>
            <Text style={[styles.statusBannerText, { color: banner.text }]}>
              {statusLabel(appointment.status)}
            </Text>
          </View>
        </View>

        {/* Provider Card */}
        <View style={styles.card}>
          <View style={styles.providerRow}>
            <View style={styles.avatarContainer}>
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
            </View>
            <View style={styles.providerText}>
              <Text style={styles.providerName}>{providerFullName}</Text>
              {appointment.provider.tagline ? (
                <Text style={styles.tagline} numberOfLines={1}>
                  {appointment.provider.tagline}
                </Text>
              ) : null}
              {appointment.provider.city ? (
                <View style={styles.cityRow}>
                  <Ionicons name="location-sharp" size={12} color="#9CA3AF" />
                  <Text style={styles.city}>{appointment.provider.city}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* Service & Booking Details Card */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Ionicons
              name="briefcase-outline"
              size={18}
              color={COLORS.primary || "#4F46E5"}
            />
            <Text style={styles.sectionTitle}>Service Details</Text>
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
            <Text style={styles.priceTag}>{priceLabel}</Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={16} color="#6B7280" />
            <Text style={styles.detailText}>
              {formatBookingDateTime(
                appointment.scheduledDate,
                appointment.scheduledTime,
              )}
            </Text>
          </View>

          {appointment.givenService.estimatedDurationMinutes != null ? (
            <View style={styles.detailRow}>
              <Ionicons name="timer-outline" size={16} color="#6B7280" />
              <Text style={styles.detailText}>
                Est. {appointment.givenService.estimatedDurationMinutes} minutes
              </Text>
            </View>
          ) : null}

          {appointment.notes ? (
            <>
              <Text style={styles.notesLabel}>Your notes</Text>
              <View style={styles.notesBox}>
                <Text style={styles.notes}>{appointment.notes}</Text>
              </View>
            </>
          ) : null}

          {appointment.photoUrls.length > 0 ? (
            <>
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
            </>
          ) : null}
        </View>

        {/* Action Blocks - Status Specific */}
        {appointment.status === "PENDING" ? (
          <View style={styles.actionBlock}>
            <View style={styles.infoCard}>
              <Ionicons name="hourglass-outline" size={20} color="#D97706" />
              <Text style={styles.infoCardText}>
                Waiting for {providerFullName} to confirm your request
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.btnOutlineRed,
                actionLoading && styles.btnDisabled,
              ]}
              disabled={actionLoading}
              onPress={() =>
                Alert.alert(
                  "Cancel request?",
                  "The provider will no longer see this booking request.",
                  [
                    { text: "Keep request", style: "cancel" },
                    {
                      text: "Cancel",
                      style: "destructive",
                      onPress: () =>
                        void runAction(() =>
                          api.cancelAppointment(appointmentId, {}),
                        ),
                    },
                  ],
                )
              }
            >
              <Text style={styles.btnOutlineRedText}>Cancel Request</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {appointment.status === "CONFIRMED" ? (
          <View style={styles.actionBlock}>
            <View style={styles.infoCard}>
              <Ionicons
                name="checkmark-circle-outline"
                size={20}
                color="#059669"
              />
              <Text style={styles.infoCardText}>
                Confirmed for {formatLongDate(appointment.scheduledDate)}
              </Text>
            </View>
            <TouchableOpacity
              disabled={actionLoading}
              onPress={() =>
                Alert.alert(
                  "Cancel appointment?",
                  "You may be subject to the provider's cancellation policy.",
                  [
                    { text: "Keep", style: "cancel" },
                    {
                      text: "Cancel",
                      style: "destructive",
                      onPress: () =>
                        void runAction(() =>
                          api.cancelAppointment(appointmentId, {}),
                        ),
                    },
                  ],
                )
              }
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
                  <Ionicons name="calendar" size={18} color="#EA580C" />
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
                    actionLoading && styles.btnDisabled,
                  ]}
                  disabled={actionLoading}
                  onPress={() =>
                    void runAction(() =>
                      api.clientRespondReschedule(appointmentId, {
                        action: "CANCELLED_CLIENT",
                      }),
                    )
                  }
                >
                  <Text style={styles.btnOutlineRedText}>Decline</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.btnPrimaryGreen,
                    actionLoading && styles.btnDisabled,
                  ]}
                  disabled={actionLoading}
                  onPress={() =>
                    void runAction(() =>
                      api.clientRespondReschedule(appointmentId, {
                        action: "CONFIRMED",
                      }),
                    )
                  }
                >
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
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
                <Ionicons name="car" size={24} color="#0284C7" />
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
          </View>
        ) : null}

        {showAwaitingClientStart ? (
          <View style={styles.actionBlock}>
            <View style={styles.awaitingCard}>
              <Ionicons
                name="checkmark-circle-outline"
                size={20}
                color="#5B21B6"
              />
              <Text style={styles.awaitingText}>
                Provider has arrived — Confirm the service has started
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
              <Ionicons name="play" size={16} color="#FFFFFF" />
              <Text style={styles.btnPrimaryText}>Confirm Service Started</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {showTimerPhase ? (
          <View style={styles.actionBlock}>
            <View style={styles.timerCard}>
              <Text style={styles.timerLarge}>
                {formatElapsed(elapsedSeconds)}
              </Text>
              <Text style={styles.timerLabel}>Service duration</Text>
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
              <Ionicons name="checkmark-done" size={16} color="#FFFFFF" />
              <Text style={styles.btnPrimaryText}>
                Confirm Service Complete
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {appointment.status === "COMPLETED" ? (
          <View style={styles.completedBlock}>
            <View style={styles.completedCard}>
              <Ionicons name="checkmark-circle" size={28} color="#059669" />
              <Text style={styles.completedTitle}>Service Completed</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Summary</Text>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Started</Text>
                  <Text style={styles.summaryValue}>
                    {formatDateTime(appointment.startedAt)}
                  </Text>
                </View>
              </View>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Ended</Text>
                  <Text style={styles.summaryValue}>
                    {formatDateTime(appointment.completedAt)}
                  </Text>
                </View>
              </View>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Duration</Text>
                  <Text style={styles.summaryValue}>
                    {appointment.durationMinutes != null
                      ? `${appointment.durationMinutes} min`
                      : "—"}
                  </Text>
                </View>
              </View>
            </View>

            {appointment.beforePhotoUrls.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.gridLabel}>Before</Text>
                <View style={styles.grid}>
                  {appointment.beforePhotoUrls.map((uri) => (
                    <Image key={uri} source={{ uri }} style={styles.gridImg} />
                  ))}
                </View>
              </View>
            ) : null}

            {appointment.afterPhotoUrls.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.gridLabel}>After</Text>
                <View style={styles.grid}>
                  {appointment.afterPhotoUrls.map((uri) => (
                    <Image key={uri} source={{ uri }} style={styles.gridImg} />
                  ))}
                </View>
              </View>
            ) : null}

            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={() =>
                navigation.navigate("ClientLeaveReview", {
                  appointmentId: appointment.id,
                  providerId: appointment.providerId,
                })
              }
            >
              <Ionicons name="star" size={16} color="#FFFFFF" />
              <Text style={styles.btnPrimaryText}>Leave a Review</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnSecondary}
              onPress={() =>
                navigation.navigate("ClientReportProblem", {
                  appointmentId: appointment.id,
                  providerId: appointment.providerId,
                })
              }
            >
              <Text style={styles.btnSecondaryText}>Report a Problem</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {appointment.status === "REFUSED" ? (
          <View style={styles.actionBlock}>
            <View style={styles.errorCard}>
              <Ionicons name="close-circle" size={28} color="#DC2626" />
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
              <Ionicons name="search" size={16} color="#FFFFFF" />
              <Text style={styles.btnPrimaryText}>Find Another Provider</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {(appointment.status === "CANCELLED_CLIENT" ||
          appointment.status === "CANCELLED_PROVIDER") && (
          <View style={styles.actionBlock}>
            <View style={styles.cancelledCard}>
              <Ionicons name="ban" size={28} color="#6B7280" />
              <Text style={styles.cancelledTitle}>Appointment Cancelled</Text>
              <Text style={styles.cancelledSubtitle}>
                {appointment.status === "CANCELLED_CLIENT"
                  ? "Cancelled by you"
                  : "Cancelled by provider"}
              </Text>
              {appointment.cancellationReason ? (
                <Text style={styles.cancelledReason}>
                  {appointment.cancellationReason}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={() => {
                navigation.popToTop();
                navigation.navigate("ClientHome");
              }}
            >
              <Ionicons name="add-circle-outline" size={16} color="#FFFFFF" />
              <Text style={styles.btnPrimaryText}>Book Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {appointment.status === "DISPUTED" ? (
          <View style={styles.actionBlock}>
            <View style={styles.disputeCard}>
              <Ionicons name="warning" size={20} color="#B45309" />
              <Text style={styles.disputeText}>
                This appointment is under review by our support team. We'll
                notify you of any updates.
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  loadingRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
  },
  headerBack: {
    marginLeft: 8,
    padding: 4,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  statusBanner: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "transparent",
  },
  statusBannerInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statusBadgeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  statusBannerText: {
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  providerRow: {
    flexDirection: "row",
    gap: 14,
  },
  avatarContainer: {
    overflow: "hidden",
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#E5E7EB",
  },
  avatarFallback: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontSize: 18,
    fontWeight: "700",
    color: "#6B7280",
  },
  providerText: {
    flex: 1,
    justifyContent: "center",
  },
  providerName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  tagline: {
    marginTop: 4,
    fontSize: 13,
    color: "#6B7280",
  },
  cityRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  city: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  serviceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
    gap: 12,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
  },
  category: {
    marginTop: 4,
    fontSize: 13,
    color: "#6B7280",
  },
  priceTag: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.primary || "#4F46E5",
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  detailText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
  },
  notesLabel: {
    marginTop: 14,
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  notesBox: {
    marginTop: 8,
    padding: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary || "#4F46E5",
  },
  notes: {
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
  },
  photosLabel: {
    marginTop: 14,
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  photoRow: {
    marginTop: 10,
    gap: 10,
  },
  photoThumb: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: "#E5E7EB",
  },
  actionBlock: {
    marginBottom: 16,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  infoCardText: {
    fontSize: 14,
    color: "#92400E",
    fontWeight: "500",
    flex: 1,
  },
  btnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.primary || "#4F46E5",
    borderRadius: 12,
    paddingVertical: 14,
    shadowColor: COLORS.primary || "#4F46E5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  btnPrimaryText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
  btnSecondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginTop: 10,
  },
  btnSecondaryText: {
    color: "#6B7280",
    fontWeight: "700",
    fontSize: 15,
  },
  btnOutlineRed: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    paddingVertical: 12,
  },
  btnOutlineRedText: {
    color: "#DC2626",
    fontWeight: "700",
    fontSize: 15,
  },
  btnPrimaryGreen: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.secondary || "#10B981",
    borderRadius: 12,
    paddingVertical: 12,
    flex: 1,
  },
  btnPrimaryGreenText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  rescheduleCard: {
    backgroundColor: "#FFF7ED",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#FED7AA",
  },
  rescheduleHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  rescheduleIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(234, 88, 12, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  rescheduleTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#B45309",
  },
  rescheduleTime: {
    fontSize: 14,
    fontWeight: "500",
    color: "#92400E",
    marginBottom: 14,
    lineHeight: 20,
  },
  rescheduleButtonRow: {
    flexDirection: "row",
    gap: 10,
  },
  linkDanger: {
    color: "#DC2626",
    fontWeight: "600",
    fontSize: 14,
    textDecorationLine: "underline",
  },
  enRouteCard: {
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderRadius: 14,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  enRouteIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(2, 132, 199, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  enRouteText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0284C7",
    textAlign: "center",
  },
  enRouteSub: {
    marginTop: 8,
    fontSize: 13,
    color: "#0369A1",
  },
  awaitingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F5F3FF",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DDD6FE",
    marginBottom: 12,
  },
  awaitingText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#5B21B6",
    flex: 1,
  },
  timerCard: {
    alignItems: "center",
    backgroundColor: "#EEF2FF",
    borderRadius: 14,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  timerLarge: {
    fontSize: 42,
    fontWeight: "800",
    color: COLORS.primary || "#4F46E5",
    marginBottom: 8,
  },
  timerLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4F46E5",
  },
  timerSub: {
    marginTop: 6,
    fontSize: 12,
    color: "#6B7280",
  },
  completedBlock: {
    marginBottom: 0,
  },
  completedCard: {
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  completedTitle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: "700",
    color: "#059669",
  },
  summaryRow: {
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  summaryItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "500",
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  gridLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 4,
    gap: 8,
  },
  gridImg: {
    width: "48%",
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: "#E5E7EB",
  },
  errorCard: {
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  errorTitle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: "700",
    color: "#DC2626",
  },
  errorMessage: {
    marginTop: 8,
    fontSize: 13,
    color: "#991B1B",
    textAlign: "center",
    lineHeight: 19,
  },
  cancelledCard: {
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cancelledTitle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: "700",
    color: "#374151",
  },
  cancelledSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: "#6B7280",
  },
  cancelledReason: {
    marginTop: 8,
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 19,
  },
  disputeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  disputeText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#92400E",
    flex: 1,
    lineHeight: 20,
  },
});
