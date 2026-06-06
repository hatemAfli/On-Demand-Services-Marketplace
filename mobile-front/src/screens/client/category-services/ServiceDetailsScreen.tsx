import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
} from "react-native";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../../../context/AuthContext";
import { useAppTranslation } from "../../../hooks/useAppTranslation";
import { api } from "../../../services/api";
import { getStoredClientCoords } from "../../../services/client-location-cache";
import type { ClientStackParamList } from "../../../navigation/types";
import type { CategoryServicesStyles } from "./ListOfServicesScreen";
import type { MarketplaceServiceItem } from "./types";

const DESCRIPTION_PREVIEW_CHARS = 160;

function truncateDescription(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace > maxChars * 0.6) {
    return `${slice.slice(0, lastSpace).trimEnd()}…`;
  }
  return `${slice.trimEnd()}…`;
}

// ─── Design tokens (matches app white theme) ──────────────────────
const C = {
  bg: "#F1F5F9",
  white: "#FFFFFF",
  border: "#EAECF4",
  borderLight: "#F0F2F8",
  text: "#111827",
  textSub: "#6B7280",
  textLight: "#9CA3AF",
  accent: "#EA580C",
  accentBg: "#FFF7ED",
  accentBorder: "#FFEDD5",
  gold: "#C9A84C",
  goldBg: "rgba(201,168,76,0.10)",
  goldBorder: "rgba(201,168,76,0.25)",
  success: "#059669",
  successBg: "#ECFDF5",
  successBorder: "#A7F3D0",
  error: "#DC2626",
  errorBg: "#FEF2F2",
  errorBorder: "#FECACA",
};

// ─── Props (unchanged) ────────────────────────────────────────────
type Props = {
  visible: boolean;
  onClose: () => void;
  sheetStyles: CategoryServicesStyles;
  service: MarketplaceServiceItem | null;
  imageUri: string;
  initialActiveGivenCount?: number;
};

