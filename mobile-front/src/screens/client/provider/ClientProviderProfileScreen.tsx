import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
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
  /** Set when the offering is from a company employee (routes booking to company admin). */
  bookingCompanyId?: string | null;
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
    city?: string | null;
    address?: string | null;
    cancellationRate?: number;
    averageResponseTime?: number | null;
    totalComplaints?: number;
  };
};

function formatCancellationRate(rate: number): string {
  return `${Number(rate).toFixed(1)}%`;
}

function formatResponseTime(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) {
    return "—";
  }
  const rounded = Math.max(0, Math.round(minutes));
  if (rounded < 60) return `${rounded} min`;
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function cancellationTone(rate: number): "good" | "warn" | "bad" {
  if (rate <= 5) return "good";
  if (rate <= 12) return "warn";
  return "bad";
}

function responseTone(minutes: number | null | undefined): "good" | "warn" | "bad" | "neutral" {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) {
    return "neutral";
  }
  if (minutes <= 60) return "good";
  if (minutes <= 120) return "warn";
  return "bad";
}

function complaintsTone(count: number): "good" | "warn" | "bad" {
  if (count <= 0) return "good";
  if (count <= 2) return "warn";
  return "bad";
}

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
    r.comment === null || r.comment === undefined ? null : String(r.comment);
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
  const firstName = typeof user?.firstName === "string" ? user.firstName : "";
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
          color={kind === "empty" ? "#D1D5DB" : C.star}
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
          row.star >= 4 ? C.accent : row.star === 3 ? "#F59E0B" : "#DC2626";
        const widthAnim = progress.interpolate({
          inputRange: [0, 1],
          outputRange: ["0%", `${fillPct}%`],
        });
        return (
          <View key={row.star} style={styles.reviewsBreakdownRow}>
            <Text style={styles.reviewsBreakdownStar}>{row.star}</Text>
            <Ionicons
              name="star"
              size={11}
              color={C.star}
              style={{ marginRight: 4 }}
            />
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
            bg: C.accentPale,
            border: C.accentBorder,
            text: C.accent,
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
            <Text
              style={[styles.reviewAvatarText, { color: avatarColors.text }]}
            >
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
          <Text style={styles.reviewProviderReplyText}>
            {item.providerReply}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// ─── Design tokens (aligned with ClientSearchProviderScreen violet theme) ───
const C = {
  screenBg: "#F4F3FA",
  accent: "#7C5CFC",
  accentPale: "#EDE9FE",
  accentBorder: "#C4B5FD",
  /** Filled stars stay warm for readability (matches search result cards). */
  star: "#F59E0B",
  card: "#FFFFFF",
  cardBorder: "#EBEBF5",
  text: "#1A1A2E",
  textMuted: "#9B9BB0",
  textLight: "#9CA3AF",
  white: "#FFFFFF",
  ivory: "#FFFFFF",
  /** Top Provider badge (same family as search chips). */
  topAmberBg: "rgba(255,251,235,0.95)",
  topAmberBorder: "#FDE68A",
  topAmberText: "#B45309",
  error: "#DC2626",
  success: "#059669",
  successBg: "#ECFDF5",
};

const HEADER_SCROLL_START = 36;
const HEADER_SCROLL_END = 96;

const GALLERY_CAROUSEL_GAP = 12;

// ─── Star row ───────────────────────────────────────────────
function Stars({ count, size = 13 }: { count: number; size?: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= count ? "star" : "star-outline"}
          size={size}
          color={i <= count ? C.star : "#D1D5DB"}
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
        <Ionicons name={icon} size={14} color={C.accent} />
      </View>
      <View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );
}

