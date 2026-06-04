import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { FontAwesome5 as Icon, Ionicons } from "@expo/vector-icons";
import type { ClientStackParamList } from "../../../navigation/types";
import { useAuth } from "../../../context/AuthContext";
import { useNotificationsRealtime } from "../../../context/NotificationsRealtimeContext";
import { useAppTranslation } from "../../../hooks/useAppTranslation";
import i18n from "../../../i18n";
import { api, type AppointmentStatus } from "../../../services/api";
import {
  ServiceDiscoveryCard,
  type ServiceCardDisplay,
} from "../category-services/ListOfServicesScreen";
import type { MarketplaceServiceItem } from "../category-services/types";
import { getStoredClientCoords } from "../../../services/client-location-cache";

function clientLocationLine(
  city?: string | null,
  address?: string | null,
): string {
  return [city?.trim(), address?.trim()].filter(Boolean).join(" • ");
}

type ClientHomeHighlight = {
  id: string;
  status: AppointmentStatus;
  scheduledDate: string;
  scheduledTime: string;
  durationMinutes: number | null;
  startedAt: string | null;
  givenService: { serviceName: string; categoryName: string };
  provider: { firstName: string; lastName: string };
  givenServiceId: string | null;
  categoryId: string | null;
};

function pickLocaleName(
  translations: { locale: string; name: string }[] | undefined,
): string {
  if (!translations?.length) return "";
  const want = i18n.language?.startsWith("ar") ? "AR" : "EN";
  return (
    translations.find((tr) => tr.locale === want)?.name ??
    translations[0]?.name ??
    ""
  );
}

function toYmd(value: string | Date | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const day = String(d.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }
    return null;
  }
  const d = value as Date;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeClientHomeAppointment(
  raw: unknown,
): ClientHomeHighlight | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = r.id;
  if (typeof id !== "string") return null;
  const gs = r.givenService as Record<string, unknown> | undefined;
  const service = gs?.service as
    | {
        translations?: { locale: string; name: string }[];
        category?: { translations?: { locale: string; name: string }[] };
      }
    | undefined;
  const prov = r.provider as
    | { user?: { firstName?: string | null; lastName?: string | null } }
    | undefined;
  return {
    id,
    status: r.status as AppointmentStatus,
    scheduledDate: toYmd(r.scheduledDate as string) ?? "",
    scheduledTime: String(r.scheduledTime ?? ""),
    durationMinutes:
      typeof r.durationMinutes === "number" ? r.durationMinutes : null,
    startedAt:
      r.startedAt != null && r.startedAt !== "" ? String(r.startedAt) : null,
    givenService: {
      serviceName: pickLocaleName(service?.translations),
      categoryName: pickLocaleName(service?.category?.translations),
    },
    provider: {
      firstName: prov?.user?.firstName?.trim() ?? "",
      lastName: prov?.user?.lastName?.trim() ?? "",
    },
    givenServiceId:
      typeof gs?.serviceId === "string"
        ? gs.serviceId
        : typeof (gs?.service as { id?: unknown } | undefined)?.id === "string"
          ? ((gs?.service as { id?: string }).id ?? null)
          : null,
    categoryId:
      typeof (gs?.service as { categoryId?: unknown } | undefined)?.categoryId ===
      "string"
        ? ((gs?.service as { categoryId?: string }).categoryId ?? null)
        : typeof (gs?.service as { category?: { id?: unknown } } | undefined)
              ?.category?.id === "string"
          ? (((gs?.service as { category?: { id?: string } }).category?.id as
              | string
              | undefined) ?? null)
          : null,
  };
}

function combineLocalDateTime(dateYmd: string, timeHm: string): Date {
  const [y, mo, d] = dateYmd.split("-").map(Number);
  const parts = timeHm.split(":");
  const hh = Number(parts[0]) || 0;
  const mm = Number(parts[1]) || 0;
  return new Date(y, (mo || 1) - 1, d || 1, hh, mm, 0, 0);
}

function slotDurationMinutes(duration: number | null): number {
  return duration && duration > 0 ? duration : 60;
}

function slotEndDate(a: ClientHomeHighlight): Date {
  const start = combineLocalDateTime(a.scheduledDate, a.scheduledTime);
  return new Date(
    start.getTime() + slotDurationMinutes(a.durationMinutes) * 60 * 1000,
  );
}

function parseIsoDate(d: string | null): Date | null {
  if (!d) return null;
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? null : x;
}

function sortByScheduleAsc(
  a: ClientHomeHighlight,
  b: ClientHomeHighlight,
): number {
  return (
    combineLocalDateTime(a.scheduledDate, a.scheduledTime).getTime() -
    combineLocalDateTime(b.scheduledDate, b.scheduledTime).getTime()
  );
}

const HIGHLIGHT_EXCLUDED: AppointmentStatus[] = [
  "CANCELLED_CLIENT",
  "CANCELLED_PROVIDER",
  "REFUSED",
  "COMPLETED",
  "DISPUTED",
];

function isHighlightCandidate(a: ClientHomeHighlight): boolean {
  return !HIGHLIGHT_EXCLUDED.includes(a.status);
}

function pickClientHomeHighlight(
  rows: ClientHomeHighlight[],
  now: Date,
): ClientHomeHighlight | null {
  const candidates = rows.filter(isHighlightCandidate);
  if (!candidates.length) return null;
  const sorted = [...candidates].sort(sortByScheduleAsc);
  const inProgress = sorted.filter((a) => a.status === "IN_PROGRESS");
  if (inProgress.length) return inProgress[0];
  const enRoute = sorted.filter((a) => a.status === "EN_ROUTE");
  const enRouteOk = enRoute.filter(
    (a) => now.getTime() <= slotEndDate(a).getTime(),
  );
  if (enRouteOk.length) return enRouteOk[0];
  const confirmed = sorted.filter((a) => a.status === "CONFIRMED");
  const windows = confirmed.map((a) => ({
    a,
    start: combineLocalDateTime(a.scheduledDate, a.scheduledTime),
    end: slotEndDate(a),
  }));
  const inside = windows.find(({ start, end }) => now >= start && now < end);
  if (inside) return inside.a;
  const nowMs = now.getTime();
  const upcoming = sorted.filter((a) =>
    ["CONFIRMED", "PENDING", "RESCHEDULED", "EN_ROUTE"].includes(a.status),
  );
  const next = upcoming.find(
    (a) =>
      combineLocalDateTime(a.scheduledDate, a.scheduledTime).getTime() > nowMs,
  );
  if (next) return next;
  return null;
}

