import React, { useLayoutEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../services/api";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ProviderStackParamList } from "../../../navigation/types";
import { useAppTranslation } from "../../../hooks/useAppTranslation";

type ServiceCardVariant = "tall" | "addNew";

type ServiceCard = {
  id: string;
  variant: ServiceCardVariant;
  category: string;
  categoryTone: "primary" | "blue" | "pink" | "gray";
  title: string;
  description: string;
  priceAed?: number;
  imageUrl?: string;
  durationLabel?: string;
  staffLabel?: string;
  isActive?: boolean;
};

type VerificationRequestRow = {
  id: string;
  requestStatus: string;
  adminComment?: string | null;
  createdAt: string;
  documents?: Array<{
    id: string;
    type: string;
    fichierUrl: string;
    uploadedAt: string;
    validatedAt?: string | null;
    isAccepted?: boolean | null;
    rejectionReason?: string | null;
  }>;
  service?: {
    id: string;
    name: string;
    description?: string | null;
    servicePhoto?: string | null;
    photoUrl?: string | null;
    imageUrl?: string | null;
    category?: { name: string } | null;
  } | null;
};

type Nav = NativeStackNavigationProp<
  ProviderStackParamList,
  "ProviderServices"
>;

const COLORS = {
  bg: "#F8FAFC",
  white: "#FFFFFF",
  text: "#0F172A",
  textMuted: "#64748B",
  textMuted2: "#94A3B8",
  border: "#E2E8F0",
  borderLight: "#F1F5F9",
  surface: "#F8FAFC",
  surface2: "#F1F5F9",

  // Brand
  primary: "#7C3AED",
  primaryLight: "#EDE9FE",
  primaryMid: "#8B5CF6",

  // Status
  success: "#059669",
  successBg: "#ECFDF5",
  successBorder: "#A7F3D0",
  warning: "#D97706",
  warningBg: "#FFFBEB",
  warningBorder: "#FCD34D",
  danger: "#DC2626",
  dangerBg: "#FEF2F2",
  dangerBorder: "#FECACA",
  info: "#2563EB",
  infoBg: "#EFF6FF",
  infoBorder: "#BFDBFE",

  // Tones
  blue: "#2563EB",
  pink: "#DB2777",
  gray: "#475569",

  // Overlay
  overlay: "rgba(124,58,237,0.06)",
};

// ─── Status config helper ──────────────────────────────────
const requestStatusConfig = (status: string) => {
  switch (status) {
    case "APPROVED":
      return {
        label: "Approved",
        bg: COLORS.successBg,
        border: COLORS.successBorder,
        text: COLORS.success,
        icon: "checkmark-circle" as const,
      };
    case "REJECTED":
      return {
        label: "Rejected",
        bg: COLORS.dangerBg,
        border: COLORS.dangerBorder,
        text: COLORS.danger,
        icon: "close-circle" as const,
      };
    case "UNDER_REVIEW":
      return {
        label: "Under review",
        bg: COLORS.infoBg,
        border: COLORS.infoBorder,
        text: COLORS.info,
        icon: "time" as const,
      };
    default:
      return {
        label: "Pending",
        bg: COLORS.warningBg,
        border: COLORS.warningBorder,
        text: COLORS.warning,
        icon: "hourglass" as const,
      };
  }
};

// ─── Service card component ────────────────────────────────
function ServiceCardView({
  item,
  onOpenEditService,
  onRequestNewService,
}: {
  item: ServiceCard;
  onOpenEditService: () => void;
  onRequestNewService: () => void;
}) {
  if (item.variant === "addNew") {
    return (
      <Pressable
        onPress={onRequestNewService}
        style={({ pressed }) => [
          styles.addNewCard,
          pressed && { opacity: 0.92 },
        ]}
      >
        <View style={styles.addNewIconWrap}>
          <Ionicons name="add" size={22} color={COLORS.primary} />
        </View>
        <Text style={styles.addNewTitle}>Request a New Service</Text>
        <Text style={styles.addNewSubtitle}>
          Expand your offerings to reach more clients
        </Text>
      </Pressable>
    );
  }

  const toneColor =
    item.categoryTone === "primary"
      ? COLORS.primary
      : item.categoryTone === "blue"
        ? COLORS.blue
        : item.categoryTone === "pink"
          ? COLORS.pink
          : COLORS.gray;

  return (
    <Pressable
      onPress={onOpenEditService}
      style={({ pressed }) => [
        styles.serviceCard,
        pressed && { opacity: 0.96 },
      ]}
    >
      {/* Image / placeholder */}
      <View style={styles.cardMedia}>
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={styles.serviceImageCover}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.cardMediaPlaceholder}>
            <Ionicons
              name="construct-outline"
              size={28}
              color={COLORS.textMuted2}
            />
          </View>
        )}

        {/* Category pill */}
        <View style={[styles.categoryPill, { borderColor: toneColor + "30" }]}>
          <View style={[styles.categoryDot, { backgroundColor: toneColor }]} />
          <Text style={[styles.categoryPillText, { color: toneColor }]}>
            {item.category}
          </Text>
        </View>

        {/* Active / inactive badge */}
        <View
          style={[
            styles.activeBadge,
            item.isActive ? styles.activeBadgeOn : styles.activeBadgeOff,
          ]}
        >
          <View
            style={[
              styles.activeDot,
              {
                backgroundColor: item.isActive ? COLORS.success : COLORS.danger,
              },
            ]}
          />
          <Text
            style={[
              styles.activeBadgeText,
              { color: item.isActive ? COLORS.success : COLORS.danger },
            ]}
          >
            {item.isActive ? "Active" : "Inactive"}
          </Text>
        </View>
      </View>

      {/* Card body */}
      <View style={styles.cardBody}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.serviceTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={styles.editChip}>
            <Ionicons name="create-outline" size={13} color={COLORS.primary} />
            <Text style={styles.editChipText}>Edit</Text>
          </View>
        </View>

        {item.description ? (
          <Text style={styles.serviceDescription} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}

        {/* Footer row */}
        <View style={styles.cardFooter}>
          <View style={styles.cardFooterItem}>
            <Ionicons
              name="images-outline"
              size={13}
              color={COLORS.textMuted}
            />
            <Text style={styles.cardFooterText}>Gallery</Text>
          </View>
          <View style={styles.cardFooterItem}>
            <Ionicons
              name="pricetag-outline"
              size={13}
              color={COLORS.textMuted}
            />
            <Text style={styles.cardFooterText}>Pricing</Text>
          </View>
          <View style={styles.cardFooterDivider} />
          <Ionicons
            name="chevron-forward"
            size={14}
            color={COLORS.textMuted2}
          />
        </View>
      </View>
    </Pressable>
  );
}

