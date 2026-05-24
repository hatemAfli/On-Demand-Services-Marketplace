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
import { api, type AppointmentStatus } from "../../../services/api";
import {
  ServiceDiscoveryCard,
  type ServiceCardDisplay,
} from "../category-services/ListOfServicesScreen";

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

export const ClientHomeScreen: React.FC = () => {
  const { t, isRTL } = useAppTranslation();
  const { user } = useAuth();
  const navigation =
    useNavigation<NativeStackNavigationProp<ClientStackParamList>>();
  const { width } = useWindowDimensions();
  const recommendedCardWidth = Math.min(300, width - 64);

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
    if (categoriesRefreshSignal > 0) void loadActiveOrder();
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
              onPress={() => {}}
            />
          );
        })}
      </ScrollView>
    </View>
  );

  /* ── Popular section ── */
  const renderPopularSection = () => (
    <View style={styles.popularContainer}>
      <Text style={[styles.sectionTitle, { marginBottom: 14 }]}>
        {popularTitle}
      </Text>
      <View style={styles.popularList}>
        {[
          {
            uri: "https://storage.googleapis.com/uxpilot-auth.appspot.com/f48cad009e-4f349cc0d9a71f14d364.png",
            title: "Brew Crew Coffee",
            rating: "4.7",
            category: "Cafe",
            distance: "1.2 km",
            tags: [
              { label: "Free Delivery", type: "indigo" as const },
              { label: "Top Rated", type: "gray" as const },
            ],
          },
          {
            uri: "https://images.unsplash.com/photo-1632833239869-a37e3a5806d2?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80",
            title: "QuickFix Plumbing",
            rating: "4.9",
            category: "Maintenance",
            distance: "0.8 km",
            tags: [{ label: "Available Now", type: "green" as const }],
          },
        ].map((item) => (
          <View key={item.title} style={styles.popularItem}>
            <Image source={{ uri: item.uri }} style={styles.popularItemImage} />
            <View style={styles.popularItemContent}>
              <View style={styles.popularItemHeader}>
                <Text style={styles.popularItemTitle}>{item.title}</Text>
                <TouchableOpacity
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="heart-outline" size={16} color="#C4C4C4" />
                </TouchableOpacity>
              </View>
              <View style={styles.popularItemInfo}>
                <Ionicons name="star" size={11} color="#F59E0B" />
                <Text style={styles.popularItemRating}>{item.rating}</Text>
                <Text style={styles.dot}>·</Text>
                <Text style={styles.popularItemCategory}>{item.category}</Text>
                <Text style={styles.dot}>·</Text>
                <Text style={styles.popularItemDistance}>{item.distance}</Text>
              </View>
              <View style={styles.popularItemTags}>
                {item.tags.map((tag) => (
                  <View
                    key={tag.label}
                    style={[
                      styles.tag,
                      tag.type === "indigo" && styles.tagIndigo,
                      tag.type === "gray" && styles.tagGray,
                      tag.type === "green" && styles.tagGreen,
                    ]}
                  >
                    <Text
                      style={[
                        styles.tagText,
                        tag.type === "indigo" && styles.tagIndigoText,
                        tag.type === "gray" && styles.tagGrayText,
                        tag.type === "green" && styles.tagGreenText,
                      ]}
                    >
                      {tag.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ))}
      </View>
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

  /* ── Popular ── */
  popularContainer: { paddingHorizontal: 16, marginTop: 24, marginBottom: 8 },
  popularList: { gap: 10 },
  popularItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: "#EBEBF5",
    shadowColor: "#1A1A2E",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
    gap: 14,
  },
  popularItemImage: {
    width: 76,
    height: 76,
    borderRadius: 14,
    backgroundColor: "#F4F3FA",
    flexShrink: 0,
  },
  popularItemContent: { flex: 1, gap: 4 },
  popularItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  popularItemTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1A1A2E",
    letterSpacing: -0.1,
  },
  popularItemInfo: { flexDirection: "row", alignItems: "center", gap: 4 },
  popularItemRating: { fontSize: 12, fontWeight: "700", color: "#1A1A2E" },
  dot: { color: "#D4D4E0", fontSize: 12 },
  popularItemCategory: { fontSize: 12, color: "#9B9BB0" },
  popularItemDistance: { fontSize: 12, color: "#9B9BB0" },
  popularItemTags: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  tagText: { fontSize: 10, fontWeight: "700" },
  tagIndigo: { backgroundColor: "#EDE9FE" },
  tagIndigoText: { color: "#7C5CFC" },
  tagGray: { backgroundColor: "#F4F3FA" },
  tagGrayText: { color: "#6B6B80" },
  tagGreen: { backgroundColor: "#ECFDF5" },
  tagGreenText: { color: "#059669" },
});
