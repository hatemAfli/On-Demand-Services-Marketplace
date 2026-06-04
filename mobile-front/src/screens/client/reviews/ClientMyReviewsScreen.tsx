import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ClientStackParamList } from "../../../navigation/types";
import { api, type ClientReviewListItem } from "../../../services/api";
import { useAppTranslation } from "../../../hooks/useAppTranslation";
import {
  formatBookingLine,
  formatReviewDate,
  initialsFromName,
  parseClientReviewRow,
} from "./reviewUi";

type Props = NativeStackScreenProps<ClientStackParamList, "ClientMyReviews">;

// ─── Design tokens ─────────────────────────────────────────
const C = {
  bg:          "#F7F8FC",
  white:       "#FFFFFF",
  border:      "#EAECF4",
  borderLight: "#F0F2F8",
  text:        "#0F172A",
  textSub:     "#64748B",
  textLight:   "#94A3B8",
  accent:      "#7C5CFC",
  accentBg:    "#F5F3FF",
  accentBdr:   "#DDD6FE",
  gold:        "#F59E0B",
  goldEmpty:   "#E2E8F0",
  success:     "#059669",
  successBg:   "#ECFDF5",
};

// ─── Star row ───────────────────────────────────────────────
function StarRow({ rating, size = 13 }: { rating: number; size?: number }) {
  return (
    <View style={s.starRow}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons
          key={n}
          name={n <= rating ? "star" : "star-outline"}
          size={size}
          color={n <= rating ? C.gold : C.goldEmpty}
        />
      ))}
    </View>
  );
}

// ─── Rating pill ────────────────────────────────────────────
function RatingPill({ rating }: { rating: number }) {
  const color =
    rating >= 4.5 ? C.success :
    rating >= 3   ? C.gold :
                    "#DC2626";
  const bg =
    rating >= 4.5 ? C.successBg :
    rating >= 3   ? "#FFFBEB" :
                    "#FEF2F2";
  return (
    <View style={[s.ratingPill, { backgroundColor: bg, borderColor: `${color}40` }]}>
      <Ionicons name="star" size={10} color={color} />
      <Text style={[s.ratingPillText, { color }]}>{rating.toFixed(1)}</Text>
    </View>
  );
}

