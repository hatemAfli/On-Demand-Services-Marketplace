import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useIsFocused } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ClientStackParamList } from "../../../navigation/types";
import { COLORS } from "../../../constants";
import { api, type AppointmentStatus } from "../../../services/api";
import { useAppTranslation } from "../../../hooks/useAppTranslation";
import i18n from "../../../i18n";

type Props = NativeStackScreenProps<ClientStackParamList, "ClientAppointments">;

type FilterKey =
  | "ALL"
  | "PENDING"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

const FILTERS: {
  key: FilterKey;
  label: string;
  apiStatus?: AppointmentStatus;
}[] = [
  { key: "ALL", label: "ALL" },
  { key: "PENDING", label: "PENDING", apiStatus: "PENDING" },
  { key: "CONFIRMED", label: "CONFIRMED", apiStatus: "CONFIRMED" },
  { key: "IN_PROGRESS", label: "IN_PROGRESS", apiStatus: "IN_PROGRESS" },
  { key: "COMPLETED", label: "COMPLETED", apiStatus: "COMPLETED" },
  { key: "CANCELLED", label: "CANCELLED" },
];

export type ClientAppointmentListItem = {
  id: string;
  status: AppointmentStatus;
  scheduledDate: string;
  scheduledTime: string;
  notes: string | null;
  rescheduleDate: string | null;
  rescheduleTime: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  givenService: { serviceName: string; categoryName: string };
  provider: {
    firstName: string;
    lastName: string;
    photoUrl: string | null;
    tagline: string | null;
  };
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

function normalizeAppointment(
  raw: Record<string, unknown>,
): ClientAppointmentListItem {
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
        user?: { firstName?: string | null; lastName?: string | null };
      }
    | undefined;

  return {
    id: String(raw.id),
    status: raw.status as AppointmentStatus,
    scheduledDate: toYmd(raw.scheduledDate as string) ?? "",
    scheduledTime: String(raw.scheduledTime ?? ""),
    notes: (raw.notes as string | null) ?? null,
    rescheduleDate: toYmd(raw.rescheduleDate as string | null),
    rescheduleTime: (raw.rescheduleTime as string | null) ?? null,
    cancelledAt: raw.cancelledAt ? String(raw.cancelledAt) : null,
    cancellationReason: (raw.cancellationReason as string | null) ?? null,
    givenService: {
      serviceName: pickLocaleName(service?.translations),
      categoryName: pickLocaleName(service?.category?.translations),
    },
    provider: {
      firstName: prov?.user?.firstName?.trim() ?? "",
      lastName: prov?.user?.lastName?.trim() ?? "",
      photoUrl: prov?.photoUrl ?? null,
      tagline: prov?.tagline?.trim() ?? null,
    },
  };
}

