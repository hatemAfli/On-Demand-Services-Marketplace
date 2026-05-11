import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  ImageBackground,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ClientStackParamList } from "../../../navigation/types";
import { api } from "../../../services/api";

type Props = NativeStackScreenProps<
  ClientStackParamList,
  "ClientSearchProvider"
>;
type SortKey = "RECOMMENDED" | "RATING_DESC" | "PRICE_ASC";
type OwnerTypeFilter = "ALL" | "PROVIDER" | "COMPANY";
type GenderFilter = "ALL" | "MALE" | "FEMALE";

type SearchResultItem = {
  givenServiceId: string;
  serviceName: string;
  pricingType: string;
  price: number;
  isAvailableImmediately: boolean | null;
  averageRating: number;
  totalReviews: number;
  serviceRadiusKm: number | null;
  galleries: { id: string; imageUrl: string }[];
  owner: {
    id: string;
    displayName: string;
    photoUrl: string | null;
    city: string;
    latitude: number | null;
    longitude: number | null;
    isTopProvider: boolean;
    tagline: string | null;
  };
};

type SearchResponse = {
  items?: SearchResultItem[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
};

const haversineKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return r * c;
};

/* ─── Star rating renderer ──────────────────────────────────────────────── */
function StarRating({ rating, count }: { rating: number; count: number }) {
  const stars = [1, 2, 3, 4, 5];
  return (
    <View style={starStyles.row}>
      {stars.map((s) => (
        <Ionicons
          key={s}
          name={
            rating >= s
              ? "star"
              : rating >= s - 0.5
                ? "star-half"
                : "star-outline"
          }
          size={12}
          color="#F59E0B"
        />
      ))}
      <Text style={starStyles.count}>({count})</Text>
    </View>
  );
}
const starStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 2 },
  count: { fontSize: 11, color: "#9B9BB0", fontWeight: "600", marginLeft: 3 },
});

