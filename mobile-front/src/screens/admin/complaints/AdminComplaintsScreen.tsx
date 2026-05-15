import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../../../constants";
import {
  api,
  type AdminComplaintListItem,
  type ComplaintCategory,
  type ComplaintStatus,
} from "../../../services/api";
import { CATEGORY_OPTIONS, getCategoryOption } from "../../client/complaints/categoryMeta";
import type { AdminComplaintsStackParamList } from "./adminComplaintsNavigation";

const ACCENT = "#E8C97A";
const HEADER_BG = "#0F172A";
const CHIP_ACTIVE_BG = "rgba(232,201,122,0.22)";
const CHIP_ACTIVE_BORDER = "rgba(232,201,122,0.55)";

type StatusFilterKey = "ALL" | "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "DISMISSED";

const PAGE_SIZE = 20;

const FILTER_CHIPS: { key: StatusFilterKey; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "OPEN", label: "Open" },
  { key: "UNDER_REVIEW", label: "Under review" },
  { key: "RESOLVED", label: "Resolved" },
  { key: "DISMISSED", label: "Dismissed" },
];

function parseYmdLocal(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatAppointmentLine(scheduledDate: string, scheduledTime: string): string {
  try {
    const d = parseYmdLocal(scheduledDate.slice(0, 10));
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

function urgencyBarColor(status: ComplaintStatus): string {
  switch (status) {
    case "OPEN":
      return COLORS.error;
    case "UNDER_REVIEW":
      return COLORS.warning;
    case "RESOLVED":
      return COLORS.success;
    case "DISMISSED":
    case "WITHDRAWN":
    default:
      return COLORS.gray[400];
  }
}

function statusPillStyle(status: ComplaintStatus): { bg: string; text: string } {
  switch (status) {
    case "OPEN":
      return { bg: "#FEF2F2", text: "#B91C1C" };
    case "UNDER_REVIEW":
      return { bg: "#FFFBEB", text: "#B45309" };
    case "RESOLVED":
      return { bg: "#ECFDF5", text: "#047857" };
    case "DISMISSED":
    case "WITHDRAWN":
    default:
      return { bg: COLORS.gray[100], text: COLORS.gray[600] };
  }
}

function statusLabel(status: ComplaintStatus): string {
  return status.replace(/_/g, " ");
}

function parseListItem(raw: unknown): AdminComplaintListItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : null;
  if (!id) return null;
  const category = r.category as ComplaintCategory;
  const status = r.status as ComplaintStatus;
  const description = typeof r.description === "string" ? r.description : "";
  const targetIsEmployee = Boolean(r.targetIsEmployee);
  const createdAt =
    typeof r.createdAt === "string" ? r.createdAt : String(r.createdAt ?? "");

  const clientRaw = r.client as Record<string, unknown> | undefined;
  const clientUser = clientRaw?.user as Record<string, unknown> | undefined;
  const client =
    clientRaw && clientUser
      ? {
          imageUrl:
            typeof clientRaw.imageUrl === "string"
              ? clientRaw.imageUrl
              : clientRaw.imageUrl === null
                ? null
                : null,
          user: {
            firstName: String(clientUser.firstName ?? ""),
            lastName: String(clientUser.lastName ?? ""),
          },
        }
      : null;

  const provRaw = r.provider as Record<string, unknown> | undefined;
  const provUser = provRaw?.user as Record<string, unknown> | undefined;
  const provider =
    provRaw && provUser
      ? {
          photoUrl:
            typeof provRaw.photoUrl === "string"
              ? provRaw.photoUrl
              : provRaw.photoUrl === null
                ? null
                : null,
          user: {
            firstName: String(provUser.firstName ?? ""),
            lastName: String(provUser.lastName ?? ""),
          },
        }
      : null;

  const apRaw = r.appointment as Record<string, unknown> | undefined;
  const appointment =
    apRaw &&
    typeof apRaw.scheduledDate !== "undefined" &&
    typeof apRaw.scheduledTime === "string"
      ? {
          id: String(apRaw.id ?? ""),
          scheduledDate:
            typeof apRaw.scheduledDate === "string"
              ? apRaw.scheduledDate.slice(0, 10)
              : String(apRaw.scheduledDate).slice(0, 10),
          scheduledTime: String(apRaw.scheduledTime),
          serviceName:
            typeof apRaw.serviceName === "string"
              ? apRaw.serviceName
              : "Service",
        }
      : null;

  if (!client || !provider || !appointment) return null;

  return {
    id,
    category,
    status,
    description,
    targetIsEmployee,
    createdAt,
    client,
    provider,
    appointment,
  };
}

export const AdminComplaintsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<AdminComplaintsStackParamList>>();

  const [filter, setFilter] = useState<StatusFilterKey>("ALL");
  const [items, setItems] = useState<AdminComplaintListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [unresolvedTotal, setUnresolvedTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadUnresolved = useCallback(async () => {
    try {
      const [openRes, urRes] = await Promise.all([
        api.getAllComplaints({ status: "OPEN", take: 1, skip: 0 }),
        api.getAllComplaints({ status: "UNDER_REVIEW", take: 1, skip: 0 }),
      ]);
      setUnresolvedTotal(
        (openRes.data?.total ?? 0) + (urRes.data?.total ?? 0),
      );
    } catch {
      setUnresolvedTotal(0);
    }
  }, []);

  const fetchPage = useCallback(
    async (opts: { skip: number; append: boolean }) => {
      const params: Parameters<typeof api.getAllComplaints>[0] = {
        take: PAGE_SIZE,
        skip: opts.skip,
        sort: "recent",
      };
      if (filter !== "ALL") {
        params.status = filter as ComplaintStatus;
      }
      const res = await api.getAllComplaints(params);
      const rawItems = Array.isArray(res.data?.items) ? res.data.items : [];
      const parsed: AdminComplaintListItem[] = [];
      for (const x of rawItems) {
        const row = parseListItem(x);
        if (row) parsed.push(row);
      }
      setTotal(typeof res.data?.total === "number" ? res.data.total : parsed.length);
      if (opts.append) {
        setItems((prev) => [...prev, ...parsed]);
      } else {
        setItems(parsed);
      }
    },
    [filter],
  );

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      try {
        await Promise.all([fetchPage({ skip: 0, append: false }), loadUnresolved()]);
      } catch {
        setItems([]);
        setTotal(0);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [fetchPage, loadUnresolved],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load({ silent: true });
  }, [load]);

  const onFilterChange = useCallback((next: StatusFilterKey) => {
    setFilter(next);
    setItems([]);
    setTotal(0);
  }, []);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || items.length >= total) return;
    setLoadingMore(true);
    void fetchPage({ skip: items.length, append: true })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }, [loading, loadingMore, items.length, total, fetchPage]);

  const emptyMessage = useMemo(() => {
    switch (filter) {
      case "OPEN":
        return "No open complaints.";
      case "UNDER_REVIEW":
        return "Nothing under review.";
      case "RESOLVED":
        return "No resolved complaints yet.";
      case "DISMISSED":
        return "No dismissed complaints.";
      default:
        return "No complaints match this view.";
    }
  }, [filter]);

  const renderChip = (key: StatusFilterKey, label: string) => {
    const active = filter === key;
    return (
      <TouchableOpacity
        key={key}
        onPress={() => onFilterChange(key)}
        style={[
          styles.chip,
          active && styles.chipActive,
        ]}
        activeOpacity={0.85}
      >
        <Text style={[styles.chipText, active && styles.chipTextActive]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item }: { item: AdminComplaintListItem }) => {
    const cat =
      getCategoryOption(item.category) ??
      CATEGORY_OPTIONS[CATEGORY_OPTIONS.length - 1];
    const bar = urgencyBarColor(item.status);
    const pill = statusPillStyle(item.status);
    const clientName = `${item.client.user.firstName} ${item.client.user.lastName}`.trim();
    const providerName = `${item.provider.user.firstName} ${item.provider.user.lastName}`.trim();
    const apptLine = formatAppointmentLine(
      item.appointment.scheduledDate,
      item.appointment.scheduledTime,
    );

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.92}
        onPress={() =>
          navigation.navigate("AdminComplaintDetail", { complaintId: item.id })
        }
      >
        <View style={[styles.urgencyBar, { backgroundColor: bar }]} />
        <View style={styles.cardInner}>
          <View style={styles.cardTop}>
            <View style={styles.cardTopLeft}>
              <Ionicons name={cat.icon} size={20} color={ACCENT} />
              <Text style={styles.categoryLabel}>{cat.label}</Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: pill.bg }]}>
              <Text style={[styles.statusPillText, { color: pill.text }]}>
                {statusLabel(item.status)}
              </Text>
            </View>
          </View>

          <View style={styles.partiesRow}>
            <Text style={styles.partyName} numberOfLines={1}>
              {clientName}
            </Text>
            <Ionicons name="arrow-forward" size={14} color={COLORS.gray[400]} />
            <Text style={styles.partyName} numberOfLines={1}>
              {providerName}
            </Text>
          </View>

          <Text style={styles.apptLine} numberOfLines={1}>
            {apptLine}
          </Text>

          <View style={styles.chipRow}>
            {item.targetIsEmployee ? (
              <View style={styles.employeeChip}>
                <Text style={styles.employeeChipText}>Employee</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.cardBottom}>
            <Text style={styles.preview} numberOfLines={2}>
              {item.description}
            </Text>
            <TouchableOpacity
              style={styles.reviewBtn}
              onPress={() =>
                navigation.navigate("AdminComplaintDetail", { complaintId: item.id })
              }
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.reviewBtnText}>Review →</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.root}>
      <View style={[styles.darkHeader, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Complaints</Text>
          {unresolvedTotal > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unresolvedTotal}</Text>
              <Text style={styles.badgeSub}>open</Text>
            </View>
          ) : null}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScroll}
        >
          {FILTER_CHIPS.map((c) => renderChip(c.key, c.label))}
        </ScrollView>
      </View>

      {loading && items.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listPad,
            { paddingBottom: 24 + insets.bottom },
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />
          }
          onEndReachedThreshold={0.35}
          onEndReached={() => void loadMore()}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator style={{ marginVertical: 16 }} color={ACCENT} />
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="file-tray-outline" size={40} color={COLORS.gray[400]} />
              <Text style={styles.emptyTitle}>No complaints</Text>
              <Text style={styles.emptySub}>{emptyMessage}</Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F8FAFC" },
  darkHeader: {
    backgroundColor: HEADER_BG,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#F8FAFC",
    letterSpacing: -0.5,
  },
  badge: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    backgroundColor: CHIP_ACTIVE_BG,
    borderWidth: 1,
    borderColor: CHIP_ACTIVE_BORDER,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 16,
    fontWeight: "800",
    color: ACCENT,
  },
  badgeSub: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(248,250,252,0.75)",
    textTransform: "uppercase",
  },
  chipsScroll: {
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 2,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  chipActive: {
    backgroundColor: CHIP_ACTIVE_BG,
    borderColor: CHIP_ACTIVE_BORDER,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(248,250,252,0.65)",
  },
  chipTextActive: {
    color: ACCENT,
  },
  listPad: { padding: 16, flexGrow: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  card: {
    flexDirection: "row",
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  urgencyBar: { width: 5 },
  cardInner: { flex: 1, padding: 14 },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  cardTopLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  categoryLabel: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.text.primary,
    flex: 1,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusPillText: { fontSize: 11, fontWeight: "700" },
  partiesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  partyName: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text.secondary,
  },
  apptLine: {
    marginTop: 6,
    fontSize: 12,
    color: COLORS.gray[500],
  },
  chipRow: { marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  employeeChip: {
    alignSelf: "flex-start",
    backgroundColor: "#F5F3FF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#DDD6FE",
  },
  employeeChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6D28D9",
  },
  cardBottom: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 10,
  },
  preview: {
    flex: 1,
    fontSize: 13,
    color: COLORS.gray[600],
    lineHeight: 18,
  },
  reviewBtn: { paddingVertical: 4, paddingHorizontal: 4 },
  reviewBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: ACCENT,
  },
  empty: { alignItems: "center", paddingTop: 48, paddingHorizontal: 24 },
  emptyTitle: {
    marginTop: 12,
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.text.primary,
  },
  emptySub: {
    marginTop: 6,
    fontSize: 14,
    color: COLORS.gray[500],
    textAlign: "center",
  },
});
