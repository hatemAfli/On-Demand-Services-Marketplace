import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
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
import { useAppTranslation } from "../../../hooks/useAppTranslation";
import i18n from "../../../i18n";
import {
  api,
  type AppointmentStatus,
} from "../../../services/api";
import {
  ServiceDiscoveryCard,
  type ServiceCardDisplay,
} from "../category-services/ListOfServicesScreen";
import { clientLocationLine } from "./clientLocationLine";
import { styles } from "./styles";

// —— Active order (highlight appointment) ——

type ClientHomeHighlight = {
  id: string;
  status: AppointmentStatus;
  scheduledDate: string;
  scheduledTime: string;
  durationMinutes: number | null;
  startedAt: string | null;
  givenService: { serviceName: string; categoryName: string };
  provider: { firstName: string; lastName: string };
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
      r.startedAt != null && r.startedAt !== ""
        ? String(r.startedAt)
        : null,
    givenService: {
      serviceName: pickLocaleName(service?.translations),
      categoryName: pickLocaleName(service?.category?.translations),
    },
    provider: {
      firstName: prov?.user?.firstName?.trim() ?? "",
      lastName: prov?.user?.lastName?.trim() ?? "",
    },
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
  const da = combineLocalDateTime(a.scheduledDate, a.scheduledTime).getTime();
  const db = combineLocalDateTime(b.scheduledDate, b.scheduledTime).getTime();
  return da - db;
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
  const inside = windows.find(
    ({ start, end }) => now >= start && now < end,
  );
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
} {
  switch (status) {
    case "IN_PROGRESS":
      return {
        label: "In progress",
        dot: "#4F46E5",
        sub: "Service in progress",
      };
    case "EN_ROUTE":
      return {
        label: "On the way",
        dot: "#9333EA",
        sub: "Provider is heading to you",
      };
    case "CONFIRMED":
      return {
        label: "Confirmed",
        dot: "#3B82F6",
        sub: "Upcoming visit",
      };
    case "PENDING":
      return {
        label: "Pending",
        dot: "#F59E0B",
        sub: "Awaiting provider response",
      };
    case "RESCHEDULED":
      return {
        label: "Rescheduled",
        dot: "#EA580C",
        sub: "New time proposed",
      };
    default:
      return {
        label: "Booking",
        dot: "#6B7280",
        sub: "Your appointment",
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

// —— Service categories ——

type CategoryApi = {
  id: string;
  name: string;
  slug: string;
  iconKey: string | null;
  iconUrl: string | null;
  sortOrder: number;
};

const FALLBACK_COLORS = [
  "#3b82f6",
  "#f97316",
  "#10b981",
  "#06b6d4",
  "#ef4444",
  "#64748b",
  "#ec4899",
  "#6b7280",
] as const;

const CATEGORY_ITEMS_PER_ROW = 4;
const CATEGORY_COLLAPSED_ROWS = 2;
const CATEGORY_COLLAPSED_MAX =
  CATEGORY_ITEMS_PER_ROW * CATEGORY_COLLAPSED_ROWS;

// —— Recommended ——

type RecommendedSeed = {
  id: string;
  imageUri: string;
  title: string;
  description: string;
  duration: string;
  activeGivenCount: number;
};

const RECOMMENDED_POOL: RecommendedSeed[] = [
  {
    id: "1",
    imageUri:
      "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=800&q=80",
    title: "Sparkle Home Clean",
    description: "Home • Deep cleaning • Weekly slots",
    duration: "25–35 min",
    activeGivenCount: 14,
  },
  {
    id: "2",
    imageUri:
      "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=800&q=80",
    title: "ProFix Electrical",
    description: "Electrical • Wiring • Safety checks",
    duration: "Same day",
    activeGivenCount: 9,
  },
  {
    id: "3",
    imageUri:
      "https://images.unsplash.com/photo-1631540579695-8c0dacdbe22b?auto=format&fit=crop&w=800&q=80",
    title: "CoolAir HVAC",
    description: "AC • Maintenance • Gas refill",
    duration: "45–60 min",
    activeGivenCount: 11,
  },
  {
    id: "4",
    imageUri:
      "https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?auto=format&fit=crop&w=800&q=80",
    title: "PipeRight Plumbing",
    description: "Plumbing • Leaks • Installations",
    duration: "Emergency",
    activeGivenCount: 7,
  },
  {
    id: "5",
    imageUri:
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=800&q=80",
    title: "GreenGarden Care",
    description: "Landscaping • Irrigation • Seasonal trim",
    duration: "1–2 hrs",
    activeGivenCount: 6,
  },
  {
    id: "6",
    imageUri:
      "https://images.unsplash.com/photo-1563453392212-326f5e854d02?auto=format&fit=crop&w=800&q=80",
    title: "SmartLock Security",
    description: "Locks • Smart doors • Key copy",
    duration: "30 min",
    activeGivenCount: 8,
  },
  {
    id: "7",
    imageUri:
      "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=800&q=80",
    title: "BuildCraft Carpentry",
    description: "Woodwork • Shelves • Repairs",
    duration: "Book ahead",
    activeGivenCount: 5,
  },
  {
    id: "8",
    imageUri:
      "https://images.unsplash.com/photo-1556912172-45b7abe8b7e1?auto=format&fit=crop&w=800&q=80",
    title: "ChefAtHome Catering",
    description: "Private chef • Events • Meal prep",
    duration: "2–3 hrs",
    activeGivenCount: 4,
  },
  {
    id: "9",
    imageUri:
      "https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=800&q=80",
    title: "PaintPro Interiors",
    description: "Painting • Prep • Color consult",
    duration: "Half day",
    activeGivenCount: 10,
  },
  {
    id: "10",
    imageUri:
      "https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?auto=format&fit=crop&w=800&q=80",
    title: "MoveEasy Helpers",
    description: "Moving • Packing • Furniture",
    duration: "Weekend slots",
    activeGivenCount: 12,
  },
];

function pickRandomThree(services: RecommendedSeed[]): RecommendedSeed[] {
  const shuffled = [...services];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = shuffled[i];
    shuffled[i] = shuffled[j]!;
    shuffled[j] = tmp!;
  }
  return shuffled.slice(0, 3);
}

function toCardDisplay(
  item: RecommendedSeed,
  tr: (key: string, opts?: Record<string, unknown>) => string,
): ServiceCardDisplay {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    duration: item.duration,
    price: tr("client.categoryServices.priceOnRequest"),
    unit: "",
    image: item.imageUri,
    activeGivenCount: item.activeGivenCount,
  };
}

// —— Screen ——

export const ClientHomeScreen: React.FC = () => {
  const { t, isRTL } = useAppTranslation();
  const { user } = useAuth();
  const navigation =
    useNavigation<NativeStackNavigationProp<ClientStackParamList>>();
  const { width } = useWindowDimensions();
  const recommendedCardWidth = Math.min(320, width - 48);

  const [refreshing, setRefreshing] = useState(false);
  const [categoriesRefreshSignal, setCategoriesRefreshSignal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  const [activeOrderLoading, setActiveOrderLoading] = useState(true);
  const [activeOrderHighlight, setActiveOrderHighlight] =
    useState<ClientHomeHighlight | null>(null);
  const [activeOrderTick, setActiveOrderTick] = useState(0);

  const [categories, setCategories] = useState<CategoryApi[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);

  const [recommendedItems] = useState(() => pickRandomThree(RECOMMENDED_POOL));

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
            <Icon name="bell" size={20} color="#4b5563" solid />
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
              <Ionicons name="person" size={20} color="#4F46E5" />
            )}
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, unreadCount, avatarUri]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        try {
          const res = await api.getUnreadCount();
          if (!cancelled) setUnreadCount(res.data?.count ?? 0);
        } catch {
          if (!cancelled) setUnreadCount(0);
        }
      })();
      void loadActiveOrder();
      return () => {
        cancelled = true;
      };
    }, [loadActiveOrder]),
  );

  useEffect(() => {
    if (categoriesRefreshSignal > 0) {
      void loadActiveOrder();
    }
  }, [categoriesRefreshSignal, loadActiveOrder]);

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
    setTimeout(() => {
      setRefreshing(false);
    }, 900);
  }, []);

  const showCategoryToggle = categories.length > CATEGORY_COLLAPSED_MAX;
  const visibleCategories =
    categoriesExpanded || !showCategoryToggle
      ? categories
      : categories.slice(0, CATEGORY_COLLAPSED_MAX);

  const openAppointment = useCallback(
    (appointmentId: string) => {
      navigation.navigate("ClientAppointmentDetail", { appointmentId });
    },
    [navigation],
  );

  const renderActiveOrderSection = () => {
    if (activeOrderLoading) {
      return (
        <View style={styles.activeOrderContainer}>
          <View style={[styles.activeOrderCard, homeLocalStyles.loadingCard]}>
            <ActivityIndicator color="#4F46E5" />
            <Text style={homeLocalStyles.loadingText}>
              Loading your booking…
            </Text>
          </View>
        </View>
      );
    }

    if (!activeOrderHighlight) {
      return (
        <View style={styles.activeOrderContainer}>
          <View style={[styles.activeOrderCard, homeLocalStyles.emptyCard]}>
            <Text style={homeLocalStyles.emptyTitle}>No active booking</Text>
            <Text style={homeLocalStyles.emptySub}>
              Confirmed and in-progress visits will show here.
            </Text>
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
            pressed && homeLocalStyles.cardPressed,
          ]}
        >
          <View style={styles.cardPattern} />
          <View style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <View style={styles.orderIconContainer}>
                  <Icon name="calendar-check" size={18} color="#fff" />
                </View>
                <View style={homeLocalStyles.titleBlock}>
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
              <View style={homeLocalStyles.chevronWrap}>
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              </View>
            </View>
            <View style={styles.progressBarBackground}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${Math.max(6, activeOrderProgressPct)}%` },
                ]}
              />
            </View>
            <View style={styles.orderDetails}>
              <Text style={styles.orderItems} numberOfLines={2}>
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

  const renderCategoriesSection = () => (
    <View style={styles.categoriesContainer}>
      <View
        style={[
          styles.categoriesHeader,
          isRTL && { flexDirection: "row-reverse" },
        ]}
      >
        <Text style={[styles.categoriesTitle, isRTL && { textAlign: "right" }]}>
          {t("client.home.categoriesTitle")}
        </Text>
      </View>
      {categoriesLoading ? (
        <View style={homeLocalStyles.centeredPad}>
          <ActivityIndicator color="#4f46e5" />
        </View>
      ) : categoriesError ? (
        <Text
          style={[
            styles.categoryName,
            { textAlign: "center", color: "#b91c1c" },
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
            return (
              <TouchableOpacity
                key={category.id}
                style={styles.categoryItem}
                activeOpacity={0.88}
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
                    { backgroundColor: "#fff" },
                  ]}
                >
                  {useUrl ? (
                    <Image
                      source={{ uri: category.iconUrl!.trim() }}
                      style={homeLocalStyles.categoryIconImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <Icon name={glyph} size={24} color={color} />
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
          style={homeLocalStyles.viewMoreButton}
        >
          <Text style={styles.viewAllButton}>
            {categoriesExpanded
              ? t("client.home.categoriesViewLess")
              : t("client.home.categoriesViewMore")}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  const renderRecommendedSection = () => (
    <View style={styles.recommendedContainer}>
      <View style={styles.recommendedHeader}>
        <View>
          <Text style={styles.recommendedTitle}>Recommended for you</Text>
          <Text style={styles.recommendedSubtitle}>
            Based on your recent activity
          </Text>
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.recommendedScrollView}
        contentContainerStyle={homeLocalStyles.recommendedScrollContent}
      >
        {recommendedItems.map((item) => {
          const card = toCardDisplay(item, t);
          return (
            <ServiceDiscoveryCard
              key={item.id}
              style={{
                width: recommendedCardWidth,
                marginRight: 16,
              }}
              service={card}
              isFavorite={false}
              onToggleFavorite={() => {}}
              providersCountLabel={t(
                "client.categoryServices.cardProvidersCount",
                { count: card.activeGivenCount },
              )}
              onPress={() => {}}
            />
          );
        })}
      </ScrollView>
    </View>
  );

  const renderPopularSection = () => (
    <View style={styles.popularContainer}>
      <Text style={styles.popularTitle}>{popularTitle}</Text>
      <View style={styles.popularList}>
        <View style={styles.popularItem}>
          <Image
            source={{
              uri: "https://storage.googleapis.com/uxpilot-auth.appspot.com/f48cad009e-4f349cc0d9a71f14d364.png",
            }}
            style={styles.popularItemImage}
          />
          <View style={styles.popularItemContent}>
            <View style={styles.popularItemHeader}>
              <Text style={styles.popularItemTitle}>Brew Crew Coffee</Text>
              <Icon name="heart" size={12} color="#9ca3af" />
            </View>
            <View style={styles.popularItemInfo}>
              <Icon name="star" size={10} color="#facc15" solid />
              <Text style={styles.popularItemRating}>4.7</Text>
              <Text style={styles.dot}>•</Text>
              <Text style={styles.popularItemCategory}>Cafe</Text>
              <Text style={styles.dot}>•</Text>
              <Text style={styles.popularItemDistance}>1.2 km</Text>
            </View>
            <View style={styles.popularItemTags}>
              <View style={[styles.tag, homeLocalStyles.tagIndigo]}>
                <Text style={[styles.tagText, homeLocalStyles.tagIndigoText]}>
                  Free Delivery
                </Text>
              </View>
              <View style={[styles.tag, homeLocalStyles.tagGray]}>
                <Text style={[styles.tagText, homeLocalStyles.tagGrayText]}>
                  Top Rated
                </Text>
              </View>
            </View>
          </View>
        </View>
        <View style={styles.popularItem}>
          <Image
            source={{
              uri: "https://images.unsplash.com/photo-1632833239869-a37e3a5806d2?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80",
            }}
            style={styles.popularItemImage}
          />
          <View style={styles.popularItemContent}>
            <View style={styles.popularItemHeader}>
              <Text style={styles.popularItemTitle}>QuickFix Plumbing</Text>
              <Icon name="heart" size={12} color="#9ca3af" />
            </View>
            <View style={styles.popularItemInfo}>
              <Icon name="star" size={10} color="#facc15" solid />
              <Text style={styles.popularItemRating}>4.9</Text>
              <Text style={styles.dot}>•</Text>
              <Text style={styles.popularItemCategory}>Maintenance</Text>
              <Text style={styles.dot}>•</Text>
              <Text style={styles.popularItemDistance}>0.8 km</Text>
            </View>
            <View style={styles.popularItemTags}>
              <View style={[styles.tag, homeLocalStyles.tagGreen]}>
                <Text style={[styles.tagText, homeLocalStyles.tagGreenText]}>
                  Available Now
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
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
              <View style={styles.homeSearchIconBadge}>
                <Ionicons name="search" size={20} color="#4F46E5" />
              </View>
              <View style={styles.homeSearchTextBlock}>
                <Text style={styles.homeSearchPlaceholder} numberOfLines={1}>
                  {t("client.home.searchPlaceholder")}
                </Text>
                <Text style={styles.homeSearchHint} numberOfLines={1}>
                  {t("client.home.searchHint")}
                </Text>
              </View>
              <View style={styles.homeSearchChevron}>
                <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
              </View>
            </Pressable>
          </View>
        </View>
        <ScrollView
          style={styles.mainContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {renderActiveOrderSection()}
          {renderCategoriesSection()}
          {renderRecommendedSection()}
          {renderPopularSection()}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const homeLocalStyles = StyleSheet.create({
  loadingCard: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
    marginTop: 8,
  },
  emptyCard: {
    paddingVertical: 20,
    paddingHorizontal: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
  },
  emptySub: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 18,
  },
  titleBlock: { flex: 1, minWidth: 0 },
  chevronWrap: { paddingLeft: 8, paddingTop: 4 },
  cardPressed: { opacity: 0.92 },
  centeredPad: { paddingVertical: 24, alignItems: "center" },
  categoryIconImage: { width: 40, height: 40, borderRadius: 12 },
  viewMoreButton: { alignSelf: "flex-end", marginTop: 8 },
  recommendedScrollContent: { paddingRight: 24 },
  tagIndigo: { backgroundColor: "#eef2ff" },
  tagIndigoText: { color: "#4f46e5" },
  tagGray: { backgroundColor: "#f3f4f6" },
  tagGrayText: { color: "#4b5563" },
  tagGreen: { backgroundColor: "#f0fdf4" },
  tagGreenText: { color: "#16a34a" },
});
