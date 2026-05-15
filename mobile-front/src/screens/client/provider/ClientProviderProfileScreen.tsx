import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from "@react-navigation/native-stack";
import type { ClientStackParamList } from "../../../navigation/types";
import { useAuth } from "../../../context/AuthContext";
import { api } from "../../../services/api";

type Props = NativeStackScreenProps<
  ClientStackParamList,
  "ClientProviderProfile"
>;

type GivenServiceDetails = {
  givenServiceId: string;
  serviceName: string;
  categoryName: string;
  pricingType: string;
  price: number;
  estimatedDurationMinutes: number | null;
  description: string | null;
  whatIsIncluded: string | null;
  whatIsNotIncluded: string | null;
  toolsProvidedByProvider: boolean | null;
  clientMustProvide: string | null;
  averageRating: number;
  totalReviews: number;
  totalCompletedJobs: number;
  galleries: { id: string; imageUrl: string }[];
  bookingProviderId?: string | null;
  owner: {
    id?: string;
    /** User.id of the provider to message (independent: same as provider id; company: first linked provider). */
    userId: string | null;
    type?: "PROVIDER" | "COMPANY";
    displayName: string;
    photoUrl: string | null;
    tagline: string | null;
    bio: string | null;
    yearsOfExperience: number | null;
    languagesSpoken: string[];
    paymentMethodsAccepted: string[];
    isTopProvider?: boolean;
  };
};

export type ReviewItem = {
  id: string;
  rating: number;
  comment: string | null;
  providerReply: string | null;
  createdAt: string;
  client: {
    firstName: string;
    lastInitial: string;
    imageUrl: string | null;
  };
  givenServiceName: string;
};

type ReviewBreakdownRow = {
  star: number;
  count: number;
  percentage: number;
};

function mapApiToReviewItem(raw: unknown): ReviewItem | null {
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
  const lastTrim = lastName.trim();
  const lastInitial = lastTrim[0] ? `${lastTrim[0]}.` : "";

  const gs = r.givenService as Record<string, unknown> | undefined;
  const service = gs?.service as Record<string, unknown> | undefined;
  const translations = service?.translations as unknown[] | undefined;
  let givenServiceName = "Service";
  if (Array.isArray(translations) && translations[0]) {
    const t0 = translations[0] as Record<string, unknown>;
    if (typeof t0.name === "string" && t0.name.trim())
      givenServiceName = t0.name;
  }

  return {
    id,
    rating,
    comment,
    providerReply,
    createdAt,
    client: {
      firstName,
      lastInitial: lastInitial,
      imageUrl,
    },
    givenServiceName,
  };
}

function formatReviewDateShort(iso: string): string {
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

function formatAvgOne(v: number): string {
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

function ProfileAverageStars({ average }: { average: number }) {
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
    <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
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
          size={16}
          color={kind === "empty" ? "#D1D5DB" : "#C9A84C"}
        />
      ))}
    </View>
  );
}

function CompactBreakdownBars({ rows }: { rows: ReviewBreakdownRow[] }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 650,
      useNativeDriver: false,
    }).start();
  }, [rows, progress]);

  return (
    <View style={styles.reviewsBreakdownWrap}>
      {rows.map((row) => {
        const fillPct =
          typeof row.percentage === "number" && Number.isFinite(row.percentage)
            ? Math.min(100, Math.max(0, row.percentage))
            : 0;
        const barColor =
          row.star >= 4 ? "#C9A84C" : row.star === 3 ? "#F59E0B" : "#DC2626";
        const widthAnim = progress.interpolate({
          inputRange: [0, 1],
          outputRange: ["0%", `${fillPct}%`],
        });
        return (
          <View key={row.star} style={styles.reviewsBreakdownRow}>
            <Text style={styles.reviewsBreakdownStar}>{row.star}</Text>
            <Ionicons name="star" size={11} color="#C9A84C" style={{ marginRight: 4 }} />
            <View style={styles.reviewsBreakdownTrack}>
              <Animated.View
                style={[
                  styles.reviewsBreakdownFill,
                  { width: widthAnim, backgroundColor: barColor },
                ]}
              />
            </View>
            <Text style={styles.reviewsBreakdownCount}>{row.count}</Text>
          </View>
        );
      })}
    </View>
  );
}

