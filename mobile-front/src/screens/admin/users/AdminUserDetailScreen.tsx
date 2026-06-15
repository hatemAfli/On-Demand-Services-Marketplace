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
  Image,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../../services/api";
import { AccountStatus, UserRole } from "../../../types";
import type { AdminUsersStackParamList } from "./adminUsersNavigation";

const C = {
  screenBg: "#F1F5F9",
  accent: "#EA580C",
  accentDark: "#C2410C",
  accentPale: "#FFF7ED",
  accentBorder: "#FFEDD5",
  accentRing: "#F08E10",
  card: "#FFFFFF",
  cardBorder: "#EBEBF5",
  text: "#1A1A2E",
  textMuted: "#64748B",
  textLight: "#94A3B8",
  divider: "#F1F5F9",
};

type AdminUserClient = {
  city: string;
  address: string | null;
  imageUrl: string | null;
  createdAt: string;
};

type AdminUserProvider = {
  type: string;
  city: string;
  address: string | null;
  photoUrl: string | null;
  tagline: string | null;
  bio: string | null;
  yearsOfExperience: number | null;
  averageRating: number | null;
  totalReviews: number;
  isTopProvider: boolean;
  languagesSpoken: string[];
  paymentMethodsAccepted: string[];
  totalComplaints: number;
  activeComplaints: number;
  company: {
    companyName: string;
    taxId: string;
    city: string;
    email: string | null;
  } | null;
};

type AdminUserCompanyAdmin = {
  company: {
    companyName: string;
    taxId: string;
    city: string;
    email: string | null;
    logo: string | null;
    averageRating: number | null;
    providers: Array<{
      id: string;
      city: string;
      user: {
        firstName: string;
        lastName: string;
        email: string;
        status: AccountStatus;
      };
    }>;
  } | null;
};

type AdminUserVerificationDoc = {
  id: string;
  type: string;
  fichierUrl: string;
  isAccepted: boolean | null;
};

type AdminUserVerificationRequest = {
  id: string;
  ownerType: string;
  requestStatus: string;
  createdAt: string;
  service: { name: string } | null;
  documents: AdminUserVerificationDoc[];
};

type AdminUserGivenService = {
  id: string;
  serviceName: string;
  categoryName: string | null;
  price: number;
  pricingType: string;
  active: boolean;
  averageRating: number | null;
  totalReviews: number | null;
};

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
  client?: AdminUserClient | null;
  provider?: AdminUserProvider | null;
  companyAdmin?: AdminUserCompanyAdmin | null;
  verificationRequests?: AdminUserVerificationRequest[];
  givenServices?: AdminUserGivenService[];
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

function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
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

function rolePill(role: UserRole): { bg: string; border: string; text: string } {
  switch (role) {
    case UserRole.CLIENT:
      return { bg: C.accentPale, border: C.accentBorder, text: C.accentDark };
    case UserRole.PROVIDER:
      return { bg: "#EFF6FF", border: "#BFDBFE", text: "#1D4ED8" };
    case UserRole.COMPANY_ADMIN:
      return { bg: "#F5F3FF", border: "#DDD6FE", text: "#6D28D9" };
    case UserRole.PLATFORM_ADMIN:
      return { bg: C.accentPale, border: C.accentBorder, text: C.accentDark };
    default:
      return { bg: "#F1F5F9", border: "#E2E8F0", text: "#475569" };
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
      return { bg: C.accentPale, text: C.accentDark, dot: C.accent, label: "Pending" };
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

function resolveUserPhoto(user: AdminUserDetail): string | null {
  const providerPhoto = user.provider?.photoUrl?.trim();
  if (providerPhoto) return providerPhoto;
  const clientPhoto = user.client?.imageUrl?.trim();
  if (clientPhoto) return clientPhoto;
  const companyLogo = user.companyAdmin?.company?.logo?.trim();
  if (companyLogo) return companyLogo;
  return null;
}

function ProfileAvatar({
  photoUrl,
  initials,
}: {
  photoUrl: string | null;
  initials: string;
}) {
  return (
    <View style={styles.avatarWrap}>
      <View style={styles.avatarOuterRing}>
        <View style={styles.avatarRingInner}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.avatarPhoto} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitials}>{initials || "?"}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

function VerifyChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <View style={[styles.verifyChip, ok ? styles.verifyChipOk : styles.verifyChipNo]}>
      <Ionicons
        name={ok ? "checkmark-circle" : "close-circle-outline"}
        size={12}
        color={ok ? "#059669" : C.textLight}
      />
      <Text style={[styles.verifyChipText, ok ? styles.verifyChipTextOk : null]}>
        {label}
      </Text>
    </View>
  );
}

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHead}>
        <View style={styles.sectionIcon}>
          <Ionicons name={icon} size={15} color={C.accent} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function DetailRow({
  icon,
  label,
  value,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.detailRow, last && styles.detailRowLast]}>
      <View style={styles.detailRowIcon}>
        <Ionicons name={icon} size={14} color={C.textLight} />
      </View>
      <View style={styles.detailRowText}>
        <Text style={styles.detailRowLabel}>{label}</Text>
        <Text style={styles.detailRowValue}>{value}</Text>
      </View>
    </View>
  );
}

