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
import { api } from "../../../services/api";
import { COLORS } from "../../../constants";
import type { AdminValidationsStackParamList } from "./adminValidationsNavigation";

const ACCENT = "#EA580C";
const ACCENT_DARK = "#C2410C";
const ACCENT_DIM = "#FFF7ED";
const ACCENT_BORDER = "#FFEDD5";

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
  return item.ownerType === "COMPANY" || item.user.role === "COMPANY_ADMIN";
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
            r.requestStatus === "PENDING" || r.requestStatus === "UNDER_REVIEW",
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

  const renderFilterChip = (key: OwnerFilter, label: string, icon: string) => {
    const active = ownerFilter === key;
    return (
      <TouchableOpacity
        key={key}
        style={[styles.filterChip, active && styles.filterChipActive]}
        onPress={() => setOwnerFilter(key)}
        activeOpacity={0.8}
      >
        <Ionicons
          name={icon as any}
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

    const statusConfig = getStatusConfig(item.requestStatus);

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
        {/* Left accent stripe */}
        <View
          style={[styles.cardStripe, { backgroundColor: statusConfig.stripe }]}
        />

        <View style={styles.cardInner}>
          <View style={styles.cardRow}>
            {/* Avatar */}
            <View style={[styles.avatar, company && styles.avatarCompany]}>
              <Text
                style={[styles.avatarText, company && styles.avatarTextCompany]}
              >
                {initials}
              </Text>
            </View>

            <View style={styles.cardMain}>
              {/* Name + kind pill */}
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
                    size={11}
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

              {/* Email */}
              <Text style={styles.cardEmail} numberOfLines={1}>
                {item.user.email}
              </Text>

              {/* Service */}
              <View style={styles.serviceLineWrap}>
                <Ionicons name="layers-outline" size={12} color="#9B9BB0" />
                <Text style={styles.serviceLine} numberOfLines={1}>
                  {item.service?.name ??
                    (company ? "Company verification" : "—")}
                </Text>
              </View>

              {/* Meta row */}
              <View style={styles.cardMeta}>
                <View style={styles.badge}>
                  <Ionicons
                    name="documents-outline"
                    size={12}
                    color="#6B6B80"
                  />
                  <Text style={styles.badgeText}>
                    {docCount} file{docCount === 1 ? "" : "s"}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusMini,
                    { backgroundColor: statusConfig.bg },
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: statusConfig.dot },
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusMiniText,
                      { color: statusConfig.text },
                    ]}
                  >
                    {item.requestStatus.replace("_", " ")}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.chevronWrap}>
              <Ionicons name="chevron-forward" size={16} color="#9B9BB0" />
            </View>
          </View>

          {/* Footer CTA */}
          <View style={styles.cardFooter}>
            <Ionicons name="eye-outline" size={13} color={ACCENT} />
            <Text style={styles.cardHint}>
              Review documents and take action
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const pendingCount = items.filter(
    (i) => i.requestStatus === "PENDING",
  ).length;
  const reviewCount = items.filter(
    (i) => i.requestStatus === "UNDER_REVIEW",
  ).length;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerIconWrap}>
            <Ionicons name="shield-checkmark" size={24} color={ACCENT} />
          </View>
          <View style={styles.headerTextWrap}>
            <Text style={styles.title}>Validations</Text>
            <Text style={styles.titleSub}>Pending review queue</Text>
          </View>
        </View>

        {/* Stats row */}
        {!loading && !error && (
          <View style={styles.statsRow}>
            <View style={styles.statChip}>
              <View style={[styles.statDot, { backgroundColor: "#F59E0B" }]} />
              <Text style={styles.statText}>{pendingCount} pending</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statChip}>
              <View style={[styles.statDot, { backgroundColor: "#3B82F6" }]} />
              <Text style={styles.statText}>{reviewCount} in review</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statChip}>
              <Text style={styles.statText}>{items.length} total</Text>
            </View>
          </View>
        )}

        {/* Filter chips */}
        <View style={styles.filterRow}>
          {renderFilterChip("ALL", "All", "apps-outline")}
          {renderFilterChip("PROVIDER", "Providers", "briefcase-outline")}
          {renderFilterChip("COMPANY", "Companies", "business-outline")}
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <View style={styles.loadingCard}>
            <ActivityIndicator color={ACCENT} size="large" />
            <Text style={styles.loadingText}>Loading requests…</Text>
          </View>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <View style={styles.errorCard}>
            <Ionicons name="cloud-offline-outline" size={40} color="#9B9BB0" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              onPress={() => void load()}
              style={styles.retryBtn}
            >
              <Ionicons name="refresh-outline" size={15} color={ACCENT_DARK} />
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
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
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={ACCENT}
              colors={[ACCENT]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconWrap}>
                <Ionicons
                  name="checkmark-done-circle-outline"
                  size={40}
                  color={ACCENT}
                />
              </View>
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