export const ClientSearchProviderScreen: React.FC<Props> = ({
  route,
  navigation,
}) => {
  const serviceId = route.params?.serviceId;
  const serviceName = route.params?.serviceName ?? "Service";
  const clientLat = route.params?.clientLat;
  const clientLng = route.params?.clientLng;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("RECOMMENDED");
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [onlyTop, setOnlyTop] = useState(false);
  const [ownerType, setOwnerType] = useState<OwnerTypeFilter>("ALL");
  const [gender, setGender] = useState<GenderFilter>("ALL");
  const [items, setItems] = useState<SearchResultItem[]>([]);
  const [favoriteProviderIds, setFavoriteProviderIds] = useState<Set<string>>(
    new Set(),
  );
  const [favoriteBusyIds, setFavoriteBusyIds] = useState<Set<string>>(
    new Set(),
  );
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!serviceId) {
      setLoading(false);
      setError("Missing service id.");
      return;
    }
    let cancelled = false;

    const loadPage = async (targetPage: number, append: boolean) => {
      if (!cancelled) {
        if (append) setLoadingMore(true);
        else setLoading(true);
        setError(null);
      }
      try {
        const res = await api.searchProviders({
          serviceId,
          clientLat,
          clientLng,
          sort,
          ownerType: ownerType === "ALL" ? undefined : ownerType,
          gender: gender === "ALL" ? undefined : gender,
          isAvailableImmediately: onlyAvailable ? true : undefined,
          isTopProvider: onlyTop ? true : undefined,
          page: targetPage,
          limit,
        });
        if (cancelled) return;
        const [favoriteRes, data] = await Promise.all([
          api.getClientFavorites({ type: "PROVIDER" }),
          Promise.resolve((res.data ?? {}) as SearchResponse),
        ]);
        const nextItems = Array.isArray(data.items) ? data.items : [];
        setItems((prev) => (append ? [...prev, ...nextItems] : nextItems));
        const favItems = (favoriteRes.data?.items ?? []) as Array<{
          targetId: string;
        }>;
        setFavoriteProviderIds(new Set(favItems.map((item) => item.targetId)));
        setTotal(typeof data.total === "number" ? data.total : 0);
        setPage(typeof data.page === "number" ? data.page : targetPage);
        setTotalPages(
          typeof data.totalPages === "number" ? data.totalPages : 1,
        );
      } catch {
        if (!cancelled) {
          setError("Could not load providers. Please try again.");
          if (!append) {
            setItems([]);
            setFavoriteProviderIds(new Set());
            setTotal(0);
            setPage(1);
            setTotalPages(1);
          }
        }
      } finally {
        if (!cancelled) {
          if (append) setLoadingMore(false);
          else setLoading(false);
        }
      }
    };

    void loadPage(1, false);

    return () => {
      cancelled = true;
    };
  }, [
    clientLat,
    clientLng,
    onlyAvailable,
    onlyTop,
    ownerType,
    gender,
    serviceId,
    sort,
    limit,
  ]);

  const resultLabel = useMemo(
    () => `${total} provider${total === 1 ? "" : "s"} found`,
    [total],
  );

  const canLoadMore = page < totalPages;

  const loadMore = async () => {
    if (!serviceId || loading || loadingMore || !canLoadMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await api.searchProviders({
        serviceId,
        clientLat,
        clientLng,
        sort,
        ownerType: ownerType === "ALL" ? undefined : ownerType,
        gender: gender === "ALL" ? undefined : gender,
        isAvailableImmediately: onlyAvailable ? true : undefined,
        isTopProvider: onlyTop ? true : undefined,
        page: nextPage,
        limit,
      });
      const data = (res.data ?? {}) as SearchResponse;
      const nextItems = Array.isArray(data.items) ? data.items : [];
      setItems((prev) => [...prev, ...nextItems]);
      setTotal(typeof data.total === "number" ? data.total : total);
      setPage(typeof data.page === "number" ? data.page : nextPage);
      setTotalPages(
        typeof data.totalPages === "number" ? data.totalPages : totalPages,
      );
    } catch {
      // Keep existing items visible on load-more failures.
    } finally {
      setLoadingMore(false);
    }
  };

  /* ─── Filter chip helper ──────────────────────────────────────────────── */
  const Chip = ({
    label,
    active,
    onPress,
    icon,
    accent = "violet",
  }: {
    label: string;
    active: boolean;
    onPress: () => void;
    icon?: string;
    accent?: "violet" | "amber" | "emerald";
  }) => {
    const colors = {
      violet: { bg: "#EDE9FE", border: "#C4B5FD", text: "#7C5CFC" },
      amber: { bg: "#FFFBEB", border: "#FDE68A", text: "#B45309" },
      emerald: { bg: "#ECFDF5", border: "#6EE7B7", text: "#047857" },
    };
    const c = colors[accent];
    return (
      <TouchableOpacity
        style={[
          styles.chip,
          active && { backgroundColor: c.bg, borderColor: c.border },
        ]}
        onPress={onPress}
        activeOpacity={0.75}
      >
        {icon ? (
          <Ionicons
            name={icon as any}
            size={12}
            color={active ? c.text : "#9B9BB0"}
          />
        ) : null}
        <Text style={[styles.chipText, active && { color: c.text }]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  /* ─── Provider card ───────────────────────────────────────────────────── */
  const renderItem = ({ item }: { item: SearchResultItem }) => {
    const profileImage = item.owner.photoUrl ?? undefined;
    const distance =
      clientLat !== undefined &&
      clientLng !== undefined &&
      item.owner.latitude !== null &&
      item.owner.longitude !== null
        ? haversineKm(
            clientLat,
            clientLng,
            item.owner.latitude,
            item.owner.longitude,
          )
        : null;

    const initials = item.owner.displayName
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

    const isFavorite = favoriteProviderIds.has(item.owner.id);
    const favoriteLoading = favoriteBusyIds.has(item.owner.id);

    const toggleFavorite = async () => {
      if (!item.owner.id || favoriteLoading) return;
      setFavoriteBusyIds((prev) => new Set(prev).add(item.owner.id));
      try {
        if (isFavorite) {
          await api.deleteClientFavorite("PROVIDER", item.owner.id);
          setFavoriteProviderIds((prev) => {
            const next = new Set(prev);
            next.delete(item.owner.id);
            return next;
          });
        } else {
          await api.createClientFavorite({
            type: "PROVIDER",
            targetId: item.owner.id,
          });
          setFavoriteProviderIds((prev) => {
            const next = new Set(prev);
            next.add(item.owner.id);
            return next;
          });
        }
      } finally {
        setFavoriteBusyIds((prev) => {
          const next = new Set(prev);
          next.delete(item.owner.id);
          return next;
        });
      }
    };

    return (
      <View style={styles.card}>
        <TouchableOpacity
          style={[
            styles.cardFavoriteButton,
            isFavorite && styles.cardFavoriteButtonActive,
          ]}
          onPress={() => {
            void toggleFavorite();
          }}
          disabled={favoriteLoading}
          activeOpacity={0.85}
        >
          {favoriteLoading ? (
            <ActivityIndicator
              size="small"
              color={isFavorite ? "#FFFFFF" : "#EF4444"}
            />
          ) : (
            <Ionicons
              name={isFavorite ? "heart" : "heart-outline"}
              size={15}
              color={isFavorite ? "#FFFFFF" : "#EF4444"}
            />
          )}
        </TouchableOpacity>
        <View style={styles.cardRow}>
          <View style={styles.leftAvatarWrap}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.leftAvatar} />
            ) : (
              <View style={styles.leftAvatarPlaceholder}>
                <Text style={styles.leftAvatarInitials}>{initials}</Text>
              </View>
            )}
          </View>

          {/* Right side details */}
          <View style={styles.cardBodyCompact}>
            <View style={styles.cardNameRow}>
              <View style={styles.cardNameCol}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.owner.displayName}
                </Text>
                {item.owner.tagline ? (
                  <Text style={styles.tagline} numberOfLines={1}>
                    {item.owner.tagline}
                  </Text>
                ) : null}
              </View>
              <StarRating
                rating={item.averageRating}
                count={item.totalReviews}
              />
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoChip}>
                <Ionicons name="location-outline" size={12} color="#9B9BB0" />
                <Text style={styles.infoChipText}>
                  {item.owner.city}
                  {distance !== null ? ` · ${distance.toFixed(1)} km` : ""}
                </Text>
              </View>
              {item.serviceRadiusKm ? (
                <View style={styles.infoChip}>
                  <Ionicons name="radio-outline" size={12} color="#9B9BB0" />
                  <Text style={styles.infoChipText}>
                    {item.serviceRadiusKm} km radius
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.badgesRow}>
              {item.owner.isTopProvider ? (
                <View style={styles.badgeTop}>
                  <Ionicons name="medal" size={11} color="#B45309" />
                  <Text style={styles.badgeTopText}>Top Provider</Text>
                </View>
              ) : null}
              {item.isAvailableImmediately ? (
                <View style={styles.badgeNow}>
                  <View style={styles.badgeNowDot} />
                  <Text style={styles.badgeNowText}>Available now</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.cardDivider} />

            <View style={styles.cardFooterRow}>
              <View>
                <Text style={styles.priceLabel}>Starting from</Text>
                <View style={styles.priceRow}>
                  <Text style={styles.priceValue}>{item.price}</Text>
                  <Text style={styles.pricingType}>
                    {item.pricingType === "HOURLY" ? "/ hr" : "fixed"}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.ctaBtn}
                activeOpacity={0.85}
                onPress={() =>
                  navigation.navigate("ClientProviderProfile", {
                    givenServiceId: item.givenServiceId,
                  })
                }
              >
                <Text style={styles.ctaBtnText}>View profile</Text>
                <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.headerShell}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.85}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={20} color="#1A1A2E" />
          </TouchableOpacity>
          <View style={styles.headerTitleBlock}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {serviceName}
            </Text>
            <Text style={styles.resultCount}>{resultLabel}</Text>
          </View>
          <TouchableOpacity
            style={styles.favoriteButton}
            onPress={() =>
              navigation.navigate("ClientFavoritesList", { type: "PROVIDER" })
            }
            activeOpacity={0.85}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="heart" size={18} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter bar */}
      <View style={styles.filtersRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContent}
        >
          {/* Sort chips */}
          <View style={styles.chipGroupLabel}>
            <Text style={styles.chipGroupLabelText}>Sort</Text>
          </View>
          {(
            [
              {
                key: "RECOMMENDED",
                label: "Best match",
                icon: "sparkles-outline",
              },
              { key: "RATING_DESC", label: "Top rated", icon: "star-outline" },
              {
                key: "PRICE_ASC",
                label: "Lowest price",
                icon: "pricetag-outline",
              },
            ] as { key: SortKey; label: string; icon: string }[]
          ).map((opt) => (
            <Chip
              key={opt.key}
              label={opt.label}
              icon={opt.icon}
              active={sort === opt.key}
              onPress={() => setSort(opt.key)}
              accent="violet"
            />
          ))}

          <View style={styles.chipDivider} />

          {/* Filter chips */}
          <Chip
            label="Available now"
            icon="flash-outline"
            active={onlyAvailable}
            onPress={() => setOnlyAvailable((v) => !v)}
            accent="emerald"
          />
          <Chip
            label="Top Provider"
            icon="medal-outline"
            active={onlyTop}
            onPress={() => setOnlyTop((v) => !v)}
            accent="amber"
          />
          <Chip
            label="Independent"
            icon="person-outline"
            active={ownerType === "PROVIDER"}
            onPress={() =>
              setOwnerType((v) => (v === "PROVIDER" ? "ALL" : "PROVIDER"))
            }
            accent="violet"
          />
          <Chip
            label="Company"
            icon="business-outline"
            active={ownerType === "COMPANY"}
            onPress={() =>
              setOwnerType((v) => (v === "COMPANY" ? "ALL" : "COMPANY"))
            }
            accent="violet"
          />
          <Chip
            label="Male"
            icon="male-outline"
            active={gender === "MALE"}
            onPress={() => setGender((v) => (v === "MALE" ? "ALL" : "MALE"))}
            accent="violet"
          />
          <Chip
            label="Female"
            icon="female-outline"
            active={gender === "FEMALE"}
            onPress={() =>
              setGender((v) => (v === "FEMALE" ? "ALL" : "FEMALE"))
            }
            accent="violet"
          />
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color="#7C5CFC" />
            <Text style={styles.loadingText}>Finding providers…</Text>
          </View>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <View style={styles.errorCard}>
            <Ionicons name="cloud-offline-outline" size={36} color="#9B9BB0" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.givenServiceId}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReachedThreshold={0.3}
          onEndReached={() => {
            void loadMore();
          }}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="search-outline" size={32} color="#9B9BB0" />
              </View>
              <Text style={styles.emptyTitle}>No providers found</Text>
              <Text style={styles.emptySub}>
                Try adjusting your filters or search area.
              </Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.listFooter}>
                <ActivityIndicator color="#7C5CFC" size="small" />
                <Text style={styles.listFooterText}>Loading more…</Text>
              </View>
            ) : null
          }
          renderItem={renderItem}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F4F3FA" },

  /* Header */
  headerShell: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#EBEBF5",
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 14,
    shadowColor: "#1A1A2E",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#EBEBF5",
    backgroundColor: "#F4F3FA",
    flexShrink: 0,
  },
  headerTitleBlock: { flex: 1 },
  favoriteButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.2,
    borderColor: "#FECACA",
    backgroundColor: "#FFF1F2",
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1A1A2E",
    letterSpacing: -0.3,
  },
  resultCount: {
    fontSize: 12,
    color: "#9B9BB0",
    fontWeight: "500",
    marginTop: 1,
  },

  /* Filter bar */
  filtersRow: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#EBEBF5",
  },
  filtersContent: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
    alignItems: "center",
  },
  chipGroupLabel: {
    paddingHorizontal: 6,
  },
  chipGroupLabelText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#C4C4C4",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "#EBEBF5",
    backgroundColor: "#F9F8FF",
  },
  chipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#9B9BB0",
  },
  chipDivider: {
    width: 1,
    height: 20,
    backgroundColor: "#EBEBF5",
    marginHorizontal: 4,
  },

  /* States */
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderColor: "#EBEBF5",
    shadowColor: "#7C5CFC",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 3,
  },
  loadingText: { fontSize: 14, color: "#7C5CFC", fontWeight: "600" },
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
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },

  /* List */
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 30,
    gap: 16,
  },
  listFooter: {
    paddingTop: 10,
    paddingBottom: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    flexDirection: "row",
  },
  listFooterText: { fontSize: 12, color: "#9B9BB0", fontWeight: "600" },

  /* Empty state */
  emptyWrap: {
    alignItems: "center",
    paddingTop: 56,
    paddingHorizontal: 24,
    gap: 12,
  },
  emptyIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: "#EDE9FE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    borderWidth: 1.5,
    borderColor: "#C4B5FD",
  },
  emptyTitle: { fontSize: 17, fontWeight: "800", color: "#1A1A2E" },
  emptySub: {
    fontSize: 13,
    color: "#9B9BB0",
    textAlign: "center",
    lineHeight: 19,
  },

  /* ─── Provider Card ─────────────────────────────────────────────────── */
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#EBEBF5",
    overflow: "hidden",
    shadowColor: "#1A1A2E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 3,
    position: "relative",
  },
  cardFavoriteButton: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderWidth: 1.2,
    borderColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 3,
  },
  cardFavoriteButtonActive: {
    backgroundColor: "#EF4444",
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
  },
  leftAvatarWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    flexShrink: 0,
  },
  leftAvatar: {
    width: "100%",
    height: "100%",
    borderRadius: 28,
  },
  leftAvatarPlaceholder: {
    width: "100%",
    height: "100%",
    borderRadius: 28,
    backgroundColor: "#EDE9FE",
    alignItems: "center",
    justifyContent: "center",
  },
  leftAvatarInitials: {
    fontSize: 15,
    fontWeight: "800",
    color: "#7C5CFC",
  },
  cardBodyCompact: {
    flex: 1,
    gap: 10,
  },

  /* Cover */
  cardCover: {
    height: 150,
    position: "relative",
  },
  cardCoverImg: {
    width: "100%",
    height: "100%",
  },
  cardCoverImgInner: {
    resizeMode: "cover",
  },
  cardCoverPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#F4F3FA",
    alignItems: "center",
    justifyContent: "center",
  },
  coverGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(26,26,46,0.22)",
  },

  /* Cover badges */
  coverBadges: {
    position: "absolute",
    top: 10,
    left: 10,
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
  badgeTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,251,235,0.95)",
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  badgeTopText: { fontSize: 11, color: "#B45309", fontWeight: "700" },
  badgeNow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(236,253,245,0.95)",
    borderWidth: 1,
    borderColor: "#6EE7B7",
  },
  badgeNowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#059669",
  },
  badgeNowText: { fontSize: 11, color: "#047857", fontWeight: "700" },
  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },

  /* Floating avatar */
  avatarFloatWrap: {
    position: "absolute",
    bottom: -22,
    left: 16,
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    shadowColor: "#1A1A2E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 4,
    overflow: "hidden",
  },
  avatarFloat: {
    width: "100%",
    height: "100%",
    borderRadius: 14,
  },
  avatarFloatPlaceholder: {
    width: "100%",
    height: "100%",
    borderRadius: 14,
    backgroundColor: "#EDE9FE",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFloatInitials: {
    fontSize: 16,
    fontWeight: "800",
    color: "#7C5CFC",
  },

  /* Card body */
  cardBody: {
    paddingTop: 30,
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 10,
  },
  cardNameRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  cardNameCol: { flex: 1 },
  name: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1A1A2E",
    letterSpacing: -0.2,
  },
  tagline: {
    fontSize: 12,
    color: "#9B9BB0",
    fontWeight: "500",
    marginTop: 3,
    lineHeight: 17,
  },

  /* Info chips */
  infoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  infoChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#F4F3FA",
    borderWidth: 1,
    borderColor: "#EBEBF5",
  },
  infoChipText: {
    fontSize: 11,
    color: "#6B6B80",
    fontWeight: "600",
  },

  /* Divider */
  cardDivider: {
    height: 1,
    backgroundColor: "#F4F3FA",
  },

  /* Footer row */
  cardFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  priceLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#9B9BB0",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
    marginTop: 2,
  },
  priceValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1A1A2E",
    letterSpacing: -0.5,
  },
  pricingType: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9B9BB0",
  },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: "#7C5CFC",
    shadowColor: "#7C5CFC",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  ctaBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
});
