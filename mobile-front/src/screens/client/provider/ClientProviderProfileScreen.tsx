import React, { useEffect, useRef, useState } from "react";
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
  };
};

const STATIC_REVIEWS = [
  {
    id: "r1",
    name: "Sami K.",
    stars: 5,
    comment:
      "Great service and very professional. Arrived on time and finished quickly.",
  },
  {
    id: "r2",
    name: "Meriem B.",
    stars: 4,
    comment: "On time and clear communication. Would definitely hire again.",
  },
  {
    id: "r3",
    name: "Hatem A.",
    stars: 5,
    comment:
      "Excellent quality, highly recommended. Fixed the issue the first time.",
  },
];

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

// ─── Review card ────────────────────────────────────────────
function ReviewCard({
  name,
  stars,
  comment,
}: {
  name: string;
  stars: number;
  comment: string;
}) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <View style={styles.reviewAvatar}>
          <Text style={styles.reviewAvatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.reviewName}>{name}</Text>
          <Stars count={stars} size={11} />
        </View>
      </View>
      <Text style={styles.reviewComment}>{comment}</Text>
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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void api
      .getGivenServiceDetails(givenServiceId)
      .then((res) => {
        if (cancelled) return;
        setData(res.data as GivenServiceDetails);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not load provider profile.");
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
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

          {/* Top Provider badge */}
          <View style={styles.topProviderBadge}>
            <Ionicons name="ribbon" size={13} color={C.gold} />
            <Text style={styles.topProviderText}>Top Provider</Text>
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
            <View style={{ gap: 10 }}>
              {STATIC_REVIEWS.map((r) => (
                <ReviewCard
                  key={r.id}
                  name={r.name}
                  stars={r.stars}
                  comment={r.comment}
                />
              ))}
            </View>
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
