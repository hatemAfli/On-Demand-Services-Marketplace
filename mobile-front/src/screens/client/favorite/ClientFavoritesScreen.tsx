import React, { useCallback, useLayoutEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
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
import { api } from "../../../services/api";
import { useAppTranslation } from "../../../hooks/useAppTranslation";

// ─── Types (unchanged) ────────────────────────────────────
type Props = NativeStackScreenProps<ClientStackParamList, "ClientFavorites">;
type FavoriteType = "CATEGORY" | "SERVICE" | "PROVIDER";
type FavoriteCounts = Record<FavoriteType, number>;

// ─── Design tokens ─────────────────────────────────────────
const C = {
  bg: "#F1F5F9",
  white: "#FFFFFF",
  border: "#EAECF4",
  text: "#111827",
  textSub: "#6B7280",
  textLight: "#9CA3AF",
  accent: "#EA580C",

  // Category — orange (brand)
  orangeBg: "#FFF7ED",
  orangeBorder: "#FFEDD5",
  orangeIcon: "#EA580C",
  orangeText: "#C2410C",
  orangeDeep: "#9A3412",

  // Service — teal/emerald
  tealBg: "#F0FDFA",
  tealBorder: "#99F6E4",
  tealIcon: "#0F766E",
  tealText: "#0F766E",
  tealDeep: "#134E4A",

  // Provider — amber
  amberBg: "#FFFBEB",
  amberBorder: "#FDE68A",
  amberIcon: "#B45309",
  amberText: "#92400E",
  amberDeep: "#78350F",
};

// ─── Card config (unchanged data, new color tokens) ────────
const CARD_CONFIG: {
  type: FavoriteType;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  colors: [string, string];
  iconColor: string;
  textColor: string;
  deepColor: string;
  accentBg: string;
  emoji: string;
}[] = [
  {
    type: "CATEGORY",
    title: "Favorite Categories",
    subtitle: "Your saved service categories",
    icon: "grid-outline",
    colors: [C.orangeBg, C.orangeBorder],
    iconColor: C.orangeIcon,
    textColor: C.orangeText,
    deepColor: C.orangeDeep,
    accentBg: "#FFEDD5",
    emoji: "🗂️",
  },
  {
    type: "SERVICE",
    title: "Favorite Services",
    subtitle: "Your preferred service offerings",
    icon: "sparkles-outline",
    colors: [C.tealBg, C.tealBorder],
    iconColor: C.tealIcon,
    textColor: C.tealText,
    deepColor: C.tealDeep,
    accentBg: "#CCFBF1",
    emoji: "✨",
  },
  {
    type: "PROVIDER",
    title: "Favorite Providers",
    subtitle: "Trusted providers you bookmarked",
    icon: "people-outline",
    colors: [C.amberBg, C.amberBorder],
    iconColor: C.amberIcon,
    textColor: C.amberText,
    deepColor: C.amberDeep,
    accentBg: "#FDE68A",
    emoji: "⭐",
  },
];

// ─── Favorite card ─────────────────────────────────────────
function FavoriteCard({
  item,
  onPress,
}: {
  item: (typeof CARD_CONFIG)[number] & { count: number };
  onPress: () => void;
}) {
  const empty = item.count === 0;

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      style={[s.card, { borderColor: item.colors[1] }]}
      onPress={onPress}
    >
      {/* Subtle tinted background fill */}
      <View
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: item.colors[0], borderRadius: 22 },
        ]}
      />

      {/* Decorative circle top-right */}
      <View style={[s.cardCircle, { backgroundColor: item.accentBg }]} />

      {/* Card content */}
      <View style={s.cardInner}>
        {/* Top row: icon box + count badge */}
        <View style={s.cardTopRow}>
          <View style={[s.iconBox, { backgroundColor: C.white }]}>
            <Ionicons name={item.icon} size={19} color={item.iconColor} />
          </View>

          <View
            style={[
              s.countBadge,
              empty ? s.countBadgeEmpty : { backgroundColor: item.deepColor },
            ]}
          >
            <Text style={[s.countBadgeText, empty && { color: C.textLight }]}>
              {item.count}
            </Text>
          </View>
        </View>

        {/* Emoji accent */}
        <Text style={s.cardEmoji}>{item.emoji}</Text>

        {/* Title + subtitle */}
        <Text style={[s.cardTitle, { color: item.deepColor }]}>
          {item.title}
        </Text>
        <Text style={s.cardSubtitle}>{item.subtitle}</Text>

        {/* Divider */}
        <View style={[s.cardDivider, { backgroundColor: item.colors[1] }]} />

        {/* Footer: status + arrow */}
        <View style={s.cardFooter}>
          <Text style={[s.openText, { color: item.textColor }]}>
            {empty ? "Nothing saved yet" : `View all ${item.count}`}
          </Text>
          <View style={[s.arrowCircle, { backgroundColor: item.deepColor }]}>
            <Ionicons name="arrow-forward" size={12} color={C.white} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main screen ───────────────────────────────────────────