function statusMeta(status: AppointmentStatus): {
  label: string;
  dot: string;
  sub: string;
  icon: string;
} {
  switch (status) {
    case "IN_PROGRESS":
      return {
        label: "In progress",
        dot: "#7C5CFC",
        sub: "Service in progress",
        icon: "play-circle-outline",
      };
    case "EN_ROUTE":
      return {
        label: "On the way",
        dot: "#9333EA",
        sub: "Provider is heading to you",
        icon: "navigate-outline",
      };
    case "CONFIRMED":
      return {
        label: "Confirmed",
        dot: "#3B82F6",
        sub: "Upcoming visit",
        icon: "checkmark-circle-outline",
      };
    case "PENDING":
      return {
        label: "Pending",
        dot: "#F59E0B",
        sub: "Awaiting provider response",
        icon: "radio-button-on-outline",
      };
    case "RESCHEDULED":
      return {
        label: "Rescheduled",
        dot: "#EA580C",
        sub: "New time proposed",
        icon: "time-outline",
      };
    default:
      return {
        label: "Booking",
        dot: "#9B9BB0",
        sub: "Your appointment",
        icon: "calendar-outline",
      };
  }
}

function formatShortDate(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  if (!y || !m || !d) return yyyyMmDd;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

type CategoryApi = {
  id: string;
  name: string;
  slug: string;
  iconKey: string | null;
  iconUrl: string | null;
  sortOrder: number;
};

type SearchProviderResultItem = {
  givenServiceId: string;
  serviceName: string;
  averageRating: number;
  owner: {
    id: string;
    type: "PROVIDER" | "COMPANY";
    displayName: string;
    photoUrl: string | null;
    city: string;
    latitude: number | null;
    longitude: number | null;
    isTopProvider: boolean;
  };
  isAvailableImmediately: boolean | null;
};

type PopularNearbyItem = {
  ownerId: string;
  ownerType: "PROVIDER" | "COMPANY";
  givenServiceId: string;
  serviceId: string;
  serviceName: string;
  displayName: string;
  imageUrl: string | null;
  city: string;
  rating: number;
  distanceKm: number | null;
  isTopProvider: boolean;
  isAvailableImmediately: boolean;
};

const FALLBACK_COLORS = [
  "#7C5CFC",
  "#F59E0B",
  "#10B981",
  "#3B82F6",
  "#EF4444",
  "#9333EA",
  "#EC4899",
  "#6B7280",
] as const;

const CATEGORY_ITEMS_PER_ROW = 4;
const CATEGORY_COLLAPSED_ROWS = 2;
const CATEGORY_COLLAPSED_MAX = CATEGORY_ITEMS_PER_ROW * CATEGORY_COLLAPSED_ROWS;

type RecommendedSeed = {
  serviceId: string;
  score: number;
};

type SearchHistoryItem = {
  id: string;
  query: string | null;
  service: MarketplaceServiceItem;
};

function toCardDisplay(
  item: MarketplaceServiceItem,
  tr: (key: string, opts?: Record<string, unknown>) => string,
): ServiceCardDisplay {
  const count = typeof item.activeGivenCount === "number" ? item.activeGivenCount : 0;
  return {
    id: item.id,
    title: item.name,
    description: item.description?.trim() || item.category?.name || "—",
    duration: tr("client.categoryServices.durationVaries"),
    price: tr("client.categoryServices.priceOnRequest"),
    unit: "",
    image: item.servicePhoto?.trim() || null,
    activeGivenCount: count,
  };
}

function appointmentWeight(status: AppointmentStatus): number {
  switch (status) {
    case "COMPLETED":
      return 6;
    case "IN_PROGRESS":
    case "EN_ROUTE":
    case "CONFIRMED":
      return 5;
    case "PENDING":
    case "RESCHEDULED":
      return 3;
    default:
      return 1;
  }
}

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return r * c;
}

const POPULAR_CAROUSEL_GAP = 14;
const POPULAR_HORIZONTAL_PAD = 16;

const POPULAR_CARD_THEMES = [
  { gradient: ["#EDE9FE", "#FFFFFF"] as [string, string], accent: "#7C5CFC" },
  { gradient: ["#EFF6FF", "#FFFFFF"] as [string, string], accent: "#3B82F6" },
  { gradient: ["#ECFDF5", "#FFFFFF"] as [string, string], accent: "#059669" },
  { gradient: ["#FFF7ED", "#FFFFFF"] as [string, string], accent: "#EA580C" },
  { gradient: ["#F5F3FF", "#FFFFFF"] as [string, string], accent: "#8B5CF6" },
] as const;

