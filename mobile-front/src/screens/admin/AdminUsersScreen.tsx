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

// ─── Brand accent ──────────────────────────────────────────
const ACCENT = "#E8C97A";
const ACCENT_DIM = "rgba(232,201,122,0.18)";
const ACCENT_BORDER = "rgba(232,201,122,0.40)";

// ─── Types (unchanged) ────────────────────────────────────
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

// ─── Filter options (unchanged) ───────────────────────────
const FILTER_OPTIONS: { key: RoleFilter; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: UserRole.CLIENT, label: "Clients" },
  { key: UserRole.PROVIDER, label: "Providers" },
  { key: UserRole.COMPANY_ADMIN, label: "Companies" },
  { key: UserRole.PLATFORM_ADMIN, label: "Admins" },
];

// ─── Role config (logic unchanged, new colors) ────────────
function rolePillColors(role: UserRole): {
  bg: string;
  border: string;
  text: string;
  icon: keyof typeof Ionicons.glyphMap;
} {
  switch (role) {
    case UserRole.CLIENT:
      return {
        bg: "#FFF8E7",
        border: "#FDE68A",
        text: "#92400E",
        icon: "person-outline",
      };
    case UserRole.PROVIDER:
      return {
        bg: "#EFF6FF",
        border: "#BFDBFE",
        text: "#1D4ED8",
        icon: "briefcase-outline",
      };
    case UserRole.COMPANY_ADMIN:
      return {
        bg: "#F5F3FF",
        border: "#DDD6FE",
        text: "#6D28D9",
        icon: "business-outline",
      };
    case UserRole.PLATFORM_ADMIN:
      return {
        bg: ACCENT_DIM,
        border: ACCENT_BORDER,
        text: "#92400E",
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

// ─── Status config ─────────────────────────────────────────
type StatusCfg = {
  bg: string;
  text: string;
  dot: string;
  label: string;
};

function statusConfig(status: AccountStatus): StatusCfg {
  switch (status) {
    case AccountStatus.ACTIVE:
      return {
        bg: "#ECFDF5",
        text: "#065F46",
        dot: "#10B981",
        label: "Active",
      };
    case AccountStatus.PENDING:
      return {
        bg: "#FFFBEB",
        text: "#78350F",
        dot: "#F59E0B",
        label: "Pending",
      };
    case AccountStatus.REJECTED:
      return {
        bg: "#FEF2F2",
        text: "#991B1B",
        dot: "#EF4444",
        label: "Rejected",
      };
    case AccountStatus.SUSPENDED:
      return {
        bg: "#F5F3FF",
        text: "#4C1D95",
        dot: "#8B5CF6",
        label: "Suspended",
      };
    case AccountStatus.DELETED:
      return {
        bg: "#F1F5F9",
        text: "#475569",
        dot: "#94A3B8",
        label: "Deleted",
      };
    default:
      return {
        bg: COLORS.gray[100],
        text: COLORS.gray[700],
        dot: COLORS.gray[400],
        label: status,
      };
  }
}

// ─── Initials avatar color by role ────────────────────────
function avatarAccent(role: UserRole): { bg: string; text: string } {
  switch (role) {
    case UserRole.CLIENT:
      return { bg: "#FFF3C4", text: "#92400E" };
    case UserRole.PROVIDER:
      return { bg: "#DBEAFE", text: "#1E40AF" };
    case UserRole.COMPANY_ADMIN:
      return { bg: "#EDE9FE", text: "#5B21B6" };
    case UserRole.PLATFORM_ADMIN:
      return { bg: ACCENT_DIM, text: "#92400E" };
    default:
      return { bg: COLORS.gray[100], text: COLORS.gray[600] };
  }
}

// ─── Main Screen ──────────────────────────────────────────
export const AdminUsersScreen: React.FC = () => {
  const insets = useSafeAreaInsets();

  // ── All logic/state unchanged ──────────────────────────
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

  // ── Filter chip ────────────────────────────────────────
  const renderFilterChip = (key: RoleFilter, label: string) => {
    const active = roleFilter === key;
    return (
      <TouchableOpacity
        key={key}
        style={[styles.filterChip, active && styles.filterChipActive]}
        onPress={() => setRoleFilter(key)}
        activeOpacity={0.82}
      >
        {active && <View style={styles.filterChipDot} />}
        <Text
          style={[styles.filterChipText, active && styles.filterChipTextActive]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  // ── Card render ────────────────────────────────────────
  const renderCard = ({
    item,
    index,
  }: {
    item: AdminUserRow;
    index: number;
  }) => {
    const name = `${item.firstName ?? ""} ${item.lastName ?? ""}`.trim() || "—";
    const initials = name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

    const rc = rolePillColors(item.role);
    const sc = statusConfig(item.status);
    const av = avatarAccent(item.role);

    return (
      <View style={styles.card}>
        {/* Left accent bar */}
        <View style={[styles.cardAccentBar, { backgroundColor: rc.border }]} />

        <View style={styles.cardContent}>
          {/* Top row: avatar + name/email + role pill */}
          <View style={styles.cardTopRow}>
            {/* Avatar */}
            <View style={[styles.avatar, { backgroundColor: av.bg }]}>
              <Text style={[styles.avatarText, { color: av.text }]}>
                {initials || "?"}
              </Text>
            </View>

            {/* Name + email */}
            <View style={styles.cardMid}>
              <Text style={styles.cardName} numberOfLines={1}>
                {name}
              </Text>
              <Text style={styles.cardEmail} numberOfLines={1}>
                {item.email}
              </Text>
              {item.phoneNumber ? (
                <Text style={styles.cardPhone} numberOfLines={1}>
                  {item.phoneNumber}
                </Text>
              ) : null}
            </View>

            {/* Role pill — top right */}
            <View
              style={[
                styles.rolePill,
                { backgroundColor: rc.bg, borderColor: rc.border },
              ]}
            >
              <Ionicons name={rc.icon} size={11} color={rc.text} />
              <Text style={[styles.rolePillText, { color: rc.text }]}>
                {roleLabel(item.role)}
              </Text>
            </View>
          </View>

          {/* Divider */}
          <View style={styles.cardDivider} />

          {/* Bottom row: verifications + status */}
          <View style={styles.cardBottomRow}>
            {/* Email verification */}
            <View style={styles.verifyChip}>
              <Ionicons
                name={item.isEmailVerified ? "mail" : "mail-unread-outline"}
                size={12}
                color={item.isEmailVerified ? "#059669" : "#94A3B8"}
              />
              <Text
                style={[
                  styles.verifyLabel,
                  !item.isEmailVerified && styles.verifyLabelMuted,
                ]}
              >
                Email
              </Text>
            </View>

            {/* Phone verification */}
            <View style={styles.verifyChip}>
              <Ionicons
                name={item.isPhoneVerified ? "call" : "call-outline"}
                size={12}
                color={item.isPhoneVerified ? "#059669" : "#94A3B8"}
              />
              <Text
                style={[
                  styles.verifyLabel,
                  !item.isPhoneVerified && styles.verifyLabelMuted,
                ]}
              >
                Phone
              </Text>
            </View>

            <View style={styles.bottomSpacer} />

            {/* Status pill */}
            <View style={[styles.statusPill, { backgroundColor: sc.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: sc.dot }]} />
              <Text style={[styles.statusText, { color: sc.text }]}>
                {sc.label}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  // ── Screen ─────────────────────────────────────────────
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerIconWrap}>
            <Ionicons name="people" size={22} color={ACCENT} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.screenTitle}>Users</Text>
            {subtitle ? <Text style={styles.countLine}>{subtitle}</Text> : null}
          </View>
        </View>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          {FILTER_OPTIONS.map(({ key, label }) => renderFilterChip(key, label))}
        </ScrollView>
      </View>

      {/* ── States ── */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={ACCENT} size="large" />
          <Text style={styles.loadingText}>Loading users…</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <View style={styles.errorIconWrap}>
            <Ionicons name="cloud-offline-outline" size={32} color="#94A3B8" />
          </View>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => void load()} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          renderItem={renderCard}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: 40 + insets.bottom },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={ACCENT}
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="people-outline" size={30} color="#94A3B8" />
              </View>
              <Text style={styles.emptyTitle}>No users found</Text>
              <Text style={styles.emptySub}>
                {roleFilter === "ALL"
                  ? "No accounts match this view."
                  : `No ${FILTER_OPTIONS.find((o) => o.key === roleFilter)?.label.toLowerCase() ?? "users"} registered yet.`}
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

// ─── Styles ────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  // ── Header
  header: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#EBEBF5",
    gap: 14,
    ...Platform.select({
      ios: {
        shadowColor: "#1A1A2E",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  headerIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: ACCENT_DIM,
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1A1A2E",
    letterSpacing: -0.5,
  },
  countLine: {
    fontSize: 13,
    fontWeight: "600",
    color: "#9B9BB0",
    marginTop: 1,
  },
  filterScrollContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 2,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#F9F8FF",
    borderWidth: 1,
    borderColor: "#EBEBF5",
  },
  filterChipActive: {
    backgroundColor: ACCENT_DIM,
    borderColor: ACCENT_BORDER,
  },
  filterChipDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: ACCENT,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B6B80",
  },
  filterChipTextActive: {
    color: "#92400E",
  },

  // ── List
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  // ── Card
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    flexDirection: "row",
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  cardAccentBar: {
    width: 4,
    borderRadius: 0,
  },
  cardContent: {
    flex: 1,
    padding: 14,
    gap: 10,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  cardMid: {
    flex: 1,
    gap: 2,
  },
  cardName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  cardEmail: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },
  cardPhone: {
    fontSize: 12,
    color: "#94A3B8",
  },
  rolePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    flexShrink: 0,
  },
  rolePillText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.1,
  },

  // ── Card divider
  cardDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
  },

  // ── Card bottom
  cardBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  verifyChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  verifyLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#059669",
  },
  verifyLabelMuted: {
    color: "#CBD5E1",
  },
  bottomSpacer: { flex: 1 },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.1,
  },

  // ── States
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: "#94A3B8",
    fontWeight: "500",
  },
  errorIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  errorText: {
    color: "#EF4444",
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
  },
  retryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: ACCENT_DIM,
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
    marginTop: 4,
  },
  retryBtnText: {
    color: "#92400E",
    fontWeight: "800",
    fontSize: 14,
  },
  emptyWrap: {
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
  },
  emptySub: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 19,
  },
});