export const ClientFavoritesScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useAppTranslation();
  const insets = useSafeAreaInsets();

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t("client.screenTitles.ClientFavorites"),
      headerTitleAlign: "center",
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ marginLeft: 8, padding: 4 }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={24} color="#1A1A2E" />
        </TouchableOpacity>
      ),
      headerRight: () => <View style={{ width: 40, marginRight: 8 }} />,
    });
  }, [navigation, t]);

  // ── State (unchanged) ────────────────────────────────────
  const [counts, setCounts] = useState<FavoriteCounts>({
    CATEGORY: 0,
    SERVICE: 0,
    PROVIDER: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadCounts = useCallback(async () => {
    const [categories, services, providers] = await Promise.all([
      api.getClientFavorites({ type: "CATEGORY" }),
      api.getClientFavorites({ type: "SERVICE" }),
      api.getClientFavorites({ type: "PROVIDER" }),
    ]);
    setCounts({
      CATEGORY: (categories.data?.items ?? []).length,
      SERVICE: (services.data?.items ?? []).length,
      PROVIDER: (providers.data?.items ?? []).length,
    });
  }, []);

  const load = useCallback(async () => {
    try {
      if (!refreshing) setLoading(true);
      await loadCounts();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadCounts, refreshing]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const cardRows = useMemo(
    () => CARD_CONFIG.map((card) => ({ ...card, count: counts[card.type] })),
    [counts],
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  // ── Loading ───────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.loaderWrap}>
        <View style={s.loaderBox}>
          <ActivityIndicator size="large" color={C.accent} />
          <Text style={s.loaderText}>Loading your favorites…</Text>
        </View>
      </View>
    );
  }

  // ── Screen ────────────────────────────────────────────────
  return (
    <View style={[s.root, { paddingTop: insets.top + 6 }]}>
      {/* ── Cards ── */}
      <FlatList
        data={cardRows}
        keyExtractor={(item) => item.type}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={C.accent}
          />
        }
        contentContainerStyle={s.cardsContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <FavoriteCard
            item={item}
            onPress={() =>
              navigation.navigate("ClientFavoritesList", { type: item.type })
            }
          />
        )}
        ListEmptyComponent={null}
      />
    </View>
  );
};

// ─── Styles ────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  loaderWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.bg,
  },
  loaderBox: {
    alignItems: "center",
    gap: 12,
  },
  loaderText: {
    fontSize: 14,
    color: C.textLight,
    fontWeight: "500",
  },

  // ── Card list ────────────────────────────────────────────
  cardsContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 32,
    gap: 8,
  },

  // ── Card ────────────────────────────────────────────────
  card: {
    borderRadius: 22,
    borderWidth: 1.5,
    overflow: "hidden",
    position: "relative",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 14,
      },
      android: { elevation: 2 },
    }),
  },
  cardCircle: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    top: -50,
    right: -36,
    opacity: 0.55,
  },
  cardInner: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 2,
    position: "relative",
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
      },
      android: { elevation: 1 },
    }),
  },
  countBadge: {
    minWidth: 28,
    height: 22,
    borderRadius: 8,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  countBadgeEmpty: {
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  countBadgeText: {
    color: C.white,
    fontSize: 12,
    fontWeight: "800",
  },
  cardEmoji: {
    fontSize: 20,
    marginBottom: 0,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    fontSize: 11,
    color: C.textSub,
    lineHeight: 14,
  },
  cardDivider: {
    height: 1,
    marginVertical: 6,
    opacity: 0.5,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  openText: {
    fontSize: 12,
    fontWeight: "700",
  },
  arrowCircle: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});