function TrustMetricCard({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  hint: string;
  tone: "good" | "warn" | "bad" | "neutral";
}) {
  const toneStyles =
    tone === "good"
      ? trustMetricToneStyles.good
      : tone === "warn"
        ? trustMetricToneStyles.warn
        : tone === "bad"
          ? trustMetricToneStyles.bad
          : trustMetricToneStyles.neutral;

  return (
    <View style={[styles.trustMetricCard, toneStyles.card]}>
      <View style={[styles.trustMetricIconWrap, toneStyles.iconWrap]}>
        <Ionicons name={icon} size={16} color={toneStyles.iconColor} />
      </View>
      <Text style={[styles.trustMetricValue, toneStyles.value]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.trustMetricLabel} numberOfLines={2}>
        {label}
      </Text>
      <Text style={[styles.trustMetricHint, toneStyles.hint]} numberOfLines={2}>
        {hint}
      </Text>
    </View>
  );
}

const trustMetricToneStyles = {
  good: {
    card: { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" },
    iconWrap: { backgroundColor: "#FFFFFF", borderColor: "#86EFAC" },
    iconColor: "#059669",
    value: { color: "#065F46" },
    hint: { color: "#047857" },
  },
  warn: {
    card: { backgroundColor: "#FFFBEB", borderColor: "#FDE68A" },
    iconWrap: { backgroundColor: "#FFFFFF", borderColor: "#FCD34D" },
    iconColor: "#B45309",
    value: { color: "#92400E" },
    hint: { color: "#A16207" },
  },
  bad: {
    card: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
    iconWrap: { backgroundColor: "#FFFFFF", borderColor: "#FCA5A5" },
    iconColor: "#DC2626",
    value: { color: "#991B1B" },
    hint: { color: "#B91C1C" },
  },
  neutral: {
    card: { backgroundColor: C.accentPale, borderColor: C.accentBorder },
    iconWrap: { backgroundColor: C.white, borderColor: C.accentBorder },
    iconColor: C.accent,
    value: { color: C.text },
    hint: { color: C.textMuted },
  },
} as const;

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
export const ClientProviderProfileScreen: React.FC<Props> = ({ route }) => {
  const navigation =
    useNavigation<NativeStackNavigationProp<ClientStackParamList>>();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { user } = useAuth();
  const givenServiceId = route.params.givenServiceId;
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
  const galleryLightboxRef = useRef<FlatList>(null);

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
  const [galleryCarouselIndex, setGalleryCarouselIndex] = useState(0);
  const [galleryLightboxOpen, setGalleryLightboxOpen] = useState(false);
  const [galleryLightboxIndex, setGalleryLightboxIndex] = useState(0);

  /** Card horizontal inset: ScrollView margins (16×2) + contentCard padding (20×2). */
  const galleryCarouselLayout = useMemo(() => {
    const cardInset = 16 * 2 + 20 * 2;
    const slideW = Math.max(220, windowWidth - cardInset);
    const slideH = Math.round(slideW * 0.54);
    const snapInterval = slideW + GALLERY_CAROUSEL_GAP;
    return { slideW, slideH, snapInterval };
  }, [windowWidth]);

  useEffect(() => {
    if (!galleryLightboxOpen) return;
    const len = data?.galleries?.length ?? 0;
    if (len === 0) return;
    const idx = Math.min(Math.max(0, galleryLightboxIndex), len - 1);
    const id = setTimeout(() => {
      try {
        galleryLightboxRef.current?.scrollToIndex({
          index: idx,
          animated: false,
        });
      } catch {
        /* layout not ready */
      }
    }, 32);
    return () => clearTimeout(id);
    // Intentionally only when the modal opens — do not re-scroll when the user swipes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- galleryLightboxIndex read from the opening render only
  }, [galleryLightboxOpen, data?.galleries?.length]);

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
        setGalleryCarouselIndex(0);

        const pid =
          d.bookingProviderId ??
          (d.owner.type === "COMPANY" ? null : (d.owner.id ?? null));
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

  useFocusEffect(
    useCallback(() => {
      if (loading) return;
      let cancelled = false;
      void api
        .getGivenServiceDetails(givenServiceId)
        .then((res) => {
          if (!cancelled) setData(res.data as GivenServiceDetails);
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [givenServiceId, loading]),
  );

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
    outputRange: ["rgba(244,243,250,0)", "rgba(244,243,250,0.97)"],
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
        <ActivityIndicator size="large" color={C.accent} />
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
  const canOpenChat =
    !!providerUserId && (!user?.id || providerUserId !== user.id);

  const rating = data.averageRating.toFixed(1);
  const priceLabel =
    data.pricingType === "HOURLY"
      ? `${data.price} / hr`
      : `${data.price} fixed`;

  const providerIdForBooking =
    data.bookingProviderId ??
    (data.owner.type === "COMPANY" ? null : (data.owner.id ?? null));

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
              <ActivityIndicator size="small" color={C.accent} />
            ) : (
              <Ionicons name="chatbubble-outline" size={20} color={C.accent} />
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
                  <Ionicons name="person" size={32} color={C.accent} />
                </View>
              )}
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

          {data.owner.city?.trim() || data.owner.address?.trim() ? (
            <View style={styles.locationCard}>
              <View style={styles.locationIconWrap}>
                <Ionicons name="location" size={16} color={C.accent} />
              </View>
              <View style={styles.locationTextCol}>
                {data.owner.city?.trim() ? (
                  <Text style={styles.locationCity} numberOfLines={1}>
                    {data.owner.city.trim()}
                  </Text>
                ) : null}
                {data.owner.address?.trim() ? (
                  <Text style={styles.locationAddress} numberOfLines={2}>
                    {data.owner.address.trim()}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}

          {data.owner.isTopProvider ? (
            <View style={styles.topProviderBadge}>
              <Ionicons name="ribbon" size={13} color={C.topAmberText} />
              <Text style={styles.topProviderText}>Top Provider</Text>
            </View>
          ) : null}

          <View style={styles.trustMetricsSection}>
            <View style={styles.trustMetricsHeader}>
              <Text style={styles.trustMetricsTitle}>Reliability</Text>
              <Text style={styles.trustMetricsSubtitle}>
                Based on booking history
              </Text>
            </View>
            <View
              style={[
                styles.trustMetricsGrid,
                data.owner.type === "COMPANY" && styles.trustMetricsGridTwo,
              ]}
            >
              <TrustMetricCard
                icon="close-circle-outline"
                label="Cancellation rate"
                value={formatCancellationRate(data.owner.cancellationRate ?? 0)}
                hint={
                  (data.owner.cancellationRate ?? 0) <= 5
                    ? "Very reliable"
                    : (data.owner.cancellationRate ?? 0) <= 12
                      ? "Acceptable"
                      : "Higher than average"
                }
                tone={cancellationTone(data.owner.cancellationRate ?? 0)}
              />
              <TrustMetricCard
                icon="timer-outline"
                label="Avg response"
                value={formatResponseTime(data.owner.averageResponseTime)}
                hint={
                  data.owner.averageResponseTime == null
                    ? "No data yet"
                    : (data.owner.averageResponseTime ?? 0) <= 60
                      ? "Fast replies"
                      : (data.owner.averageResponseTime ?? 0) <= 120
                        ? "Moderate speed"
                        : "Slower responses"
                }
                tone={responseTone(data.owner.averageResponseTime)}
              />
              {data.owner.type !== "COMPANY" ? (
                <TrustMetricCard
                  icon="alert-circle-outline"
                  label="Complaints"
                  value={String(data.owner.totalComplaints ?? 0)}
                  hint={
                    (data.owner.totalComplaints ?? 0) <= 0
                      ? "No complaints"
                      : (data.owner.totalComplaints ?? 0) <= 2
                        ? "Few reports"
                        : "Review carefully"
                  }
                  tone={complaintsTone(data.owner.totalComplaints ?? 0)}
                />
              ) : null}
            </View>
          </View>

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
                    <Ionicons name="card-outline" size={12} color={C.accent} />
                    <Text style={styles.payChipText}>{p}</Text>
                  </View>
                ))}
              </View>
            </Section>
          )}

          {/* ── Gallery ── */}
          {gallery.length > 0 && (
            <Section title="Gallery">
              <View>
                <FlatList
                  data={gallery}
                  keyExtractor={(g) => g.id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  decelerationRate="fast"
                  snapToInterval={galleryCarouselLayout.snapInterval}
                  snapToAlignment="start"
                  disableIntervalMomentum
                  ItemSeparatorComponent={() => (
                    <View style={{ width: GALLERY_CAROUSEL_GAP }} />
                  )}
                  renderItem={({ item, index }) => (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Gallery photo ${index + 1} of ${gallery.length}. Opens full screen.`}
                      onPress={() => {
                        setGalleryLightboxIndex(index);
                        setGalleryLightboxOpen(true);
                      }}
                      style={[
                        styles.galleryCarouselSlide,
                        {
                          width: galleryCarouselLayout.slideW,
                          height: galleryCarouselLayout.slideH,
                        },
                      ]}
                    >
                      <Image
                        source={{ uri: item.imageUrl }}
                        style={styles.galleryCarouselImage}
                        resizeMode="cover"
                      />
                    </Pressable>
                  )}
                  onMomentumScrollEnd={(e) => {
                    const snap = galleryCarouselLayout.snapInterval;
                    const idx = Math.round(
                      e.nativeEvent.contentOffset.x / snap,
                    );
                    setGalleryCarouselIndex(
                      Math.min(gallery.length - 1, Math.max(0, idx)),
                    );
                  }}
                />
                {gallery.length > 1 ? (
                  <View style={styles.galleryDotsRow}>
                    {gallery.map((g, i) => (
                      <View
                        key={g.id}
                        style={[
                          styles.galleryDot,
                          i === galleryCarouselIndex &&
                            styles.galleryDotActive,
                        ]}
                      />
                    ))}
                  </View>
                ) : null}
              </View>
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
                color={C.accent}
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
                      ({totalReviews > 0 ? totalReviews : data.totalReviews}{" "}
                      reviews)
                    </Text>
                  </View>
                  {data.owner.isTopProvider ? (
                    <View style={styles.reviewsTopBadgeInline}>
                      <Text style={styles.reviewsTopBadgeEmoji}>🏅</Text>
                      <Text style={styles.reviewsTopBadgeTxt}>
                        Top Provider
                      </Text>
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
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={C.accent}
                    />
                  </TouchableOpacity>
                ) : null}
              </>
            )}
          </Section>
        </View>
      </Animated.ScrollView>

      <Modal
        visible={galleryLightboxOpen && gallery.length > 0}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => setGalleryLightboxOpen(false)}
      >
        <View style={styles.galleryLightboxRoot}>
          <StatusBar barStyle="light-content" />
          <FlatList
            ref={galleryLightboxRef}
            style={styles.galleryLightboxList}
            data={gallery}
            keyExtractor={(g) => g.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialNumToRender={3}
            onScrollToIndexFailed={({ index }) => {
              setTimeout(() => {
                try {
                  galleryLightboxRef.current?.scrollToIndex({
                    index,
                    animated: false,
                  });
                } catch {
                  /* noop */
                }
              }, 120);
            }}
            getItemLayout={(_, index) => ({
              length: windowWidth,
              offset: windowWidth * index,
              index,
            })}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(
                e.nativeEvent.contentOffset.x / windowWidth,
              );
              setGalleryLightboxIndex(
                Math.min(gallery.length - 1, Math.max(0, idx)),
              );
            }}
            renderItem={({ item }) => (
              <View
                style={[
                  styles.galleryLightboxPage,
                  { width: windowWidth, height: windowHeight },
                ]}
              >
                <Image
                  source={{ uri: item.imageUrl }}
                  style={{
                    width: windowWidth,
                    height: Math.max(280, Math.floor(windowHeight * 0.82)),
                  }}
                  resizeMode="contain"
                />
              </View>
            )}
          />
          <TouchableOpacity
            style={[
              styles.galleryLightboxCloseBtn,
              { top: insets.top + 10 },
            ]}
            onPress={() => setGalleryLightboxOpen(false)}
            activeOpacity={0.85}
            accessibilityLabel="Close gallery"
          >
            <Ionicons name="close" size={26} color={C.white} />
          </TouchableOpacity>
          {gallery.length > 1 ? (
            <View
              pointerEvents="none"
              style={[
                styles.galleryLightboxCounter,
                { bottom: insets.bottom + 20 },
              ]}
            >
              <Text style={styles.galleryLightboxCounterText}>
                {galleryLightboxIndex + 1} / {gallery.length}
              </Text>
            </View>
          ) : null}
        </View>
      </Modal>

      {/* ── Fixed bottom CTA ── */}
      <View style={[styles.ctaBar, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.ctaBarInner}>
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
                <ActivityIndicator size="small" color={C.accent} />
              ) : (
                <Ionicons
                  name="chatbubble-outline"
                  size={18}
                  color={C.accent}
                />
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
                  companyId: data.bookingCompanyId ?? undefined,
                  givenServiceId: data.givenServiceId,
                  providerName: data.owner.displayName,
                  serviceName: data.serviceName,
                  estimatedDurationMinutes: data.estimatedDurationMinutes ?? 60,
                });
              }}
            >
              <Text style={styles.ctaBtnText}>Book this service</Text>
              <Ionicons name="arrow-forward" size={16} color={C.white} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
};

// ─── Styles ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.screenBg },

  // Loading / error states
  loadingRoot: {
    flex: 1,
    backgroundColor: C.screenBg,
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
    borderColor: C.cardBorder,
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
    borderRadius: 12,
    backgroundColor: C.screenBg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.cardBorder,
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
    borderRadius: 12,
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
    borderRadius: 12,
    backgroundColor: C.screenBg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.cardBorder,
  },

  categoryBadgeInline: {
    alignSelf: "flex-start",
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: C.accentBorder,
  },
  categoryBadgeInlineText: {
    fontSize: 11,
    fontWeight: "700",
    color: C.accent,
    letterSpacing: 0.4,
  },

  // Main content card
  contentCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    marginHorizontal: 16,
    marginTop: 4,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 20,
    gap: 20,
    borderWidth: 1,
    borderColor: C.cardBorder,
    ...Platform.select({
      ios: {
        shadowColor: "#1A1A2E",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.07,
        shadowRadius: 14,
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
  locationCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: C.accentPale,
    borderWidth: 1,
    borderColor: C.accentBorder,
  },
  locationIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: C.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.accentBorder,
    flexShrink: 0,
    ...Platform.select({
      ios: {
        shadowColor: C.accent,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
    }),
  },
  locationTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  locationCity: {
    fontSize: 14,
    fontWeight: "800",
    color: C.text,
    letterSpacing: -0.2,
  },
  locationAddress: {
    fontSize: 13,
    fontWeight: "500",
    color: C.textMuted,
    lineHeight: 18,
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
    backgroundColor: "#F9F8FF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.accentBorder,
  },
  avatarRing: {
    position: "absolute",
    inset: -3,
    width: 90,
    height: 90,
    borderRadius: 25,
    borderWidth: 3,
    borderColor: C.accentBorder,
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
    backgroundColor: C.topAmberBg,
    borderWidth: 1,
    borderColor: C.topAmberBorder,
  },
  topProviderText: {
    fontSize: 11,
    fontWeight: "800",
    color: C.topAmberText,
    letterSpacing: 0.3,
  },

  trustMetricsSection: {
    gap: 10,
  },
  trustMetricsHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
  },
  trustMetricsTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: C.text,
    letterSpacing: -0.2,
  },
  trustMetricsSubtitle: {
    fontSize: 11,
    fontWeight: "500",
    color: C.textMuted,
    flexShrink: 1,
    textAlign: "right",
  },
  trustMetricsGrid: {
    flexDirection: "row",
    gap: 10,
  },
  trustMetricsGridTwo: {
    justifyContent: "space-between",
  },
  trustMetricCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 12,
    alignItems: "center",
    gap: 4,
  },
  trustMetricIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  trustMetricValue: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
    textAlign: "center",
  },
  trustMetricLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: C.text,
    textAlign: "center",
    lineHeight: 13,
  },
  trustMetricHint: {
    fontSize: 9,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 12,
    marginTop: 1,
  },

  // Stats
  statsRow: {
    flexDirection: "row",
    backgroundColor: "#F9F8FF",
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
    backgroundColor: "#F9F8FF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.accentBorder,
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
    backgroundColor: "#F9F8FF",
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
    color: C.accent,
    letterSpacing: -0.5,
  },
  pricingTypeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: C.accentPale,
    borderWidth: 1,
    borderColor: C.accentBorder,
  },
  pricingTypeText: { fontSize: 11, fontWeight: "800", color: C.accent },

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
    backgroundColor: C.accent,
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
    backgroundColor: "#F9F8FF",
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
    backgroundColor: C.accentPale,
    borderWidth: 1,
    borderColor: C.accentBorder,
  },
  payChipText: { fontSize: 12, fontWeight: "700", color: C.accent },

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

  // Gallery carousel
  galleryCarouselSlide: {
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: C.cardBorder,
    borderWidth: 1,
    borderColor: C.cardBorder,
    ...Platform.select({
      ios: {
        shadowColor: "#1A1A2E",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
      },
      android: { elevation: 4 },
    }),
  },
  galleryCarouselImage: { width: "100%", height: "100%" },
  galleryDotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
  },
  galleryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.accentPale,
    borderWidth: 1,
    borderColor: C.accentBorder,
  },
  galleryDotActive: {
    width: 20,
    borderRadius: 4,
    backgroundColor: C.accent,
    borderColor: C.accent,
  },
  galleryLightboxRoot: {
    flex: 1,
    backgroundColor: "#0A0A0F",
  },
  /** Without flex, FlatList collapses inside Modal on Android → empty black viewport. */
  galleryLightboxList: {
    flex: 1,
    width: "100%",
    backgroundColor: "#0A0A0F",
  },
  galleryLightboxPage: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0A0A0F",
  },
  galleryLightboxCloseBtn: {
    position: "absolute",
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    zIndex: 2,
  },
  galleryLightboxCounter: {
    position: "absolute",
    alignSelf: "center",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  galleryLightboxCounterText: {
    fontSize: 13,
    fontWeight: "700",
    color: C.white,
    letterSpacing: 0.4,
  },

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
    backgroundColor: C.accentPale,
    borderWidth: 1,
    borderColor: C.accentBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewAvatarText: { fontSize: 12, fontWeight: "800", color: C.accent },
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
    backgroundColor: C.topAmberBg,
    borderWidth: 1,
    borderColor: C.topAmberBorder,
  },
  reviewsTopBadgeEmoji: { fontSize: 12 },
  reviewsTopBadgeTxt: {
    fontSize: 11,
    fontWeight: "800",
    color: C.topAmberText,
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
    backgroundColor: "#EDE9FE",
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
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: C.accentBorder,
    backgroundColor: "#F9F8FF",
  },
  reviewsSeeAllTxt: {
    fontSize: 14,
    fontWeight: "800",
    color: C.accent,
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
    backgroundColor: C.accentPale,
    borderWidth: 1,
    borderColor: C.accentBorder,
    maxWidth: "100%",
  },
  reviewServiceChipText: {
    fontSize: 11,
    fontWeight: "800",
    color: C.accent,
  },
  reviewReadMore: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "800",
    color: C.accent,
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
    backgroundColor: "#FFFFFF",
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
    width: "100%",
  },
  ctaActionsRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  ctaMessageBtn: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: C.accentBorder,
  },
  ctaMessageBtnDisabled: {
    opacity: 0.5,
    borderColor: "#D1D5DB",
  },
  ctaMessageBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: C.accent,
  },
  ctaBtn: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: C.accent,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 999,
    ...Platform.select({
      ios: {
        shadowColor: "#7C5CFC",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.28,
        shadowRadius: 14,
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
    color: C.white,
    letterSpacing: 0.2,
    flexShrink: 1,
    textAlign: "center",
  },
});