function parseYmdLocal(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatCardDateTime(
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

function formatRescheduleLine(
  rescheduleDate: string | null,
  rescheduleTime: string | null,
): string {
  if (!rescheduleDate || !rescheduleTime) return "";
  try {
    const d = parseYmdLocal(rescheduleDate);
    const day = d.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return `${day} at ${rescheduleTime}`;
  } catch {
    return `${rescheduleDate} at ${rescheduleTime}`;
  }
}

function statusAccent(status: AppointmentStatus): string {
  switch (status) {
    case "PENDING":
      return "#F59E0B";
    case "CONFIRMED":
      return "#3B82F6";
    case "EN_ROUTE":
      return "#9333EA";
    case "IN_PROGRESS":
      return "#7C5CFC";
    case "COMPLETED":
      return "#10B981";
    case "RESCHEDULED":
      return "#EA580C";
    case "CANCELLED_CLIENT":
    case "CANCELLED_PROVIDER":
    case "REFUSED":
      return "#EF4444";
    case "DISPUTED":
      return "#6B7280";
    default:
      return "#9CA3AF";
  }
}

function statusBadgeStyle(status: AppointmentStatus): {
  bg: string;
  text: string;
  border: string;
} {
  if (
    status === "CANCELLED_CLIENT" ||
    status === "CANCELLED_PROVIDER" ||
    status === "REFUSED"
  )
    return { bg: "#FEF2F2", text: "#DC2626", border: "#FECACA" };
  if (status === "PENDING")
    return { bg: "#FFFBEB", text: "#D97706", border: "#FDE68A" };
  if (status === "CONFIRMED" || status === "EN_ROUTE")
    return { bg: "#EFF6FF", text: "#2563EB", border: "#BFDBFE" };
  if (status === "IN_PROGRESS")
    return { bg: "#EDE9FE", text: "#7C5CFC", border: "#C4B5FD" };
  if (status === "COMPLETED")
    return { bg: "#ECFDF5", text: "#059669", border: "#6EE7B7" };
  if (status === "RESCHEDULED")
    return { bg: "#FFF7ED", text: "#EA580C", border: "#FED7AA" };
  if (status === "DISPUTED")
    return { bg: "#F4F3FA", text: "#6B6B80", border: "#EBEBF5" };
  return { bg: "#F4F4F8", text: "#9B9BB0", border: "#E8E8F0" };
}

/* Status icon */
function statusIconName(status: AppointmentStatus): string {
  switch (status) {
    case "PENDING":
      return "radio-button-on-outline";
    case "CONFIRMED":
      return "checkmark-circle-outline";
    case "EN_ROUTE":
      return "navigate-outline";
    case "IN_PROGRESS":
      return "play-circle-outline";
    case "COMPLETED":
      return "ribbon-outline";
    case "RESCHEDULED":
      return "time-outline";
    case "CANCELLED_CLIENT":
    case "CANCELLED_PROVIDER":
    case "REFUSED":
      return "close-circle-outline";
    case "DISPUTED":
      return "alert-circle-outline";
    default:
      return "ellipse-outline";
  }
}

function statusLabel(status: AppointmentStatus): string {
  return status.replace(/_/g, " ");
}

function mergeCancelledLists(
  a: Record<string, unknown>[],
  b: Record<string, unknown>[],
): ClientAppointmentListItem[] {
  const map = new Map<string, Record<string, unknown>>();
  for (const row of a) map.set(String(row.id), row);
  for (const row of b) map.set(String(row.id), row);
  const merged = [...map.values()];
  merged.sort((x, y) => {
    const dx = String(x.scheduledDate ?? "");
    const dy = String(y.scheduledDate ?? "");
    if (dx !== dy) return dy.localeCompare(dx);
    return String(y.scheduledTime ?? "").localeCompare(
      String(x.scheduledTime ?? ""),
    );
  });
  return merged.map(normalizeAppointment);
}

export const ClientAppointmentsScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useAppTranslation();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t("client.screenTitles.ClientAppointments"),
      headerBackVisible: false,
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ marginLeft: 8, padding: 4 }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={24} color="#1A1A2E" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, t]);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("ALL");
  const [appointments, setAppointments] = useState<ClientAppointmentListItem[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        if (activeFilter === "CANCELLED") {
          const [r1, r2] = await Promise.all([
            api.getMyAppointmentsAsClient("CANCELLED_CLIENT"),
            api.getMyAppointmentsAsClient("CANCELLED_PROVIDER"),
          ]);
          const rowsA = (r1.data ?? []) as Record<string, unknown>[];
          const rowsB = (r2.data ?? []) as Record<string, unknown>[];
          setAppointments(mergeCancelledLists(rowsA, rowsB));
        } else if (activeFilter === "ALL") {
          const res = await api.getMyAppointmentsAsClient();
          const rows = (res.data ?? []) as Record<string, unknown>[];
          setAppointments(rows.map(normalizeAppointment));
        } else {
          const def = FILTERS.find((f) => f.key === activeFilter);
          const st = def?.apiStatus;
          if (!st) {
            setAppointments([]);
          } else {
            const res = await api.getMyAppointmentsAsClient(st);
            const rows = (res.data ?? []) as Record<string, unknown>[];
            setAppointments(rows.map(normalizeAppointment));
          }
        }
      } catch {
        setAppointments([]);
        Alert.alert(
          "Could not load appointments",
          "Check your connection and try again.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeFilter],
  );

  useEffect(() => {
    if (!isFocused) return;
    void load(false);
  }, [isFocused, load]);

  const emptyMessage = useMemo(() => {
    switch (activeFilter) {
      case "PENDING":
        return "No pending appointments";
      case "CONFIRMED":
        return "No confirmed appointments";
      case "IN_PROGRESS":
        return "No appointments in progress";
      case "COMPLETED":
        return "No completed appointments";
      case "CANCELLED":
        return "No cancelled appointments";
      default:
        return "No appointments yet";
    }
  }, [activeFilter]);

  const onRescheduleRespond = async (
    id: string,
    action: "CONFIRMED" | "CANCELLED_CLIENT",
  ) => {
    setRespondingId(id);
    try {
      const res = await api.clientRespondReschedule(id, { action });
      const updated = res.data;
      setAppointments((prev) =>
        prev.map((row) => {
          if (row.id !== id) return row;
          const nextStatus = updated.status as AppointmentStatus;
          const ymd =
            toYmd(updated.scheduledDate as string) ?? row.scheduledDate;
          return {
            ...row,
            status: nextStatus,
            scheduledDate: ymd,
            scheduledTime: String(updated.scheduledTime ?? row.scheduledTime),
            rescheduleDate: updated.rescheduleDate
              ? toYmd(updated.rescheduleDate as string)
              : null,
            rescheduleTime: updated.rescheduleTime ?? null,
          };
        }),
      );
    } catch {
      Alert.alert(
        "Something went wrong",
        "Could not update this appointment. Try again.",
      );
    } finally {
      setRespondingId(null);
    }
  };

  const renderCard = ({ item }: { item: ClientAppointmentListItem }) => {
    const badge = statusBadgeStyle(item.status);
    const accent = statusAccent(item.status);
    const iconName = statusIconName(item.status);
    const providerName =
      `${item.provider.firstName} ${item.provider.lastName}`.trim() ||
      "Provider";
    const initials =
      `${item.provider.firstName?.[0] ?? ""}${item.provider.lastName?.[0] ?? ""}`.toUpperCase() ||
      "?";

    return (
      <View style={styles.cardWrap}>
        {/* Left accent stripe */}
        <View style={[styles.cardStripe, { backgroundColor: accent }]} />

        <View style={styles.cardContent}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() =>
              navigation.navigate("ClientAppointmentDetail", {
                appointmentId: item.id,
              })
            }
            style={styles.card}
            accessibilityRole="button"
          >
            {/* Provider row + status */}
            <View style={styles.cardHeader}>
              <View style={styles.providerInfo}>
                {item.provider.photoUrl ? (
                  <Image
                    source={{ uri: item.provider.photoUrl }}
                    style={styles.avatar}
                  />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarInitials}>{initials}</Text>
                  </View>
                )}
                <View style={styles.providerTextWrap}>
                  <Text style={styles.providerName} numberOfLines={1}>
                    {providerName}
                  </Text>
                  {item.provider.tagline ? (
                    <Text style={styles.tagline} numberOfLines={1}>
                      {item.provider.tagline}
                    </Text>
                  ) : null}
                </View>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: badge.bg, borderColor: badge.border },
                ]}
              >
                <Ionicons name={iconName as any} size={11} color={badge.text} />
                <Text style={[styles.statusBadgeText, { color: badge.text }]}>
                  {statusLabel(item.status)}
                </Text>
              </View>
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Service + date/time */}
            <View style={styles.cardBody}>
              <View style={styles.serviceInfo}>
                <Text style={styles.serviceName} numberOfLines={2}>
                  {item.givenService.serviceName || "Service"}
                </Text>
                <View style={styles.categoryRow}>
                  <Ionicons name="layers-outline" size={11} color="#C4C4C4" />
                  <Text style={styles.categoryName} numberOfLines={1}>
                    {item.givenService.categoryName || "Uncategorized"}
                  </Text>
                </View>
              </View>

              <View style={styles.dateTimeWrap}>
                <Ionicons name="calendar-outline" size={13} color="#7C5CFC" />
                <Text style={styles.dateTime}>
                  {formatCardDateTime(item.scheduledDate, item.scheduledTime)}
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Reschedule banner */}
          {item.status === "RESCHEDULED" ? (
            <View style={styles.rescheduleBanner}>
              <View style={styles.rescheduleHeaderRow}>
                <View style={styles.rescheduleIconWrap}>
                  <Ionicons name="time-outline" size={14} color="#EA580C" />
                </View>
                <Text style={styles.rescheduleBannerTitle}>
                  Provider proposed a new time
                </Text>
              </View>
              <Text style={styles.rescheduleBannerLine}>
                {formatRescheduleLine(item.rescheduleDate, item.rescheduleTime)}
              </Text>
              <View style={styles.rescheduleActions}>
                <TouchableOpacity
                  style={[
                    styles.btnDecline,
                    respondingId === item.id && styles.btnDisabled,
                  ]}
                  disabled={respondingId !== null}
                  onPress={() =>
                    void onRescheduleRespond(item.id, "CANCELLED_CLIENT")
                  }
                >
                  {respondingId === item.id ? (
                    <ActivityIndicator color="#DC2626" size="small" />
                  ) : (
                    <Text style={styles.btnDeclineText}>Decline</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.btnAccept,
                    respondingId === item.id && styles.btnDisabled,
                  ]}
                  disabled={respondingId !== null}
                  onPress={() => void onRescheduleRespond(item.id, "CONFIRMED")}
                >
                  {respondingId === item.id ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                      <Text style={styles.btnAcceptText}>Accept Time</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      {/* Filter bar */}
      <View style={styles.filterWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {FILTERS.map((f) => {
            const active = activeFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setActiveFilter(f.key)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    active && styles.filterChipTextActive,
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#7C5CFC" />
        </View>
      ) : (
        <FlatList
          data={appointments}
          keyExtractor={(it) => it.id}
          renderItem={renderCard}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void load(true)}
              tintColor="#7C5CFC"
              colors={["#7C5CFC"]}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIconWrap}>
                <Ionicons
                  name="calendar-clear-outline"
                  size={32}
                  color="#7C5CFC"
                />
              </View>
              <Text style={styles.emptyTitle}>No Appointments</Text>
              <Text style={styles.emptyText}>{emptyMessage}</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F4F3FA",
  },

  /* ── Filter bar ── */
  filterWrapper: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#EBEBF5",
  },
  filterScroll: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#F4F3FA",
    borderWidth: 1.5,
    borderColor: "#EBEBF5",
  },
  filterChipActive: {
    backgroundColor: "#EDE9FE",
    borderColor: "#C4B5FD",
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9B9BB0",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  filterChipTextActive: {
    color: "#7C5CFC",
  },

  /* ── List ── */
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  /* ── Card wrapper ── */
  cardWrap: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EBEBF5",
    overflow: "hidden",
    shadowColor: "#1A1A2E",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  cardStripe: {
    width: 4,
    alignSelf: "stretch",
  },
  cardContent: {
    flex: 1,
  },
  card: {
    padding: 14,
  },

  /* Provider header */
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  providerInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
    gap: 11,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#F4F3FA",
    flexShrink: 0,
  },
  avatarFallback: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#EDE9FE",
    borderWidth: 1.5,
    borderColor: "#C4B5FD",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarInitials: {
    fontSize: 15,
    fontWeight: "800",
    color: "#7C5CFC",
  },
  providerTextWrap: {
    flex: 1,
    gap: 3,
  },
  providerName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1A1A2E",
    letterSpacing: -0.2,
  },
  tagline: {
    fontSize: 12,
    color: "#9B9BB0",
    fontWeight: "400",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    flexShrink: 0,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },

  /* Divider */
  divider: {
    height: 1,
    backgroundColor: "#F4F3FA",
    marginVertical: 12,
  },

  /* Card body */
  cardBody: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 12,
  },
  serviceInfo: {
    flex: 1,
    gap: 4,
  },
  serviceName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1A1A2E",
    lineHeight: 19,
    letterSpacing: -0.1,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  categoryName: {
    fontSize: 12,
    color: "#9B9BB0",
    fontWeight: "500",
  },
  dateTimeWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: "#F5F3FF",
    borderWidth: 1,
    borderColor: "#EDE9FE",
    flexShrink: 0,
  },
  dateTime: {
    fontSize: 11,
    fontWeight: "700",
    color: "#7C5CFC",
    fontVariant: ["tabular-nums"],
  },

  /* ── Reschedule banner ── */
  rescheduleBanner: {
    borderTopWidth: 1,
    borderTopColor: "#FED7AA",
    backgroundColor: "#FFF7ED",
    padding: 14,
    gap: 8,
  },
  rescheduleHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rescheduleIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: "#FFEDD5",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FED7AA",
  },
  rescheduleBannerTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#9A3412",
  },
  rescheduleBannerLine: {
    fontSize: 13,
    fontWeight: "500",
    color: "#C2410C",
    paddingLeft: 34,
  },
  rescheduleActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  btnDecline: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
  },
  btnDeclineText: {
    color: "#DC2626",
    fontWeight: "700",
    fontSize: 13,
  },
  btnAccept: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: "#059669",
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  btnAcceptText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
  btnDisabled: { opacity: 0.55 },

  /* ── Empty ── */
  empty: {
    paddingTop: 72,
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: "#EDE9FE",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#C4B5FD",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1A1A2E",
    letterSpacing: -0.4,
  },
  emptyText: {
    fontSize: 13,
    color: "#9B9BB0",
    textAlign: "center",
    lineHeight: 19,
    fontWeight: "500",
  },
});
