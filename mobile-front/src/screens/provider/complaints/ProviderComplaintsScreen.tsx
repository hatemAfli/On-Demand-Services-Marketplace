import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
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

// ─── Helpers (unchanged) ──────────────────────────────────────────────────────

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

function statusPillStyle(status: ComplaintStatus): {
  bg: string;
  text: string;
  dot: string;
  border: string;
} {
  switch (status) {
    case "OPEN":
      return { bg: "#FEF2F2", text: "#B91C1C", dot: "#EF4444", border: "#FECACA" };
    case "UNDER_REVIEW":
      return { bg: "#FFFBEB", text: "#B45309", dot: "#F59E0B", border: "#FDE68A" };
    case "RESOLVED":
      return { bg: "#ECFDF5", text: "#047857", dot: "#10B981", border: "#A7F3D0" };
    case "DISMISSED":
    case "WITHDRAWN":
    default:
      return { bg: "#F8FAFC", text: "#64748B", dot: "#94A3B8", border: "#E2E8F0" };
  }
}

function statusLabel(status: ComplaintStatus): string {
  return status.replace(/_/g, " ");
}

function decisionLabel(decision: ComplaintDecision): string {
  switch (decision) {
    case "WARNING_ISSUED":
      return "Warning issued";
    case "ACCOUNT_SUSPENDED":
      return "Account suspended";
    case "ACCOUNT_BANNED":
      return "Account banned";
    case "REFUND_ISSUED":
      return "Refund issued";
    case "NO_ACTION":
      return "No action taken";
    case "FORWARDED_TO_COMPANY":
      return "Forwarded to company";
    default:
      return decision;
  }
}

