import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Platform,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../../services/api";
import { AccountStatus, UserRole } from "../../../types";
import type { AdminUsersStackParamList } from "./adminUsersNavigation";

const ACCENT = "#E8C97A";
const ACCENT_DIM = "rgba(232,201,122,0.18)";
const ACCENT_BORDER = "rgba(232,201,122,0.40)";

type AdminUserDetail = {
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
  deletedAt: string | null;
  stats?: {
    appointments?: number;
    reviews?: number;
    complaints?: number;
    givenServices?: number;
  };
};

type StatusAction = {
  status: AccountStatus;
  title: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  primary?: boolean;
};

type Props = NativeStackScreenProps<
  AdminUsersStackParamList,
  "AdminUserDetail"
>;

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
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

function statusConfig(status: AccountStatus): {
  bg: string;
  text: string;
  dot: string;
  label: string;
} {
  switch (status) {
    case AccountStatus.ACTIVE:
      return { bg: "#ECFDF5", text: "#065F46", dot: "#10B981", label: "Active" };
    case AccountStatus.PENDING:
      return { bg: "#FFFBEB", text: "#78350F", dot: "#F59E0B", label: "Pending" };
    case AccountStatus.REJECTED:
      return { bg: "#FEF2F2", text: "#991B1B", dot: "#EF4444", label: "Blocked" };
    case AccountStatus.SUSPENDED:
      return { bg: "#F5F3FF", text: "#4C1D95", dot: "#8B5CF6", label: "Suspended" };
    case AccountStatus.DELETED:
      return { bg: "#F1F5F9", text: "#475569", dot: "#94A3B8", label: "Deleted" };
    default:
      return { bg: "#F1F5F9", text: "#475569", dot: "#94A3B8", label: status };
  }
}

function actionMessage(status: AccountStatus): string {
  switch (status) {
    case AccountStatus.DELETED:
      return "This will mark the account as deleted. The user will no longer be able to sign in.";
    case AccountStatus.SUSPENDED:
      return "The user will be suspended and cannot use the platform until reactivated.";
    case AccountStatus.REJECTED:
      return "The user will be blocked from accessing the platform.";
    case AccountStatus.ACTIVE:
      return "The user will be able to access the platform again.";
    default:
      return "Update this user's account status?";
  }
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailRowIcon}>
        <Ionicons name={icon} size={14} color="#94A3B8" />
      </View>
      <View style={styles.detailRowText}>
        <Text style={styles.detailRowLabel}>{label}</Text>
        <Text style={styles.detailRowValue}>{value}</Text>
      </View>
    </View>
  );
}

