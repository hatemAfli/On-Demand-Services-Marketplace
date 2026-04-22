import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../services/api";
import { COLORS } from "../../constants";
import { AccountStatus, UserRole } from "../../types";

const ACCENT = "#E8C97A";

type RoleFilter = "ALL" | UserRole;

type AdminUserRow = {
  id: string;
  email: string;
  phoneNumber: string | null;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: AccountStatus;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  createdAt: string;
  updatedAt: string;
};

type ListResponse = {
  items: AdminUserRow[];
  total: number;
  skip?: number;
  take?: number;
};

const FILTER_OPTIONS: { key: RoleFilter; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: UserRole.CLIENT, label: "Clients" },
  { key: UserRole.PROVIDER, label: "Providers" },
  { key: UserRole.COMPANY_ADMIN, label: "Company admins" },
  { key: UserRole.PLATFORM_ADMIN, label: "Platform admins" },
];

function rolePillColors(role: UserRole): {
  bg: string;
  border: string;
  text: string;
  icon: keyof typeof Ionicons.glyphMap;
} {
  switch (role) {
    case UserRole.CLIENT:
      return {
        bg: "#FFFBEB",
        border: "#FDE68A",
        text: "#92400E",
        icon: "person-outline",
      };
    case UserRole.PROVIDER:
      return {
        bg: "#E0F2FE",
        border: "#7DD3FC",
        text: "#0369A1",
        icon: "briefcase-outline",
      };
    case UserRole.COMPANY_ADMIN:
      return {
        bg: "#EDE9FE",
        border: "#C4B5FD",
        text: "#5B21B6",
        icon: "business-outline",
      };
    case UserRole.PLATFORM_ADMIN:
      return {
        bg: "#F1F5F9",
        border: "#CBD5E1",
        text: "#334155",
        icon: "shield-checkmark-outline",
      };
    default:
      return {
        bg: COLORS.gray[100],
        border: COLORS.border,
        text: COLORS.gray[700],
        icon: "help-circle-outline",
      };
  }
}

function roleLabel(role: UserRole): string {
  switch (role) {
    case UserRole.CLIENT:
      return "Client";
    case UserRole.PROVIDER:
      return "Provider";
    case UserRole.COMPANY_ADMIN:
      return "Company admin";
    case UserRole.PLATFORM_ADMIN:
      return "Platform admin";
    default:
      return role;
  }
}

function statusPillStyle(status: AccountStatus) {
  switch (status) {
    case AccountStatus.ACTIVE:
      return { backgroundColor: "#DCFCE7" };
    case AccountStatus.PENDING:
      return { backgroundColor: "#FEF3C7" };
    case AccountStatus.REJECTED:
      return { backgroundColor: "#FEE2E2" };
    case AccountStatus.SUSPENDED:
      return { backgroundColor: "#EDE9FE" };
    case AccountStatus.DELETED:
      return { backgroundColor: "#E2E8F0" };
    default:
      return { backgroundColor: COLORS.gray[100] };
  }
}

export const AdminUsersScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [items, setItems] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.listAdminUsers({
        take: 200,
        ...(roleFilter !== "ALL" ? { role: roleFilter } : {}),
      });
      const data = res.data as ListResponse;
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setError("Could not load users.");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [roleFilter]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    void load();
  };

  const subtitle = useMemo(() => {
    if (loading && items.length === 0) return "";
    const n = total;
    return n === 1 ? "1 user" : `${n} users`;
  }, [loading, items.length, total]);

  const renderFilterChip = (key: RoleFilter, label: string) => {
    const active = roleFilter === key;
    return (
      <TouchableOpacity
        key={key}
        style={[styles.filterChip, active && styles.filterChipActive]}
        onPress={() => setRoleFilter(key)}
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

  const renderCard = ({ item }: { item: AdminUserRow }) => {
    const name =
      `${item.firstName ?? ""} ${item.lastName ?? ""}`.trim() || "—";
    const initials = name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    const rc = rolePillColors(item.role);

    return (
      <View style={styles.card}>
        <View style={styles.cardInner}>
          <View style={styles.cardRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials || "?"}</Text>
            </View>
            <View style={styles.cardMain}>
              <View style={styles.titleRow}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {name}
                </Text>
                <View
                  style={[
                    styles.rolePill,
                    { backgroundColor: rc.bg, borderColor: rc.border },
                  ]}
                >
                  <Ionicons name={rc.icon} size={12} color={rc.text} />
                  <Text style={[styles.rolePillText, { color: rc.text }]}>
                    {roleLabel(item.role)}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardEmail} numberOfLines={1}>
                {item.email}
              </Text>
              {item.phoneNumber ? (
                <Text style={styles.cardPhone} numberOfLines={1}>
                  {item.phoneNumber}
                </Text>
              ) : null}
              <View style={styles.cardMeta}>
                <View style={styles.verifyRow}>
                  <Ionicons
                    name={
                      item.isEmailVerified
                        ? "mail-outline"
                        : "mail-unread-outline"
                    }
                    size={14}
                    color={
                      item.isEmailVerified
                        ? "#15803D"
                        : COLORS.gray[500]
                    }
                  />
                  <Text
                    style={[
                      styles.verifyText,
                      !item.isEmailVerified && styles.verifyMuted,
                    ]}
                  >
                    Email
                  </Text>
                  <Ionicons
                    name="call-outline"
                    size={14}
                    color={
                      item.isPhoneVerified ? "#15803D" : COLORS.gray[500]
                    }
                    style={{ marginLeft: 10 }}
                  />
                  <Text
                    style={[
                      styles.verifyText,
                      !item.isPhoneVerified && styles.verifyMuted,
                    ]}
                  >
                    Phone
                  </Text>
                </View>
                <View
                  style={[styles.statusMini, statusPillStyle(item.status)]}
                >
                  <Text style={styles.statusMiniText}>{item.status}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <View style={styles.headerIconWrap}>
          <Ionicons name="people-outline" size={28} color={ACCENT} />
        </View>
        <Text style={styles.screenTitle}>Users</Text>
        {subtitle ? (
          <Text style={styles.countLine}>{subtitle}</Text>
        ) : null}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          {FILTER_OPTIONS.map(({ key, label }) =>
            renderFilterChip(key, label),
          )}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={ACCENT} size="large" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons
            name="cloud-offline-outline"
            size={48}
            color={COLORS.gray[400]}
          />
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
                name="people-outline"
                size={56}
                color={COLORS.gray[300]}
              />
              <Text style={styles.empty}>No users</Text>
              <Text style={styles.emptySub}>
                {roleFilter === "ALL"
                  ? "No accounts match this view."
                  : `No ${FILTER_OPTIONS.find((o) => o.key === roleFilter)?.label.toLowerCase() ?? "users"} yet.`}
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
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
  screenTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: COLORS.text.primary,
    marginBottom: 4,
    textAlign: "center",
  },
  countLine: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text.secondary,
    marginBottom: 14,
    textAlign: "center",
  },
  filterScrollContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 4,
    paddingBottom: 4,
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
  cardInner: { padding: 16 },
  cardRow: {
    flexDirection: "row",
    alignItems: "flex-start",
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
  rolePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  rolePillText: { fontSize: 11, fontWeight: "800" },
  cardEmail: {
    fontSize: 13,
    color: COLORS.text.secondary,
    marginTop: 4,
  },
  cardPhone: {
    fontSize: 13,
    color: COLORS.gray[600],
    marginTop: 2,
  },
  cardMeta: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  verifyRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
  },
  verifyText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#15803D",
  },
  verifyMuted: {
    color: COLORS.gray[500],
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
