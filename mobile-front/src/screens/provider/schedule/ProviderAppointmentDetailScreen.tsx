import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
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
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { COLORS } from "../../../constants";
import { AuthNoticeModal, ConfirmModal } from "../../../components/common";
import type { ProviderStackParamList } from "../../../navigation/types";
import { api } from "../../../services/api";
import { uploadAppointmentJobPhoto } from "../../../services/appointmentJobPhotosUpload";
import i18n from "../../../i18n";

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

// ─── Design tokens ────────────────────────────────────────
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
  success: "#059669",
  successBg: "#ECFDF5",
  successBdr: "#A7F3D0",
  error: "#DC2626",
  errorBg: "#FEF2F2",
  errorBdr: "#FECACA",
  warning: "#D97706",
  warningBg: "#FFFBEB",
  warningBdr: "#FDE68A",
  purple: "#7C3AED",
  purpleBg: "#F5F3FF",
  purpleBdr: "#DDD6FE",
  amber: "#D97706",
  amberBg: "#FFFBEB",
  amberBdr: "#FCD34D",
  shadow: "rgba(0,0,0,0.06)",
};

// ─── Types / parsers (all unchanged) ─────────────────────
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
function parseStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}
function normalizeDateKey(v: unknown): string {
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v))
    return v.slice(0, 10);
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
  const gs = r.givenService;
  if (gs && typeof gs === "object") {
    const g = gs as Record<string, unknown>;
    if (typeof g.price === "number") price = g.price;
    if (typeof g.pricingType === "string") pricingType = g.pricingType;
    const svc = g.service;
    if (svc && typeof svc === "object") {
      const s = svc as Record<string, unknown>;
      serviceName = pickName(s.translations as TranslationRow[] | undefined);
      const cat = s.category as Record<string, unknown> | undefined;
      if (cat && typeof cat === "object")
        categoryName = pickName(
          cat.translations as TranslationRow[] | undefined,
        );
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
    photoUrls: parseStringArray(r.photoUrls),
    refusalReason: typeof r.refusalReason === "string" ? r.refusalReason : null,
    rescheduleDate: r.rescheduleDate
      ? normalizeDateKey(r.rescheduleDate)
      : null,
    rescheduleTime:
      typeof r.rescheduleTime === "string" ? r.rescheduleTime : null,
    enRouteAt: r.enRouteAt != null ? String(r.enRouteAt) : null,
    startedAt: r.startedAt != null ? String(r.startedAt) : null,
    completedAt: r.completedAt != null ? String(r.completedAt) : null,
    durationMinutes:
      typeof r.durationMinutes === "number" ? r.durationMinutes : null,
    beforePhotoUrls: parseStringArray(r.beforePhotoUrls),
    afterPhotoUrls: parseStringArray(r.afterPhotoUrls),
    cancellationReason:
      typeof r.cancellationReason === "string" ? r.cancellationReason : null,
    givenService: {
      serviceName: serviceName || "Service",
      categoryName: categoryName || "Category",
      price,
      pricingType,
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
function formatSectionDate(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  if (!y || !m || !d) return yyyyMmDd;
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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

// ─── Status config ────────────────────────────────────────
function statusConfig(status: string) {
  switch (status) {
    case "PENDING":
      return {
        label: "Awaiting response",
        icon: "hourglass-outline" as const,
        bg: C.amberBg,
        border: C.amberBdr,
        text: C.amber,
      };
    case "CONFIRMED":
      return {
        label: "Confirmed",
        icon: "checkmark-circle-outline" as const,
        bg: C.accentBg,
        border: C.accentBorder,
        text: C.accent,
      };
    case "EN_ROUTE":
      return {
        label: "En route",
        icon: "navigate-outline" as const,
        bg: C.purpleBg,
        border: C.purpleBdr,
        text: C.purple,
      };
    case "IN_PROGRESS":
      return {
        label: "In progress",
        icon: "play-circle-outline" as const,
        bg: C.accentBg,
        border: C.accentBorder,
        text: C.accent,
      };
    case "COMPLETED":
      return {
        label: "Completed",
        icon: "trophy-outline" as const,
        bg: C.successBg,
        border: C.successBdr,
        text: C.success,
      };
    case "REFUSED":
      return {
        label: "Refused",
        icon: "close-circle-outline" as const,
        bg: C.errorBg,
        border: C.errorBdr,
        text: C.error,
      };
    case "CANCELLED_CLIENT":
      return {
        label: "Cancelled by client",
        icon: "close-circle-outline" as const,
        bg: C.errorBg,
        border: C.errorBdr,
        text: C.error,
      };
    case "CANCELLED_PROVIDER":
      return {
        label: "Cancelled by you",
        icon: "close-circle-outline" as const,
        bg: C.errorBg,
        border: C.errorBdr,
        text: C.error,
      };
    case "RESCHEDULED":
      return {
        label: "Reschedule proposed",
        icon: "time-outline" as const,
        bg: C.amberBg,
        border: C.amberBdr,
        text: C.amber,
      };
    default:
      return {
        label: status,
        icon: "help-circle-outline" as const,
        bg: C.bg,
        border: C.border,
        text: C.textSub,
      };
  }
}

// ─── Reusable subcomponents ───────────────────────────────
function InfoRow({
  icon,
  label,
  value,
  valueColor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={s.infoRow}>
      <View style={s.infoIconBox}>
        <Ionicons name={icon} size={14} color={C.textSub} />
      </View>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={[s.infoValue, valueColor ? { color: valueColor } : {}]}>
        {value}
      </Text>
    </View>
  );
}

function SectionBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={s.sectionBlock}>
      <View style={s.sectionTitleRow}>
        <View style={s.sectionBar} />
        <Text style={s.sectionTitle}>{title}</Text>
      </View>
      {children}
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
    <View style={s.photoRowWrap}>
      <Text style={s.photoRowLabel}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.photoRowScroll}
      >
        {uris.map((uri) => (
          <Image key={uri} source={{ uri }} style={s.photoThumb} />
        ))}
        <TouchableOpacity
          style={s.addPhotoBtn}
          onPress={onAdd}
          disabled={disabled}
          activeOpacity={0.8}
        >
          <Ionicons name="camera-outline" size={20} color={C.accent} />
          <Text style={s.addPhotoLabel}>Add</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────
export const ProviderAppointmentDetailScreen: React.FC<Props> = ({
  navigation,
  route,
}) => {
  const { appointmentId } = route.params;
  const insets = useSafeAreaInsets();

  // ── State (all unchanged) ─────────────────────────────
  const [appointment, setAppointment] =
    useState<ProviderAppointmentDetailModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [refuseMode, setRefuseMode] = useState(false);
  const [refusalReason, setRefusalReason] = useState("");
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

  // ── Load (unchanged) ──────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAppointmentById(appointmentId);
      setAppointment(parseAppointment(res.data));
    } catch {
      setAppointment(null);
      setNoticeModal({
        title: "Error",
        message: "Could not load this appointment.",
        primaryLabel: "OK",
        onPrimary: () => navigation.goBack(),
      });
    } finally {
      setLoading(false);
    }
  }, [appointmentId, navigation]);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Timer (unchanged) ─────────────────────────────────
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

  // ── Actions (all unchanged) ───────────────────────────
  const runAction = useCallback(
    async (
      fn: () => Promise<unknown>,
      opts?: { successMessage?: string; onSuccess?: () => void },
    ) => {
      setActionLoading(true);
      try {
        await fn();
        await load();
        setRefuseMode(false);
        setRefusalReason("");
        setRescheduleSheetVisible(false);
        setBeforeLocalUris([]);
        setAfterLocalUris([]);
        opts?.onSuccess?.();
        if (opts?.successMessage) {
          setNoticeModal({
            title: "Success",
            message: opts.successMessage,
            primaryLabel: "OK",
          });
        }
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
    [load],
  );

  const onAccept = () =>
    void runAction(
      () => api.providerRespond(appointmentId, { action: "CONFIRMED" }),
      { successMessage: "Appointment accepted." },
    );
  const onRefuseSubmit = () => {
    const reason = refusalReason.trim();
    if (!reason) {
      setNoticeModal({
        title: "Reason required",
        message: "Please enter a reason for refusal.",
        primaryLabel: "OK",
      });
      return;
    }
    void runAction(
      () =>
        api.providerRespond(appointmentId, {
          action: "REFUSED",
          refusalReason: reason,
        }),
      { successMessage: "Appointment refused." },
    );
  };
  const onProposeReschedule = () =>
    void runAction(
      () =>
        api.providerRespond(appointmentId, {
          action: "RESCHEDULED",
          rescheduleDate: rescheduleDateKey,
          rescheduleTime: `${rescheduleHour}:${rescheduleMinute}`,
        }),
      { successMessage: "New time proposed." },
    );
  const onMarkEnRoute = () =>
    void runAction(
      () => api.recordExecution(appointmentId, { action: "EN_ROUTE" }),
      { successMessage: "You are marked en route." },
    );
  const onCancelConfirmed = () => setConfirmCancelVisible(true);
  const pickPhoto = async (target: "before" | "after") => {
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
      quality: 0.85,
    });
    const asset = result.assets?.[0];
    if (!result.canceled && asset?.uri) {
      if (target === "before") setBeforeLocalUris((u) => [...u, asset.uri]);
      else setAfterLocalUris((u) => [...u, asset.uri]);
    }
  };
  const uploadLocals = async (uris: string[]): Promise<string[]> => {
    const urls: string[] = [];
    for (const uri of uris) {
      const url = await uploadAppointmentJobPhoto(appointmentId, uri);
      urls.push(url);
    }
    return urls;
  };
  const onStartService = () =>
    void runAction(async () => {
      const photoUrls =
        beforeLocalUris.length > 0
          ? await uploadLocals(beforeLocalUris)
          : undefined;
      await api.recordExecution(appointmentId, {
        action: "START",
        ...(photoUrls?.length ? { photoUrls } : {}),
      });
    }, { successMessage: "Service started." });
  const onEndService = () =>
    void runAction(async () => {
      const photoUrls =
        afterLocalUris.length > 0
          ? await uploadLocals(afterLocalUris)
          : undefined;
      await api.recordExecution(appointmentId, {
        action: "END",
        ...(photoUrls?.length ? { photoUrls } : {}),
      });
    }, {
      successMessage: "End recorded. Waiting for client confirmation.",
    });

  const clientName =
    `${appointment?.client.firstName ?? ""} ${appointment?.client.lastName ?? ""}`.trim() ||
    "Client";

  // ── Render ────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.85}
        >
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Appointment</Text>
        <View style={s.headerRightSpacer} />
      </View>

      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={C.accent} />
        </View>
      ) : !appointment ? (
        <View style={s.centered}>
          <Text style={s.muted}>Nothing to show.</Text>
        </View>
      ) : (
        (() => {
          const cfg = statusConfig(appointment.status);
          return (
            <ScrollView
              style={s.scroll}
              contentContainerStyle={[
                s.scrollContent,
                { paddingBottom: insets.bottom + 32 },
              ]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* ── Status banner ── */}
              <View
                style={[
                  s.statusBanner,
                  { backgroundColor: cfg.bg, borderColor: cfg.border },
                ]}
              >
                <Ionicons name={cfg.icon} size={18} color={cfg.text} />
                <Text style={[s.statusBannerText, { color: cfg.text }]}>
                  {cfg.label}
                </Text>
              </View>

              {/* ── Client card ── */}
              <View style={s.clientCard}>
                {appointment.client.imageUrl ? (
                  <Image
                    source={{ uri: appointment.client.imageUrl }}
                    style={s.avatarImg}
                  />
                ) : (
                  <View style={s.avatarFallback}>
                    <Text style={s.avatarFallbackText}>
                      {clientInitials(
                        appointment.client.firstName,
                        appointment.client.lastName,
                      )}
                    </Text>
                  </View>
                )}
                <View style={s.clientCardBody}>
                  <Text style={s.clientName}>{clientName}</Text>
                  <Text style={s.serviceName} numberOfLines={1}>
                    {appointment.givenService.serviceName}
                  </Text>
                  <View style={s.categoryChip}>
                    <Text style={s.categoryChipText}>
                      {appointment.givenService.categoryName}
                    </Text>
                  </View>
                </View>
              </View>

              {/* ── Booking info row ── */}
              <View style={s.infoCard}>
                <InfoRow
                  icon="calendar-outline"
                  label="Date"
                  value={formatSectionDate(appointment.scheduledDate)}
                />
                <View style={s.infoDivider} />
                <InfoRow
                  icon="time-outline"
                  label="Time"
                  value={appointment.scheduledTime}
                />
                <View style={s.infoDivider} />
                <InfoRow
                  icon="pricetag-outline"
                  label="Price"
                  value={`${appointment.givenService.price} · ${appointment.givenService.pricingType}`}
                  valueColor={C.accent}
                />
              </View>

              {/* ══════════ PENDING ══════════ */}
              {appointment.status === "PENDING" && (
                <View style={s.section}>
                  {appointment.notes ? (
                    <SectionBlock title="Client notes">
                      <View style={s.notesBox}>
                        <Text style={s.notesText}>{appointment.notes}</Text>
                      </View>
                    </SectionBlock>
                  ) : null}

                  {appointment.photoUrls.length > 0 && (
                    <SectionBlock title="Attached photos">
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={s.attachScroll}
                      >
                        {appointment.photoUrls.map((uri) => (
                          <Image
                            key={uri}
                            source={{ uri }}
                            style={s.attachThumb}
                          />
                        ))}
                      </ScrollView>
                    </SectionBlock>
                  )}

                  {/* Accept */}
                  <TouchableOpacity
                    style={[s.btn, s.btnSuccess]}
                    onPress={onAccept}
                    disabled={actionLoading}
                    activeOpacity={0.88}
                  >
                    {actionLoading ? (
                      <ActivityIndicator color={C.white} />
                    ) : (
                      <>
                        <Ionicons
                          name="checkmark-circle-outline"
                          size={18}
                          color={C.white}
                        />
                        <Text style={s.btnText}>Accept appointment</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  {/* Refuse */}
                  {!refuseMode ? (
                    <TouchableOpacity
                      style={[s.btn, s.btnOutlineError]}
                      onPress={() => setRefuseMode(true)}
                      disabled={actionLoading}
                      activeOpacity={0.88}
                    >
                      <Ionicons
                        name="close-circle-outline"
                        size={18}
                        color={C.error}
                      />
                      <Text style={[s.btnText, { color: C.error }]}>
                        Refuse
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={s.refuseBox}>
                      <TextInput
                        style={s.refuseInput}
                        placeholder="Reason for refusal…"
                        placeholderTextColor={C.textLight}
                        value={refusalReason}
                        onChangeText={setRefusalReason}
                        multiline
                      />
                      <TouchableOpacity
                        style={[s.btn, s.btnError]}
                        onPress={onRefuseSubmit}
                        disabled={actionLoading}
                        activeOpacity={0.88}
                      >
                        {actionLoading ? (
                          <ActivityIndicator color={C.white} />
                        ) : (
                          <Text style={s.btnText}>Confirm refusal</Text>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={s.textLink}
                        onPress={() => {
                          setRefuseMode(false);
                          setRefusalReason("");
                        }}
                        disabled={actionLoading}
                      >
                        <Text style={s.textLinkMuted}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Propose new time */}
                  <TouchableOpacity
                    style={s.proposeLink}
                    onPress={() => setRescheduleSheetVisible(true)}
                    disabled={actionLoading}
                  >
                    <Ionicons name="time-outline" size={15} color={C.accent} />
                    <Text style={s.proposeLinkText}>
                      Propose a different time
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* ══════════ CONFIRMED ══════════ */}
              {appointment.status === "CONFIRMED" && (
                <View style={s.section}>
                  <TouchableOpacity
                    style={[s.btn, s.btnAccent]}
                    onPress={onMarkEnRoute}
                    disabled={actionLoading}
                    activeOpacity={0.88}
                  >
                    {actionLoading ? (
                      <ActivityIndicator color={C.white} />
                    ) : (
                      <>
                        <Ionicons
                          name="navigate-outline"
                          size={18}
                          color={C.white}
                        />
                        <Text style={s.btnText}>Mark as En Route</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.textLink}
                    onPress={onCancelConfirmed}
                    disabled={actionLoading}
                  >
                    <Text style={[s.textLinkMuted, { color: C.error }]}>
                      Cancel appointment
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* ══════════ EN ROUTE ══════════ */}
              {appointment.status === "EN_ROUTE" && (
                <View style={s.section}>
                  <View
                    style={[
                      s.alertBanner,
                      { backgroundColor: C.purpleBg, borderColor: C.purpleBdr },
                    ]}
                  >
                    <Ionicons
                      name="navigate-circle"
                      size={24}
                      color={C.purple}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[s.alertBannerTitle, { color: C.purple }]}>
                        You are on the way
                      </Text>
                      <Text style={s.alertBannerSub}>
                        Client has been notified
                      </Text>
                    </View>
                  </View>

                  <PhotoRow
                    uris={beforeLocalUris}
                    label="Before photos (optional)"
                    onAdd={() => void pickPhoto("before")}
                    disabled={actionLoading}
                  />

                  <TouchableOpacity
                    style={[s.btn, s.btnAccent]}
                    onPress={onStartService}
                    disabled={actionLoading}
                    activeOpacity={0.88}
                  >
                    {actionLoading ? (
                      <ActivityIndicator color={C.white} />
                    ) : (
                      <>
                        <Ionicons
                          name="play-circle-outline"
                          size={18}
                          color={C.white}
                        />
                        <Text style={s.btnText}>Start Service</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {/* ══════════ IN PROGRESS ══════════ */}
              {appointment.status === "IN_PROGRESS" && (
                <View style={s.section}>
                  {waitingClientStart ? (
                    <View
                      style={[
                        s.alertBanner,
                        { backgroundColor: C.amberBg, borderColor: C.amberBdr },
                      ]}
                    >
                      <ActivityIndicator color={C.amber} size="small" />
                      <View style={{ flex: 1 }}>
                        <Text style={[s.alertBannerTitle, { color: C.amber }]}>
                          Waiting for client
                        </Text>
                        <Text style={s.alertBannerSub}>
                          The timer starts after the client confirms the service has
                          started
                        </Text>
                      </View>
                    </View>
                  ) : null}
                  {/* Live timer card */}
                  <View style={s.timerCard}>
                    <Text style={s.timerLabel}>Time elapsed</Text>
                    <Text style={s.timerValue}>
                      {formatElapsed(elapsedSeconds)}
                    </Text>
                    {appointment.startedAt && (
                      <Text style={s.timerStarted}>
                        Started at{" "}
                        {new Date(appointment.startedAt).toLocaleTimeString(
                          undefined,
                          { hour: "2-digit", minute: "2-digit" },
                        )}
                      </Text>
                    )}
                  </View>

                  {waitingClientEnd ? (
                    <View
                      style={[
                        s.alertBanner,
                        { backgroundColor: C.amberBg, borderColor: C.amberBdr },
                      ]}
                    >
                      <ActivityIndicator color={C.amber} size="small" />
                      <View style={{ flex: 1 }}>
                        <Text style={[s.alertBannerTitle, { color: C.amber }]}>
                          Waiting for client
                        </Text>
                        <Text style={s.alertBannerSub}>
                          Client must confirm service completion
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <>
                      <PhotoRow
                        uris={afterLocalUris}
                        label="After photos (optional)"
                        onAdd={() => void pickPhoto("after")}
                        disabled={actionLoading}
                      />
                      <TouchableOpacity
                        style={[s.btn, s.btnSuccess]}
                        onPress={onEndService}
                        disabled={actionLoading}
                        activeOpacity={0.88}
                      >
                        {actionLoading ? (
                          <ActivityIndicator color={C.white} />
                        ) : (
                          <>
                            <Ionicons
                              name="checkmark-done-circle-outline"
                              size={18}
                              color={C.white}
                            />
                            <Text style={s.btnText}>End Service</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}

              {/* ══════════ COMPLETED ══════════ */}
              {appointment.status === "COMPLETED" && (
                <View style={s.section}>
                  <View
                    style={[
                      s.alertBanner,
                      {
                        backgroundColor: C.successBg,
                        borderColor: C.successBdr,
                      },
                    ]}
                  >
                    <Ionicons name="trophy" size={24} color={C.success} />
                    <View style={{ flex: 1 }}>
                      <Text style={[s.alertBannerTitle, { color: C.success }]}>
                        Service completed ✓
                      </Text>
                      {appointment.durationMinutes != null && (
                        <Text style={s.alertBannerSub}>
                          Duration: {appointment.durationMinutes} min
                        </Text>
                      )}
                    </View>
                  </View>

                  <SectionBlock title="Summary">
                    <View style={s.summaryCard}>
                      {appointment.startedAt && (
                        <InfoRow
                          icon="play-circle-outline"
                          label="Started"
                          value={new Date(appointment.startedAt).toLocaleString(
                            undefined,
                            { dateStyle: "medium", timeStyle: "short" },
                          )}
                        />
                      )}
                      {appointment.completedAt && (
                        <InfoRow
                          icon="checkmark-circle-outline"
                          label="Ended"
                          value={new Date(
                            appointment.completedAt,
                          ).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        />
                      )}
                      {appointment.durationMinutes != null && (
                        <InfoRow
                          icon="time-outline"
                          label="Duration"
                          value={`${appointment.durationMinutes} min`}
                          valueColor={C.accent}
                        />
                      )}
                    </View>
                  </SectionBlock>

                  {appointment.beforePhotoUrls.length > 0 && (
                    <SectionBlock title="Before">
                      <View style={s.photoGrid}>
                        {appointment.beforePhotoUrls.map((uri) => (
                          <Image
                            key={uri}
                            source={{ uri }}
                            style={s.gridPhoto}
                          />
                        ))}
                      </View>
                    </SectionBlock>
                  )}
                  {appointment.afterPhotoUrls.length > 0 && (
                    <SectionBlock title="After">
                      <View style={s.photoGrid}>
                        {appointment.afterPhotoUrls.map((uri) => (
                          <Image
                            key={uri}
                            source={{ uri }}
                            style={s.gridPhoto}
                          />
                        ))}
                      </View>
                    </SectionBlock>
                  )}
                </View>
              )}

              {/* ══════════ CLOSED STATES ══════════ */}
              {["REFUSED", "CANCELLED_CLIENT", "CANCELLED_PROVIDER"].includes(
                appointment.status,
              ) && (
                <View style={s.section}>
                  <View
                    style={[
                      s.alertBanner,
                      { backgroundColor: C.errorBg, borderColor: C.errorBdr },
                    ]}
                  >
                    <Ionicons name="close-circle" size={24} color={C.error} />
                    <View style={{ flex: 1 }}>
                      <Text style={[s.alertBannerTitle, { color: C.error }]}>
                        {cfg.label}
                      </Text>
                      {(appointment.refusalReason ||
                        appointment.cancellationReason) && (
                        <Text style={s.alertBannerSub}>
                          {appointment.refusalReason ??
                            appointment.cancellationReason}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              )}

              {/* ══════════ RESCHEDULED ══════════ */}
              {appointment.status === "RESCHEDULED" && (
                <View style={s.section}>
                  <View
                    style={[
                      s.alertBanner,
                      { backgroundColor: C.amberBg, borderColor: C.amberBdr },
                    ]}
                  >
                    <Ionicons name="time" size={24} color={C.amber} />
                    <View style={{ flex: 1 }}>
                      <Text style={[s.alertBannerTitle, { color: C.amber }]}>
                        Awaiting client response
                      </Text>
                      <Text style={s.alertBannerSub}>
                        Proposed:{" "}
                        {appointment.rescheduleDate
                          ? formatSectionDate(appointment.rescheduleDate)
                          : "—"}{" "}
                        at {appointment.rescheduleTime ?? "—"}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </ScrollView>
          );
        })()
      )}

      {/* ══════════ RESCHEDULE SHEET ══════════ */}
      <Modal
        visible={rescheduleSheetVisible}
        animationType="slide"
        transparent
        onRequestClose={() =>
          !actionLoading && setRescheduleSheetVisible(false)
        }
      >
        <View style={s.modalRoot}>
          <Pressable
            style={s.sheetBackdrop}
            onPress={() => !actionLoading && setRescheduleSheetVisible(false)}
          />
          <View
            style={[
              s.sheetCard,
              { paddingBottom: Math.max(insets.bottom, 20) },
            ]}
          >
            {/* Sheet handle */}
            <View style={s.sheetHandleRow}>
              <View style={s.sheetHandle} />
            </View>

            <Text style={s.sheetTitle}>Propose new time</Text>

            <Text style={s.sheetSub}>Choose a date</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.dateChipsRow}
            >
              {rescheduleDayChips.map((chip) => {
                const sel = chip.key === rescheduleDateKey;
                return (
                  <TouchableOpacity
                    key={chip.key}
                    style={[s.dateChip, sel && s.dateChipSelected]}
                    onPress={() => setRescheduleDateKey(chip.key)}
                  >
                    <Text
                      style={[s.dateChipText, sel && s.dateChipTextSelected]}
                    >
                      {chip.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={s.sheetSub}>Select time</Text>
            <View style={s.timePickRow}>
              {/* Hours */}
              <View style={s.timeColWrap}>
                <Text style={s.timeColLabel}>Hour</Text>
                <ScrollView
                  style={s.timeCol}
                  showsVerticalScrollIndicator={false}
                >
                  {RESCHEDULE_HOURS.map((h) => (
                    <TouchableOpacity
                      key={h}
                      style={[
                        s.timeChip,
                        rescheduleHour === h && s.timeChipSelected,
                      ]}
                      onPress={() => setRescheduleHour(h)}
                    >
                      <Text
                        style={[
                          s.timeChipText,
                          rescheduleHour === h && s.timeChipTextSelected,
                        ]}
                      >
                        {h}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <Text style={s.timeColon}>:</Text>
              {/* Minutes */}
              <View style={s.timeColWrap}>
                <Text style={s.timeColLabel}>Min</Text>
                <ScrollView
                  style={s.timeCol}
                  showsVerticalScrollIndicator={false}
                >
                  {RESCHEDULE_MINUTES.map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[
                        s.timeChip,
                        rescheduleMinute === m && s.timeChipSelected,
                      ]}
                      onPress={() => setRescheduleMinute(m)}
                    >
                      <Text
                        style={[
                          s.timeChipText,
                          rescheduleMinute === m && s.timeChipTextSelected,
                        ]}
                      >
                        {m}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            {/* Preview */}
            <View style={s.timePreview}>
              <Ionicons name="time-outline" size={14} color={C.accent} />
              <Text style={s.timePreviewText}>
                {rescheduleDayChips.find((c) => c.key === rescheduleDateKey)
                  ?.label ?? rescheduleDateKey}{" "}
                · {rescheduleHour}:{rescheduleMinute}
              </Text>
            </View>

            <TouchableOpacity
              style={[s.btn, s.btnAccent, { marginTop: 16 }]}
              onPress={onProposeReschedule}
              disabled={actionLoading}
              activeOpacity={0.88}
            >
              {actionLoading ? (
                <ActivityIndicator color={C.white} />
              ) : (
                <>
                  <Ionicons name="send-outline" size={16} color={C.white} />
                  <Text style={s.btnText}>Send proposal</Text>
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
          void runAction(
            () => api.cancelAppointment(appointmentId, {}),
            {
              successMessage: "Appointment cancelled.",
              onSuccess: () => setConfirmCancelVisible(false),
            },
          )
        }
      />
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.white },
  scroll: { flex: 1, backgroundColor: C.bg },
  scrollContent: { padding: 16, gap: 12 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { fontSize: 15, color: C.textSub, fontWeight: "600" },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "800",
    color: C.text,
    letterSpacing: -0.3,
  },
  headerRightSpacer: { width: 40 },

  // Status banner
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  statusBannerText: { fontSize: 13, fontWeight: "700", letterSpacing: 0.1 },

  // Client card
  clientCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    backgroundColor: C.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    ...Platform.select({
      ios: {
        shadowColor: C.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 8,
      },
      android: { elevation: 1 },
    }),
  },
  avatarImg: { width: 60, height: 60, borderRadius: 18, backgroundColor: C.bg },
  avatarFallback: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: C.accentBg,
    borderWidth: 1,
    borderColor: C.accentBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: { fontSize: 20, fontWeight: "800", color: C.accent },
  clientCardBody: { flex: 1, gap: 4 },
  clientName: {
    fontSize: 17,
    fontWeight: "800",
    color: C.text,
    letterSpacing: -0.3,
  },
  serviceName: { fontSize: 14, fontWeight: "600", color: C.textSub },
  categoryChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: C.accentBg,
    borderWidth: 1,
    borderColor: C.accentBorder,
  },
  categoryChipText: { fontSize: 11, fontWeight: "700", color: C.accent },

  // Info card
  infoCard: {
    backgroundColor: C.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 16,
    paddingVertical: 4,
    ...Platform.select({
      ios: {
        shadowColor: C.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 8,
      },
      android: { elevation: 1 },
    }),
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
  },
  infoIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  infoLabel: { fontSize: 13, color: C.textSub, fontWeight: "600", flex: 1 },
  infoValue: { fontSize: 13, fontWeight: "700", color: C.text },
  infoDivider: { height: 1, backgroundColor: C.borderLight },

  // Section
  section: { gap: 10 },
  sectionBlock: { gap: 8 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionBar: {
    width: 3,
    height: 14,
    borderRadius: 2,
    backgroundColor: C.accent,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: C.text,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },

  // Notes
  notesBox: {
    backgroundColor: C.bg,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  notesText: { fontSize: 14, color: C.text, lineHeight: 21 },

  // Photos
  attachScroll: { gap: 10, paddingVertical: 4 },
  attachThumb: {
    width: 90,
    height: 90,
    borderRadius: 14,
    backgroundColor: C.bg,
  },
  photoRowWrap: { gap: 8 },
  photoRowLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: C.textSub,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  photoRowScroll: { gap: 10, paddingVertical: 4 },
  photoThumb: {
    width: 82,
    height: 82,
    borderRadius: 14,
    backgroundColor: C.bg,
  },
  addPhotoBtn: {
    width: 82,
    height: 82,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: C.accentBorder,
    backgroundColor: C.accentBg,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  addPhotoLabel: { fontSize: 11, fontWeight: "700", color: C.accent },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  gridPhoto: {
    width: 100,
    height: 100,
    borderRadius: 14,
    backgroundColor: C.bg,
  },

  // Buttons
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    paddingVertical: 15,
  },
  btnText: { fontSize: 15, fontWeight: "800", color: C.white },
  btnAccent: {
    backgroundColor: C.accent,
    ...Platform.select({
      ios: {
        shadowColor: C.accent,
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.28,
        shadowRadius: 10,
      },
      android: { elevation: 5 },
    }),
  },
  btnSuccess: {
    backgroundColor: C.success,
    ...Platform.select({
      ios: {
        shadowColor: C.success,
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
      },
      android: { elevation: 4 },
    }),
  },
  btnError: { backgroundColor: C.error },
  btnOutlineError: {
    borderWidth: 1.5,
    borderColor: C.errorBdr,
    backgroundColor: C.errorBg,
  },
  textLink: { alignItems: "center", paddingVertical: 10 },
  textLinkMuted: { fontSize: 14, fontWeight: "700", color: C.textSub },
  proposeLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
  },
  proposeLinkText: { fontSize: 14, fontWeight: "700", color: C.accent },

  // Refuse
  refuseBox: { gap: 8 },
  refuseInput: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 14,
    minHeight: 88,
    textAlignVertical: "top",
    fontSize: 14,
    color: C.text,
    backgroundColor: C.bg,
  },

  // Alert banner
  alertBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  alertBannerTitle: { fontSize: 14, fontWeight: "800" },
  alertBannerSub: {
    fontSize: 12,
    color: C.textSub,
    marginTop: 3,
    lineHeight: 17,
  },

  // Timer card
  timerCard: {
    alignItems: "center",
    backgroundColor: C.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 24,
    gap: 6,
    ...Platform.select({
      ios: {
        shadowColor: C.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 8,
      },
      android: { elevation: 1 },
    }),
  },
  timerLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: C.textLight,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  timerValue: {
    fontSize: 44,
    fontWeight: "800",
    color: C.accent,
    letterSpacing: 2,
    fontVariant: ["tabular-nums"],
  },
  timerStarted: { fontSize: 12, color: C.textSub },

  // Summary
  summaryCard: {
    backgroundColor: C.bg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },

  // Sheet
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.5)",
  },
  sheetCard: {
    backgroundColor: C.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 8,
    maxHeight: "90%",
    borderTopWidth: 1,
    borderColor: C.border,
  },
  sheetHandleRow: { alignItems: "center", paddingBottom: 16 },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.border,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: C.text,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  sheetSub: {
    fontSize: 12,
    fontWeight: "700",
    color: C.textSub,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginTop: 14,
    marginBottom: 10,
  },
  dateChipsRow: { gap: 8, paddingVertical: 4 },
  dateChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
  },
  dateChipSelected: { backgroundColor: C.accent, borderColor: C.accent },
  dateChipText: { fontSize: 13, fontWeight: "700", color: C.text },
  dateChipTextSelected: { color: C.white },
  timePickRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxHeight: 180,
    marginBottom: 4,
  },
  timeColWrap: { flex: 1, gap: 4 },
  timeColLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: C.textLight,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  timeCol: { flex: 1 },
  timeColon: {
    fontSize: 24,
    fontWeight: "800",
    color: C.textSub,
    paddingBottom: 20,
  },
  timeChip: {
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
    marginVertical: 2,
  },
  timeChipSelected: {
    backgroundColor: C.accentBg,
    borderWidth: 1,
    borderColor: C.accentBorder,
  },
  timeChipText: { fontSize: 16, fontWeight: "600", color: C.textSub },
  timeChipTextSelected: { color: C.accent, fontWeight: "800" },
  timePreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    justifyContent: "center",
    paddingTop: 10,
    paddingBottom: 4,
  },
  timePreviewText: { fontSize: 14, fontWeight: "700", color: C.accent },
});
