


import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ProviderStackParamList } from "../../../navigation/types";
import { COLORS } from "../../../constants";
import { useAuth } from "../../../context/AuthContext";
import { useAppTranslation } from "../../../hooks/useAppTranslation";
import {
  api,
  type InvitationFilter,
  type ReceivedInvitation,
  type ReceivedInvitationStatus,
} from "../../../services/api";

type Nav = NativeStackNavigationProp<ProviderStackParamList, "ProviderInvitations">;

function showToast(message: string) {
  if (Platform.OS === "android") {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  } else {
    Alert.alert("", message);
  }
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDate(iso: string): string {
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

/** Returns expiry descriptor: amber warning if < 24h, otherwise gray. */
function isInvitationActionable(invitation: ReceivedInvitation): boolean {
  if (invitation.status !== "PENDING") return false;
  return new Date(invitation.expiresAt).getTime() > Date.now();
}

function statusPillColors(status: ReceivedInvitationStatus): {
  bg: string;
  text: string;
  border: string;
} {
  switch (status) {
    case "PENDING":
      return { bg: "#FFFBEB", text: "#B45309", border: "#FDE68A" };
    case "CANCELLED":
      return { bg: "#F8FAFC", text: "#64748B", border: "#E2E8F0" };
    case "DECLINED":
      return { bg: "#FEF2F2", text: "#B91C1C", border: "#FECACA" };
    case "ACCEPTED":
      return { bg: "#ECFDF5", text: "#047857", border: "#A7F3D0" };
    case "EXPIRED":
    default:
      return { bg: "#F8FAFC", text: "#64748B", border: "#E2E8F0" };
  }
}

function expiryInfo(expiresAt: string): { text: string; urgent: boolean } {
  const ms = new Date(expiresAt).getTime() - Date.now();
  const hours = ms / (1000 * 60 * 60);
  if (hours <= 0) {
    return { text: "Expired", urgent: true };
  }
  if (hours < 24) {
    const h = Math.max(1, Math.round(hours));
    return { text: `Expires in ${h} hour${h > 1 ? "s" : ""}`, urgent: true };
  }
  return { text: `Expires on ${formatDate(expiresAt)}`, urgent: false };
}

type CardProps = {
  invitation: ReceivedInvitation;
  statusLabel: string;
  responding: "ACCEPTED" | "DECLINED" | null;
  removing: boolean;
  onRespond: (action: "ACCEPTED" | "DECLINED") => void;
  onRemoved: (id: string) => void;
};

const InvitationCard: React.FC<CardProps> = ({
  invitation,
  statusLabel,
  responding,
  removing,
  onRespond,
  onRemoved,
}) => {
  const anim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (removing) {
      Animated.timing(anim, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }).start(() => onRemoved(invitation.id));
    }
  }, [removing, anim, invitation.id, onRemoved]);

  const company = invitation.company;
  const adminName =
    `${invitation.sentByAdmin.user.firstName} ${invitation.sentByAdmin.user.lastName}`.trim();
  const expiry = expiryInfo(invitation.expiresAt);
  const isBusy = responding !== null;
  const actionable = isInvitationActionable(invitation);
  const pill = statusPillColors(invitation.status);

  return (
    <Animated.View
      style={[
        styles.card,
        {
          opacity: anim,
          transform: [
            {
              translateX: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [-400, 0],
              }),
            },
          ],
        },
      ]}
    >
      {/* Header: logo + company */}
      <View style={styles.cardHeader}>
        {company.logo ? (
          <Image source={{ uri: company.logo }} style={styles.logo} />
        ) : (
          <View style={[styles.logo, styles.logoFallback]}>
            <Text style={styles.logoInitials}>
              {initialsOf(company.companyName)}
            </Text>
          </View>
        )}

        <View style={styles.headerText}>
          <View style={styles.titleRow}>
            <Text style={styles.companyName} numberOfLines={1}>
              {company.companyName}
            </Text>
            {!actionable ? (
              <View
                style={[
                  styles.statusPill,
                  { backgroundColor: pill.bg, borderColor: pill.border },
                ]}
              >
                <Text style={[styles.statusPillText, { color: pill.text }]}>
                  {statusLabel}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={13} color={COLORS.text.tertiary} />
            <Text style={styles.metaText} numberOfLines={1}>
              {company.city}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="star" size={13} color="#F59E0B" />
            <Text style={styles.ratingText}>
              {Number(company.averageRating ?? 0).toFixed(1)}
            </Text>
            <Text style={styles.metaText}>
              ({company.totalReviews ?? 0} review
              {(company.totalReviews ?? 0) === 1 ? "" : "s"})
            </Text>
          </View>
        </View>
      </View>

      {/* Invited by */}
      <Text style={styles.invitedBy}>Invited by {adminName}</Text>

      {/* Dates row */}
      <View style={styles.datesRow}>
        <View style={styles.dateChip}>
          <Ionicons name="calendar-outline" size={12} color={COLORS.text.tertiary} />
          <Text style={styles.dateChipText}>
            Received {formatDate(invitation.createdAt)}
          </Text>
        </View>
        <View
          style={[
            styles.expiryChip,
            expiry.urgent ? styles.expiryChipUrgent : styles.expiryChipNormal,
          ]}
        >
          <Ionicons
            name={expiry.urgent ? "time" : "time-outline"}
            size={12}
            color={expiry.urgent ? "#B45309" : COLORS.text.tertiary}
          />
          <Text
            style={[
              styles.expiryText,
              expiry.urgent ? styles.expiryTextUrgent : styles.expiryTextNormal,
            ]}
          >
            {expiry.text}
          </Text>
        </View>
      </View>

      {/* Optional message */}
      {invitation.message ? (
        <View style={styles.messageBlock}>
          <Text style={styles.messageText}>"{invitation.message}"</Text>
        </View>
      ) : null}

      {/* Actions */}
      {actionable ? (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.btn, styles.declineBtn, isBusy && styles.btnDisabled]}
            activeOpacity={0.85}
            disabled={isBusy}
            onPress={() => onRespond("DECLINED")}
          >
            {responding === "DECLINED" ? (
              <ActivityIndicator size="small" color={COLORS.error} />
            ) : (
              <>
                <Ionicons name="close" size={16} color={COLORS.error} />
                <Text style={styles.declineText}>Decline</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.acceptBtn, isBusy && styles.btnDisabled]}
            activeOpacity={0.85}
            disabled={isBusy}
            onPress={() => onRespond("ACCEPTED")}
          >
            {responding === "ACCEPTED" ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <>
                <Ionicons name="checkmark" size={16} color={COLORS.white} />
                <Text style={styles.acceptText}>Accept</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : null}
    </Animated.View>
  );
};

