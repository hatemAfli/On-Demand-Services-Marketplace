import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../../../constants";
import { api } from "../../../services/api";
import type { ClientStackParamList } from "../../../navigation/types";

const PAGE_SIZE = 10;
const STAR_GOLD = "#F59E0B";
const STAR_EMPTY = "#D1D5DB";

type Props = NativeStackScreenProps<
  ClientStackParamList,
  "PublicProviderReviews"
>;

export type PublicReviewRow = {
  id: string;
  rating: number;
  comment: string | null;
  providerReply: string | null;
  createdAt: string;
  clientImageUrl: string | null;
  clientFirstName: string;
  clientLastName: string;
  serviceName: string;
};

type BreakdownRow = { star: number; count: number; percentage: number };

function formatAverage(v: number): string {
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

function formatClientShort(first: string, last: string): string {
  const f = first.trim();
  const l = last.trim();
  if (!f && !l) return "Client";
  if (!l) return f;
  const initial = l[0] ? `${l[0]}.` : "";
  return `${f} ${initial}`.trim();
}

function formatReviewDate(iso: string): string {
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

function initials(first: string, last: string): string {
  const a = first.trim()[0] ?? "";
  const b = last.trim()[0] ?? "";
  const s = `${a}${b}`.toUpperCase();
  return s || "?";
}

function mapReviewRaw(raw: unknown): PublicReviewRow | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = r.id;
  if (typeof id !== "string") return null;
  const rating = typeof r.rating === "number" ? r.rating : Number(r.rating);
  if (!Number.isFinite(rating)) return null;
  const comment =
    r.comment === null || r.comment === undefined
      ? null
      : String(r.comment);
  const providerReply =
    r.providerReply === null || r.providerReply === undefined
      ? null
      : String(r.providerReply);
  const createdAt =
    typeof r.createdAt === "string" ? r.createdAt : String(r.createdAt ?? "");

  const client = r.client as Record<string, unknown> | undefined;
  const imageUrl =
    client?.imageUrl != null && String(client.imageUrl).trim()
      ? String(client.imageUrl)
      : null;
  const user = client?.user as Record<string, unknown> | undefined;
  const firstName =
    typeof user?.firstName === "string" ? user.firstName : "";
  const lastName = typeof user?.lastName === "string" ? user.lastName : "";

  const gs = r.givenService as Record<string, unknown> | undefined;
  const service = gs?.service as Record<string, unknown> | undefined;
  const translations = service?.translations as unknown[] | undefined;
  let serviceName = "Service";
  if (Array.isArray(translations) && translations[0]) {
    const t0 = translations[0] as Record<string, unknown>;
    if (typeof t0.name === "string" && t0.name.trim()) serviceName = t0.name;
  }

  return {
    id,
    rating,
    comment,
    providerReply,
    createdAt,
    clientImageUrl: imageUrl,
    clientFirstName: firstName,
    clientLastName: lastName,
    serviceName,
  };
}

function AverageStarRow({ average }: { average: number }) {
  const stars = useMemo(() => {
    const raw = Math.min(5, Math.max(0, average));
    const a = Math.round(raw * 2) / 2;
    return [1, 2, 3, 4, 5].map((i) => {
      if (a >= i) return "full" as const;
      if (a >= i - 0.5) return "half" as const;
      return "empty" as const;
    });
  }, [average]);

  return (
    <View style={styles.avgStarRow}>
      {stars.map((kind, idx) => (
        <Ionicons
          key={idx}
          name={
            kind === "full"
              ? "star"
              : kind === "half"
                ? "star-half"
                : "star-outline"
          }
          size={28}
          color={kind === "empty" ? STAR_EMPTY : STAR_GOLD}
        />
      ))}
    </View>
  );
}

function BreakdownBars({ rows }: { rows: BreakdownRow[] }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 700,
      useNativeDriver: false,
    }).start();
  }, [rows, progress]);

  return (
    <View style={styles.breakdownCard}>
      {rows.map((row) => {
        const fillPct =
          typeof row.percentage === "number" && Number.isFinite(row.percentage)
            ? Math.min(100, Math.max(0, row.percentage))
            : 0;
        const barColor =
          row.star >= 4
            ? COLORS.primary
            : row.star === 3
              ? "#F59E0B"
              : COLORS.error;

        const widthAnim = progress.interpolate({
          inputRange: [0, 1],
          outputRange: ["0%", `${fillPct}%`],
        });

        return (
          <View key={row.star} style={styles.breakdownRow}>
            <Text style={styles.breakdownStarLabel}>{row.star}</Text>
            <Ionicons name="star" size={14} color={STAR_GOLD} style={{ marginRight: 6 }} />
            <View style={styles.breakdownTrack}>
              <Animated.View
                style={[
                  styles.breakdownFill,
                  { width: widthAnim, backgroundColor: barColor },
                ]}
              />
            </View>
            <Text style={styles.breakdownCount}>{row.count}</Text>
          </View>
        );
      })}
    </View>
  );
}

