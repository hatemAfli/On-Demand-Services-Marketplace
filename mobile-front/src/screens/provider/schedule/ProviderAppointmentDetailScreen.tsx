import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../../../constants";
import type { ProviderStackParamList } from "../../../navigation/types";
import { api } from "../../../services/api";
import { uploadAppointmentJobPhoto } from "../../../services/appointmentJobPhotosUpload";
import i18n from "../../../i18n";

type Props = NativeStackScreenProps<
  ProviderStackParamList,
  "ProviderAppointmentDetail"
>;

type TranslationRow = { locale: string; name: string };

type ConfirmationRow = { role: string; type: string };

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
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  return "";
}

function parseConfirmations(raw: unknown): ConfirmationRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((x) => ({
      role: String(x.role ?? ""),
      type: String(x.type ?? ""),
    }));
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
      if (cat && typeof cat === "object") {
        categoryName = pickName(cat.translations as TranslationRow[] | undefined);
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
    else if (c.imageUrl === null) imageUrl = null;
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
    notes: typeof r.notes === "string" ? r.notes : (r.notes as null) ?? null,
    photoUrls: parseStringArray(r.photoUrls),
    refusalReason:
      typeof r.refusalReason === "string"
        ? r.refusalReason
        : (r.refusalReason as null) ?? null,
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
      typeof r.cancellationReason === "string"
        ? r.cancellationReason
        : (r.cancellationReason as null) ?? null,
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
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-GB", {
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
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

function toYyyyMmDd(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

const RESCHEDULE_HOURS = Array.from({ length: 17 }, (_, i) =>
  String(i + 6).padStart(2, "0"),
) as string[];
const RESCHEDULE_MINUTES = ["00", "15", "30", "45"] as const;

function hasConfirmation(
  confirmations: ConfirmationRow[],
  role: string,
  type: string,
): boolean {
  return confirmations.some((c) => c.role === role && c.type === type);
}

export const ProviderAppointmentDetailScreen: React.FC<Props> = ({
  navigation,
  route,
}) => {
  const { appointmentId } = route.params;
  const insets = useSafeAreaInsets();

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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAppointmentById(appointmentId);
      const parsed = parseAppointment(res.data);
      setAppointment(parsed);
    } catch {
      Alert.alert("Error", "Could not load this appointment.");
      setAppointment(null);
    } finally {
      setLoading(false);
    }
  }, [appointmentId]);

  useEffect(() => {
    void load();
  }, [load]);

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
    const tick = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - started) / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [appointment?.status, appointment?.startedAt, appointment?.id]);

  const waitingClientEnd = useMemo(() => {
    if (!appointment || appointment.status !== "IN_PROGRESS") return false;
    return hasConfirmation(appointment.confirmations, "PROVIDER", "END");
  }, [appointment]);

  const rescheduleDayChips = useMemo(() => {
    const out: { key: string; label: string }[] = [];
    const start = new Date();
    for (let i = 1; i <= 45; i++) {
      const d = addDays(start, i);
      const key = toYyyyMmDd(d);
      out.push({
        key,
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
    async (fn: () => Promise<unknown>, successMessage?: string) => {
      setActionLoading(true);
      try {
        await fn();
        if (successMessage) {
          Alert.alert("", successMessage);
        }
        await load();
        setRefuseMode(false);
        setRefusalReason("");
        setRescheduleSheetVisible(false);
        setBeforeLocalUris([]);
        setAfterLocalUris([]);
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
        Alert.alert("Error", msg || "Something went wrong. Please try again.");
      } finally {
        setActionLoading(false);
      }
    },
    [load],
  );

  const onAccept = () => {
    void runAction(
      () => api.providerRespond(appointmentId, { action: "CONFIRMED" }),
      "Appointment accepted.",
    );
  };

  const onRefuseSubmit = () => {
    const reason = refusalReason.trim();
    if (!reason) {
      Alert.alert("Reason required", "Please enter a reason for refusal.");
      return;
    }
    void runAction(
      () =>
        api.providerRespond(appointmentId, {
          action: "REFUSED",
          refusalReason: reason,
        }),
      "Appointment refused.",
    );
  };

  const onProposeReschedule = () => {
    void runAction(
      () =>
        api.providerRespond(appointmentId, {
          action: "RESCHEDULED",
          rescheduleDate: rescheduleDateKey,
          rescheduleTime: `${rescheduleHour}:${rescheduleMinute}`,
        }),
      "New time proposed.",
    );
  };

  const onMarkEnRoute = () => {
    void runAction(
      () => api.recordExecution(appointmentId, { action: "EN_ROUTE" }),
      "You are marked en route.",
    );
  };

  const onCancelConfirmed = () => {
    Alert.alert(
      "Cancel appointment",
      "Are you sure you want to cancel this appointment?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, cancel",
          style: "destructive",
          onPress: () => {
            void runAction(
              () => api.cancelAppointment(appointmentId, {}),
              "Appointment cancelled.",
            );
          },
        },
      ],
    );
  };

  const pickPhoto = async (target: "before" | "after") => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission", "Photo library access is required.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });
    const asset = result.assets?.[0];
    if (!result.canceled && asset?.uri) {
      if (target === "before") {
        setBeforeLocalUris((u) => [...u, asset.uri]);
      } else {
        setAfterLocalUris((u) => [...u, asset.uri]);
      }
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

  const onStartService = () => {
    void runAction(async () => {
      const photoUrls =
        beforeLocalUris.length > 0 ? await uploadLocals(beforeLocalUris) : undefined;
      await api.recordExecution(appointmentId, {
        action: "START",
        ...(photoUrls?.length ? { photoUrls } : {}),
      });
    }, "Service started.");
  };

  const onEndService = () => {
    void runAction(async () => {
      const photoUrls =
        afterLocalUris.length > 0 ? await uploadLocals(afterLocalUris) : undefined;
      await api.recordExecution(appointmentId, {
        action: "END",
        ...(photoUrls?.length ? { photoUrls } : {}),
      });
    }, "End recorded. Waiting for client confirmation.");
  };

  const clientName =
    `${appointment?.client.firstName ?? ""} ${appointment?.client.lastName ?? ""}`.trim() ||
    "Client";

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.85}
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Appointment</Text>
        <View style={styles.headerRightSpacer} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : !appointment ? (
        <View style={styles.centered}>
          <Text style={styles.muted}>Nothing to show.</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.clientCard}>
            {appointment.client.imageUrl ? (
              <Image
                source={{ uri: appointment.client.imageUrl }}
                style={styles.avatarImg}
                accessibilityIgnoresInvertColors
              />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarFallbackText}>
                  {clientInitials(
                    appointment.client.firstName,
                    appointment.client.lastName,
                  )}
                </Text>
              </View>
            )}
            <View style={styles.clientCardBody}>
              <Text style={styles.clientName}>{clientName}</Text>
              <Text style={styles.serviceTitle} numberOfLines={2}>
                {appointment.givenService.serviceName}
              </Text>
              <Text style={styles.serviceMeta} numberOfLines={1}>
                {appointment.givenService.categoryName} ·{" "}
                {appointment.givenService.price > 0
                  ? `${appointment.givenService.price} ${appointment.givenService.pricingType}`
                  : appointment.givenService.pricingType}
              </Text>
              <Text style={styles.dateLine}>
                {formatSectionDate(appointment.scheduledDate)} ·{" "}
                {appointment.scheduledTime}
              </Text>
            </View>
          </View>

          {appointment.status === "PENDING" && (
            <View style={styles.section}>
              {appointment.notes ? (
                <View style={styles.notesBox}>
                  <Text style={styles.notesLabel}>Client notes</Text>
                  <Text style={styles.notesText}>{appointment.notes}</Text>
                </View>
              ) : null}
              {appointment.photoUrls.length > 0 ? (
                <View style={styles.attachBlock}>
                  <Text style={styles.attachLabel}>Attached photos</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.attachScroll}
                  >
                    {appointment.photoUrls.map((uri) => (
                      <Image
                        key={uri}
                        source={{ uri }}
                        style={styles.attachThumb}
                        accessibilityIgnoresInvertColors
                      />
                    ))}
                  </ScrollView>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.btnPrimary, styles.btnAccept]}
                onPress={onAccept}
                disabled={actionLoading}
                activeOpacity={0.9}
              >
                {actionLoading ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.btnPrimaryText}>Accept</Text>
                )}
              </TouchableOpacity>

              {!refuseMode ? (
                <TouchableOpacity
                  style={styles.btnRefuseOutline}
                  onPress={() => setRefuseMode(true)}
                  disabled={actionLoading}
                  activeOpacity={0.9}
                >
                  <Text style={styles.btnRefuseOutlineText}>Refuse</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.refuseBox}>
                  <TextInput
                    style={styles.refuseInput}
                    placeholder="Reason for refusal"
                    placeholderTextColor={COLORS.gray[400]}
                    value={refusalReason}
                    onChangeText={setRefusalReason}
                    multiline
                  />
                  <TouchableOpacity
                    style={styles.btnRefuseSolid}
                    onPress={onRefuseSubmit}
                    disabled={actionLoading}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.btnPrimaryText}>Confirm refusal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setRefuseMode(false);
                      setRefusalReason("");
                    }}
                    disabled={actionLoading}
                  >
                    <Text style={styles.linkMuted}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                style={styles.linkWrap}
                onPress={() => setRescheduleSheetVisible(true)}
                disabled={actionLoading}
              >
                <Text style={styles.linkText}>Propose new time</Text>
              </TouchableOpacity>
            </View>
          )}

          {appointment.status === "CONFIRMED" && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Appointment details</Text>
              <View style={styles.recapCard}>
                <Text style={styles.recapLine}>
                  {formatSectionDate(appointment.scheduledDate)}
                </Text>
                <Text style={styles.recapLine}>Time: {appointment.scheduledTime}</Text>
                <Text style={styles.recapLine}>
                  {appointment.givenService.serviceName} ·{" "}
                  {appointment.givenService.categoryName}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.btnPrimary}
                onPress={onMarkEnRoute}
                disabled={actionLoading}
                activeOpacity={0.9}
              >
                {actionLoading ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.btnPrimaryText}>Mark as En Route</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.linkWrap}
                onPress={onCancelConfirmed}
                disabled={actionLoading}
              >
                <Text style={styles.cancelLink}>Cancel appointment</Text>
              </TouchableOpacity>
            </View>
          )}

          {appointment.status === "EN_ROUTE" && (
            <View style={styles.section}>
              <View style={styles.banner}>
                <Ionicons name="navigate" size={22} color={COLORS.primary} />
                <Text style={styles.bannerText}>
                  You are on the way — client has been notified
                </Text>
              </View>
              <Text style={styles.hint}>
                Optional: add “before” photos, then start the service.
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.evidenceScroll}
              >
                {beforeLocalUris.map((uri) => (
                  <Image
                    key={uri}
                    source={{ uri }}
                    style={styles.evidenceThumb}
                  />
                ))}
                <TouchableOpacity
                  style={styles.addPhotoBtn}
                  onPress={() => void pickPhoto("before")}
                  disabled={actionLoading}
                >
                  <Ionicons name="add" size={28} color={COLORS.primary} />
                  <Text style={styles.addPhotoLabel}>Add</Text>
                </TouchableOpacity>
              </ScrollView>
              <TouchableOpacity
                style={styles.btnPrimary}
                onPress={onStartService}
                disabled={actionLoading}
                activeOpacity={0.9}
              >
                {actionLoading ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.btnPrimaryText}>Start Service</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {appointment.status === "IN_PROGRESS" && (
            <View style={styles.section}>
              <View style={styles.timerBox}>
                <Text style={styles.timerLabel}>Elapsed</Text>
                <Text style={styles.timerValue}>
                  {formatElapsed(elapsedSeconds)}
                </Text>
              </View>

              {waitingClientEnd ? (
                <View style={styles.waitingBanner}>
                  <ActivityIndicator color={COLORS.primary} />
                  <Text style={styles.waitingText}>
                    Waiting for client to confirm end…
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={styles.hint}>
                    Add “after” photos (optional), then end the service.
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.evidenceScroll}
                  >
                    {afterLocalUris.map((uri) => (
                      <Image
                        key={uri}
                        source={{ uri }}
                        style={styles.evidenceThumb}
                      />
                    ))}
                    <TouchableOpacity
                      style={styles.addPhotoBtn}
                      onPress={() => void pickPhoto("after")}
                      disabled={actionLoading}
                    >
                      <Ionicons name="add" size={28} color={COLORS.primary} />
                      <Text style={styles.addPhotoLabel}>Add</Text>
                    </TouchableOpacity>
                  </ScrollView>
                  <TouchableOpacity
                    style={[styles.btnPrimary, { backgroundColor: COLORS.secondaryDark }]}
                    onPress={onEndService}
                    disabled={actionLoading}
                    activeOpacity={0.9}
                  >
                    {actionLoading ? (
                      <ActivityIndicator color={COLORS.white} />
                    ) : (
                      <Text style={styles.btnPrimaryText}>End Service</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

          {appointment.status === "COMPLETED" && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Summary</Text>
              <View style={styles.recapCard}>
                {appointment.startedAt ? (
                  <Text style={styles.recapLine}>
                    Started:{" "}
                    {new Date(appointment.startedAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </Text>
                ) : null}
                {appointment.completedAt ? (
                  <Text style={styles.recapLine}>
                    Ended:{" "}
                    {new Date(appointment.completedAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </Text>
                ) : null}
                {appointment.durationMinutes != null ? (
                  <Text style={styles.recapLine}>
                    Duration: {appointment.durationMinutes} min
                  </Text>
                ) : null}
              </View>
              {appointment.beforePhotoUrls.length > 0 ? (
                <View style={styles.gridBlock}>
                  <Text style={styles.gridTitle}>Before</Text>
                  <View style={styles.photoGrid}>
                    {appointment.beforePhotoUrls.map((uri) => (
                      <Image
                        key={uri}
                        source={{ uri }}
                        style={styles.gridPhoto}
                        accessibilityIgnoresInvertColors
                      />
                    ))}
                  </View>
                </View>
              ) : null}
              {appointment.afterPhotoUrls.length > 0 ? (
                <View style={styles.gridBlock}>
                  <Text style={styles.gridTitle}>After</Text>
                  <View style={styles.photoGrid}>
                    {appointment.afterPhotoUrls.map((uri) => (
                      <Image
                        key={uri}
                        source={{ uri }}
                        style={styles.gridPhoto}
                        accessibilityIgnoresInvertColors
                      />
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          )}

          {(appointment.status === "REFUSED" ||
            appointment.status === "CANCELLED_CLIENT" ||
            appointment.status === "CANCELLED_PROVIDER") && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Closed</Text>
              <View style={styles.recapCard}>
                <Text style={styles.recapLine}>Status: {appointment.status}</Text>
                {appointment.status === "REFUSED" && appointment.refusalReason ? (
                  <Text style={styles.reasonText}>{appointment.refusalReason}</Text>
                ) : null}
                {(appointment.status === "CANCELLED_CLIENT" ||
                  appointment.status === "CANCELLED_PROVIDER") &&
                appointment.cancellationReason ? (
                  <Text style={styles.reasonText}>
                    {appointment.cancellationReason}
                  </Text>
                ) : null}
              </View>
            </View>
          )}

          {appointment.status === "RESCHEDULED" && (
            <View style={styles.section}>
              <Text style={styles.readonlyText}>
                Awaiting client response to your proposed time:
              </Text>
              <Text style={styles.proposedTimeText}>
                {appointment.rescheduleDate
                  ? formatSectionDate(appointment.rescheduleDate)
                  : "—"}{" "}
                at {appointment.rescheduleTime ?? "—"}
              </Text>
            </View>
          )}

          {![
            "PENDING",
            "CONFIRMED",
            "EN_ROUTE",
            "IN_PROGRESS",
            "COMPLETED",
            "REFUSED",
            "CANCELLED_CLIENT",
            "CANCELLED_PROVIDER",
            "RESCHEDULED",
          ].includes(appointment.status) && (
            <View style={styles.section}>
              <Text style={styles.muted}>Status: {appointment.status}</Text>
            </View>
          )}
        </ScrollView>
      )}

      <Modal
        visible={rescheduleSheetVisible}
        animationType="slide"
        transparent
        onRequestClose={() =>
          !actionLoading && setRescheduleSheetVisible(false)
        }
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.sheetBackdrop}
            onPress={() => !actionLoading && setRescheduleSheetVisible(false)}
          />
          <View
            style={[
              styles.sheetCard,
              { paddingBottom: Math.max(insets.bottom, 16) },
            ]}
          >
          <Text style={styles.sheetTitle}>Propose new time</Text>
          <Text style={styles.sheetSubtitle}>Pick a date</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dateChipsRow}
          >
            {rescheduleDayChips.map((chip) => {
              const sel = chip.key === rescheduleDateKey;
              return (
                <TouchableOpacity
                  key={chip.key}
                  style={[styles.dateChip, sel && styles.dateChipSelected]}
                  onPress={() => setRescheduleDateKey(chip.key)}
                >
                  <Text
                    style={[styles.dateChipText, sel && styles.dateChipTextSelected]}
                  >
                    {chip.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <Text style={styles.sheetSubtitle}>Time</Text>
          <View style={styles.timePickRow}>
            <ScrollView style={styles.timeCol} showsVerticalScrollIndicator={false}>
              {RESCHEDULE_HOURS.map((h) => (
                <TouchableOpacity
                  key={h}
                  style={[
                    styles.timeChip,
                    rescheduleHour === h && styles.timeChipSelected,
                  ]}
                  onPress={() => setRescheduleHour(h)}
                >
                  <Text
                    style={[
                      styles.timeChipText,
                      rescheduleHour === h && styles.timeChipTextSelected,
                    ]}
                  >
                    {h}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <ScrollView style={styles.timeCol} showsVerticalScrollIndicator={false}>
              {RESCHEDULE_MINUTES.map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[
                    styles.timeChip,
                    rescheduleMinute === m && styles.timeChipSelected,
                  ]}
                  onPress={() => setRescheduleMinute(m)}
                >
                  <Text
                    style={[
                      styles.timeChipText,
                      rescheduleMinute === m && styles.timeChipTextSelected,
                    ]}
                  >
                    {m}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={onProposeReschedule}
            disabled={actionLoading}
            activeOpacity={0.9}
          >
            {actionLoading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.btnPrimaryText}>Send proposal</Text>
            )}
          </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.gray[50],
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text.primary,
  },
  headerRightSpacer: {
    width: 40,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  muted: {
    fontSize: 15,
    color: COLORS.text.secondary,
    fontWeight: "600",
  },
  clientCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    backgroundColor: COLORS.gray[50],
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
  },
  avatarImg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.gray[200],
  },
  avatarFallback: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.white,
  },
  clientCardBody: {
    flex: 1,
    minWidth: 0,
  },
  clientName: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text.primary,
    marginBottom: 4,
  },
  serviceTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text.primary,
  },
  serviceMeta: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  dateLine: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.primary,
    marginTop: 6,
  },
  section: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.text.primary,
    marginBottom: 10,
  },
  notesBox: {
    backgroundColor: COLORS.gray[50],
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.text.tertiary,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  notesText: {
    fontSize: 15,
    color: COLORS.text.primary,
    lineHeight: 22,
  },
  attachBlock: {
    marginBottom: 16,
  },
  attachLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text.secondary,
    marginBottom: 8,
  },
  attachScroll: {
    gap: 10,
  },
  attachThumb: {
    width: 96,
    height: 96,
    borderRadius: 12,
    backgroundColor: COLORS.gray[200],
  },
  btnPrimary: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  btnAccept: {
    backgroundColor: COLORS.secondary,
    marginTop: 0,
  },
  btnPrimaryText: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.white,
  },
  btnRefuseOutline: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: COLORS.error,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnRefuseOutlineText: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.error,
  },
  refuseBox: {
    marginTop: 12,
    gap: 10,
  },
  refuseInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    minHeight: 88,
    textAlignVertical: "top",
    fontSize: 15,
    color: COLORS.text.primary,
    backgroundColor: COLORS.gray[50],
  },
  btnRefuseSolid: {
    backgroundColor: COLORS.error,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  linkWrap: {
    marginTop: 16,
    alignItems: "center",
  },
  linkText: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.primary,
  },
  linkMuted: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text.secondary,
    textAlign: "center",
    marginTop: 4,
  },
  cancelLink: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.error,
  },
  recapCard: {
    backgroundColor: COLORS.gray[50],
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
    gap: 6,
  },
  recapLine: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text.primary,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#EEF2FF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    marginBottom: 12,
  },
  bannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.primaryDark,
  },
  hint: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text.secondary,
    marginBottom: 10,
  },
  evidenceScroll: {
    gap: 10,
    marginBottom: 14,
  },
  evidenceThumb: {
    width: 88,
    height: 88,
    borderRadius: 12,
    backgroundColor: COLORS.gray[200],
  },
  addPhotoBtn: {
    width: 88,
    height: 88,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.gray[50],
  },
  addPhotoLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.primary,
    marginTop: 2,
  },
  timerBox: {
    alignItems: "center",
    paddingVertical: 20,
    marginBottom: 12,
  },
  timerLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text.secondary,
    marginBottom: 4,
  },
  timerValue: {
    fontSize: 36,
    fontWeight: "800",
    color: COLORS.primary,
    fontVariant: ["tabular-nums"],
  },
  waitingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    backgroundColor: COLORS.gray[50],
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  waitingText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text.primary,
  },
  gridBlock: {
    marginTop: 16,
  },
  gridTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.text.primary,
    marginBottom: 10,
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  gridPhoto: {
    width: 104,
    height: 104,
    borderRadius: 10,
    backgroundColor: COLORS.gray[200],
  },
  reasonText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text.secondary,
    marginTop: 8,
    lineHeight: 22,
  },
  readonlyText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text.secondary,
    lineHeight: 22,
  },
  proposedTimeText: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.text.primary,
    marginTop: 8,
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(17,24,39,0.45)",
  },
  sheetCard: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderColor: COLORS.border,
    maxHeight: "88%",
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text.primary,
    marginBottom: 6,
  },
  sheetSubtitle: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text.secondary,
    marginTop: 12,
    marginBottom: 8,
  },
  dateChipsRow: {
    gap: 8,
    paddingVertical: 4,
  },
  dateChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.gray[100],
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dateChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  dateChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text.primary,
  },
  dateChipTextSelected: {
    color: COLORS.white,
  },
  timePickRow: {
    flexDirection: "row",
    gap: 12,
    maxHeight: 200,
    marginBottom: 16,
  },
  timeCol: {
    flex: 1,
  },
  timeChip: {
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
    marginVertical: 2,
  },
  timeChipSelected: {
    backgroundColor: COLORS.gray[100],
  },
  timeChipText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.gray[500],
  },
  timeChipTextSelected: {
    color: COLORS.primary,
    fontWeight: "800",
  },
});