function StatTile({
  icon,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  label: string;
}) {
  return (
    <View style={styles.statTile}>
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={14} color={C.accent} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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

    if (user.status !== AccountStatus.REJECTED) {
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
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={styles.loadingText}>Loading user…</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <View style={styles.emptyIcon}>
          <Ionicons name="person-outline" size={28} color={C.textLight} />
        </View>
        <Text style={styles.emptyTitle}>User not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const name = `${user.firstName} ${user.lastName}`.trim() || "—";
  const avatarInitials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const photoUrl = resolveUserPhoto(user);
  const sc = statusConfig(user.status);
  const rp = rolePill(user.role);
  const isPlatformAdmin = user.role === UserRole.PLATFORM_ADMIN;
  const stats = user.stats ?? {};
  const verificationRequests = user.verificationRequests ?? [];
  const allDocuments = verificationRequests.flatMap((vr) =>
    vr.documents.map((d) => ({ ...d, serviceName: vr.service?.name ?? vr.ownerType })),
  );
  const givenServices = user.givenServices ?? [];

  const hasStats =
    stats.appointments != null ||
    stats.reviews != null ||
    stats.complaints != null ||
    stats.givenServices != null;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>User details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 28 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={C.accent}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <ProfileAvatar photoUrl={photoUrl} initials={avatarInitials} />
            <View style={styles.heroInfo}>
              <Text style={styles.profileName} numberOfLines={2}>
                {name}
              </Text>
              <Text style={styles.profileEmail} numberOfLines={1}>
                {user.email}
              </Text>
              <View style={styles.badgeRow}>
                <View style={[styles.rolePill, { backgroundColor: rp.bg, borderColor: rp.border }]}>
                  <Text style={[styles.rolePillText, { color: rp.text }]}>
                    {roleLabel(user.role)}
                  </Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: sc.bg }]}>
                  <View style={[styles.statusDot, { backgroundColor: sc.dot }]} />
                  <Text style={[styles.statusPillText, { color: sc.text }]}>
                    {sc.label}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.verifyRow}>
            <VerifyChip ok={user.isEmailVerified} label="Email" />
            <VerifyChip ok={user.isPhoneVerified} label="Phone" />
          </View>

          <View style={styles.heroMeta}>
            <View style={styles.heroMetaItem}>
              <Ionicons name="call-outline" size={13} color={C.textLight} />
              <Text style={styles.heroMetaText}>{user.phoneNumber ?? "No phone"}</Text>
            </View>
            <View style={styles.heroMetaItem}>
              <Ionicons name="calendar-outline" size={13} color={C.textLight} />
              <Text style={styles.heroMetaText}>Joined {formatShortDate(user.createdAt)}</Text>
            </View>
          </View>
        </View>

        {isPlatformAdmin ? (
          <View style={styles.noticeCard}>
            <Ionicons name="shield-checkmark-outline" size={18} color={C.accentDark} />
            <Text style={styles.noticeText}>
              Platform administrator accounts cannot be modified from this screen.
            </Text>
          </View>
        ) : null}

        {hasStats ? (
          <View style={styles.statsGrid}>
            {stats.appointments != null ? (
              <StatTile icon="calendar-outline" value={stats.appointments} label="Appointments" />
            ) : null}
            {stats.reviews != null ? (
              <StatTile icon="star-outline" value={stats.reviews} label="Reviews" />
            ) : null}
            {stats.complaints != null ? (
              <StatTile icon="warning-outline" value={stats.complaints} label="Complaints" />
            ) : null}
            {stats.givenServices != null ? (
              <StatTile icon="briefcase-outline" value={stats.givenServices} label="Services" />
            ) : null}
          </View>
        ) : null}

        <SectionCard title="Account overview" icon="person-circle-outline">
          <DetailRow icon="finger-print-outline" label="User ID" value={user.id} />
          <DetailRow icon="call-outline" label="Phone" value={user.phoneNumber ?? "—"} />
          <DetailRow
            icon="time-outline"
            label="Last updated"
            value={formatDate(user.updatedAt)}
          />
          {user.deletedAt ? (
            <DetailRow
              icon="trash-outline"
              label="Deleted at"
              value={formatDate(user.deletedAt)}
              last
            />
          ) : (
            <DetailRow
              icon="calendar-outline"
              label="Member since"
              value={formatDate(user.createdAt)}
              last
            />
          )}
        </SectionCard>

        {user.client ? (
          <SectionCard title="Client profile" icon="location-outline">
            <DetailRow icon="location-outline" label="City" value={user.client.city} />
            <DetailRow
              icon="home-outline"
              label="Address"
              value={user.client.address ?? "—"}
              last={!user.client.imageUrl}
            />
            {user.client.imageUrl ? (
              <Image
                source={{ uri: user.client.imageUrl }}
                style={styles.profilePreview}
              />
            ) : null}
          </SectionCard>
        ) : null}

        {user.provider ? (
          <SectionCard title="Provider profile" icon="briefcase-outline">
            <DetailRow
              icon="git-branch-outline"
              label="Type"
              value={user.provider.type === "EMPLOYEE" ? "Employee" : "Independent"}
            />
            <DetailRow icon="location-outline" label="City" value={user.provider.city} />
            <DetailRow
              icon="star-outline"
              label="Rating"
              value={
                user.provider.averageRating != null
                  ? `${user.provider.averageRating} ★ · ${user.provider.totalReviews} reviews`
                  : "—"
              }
            />
            <DetailRow
              icon="ribbon-outline"
              label="Top provider"
              value={user.provider.isTopProvider ? "Yes" : "No"}
            />
            <DetailRow
              icon="warning-outline"
              label="Complaints"
              value={`${user.provider.totalComplaints} total · ${user.provider.activeComplaints} active`}
              last={!user.provider.bio && !user.provider.tagline}
            />
            {user.provider.tagline ? (
              <Text style={styles.tagline}>“{user.provider.tagline}”</Text>
            ) : null}
            {user.provider.bio ? (
              <Text style={styles.bio}>{user.provider.bio}</Text>
            ) : null}
          </SectionCard>
        ) : null}

        {user.companyAdmin?.company ? (
          <SectionCard title="Company" icon="business-outline">
            <DetailRow
              icon="business-outline"
              label="Name"
              value={user.companyAdmin.company.companyName}
            />
            <DetailRow
              icon="card-outline"
              label="Tax ID"
              value={user.companyAdmin.company.taxId}
            />
            <DetailRow
              icon="location-outline"
              label="City"
              value={user.companyAdmin.company.city}
              last
            />
          </SectionCard>
        ) : null}

        <SectionCard title="Verification requests" icon="document-text-outline">
          {verificationRequests.length > 0 ? (
            verificationRequests.map((vr, index) => (
              <View
                key={vr.id}
                style={[
                  styles.verifyItem,
                  index === verificationRequests.length - 1 && styles.verifyItemLast,
                ]}
              >
                <Text style={styles.verifyItemTitle}>
                  {vr.service?.name ?? vr.ownerType}
                </Text>
                <View style={styles.verifyItemMeta}>
                  <View style={styles.miniChip}>
                    <Text style={styles.miniChipText}>{vr.requestStatus}</Text>
                  </View>
                  <Text style={styles.verifyItemDate}>
                    {formatShortDate(vr.createdAt)} · {vr.documents.length} doc(s)
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptySection}>No verification requests.</Text>
          )}
        </SectionCard>

        <SectionCard title="Uploaded documents" icon="images-outline">
          {allDocuments.length > 0 ? (
            <View style={styles.docsGrid}>
              {allDocuments.map((d) => (
                <TouchableOpacity
                  key={d.id}
                  style={styles.docCard}
                  activeOpacity={0.85}
                  onPress={() => void Linking.openURL(d.fichierUrl)}
                >
                  <Image source={{ uri: d.fichierUrl }} style={styles.docThumb} />
                  <Text style={styles.docType} numberOfLines={2}>
                    {d.type}
                  </Text>
                  <View
                    style={[
                      styles.docStatus,
                      d.isAccepted === true
                        ? styles.docStatusOk
                        : d.isAccepted === false
                          ? styles.docStatusNo
                          : styles.docStatusWait,
                    ]}
                  >
                    <Text style={styles.docStatusText}>
                      {d.isAccepted === true
                        ? "Accepted"
                        : d.isAccepted === false
                          ? "Rejected"
                          : "Pending"}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={styles.emptySection}>No documents uploaded.</Text>
          )}
        </SectionCard>

        {givenServices.length > 0 ? (
          <SectionCard title="Given services" icon="construct-outline">
            {givenServices.map((gs, index) => (
              <View
                key={gs.id}
                style={[
                  styles.serviceItem,
                  index === givenServices.length - 1 && styles.serviceItemLast,
                ]}
              >
                <Text style={styles.serviceName}>{gs.serviceName}</Text>
                <Text style={styles.serviceMeta}>
                  {gs.categoryName ?? "—"} · {gs.price} ({gs.pricingType})
                </Text>
                <Text style={styles.serviceMeta}>
                  {gs.averageRating != null
                    ? `${gs.averageRating} ★ · ${gs.totalReviews ?? 0} reviews`
                    : "No ratings yet"}
                  {" · "}
                  {gs.active ? "Active" : "Inactive"}
                </Text>
              </View>
            ))}
          </SectionCard>
        ) : null}

        {availableActions.length > 0 ? (
          <View style={styles.actionsBlock}>
            <Text style={styles.actionsLabel}>Quick actions</Text>
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
                          ? C.accentDark
                          : C.text
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
          </View>
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
              placeholderTextColor={C.textLight}
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
    backgroundColor: C.screenBg,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.screenBg,
    paddingHorizontal: 24,
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    color: C.textMuted,
    fontWeight: "600",
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#475569",
    marginTop: 4,
  },
  backLink: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  backLinkText: {
    fontSize: 15,
    fontWeight: "700",
    color: C.accent,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: C.screenBg,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: C.text,
    letterSpacing: -0.3,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 12,
  },
  heroCard: {
    backgroundColor: C.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 16,
    gap: 12,
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
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  avatarWrap: {
    width: 88,
    height: 88,
  },
  avatarOuterRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: C.accentRing,
    padding: 4,
    shadowColor: C.accentRing,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 5,
  },
  avatarRingInner: {
    flex: 1,
    borderRadius: 38,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  avatarPhoto: {
    width: "100%",
    height: "100%",
  },
  avatarPlaceholder: {
    flex: 1,
    backgroundColor: C.accentPale,
    borderWidth: 1,
    borderColor: C.accentBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontSize: 24,
    fontWeight: "800",
    color: C.accentDark,
  },
  heroInfo: {
    flex: 1,
    minWidth: 0,
  },
  profileName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: -0.3,
    lineHeight: 24,
  },
  profileEmail: {
    marginTop: 2,
    fontSize: 12,
    color: C.textMuted,
    fontWeight: "500",
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  rolePill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  rolePillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  statusPill: {
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
  statusPillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  verifyRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  verifyChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  verifyChipOk: {
    backgroundColor: "#ECFDF5",
  },
  verifyChipNo: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: C.divider,
  },
  verifyChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: C.textMuted,
  },
  verifyChipTextOk: {
    color: "#059669",
  },
  heroMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: C.divider,
  },
  heroMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  heroMetaText: {
    fontSize: 12,
    color: C.textMuted,
    fontWeight: "500",
  },
  noticeCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: C.accentPale,
    borderWidth: 1,
    borderColor: C.accentBorder,
    borderRadius: 14,
    padding: 14,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: C.accentDark,
    fontWeight: "600",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statTile: {
    flexGrow: 1,
    minWidth: "46%",
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 12,
    gap: 2,
  },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: C.accentPale,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: C.textLight,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  sectionCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    overflow: "hidden",
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.divider,
    backgroundColor: "#FAFBFC",
  },
  sectionIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: C.accentPale,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: C.text,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: C.divider,
  },
  detailRowLast: {
    borderBottomWidth: 0,
  },
  detailRowIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: C.screenBg,
    alignItems: "center",
    justifyContent: "center",
  },
  detailRowText: {
    flex: 1,
    gap: 2,
  },
  detailRowLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: C.textLight,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  detailRowValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0F172A",
    lineHeight: 18,
  },
  profilePreview: {
    marginHorizontal: 14,
    marginBottom: 14,
    width: 88,
    height: 88,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  tagline: {
    marginHorizontal: 14,
    marginBottom: 8,
    fontSize: 13,
    fontStyle: "italic",
    color: C.textMuted,
  },
  bio: {
    marginHorizontal: 14,
    marginBottom: 14,
    fontSize: 13,
    lineHeight: 19,
    color: "#475569",
  },
  verifyItem: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: C.divider,
    gap: 4,
  },
  verifyItemLast: {
    borderBottomWidth: 0,
  },
  verifyItemTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: C.text,
  },
  verifyItemMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  miniChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: C.screenBg,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  miniChipText: {
    fontSize: 10,
    fontWeight: "700",
    color: C.textMuted,
  },
  verifyItemDate: {
    fontSize: 11,
    color: C.textLight,
    fontWeight: "500",
  },
  emptySection: {
    paddingHorizontal: 14,
    paddingVertical: 18,
    fontSize: 13,
    color: C.textMuted,
    textAlign: "center",
  },
  docsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    padding: 14,
  },
  docCard: {
    width: "30%",
    minWidth: 96,
    flexGrow: 1,
    alignItems: "center",
    gap: 5,
    padding: 8,
    borderRadius: 12,
    backgroundColor: C.screenBg,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  docThumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: "#E2E8F0",
  },
  docType: {
    fontSize: 10,
    fontWeight: "600",
    color: C.textMuted,
    textAlign: "center",
  },
  docStatus: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  docStatusOk: { backgroundColor: "#ECFDF5" },
  docStatusNo: { backgroundColor: "#FEF2F2" },
  docStatusWait: { backgroundColor: C.accentPale },
  docStatusText: {
    fontSize: 9,
    fontWeight: "700",
    color: C.textMuted,
  },
  serviceItem: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: C.divider,
    gap: 3,
  },
  serviceItemLast: {
    borderBottomWidth: 0,
  },
  serviceName: {
    fontSize: 13,
    fontWeight: "700",
    color: C.text,
  },
  serviceMeta: {
    fontSize: 11,
    color: C.textMuted,
    fontWeight: "500",
  },
  actionsBlock: {
    gap: 8,
    marginTop: 4,
  },
  actionsLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: C.textLight,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginLeft: 2,
  },
  actionsCard: {
    gap: 8,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderRadius: 12,
    paddingVertical: 14,
  },
  actionBtnPrimary: {
    backgroundColor: C.accentPale,
    borderColor: C.accentBorder,
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
    color: C.text,
  },
  actionBtnTextPrimary: {
    color: C.accentDark,
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
    backgroundColor: C.card,
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
    color: C.textMuted,
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
    backgroundColor: C.screenBg,
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
    color: C.textMuted,
  },
  modalConfirmBtn: {
    backgroundColor: C.accent,
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