function ClientReviewPreviewCard({ item }: { item: ReviewItem }) {
  const [expanded, setExpanded] = useState(false);
  const displayName =
    `${item.client.firstName} ${item.client.lastInitial}`.trim() || "Client";
  const li = item.client.lastInitial.replace(/\./g, "");
  const fi = item.client.firstName.trim()[0] ?? "";
  const initials = `${fi}${li[0] ?? ""}`.toUpperCase() || "?";

  const avatarColors =
    item.rating >= 5
      ? {
          bg: "#ECFDF5",
          border: "rgba(5,150,105,0.35)",
          text: "#059669",
        }
      : item.rating === 4
        ? {
            bg: "rgba(201,168,76,0.12)",
            border: "rgba(201,168,76,0.28)",
            text: "#B45309",
          }
        : { bg: "#F3F4F6", border: "#E5E7EB", text: "#6B7280" };

  const hasLong =
    (item.comment?.length ?? 0) > 120 ||
    (item.comment?.split("\n").length ?? 0) > 2;

  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        {item.client.imageUrl ? (
          <Image
            source={{ uri: item.client.imageUrl }}
            style={styles.reviewAvatarPhoto}
          />
        ) : (
          <View
            style={[
              styles.reviewAvatar,
              {
                backgroundColor: avatarColors.bg,
                borderColor: avatarColors.border,
              },
            ]}
          >
            <Text style={[styles.reviewAvatarText, { color: avatarColors.text }]}>
              {initials}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <View style={styles.reviewNameRow}>
            <Text style={styles.reviewName}>{displayName}</Text>
            <Text style={styles.reviewDateSmall}>
              {formatReviewDateShort(item.createdAt)}
            </Text>
          </View>
          <Stars count={item.rating} size={11} />
          <View style={styles.reviewServiceChip}>
            <Text style={styles.reviewServiceChipText} numberOfLines={1}>
              {item.givenServiceName}
            </Text>
          </View>
        </View>
      </View>
      {item.comment ? (
        <>
          <Text
            style={styles.reviewComment}
            numberOfLines={expanded ? undefined : 2}
          >
            {item.comment}
          </Text>
          {hasLong ? (
            <TouchableOpacity onPress={() => setExpanded((e) => !e)}>
              <Text style={styles.reviewReadMore}>
                {expanded ? "Show less" : "Read more"}
              </Text>
            </TouchableOpacity>
          ) : null}
        </>
      ) : null}
      {item.providerReply ? (
        <View style={styles.reviewProviderReply}>
          <Text style={styles.reviewProviderReplyText}>{item.providerReply}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ─── Design tokens ──────────────────────────────────────────
const C = {
  bg: "#0F1117",
  surface: "#1A1D27",
  surfaceLight: "#222535",
  card: "#FAFAF8",
  cardBorder: "#EDEDE8",
  gold: "#C9A84C",
  goldLight: "#E8C97A",
  goldPale: "rgba(201,168,76,0.12)",
  goldBorder: "rgba(201,168,76,0.28)",
  text: "#0F1117",
  textMuted: "#6B7280",
  textLight: "#9CA3AF",
  white: "#FFFFFF",
  ivory: "#FAFAF8",
  error: "#DC2626",
  success: "#059669",
  successBg: "#ECFDF5",
};

const HEADER_SCROLL_START = 36;
const HEADER_SCROLL_END = 96;

// ─── Star row ───────────────────────────────────────────────
function Stars({ count, size = 13 }: { count: number; size?: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= count ? "star" : "star-outline"}
          size={size}
          color={i <= count ? C.gold : "#D1D5DB"}
        />
      ))}
    </View>
  );
}

// ─── Stat pill ──────────────────────────────────────────────
function StatPill({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.statPill}>
      <View style={styles.statIconWrap}>
        <Ionicons name={icon} size={14} color={C.gold} />
      </View>
      <View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );
}

// ─── Section wrapper ────────────────────────────────────────
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionTitleRow}>
        <View style={styles.sectionTitleBar} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

