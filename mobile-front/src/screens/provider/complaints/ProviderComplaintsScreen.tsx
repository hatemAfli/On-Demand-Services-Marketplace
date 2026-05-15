import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ProviderStackParamList } from "../../../navigation/types";
import { COLORS } from "../../../constants";
import {
  api,
  type ComplaintDecision,
  type ComplaintStatus,
  type ProviderComplaintSummaryItem,
} from "../../../services/api";
import { useAppTranslation } from "../../../hooks/useAppTranslation";
import { CATEGORY_OPTIONS, getCategoryOption } from "../../client/complaints/categoryMeta";

type Props = NativeStackScreenProps<ProviderStackParamList, "ProviderComplaints">;

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

function decisionLabel(decision: ComplaintDecision): string {
  switch (decision) {
    case "WARNING_ISSUED":
      return "⚠️ Warning issued";
    case "ACCOUNT_SUSPENDED":
      return "🔒 Account suspended";
    case "ACCOUNT_BANNED":
      return "⛔ Account banned";
    case "REFUND_ISSUED":
      return "✓ Refund issued";
    case "NO_ACTION":
      return "✓ No action taken";
    case "FORWARDED_TO_COMPANY":
      return "↪ Forwarded to company";
    default:
      return decision;
  }
}

function parseItem(raw: unknown): ProviderComplaintSummaryItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : null;
  if (!id) return null;
  const apRaw = r.appointment as Record<string, unknown> | undefined;
  if (!apRaw) return null;
  return {
    id,
    category: r.category as ProviderComplaintSummaryItem["category"],
    status: r.status as ComplaintStatus,
    decision: (r.decision as ComplaintDecision | null) ?? null,
    adminResponse:
      typeof r.adminResponse === "string"
        ? r.adminResponse
        : r.adminResponse === null
          ? null
          : null,
    createdAt:
      typeof r.createdAt === "string" ? r.createdAt : String(r.createdAt ?? ""),
    appointment: {
      scheduledDate: String(apRaw.scheduledDate ?? "").slice(0, 10),
      scheduledTime: String(apRaw.scheduledTime ?? ""),
      serviceName: String(apRaw.serviceName ?? "Service"),
    },
  };
}

export const ProviderComplaintsScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useAppTranslation();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<ProviderComplaintSummaryItem[]>([]);
  const [totalComplaints, setTotalComplaints] = useState(0);
  const [activeComplaints, setActiveComplaints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback((opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    void api
      .getMyProviderComplaints()
      .then((res) => {
        const data = res.data;
        setTotalComplaints(typeof data?.totalComplaints === "number" ? data.totalComplaints : 0);
        setActiveComplaints(typeof data?.activeComplaints === "number" ? data.activeComplaints : 0);
        const raw = Array.isArray(data?.items) ? data.items : [];
        const next: ProviderComplaintSummaryItem[] = [];
        for (const x of raw) {
          const row = parseItem(x);
          if (row) next.push(row);
        }
        setItems(next);
      })
      .catch(() => {
        setItems([]);
        setTotalComplaints(0);
        setActiveComplaints(0);
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  const firstFocus = useRef(true);

  useFocusEffect(
    useCallback(() => {
      load({ silent: !firstFocus.current });
      firstFocus.current = false;
    }, [load]),
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t("provider.screenTitles.ProviderComplaints"),
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ marginLeft: 8, padding: 4 }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.text.primary} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, t]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load({ silent: true });
  }, [load]);

  const openBannerText = useMemo(() => {
    if (activeComplaints <= 0) return null;
    const n = activeComplaints;
    return n === 1
      ? "You have 1 open complaint under review."
      : `You have ${n} open complaints under review.`;
  }, [activeComplaints]);

  const renderItem = ({ item }: { item: ProviderComplaintSummaryItem }) => {
    const cat =
      getCategoryOption(item.category) ??
      CATEGORY_OPTIONS[CATEGORY_OPTIONS.length - 1];
    const pill = statusPillStyle(item.status);
    const apptLine = formatAppointmentLine(
      item.appointment.scheduledDate,
      item.appointment.scheduledTime,
    );
    const decision =
      item.decision != null ? decisionLabel(item.decision) : null;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.catRow}>
            <Ionicons name={cat.icon} size={22} color={COLORS.primary} />
            <Text style={styles.catLabel}>{cat.label}</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: pill.bg }]}>
            <Text style={[styles.statusPillText, { color: pill.text }]}>
              {statusLabel(item.status)}
            </Text>
          </View>
        </View>
        <Text style={styles.apptMeta} numberOfLines={2}>
          {item.appointment.serviceName}
          {" · "}
          {apptLine}
        </Text>
        {decision ? (
          <View style={styles.decisionChip}>
            <Text style={styles.decisionChipText}>{decision}</Text>
          </View>
        ) : null}
        {item.adminResponse ? (
          <View style={styles.adminCard}>
            <Text style={styles.adminCardTitle}>Message from admin:</Text>
            <Text style={styles.adminCardBody}>{item.adminResponse}</Text>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      {loading && items.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListHeaderComponent={
            <View style={styles.summaryBlock}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryChip}>
                  <Text style={styles.summaryChipLabel}>Total</Text>
                  <Text style={styles.summaryChipValue}>{totalComplaints}</Text>
                </View>
                <View style={[styles.summaryChip, styles.summaryChipActive]}>
                  <Text style={styles.summaryChipLabel}>Active</Text>
                  <Text style={styles.summaryChipValue}>{activeComplaints}</Text>
                </View>
              </View>
              {openBannerText ? (
                <View style={styles.warnBanner}>
                  <Ionicons name="alert-circle" size={20} color="#B45309" />
                  <Text style={styles.warnBannerText}>{openBannerText}</Text>
                </View>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="shield-checkmark" size={52} color={COLORS.success} />
              <Text style={styles.emptyTitle}>No complaints on record</Text>
              <Text style={styles.emptySub}>Keep up the great work!</Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.white },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  listContent: { padding: 16, paddingBottom: 32, flexGrow: 1 },
  summaryBlock: { marginBottom: 16 },
  summaryRow: { flexDirection: "row", gap: 10 },
  summaryChip: {
    flex: 1,
    backgroundColor: COLORS.gray[50],
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryChipActive: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FCD34D",
  },
  summaryChipLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.gray[500],
    textTransform: "uppercase",
  },
  summaryChipValue: {
    marginTop: 4,
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.text.primary,
  },
  warnBanner: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 12,
    padding: 12,
  },
  warnBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#92400E",
    lineHeight: 20,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  catRow: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  catLabel: {
    fontSize: 16,
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
  apptMeta: {
    marginTop: 10,
    fontSize: 13,
    color: COLORS.gray[600],
    lineHeight: 18,
  },
  decisionChip: {
    alignSelf: "flex-start",
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: COLORS.gray[50],
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  decisionChipText: { fontSize: 12, fontWeight: "700", color: COLORS.text.primary },
  adminCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  adminCardTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.info,
    marginBottom: 6,
  },
  adminCardBody: { fontSize: 14, color: COLORS.text.primary, lineHeight: 20 },
  empty: { alignItems: "center", paddingTop: 40, paddingHorizontal: 24 },
  emptyTitle: {
    marginTop: 14,
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text.primary,
    textAlign: "center",
  },
  emptySub: {
    marginTop: 8,
    fontSize: 15,
    color: COLORS.gray[500],
    textAlign: "center",
  },
});