const ReadOnlyReviewCard = React.memo(function ReadOnlyReviewCard({
  item,
}: {
  item: PublicReviewRow;
}) {
  const [expanded, setExpanded] = useState(false);
  const name = formatClientShort(item.clientFirstName, item.clientLastName);
  const initialsStr = initials(item.clientFirstName, item.clientLastName);
  const hasLongComment =
    (item.comment?.length ?? 0) > 160 ||
    (item.comment?.split("\n").length ?? 0) > 3;

  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewTop}>
        {item.clientImageUrl ? (
          <Image
            source={{ uri: item.clientImageUrl }}
            style={styles.clientAvatar}
          />
        ) : (
          <View style={[styles.clientAvatar, styles.clientAvatarPh]}>
            <Text style={styles.clientAvatarTxt}>{initialsStr}</Text>
          </View>
        )}
        <View style={styles.reviewTopText}>
          <Text style={styles.clientName}>{name}</Text>
          <View style={styles.reviewMetaRow}>
            <View style={styles.starRowSmall}>
              {[1, 2, 3, 4, 5].map((i) => (
                <Ionicons
                  key={i}
                  name={i <= item.rating ? "star" : "star-outline"}
                  size={14}
                  color={i <= item.rating ? STAR_GOLD : STAR_EMPTY}
                />
              ))}
            </View>
            <View style={styles.serviceChip}>
              <Text style={styles.serviceChipText} numberOfLines={1}>
                {item.serviceName}
              </Text>
            </View>
          </View>
          <Text style={styles.reviewDate}>
            {formatReviewDate(item.createdAt)}
          </Text>
        </View>
      </View>

      {item.comment ? (
        <>
          <Text
            style={styles.commentText}
            numberOfLines={expanded ? undefined : 3}
          >
            {item.comment}
          </Text>
          {hasLongComment ? (
            <TouchableOpacity onPress={() => setExpanded((x) => !x)}>
              <Text style={styles.readMore}>
                {expanded ? "Show less" : "Read more"}
              </Text>
            </TouchableOpacity>
          ) : null}
        </>
      ) : (
        <Text style={styles.noComment}>No written review</Text>
      )}

      {item.providerReply ? (
        <View style={styles.replyBox}>
          <Text style={styles.replyLabel}>Provider</Text>
          <Text style={styles.replyText}>{item.providerReply}</Text>
        </View>
      ) : null}
    </View>
  );
});