function getStatusConfig(status: string) {
  switch (status) {
    case "UNDER_REVIEW":
      return {
        bg: "#EFF6FF",
        text: "#1D4ED8",
        dot: "#3B82F6",
        stripe: "#3B82F6",
      };
    case "PENDING":
      return {
        bg: ACCENT_DIM,
        text: ACCENT_DARK,
        dot: ACCENT,
        stripe: ACCENT,
      };
    default:
      return {
        bg: "#F4F3FA",
        text: "#6B6B80",
        dot: "#C4C4C4",
        stripe: "#C4C4C4",
      };
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F4F3FA" },

  /* Header */
  header: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#EBEBF5",
    shadowColor: "#1A1A2E",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
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

  /* Stats */
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9F8FF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EBEBF5",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 0,
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

  /* Filter chips */
  filterRow: {
    flexDirection: "row",
    gap: 8,
  },
  filterChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 9,
    paddingHorizontal: 10,
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

  /* List */
  listContent: { paddingHorizontal: 16, gap: 12, paddingTop: 16 },

  /* Card */
  card: {
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EBEBF5",
    flexDirection: "row",
    ...Platform.select({
      ios: {
        shadowColor: "#1A1A2E",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
      },
      android: { elevation: 2 },
    }),
  },
  cardStripe: {
    width: 4,
    alignSelf: "stretch",
  },
  cardInner: {
    flex: 1,
    padding: 14,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  /* Avatar */
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: ACCENT_DIM,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: ACCENT_BORDER,
    flexShrink: 0,
  },
  avatarCompany: {
    backgroundColor: "#EDE9FE",
    borderColor: "#C4B5FD",
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "800",
    color: ACCENT_DARK,
  },
  avatarTextCompany: {
    color: "#6D28D9",
  },

  cardMain: { flex: 1, minWidth: 0 },

  /* Title row */
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1A1A2E",
    flex: 1,
    minWidth: 100,
  },
  kindPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  kindPillProvider: { backgroundColor: "#E0F2FE" },
  kindPillCompany: { backgroundColor: "#EDE9FE" },
  kindPillText: { fontSize: 10, fontWeight: "800" },
  kindPillTextProvider: { color: "#0369A1" },
  kindPillTextCompany: { color: "#6D28D9" },

  cardEmail: {
    fontSize: 12,
    color: "#9B9BB0",
    fontWeight: "500",
    marginTop: 3,
  },

  serviceLineWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 5,
  },
  serviceLine: {
    flex: 1,
    fontSize: 12,
    color: "#6B6B80",
    fontWeight: "600",
  },

  /* Meta */
  cardMeta: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F4F3FA",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#EBEBF5",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B6B80",
  },
  statusMini: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusMiniText: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  chevronWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: "#F4F3FA",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    flexShrink: 0,
  },

  /* Footer */
  cardFooter: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F4F3FA",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cardHint: {
    fontSize: 11,
    color: "#9B9BB0",
    fontWeight: "600",
  },

  /* Loading */
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  loadingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderColor: "#EBEBF5",
    shadowColor: "#1A1A2E",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 3,
  },
  loadingText: {
    fontSize: 14,
    color: "#6B6B80",
    fontWeight: "600",
  },

  /* Error */
  errorCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#EBEBF5",
  },
  errorText: {
    color: "#DC2626",
    textAlign: "center",
    fontWeight: "600",
    fontSize: 14,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: ACCENT_DIM,
    borderWidth: 1.5,
    borderColor: ACCENT,
    marginTop: 4,
  },
  retryBtnText: {
    color: ACCENT_DARK,
    fontWeight: "700",
    fontSize: 14,
  },

  /* Empty */
  emptyWrap: {
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 24,
    gap: 12,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: ACCENT_DIM,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: ACCENT_BORDER,
    marginBottom: 4,
  },
  empty: {
    textAlign: "center",
    color: "#1A1A2E",
    fontSize: 18,
    fontWeight: "800",
  },
  emptySub: {
    textAlign: "center",
    color: "#9B9BB0",
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "500",
  },
});
