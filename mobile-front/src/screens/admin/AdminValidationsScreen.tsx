import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { api } from "../../services/api";
import { COLORS } from "../../constants";
import type { AdminValidationsStackParamList } from "./adminValidationsNavigation";

const ACCENT = "#E8C97A";

type OwnerFilter = "ALL" | "PROVIDER" | "COMPANY";

type VerificationDoc = {
  id: string;
  type: string;
  fichierUrl: string;
  uploadedAt: string;
  validatedAt: string | null;
};

type VerificationRequestRow = {
  id: string;
  requestStatus: string;
  ownerType?: string;
  createdAt: string;
  adminComment: string | null;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role?: string;
  };
  service: { id: string; name: string } | null;
  documents: VerificationDoc[];
};

type ListResponse = {
  items: VerificationRequestRow[];
  total: number;
};

function isCompanyRow(item: VerificationRequestRow): boolean {
  return (
    item.ownerType === "COMPANY" || item.user.role === "COMPANY_ADMIN"
  );
}

export const AdminValidationsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<AdminValidationsStackParamList>>();

  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>("ALL");
  const [items, setItems] = useState<VerificationRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.listAdminVerificationRequests({
        take: 100,
        ...(ownerFilter !== "ALL" ? { ownerType: ownerFilter } : {}),
      });
      const data = res.data as ListResponse;
      const list = data.items ?? [];
      setItems(
        list.filter(
          (r) =>
            r.requestStatus === "PENDING" ||
            r.requestStatus === "UNDER_REVIEW",
        ),
      );
    } catch {
      setError("Could not load requests.");
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [ownerFilter]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    void load();
  };

  const renderFilterChip = (key: OwnerFilter, label: string) => {
    const active = ownerFilter === key;
    return (
      <TouchableOpacity
        key={key}
        style={[styles.filterChip, active && styles.filterChipActive]}
        onPress={() => setOwnerFilter(key)}
        activeOpacity={0.85}
      >
        <Text
          style={[styles.filterChipText, active && styles.filterChipTextActive]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderCard = ({ item }: { item: VerificationRequestRow }) => {
    const name =
      `${item.user.firstName ?? ""} ${item.user.lastName ?? ""}`.trim() ||
      "Applicant";
    const initials = name
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    const docCount = item.documents?.length ?? 0;
    const company = isCompanyRow(item);

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.88}
        onPress={() =>
          navigation.navigate("ValidationProviderDetail", {
            requestId: item.id,
            displayName: name,
            email: item.user.email,
          })
        }
      >
        <View style={styles.cardInner}>
          <View style={styles.cardRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={styles.cardMain}>
              <View style={styles.titleRow}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {name}
                </Text>
                <View
                  style={[
                    styles.kindPill,
                    company ? styles.kindPillCompany : styles.kindPillProvider,
                  ]}
                >
                  <Ionicons
                    name={company ? "business" : "briefcase-outline"}
                    size={12}
                    color={company ? "#6D28D9" : "#0369A1"}
                  />
                  <Text
                    style={[
                      styles.kindPillText,
                      company
                        ? styles.kindPillTextCompany
                        : styles.kindPillTextProvider,
                    ]}
                  >
                    {company ? "Company" : "Provider"}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardEmail} numberOfLines={1}>
                {item.user.email}
              </Text>
              <Text style={styles.serviceLine} numberOfLines={1}>
                {item.service?.name ??
                  (company ? "Company verification" : "—")}
              </Text>
              <View style={styles.cardMeta}>
                <View style={styles.badge}>
                  <Ionicons
                    name="documents-outline"
                    size={14}
                    color={COLORS.gray[600]}
                  />
                  <Text style={styles.badgeText}>
                    {docCount} file{docCount === 1 ? "" : "s"}
                  </Text>
                </View>
                <View
                  style={[styles.statusMini, statusPillStyle(item.requestStatus)]}
                >
                  <Text style={styles.statusMiniText}>
                    {item.requestStatus}
                  </Text>
                </View>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={22} color={COLORS.gray[400]} />
          </View>
          <View style={styles.cardFooter}>
            <Text style={styles.cardHint}>Open documents and actions</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <View style={styles.headerIconWrap}>
          <Ionicons name="shield-checkmark" size={28} color={ACCENT} />
        </View>
        <Text style={styles.title}>Validations</Text>
        <View style={styles.filterRow}>
          {renderFilterChip("ALL", "All")}
          {renderFilterChip("PROVIDER", "Providers")}
          {renderFilterChip("COMPANY", "Companies")}
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={ACCENT} size="large" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={48} color={COLORS.gray[400]} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => void load()} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          renderItem={renderCard}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: 36 + insets.bottom },
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons
                name="checkmark-done-circle-outline"
                size={56}
                color={COLORS.gray[300]}
              />
              <Text style={styles.empty}>Queue is clear</Text>
              <Text style={styles.emptySub}>
                {ownerFilter === "ALL"
                  ? "New submissions will appear here for review."
                  : `No ${ownerFilter === "PROVIDER" ? "provider" : "company"} requests in queue.`}
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

function statusPillStyle(status: string) {
  switch (status) {
    case "UNDER_REVIEW":
      return { backgroundColor: "#DBEAFE" };
    case "PENDING":
      return { backgroundColor: "#FEF3C7" };
    default:
      return { backgroundColor: COLORS.gray[100] };
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    alignItems: "center",
  },
  headerIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "rgba(232,201,122,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(232,201,122,0.45)",
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: COLORS.text.primary,
    marginBottom: 16,
    textAlign: "center",
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    width: "100%",
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: "rgba(232,201,122,0.35)",
    borderColor: ACCENT,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text.secondary,
  },
  filterChipTextActive: {
    color: COLORS.gray[800],
  },
  listContent: { paddingHorizontal: 20, gap: 14, paddingTop: 4 },
  card: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
      },
      android: { elevation: 2 },
    }),
  },
  cardInner: {
    padding: 16,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(232,201,122,0.22)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(232,201,122,0.4)",
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#B45309",
  },
  cardMain: { flex: 1, minWidth: 0 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.text.primary,
    flex: 1,
    minWidth: 120,
  },
  kindPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  kindPillProvider: { backgroundColor: "#E0F2FE" },
  kindPillCompany: { backgroundColor: "#EDE9FE" },
  kindPillText: { fontSize: 11, fontWeight: "800" },
  kindPillTextProvider: { color: "#0369A1" },
  kindPillTextCompany: { color: "#6D28D9" },
  cardEmail: {
    fontSize: 13,
    color: COLORS.text.secondary,
    marginTop: 4,
  },
  serviceLine: {
    fontSize: 13,
    color: COLORS.gray[600],
    marginTop: 6,
  },
  cardMeta: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.gray[100],
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.gray[700],
  },
  statusMini: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusMiniText: {
    fontSize: 10,
    fontWeight: "800",
    color: COLORS.gray[800],
    textTransform: "uppercase",
  },
  cardFooter: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  cardHint: {
    fontSize: 12,
    color: COLORS.text.tertiary,
    fontWeight: "600",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    gap: 12,
  },
  errorText: { color: COLORS.error, textAlign: "center" },
  retryBtn: { paddingVertical: 10, paddingHorizontal: 16, marginTop: 8 },
  retryBtnText: { color: "#B45309", fontWeight: "700", fontSize: 16 },
  emptyWrap: {
    alignItems: "center",
    paddingTop: 48,
    paddingHorizontal: 20,
    gap: 12,
  },
  empty: {
    textAlign: "center",
    color: COLORS.text.primary,
    fontSize: 17,
    fontWeight: "700",
  },
  emptySub: {
    textAlign: "center",
    color: COLORS.text.secondary,
    fontSize: 14,
    lineHeight: 20,
  },
});