// ─── Main screen ────────────────────────────────────────────
export const ClientMyReviewsScreen: React.FC<Props> = ({ navigation }) => {
  const { t }   = useAppTranslation();
  const insets  = useSafeAreaInsets();
  const [items,      setItems]      = useState<ClientReviewListItem[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── Load (unchanged logic) ────────────────────────────────
  const load = useCallback((opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    void api
      .getMyClientReviews()
      .then((res) => {
        const raw = res.data?.items;
        const next = Array.isArray(raw)
          ? raw.map((x) => parseClientReviewRow(x)).filter((x): x is ClientReviewListItem => x !== null)
          : [];
        setItems(next);
      })
      .catch(() => setItems([]))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  const isFirstFocus = useRef(true);
  useFocusEffect(useCallback(() => {
    load({ silent: !isFirstFocus.current });
    isFirstFocus.current = false;
  }, [load]));

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t("client.screenTitles.ClientMyReviews"),
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ marginLeft: 8, padding: 4 }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, t]);

  const onRefresh = useCallback(() => { setRefreshing(true); load({ silent: true }); }, [load]);

  // ── Summary stats ─────────────────────────────────────────
  const avgRating = items.length
    ? items.reduce((sum, i) => sum + i.rating, 0) / items.length
    : 0;

  // ── Render card ───────────────────────────────────────────
  const renderItem = ({ item }: { item: ClientReviewListItem }) => (
    <TouchableOpacity
      style={s.card}
      activeOpacity={0.86}
      onPress={() => navigation.navigate("ClientReviewDetail", { reviewId: item.id })}
    >
      {/* Left accent bar */}
      <View style={[s.cardAccentBar, { backgroundColor: item.rating >= 4 ? C.success : item.rating >= 3 ? C.gold : "#DC2626" }]} />

      <View style={s.cardInner}>
        {/* Top row */}
        <View style={s.cardTop}>
          {/* Avatar */}
          <View style={s.avatarWrap}>
            {item.providerPhotoUrl ? (
              <Image source={{ uri: item.providerPhotoUrl }} style={s.avatar} />
            ) : (
              <View style={s.avatarFallback}>
                <Text style={s.avatarInitials}>{initialsFromName(item.providerName)}</Text>
              </View>
            )}
          </View>

          {/* Info */}
          <View style={s.cardBody}>
            <Text style={s.providerName} numberOfLines={1}>{item.providerName}</Text>
            <Text style={s.serviceName} numberOfLines={1}>{item.serviceName}</Text>
            <Text style={s.bookingLine}>
              {formatBookingLine(item.scheduledDate, item.scheduledTime)}
            </Text>
          </View>

          {/* Rating pill + chevron */}
          <View style={s.cardRight}>
            <RatingPill rating={item.rating} />
            <Ionicons name="chevron-forward" size={15} color={C.textLight} style={{ marginTop: 6 }} />
          </View>
        </View>

        {/* Star row + date */}
        <View style={s.cardMeta}>
          <StarRow rating={item.rating} />
          <Text style={s.dateText}>{formatReviewDate(item.createdAt)}</Text>
        </View>

        {/* Comment preview */}
        {item.comment ? (
          <View style={s.commentWrap}>
            <Ionicons name="chatbubble-outline" size={11} color={C.textLight} />
            <Text style={s.commentPreview} numberOfLines={2}>{item.comment}</Text>
          </View>
        ) : null}

        {/* Provider reply badge */}
        {item.providerReply ? (
          <View style={s.replyBadge}>
            <Ionicons name="chatbubble-ellipses" size={11} color={C.accent} />
            <Text style={s.replyBadgeText}>{t("client.reviews.providerReplied")}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  // ── Loading ───────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={s.loadingText}>Loading your reviews…</Text>
      </View>
    );
  }

  return (
    <View style={[s.root, { paddingBottom: insets.bottom }]}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[s.listContent, items.length === 0 && s.listEmpty]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
        ListHeaderComponent={
          items.length > 0 ? (
            <View style={s.summaryCard}>
              <View style={s.summaryLeft}>
                <Text style={s.summaryCount}>{items.length}</Text>
                <Text style={s.summaryLabel}>
                  {items.length === 1 ? "Review" : "Reviews"}
                </Text>
              </View>
              <View style={s.summaryDivider} />
              <View style={s.summaryCenter}>
                <Text style={s.summaryAvg}>{avgRating.toFixed(1)}</Text>
                <StarRow rating={Math.round(avgRating)} size={12} />
                <Text style={s.summaryLabel}>Avg. rating</Text>
              </View>
              <View style={s.summaryDivider} />
              <View style={s.summaryRight}>
                <Text style={s.summaryCount}>
                  {items.filter((i) => i.providerReply).length}
                </Text>
                <Text style={s.summaryLabel}>Replies received</Text>
              </View>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={s.emptyWrap}>
            <View style={s.emptyIconBox}>
              <Ionicons name="star-outline" size={28} color={C.textLight} />
            </View>
            <Text style={s.emptyTitle}>{t("client.reviews.emptyTitle")}</Text>
            <Text style={s.emptySub}>{t("client.reviews.emptySub")}</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

// ─── Styles ────────────────────────────────────────────────
const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  centered:{ flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  loadingText: { fontSize: 13, color: C.textLight },
  listContent: { padding: 16, gap: 10 },
  listEmpty:   { flexGrow: 1 },

  // Summary card
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    marginBottom: 6,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
      android: { elevation: 1 },
    }),
  },
  summaryLeft:   { flex: 1, alignItems: "center", gap: 3 },
  summaryCenter: { flex: 1, alignItems: "center", gap: 3 },
  summaryRight:  { flex: 1, alignItems: "center", gap: 3 },
  summaryDivider:{ width: 1, height: 40, backgroundColor: C.borderLight, marginHorizontal: 8 },
  summaryCount:  { fontSize: 22, fontWeight: "800", color: C.text, letterSpacing: -0.5 },
  summaryAvg:    { fontSize: 22, fontWeight: "800", color: C.gold, letterSpacing: -0.5 },
  summaryLabel:  { fontSize: 10, color: C.textLight, fontWeight: "600", textAlign: "center" },
  starRow:       { flexDirection: "row", gap: 2 },

  // Review card
  card: {
    flexDirection: "row",
    backgroundColor: C.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
      android: { elevation: 1 },
    }),
  },
  cardAccentBar: { width: 4 },
  cardInner: { flex: 1, padding: 14, gap: 8 },
  cardTop:   { flexDirection: "row", alignItems: "flex-start", gap: 12 },

  // Avatar
  avatarWrap: {
    width: 46, height: 46, borderRadius: 14, overflow: "hidden",
    backgroundColor: C.accentBg, borderWidth: 1, borderColor: C.accentBdr, flexShrink: 0,
  },
  avatar: { width: "100%", height: "100%" },
  avatarFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  avatarInitials: { fontSize: 15, fontWeight: "800", color: C.accent },

  cardBody:    { flex: 1, gap: 2 },
  cardRight:   { alignItems: "flex-end", gap: 2, flexShrink: 0 },
  providerName:{ fontSize: 14, fontWeight: "800", color: C.text, letterSpacing: -0.2 },
  serviceName: { fontSize: 12, fontWeight: "600", color: C.textSub },
  bookingLine: { fontSize: 11, color: C.textLight, marginTop: 1 },

  cardMeta: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", paddingTop: 2,
    borderTopWidth: 1, borderTopColor: C.borderLight,
  },
  dateText: { fontSize: 10, fontWeight: "600", color: C.textLight },

  ratingPill: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 20, borderWidth: 1,
  },
  ratingPillText: { fontSize: 11, fontWeight: "800" },

  commentWrap: {
    flexDirection: "row", alignItems: "flex-start", gap: 6,
    backgroundColor: C.bg, borderRadius: 10, padding: 8,
    borderWidth: 1, borderColor: C.borderLight,
  },
  commentPreview: { flex: 1, fontSize: 12, color: C.textSub, lineHeight: 17, fontStyle: "italic" },

  replyBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    alignSelf: "flex-start",
    backgroundColor: C.accentBg,
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1, borderColor: C.accentBdr,
  },
  replyBadgeText: { fontSize: 11, fontWeight: "700", color: C.accent },

  // Empty
  emptyWrap: { alignItems: "center", paddingHorizontal: 32, paddingTop: 60, gap: 10 },
  emptyIconBox: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: C.accentBg, borderWidth: 1, borderColor: C.accentBdr,
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  emptyTitle: { fontSize: 17, fontWeight: "800", color: C.text, textAlign: "center" },
  emptySub:   { fontSize: 14, color: C.textSub, textAlign: "center", lineHeight: 20, maxWidth: 280 },
});