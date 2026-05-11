import React, {
  useCallback,
  useEffect,
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
      return "#4F46E5";
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
      return COLORS.gray?.[400] || "#9CA3AF";
  }
}

function statusBadgeStyle(status: AppointmentStatus): {
  bg: string;
  text: string;
} {
  if (
    status === "CANCELLED_CLIENT" ||
    status === "CANCELLED_PROVIDER" ||
    status === "REFUSED"
  ) {
    return { bg: "#FEF2F2", text: "#DC2626" };
  }
  if (status === "PENDING") return { bg: "#FFFBEB", text: "#D97706" };
  if (status === "CONFIRMED" || status === "EN_ROUTE")
    return { bg: "#EFF6FF", text: "#2563EB" };
  if (status === "IN_PROGRESS") return { bg: "#EEF2FF", text: "#4F46E5" };
  if (status === "COMPLETED") return { bg: "#ECFDF5", text: "#059669" };
  if (status === "RESCHEDULED") return { bg: "#FFF7ED", text: "#EA580C" };
  if (status === "DISPUTED") return { bg: "#F3F4F6", text: "#4B5563" };
  return {
    bg: COLORS.gray?.[100] || "#F3F4F6",
    text: COLORS.text?.secondary || "#4B5563",
  };
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
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
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
    const providerName =
      `${item.provider.firstName} ${item.provider.lastName}`.trim() ||
      "Provider";
    const initials =
      `${item.provider.firstName?.[0] ?? ""}${
        item.provider.lastName?.[0] ?? ""
      }`.toUpperCase() || "?";

    return (
      <View style={styles.cardWrap}>
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
          {/* Top Section: Provider Info & Status */}
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
            <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
              <Text style={[styles.statusBadgeText, { color: badge.text }]}>
                {statusLabel(item.status)}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Bottom Section: Service & Date/Time */}
          <View style={styles.cardBody}>
            <View style={styles.serviceInfo}>
              <Text style={styles.serviceName} numberOfLines={2}>
                {item.givenService.serviceName || "Service"}
              </Text>
              <Text style={styles.categoryName} numberOfLines={1}>
                {item.givenService.categoryName || "Uncategorized"}
              </Text>
            </View>

            <View style={styles.dateTimeWrap}>
              <View style={styles.iconCircle}>
                <Ionicons
                  name="calendar"
                  size={16}
                  color={COLORS.primary || "#4F46E5"}
                />
              </View>
              <Text style={styles.dateTime}>
                {formatCardDateTime(item.scheduledDate, item.scheduledTime)}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Reschedule Banner Attached Below Card */}
        {item.status === "RESCHEDULED" ? (
          <View style={styles.rescheduleBanner}>
            <View style={styles.rescheduleHeaderRow}>
              <Ionicons name="time-outline" size={18} color="#C2410C" />
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
                  <ActivityIndicator
                    color={COLORS.error || "#DC2626"}
                    size="small"
                  />
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
                  <Text style={styles.btnAcceptText}>Accept Time</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.root}>
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
          <ActivityIndicator size="large" color={COLORS.primary || "#4F46E5"} />
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
              tintColor={COLORS.primary || "#4F46E5"}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIconWrap}>
                <Ionicons
                  name="calendar-clear-outline"
                  size={42}
                  color={COLORS.gray?.[400] || "#9CA3AF"}
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
    backgroundColor: "#F9FAFB", // Very light gray for modern app backgrounds
  },
  filterWrapper: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    paddingVertical: 12,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "transparent",
  },
  filterChipActive: {
    backgroundColor: COLORS.primary || "#4F46E5",
    borderColor: COLORS.primary || "#4F46E5",
    shadowColor: COLORS.primary || "#4F46E5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4B5563",
    letterSpacing: 0.3,
  },
  filterChipTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  cardWrap: {
    marginBottom: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  card: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  providerInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F3F4F6",
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontSize: 16,
    fontWeight: "700",
    color: "#6B7280",
  },
  providerTextWrap: {
    marginLeft: 12,
    flex: 1,
  },
  providerName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  tagline: {
    marginTop: 2,
    fontSize: 13,
    color: "#6B7280",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  divider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginVertical: 14,
  },
  cardBody: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  serviceInfo: {
    flex: 1,
    paddingRight: 16,
  },
  serviceName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1F2937",
    lineHeight: 20,
  },
  categoryName: {
    marginTop: 4,
    fontSize: 13,
    color: "#6B7280",
  },
  dateTimeWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  iconCircle: {
    marginRight: 6,
  },
  dateTime: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
  },
  rescheduleBanner: {
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    backgroundColor: "#FFF7ED",
    padding: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  rescheduleHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  rescheduleBannerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#9A3412",
    marginLeft: 6,
  },
  rescheduleBannerLine: {
    fontSize: 14,
    fontWeight: "500",
    color: "#C2410C",
    marginBottom: 14,
  },
  rescheduleActions: {
    flexDirection: "row",
    gap: 12,
  },
  btnDecline: {
    flex: 1,
    paddingVertical: 12,
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
    fontSize: 14,
  },
  btnAccept: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.secondary || "#10B981",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.secondary || "#10B981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  btnAcceptText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    paddingTop: 64,
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
  },
});
