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
  bg: "#F1F5F9",
  white: "#FFFFFF",
  text: "#1A1A2E",
  textMuted: "#6B7280",
  textMuted2: "#9CA3AF",
  border: "#E5E7EB",
  borderLight: "#F3F4F6",
  surface: "#FFFFFF",
  surface2: "#F1F5F9",
  primary: "#EA580C",
  primaryLight: "#FFF7ED",
  primaryMid: "#C2410C",
  success: "#059669",
  successBg: "#ECFDF5",
  successBorder: "#A7F3D0",
  warning: "#D97706",
  warningBg: "#FFFBEB",
  warningBorder: "#FCD34D",
  danger: "#DC2626",
  dangerBg: "#FEF2F2",
  dangerBorder: "#FECACA",
  info: "#0284C7",
  infoBg: "#EFF6FF",
  infoBorder: "#BFDBFE",
  blue: "#0284C7",
  pink: "#DB2777",
  gray: "#475569",
  overlay: "rgba(234,88,12,0.06)",
};

// ─── Status config helper (unchanged) ─────────────────────
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
          <Ionicons name="add" size={24} color={COLORS.primary} />
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
              size={32}
              color={COLORS.textMuted2}
            />
          </View>
        )}

        {/* Gradient overlay for readability */}
        <View style={styles.cardMediaGradient} />

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

        {/* Category pill — bottom left */}
        <View style={[styles.categoryPill, { borderColor: toneColor + "40" }]}>
          <View style={[styles.categoryDot, { backgroundColor: toneColor }]} />
          <Text style={[styles.categoryPillText, { color: toneColor }]}>
            {item.category}
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

        {/* Footer */}
        <View style={styles.cardFooter}>
          <View style={styles.cardFooterItem}>
            <Ionicons
              name="images-outline"
              size={13}
              color={COLORS.textMuted}
            />
            <Text style={styles.cardFooterText}>Gallery</Text>
          </View>
          <View style={styles.cardFooterDot} />
          <View style={styles.cardFooterItem}>
            <Ionicons
              name="pricetag-outline"
              size={13}
              color={COLORS.textMuted}
            />
            <Text style={styles.cardFooterText}>Pricing</Text>
          </View>
          <View style={styles.cardFooterDivider} />
          <View style={styles.cardChevronWrap}>
            <Ionicons name="chevron-forward" size={13} color={COLORS.primary} />
          </View>
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
        <View
          style={[
            styles.requestIconBox,
            { backgroundColor: cfg.bg, borderColor: cfg.border },
          ]}
        >
          <Ionicons name={cfg.icon} size={15} color={cfg.text} />
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
          { backgroundColor: cfg.bg, borderColor: cfg.border },
        ]}
      >
        <Text style={[styles.requestStatusText, { color: cfg.text }]}>
          {cfg.label}
        </Text>
      </View>
      <View style={styles.rowChevronWrap}>
        <Ionicons name="chevron-forward" size={13} color={COLORS.textMuted2} />
      </View>
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
      headerTitleAlign: "center",
      headerLeft: () => (
        <View style={styles.headerSide}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.headerBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="chevron-back" size={22} color={COLORS.text} />
          </TouchableOpacity>
        </View>
      ),
      headerRight: () => <View style={styles.headerSide} />,
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
        {loadingServices ? (
          <View style={styles.loadingWrap}>
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>Loading your services…</Text>
            </View>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* ── Active services ── */}
            {services.length > 0 && (
              <View style={styles.servicesSection}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionDot} />
                  <Text style={styles.sectionLabel}>Active services</Text>
                  <View style={styles.sectionCount}>
                    <Text style={styles.sectionCountText}>
                      {services.length}
                    </Text>
                  </View>
                </View>
                <View style={{ gap: 14 }}>
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
                    size={30}
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
                  <View style={styles.sectionDot} />
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

            {/* ── Request new service (disabled / locked) ── */}
            <View style={styles.upgradeSection}>
              <TouchableOpacity
                style={[styles.requestNewBtn, styles.requestNewBtnDisabled]}
                disabled
                activeOpacity={1}
              >
                <View style={styles.requestNewBtnIcon}>
                  <Ionicons name="add" size={16} color={COLORS.primary} />
                </View>
                <Text style={styles.requestNewBtnText}>
                  Request a new service
                </Text>
                <Ionicons
                  name="lock-closed-outline"
                  size={14}
                  color={COLORS.primary}
                />
              </TouchableOpacity>

              <View style={styles.requestPreviewCard}>
                <View style={styles.requestPreviewIconWrap}>
                  <Ionicons
                    name="sparkles-outline"
                    size={15}
                    color={COLORS.primary}
                  />
                </View>
                <View style={styles.requestPreviewContent}>
                  <Text style={styles.requestPreviewTitle}>
                    Premium feature
                  </Text>
                  <Text style={styles.requestPreviewText}>
                    Need more services? Upgrade to Premium to unlock this
                    feature. Premium access is coming soon.
                  </Text>
                </View>
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
  headerSide: {
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBtn: { padding: 4 },

  /* ── Loading ── */
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderColor: "#EBEBF5",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 3,
  },
  loadingText: { fontSize: 14, color: "#9B9BB0", fontWeight: "600" },

  /* ── Scroll ── */
  scrollContent: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 48, gap: 16 },

  /* ── Section header ── */
  servicesSection: { gap: 12 },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 2,
  },
  sectionDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  sectionLabel: {
    flex: 1,
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.primary,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  sectionCount: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primary + "25",
  },
  sectionCountText: { fontSize: 10, fontWeight: "800", color: COLORS.primary },

  /* ── Service card ── */
  serviceCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#EBEBF5",
    overflow: "hidden",
    shadowColor: "#1A1A2E",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  cardMedia: {
    height: 180,
    backgroundColor: COLORS.primaryLight,
    position: "relative",
  },
  serviceImageCover: { width: "100%", height: "100%" },
  cardMediaPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primaryLight,
  },
  cardMediaGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,10,35,0.12)",
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
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.95)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  categoryDot: { width: 6, height: 6, borderRadius: 3 },
  categoryPillText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.2 },
  activeBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  activeBadgeOn: {
    backgroundColor: COLORS.successBg,
    borderColor: COLORS.successBorder,
  },
  activeBadgeOff: {
    backgroundColor: COLORS.dangerBg,
    borderColor: COLORS.dangerBorder,
  },
  activeDot: { width: 5, height: 5, borderRadius: 2.5 },
  activeBadgeText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.2 },

  cardBody: { padding: 14, gap: 8 },
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
    color: "#1A1A2E",
    letterSpacing: -0.3,
  },
  editChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primary + "25",
  },
  editChipText: { fontSize: 11, fontWeight: "700", color: COLORS.primary },
  serviceDescription: {
    fontSize: 13,
    color: "#9B9BB0",
    lineHeight: 18,
    fontWeight: "400",
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.bg,
  },
  cardFooterItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  cardFooterText: { fontSize: 12, color: COLORS.textMuted, fontWeight: "600" },
  cardFooterDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#D1D1E0",
  },
  cardFooterDivider: { flex: 1 },
  cardChevronWrap: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },

  /* ── Add new card ── */
  addNewCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: COLORS.primary + "40",
    backgroundColor: COLORS.overlay,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    paddingHorizontal: 20,
    gap: 8,
  },
  addNewIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.primary + "25",
    marginBottom: 4,
  },
  addNewTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1A1A2E",
    letterSpacing: -0.2,
  },
  addNewSubtitle: {
    fontSize: 13,
    color: "#9B9BB0",
    textAlign: "center",
    fontWeight: "500",
  },

  /* ── Empty state ── */
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 10,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    borderWidth: 1.5,
    borderColor: COLORS.primary + "25",
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1A1A2E",
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#9B9BB0",
    textAlign: "center",
    maxWidth: 260,
    lineHeight: 19,
  },

  /* ── Verification requests ── */
  requestsSection: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EBEBF5",
    overflow: "hidden",
    shadowColor: "#1A1A2E",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
    gap: 0,
  },
  requestsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.bg,
  },
  requestsCountBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: COLORS.primary + "25",
  },
  requestsCountText: { fontSize: 11, fontWeight: "800", color: COLORS.primary },
  requestsList: { paddingVertical: 4 },
  requestRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 14,
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
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    flexShrink: 0,
  },
  requestRowName: { fontSize: 13, fontWeight: "700", color: "#1A1A2E" },
  requestRowComment: {
    fontSize: 11,
    color: COLORS.danger,
    lineHeight: 16,
    fontWeight: "500",
  },
  requestStatusPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    flexShrink: 0,
  },
  requestStatusText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.2 },
  rowChevronWrap: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  rowDivider: { height: 1, backgroundColor: COLORS.bg, marginHorizontal: 14 },

  /* ── Upgrade / locked section ── */
  upgradeSection: { gap: 10 },
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
  requestNewBtnDisabled: { opacity: 0.5 },
  requestPreviewCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.primary + "22",
    backgroundColor: COLORS.white,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    shadowColor: "#1A1A2E",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  requestPreviewIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.primary + "20",
    marginTop: 1,
    flexShrink: 0,
  },
  requestPreviewContent: { flex: 1 },
  requestPreviewTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1A1A2E",
    marginBottom: 4,
    letterSpacing: -0.1,
  },
  requestPreviewText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#9B9BB0",
    fontWeight: "400",
  },
});