function decisionIcon(decision: ComplaintDecision): { name: React.ComponentProps<typeof Ionicons>["name"]; color: string } {
  switch (decision) {
    case "WARNING_ISSUED":
      return { name: "warning-outline", color: "#D97706" };
    case "ACCOUNT_SUSPENDED":
      return { name: "lock-closed-outline", color: "#7C3AED" };
    case "ACCOUNT_BANNED":
      return { name: "ban-outline", color: "#DC2626" };
    case "REFUND_ISSUED":
      return { name: "checkmark-circle-outline", color: "#059669" };
    case "NO_ACTION":
      return { name: "checkmark-done-outline", color: "#059669" };
    case "FORWARDED_TO_COMPANY":
      return { name: "arrow-redo-outline", color: "#2563EB" };
    default:
      return { name: "ellipse-outline", color: "#64748B" };
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

// ─── Animated card wrapper ────────────────────────────────────────────────────

const AnimatedCard: React.FC<{ children: React.ReactNode; index: number }> = ({
  children,
  index,
}) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 320,
        delay: index * 60,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        delay: index * 60,
        useNativeDriver: true,
        speed: 20,
        bounciness: 4,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

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

  const renderItem = ({ item, index }: { item: ProviderComplaintSummaryItem; index: number }) => {
    const cat =
      getCategoryOption(item.category) ??
      CATEGORY_OPTIONS[CATEGORY_OPTIONS.length - 1];
    const pill = statusPillStyle(item.status);
    const apptLine = formatAppointmentLine(
      item.appointment.scheduledDate,
      item.appointment.scheduledTime,
    );
    const decision = item.decision != null ? decisionLabel(item.decision) : null;
    const decIcon = item.decision != null ? decisionIcon(item.decision) : null;

    return (
      <AnimatedCard index={index}>
        <View style={styles.card}>
          {/* Left accent bar keyed to status color */}
          <View style={[styles.cardAccent, { backgroundColor: pill.dot }]} />

          <View style={styles.cardBody}>
            {/* Header row */}
            <View style={styles.cardHeader}>
              <View style={styles.catRow}>
                <View style={[styles.catIconWrap, { backgroundColor: pill.bg }]}>
                  <Ionicons name={cat.icon} size={16} color={pill.dot} />
                </View>
                <Text style={styles.catLabel} numberOfLines={1}>
                  {cat.label}
                </Text>
              </View>
              {/* Status pill */}
              <View
                style={[
                  styles.statusPill,
                  { backgroundColor: pill.bg, borderColor: pill.border },
                ]}
              >
                <View style={[styles.statusDot, { backgroundColor: pill.dot }]} />
                <Text style={[styles.statusPillText, { color: pill.text }]}>
                  {statusLabel(item.status)}
                </Text>
              </View>
            </View>

            {/* Appointment meta */}
            <View style={styles.apptRow}>
              <Ionicons name="calendar-outline" size={12} color="#94A3B8" />
              <Text style={styles.apptMeta} numberOfLines={1}>
                {item.appointment.serviceName}
              </Text>
              <Text style={styles.apptDot}>·</Text>
              <Text style={styles.apptMeta} numberOfLines={1}>
                {apptLine}
              </Text>
            </View>

            {/* Decision chip */}
            {decision && decIcon ? (
              <View style={styles.decisionChip}>
                <Ionicons name={decIcon.name} size={13} color={decIcon.color} />
                <Text style={[styles.decisionChipText, { color: decIcon.color }]}>
                  {decision}
                </Text>
              </View>
            ) : null}

            {/* Admin response */}
            {item.adminResponse ? (
              <View style={styles.adminCard}>
                <View style={styles.adminCardHeader}>
                  <View style={styles.adminIconWrap}>
                    <Ionicons name="shield-half-outline" size={12} color="#2563EB" />
                  </View>
                  <Text style={styles.adminCardTitle}>Admin response</Text>
                </View>
                <Text style={styles.adminCardBody}>{item.adminResponse}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </AnimatedCard>
    );
  };

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      {loading && items.length === 0 ? (
        <View style={styles.centered}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color="#DC2626" />
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
            items.length === 0 && styles.listContentEmpty,
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#DC2626"
            />
          }
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.summaryBlock}>
              {/* Stats row */}
              <View style={styles.summaryRow}>
                <View style={styles.summaryChip}>
                  <Text style={styles.summaryChipLabel}>Total</Text>
                  <Text style={styles.summaryChipValue}>{totalComplaints}</Text>
                  <View style={styles.summaryChipBar}>
                    <View style={[styles.summaryChipBarFill, { backgroundColor: "#CBD5E1", width: "100%" }]} />
                  </View>
                </View>
                <View style={[styles.summaryChip, styles.summaryChipActive]}>
                  <Text style={[styles.summaryChipLabel, { color: "#B45309" }]}>Active</Text>
                  <Text style={[styles.summaryChipValue, { color: "#B45309" }]}>{activeComplaints}</Text>
                  <View style={styles.summaryChipBar}>
                    <View
                      style={[
                        styles.summaryChipBarFill,
                        {
                          backgroundColor: "#F59E0B",
                          width: totalComplaints > 0
                            ? `${Math.round((activeComplaints / totalComplaints) * 100)}%`
                            : "0%",
                        },
                      ]}
                    />
                  </View>
                </View>
              </View>

              {/* Warning banner */}
              {openBannerText ? (
                <View style={styles.warnBanner}>
                  <View style={styles.warnBannerIconWrap}>
                    <Ionicons name="alert-circle" size={18} color="#B45309" />
                  </View>
                  <Text style={styles.warnBannerText}>{openBannerText}</Text>
                </View>
              ) : null}

              {/* Section heading */}
              {items.length > 0 && (
                <View style={styles.sectionHeadRow}>
                  <Text style={styles.sectionHeadText}>All Complaints</Text>
                  <View style={styles.sectionHeadBadge}>
                    <Text style={styles.sectionHeadBadgeText}>{items.length}</Text>
                  </View>
                </View>
              )}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="shield-checkmark" size={36} color="#059669" />
              </View>
              <Text style={styles.emptyTitle}>All clear</Text>
              <Text style={styles.emptySub}>No complaints on record. Keep up the great work!</Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  // ── Root ────────────────────────────────────────────────────────────────────
  root: { flex: 1, backgroundColor: "#F7F6FB" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingCard: {
    alignItems: "center",
    gap: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 32,
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
  },
  loadingText: {
    fontSize: 14,
    color: "#94A3B8",
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  listContent: { padding: 16, paddingBottom: 40 },
  listContentEmpty: { flexGrow: 1 },

  // ── Summary block ────────────────────────────────────────────────────────────
  summaryBlock: { marginBottom: 18, gap: 10 },
  summaryRow: { flexDirection: "row", gap: 10 },
  summaryChip: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#E8EAF0",
    gap: 2,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  summaryChipActive: {
    backgroundColor: "#FFFDF5",
    borderColor: "#FDE68A",
    shadowColor: "#F59E0B",
    shadowOpacity: 0.08,
  },
  summaryChipLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  summaryChipValue: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -1,
    marginBottom: 6,
  },
  summaryChipBar: {
    height: 3,
    borderRadius: 2,
    backgroundColor: "#F1F5F9",
    overflow: "hidden",
  },
  summaryChipBarFill: {
    height: 3,
    borderRadius: 2,
  },

  // ── Warning banner ────────────────────────────────────────────────────────────
  warnBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 14,
    padding: 12,
  },
  warnBannerIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },
  warnBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#92400E",
    lineHeight: 19,
  },

  // ── Section heading ────────────────────────────────────────────────────────
  sectionHeadRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  sectionHeadText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.9,
  },
  sectionHeadBadge: {
    backgroundColor: "#E2E8F0",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  sectionHeadBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
  },

  // ── Card ─────────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EDEDF5",
    flexDirection: "row",
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardAccent: {
    width: 4,
    alignSelf: "stretch",
  },
  cardBody: {
    flex: 1,
    padding: 14,
    gap: 10,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  catRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  catIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  catLabel: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    flex: 1,
    letterSpacing: -0.2,
  },

  // ── Status pill ───────────────────────────────────────────────────────────────
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.1,
    textTransform: "capitalize",
  },

  // ── Appointment meta ───────────────────────────────────────────────────────────
  apptRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexWrap: "wrap",
  },
  apptMeta: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
    flexShrink: 1,
  },
  apptDot: {
    fontSize: 12,
    color: "#CBD5E1",
  },

  // ── Decision chip ─────────────────────────────────────────────────────────────
  decisionChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  decisionChipText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.1,
  },

  // ── Admin card ────────────────────────────────────────────────────────────────
  adminCard: {
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    padding: 12,
    gap: 6,
  },
  adminCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  adminIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
  },
  adminCardTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#1D4ED8",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  adminCardBody: {
    fontSize: 13,
    color: "#1E3A8A",
    lineHeight: 19,
    fontWeight: "400",
  },

  // ── Empty state ───────────────────────────────────────────────────────────────
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#A7F3D0",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.4,
  },
  emptySub: {
    fontSize: 14,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 20,
    fontWeight: "500",
  },
});