// ─── Include / Exclude row ──────────────────────────────────
function BulletRow({
  text,
  type,
}: {
  text: string;
  type: "include" | "exclude";
}) {
  const color = type === "include" ? C.success : C.error;
  const icon = type === "include" ? "checkmark-circle" : "close-circle";
  return (
    <View style={styles.bulletRow}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

// ─── Main Screen ────────────────────────────────────────────
export const ClientProviderProfileScreen: React.FC<Props> = ({
  route,
}) => {
  const navigation =
    useNavigation<NativeStackNavigationProp<ClientStackParamList>>();
  const { user } = useAuth();
  const givenServiceId = route.params.givenServiceId;
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<GivenServiceDetails | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [openingChat, setOpeningChat] = useState(false);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [breakdown, setBreakdown] = useState<ReviewBreakdownRow[]>([]);
  const [totalReviews, setTotalReviews] = useState(0);
  const [averageRating, setAverageRating] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setReviews([]);
    setBreakdown([]);
    setTotalReviews(0);
    setAverageRating(0);

    void (async () => {
      try {
        const res = await api.getGivenServiceDetails(givenServiceId);
        if (cancelled) return;
        const d = res.data as GivenServiceDetails;
        setData(d);

        const pid =
          d.bookingProviderId ??
          (d.owner.type === "COMPANY" ? null : d.owner.id ?? null);
        if (pid) {
          setReviewsLoading(true);
          try {
            const [revRes, brRes] = await Promise.all([
              api.getProviderReviews(pid, { take: 5, sort: "recent" }),
              api.getProviderReviewsBreakdown(pid),
            ]);
            if (cancelled) return;
            const rawItems = Array.isArray(revRes.data?.items)
              ? revRes.data.items
              : [];
            const mapped: ReviewItem[] = [];
            for (const raw of rawItems) {
              const it = mapApiToReviewItem(raw);
              if (it) mapped.push(it);
            }
            setReviews(mapped);
            setTotalReviews(
              typeof revRes.data?.total === "number" ? revRes.data.total : 0,
            );
            setAverageRating(
              typeof revRes.data?.averageRating === "number"
                ? revRes.data.averageRating
                : 0,
            );
            const br = Array.isArray(brRes.data) ? brRes.data : [];
            setBreakdown(
              br
                .filter(
                  (x: unknown): x is ReviewBreakdownRow =>
                    !!x &&
                    typeof x === "object" &&
                    typeof (x as ReviewBreakdownRow).star === "number",
                )
                .sort((a, b) => b.star - a.star),
            );
          } catch {
            if (!cancelled) {
              setReviews([]);
              setBreakdown([]);
              setTotalReviews(0);
              setAverageRating(0);
            }
          } finally {
            if (!cancelled) setReviewsLoading(false);
          }
        } else if (!cancelled) {
          setReviewsLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError("Could not load provider profile.");
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [givenServiceId]);

  const ownerId = data?.owner?.id;

  useEffect(() => {
    if (!ownerId) {
      setIsFavorite(false);
      return;
    }
    let cancelled = false;
    setFavoriteLoading(true);
    void api
      .getClientFavorites({ type: "PROVIDER" })
      .then((res) => {
        if (cancelled) return;
        const items = (res.data?.items ?? []) as Array<{ targetId: string }>;
        setIsFavorite(items.some((item) => item.targetId === ownerId));
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
  }, [ownerId]);

  const toggleFavorite = async () => {
    if (!ownerId || favoriteLoading) return;
    setFavoriteLoading(true);
    try {
      if (isFavorite) {
        await api.deleteClientFavorite("PROVIDER", ownerId);
        setIsFavorite(false);
      } else {
        await api.createClientFavorite({ type: "PROVIDER", targetId: ownerId });
        setIsFavorite(true);
      }
    } finally {
      setFavoriteLoading(false);
    }
  };

  const openChatWithProvider = React.useCallback(async () => {
    if (!data) return;
    const providerUserId = data.owner.userId;
    if (!providerUserId) {
      Alert.alert(
        "Messaging unavailable",
        "No provider account is linked for messaging yet.",
      );
      return;
    }
    if (user?.id && providerUserId === user.id) return;

    setOpeningChat(true);
    try {
      const res = await api.openOrCreateConversation({
        counterpartId: providerUserId,
      });
      const conversationId = (res.data as { id: string }).id;
      navigation.navigate("ChatScreen", {
        conversationId,
        otherUserName: data.owner.displayName,
        otherUserPhoto: data.owner.photoUrl ?? null,
      });
    } catch (e) {
      Alert.alert(
        "Could not open conversation",
        e instanceof Error ? e.message : "Please try again.",
      );
    } finally {
      setOpeningChat(false);
    }
  }, [data, navigation, user?.id]);

  const gallery = data?.galleries ?? [];

  // Animated header on scroll (light toolbar)
  const headerBg = scrollY.interpolate({
    inputRange: [HEADER_SCROLL_START, HEADER_SCROLL_END],
    outputRange: ["rgba(249,250,251,0)", "rgba(249,250,251,0.97)"],
    extrapolate: "clamp",
  });
  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [HEADER_SCROLL_START + 8, HEADER_SCROLL_END],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  // ── Loading ──
  if (loading) {
    return (
      <SafeAreaView style={styles.loadingRoot} edges={["top", "bottom"]}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="large" color={C.gold} />
        <Text style={styles.loadingText}>Loading profile…</Text>
      </SafeAreaView>
    );
  }

  // ── Error ──
  if (error || !data) {
    return (
      <SafeAreaView style={styles.loadingRoot} edges={["top", "bottom"]}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.errorIconWrap}>
          <Ionicons
            name="cloud-offline-outline"
            size={32}
            color={C.textMuted}
          />
        </View>
        <Text style={styles.errorText}>{error ?? "No data found"}</Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.goBackBtn}
        >
          <Text style={styles.goBackBtnText}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const providerUserId = data.owner.userId;
  const canOpenChat = !!providerUserId && (!user?.id || providerUserId !== user.id);

  const rating = data.averageRating.toFixed(1);
  const priceLabel =
    data.pricingType === "HOURLY"
      ? `${data.price} / hr`
      : `${data.price} fixed`;

  const providerIdForBooking =
    data.bookingProviderId ??
    (data.owner.type === "COMPANY" ? null : data.owner.id ?? null);

  const includedItems = data.whatIsIncluded
    ? data.whatIsIncluded
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const excludedItems = data.whatIsNotIncluded
    ? data.whatIsNotIncluded
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />

      {/* ── Floating animated header ── */}
      <Animated.View
        style={[
          styles.floatingHeader,
          { paddingTop: insets.top, backgroundColor: headerBg },
        ]}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          style={styles.backBtnLight}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Animated.Text
          style={[
            styles.floatingHeaderTitleLight,
            { opacity: headerTitleOpacity },
          ]}
          numberOfLines={1}
        >
          {data.owner.displayName}
        </Animated.Text>
        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={[
              styles.headerGlassBtn,
              (!canOpenChat || openingChat) && { opacity: 0.45 },
            ]}
            onPress={() => void openChatWithProvider()}
            disabled={!canOpenChat || openingChat}
            activeOpacity={0.8}
            accessibilityLabel="Message provider"
          >
            {openingChat ? (
              <ActivityIndicator size="small" color={C.text} />
            ) : (
              <Ionicons
                name="chatbubble-outline"
                size={20}
                color={C.text}
              />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.headerFavoriteBtn,
              isFavorite && styles.headerFavoriteBtnActive,
              !ownerId && { opacity: 0.5 },
            ]}
            onPress={() => {
              void toggleFavorite();
            }}
            disabled={!ownerId || favoriteLoading}
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
                size={18}
                color={isFavorite ? "#FFFFFF" : "#EF4444"}
              />
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>

      <Animated.ScrollView
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 120,
          paddingTop: insets.top + 8,
        }}
      >
        {/* ── Main content card ── */}
        <View style={styles.contentCard}>
          {/* Owner identity block */}
          <View style={styles.identityBlock}>
            <View style={styles.avatarWrapper}>
              {data.owner.photoUrl ? (
                <Image
                  source={{ uri: data.owner.photoUrl }}
                  style={styles.avatar}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={32} color={C.gold} />
                </View>
              )}
              {/* Gold ring */}
              <View style={styles.avatarRing} />
            </View>

            <View style={styles.identityText}>
              <View style={styles.categoryBadgeInline}>
                <Text style={styles.categoryBadgeInlineText}>
                  {data.categoryName}
                </Text>
              </View>
              <Text style={styles.ownerName}>{data.owner.displayName}</Text>
              {data.owner.tagline ? (
                <Text style={styles.ownerTagline}>{data.owner.tagline}</Text>
              ) : null}

              {/* Rating inline */}
              <View style={styles.ratingRow}>
                <Stars count={Math.round(data.averageRating)} />
                <Text style={styles.ratingNum}>{rating}</Text>
                <Text style={styles.ratingMeta}>
                  ({data.totalReviews} reviews)
                </Text>
              </View>
            </View>
          </View>

          {data.owner.isTopProvider ? (
            <View style={styles.topProviderBadge}>
              <Ionicons name="ribbon" size={13} color={C.gold} />
              <Text style={styles.topProviderText}>Top Provider</Text>
            </View>
          ) : null}

          {/* Stats row */}
          <View style={styles.statsRow}>
            <StatPill
              icon="briefcase-outline"
              label="Jobs done"
              value={String(data.totalCompletedJobs)}
            />
            <View style={styles.statDivider} />
            <StatPill
              icon="time-outline"
              label="Duration"
              value={
                data.estimatedDurationMinutes
                  ? `${data.estimatedDurationMinutes} min`
                  : "—"
              }
            />
            <View style={styles.statDivider} />
            <StatPill
              icon="school-outline"
              label="Experience"
              value={
                data.owner.yearsOfExperience
                  ? `${data.owner.yearsOfExperience} yrs`
                  : "—"
              }
            />
          </View>

          {/* Price block */}
          <View style={styles.priceBlock}>
            <View>
              <Text style={styles.priceLabel}>Service price</Text>
              <Text style={styles.priceValue}>{priceLabel}</Text>
            </View>
            <View style={styles.pricingTypeBadge}>
              <Text style={styles.pricingTypeText}>{data.pricingType}</Text>
            </View>
          </View>

          {/* ── Bio ── */}
          {data.owner.bio ? (
            <Section title="About">
              <Text style={styles.bodyText}>{data.owner.bio}</Text>
            </Section>
          ) : null}

          {/* ── Languages ── */}
          {(data.owner.languagesSpoken ?? []).length > 0 && (
            <Section title="Languages">
              <View style={styles.chipRow}>
                {data.owner.languagesSpoken.map((lang) => (
                  <View key={lang} style={styles.langChip}>
                    <Text style={styles.langChipText}>{lang}</Text>
                  </View>
                ))}
              </View>
            </Section>
          )}

          {/* ── What's included ── */}
          {includedItems.length > 0 && (
            <Section title="What's included">
              {includedItems.map((item, i) => (
                <BulletRow key={i} text={item} type="include" />
              ))}
            </Section>
          )}

          {/* ── What's not included ── */}
          {excludedItems.length > 0 && (
            <Section title="What's not included">
              {excludedItems.map((item, i) => (
                <BulletRow key={i} text={item} type="exclude" />
              ))}
            </Section>
          )}

          {/* ── Service info ── */}
          <Section title="Service details">
            <View style={styles.detailGrid}>
              {data.toolsProvidedByProvider !== null && (
                <View style={styles.detailRow}>
                  <Ionicons
                    name="construct-outline"
                    size={15}
                    color={C.textMuted}
                  />
                  <Text style={styles.detailText}>
                    Tools{" "}
                    {data.toolsProvidedByProvider
                      ? "provided by provider"
                      : "not included"}
                  </Text>
                </View>
              )}
              {data.clientMustProvide ? (
                <View style={styles.detailRow}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={15}
                    color={C.textMuted}
                  />
                  <Text style={styles.detailText}>
                    Client must provide: {data.clientMustProvide}
                  </Text>
                </View>
              ) : null}
            </View>
          </Section>

          {/* ── Payment methods ── */}
          {(data.owner.paymentMethodsAccepted ?? []).length > 0 && (
            <Section title="Payment accepted">
              <View style={styles.chipRow}>
                {data.owner.paymentMethodsAccepted.map((p) => (
                  <View key={p} style={styles.payChip}>
                    <Ionicons name="card-outline" size={12} color={C.gold} />
                    <Text style={styles.payChipText}>{p}</Text>
                  </View>
                ))}
              </View>
            </Section>
          )}

          {/* ── Gallery ── */}
          {gallery.length > 0 && (
            <Section title="Gallery">
              <FlatList
                data={gallery}
                keyExtractor={(g) => g.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10 }}
                renderItem={({ item, index }) => (
                  <View
                    style={[
                      styles.galleryItem,
                      index === 0 && { width: 200, height: 140 },
                    ]}
                  >
                    <Image
                      source={{ uri: item.imageUrl }}
                      style={styles.galleryImage}
                      resizeMode="cover"
                    />
                  </View>
                )}
              />
            </Section>
          )}

          {/* ── Reviews ── */}
          <Section title="Recent reviews">
            {!providerIdForBooking ? (
              <Text style={styles.bodyText}>
                Reviews are not available for this listing.
              </Text>
            ) : reviewsLoading ? (
              <ActivityIndicator
                size="small"
                color={C.gold}
                style={{ alignSelf: "flex-start", marginVertical: 8 }}
              />
            ) : (
              <>
                <View style={styles.reviewsSummaryRow}>
                  <Text style={styles.reviewsAvgBig}>
                    {formatAvgOne(
                      totalReviews > 0 ? averageRating : data.averageRating,
                    )}
                  </Text>
                  <View style={styles.reviewsSummaryMid}>
                    <ProfileAverageStars
                      average={
                        totalReviews > 0 ? averageRating : data.averageRating
                      }
                    />
                    <Text style={styles.reviewsCountMeta}>
                      (
                      {totalReviews > 0 ? totalReviews : data.totalReviews}{" "}
                      reviews)
                    </Text>
                  </View>
                  {data.owner.isTopProvider ? (
                    <View style={styles.reviewsTopBadgeInline}>
                      <Text style={styles.reviewsTopBadgeEmoji}>🏅</Text>
                      <Text style={styles.reviewsTopBadgeTxt}>Top Provider</Text>
                    </View>
                  ) : null}
                </View>
                {breakdown.length > 0 ? (
                  <CompactBreakdownBars rows={breakdown} />
                ) : null}
                <View style={{ gap: 10, marginTop: 10 }}>
                  {reviews.map((r) => (
                    <ClientReviewPreviewCard key={r.id} item={r} />
                  ))}
                </View>
                {totalReviews > 5 && providerIdForBooking ? (
                  <TouchableOpacity
                    style={styles.reviewsSeeAllBtn}
                    activeOpacity={0.88}
                    onPress={() =>
                      navigation.navigate("PublicProviderReviews", {
                        providerId: providerIdForBooking,
                        providerName: data.owner.displayName,
                        isTopProvider: data.owner.isTopProvider === true,
                      })
                    }
                  >
                    <Text style={styles.reviewsSeeAllTxt}>
                      {`See all ${totalReviews} reviews`}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={C.gold} />
                  </TouchableOpacity>
                ) : null}
              </>
            )}
          </Section>
        </View>
      </Animated.ScrollView>

      {/* ── Fixed bottom CTA ── */}
      <View style={[styles.ctaBar, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.ctaBarInner}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.ctaPriceLabel}>Starting from</Text>
            <Text style={styles.ctaPrice}>{priceLabel}</Text>
          </View>
          <View style={styles.ctaActionsRow}>
            <TouchableOpacity
              style={[
                styles.ctaMessageBtn,
                (!canOpenChat || openingChat) && styles.ctaMessageBtnDisabled,
              ]}
              onPress={() => void openChatWithProvider()}
              disabled={!canOpenChat || openingChat}
              activeOpacity={0.88}
            >
              {openingChat ? (
                <ActivityIndicator size="small" color={C.gold} />
              ) : (
                <Ionicons name="chatbubble-outline" size={18} color={C.gold} />
              )}
              <Text style={styles.ctaMessageBtnText}>Message</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.ctaBtn,
                !providerIdForBooking && styles.ctaBtnDisabled,
              ]}
              activeOpacity={0.88}
              disabled={!providerIdForBooking}
              onPress={() => {
                if (!providerIdForBooking) {
                  Alert.alert(
                    "Booking unavailable",
                    "No provider is linked to this listing yet. Try another offer or check back later.",
                  );
                  return;
                }
                navigation.navigate("ClientSlotPicker", {
                  providerId: providerIdForBooking,
                  givenServiceId: data.givenServiceId,
                  providerName: data.owner.displayName,
                  serviceName: data.serviceName,
                  estimatedDurationMinutes:
                    data.estimatedDurationMinutes ?? 60,
                });
              }}
            >
              <Text style={styles.ctaBtnText}>Book this service</Text>
              <Ionicons name="arrow-forward" size={16} color={C.bg} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
};

// ─── Styles ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F9FAFB" },

  // Loading / error states
  loadingRoot: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: { color: C.textMuted, fontSize: 14, fontWeight: "500" },
  errorIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: { color: C.error, fontWeight: "700", fontSize: 14 },
  goBackBtn: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  goBackBtnText: { color: C.text, fontWeight: "700" },

  // Floating header
  floatingHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    zIndex: 100,
  },
  backBtnLight: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  floatingHeaderTitleLight: {
    fontSize: 16,
    fontWeight: "800",
    color: C.text,
    flex: 1,
    textAlign: "center",
  },
  headerFavoriteBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFF1F2",
    borderWidth: 1.2,
    borderColor: "#FECACA",
    alignItems: "center",
    justifyContent: "center",
  },
  headerFavoriteBtnActive: {
    backgroundColor: "#EF4444",
    borderColor: "#EF4444",
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerGlassBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  categoryBadgeInline: {
    alignSelf: "flex-start",
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 6,
    backgroundColor: C.goldPale,
    borderWidth: 1,
    borderColor: C.goldBorder,
  },
  categoryBadgeInlineText: {
    fontSize: 11,
    fontWeight: "700",
    color: C.gold,
    letterSpacing: 0.4,
  },

  // Main content card
  contentCard: {
    backgroundColor: C.ivory,
    borderRadius: 28,
    marginHorizontal: 16,
    marginTop: 4,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 20,
    gap: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: { elevation: 3 },
    }),
  },

  // Identity
  identityBlock: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 14,
    marginTop: 0,
  },
  avatarWrapper: {
    position: "relative",
    width: 84,
    height: 84,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 22,
  },
  avatarPlaceholder: {
    width: 84,
    height: 84,
    borderRadius: 22,
    backgroundColor: C.goldPale,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.goldBorder,
  },
  avatarRing: {
    position: "absolute",
    inset: -3,
    width: 90,
    height: 90,
    borderRadius: 25,
    borderWidth: 3,
    borderColor: C.gold,
    top: -3,
    left: -3,
  },
  identityText: { flex: 1, paddingBottom: 4, gap: 3 },
  ownerName: {
    fontSize: 20,
    fontWeight: "800",
    color: C.text,
    letterSpacing: -0.4,
  },
  ownerTagline: {
    fontSize: 12,
    color: C.textMuted,
    lineHeight: 16,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  ratingNum: {
    fontSize: 13,
    fontWeight: "800",
    color: C.text,
  },
  ratingMeta: {
    fontSize: 12,
    color: C.textMuted,
  },

  // Top provider badge
  topProviderBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: C.goldPale,
    borderWidth: 1,
    borderColor: C.goldBorder,
  },
  topProviderText: {
    fontSize: 11,
    fontWeight: "800",
    color: C.gold,
    letterSpacing: 0.3,
  },

  // Stats
  statsRow: {
    flexDirection: "row",
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 14,
    alignItems: "center",
    justifyContent: "space-between",
  },
  statPill: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  statIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: C.goldPale,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.goldBorder,
  },
  statValue: { fontSize: 14, fontWeight: "800", color: C.text },
  statLabel: { fontSize: 10, color: C.textMuted, marginTop: 1 },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: C.cardBorder,
    marginHorizontal: 6,
  },

  // Price
  priceBlock: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  priceLabel: {
    fontSize: 11,
    color: C.textMuted,
    marginBottom: 3,
    fontWeight: "600",
  },
  priceValue: {
    fontSize: 24,
    fontWeight: "800",
    color: C.gold,
    letterSpacing: -0.5,
  },
  pricingTypeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: C.goldPale,
    borderWidth: 1,
    borderColor: C.goldBorder,
  },
  pricingTypeText: { fontSize: 11, fontWeight: "800", color: C.gold },

  // Section
  section: {
    gap: 10,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: C.cardBorder,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitleBar: {
    width: 3,
    height: 14,
    borderRadius: 2,
    backgroundColor: C.gold,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: C.text,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  bodyText: {
    fontSize: 14,
    color: C.textMuted,
    lineHeight: 21,
  },

  // Bullets
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  bulletText: {
    flex: 1,
    fontSize: 13,
    color: C.text,
    lineHeight: 19,
  },

  // Chips
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  langChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  langChipText: { fontSize: 12, fontWeight: "700", color: C.text },
  payChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: C.goldPale,
    borderWidth: 1,
    borderColor: C.goldBorder,
  },
  payChipText: { fontSize: 12, fontWeight: "700", color: C.gold },

  // Detail grid
  detailGrid: { gap: 8 },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  detailText: {
    flex: 1,
    fontSize: 13,
    color: C.textMuted,
    lineHeight: 19,
  },

  // Gallery
  galleryItem: {
    width: 140,
    height: 110,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: C.cardBorder,
  },
  galleryImage: { width: "100%", height: "100%" },

  // Reviews
  reviewCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 12,
    gap: 8,
  },
  reviewHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  reviewAvatar: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: C.goldPale,
    borderWidth: 1,
    borderColor: C.goldBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewAvatarText: { fontSize: 12, fontWeight: "800", color: C.gold },
  reviewName: {
    fontSize: 13,
    fontWeight: "800",
    color: C.text,
    marginBottom: 3,
  },
  reviewComment: { fontSize: 13, color: C.textMuted, lineHeight: 18 },
  reviewsSummaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  reviewsAvgBig: {
    fontSize: 32,
    fontWeight: "800",
    color: C.text,
    minWidth: 48,
  },
  reviewsSummaryMid: { flex: 1, minWidth: 140, gap: 4 },
  reviewsCountMeta: {
    fontSize: 12,
    fontWeight: "700",
    color: C.textMuted,
  },
  reviewsTopBadgeInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: C.goldPale,
    borderWidth: 1,
    borderColor: C.goldBorder,
  },
  reviewsTopBadgeEmoji: { fontSize: 12 },
  reviewsTopBadgeTxt: {
    fontSize: 11,
    fontWeight: "800",
    color: C.gold,
  },
  reviewsBreakdownWrap: { gap: 4, marginTop: 8, marginBottom: 4 },
  reviewsBreakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  reviewsBreakdownStar: {
    width: 12,
    fontSize: 11,
    fontWeight: "800",
    color: C.text,
  },
  reviewsBreakdownTrack: {
    flex: 1,
    height: 5,
    borderRadius: 4,
    backgroundColor: "#EEF0F4",
    overflow: "hidden",
  },
  reviewsBreakdownFill: {
    height: "100%",
    borderRadius: 4,
  },
  reviewsBreakdownCount: {
    width: 28,
    textAlign: "right",
    fontSize: 11,
    fontWeight: "700",
    color: C.textMuted,
  },
  reviewsSeeAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.goldBorder,
    backgroundColor: C.goldPale,
  },
  reviewsSeeAllTxt: {
    fontSize: 14,
    fontWeight: "800",
    color: C.gold,
  },
  reviewNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 2,
  },
  reviewDateSmall: {
    fontSize: 11,
    color: C.textLight,
    fontWeight: "600",
  },
  reviewServiceChip: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: C.goldPale,
    borderWidth: 1,
    borderColor: C.goldBorder,
    maxWidth: "100%",
  },
  reviewServiceChipText: {
    fontSize: 11,
    fontWeight: "800",
    color: C.gold,
  },
  reviewReadMore: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "800",
    color: C.gold,
  },
  reviewAvatarPhoto: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: C.cardBorder,
  },
  reviewProviderReply: {
    marginTop: 8,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: C.cardBorder,
  },
  reviewProviderReplyText: {
    fontSize: 12,
    color: C.textLight,
    lineHeight: 17,
  },

  // CTA bar
  ctaBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.ivory,
    borderTopWidth: 1,
    borderTopColor: C.cardBorder,
    paddingTop: 14,
    paddingHorizontal: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: { elevation: 10 },
    }),
  },
  ctaBarInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  ctaActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 0,
  },
  ctaMessageBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: C.gold,
  },
  ctaMessageBtnDisabled: {
    opacity: 0.5,
    borderColor: "#D1D5DB",
  },
  ctaMessageBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: C.gold,
  },
  ctaPriceLabel: { fontSize: 11, color: C.textMuted, fontWeight: "600" },
  ctaPrice: { fontSize: 18, fontWeight: "800", color: C.text, marginTop: 1 },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.gold,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: C.gold,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      android: { elevation: 6 },
    }),
  },
  ctaBtnDisabled: {
    backgroundColor: "#D1D5DB",
    opacity: 0.85,
    ...Platform.select({
      ios: {
        shadowOpacity: 0,
        shadowRadius: 0,
      },
      android: { elevation: 0 },
    }),
  },
  ctaBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: C.bg,
    letterSpacing: 0.2,
  },
});