// ─── Info chip ────────────────────────────────────────────────────
function InfoChip({
  icon,
  label,
  color,
  bg,
  border,
}: {
  icon: string;
  label: string;
  color: string;
  bg: string;
  border: string;
}) {
  return (
    <View style={[s.infoChip, { backgroundColor: bg, borderColor: border }]}>
      <FontAwesome6 name={icon} size={10} color={color} />
      <Text style={[s.infoChipText, { color }]}>{label}</Text>
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────
export const ServiceDetailsScreen: React.FC<Props> = ({
  visible,
  onClose,
  sheetStyles: parentStyles,
  service,
  imageUri,
  initialActiveGivenCount,
}) => {
  const { t } = useAppTranslation();
  const { session } = useAuth();
  const navigation =
    useNavigation<NativeStackNavigationProp<ClientStackParamList>>();

  // ── State (all unchanged) ──────────────────────────────────────
  const [providerCount, setProviderCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [heroImageFailed, setHeroImageFailed] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

  const trimmedUri = imageUri.trim();
  const showHeroImage = trimmedUri.length > 0 && !heroImageFailed;

  // ── Effects (all unchanged logic) ─────────────────────────────
  useEffect(() => {
    setHeroImageFailed(false);
  }, [visible, trimmedUri, service?.id]);

  useEffect(() => {
    if (visible) setDescriptionExpanded(false);
  }, [visible, service?.id]);

  useEffect(() => {
    if (!visible || !service?.id) {
      setIsFavorite(false);
      return;
    }
    let cancelled = false;
    setFavoriteLoading(true);
    void api
      .getClientFavorites({ type: "SERVICE" })
      .then((res) => {
        if (cancelled) return;
        const items = (res.data?.items ?? []) as Array<{ targetId: string }>;
        setIsFavorite(items.some((item) => item.targetId === service.id));
      })
      .catch(() => {
        if (!cancelled) setIsFavorite(false);
      })
      .finally(() => {
        if (!cancelled) setFavoriteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, service?.id]);

  useEffect(() => {
    if (!visible || !service?.id) return;
    let cancelled = false;
    setProviderCount(
      typeof initialActiveGivenCount === "number"
        ? initialActiveGivenCount
        : null,
    );
    setCountLoading(true);
    void api
      .getCatalogServiceActiveGivenCount(service.id)
      .then((res) => {
        if (!cancelled) {
          const raw = res.data as { count?: unknown };
          const n =
            typeof raw?.count === "number" ? raw.count : Number(raw?.count);
          setProviderCount(Number.isFinite(n) ? n : 0);
        }
      })
      .catch(() => {
        if (!cancelled)
          setProviderCount(
            typeof initialActiveGivenCount === "number"
              ? initialActiveGivenCount
              : null,
          );
      })
      .finally(() => {
        if (!cancelled) setCountLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, service?.id, initialActiveGivenCount]);

  if (!service) return null;

  const noDescriptionText = t("client.categoryServices.noDescription");
  const fullDescription =
    service.description?.trim() || noDescriptionText;
  const hasCustomDescription = Boolean(service.description?.trim());
  const canExpandDescription =
    hasCustomDescription &&
    fullDescription.length > DESCRIPTION_PREVIEW_CHARS;
  const displayedDescription =
    descriptionExpanded || !canExpandDescription
      ? fullDescription
      : truncateDescription(fullDescription, DESCRIPTION_PREVIEW_CHARS);
  const sheetSubtitle = t("client.categoryServices.sheetSubtitle", {
    name: service.name,
  });
  const heroInitial = (() => {
    const c = service.name.trim().charAt(0);
    return c ? c.toUpperCase() : "?";
  })();

  // ── toggleFavorite (unchanged logic) ──────────────────────────
  const toggleFavorite = async () => {
    if (!service?.id || favoriteLoading) return;
    setFavoriteLoading(true);
    try {
      if (isFavorite) {
        await api.deleteClientFavorite("SERVICE", service.id);
        setIsFavorite(false);
      } else {
        await api.createClientFavorite({
          type: "SERVICE",
          targetId: service.id,
        });
        setIsFavorite(true);
      }
    } finally {
      setFavoriteLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={s.backdrop}>
        <Pressable
          style={s.backdropDismiss}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t("client.categoryServices.a11yCloseSheet")}
        />
        <View style={s.sheet}>
          {/* ── Drag handle ── */}
          <View style={s.handleRow}>
            <View style={s.handle} />
          </View>

          {/* ── Hero ── */}
          <View style={s.heroWrap}>
            {showHeroImage ? (
              <Image
                source={{ uri: trimmedUri }}
                style={s.heroImage}
                resizeMode="cover"
                onError={() => setHeroImageFailed(true)}
              />
            ) : (
              <View style={s.heroPlaceholder}>
                {/* Subtle background circles */}
                <View style={s.heroBubble1} />
                <View style={s.heroBubble2} />
                <Text style={s.heroLetter}>{heroInitial}</Text>
              </View>
            )}

            {/* Close button */}
            <TouchableOpacity
              style={s.closeBtn}
              onPress={onClose}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={t("client.categoryServices.a11yCloseSheet")}
            >
              <FontAwesome6 name="xmark" size={12} color={C.text} />
            </TouchableOpacity>

            {/* Favorite button */}
            <TouchableOpacity
              style={[s.favBtn, isFavorite && s.favBtnActive]}
              onPress={toggleFavorite}
              disabled={favoriteLoading}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={t("client.categoryServices.a11yToggleFavorite")}
            >
              {favoriteLoading ? (
                <ActivityIndicator
                  size="small"
                  color={isFavorite ? C.white : C.error}
                />
              ) : (
                <Ionicons
                  name={isFavorite ? "heart" : "heart-outline"}
                  size={15}
                  color={isFavorite ? C.white : C.error}
                />
              )}
            </TouchableOpacity>

            {/* Category tag on image */}
            <View style={s.categoryTag}>
              <FontAwesome6 name="tag" size={9} color={C.accent} />
              <Text style={s.categoryTagText}>{service.name}</Text>
            </View>
          </View>

          {/* ── Scrollable content ── */}
          <ScrollView
            style={s.body}
            contentContainerStyle={s.bodyContent}
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            directionalLockEnabled
          >
            {/* Title block */}
            <View style={s.titleBlock}>
              <View style={s.titleRow}>
                <Text style={s.title}>{service.name}</Text>
                {isFavorite && (
                  <View style={s.savedBadge}>
                    <Ionicons name="heart" size={10} color={C.error} />
                    <Text style={s.savedBadgeText}>
                      {t("client.categoryServices.savedBadge")}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={s.subtitle}>{sheetSubtitle}</Text>
            </View>

            {/* Info chips */}
            <View style={s.chipRow}>
              <InfoChip
                icon="shield-halved"
                label={t("client.categoryServices.chipVerifiedProviders")}
                color={C.success}
                bg={C.successBg}
                border={C.successBorder}
              />
              <InfoChip
                icon="star"
                label={t("client.categoryServices.chipTopRated")}
                color={C.gold}
                bg={C.goldBg}
                border={C.goldBorder}
              />
              <InfoChip
                icon="bolt"
                label={t("client.categoryServices.chipFastResponse")}
                color={C.accent}
                bg={C.accentBg}
                border={C.accentBorder}
              />
            </View>

            {/* Divider */}
            <View style={s.divider} />

            {/* Description */}
            <Text style={s.sectionLabel}>
              {t("client.categoryServices.aboutSection")}
            </Text>
            <Text style={s.desc}>{displayedDescription}</Text>
            {canExpandDescription ? (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setDescriptionExpanded((prev) => !prev)}
                accessibilityRole="button"
                accessibilityLabel={
                  descriptionExpanded
                    ? t("client.categoryServices.readLess")
                    : t("client.categoryServices.readMore")
                }
              >
                <Text style={s.readMore}>
                  {descriptionExpanded
                    ? t("client.categoryServices.readLess")
                    : t("client.categoryServices.readMore")}
                </Text>
              </TouchableOpacity>
            ) : null}

            {/* Divider */}
            <View style={s.divider} />

            {/* Providers counter */}
            <Text style={s.sectionLabel}>
              {t("client.categoryServices.sectionCleaners")}
            </Text>

            <View style={s.counterCard}>
              {/* Left: icon + text */}
              <View style={s.counterLeft}>
                <View style={s.counterIconWrap}>
                  <FontAwesome6 name="user-group" size={16} color={C.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.counterTitle}>
                    {t("client.categoryServices.professionals")}
                  </Text>
                  <Text style={s.counterSub}>
                    {t("client.categoryServices.providersCountHint")}
                  </Text>
                </View>
              </View>
              {/* Right: count */}
              <View style={s.counterRight}>
                {countLoading ? (
                  <ActivityIndicator color={C.accent} size="small" />
                ) : (
                  <>
                    <Text style={s.counterValue}>
                      {providerCount !== null ? String(providerCount) : "—"}
                    </Text>
                    <Text style={s.counterValueSub}>
                      {t("client.categoryServices.availableCount")}
                    </Text>
                  </>
                )}
              </View>
            </View>

            {/* What to expect */}
            <View style={s.expectCard}>
              <View style={s.expectRow}>
                <View style={[s.expectDot, { backgroundColor: C.success }]} />
                <Text style={s.expectText}>
                  {t("client.categoryServices.expectOnSite")}
                </Text>
              </View>
              <View style={s.expectRow}>
                <View style={[s.expectDot, { backgroundColor: C.accent }]} />
                <Text style={s.expectText}>
                  {t("client.categoryServices.expectBookSlot")}
                </Text>
              </View>
              <View style={s.expectRow}>
                <View style={[s.expectDot, { backgroundColor: C.gold }]} />
                <Text style={s.expectText}>
                  {t("client.categoryServices.expectPayAfter")}
                </Text>
              </View>
            </View>

            <View style={{ height: 8 }} />
          </ScrollView>

          {/* ── Footer CTA ── */}
          <View style={s.footer}>
            <TouchableOpacity
              style={[s.searchBtn, searching && s.searchBtnLoading]}
              activeOpacity={0.88}
              disabled={searching}
              onPress={async () => {
                setSearching(true);
                let clientLat: number | undefined;
                let clientLng: number | undefined;
                try {
                  if (session?.user?.id) {
                    const coords = await getStoredClientCoords(session.user.id);
                    if (coords) {
                      clientLat = coords.latitude;
                      clientLng = coords.longitude;
                    }
                  }
                } catch {
                  // Continue without coordinates when location fails.
                } finally {
                  setSearching(false);
                }
                onClose();
                navigation.navigate("ClientSearchProvider", {
                  serviceId: service.id,
                  serviceName: service.name,
                  serviceImage:
                    trimmedUri.length > 0 && !heroImageFailed
                      ? trimmedUri
                      : undefined,
                  clientLat,
                  clientLng,
                });
              }}
            >
              {searching ? (
                <ActivityIndicator size="small" color={C.white} />
              ) : (
                <>
                  <View style={s.searchBtnIconWrap}>
                    <FontAwesome6
                      name="magnifying-glass"
                      size={13}
                      color={C.accent}
                    />
                  </View>
                  <Text style={s.searchBtnText}>
                    {t("client.categoryServices.searchProviders")}
                  </Text>
                  <FontAwesome6 name="arrow-right" size={12} color={C.white} />
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ─── Styles ───────────────────────────────────────────────────────
const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15,17,23,0.50)",
  },
  backdropDismiss: {
    flex: 1,
  },
  sheet: {
    height: "88%",
    backgroundColor: C.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
    flexDirection: "column",
  },

  // ── Handle ──────────────────────────────────────────────────
  handleRow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    alignItems: "center",
    paddingTop: 10,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(0,0,0,0.15)",
  },

  // ── Hero ────────────────────────────────────────────────────
  heroWrap: {
    height: 210,
    position: "relative",
    backgroundColor: C.accentBg,
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.accentBg,
    overflow: "hidden",
  },
  heroBubble1: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(234,88,12,0.07)",
    top: -40,
    right: -30,
  },
  heroBubble2: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(234,88,12,0.05)",
    bottom: -20,
    left: 20,
  },
  heroLetter: {
    fontSize: 64,
    fontWeight: "800",
    color: C.accent,
    opacity: 0.5,
  },

  // ── Hero overlay buttons ────────────────────────────────────
  closeBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  favBtn: {
    position: "absolute",
    top: 16,
    right: 58,
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: C.errorBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  favBtnActive: {
    backgroundColor: C.error,
    borderColor: C.error,
  },
  categoryTag: {
    position: "absolute",
    bottom: 14,
    left: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: C.accentBorder,
  },
  categoryTagText: {
    fontSize: 11,
    fontWeight: "700",
    color: C.accent,
  },

  // ── Body ────────────────────────────────────────────────────
  body: {
    flex: 1,
    minHeight: 0,
  },
  bodyContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },

  // ── Title ───────────────────────────────────────────────────
  titleBlock: {
    marginBottom: 14,
    gap: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: C.text,
    letterSpacing: -0.4,
    flex: 1,
  },
  savedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: C.errorBg,
    borderWidth: 1,
    borderColor: C.errorBorder,
  },
  savedBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: C.error,
  },
  subtitle: {
    fontSize: 13,
    color: C.textSub,
    fontWeight: "500",
  },

  // ── Info chips ──────────────────────────────────────────────
  chipRow: {
    flexDirection: "row",
    gap: 7,
    flexWrap: "wrap",
    marginBottom: 4,
  },
  infoChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  infoChipText: {
    fontSize: 11,
    fontWeight: "700",
  },

  // ── Divider ─────────────────────────────────────────────────
  divider: {
    height: 1,
    backgroundColor: C.borderLight,
    marginVertical: 16,
  },

  // ── Description ─────────────────────────────────────────────
  sectionLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: C.text,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  desc: {
    fontSize: 14,
    color: C.textSub,
    lineHeight: 21,
  },
  readMore: {
    color: C.accent,
    marginTop: 8,
    fontSize: 12,
    fontWeight: "700",
  },

  // ── Counter card ────────────────────────────────────────────
  counterCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.accentBorder,
    backgroundColor: C.accentBg,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 14,
  },
  counterLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  counterIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.accentBorder,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  counterTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: C.text,
  },
  counterSub: {
    fontSize: 11,
    color: C.textSub,
    marginTop: 2,
    lineHeight: 15,
  },
  counterRight: {
    alignItems: "center",
    flexShrink: 0,
  },
  counterValue: {
    fontSize: 32,
    fontWeight: "800",
    color: C.accent,
    lineHeight: 36,
  },
  counterValueSub: {
    fontSize: 10,
    color: C.textLight,
    fontWeight: "600",
    marginTop: 1,
    textAlign: "center",
  },

  // ── What to expect ──────────────────────────────────────────
  expectCard: {
    backgroundColor: C.bg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    gap: 10,
  },
  expectRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  expectDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    flexShrink: 0,
  },
  expectText: {
    fontSize: 13,
    color: C.textSub,
    lineHeight: 18,
    flex: 1,
  },

  // ── Footer ──────────────────────────────────────────────────
  footer: {
    flexShrink: 0,
    backgroundColor: C.white,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 28,
  },
  searchBtn: {
    height: 54,
    borderRadius: 16,
    backgroundColor: C.accent,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 6,
  },
  searchBtnLoading: {
    opacity: 0.75,
  },
  searchBtnIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: "rgba(255,255,255,0.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  searchBtnText: {
    color: C.white,
    fontWeight: "800",
    fontSize: 15,
    letterSpacing: 0.1,
    flex: 1,
    textAlign: "center",
  },
});