const FILTER_OPTIONS: InvitationFilter[] = ["all", "pending", "cancelled"];

export const ProviderInvitationsScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { t } = useAppTranslation();
  const { refreshUser } = useAuth();

  const [filter, setFilter] = useState<InvitationFilter>("pending");
  const [invitations, setInvitations] = useState<ReceivedInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [respondingAction, setRespondingAction] = useState<
    "ACCEPTED" | "DECLINED" | null
  >(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = useCallback(
    async (mode: "initial" | "refresh") => {
      if (mode === "initial") setLoading(true);
      else setRefreshing(true);
      try {
        const res = await api.getMyReceivedInvitations(filter);
        setInvitations(Array.isArray(res.data) ? res.data : []);
      } catch {
        setInvitations([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filter],
  );

  useFocusEffect(
    useCallback(() => {
      void load("initial");
    }, [load]),
  );

  const invitationStatusLabel = useCallback(
    (status: ReceivedInvitationStatus): string => {
      switch (status) {
        case "PENDING":
          return t("provider.invitations.statusPending");
        case "CANCELLED":
          return t("provider.invitations.statusCancelled");
        case "DECLINED":
          return t("provider.invitations.statusDeclined");
        case "ACCEPTED":
          return t("provider.invitations.statusAccepted");
        case "EXPIRED":
        default:
          return t("provider.invitations.statusExpired");
      }
    },
    [t],
  );

  const filterLabel = useCallback(
    (key: InvitationFilter): string => {
      switch (key) {
        case "all":
          return t("provider.invitations.filterAll");
        case "pending":
          return t("provider.invitations.filterPending");
        case "cancelled":
          return t("provider.invitations.filterCancelled");
      }
    },
    [t],
  );

  const handleRespond = useCallback(
    async (id: string, action: "ACCEPTED" | "DECLINED") => {
      if (respondingId) return;
      setRespondingId(id);
      setRespondingAction(action);
      try {
        await api.respondToInvitation(id, { action });
        if (action === "ACCEPTED") {
          await refreshUser();
        }
        showToast(
          action === "ACCEPTED"
            ? "Invitation accepted — welcome to the team!"
            : "Invitation declined.",
        );
        setRemovingId(id); // triggers slide-out animation
      } catch {
        Alert.alert(
          "Something went wrong",
          "Could not submit your response. Please try again.",
        );
      } finally {
        setRespondingId(null);
        setRespondingAction(null);
      }
    },
    [respondingId, refreshUser],
  );

  const handleRemoved = useCallback((id: string) => {
    setInvitations((prev) => prev.filter((i) => i.id !== id));
    setRemovingId(null);
  }, []);

  const emptyCopy = useMemo(() => {
    switch (filter) {
      case "all":
        return {
          title: t("provider.invitations.emptyAllTitle"),
          subtitle: t("provider.invitations.emptyAllSubtitle"),
        };
      case "cancelled":
        return {
          title: t("provider.invitations.emptyCancelledTitle"),
          subtitle: t("provider.invitations.emptyCancelledSubtitle"),
        };
      case "pending":
      default:
        return {
          title: t("provider.invitations.emptyPendingTitle"),
          subtitle: t("provider.invitations.emptyPendingSubtitle"),
        };
    }
  }, [filter, t]);

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyWrap}>
        <View style={styles.emptyIconCircle}>
          <Ionicons name="briefcase-outline" size={40} color={COLORS.primary} />
        </View>
        <Text style={styles.emptyTitle}>{emptyCopy.title}</Text>
        <Text style={styles.emptySubtitle}>{emptyCopy.subtitle}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {t("provider.screenTitles.ProviderInvitations")}
        </Text>
        <View style={styles.headerRight}>
          {invitations.length > 0 ? (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{invitations.length}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.filterBar}>
        {FILTER_OPTIONS.map((key) => {
          const active = filter === key;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.filterChip, active && styles.filterChipActive]}
              activeOpacity={0.85}
              onPress={() => setFilter(key)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  active && styles.filterChipTextActive,
                ]}
              >
                {filterLabel(key)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={invitations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 24 },
            invitations.length === 0 && styles.listEmpty,
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void load("refresh")}
              tintColor={COLORS.primary}
            />
          }
          renderItem={({ item }) => (
            <InvitationCard
              invitation={item}
              statusLabel={invitationStatusLabel(item.status)}
              responding={respondingId === item.id ? respondingAction : null}
              removing={removingId === item.id}
              onRespond={(action) => void handleRespond(item.id, action)}
              onRemoved={handleRemoved}
            />
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    padding: 4,
    width: 40,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text.primary,
  },
  headerRight: {
    width: 40,
    alignItems: "flex-end",
  },
  countBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 7,
  },
  countBadgeText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "800",
  },
  filterBar: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filterChip: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.gray[50],
    borderWidth: 1,
    borderColor: COLORS.gray[100],
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text.secondary,
  },
  filterChipTextActive: {
    color: COLORS.white,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    padding: 16,
    gap: 14,
  },
  listEmpty: {
    flexGrow: 1,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.gray[100],
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    gap: 12,
  },
  logo: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.gray[100],
  },
  logoFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF2FF",
  },
  logoInitials: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.primary,
  },
  headerText: {
    flex: 1,
    justifyContent: "center",
    gap: 2,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  companyName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.text.primary,
  },
  statusPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: COLORS.text.secondary,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.text.primary,
  },
  invitedBy: {
    marginTop: 12,
    fontSize: 12,
    color: COLORS.text.tertiary,
  },
  datesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  dateChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: COLORS.gray[50],
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  dateChipText: {
    fontSize: 11,
    color: COLORS.text.secondary,
    fontWeight: "600",
  },
  expiryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  expiryChipUrgent: {
    backgroundColor: "#FFFBEB",
  },
  expiryChipNormal: {
    backgroundColor: COLORS.gray[50],
  },
  expiryText: {
    fontSize: 11,
    fontWeight: "700",
  },
  expiryTextUrgent: {
    color: "#B45309",
  },
  expiryTextNormal: {
    color: COLORS.text.secondary,
  },
  messageBlock: {
    marginTop: 12,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.gray[300],
    paddingLeft: 12,
    paddingVertical: 2,
  },
  messageText: {
    fontSize: 13,
    fontStyle: "italic",
    color: COLORS.text.secondary,
    lineHeight: 19,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  acceptBtn: {
    backgroundColor: COLORS.success,
  },
  acceptText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "800",
  },
  declineBtn: {
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.error,
  },
  declineText: {
    color: COLORS.error,
    fontSize: 14,
    fontWeight: "800",
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.text.primary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.text.secondary,
    textAlign: "center",
    lineHeight: 20,
  },
});