function PopularNearbyCarousel({
  items,
  onPressItem,
}: {
  items: PopularNearbyItem[];
  onPressItem: (item: PopularNearbyItem) => void;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);

  const cardWidth = Math.round(windowWidth - POPULAR_HORIZONTAL_PAD * 2 - 36);
  const snapInterval = cardWidth + POPULAR_CAROUSEL_GAP;

  return (
    <View style={popularCarouselStyles.wrap}>
      <FlatList
        data={items}
        keyExtractor={(item) =>
          `${item.ownerType}:${item.ownerId}:${item.givenServiceId}`
        }
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={snapInterval}
        snapToAlignment="start"
        disableIntervalMomentum
        contentContainerStyle={popularCarouselStyles.listContent}
        ItemSeparatorComponent={() => (
          <View style={{ width: POPULAR_CAROUSEL_GAP }} />
        )}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / snapInterval);
          setActiveIndex(Math.min(items.length - 1, Math.max(0, idx)));
        }}
        renderItem={({ item, index }) => {
          const theme =
            POPULAR_CARD_THEMES[index % POPULAR_CARD_THEMES.length];
          const isCompany = item.ownerType === "COMPANY";
          const initials = item.displayName
            .split(" ")
            .map((w) => w[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();

          return (
            <TouchableOpacity
              activeOpacity={0.92}
              onPress={() => onPressItem(item)}
              style={[popularCarouselStyles.cardShell, { width: cardWidth }]}
            >
              <View style={popularCarouselStyles.card}>
                <View
                  style={[
                    popularCarouselStyles.cardAccent,
                    { backgroundColor: theme.accent },
                  ]}
                />

                {isCompany ? (
                  <View style={popularCarouselStyles.companyTag}>
                    <Ionicons name="business" size={11} color="#7C5CFC" />
                    <Text style={popularCarouselStyles.companyTagText}>
                      Company
                    </Text>
                  </View>
                ) : null}

                <View style={popularCarouselStyles.cardRow}>
                  <View style={popularCarouselStyles.avatarWrap}>
                    {item.imageUrl ? (
                      <Image
                        source={{ uri: item.imageUrl }}
                        style={popularCarouselStyles.avatar}
                      />
                    ) : (
                      <View style={popularCarouselStyles.avatarFallback}>
                        <Text style={popularCarouselStyles.avatarInitials}>
                          {initials}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={popularCarouselStyles.cardBody}>
                    <View style={popularCarouselStyles.cardNameRow}>
                      <View style={popularCarouselStyles.cardNameCol}>
                        <Text
                          style={popularCarouselStyles.cardTitle}
                          numberOfLines={1}
                        >
                          {item.displayName}
                        </Text>
                        <Text
                          style={popularCarouselStyles.cardSub}
                          numberOfLines={1}
                        >
                          {item.serviceName}
                        </Text>
                      </View>
                      <View style={popularCarouselStyles.ratingPill}>
                        <Ionicons name="star" size={11} color="#F59E0B" />
                        <Text style={popularCarouselStyles.ratingText}>
                          {item.rating.toFixed(1)}
                        </Text>
                      </View>
                    </View>

                    <View style={popularCarouselStyles.infoRow}>
                      <View style={popularCarouselStyles.infoChip}>
                        <Ionicons
                          name="location-outline"
                          size={12}
                          color="#9B9BB0"
                        />
                        <Text style={popularCarouselStyles.infoChipText}>
                          {item.city}
                          {item.distanceKm != null
                            ? ` · ${item.distanceKm.toFixed(1)} km`
                            : ""}
                        </Text>
                      </View>
                    </View>

                    <View style={popularCarouselStyles.tagsRow}>
                      <View
                        style={[
                          popularCarouselStyles.tag,
                          popularCarouselStyles.tagGray,
                        ]}
                      >
                        <Text
                          style={[
                            popularCarouselStyles.tagText,
                            popularCarouselStyles.tagGrayText,
                          ]}
                        >
                          {isCompany ? "Company" : "Provider"}
                        </Text>
                      </View>
                      {item.isTopProvider ? (
                        <View
                          style={[
                            popularCarouselStyles.tag,
                            popularCarouselStyles.tagIndigo,
                          ]}
                        >
                          <Text
                            style={[
                              popularCarouselStyles.tagText,
                              popularCarouselStyles.tagIndigoText,
                            ]}
                          >
                            Top rated
                          </Text>
                        </View>
                      ) : null}
                      {item.isAvailableImmediately ? (
                        <View
                          style={[
                            popularCarouselStyles.tag,
                            popularCarouselStyles.tagGreen,
                          ]}
                        >
                          <Text
                            style={[
                              popularCarouselStyles.tagText,
                              popularCarouselStyles.tagGreenText,
                            ]}
                          >
                            Available now
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    <View style={popularCarouselStyles.cardDivider} />

                    <View style={popularCarouselStyles.ctaRow}>
                      <Text
                        style={[
                          popularCarouselStyles.ctaText,
                          { color: theme.accent },
                        ]}
                      >
                        View profile
                      </Text>
                      <Ionicons
                        name="arrow-forward"
                        size={14}
                        color={theme.accent}
                      />
                    </View>
                  </View>
                </View>

                <View style={popularCarouselStyles.indexWrap}>
                  <Text style={popularCarouselStyles.indexLabel}>
                    {String(index + 1).padStart(2, "0")} /{" "}
                    {String(items.length).padStart(2, "0")}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {items.length > 1 ? (
        <View style={popularCarouselStyles.dotsRow}>
          {items.map((item, i) => {
            const accent =
              POPULAR_CARD_THEMES[i % POPULAR_CARD_THEMES.length].accent;
            return (
              <View
                key={`${item.ownerId}-dot`}
                style={[
                  popularCarouselStyles.dot,
                  i === activeIndex && [
                    popularCarouselStyles.dotActive,
                    { backgroundColor: accent },
                  ],
                ]}
              />
            );
          })}
        </View>
      ) : null}

      {items.length > 1 ? (
        <Text style={popularCarouselStyles.swipeHint}>
          Swipe for more nearby profiles
        </Text>
      ) : null}
    </View>
  );
}

const popularCarouselStyles = StyleSheet.create({
  wrap: {
    marginHorizontal: -POPULAR_HORIZONTAL_PAD,
  },
  listContent: {
    paddingHorizontal: POPULAR_HORIZONTAL_PAD,
    paddingVertical: 6,
  },
  cardShell: {
    borderRadius: 22,
    shadowColor: "#1A1A2E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 3,
  },
  card: {
    borderRadius: 22,
    padding: 14,
    minHeight: 206,
    borderWidth: 1,
    borderColor: "#EBEBF5",
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    position: "relative",
  },
  cardAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  companyTag: {
    position: "absolute",
    top: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#EDE9FE",
    borderWidth: 1,
    borderColor: "#C4B5FD",
    zIndex: 2,
  },
  companyTagText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#7C5CFC",
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  avatarWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    flexShrink: 0,
  },
  avatar: {
    width: "100%",
    height: "100%",
    borderRadius: 28,
  },
  avatarFallback: {
    width: "100%",
    height: "100%",
    borderRadius: 28,
    backgroundColor: "#EDE9FE",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontSize: 15,
    fontWeight: "800",
    color: "#7C5CFC",
  },
  cardBody: {
    flex: 1,
    gap: 9,
  },
  cardNameRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  cardNameCol: { flex: 1, minWidth: 0 },
  ratingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  ratingText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#B45309",
  },
  indexLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#9B9BB0",
    letterSpacing: 0.5,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1A1A2E",
    letterSpacing: -0.1,
  },
  cardSub: {
    fontSize: 12,
    color: "#9B9BB0",
    fontWeight: "500",
    marginTop: 2,
    lineHeight: 16,
  },
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
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tag: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  tagText: {
    fontSize: 10,
    fontWeight: "800",
  },
  tagIndigo: { backgroundColor: "#EDE9FE" },
  tagIndigoText: { color: "#7C5CFC" },
  tagGray: { backgroundColor: "#F4F3FA" },
  tagGrayText: { color: "#6B6B80" },
  tagGreen: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#6EE7B7",
  },
  tagGreenText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#047857",
  },
  cardDivider: {
    height: 1,
    backgroundColor: "#F4F3FA",
    marginTop: 2,
  },
  ctaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
  },
  ctaText: {
    fontSize: 13,
    fontWeight: "800",
  },
  indexWrap: {
    position: "absolute",
    bottom: 10,
    right: 12,
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 14,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#D4D4E0",
  },
  dotActive: {
    width: 20,
    borderRadius: 999,
  },
  swipeHint: {
    marginTop: 8,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "700",
    color: "#9B9BB0",
    letterSpacing: 0.3,
  },
});

export const ClientHomeScreen: React.FC = () => {
  const { t, isRTL } = useAppTranslation();
  const { user, session } = useAuth();
  const navigation =
    useNavigation<NativeStackNavigationProp<ClientStackParamList>>();
  const { width } = useWindowDimensions();
  const recommendedCardWidth = Math.min(300, width - 64);

  const [refreshing, setRefreshing] = useState(false);
  const [categoriesRefreshSignal, setCategoriesRefreshSignal] = useState(0);
  const { unreadCount, refreshUnreadCount } = useNotificationsRealtime();

  const [activeOrderLoading, setActiveOrderLoading] = useState(true);
  const [activeOrderHighlight, setActiveOrderHighlight] =
    useState<ClientHomeHighlight | null>(null);
  const [activeOrderTick, setActiveOrderTick] = useState(0);

  const [categories, setCategories] = useState<CategoryApi[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  const [recommendedItems, setRecommendedItems] = useState<MarketplaceServiceItem[]>(
    [],
  );
  const [recommendedLoading, setRecommendedLoading] = useState(true);
  const [popularNearbyItems, setPopularNearbyItems] = useState<PopularNearbyItem[]>(
    [],
  );
  const [popularNearbyLoading, setPopularNearbyLoading] = useState(true);

  const avatarUri = user?.client?.imageUrl;
  const clientCity = user?.client?.city;
  const clientAddress = user?.client?.address;

  const popularTitle = useMemo(() => {
    const place = clientLocationLine(clientCity, clientAddress);
    return place.length > 0
      ? t("client.home.popularNearAddress", { place })
      : t("client.home.popularNearNoAddress");
  }, [clientCity, clientAddress, t]);

  const loadActiveOrder = useCallback(async () => {
    setActiveOrderLoading(true);
    try {
      const res = await api.getMyAppointmentsAsClient();
      const rows = Array.isArray(res.data) ? res.data : [];
      const mapped = rows
        .map((row) => normalizeClientHomeAppointment(row))
        .filter((x): x is ClientHomeHighlight => x !== null);
      setActiveOrderHighlight(pickClientHomeHighlight(mapped, new Date()));
    } catch {
      setActiveOrderHighlight(null);
    } finally {
      setActiveOrderLoading(false);
    }
  }, []);

  const loadRecommendations = useCallback(async () => {
    setRecommendedLoading(true);
    try {
      const [servicesRes, historyRes, appointmentsRes] = await Promise.all([
        api.listServices(),
        api.getClientSearchHistory(),
        api.getMyAppointmentsAsClient(),
      ]);

      const services = Array.isArray(servicesRes.data)
        ? (servicesRes.data as MarketplaceServiceItem[])
        : [];
      const history = Array.isArray(historyRes.data)
        ? (historyRes.data as SearchHistoryItem[])
        : [];
      const appointments = Array.isArray(appointmentsRes.data)
        ? appointmentsRes.data
        : [];

      const scoreByService = new Map<string, number>();
      const scoreByCategory = new Map<string, number>();
      const addScore = (
        map: Map<string, number>,
        key: string | null | undefined,
        value: number,
      ) => {
        if (!key || !key.trim()) return;
        map.set(key, (map.get(key) ?? 0) + value);
      };

      history.slice(0, 12).forEach((h, index) => {
        const base = Math.max(1, 12 - index);
        addScore(scoreByService, h.service?.id ?? null, base * 2);
        addScore(scoreByCategory, h.service?.categoryId ?? null, base);
      });

      appointments
        .map((row) => normalizeClientHomeAppointment(row))
        .filter((x): x is ClientHomeHighlight => x !== null)
        .forEach((appt) => {
          const w = appointmentWeight(appt.status);
          addScore(scoreByService, appt.givenServiceId, w * 2);
          addScore(scoreByCategory, appt.categoryId, w);
        });

      const scored: RecommendedSeed[] = services.map((s, idx) => {
        const serviceScore = scoreByService.get(s.id) ?? 0;
        const categoryScore = scoreByCategory.get(s.categoryId) ?? 0;
        const supplyScore =
          typeof s.activeGivenCount === "number"
            ? Math.min(8, Math.max(0, s.activeGivenCount / 3))
            : 0;
        const recencyTieBreaker = 1 / (idx + 1);
        return {
          serviceId: s.id,
          score: serviceScore + categoryScore + supplyScore + recencyTieBreaker,
        };
      });

      const selected = scored
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map((entry) => services.find((s) => s.id === entry.serviceId))
        .filter((x): x is MarketplaceServiceItem => Boolean(x));

      setRecommendedItems(selected);
    } catch {
      setRecommendedItems([]);
    } finally {
      setRecommendedLoading(false);
    }
  }, []);

  const loadPopularNearby = useCallback(async () => {
    setPopularNearbyLoading(true);
    try {
      const [historyRes, appointmentsRes, servicesRes] = await Promise.all([
        api.getClientSearchHistory(),
        api.getMyAppointmentsAsClient(),
        api.listServices(),
      ]);
      const history = Array.isArray(historyRes.data)
        ? (historyRes.data as SearchHistoryItem[])
        : [];
      const appointments = Array.isArray(appointmentsRes.data)
        ? appointmentsRes.data
        : [];
      const services = Array.isArray(servicesRes.data)
        ? (servicesRes.data as MarketplaceServiceItem[])
        : [];

      const serviceSignals: string[] = [];
      for (const item of history.slice(0, 8)) {
        if (item.service?.id) serviceSignals.push(item.service.id);
      }
      for (const row of appointments) {
        const a = normalizeClientHomeAppointment(row);
        if (a?.givenServiceId) serviceSignals.push(a.givenServiceId);
      }
      if (serviceSignals.length === 0) {
        serviceSignals.push(...services.slice(0, 3).map((s) => s.id));
      }
      const uniqServiceIds = [...new Set(serviceSignals)].slice(0, 4);

      let clientLat: number | undefined;
      let clientLng: number | undefined;
      if (session?.user?.id) {
        const coords = await getStoredClientCoords(session.user.id);
        if (coords) {
          clientLat = coords.latitude;
          clientLng = coords.longitude;
        }
      }

      const searchResponses = await Promise.all(
        uniqServiceIds.map((serviceId) =>
          api.searchProviders({
            serviceId,
            clientLat,
            clientLng,
            city: user?.client?.city ?? undefined,
            sort: "RECOMMENDED",
            page: 1,
            limit: 6,
          }),
        ),
      );

      const byOwner = new Map<string, PopularNearbyItem>();
      for (let i = 0; i < searchResponses.length; i += 1) {
        const serviceId = uniqServiceIds[i];
        const serviceName =
          services.find((s) => s.id === serviceId)?.name ?? "Service";
        const rows = Array.isArray((searchResponses[i].data as { items?: unknown[] })?.items)
          ? ((searchResponses[i].data as { items?: unknown[] }).items as SearchProviderResultItem[])
          : [];
        for (const row of rows) {
          const key = `${row.owner.type}:${row.owner.id}`;
          const distanceKm =
            clientLat != null &&
            clientLng != null &&
            row.owner.latitude != null &&
            row.owner.longitude != null
              ? haversineKm(
                  clientLat,
                  clientLng,
                  row.owner.latitude,
                  row.owner.longitude,
                )
              : null;
          const mapped: PopularNearbyItem = {
            ownerId: row.owner.id,
            ownerType: row.owner.type,
            givenServiceId: row.givenServiceId,
            serviceId,
            serviceName: row.serviceName || serviceName,
            displayName: row.owner.displayName,
            imageUrl: row.owner.photoUrl,
            city: row.owner.city,
            rating: Number(row.averageRating || 0),
            distanceKm,
            isTopProvider: Boolean(row.owner.isTopProvider),
            isAvailableImmediately: Boolean(row.isAvailableImmediately),
          };
          const existing = byOwner.get(key);
          if (!existing) {
            byOwner.set(key, mapped);
            continue;
          }
          const existingScore =
            existing.rating * 10 - (existing.distanceKm ?? 5) + (existing.isTopProvider ? 1 : 0);
          const nextScore =
            mapped.rating * 10 - (mapped.distanceKm ?? 5) + (mapped.isTopProvider ? 1 : 0);
          if (nextScore > existingScore) byOwner.set(key, mapped);
        }
      }

      const picked = [...byOwner.values()]
        .sort((a, b) => {
          const dA = a.distanceKm ?? 999;
          const dB = b.distanceKm ?? 999;
          if (dA !== dB) return dA - dB;
          return b.rating - a.rating;
        })
        .slice(0, 5);
      setPopularNearbyItems(picked);
    } catch {
      setPopularNearbyItems([]);
    } finally {
      setPopularNearbyLoading(false);
    }
  }, [session?.user?.id, user?.client?.city]);

  const loadCategories = useCallback(async () => {
    setCategoriesError(null);
    try {
      const res = await api.listServiceCategories();
      setCategories(res.data as CategoryApi[]);
    } catch {
      setCategoriesError(t("client.home.categoriesLoadError"));
    } finally {
      setCategoriesLoading(false);
    }
  }, [t]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.navHeaderActions}>
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={() => navigation.navigate("Notifications")}
          >
            <Ionicons name="notifications-outline" size={20} color="#1A1A2E" />
            {unreadCount > 0 ? (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText} numberOfLines={1}>
                  {unreadCount > 99 ? "99+" : String(unreadCount)}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={() => navigation.navigate("ClientSettings")}
            activeOpacity={0.8}
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            ) : (
              <Text style={styles.avatarInitialText}>
                {(user?.firstName?.[0] ?? "?").toUpperCase()}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, unreadCount, avatarUri, user?.firstName]);

  useFocusEffect(
    useCallback(() => {
      void refreshUnreadCount();
      void loadActiveOrder();
      void loadRecommendations();
      void loadPopularNearby();
    }, [loadActiveOrder, loadRecommendations, loadPopularNearby, refreshUnreadCount]),
  );

  useEffect(() => {
    if (categoriesRefreshSignal > 0) void loadActiveOrder();
  }, [categoriesRefreshSignal, loadActiveOrder]);

  useEffect(() => {
    if (categoriesRefreshSignal > 0) void loadRecommendations();
  }, [categoriesRefreshSignal, loadRecommendations]);

  useEffect(() => {
    if (categoriesRefreshSignal > 0) void loadPopularNearby();
  }, [categoriesRefreshSignal, loadPopularNearby]);

  useEffect(() => {
    setCategoriesLoading(true);
    void loadCategories();
  }, [loadCategories, categoriesRefreshSignal]);

  useEffect(() => {
    if (activeOrderHighlight?.status !== "IN_PROGRESS") return;
    const id = setInterval(() => setActiveOrderTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [activeOrderHighlight?.status, activeOrderHighlight?.id]);

  const activeOrderProgressPct = useMemo(() => {
    if (!activeOrderHighlight || activeOrderHighlight.status !== "IN_PROGRESS")
      return 12;
    const start =
      parseIsoDate(activeOrderHighlight.startedAt) ??
      combineLocalDateTime(
        activeOrderHighlight.scheduledDate,
        activeOrderHighlight.scheduledTime,
      );
    const durMs =
      slotDurationMinutes(activeOrderHighlight.durationMinutes) * 60 * 1000;
    const elapsed = Math.max(0, Date.now() - start.getTime());
    const totalSec = Math.max(60, Math.floor(durMs / 1000));
    const elapsedSec = Math.floor(elapsed / 1000);
    return Math.min(100, (elapsedSec / totalSec) * 100);
  }, [activeOrderHighlight, activeOrderTick]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setCategoriesRefreshSignal((prev) => prev + 1);
    setTimeout(() => setRefreshing(false), 900);
  }, []);

  const showCategoryToggle = categories.length > CATEGORY_COLLAPSED_MAX;
  const visibleCategories =
    categoriesExpanded || !showCategoryToggle
      ? categories
      : categories.slice(0, CATEGORY_COLLAPSED_MAX);

  const openAppointment = useCallback(
    (appointmentId: string) =>
      navigation.navigate("ClientAppointmentDetail", { appointmentId }),
    [navigation],
  );

  /* ── Active order section ── */
  const renderActiveOrderSection = () => {
    if (activeOrderLoading) {
      return (
        <View style={styles.activeOrderContainer}>
          <View style={[styles.activeOrderCard, styles.loadingCard]}>
            <ActivityIndicator color="#7C5CFC" size="small" />
            <Text style={styles.loadingText}>Loading your booking…</Text>
          </View>
        </View>
      );
    }

    if (!activeOrderHighlight) {
      return (
        <View style={styles.activeOrderContainer}>
          <View style={[styles.activeOrderCard, styles.emptyCard]}>
            <View style={styles.emptyCardIconWrap}>
              <Ionicons name="calendar-outline" size={22} color="#9B9BB0" />
            </View>
            <View style={styles.emptyCardText}>
              <Text style={styles.emptyTitle}>No active booking</Text>
              <Text style={styles.emptySub}>
                Confirmed and in-progress visits will show here.
              </Text>
            </View>
          </View>
        </View>
      );
    }

    const meta = statusMeta(activeOrderHighlight.status);
    const providerName =
      `${activeOrderHighlight.provider.firstName} ${activeOrderHighlight.provider.lastName}`.trim() ||
      "Provider";
    const serviceTitle =
      activeOrderHighlight.givenService.serviceName || "Service";
    const shortId = activeOrderHighlight.id
      .replace(/-/g, "")
      .slice(0, 8)
      .toUpperCase();

    return (
      <View style={styles.activeOrderContainer}>
        <Pressable
          onPress={() => openAppointment(activeOrderHighlight.id)}
          style={({ pressed }) => [
            styles.activeOrderCard,
            pressed && styles.cardPressed,
          ]}
        >
          {/* Decorative blob */}
          <View style={styles.cardPattern} />

          <View style={styles.cardContent}>
            {/* Header */}
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <View style={styles.orderIconContainer}>
                  <Ionicons name={meta.icon as any} size={20} color="#FFFFFF" />
                </View>
                <View style={styles.titleBlock}>
                  <Text style={styles.orderId} numberOfLines={1}>
                    {serviceTitle}
                  </Text>
                  <View style={styles.orderStatus}>
                    <View
                      style={[
                        styles.statusIndicator,
                        { backgroundColor: meta.dot },
                      ]}
                    />
                    <Text
                      style={[styles.statusText, { color: meta.dot }]}
                      numberOfLines={1}
                    >
                      {meta.label} · {activeOrderHighlight.scheduledTime}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.chevronWrap}>
                <Ionicons name="chevron-forward" size={16} color="#C4C4C4" />
              </View>
            </View>

            {/* Progress bar */}
            <View style={styles.progressBarBackground}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${Math.max(6, activeOrderProgressPct)}%` },
                ]}
              />
            </View>

            {/* Footer details */}
            <View style={styles.orderDetails}>
              <Text style={styles.orderItems} numberOfLines={1}>
                {providerName} ·{" "}
                {formatShortDate(activeOrderHighlight.scheduledDate)} · #
                {shortId}
              </Text>
              <Text style={styles.orderPrice} numberOfLines={1}>
                {activeOrderHighlight.givenService.categoryName || meta.sub}
              </Text>
            </View>
          </View>
        </Pressable>
      </View>
    );
  };

  /* ── Categories section ── */
  const renderCategoriesSection = () => (
    <View style={styles.categoriesContainer}>
      <View
        style={[
          styles.sectionHeaderRow,
          isRTL && { flexDirection: "row-reverse" },
        ]}
      >
        <Text style={[styles.sectionTitle, isRTL && { textAlign: "right" }]}>
          {t("client.home.categoriesTitle")}
        </Text>
      </View>

      {categoriesLoading ? (
        <View style={styles.centeredPad}>
          <ActivityIndicator color="#7C5CFC" />
        </View>
      ) : categoriesError ? (
        <Text
          style={[
            styles.categoryName,
            { textAlign: "center", color: "#DC2626" },
          ]}
        >
          {categoriesError}
        </Text>
      ) : categories.length === 0 ? (
        <Text style={[styles.categoryName, { textAlign: "center" }]}>
          {t("client.home.categoriesEmpty")}
        </Text>
      ) : (
        <View style={styles.categoriesGrid}>
          {visibleCategories.map((category) => {
            const globalIndex = Math.max(
              0,
              categories.findIndex((c) => c.id === category.id),
            );
            const color = FALLBACK_COLORS[globalIndex % FALLBACK_COLORS.length];
            const useUrl = Boolean(category.iconUrl?.trim());
            const glyph = (category.iconKey?.trim() || "circle") as never;
            const bgHex = color + "18"; // ~10% opacity tint
            return (
              <TouchableOpacity
                key={category.id}
                style={styles.categoryItem}
                activeOpacity={0.85}
                onPress={() =>
                  navigation.navigate("ClientCategoryServices", {
                    categoryId: category.id,
                    categoryName: category.name,
                  })
                }
              >
                <View
                  style={[
                    styles.categoryIconContainer,
                    { backgroundColor: bgHex, borderColor: color + "30" },
                  ]}
                >
                  {useUrl ? (
                    <Image
                      source={{ uri: category.iconUrl!.trim() }}
                      style={styles.categoryIconImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <Icon name={glyph} size={22} color={color} />
                  )}
                </View>
                <Text
                  style={[
                    styles.categoryName,
                    isRTL && { textAlign: "center" },
                  ]}
                  numberOfLines={2}
                >
                  {category.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {!categoriesLoading &&
      !categoriesError &&
      categories.length > 0 &&
      showCategoryToggle ? (
        <TouchableOpacity
          onPress={() => setCategoriesExpanded((v) => !v)}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.viewMoreButton}
        >
          <Text style={styles.viewAllButton}>
            {categoriesExpanded
              ? t("client.home.categoriesViewLess")
              : t("client.home.categoriesViewMore")}
          </Text>
          <Ionicons
            name={categoriesExpanded ? "chevron-up" : "chevron-down"}
            size={13}
            color="#7C5CFC"
          />
        </TouchableOpacity>
      ) : null}
    </View>
  );

  /* ── Recommended section ── */
  const renderRecommendedSection = () => (
    <View style={styles.recommendedContainer}>
      <View style={styles.recommendedHeader}>
        <View>
          <Text style={styles.sectionTitle}>Recommended for you</Text>
          <Text style={styles.sectionSubtitle}>
            Based on your recent activity
          </Text>
        </View>
      </View>
      {recommendedLoading ? (
        <View style={styles.recommendedLoadingWrap}>
          <ActivityIndicator color="#7C5CFC" />
        </View>
      ) : recommendedItems.length === 0 ? (
        <View style={styles.recommendedEmptyWrap}>
          <Text style={styles.recommendedEmptyText}>
            Explore services to get personalized recommendations.
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.recommendedScrollView}
          contentContainerStyle={styles.recommendedScrollContent}
        >
          {recommendedItems.map((item) => {
            const card = toCardDisplay(item, t);
            return (
              <ServiceDiscoveryCard
                key={item.id}
                style={{ width: recommendedCardWidth, marginRight: 14 }}
                service={card}
                isFavorite={false}
                onToggleFavorite={() => {}}
                providersCountLabel={t(
                  "client.categoryServices.cardProvidersCount",
                  { count: card.activeGivenCount },
                )}
                onPress={() =>
                  navigation.navigate("ClientSearchProvider", {
                    serviceId: item.id,
                    serviceName: item.name,
                    serviceImage: item.servicePhoto ?? undefined,
                  })
                }
              />
            );
          })}
        </ScrollView>
      )}
    </View>
  );

  const openPopularProfile = useCallback(
    (item: PopularNearbyItem) => {
      if (item.ownerType === "COMPANY") {
        navigation.navigate("ClientCompanyProfile", {
          companyId: item.ownerId,
          serviceId: item.serviceId,
          serviceName: item.serviceName,
        });
        return;
      }
      navigation.navigate("ClientProviderProfile", {
        givenServiceId: item.givenServiceId,
      });
    },
    [navigation],
  );

  /* ── Popular section ── */
  const renderPopularSection = () => (
    <View style={styles.popularContainer}>
      <View style={styles.popularHeader}>
        <Text style={styles.sectionTitle}>{popularTitle}</Text>
        <Text style={styles.sectionSubtitle}>
          Swipe through top profiles near you
        </Text>
      </View>
      {popularNearbyLoading ? (
        <View style={styles.popularLoadingWrap}>
          <ActivityIndicator color="#7C5CFC" />
        </View>
      ) : popularNearbyItems.length === 0 ? (
        <View style={styles.popularEmptyWrap}>
          <Text style={styles.recommendedEmptyText}>
            No nearby profiles found yet. Try searching services.
          </Text>
        </View>
      ) : (
        <PopularNearbyCarousel
          items={popularNearbyItems}
          onPressItem={openPopularProfile}
        />
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        {/* Search bar */}
        <View style={styles.header}>
          <View style={styles.searchContainer}>
            <Pressable
              onPress={() => navigation.navigate("ClientHomeSearch")}
              accessibilityRole="button"
              accessibilityLabel={t("client.home.searchPlaceholder")}
              style={({ pressed }) => [
                styles.homeSearchBar,
                pressed && styles.homeSearchBarPressed,
              ]}
            >
              <View style={styles.searchIconWrap}>
                <Ionicons name="search-outline" size={16} color="#7C5CFC" />
              </View>
              <Text style={styles.homeSearchPlaceholder} numberOfLines={1}>
                {t("client.home.searchPlaceholder")}
              </Text>
              <View style={styles.searchMicWrap}>
                <Ionicons name="mic-outline" size={16} color="#C4C4C4" />
              </View>
            </Pressable>
          </View>
        </View>

        <ScrollView
          style={styles.mainContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#7C5CFC"
              colors={["#7C5CFC"]}
            />
          }
        >
          {renderActiveOrderSection()}
          {renderCategoriesSection()}
          {renderRecommendedSection()}
          {renderPopularSection()}
          <View style={{ height: 24 }} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FFFFFF" },
  container: { flex: 1, backgroundColor: "#F4F3FA" },

  /* ── Header ── */
  header: {
    paddingTop: 6,
    paddingBottom: 14,
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#EBEBF5",
  },
  navHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 4,
    gap: 8,
  },
  notificationButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F4F3FA",
    borderWidth: 1,
    borderColor: "#EBEBF5",
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  notificationBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  notificationBadgeText: { color: "#FFFFFF", fontSize: 9, fontWeight: "800" },
  avatarContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#EDE9FE",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#C4B5FD",
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: { width: "100%", height: "100%" },
  avatarInitialText: { fontSize: 14, fontWeight: "800", color: "#7C5CFC" },

  /* Search bar */
  searchContainer: { flexDirection: "row", alignItems: "center" },
  homeSearchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F4F3FA",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#EBEBF5",
    paddingHorizontal: 12,
    height: 46,
  },
  homeSearchBarPressed: { opacity: 0.88, backgroundColor: "#EEEDF8" },
  searchIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: "#EDE9FE",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  homeSearchPlaceholder: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: "#9B9BB0",
    letterSpacing: -0.1,
  },
  searchMicWrap: { flexShrink: 0 },

  mainContent: { flex: 1 },

  /* ── Active order ── */
  activeOrderContainer: { paddingHorizontal: 16, paddingTop: 18 },
  activeOrderCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#EBEBF5",
    shadowColor: "#7C5CFC",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 3,
    position: "relative",
    overflow: "hidden",
  },
  cardPattern: {
    position: "absolute",
    top: -20,
    right: -20,
    width: 90,
    height: 90,
    backgroundColor: "#EDE9FE",
    borderRadius: 45,
    opacity: 0.6,
  },
  cardContent: { zIndex: 1 },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  orderIconContainer: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: "#7C5CFC",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#7C5CFC",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
    flexShrink: 0,
  },
  titleBlock: { flex: 1, minWidth: 0 },
  orderId: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1A1A2E",
    letterSpacing: -0.2,
  },
  orderStatus: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
    gap: 5,
  },
  statusIndicator: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: "600" },
  chevronWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: "#F4F3FA",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  progressBarBackground: {
    width: "100%",
    height: 5,
    backgroundColor: "#F4F3FA",
    borderRadius: 3,
    marginBottom: 12,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#7C5CFC",
    borderRadius: 3,
  },
  orderDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  orderItems: { fontSize: 12, color: "#9B9BB0", flex: 1, fontWeight: "500" },
  orderPrice: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1A1A2E",
    flexShrink: 0,
  },

  loadingCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 20,
  },
  loadingText: { fontSize: 13, fontWeight: "600", color: "#9B9BB0" },
  emptyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
  emptyCardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: "#F4F3FA",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#EBEBF5",
    flexShrink: 0,
  },
  emptyCardText: { flex: 1 },
  emptyTitle: { fontSize: 13, fontWeight: "700", color: "#1A1A2E" },
  emptySub: { fontSize: 12, color: "#9B9BB0", marginTop: 2, lineHeight: 16 },
  cardPressed: { opacity: 0.9 },

  /* ── Section common ── */
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1A1A2E",
    letterSpacing: -0.4,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: "#9B9BB0",
    marginTop: 2,
    fontWeight: "500",
  },

  /* ── Categories ── */
  categoriesContainer: { paddingHorizontal: 16, marginTop: 24 },
  categoriesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  categoryItem: { width: "22%", alignItems: "center", marginBottom: 22 },
  categoryIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: 7,
  },
  categoryIconImage: { width: 36, height: 36, borderRadius: 10 },
  categoryName: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B6B80",
    textAlign: "center",
    lineHeight: 15,
  },
  centeredPad: { paddingVertical: 24, alignItems: "center" },
  viewMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "center",
    marginTop: 4,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#EDE9FE",
    borderWidth: 1,
    borderColor: "#C4B5FD",
  },
  viewAllButton: { fontSize: 12, fontWeight: "700", color: "#7C5CFC" },

  /* ── Recommended ── */
  recommendedContainer: { marginTop: 22 },
  recommendedHeader: { paddingHorizontal: 16, marginBottom: 14 },
  recommendedScrollView: { paddingLeft: 16 },
  recommendedScrollContent: { paddingRight: 16 },
  recommendedLoadingWrap: {
    minHeight: 110,
    alignItems: "center",
    justifyContent: "center",
  },
  recommendedEmptyWrap: {
    marginHorizontal: 16,
    minHeight: 92,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E9E8F6",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  recommendedEmptyText: {
    fontSize: 12,
    color: "#9B9BB0",
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 18,
  },

  /* ── Popular ── */
  popularContainer: { marginTop: 24, marginBottom: 8 },
  popularHeader: {
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  popularLoadingWrap: {
    minHeight: 110,
    alignItems: "center",
    justifyContent: "center",
  },
  popularEmptyWrap: {
    marginHorizontal: 16,
    minHeight: 92,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E9E8F6",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
});