export const AdminUserDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { userId } = route.params;
  const insets = useSafeAreaInsets();

  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusModal, setStatusModal] = useState<StatusAction | null>(null);
  const [statusReason, setStatusReason] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await api.getAdminUserById(userId);
      setUser(res.data as AdminUserDetail);
    } catch {
      setUser(null);
    }
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const availableActions = useMemo((): StatusAction[] => {
    if (!user) return [];
    if (user.role === UserRole.PLATFORM_ADMIN || user.status === AccountStatus.DELETED) {
      return [];
    }

    const actions: StatusAction[] = [];

    if (user.status !== AccountStatus.ACTIVE) {
      actions.push({
        status: AccountStatus.ACTIVE,
        title: "Activate account",
        label: "Activate",
        icon: "checkmark-circle-outline",
        primary: true,
      });
    }

    if (
      user.status === AccountStatus.ACTIVE ||
      user.status === AccountStatus.PENDING
    ) {
      actions.push({
        status: AccountStatus.SUSPENDED,
        title: "Suspend account",
        label: "Suspend",
        icon: "pause-circle-outline",
      });
    }

    if (
      user.status !== AccountStatus.REJECTED &&
      user.status !== AccountStatus.DELETED
    ) {
      actions.push({
        status: AccountStatus.REJECTED,
        title: "Block account",
        label: "Block",
        icon: "ban-outline",
        destructive: true,
      });
    }

    actions.push({
      status: AccountStatus.DELETED,
      title: "Remove account",
      label: "Remove",
      icon: "trash-outline",
      destructive: true,
      primary: true,
    });

    return actions;
  }, [user]);

  const openStatusModal = (action: StatusAction) => {
    setStatusModal(action);
    setStatusReason("");
  };

  const applyStatus = useCallback(async () => {
    if (!statusModal) return;

    setActionLoading(true);
    try {
      await api.updateAdminUserStatus(userId, {
        status: statusModal.status,
        reason: statusReason.trim() || undefined,
      });
      setStatusModal(null);
      setStatusReason("");
      await load();
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { message?: unknown } } })
        ?.response?.data;
      const msg = data?.message;
      const text = Array.isArray(msg)
        ? msg.join(", ")
        : typeof msg === "string"
          ? msg
          : "Could not update account status.";
      Alert.alert("Error", text);
    } finally {
      setActionLoading(false);
    }
  }, [statusModal, statusReason, userId, load]);

  if (loading && !user) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={styles.loadingText}>Loading user…</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Ionicons name="person-outline" size={36} color="#94A3B8" />
        <Text style={styles.emptyTitle}>User not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const name = `${user.firstName} ${user.lastName}`.trim() || "—";
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const sc = statusConfig(user.status);
  const isPlatformAdmin = user.role === UserRole.PLATFORM_ADMIN;
  const stats = user.stats ?? {};

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={22} color="#1A1A2E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>User details</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 24 },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={ACCENT} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials || "?"}</Text>
          </View>
          <Text style={styles.profileName}>{name}</Text>
          <Text style={styles.profileEmail}>{user.email}</Text>
          <View style={styles.profileBadges}>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{roleLabel(user.role)}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: sc.dot }]} />
              <Text style={[styles.statusBadgeText, { color: sc.text }]}>
                {sc.label}
              </Text>
            </View>
          </View>
        </View>

        {isPlatformAdmin ? (
          <View style={styles.noticeCard}>
            <Ionicons name="shield-checkmark-outline" size={18} color="#92400E" />
            <Text style={styles.noticeText}>
              Platform administrator accounts cannot be modified from this screen.
            </Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Account overview</Text>
        <View style={styles.card}>
          <DetailRow icon="call-outline" label="Phone" value={user.phoneNumber ?? "—"} />
          <DetailRow
            icon="mail-outline"
            label="Email verified"
            value={user.isEmailVerified ? "Yes" : "No"}
          />
          <DetailRow
            icon="phone-portrait-outline"
            label="Phone verified"
            value={user.isPhoneVerified ? "Yes" : "No"}
          />
          <DetailRow icon="calendar-outline" label="Joined" value={formatDate(user.createdAt)} />
          <DetailRow icon="time-outline" label="Last updated" value={formatDate(user.updatedAt)} />
          {user.deletedAt ? (
            <DetailRow icon="trash-outline" label="Deleted at" value={formatDate(user.deletedAt)} />
          ) : null}
        </View>

        {(stats.appointments ?? stats.reviews ?? stats.complaints ?? stats.givenServices) != null ? (
          <>
            <Text style={styles.sectionTitle}>Activity</Text>
            <View style={styles.statsRow}>
              {stats.appointments != null ? (
                <View style={styles.statChip}>
                  <Text style={styles.statValue}>{stats.appointments}</Text>
                  <Text style={styles.statLabel}>Appointments</Text>
                </View>
              ) : null}
              {stats.reviews != null ? (
                <View style={styles.statChip}>
                  <Text style={styles.statValue}>{stats.reviews}</Text>
                  <Text style={styles.statLabel}>Reviews</Text>
                </View>
              ) : null}
              {stats.complaints != null ? (
                <View style={styles.statChip}>
                  <Text style={styles.statValue}>{stats.complaints}</Text>
                  <Text style={styles.statLabel}>Complaints</Text>
                </View>
              ) : null}
              {stats.givenServices != null ? (
                <View style={styles.statChip}>
                  <Text style={styles.statValue}>{stats.givenServices}</Text>
                  <Text style={styles.statLabel}>Services</Text>
                </View>
              ) : null}
            </View>
          </>
        ) : null}

        {availableActions.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Quick actions</Text>
            <View style={styles.actionsCard}>
              {availableActions.map((action) => (
                <TouchableOpacity
                  key={action.status}
                  style={[
                    styles.actionBtn,
                    action.destructive && styles.actionBtnDestructive,
                    action.primary && !action.destructive && styles.actionBtnPrimary,
                    action.primary && action.destructive && styles.actionBtnDangerPrimary,
                  ]}
                  onPress={() => openStatusModal(action)}
                  disabled={actionLoading}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name={action.icon}
                    size={18}
                    color={
                      action.destructive
                        ? action.primary
                          ? "#FFFFFF"
                          : "#DC2626"
                        : action.primary
                          ? "#92400E"
                          : "#1A1A2E"
                    }
                  />
                  <Text
                    style={[
                      styles.actionBtnText,
                      action.destructive && styles.actionBtnTextDestructive,
                      action.primary && !action.destructive && styles.actionBtnTextPrimary,
                      action.primary && action.destructive && styles.actionBtnTextOnDanger,
                    ]}
                  >
                    {action.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>

      <Modal
        visible={statusModal != null}
        transparent
        animationType="fade"
        onRequestClose={() => !actionLoading && setStatusModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{statusModal?.title}</Text>
            <Text style={styles.modalBody}>
              {statusModal ? actionMessage(statusModal.status) : ""}
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Optional reason (recommended)…"
              placeholderTextColor="#94A3B8"
              value={statusReason}
              onChangeText={setStatusReason}
              multiline
              maxLength={2000}
              editable={!actionLoading}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setStatusModal(null)}
                disabled={actionLoading}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirmBtn,
                  statusModal?.destructive && styles.modalConfirmBtnDanger,
                ]}
                onPress={() => void applyStatus()}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 24,
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "600",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#475569",
    marginTop: 8,
  },
  backLink: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  backLinkText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#92400E",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#EBEBF5",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: ACCENT_DIM,
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1A1A2E",
    letterSpacing: -0.3,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  profileCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 20,
    alignItems: "center",
    gap: 6,
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
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: ACCENT_DIM,
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: "800",
    color: "#92400E",
  },
  profileName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.4,
  },
  profileEmail: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
  },
  profileBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "800",
  },
  noticeCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: ACCENT_DIM,
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
    borderRadius: 12,
    padding: 14,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: "#78350F",
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 4,
    marginBottom: -4,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 14,
    overflow: "hidden",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  detailRowIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  detailRowText: {
    flex: 1,
    gap: 2,
  },
  detailRowLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  detailRowValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statChip: {
    flexGrow: 1,
    minWidth: "45%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
    marginTop: 2,
  },
  actionsCard: {
    gap: 10,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingVertical: 14,
  },
  actionBtnPrimary: {
    backgroundColor: ACCENT_DIM,
    borderColor: ACCENT_BORDER,
  },
  actionBtnDestructive: {
    borderColor: "#FECACA",
    backgroundColor: "#FFFBFB",
  },
  actionBtnDangerPrimary: {
    backgroundColor: "#DC2626",
    borderColor: "#DC2626",
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1A1A2E",
  },
  actionBtnTextPrimary: {
    color: "#92400E",
  },
  actionBtnTextDestructive: {
    color: "#DC2626",
  },
  actionBtnTextOnDanger: {
    color: "#FFFFFF",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  modalBody: {
    fontSize: 14,
    lineHeight: 20,
    color: "#64748B",
    fontWeight: "500",
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 80,
    textAlignVertical: "top",
    fontSize: 14,
    color: "#0F172A",
    backgroundColor: "#F8FAFC",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 4,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#64748B",
  },
  modalConfirmBtn: {
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 18,
    minWidth: 96,
    alignItems: "center",
  },
  modalConfirmBtnDanger: {
    backgroundColor: "#DC2626",
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});
