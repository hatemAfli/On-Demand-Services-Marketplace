import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
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

const ACCENT = "#EA580C";
const ACCENT_DARK = "#C2410C";
const ACCENT_DIM = "#FFF7ED";
const ACCENT_BORDER = "#FFEDD5";

type StatusFilterKey = "ALL" | "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "DISMISSED";

const PAGE_SIZE = 20;

const FILTER_CHIPS: {
  key: StatusFilterKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: "ALL", label: "All", icon: "apps-outline" },
  { key: "OPEN", label: "Open", icon: "alert-circle-outline" },
  { key: "UNDER_REVIEW", label: "In review", icon: "time-outline" },
  { key: "RESOLVED", label: "Resolved", icon: "checkmark-circle-outline" },
  { key: "DISMISSED", label: "Dismissed", icon: "close-circle-outline" },
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
      return { bg: ACCENT_DIM, text: ACCENT_DARK };
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
  const [openTotal, setOpenTotal] = useState(0);
  const [underReviewTotal, setUnderReviewTotal] = useState(0);
  const [grandTotal, setGrandTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadUnresolved = useCallback(async () => {
    try {
      const [openRes, urRes, allRes] = await Promise.all([
        api.getAllComplaints({ status: "OPEN", take: 1, skip: 0 }),
        api.getAllComplaints({ status: "UNDER_REVIEW", take: 1, skip: 0 }),
        api.getAllComplaints({ take: 1, skip: 0 }),
      ]);
      const open = openRes.data?.total ?? 0;
      const underReview = urRes.data?.total ?? 0;
      setOpenTotal(open);
      setUnderReviewTotal(underReview);
      setGrandTotal(allRes.data?.total ?? 0);
    } catch {
      setOpenTotal(0);
      setUnderReviewTotal(0);
      setGrandTotal(0);
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

  const renderChip = (
    key: StatusFilterKey,
    label: string,
    icon: keyof typeof Ionicons.glyphMap,
  ) => {
    const active = filter === key;
    return (
      <TouchableOpacity
        key={key}
        onPress={() => onFilterChange(key)}
        style={[styles.filterChip, active && styles.filterChipActive]}
        activeOpacity={0.82}
      >
        <Ionicons
          name={icon}
          size={13}
          color={active ? ACCENT_DARK : "#9B9BB0"}
        />
        <Text
          style={[styles.filterChipText, active && styles.filterChipTextActive]}
        >
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
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerIconWrap}>
            <Ionicons name="shield-outline" size={24} color={ACCENT} />
          </View>
          <View style={styles.headerTextWrap}>
            <Text style={styles.title}>Complaints</Text>
            <Text style={styles.titleSub}>Platform reclamation queue</Text>
          </View>
        </View>

        {!loading && (
          <View style={styles.statsRow}>
            <View style={styles.statChip}>
              <View style={[styles.statDot, { backgroundColor: "#EF4444" }]} />
              <Text style={styles.statText}>{openTotal} open</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statChip}>
              <View style={[styles.statDot, { backgroundColor: "#F59E0B" }]} />
              <Text style={styles.statText}>{underReviewTotal} in review</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statChip}>
              <Text style={styles.statText}>{grandTotal} total</Text>
            </View>
          </View>
        )}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTER_CHIPS.map((c) => renderChip(c.key, c.label, c.icon))}
        </ScrollView>
      </View>

      {loading && items.length === 0 ? (
        <View style={styles.centered}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={ACCENT} />
            <Text style={styles.loadingText}>Loading complaints…</Text>
          </View>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: 36 + insets.bottom },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={ACCENT}
              colors={[ACCENT]}
            />
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
  root: { flex: 1, backgroundColor: "#F4F3FA" },

  header: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#EBEBF5",
    ...Platform.select({
      ios: {
        shadowColor: "#1A1A2E",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
    gap: 14,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingTop: 4,
  },
  headerIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: ACCENT_DIM,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: ACCENT_BORDER,
  },
  headerTextWrap: { flex: 1 },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1A1A2E",
    letterSpacing: -0.4,
  },
  titleSub: {
    fontSize: 12,
    color: "#9B9BB0",
    fontWeight: "500",
    marginTop: 1,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9F8FF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EBEBF5",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  statChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  statDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B6B80",
  },
  statDivider: {
    width: 1,
    height: 16,
    backgroundColor: "#EBEBF5",
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 2,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#F4F3FA",
    borderWidth: 1.5,
    borderColor: "#EBEBF5",
  },
  filterChipActive: {
    backgroundColor: ACCENT_DIM,
    borderColor: ACCENT,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#9B9BB0",
  },
  filterChipTextActive: {
    color: ACCENT_DARK,
  },
  listContent: { paddingHorizontal: 16, paddingTop: 16, flexGrow: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingCard: {
    alignItems: "center",
    gap: 12,
    padding: 28,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EBEBF5",
  },
  loadingText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9B9BB0",
  },
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