// ─── Verification request row ──────────────────────────────
function RequestRow({
  req,
  onPress,
}: {
  req: VerificationRequestRow;
  onPress: () => void;
}) {
  const cfg = requestStatusConfig(req.requestStatus);
  return (
    <TouchableOpacity
      style={styles.requestRow}
      activeOpacity={0.85}
      onPress={onPress}
    >
      <View style={styles.requestRowLeft}>
        <View style={[styles.requestIconBox, { backgroundColor: cfg.bg }]}>
          <Ionicons name={cfg.icon} size={16} color={cfg.text} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.requestRowName} numberOfLines={1}>
            {req.service?.name ?? "Service request"}
          </Text>
          {req.adminComment ? (
            <Text style={styles.requestRowComment} numberOfLines={2}>
              {req.adminComment}
            </Text>
          ) : null}
        </View>
      </View>
      <View
        style={[
          styles.requestStatusPill,
          {
            backgroundColor: cfg.bg,
            borderColor: cfg.border,
          },
        ]}
      >
        <Text style={[styles.requestStatusText, { color: cfg.text }]}>
          {cfg.label}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted2} />
    </TouchableOpacity>
  );
}

// ─── Main screen ───────────────────────────────────────────
export const ProviderServicesScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { t } = useAppTranslation();
  const { width } = useWindowDimensions();

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t("provider.screenTitles.ProviderServices"),
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ marginLeft: 8, padding: 4 }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, t]);
  const [providedServices, setProvidedServices] = useState<ServiceCard[]>([]);
  const [requestedServices, setRequestedServices] = useState<
    VerificationRequestRow[]
  >([]);
  const [loadingServices, setLoadingServices] = useState(true);

  useFocusEffect(
    React.useCallback(() => {
      let alive = true;
      const load = async () => {
        if (alive) setLoadingServices(true);
        try {
          const res = await api.getMyVerificationRequests();
          const requests = (
            Array.isArray(res.data) ? res.data : []
          ) as VerificationRequestRow[];
          const seen = new Set<string>();
          const mapped: ServiceCard[] = [];
          const requested: VerificationRequestRow[] = [];
          for (const req of requests) {
            const svc = req.service;
            if (!svc?.id || !svc.name || seen.has(svc.id)) continue;
            if (req.requestStatus === "APPROVED") {
              seen.add(svc.id);
              mapped.push({
                id: svc.id,
                variant: "tall",
                category: svc.category?.name ?? "Service",
                categoryTone: "primary",
                title: svc.name,
                description: svc.description?.trim() || "",
                priceAed: undefined,
                imageUrl:
                  svc.servicePhoto ?? svc.photoUrl ?? svc.imageUrl ?? undefined,
                durationLabel: "—",
                staffLabel: "—",
                isActive: true,
              });
            } else {
              requested.push(req);
            }
          }
          if (alive) {
            setProvidedServices(mapped);
            setRequestedServices(requested);
          }
        } catch {
          if (alive) {
            setProvidedServices([]);
            setRequestedServices([]);
          }
        } finally {
          if (alive) setLoadingServices(false);
        }
      };
      void load();
      return () => {
        alive = false;
      };
    }, []),
  );

  const services: ServiceCard[] = useMemo(
    () => [...providedServices],
    [providedServices],
  );

  const cardWidth = width - 32;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerIconWrap}>
            <Ionicons
              name="briefcase-outline"
              size={18}
              color={COLORS.primary}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>My Services</Text>
            <Text style={styles.headerSubtitle}>
              Manage pricing, gallery and availability
            </Text>
          </View>
        </View>

        {/* ── Content ── */}
        {loadingServices ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading your services…</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* ── Active services ── */}
            {services.length > 0 && (
              <View style={{ gap: 4 }}>
                <Text style={styles.sectionLabel}>Active services</Text>
                <View style={{ gap: 12 }}>
                  {services.map((s) => (
                    <View key={s.id} style={{ width: cardWidth }}>
                      <ServiceCardView
                        item={s}
                        onOpenEditService={() =>
                          navigation.navigate("ProviderManageService", {
                            mode: "edit",
                            serviceId:
                              s.variant === "addNew" ? undefined : s.id,
                            serviceName:
                              s.variant === "addNew" ? undefined : s.title,
                            serviceCategory:
                              s.variant === "addNew" ? undefined : s.category,
                            serviceDescription:
                              s.variant === "addNew"
                                ? undefined
                                : s.description,
                          })
                        }
                        onRequestNewService={() =>
                          navigation.navigate("ProviderRequestService")
                        }
                      />
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ── Empty state ── */}
            {services.length === 0 && (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons
                    name="construct-outline"
                    size={28}
                    color={COLORS.primary}
                  />
                </View>
                <Text style={styles.emptyTitle}>No active services yet</Text>
                <Text style={styles.emptySubtitle}>
                  Request your first service below to start receiving bookings
                </Text>
              </View>
            )}

            {/* ── Verification requests ── */}
            {requestedServices.length > 0 && (
              <View style={styles.requestsSection}>
                <View style={styles.requestsHeader}>
                  <Text style={styles.sectionLabel}>Verification requests</Text>
                  <View style={styles.requestsCountBadge}>
                    <Text style={styles.requestsCountText}>
                      {requestedServices.length}
                    </Text>
                  </View>
                </View>
                <View style={styles.requestsList}>
                  {requestedServices.map((req, i) => (
                    <View key={req.id}>
                      <RequestRow
                        req={req}
                        onPress={() =>
                          (navigation as any).navigate(
                            "ProviderVerificationRequestDetail",
                            { request: req },
                          )
                        }
                      />
                      {i < requestedServices.length - 1 && (
                        <View style={styles.rowDivider} />
                      )}
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ── Request new service button ── */}
            <TouchableOpacity
              style={[styles.requestNewBtn, styles.requestNewBtnDisabled]}
              disabled
              activeOpacity={1}
            >
              <View style={styles.requestNewBtnIcon}>
                <Ionicons name="add" size={18} color={COLORS.primary} />
              </View>
              <Text style={styles.requestNewBtnText}>
                Request a new service
              </Text>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={COLORS.primary}
              />
            </TouchableOpacity>
            <View style={styles.requestPreviewCard}>
              <View style={styles.requestPreviewIconWrap}>
                <Ionicons
                  name="sparkles-outline"
                  size={16}
                  color={COLORS.primary}
                />
              </View>
              <View style={styles.requestPreviewContent}>
                <Text style={styles.requestPreviewTitle}>
                  Get Premium feature{" "}
                </Text>
                <Text style={styles.requestPreviewText}>
                  Need more services? Upgrade to Premium to unlock this feature.
                  Premium access is coming soon.
                </Text>
              </View>
            </View>
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
};

// ─── Styles ────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, backgroundColor: COLORS.bg },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  headerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 1,
  },

  // Loading
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },

  // Scroll
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 20,
  },

  // Section label
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },

  // Service card
  serviceCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  cardMedia: {
    height: 170,
    backgroundColor: COLORS.surface2,
    position: "relative",
  },
  serviceImageCover: {
    width: "100%",
    height: "100%",
  },
  cardMediaPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface2,
  },
  categoryPill: {
    position: "absolute",
    bottom: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.95)",
  },
  categoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  categoryPillText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  activeBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  activeBadgeOn: {
    backgroundColor: COLORS.successBg,
    borderColor: COLORS.successBorder,
  },
  activeBadgeOff: {
    backgroundColor: COLORS.dangerBg,
    borderColor: COLORS.dangerBorder,
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  cardBody: {
    padding: 14,
    gap: 8,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  serviceTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  editChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primary + "20",
  },
  editChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.primary,
  },
  serviceDescription: {
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  cardFooterItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  cardFooterText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: "600",
  },
  cardFooterDivider: {
    flex: 1,
  },

  // Add new card
  addNewCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: COLORS.primary + "40",
    backgroundColor: COLORS.overlay,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 28,
    paddingHorizontal: 20,
    gap: 8,
  },
  addNewIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  addNewTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  addNewSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: "center",
  },

  // Empty state
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 10,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: "center",
    maxWidth: 260,
    lineHeight: 18,
  },

  // Verification requests section
  requestsSection: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  requestsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  requestsCountBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  requestsCountText: {
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.primary,
  },
  requestsList: {
    paddingVertical: 4,
  },
  requestRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  requestRowLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  requestIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  requestRowName: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
  },
  requestRowComment: {
    fontSize: 12,
    color: COLORS.danger,
    lineHeight: 17,
  },
  requestStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    flexShrink: 0,
  },
  requestStatusText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
  rowDivider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
    marginHorizontal: 16,
  },

  // Request new button
  requestNewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.primary + "30",
    backgroundColor: COLORS.primaryLight,
  },
  requestNewBtnIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.primary + "20",
  },
  requestNewBtnText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.primary,
    letterSpacing: -0.1,
  },
  requestNewBtnDisabled: {
    opacity: 0.55,
  },
  requestPreviewCard: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.primary + "22",
    backgroundColor: COLORS.white,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  requestPreviewIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  requestPreviewContent: {
    flex: 1,
  },
  requestPreviewTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 2,
  },
  requestPreviewText: {
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textMuted,
  },
});