function FilterChipsRow({
  chips,
  minRating,
  onSelect,
}: {
  chips: readonly { key: "all" | 1 | 2 | 3 | 4 | 5; label: string }[];
  minRating: number | undefined;
  onSelect: (key: "all" | 1 | 2 | 3 | 4 | 5) => void;
}) {
  return (
    <View style={styles.chipsWrap}>
      {chips.map((c) => {
        const active =
          c.key === "all" ? minRating == null : minRating === c.key;
        return (
          <TouchableOpacity
            key={String(c.key)}
            style={[styles.filterChip, active && styles.filterChipActive]}
            onPress={() => onSelect(c.key)}
          >
            <Text
              style={[
                styles.filterChipText,
                active && styles.filterChipTextActive,
              ]}
            >
              {c.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export const PublicProviderReviewsScreen: React.FC<Props> = ({
  route,
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const { providerId, providerName, isTopProvider: isTopProviderParam } =
    route.params;
  const isTopProvider = isTopProviderParam ?? false;

  const [breakdown, setBreakdown] = useState<BreakdownRow[]>([]);
  const [items, setItems] = useState<PublicReviewRow[]>([]);
  const [total, setTotal] = useState(0);
  const [averageRating, setAverageRating] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [minRating, setMinRating] = useState<number | undefined>(undefined);
  const [sort, setSort] = useState<"recent" | "highest" | "lowest">("recent");

  const endReachedBusy = useRef(false);
  const isFirstLoad = useRef(true);

  const headerTitle = useMemo(
    () => `${providerName}'s reviews`,
    [providerName],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: headerTitle,
      headerStyle: { backgroundColor: COLORS.white },
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBack}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.text.primary} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, headerTitle]);

  const loadBreakdown = useCallback(async () => {
    try {
      const res = await api.getProviderReviewsBreakdown(providerId);
      const data = Array.isArray(res.data) ? res.data : [];
      setBreakdown(
        data
          .filter(
            (x): x is BreakdownRow =>
              !!x &&
              typeof x === "object" &&
              typeof (x as BreakdownRow).star === "number",
          )
          .sort((a, b) => b.star - a.star),
      );
    } catch {
      setBreakdown([]);
    }
  }, [providerId]);

  const fetchPage = useCallback(
    async (nextSkip: number, append: boolean) => {
      const res = await api.getProviderReviews(providerId, {
        take: PAGE_SIZE,
        skip: nextSkip,
        sort,
        ...(minRating != null ? { minRating } : {}),
      });
      const rawItems = Array.isArray(res.data?.items) ? res.data.items : [];
      const mapped = rawItems
        .map(mapReviewRaw)
        .filter((x): x is PublicReviewRow => x != null);
      setTotal(typeof res.data?.total === "number" ? res.data.total : 0);
      setAverageRating(
        typeof res.data?.averageRating === "number"
          ? res.data.averageRating
          : 0,
      );
      if (append) {
        setItems((prev) => [...prev, ...mapped]);
      } else {
        setItems(mapped);
      }
    },
    [providerId, sort, minRating],
  );

  const loadInitial = useCallback(async () => {
    endReachedBusy.current = false;
    if (isFirstLoad.current) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    try {
      await loadBreakdown();
      await fetchPage(0, false);
    } catch {
      Alert.alert("Could not load", "Please check your connection and try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
      isFirstLoad.current = false;
    }
  }, [providerId, fetchPage, loadBreakdown]);

  const loadMore = useCallback(async () => {
    if (loadingMore || loading || refreshing) return;
    if (items.length >= total) return;
    setLoadingMore(true);
    try {
      await fetchPage(items.length, true);
    } catch {
      /* ignore */
    } finally {
      setLoadingMore(false);
      endReachedBusy.current = false;
    }
  }, [loadingMore, loading, refreshing, items.length, total, fetchPage]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadInitial();
  }, [loadInitial]);

  const onEndReached = useCallback(() => {
    if (endReachedBusy.current || loadingMore || loading || refreshing) return;
    if (items.length >= total) return;
    endReachedBusy.current = true;
    void loadMore();
  }, [loadMore, loadingMore, loading, refreshing, items.length, total]);

  const hasMore = items.length < total;

  const filterChips = useMemo(
    () =>
      [
        { key: "all" as const, label: "All" },
        { key: 5 as const, label: "5★" },
        { key: 4 as const, label: "4★" },
        { key: 3 as const, label: "3★" },
        { key: 2 as const, label: "2★" },
        { key: 1 as const, label: "1★" },
      ] as const,
    [],
  );

  const renderListHeader = useCallback(
    () => (
      <View style={styles.headerBlock}>
        <View style={styles.summaryCard}>
          <Text style={styles.avgBig}>{formatAverage(averageRating)}</Text>
          <AverageStarRow average={averageRating} />
          <Text style={styles.reviewCountLine}>({total} reviews)</Text>
          {isTopProvider ? (
            <View style={styles.topBadge}>
              <Text style={styles.topBadgeEmoji}>🏅</Text>
              <Text style={styles.topBadgeText}>Top Provider</Text>
            </View>
          ) : null}
        </View>

        {breakdown.length > 0 ? <BreakdownBars rows={breakdown} /> : null}

        <FilterChipsRow
          chips={filterChips}
          minRating={minRating}
          onSelect={(key) => {
            setMinRating(key === "all" ? undefined : key);
          }}
        />

        <View style={styles.sortRow}>
          {(
            [
              ["recent", "Recent"] as const,
              ["highest", "Highest"] as const,
              ["lowest", "Lowest"] as const,
            ] as const
          ).map(([key, label]) => {
            const active = sort === key;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.sortChip, active && styles.sortChipActive]}
                onPress={() => {
                  if (sort === key) return;
                  setSort(key);
                }}
              >
                <Text
                  style={[
                    styles.sortChipText,
                    active && styles.sortChipTextActive,
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.listSectionTitle}>Reviews</Text>
      </View>
    ),
    [
      averageRating,
      total,
      isTopProvider,
      breakdown,
      filterChips,
      minRating,
      sort,
    ],
  );

  if (loading && items.length === 0) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        renderItem={({ item }) => <ReadOnlyReviewCard item={item} />}
        ListHeaderComponent={renderListHeader}
        contentContainerStyle={styles.listContent}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.35}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListEmptyComponent={
          total === 0 && !loading && !refreshing ? (
            <View style={styles.empty}>
              <Ionicons name="star-outline" size={56} color={COLORS.gray[300]} />
              <Text style={styles.emptyTitle}>No reviews yet</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          <View style={styles.footer}>
            {loadingMore ? (
              <ActivityIndicator color={COLORS.primary} />
            ) : !hasMore && items.length > 0 ? (
              <Text style={styles.footerMuted}>No more reviews</Text>
            ) : null}
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.white },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  headerBack: { marginLeft: 4, padding: 4 },
  listContent: { paddingHorizontal: 16, paddingTop: 8 },
  headerBlock: { marginBottom: 8 },
  summaryCard: {
    backgroundColor: COLORS.gray[50],
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    marginBottom: 16,
  },
  avgBig: {
    fontSize: 48,
    fontWeight: "800",
    color: COLORS.text.primary,
  },
  avgStarRow: { flexDirection: "row", marginTop: 4, gap: 2 },
  reviewCountLine: {
    marginTop: 8,
    fontSize: 15,
    color: COLORS.text.secondary,
    fontWeight: "600",
  },
  topBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(79, 70, 229, 0.12)",
  },
  topBadgeEmoji: { fontSize: 14 },
  topBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.primaryDark,
  },
  breakdownCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    marginBottom: 16,
    backgroundColor: COLORS.white,
  },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 6,
  },
  breakdownStarLabel: {
    width: 14,
    fontWeight: "700",
    color: COLORS.text.primary,
  },
  breakdownTrack: {
    flex: 1,
    height: 10,
    borderRadius: 6,
    backgroundColor: COLORS.gray[100],
    overflow: "hidden",
  },
  breakdownFill: {
    height: "100%",
    borderRadius: 6,
  },
  breakdownCount: {
    width: 36,
    textAlign: "right",
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text.secondary,
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text.secondary,
  },
  filterChipTextActive: { color: COLORS.white },
  sortRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  sortChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    backgroundColor: COLORS.gray[50],
  },
  sortChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: "rgba(79, 70, 229, 0.1)",
  },
  sortChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text.secondary,
  },
  sortChipTextActive: { color: COLORS.primaryDark },
  listSectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.text.primary,
    marginBottom: 10,
  },
  reviewCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 12,
    backgroundColor: COLORS.white,
  },
  reviewTop: { flexDirection: "row", marginBottom: 10 },
  clientAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  clientAvatarPh: {
    backgroundColor: COLORS.gray[200],
    alignItems: "center",
    justifyContent: "center",
  },
  clientAvatarTxt: { fontWeight: "800", color: COLORS.text.primary },
  reviewTopText: { flex: 1 },
  clientName: { fontSize: 16, fontWeight: "700", color: COLORS.text.primary },
  reviewMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  starRowSmall: { flexDirection: "row", gap: 1 },
  serviceChip: {
    maxWidth: "55%",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "rgba(79, 70, 229, 0.12)",
  },
  serviceChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primaryDark,
  },
  reviewDate: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.text.tertiary,
  },
  commentText: {
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.text.primary,
  },
  readMore: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.primary,
  },
  noComment: {
    fontSize: 14,
    color: COLORS.text.tertiary,
    fontStyle: "italic",
  },
  replyBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: COLORS.gray[50],
    borderLeftWidth: 3,
    borderLeftColor: COLORS.gray[300],
  },
  replyLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.text.tertiary,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  replyText: {
    fontSize: 14,
    color: COLORS.text.secondary,
    lineHeight: 20,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text.primary,
  },
  footer: { paddingVertical: 20, alignItems: "center" },
  footerMuted: { fontSize: 13, color: COLORS.text.tertiary },
});
