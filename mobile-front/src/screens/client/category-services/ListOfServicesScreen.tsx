import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import Ionicons from "@expo/vector-icons/Ionicons";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ClientStackParamList } from "../../../navigation/types";
import { useAppTranslation } from "../../../hooks/useAppTranslation";
import { api } from "../../../services/api";
import { ServiceDetailsScreen } from "./ServiceDetailsScreen";
import type { MarketplaceServiceItem } from "./types";

function serviceTitleInitial(title: string): string {
  const c = title.trim().charAt(0);
  return c ? c.toUpperCase() : "?";
}

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },
  screenWrap: {
    flex: 1,
    maxWidth: 420,
    alignSelf: "center",
    width: "100%",
    backgroundColor: "#F1F5F9",
  },
  header: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  headerSide: {
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  circleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 14,
  },
  centerWrap: {
    paddingVertical: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    color: "#b91c1c",
    textAlign: "center",
    fontSize: 14,
  },
  listHeader: {
    marginTop: 6,
    marginBottom: 2,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  listTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },
  resultText: {
    fontSize: 12,
    color: "#6B7280",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    padding: 14,
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
  cardMainRow: {
    flexDirection: "row",
    gap: 12,
  },
  cardImageWrap: {
    width: 96,
    height: 96,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#F3F4F6",
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  cardImageFallback: {
    width: "100%",
    height: "100%",
    backgroundColor: "#FFF7ED",
    alignItems: "center",
    justifyContent: "center",
  },
  cardImageLetter: {
    fontSize: 28,
    fontWeight: "800",
    color: "#EA580C",
  },
  cardInfo: {
    flex: 1,
    justifyContent: "space-between",
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 4,
    paddingRight: 34,
  },
  cardDescription: {
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 16,
  },
  priceRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  durationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  durationText: {
    fontSize: 10,
    color: "#6B7280",
  },
  cardProviderCountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  cardProviderCountText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#EA580C",
  },
  priceTextRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
  },
  priceText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#EA580C",
  },
  unitText: {
    fontSize: 10,
    color: "#9CA3AF",
    marginBottom: 2,
  },
  addButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#FFF7ED",
    alignItems: "center",
    justifyContent: "center",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.2)",
    justifyContent: "flex-end",
  },
  sheet: {
    height: "85%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
  },
  sheetImageWrap: {
    height: 190,
    position: "relative",
  },
  sheetImage: {
    width: "100%",
    height: "100%",
  },
  sheetImageFallback: {
    width: "100%",
    height: "100%",
    backgroundColor: "#FFF7ED",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetImageLetter: {
    fontSize: 52,
    fontWeight: "800",
    color: "#EA580C",
  },
  closeButton: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  favoriteButton: {
    position: "absolute",
    top: 16,
    left: 16,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1.5,
    borderColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
  },
  favoriteButtonActive: {
    backgroundColor: "#EF4444",
  },
  sheetTitleBlock: {
    marginBottom: 14,
  },
  sheetTitle: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 4,
  },
  sheetSubtitle: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "600",
  },
  sheetBody: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  sheetDesc: {
    color: "#4B5563",
    fontSize: 14,
    lineHeight: 20,
  },
  readMore: {
    color: "#EA580C",
    marginTop: 8,
    fontSize: 12,
    fontWeight: "700",
  },
  sectionTitle: {
    marginTop: 18,
    marginBottom: 10,
    fontSize: 14,
    fontWeight: "800",
    color: "#111827",
  },
  counterCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    backgroundColor: "#F9FAFB",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  counterTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111827",
  },
  counterSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  providersCountValue: {
    fontSize: 28,
    fontWeight: "800",
    color: "#EA580C",
    minWidth: 40,
    textAlign: "right",
  },
  sheetSpacer: {
    height: 100,
  },
  footerBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  bookButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: "#EA580C",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    width: "100%",
  },
  bookText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
  },
});

export type CategoryServicesStyles = typeof styles;

type Props = NativeStackScreenProps<
  ClientStackParamList,
  "ClientCategoryServices"
>;

type CategoryServicesHeaderProps = {
  title: string;
  onBack: () => void;
  onToggleFavorite: () => void;
  isFavorite: boolean;
  favoriteLoading: boolean;
};

const CategoryServicesHeader: React.FC<CategoryServicesHeaderProps> = ({
  title,
  onBack,
  onToggleFavorite,
  isFavorite,
  favoriteLoading,
}) => {
  return (
    <View style={[styles.header, { borderBottomWidth: 0 }]}>
      <View style={styles.headerRow}>
        <View style={styles.headerSide}>
          <TouchableOpacity
            style={styles.circleButton}
            onPress={onBack}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={22} color="#1A1A2E" />
          </TouchableOpacity>
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <View style={styles.headerSide}>
          <TouchableOpacity
            style={styles.circleButton}
            onPress={onToggleFavorite}
            disabled={favoriteLoading}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {favoriteLoading ? (
              <ActivityIndicator size="small" color="#EF4444" />
            ) : (
              <Ionicons
                name={isFavorite ? "heart" : "heart-outline"}
                size={20}
                color="#EF4444"
              />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export type ServiceCardDisplay = {
  id: string;
  title: string;
  description: string;
  duration: string;
  price: string;
  unit: string;
  /** Remote URL when set; otherwise the card shows an initial avatar. */
  image: string | null;
  activeGivenCount: number;
};

type ServiceDiscoveryCardProps = {
  service: ServiceCardDisplay;
  onPress: () => void;
  onToggleFavorite: () => void;
  isFavorite: boolean;
  favoriteLoading?: boolean;
  providersCountLabel: string;
  style?: StyleProp<ViewStyle>;
};

const CardServiceThumbnail: React.FC<{
  uri: string | null;
  title: string;
}> = ({ uri, title }) => {
  const [failed, setFailed] = useState(false);
  const trimmed = uri?.trim() ?? "";
  const showRemote = trimmed.length > 0 && !failed;

  return showRemote ? (
    <Image
      source={{ uri: trimmed }}
      style={styles.cardImage}
      onError={() => setFailed(true)}
    />
  ) : (
    <View style={[styles.cardImage, styles.cardImageFallback]}>
      <Text style={styles.cardImageLetter}>{serviceTitleInitial(title)}</Text>
    </View>
  );
};

export const ServiceDiscoveryCard: React.FC<ServiceDiscoveryCardProps> = ({
  service,
  onPress,
  onToggleFavorite,
  isFavorite,
  favoriteLoading,
  providersCountLabel,
  style,
}) => {
  return (
    <TouchableOpacity
      style={[styles.card, style]}
      activeOpacity={0.93}
      onPress={onPress}
    >
      <TouchableOpacity
        style={[
          styles.cardFavoriteButton,
          isFavorite && styles.cardFavoriteButtonActive,
        ]}
        onPress={(e) => {
          e.stopPropagation();
          onToggleFavorite();
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
      <View style={styles.cardMainRow}>
        <View style={styles.cardImageWrap}>
          <CardServiceThumbnail uri={service.image} title={service.title} />
        </View>

        <View style={styles.cardInfo}>
          <View>
            <Text style={styles.cardTitle}>{service.title}</Text>
            <Text style={styles.cardDescription} numberOfLines={3}>
              {service.description}
            </Text>
          </View>
          <View style={styles.priceRow}>
            <View>
              <View style={styles.durationRow}>
                <FontAwesome6 name="clock" size={10} color="#D1D5DB" />
                <Text style={styles.durationText}>{service.duration}</Text>
              </View>
              <View style={styles.cardProviderCountRow}>
                <FontAwesome6 name="user-group" size={10} color="#6B7280" />
                <Text style={styles.cardProviderCountText}>
                  {providersCountLabel}
                </Text>
              </View>
              <View style={styles.priceTextRow}>
                <Text style={styles.priceText}>{service.price}</Text>
                {service.unit ? (
                  <Text style={styles.unitText}>{service.unit}</Text>
                ) : null}
              </View>
            </View>
            <View style={styles.addButton}>
              <FontAwesome6 name="plus" size={11} color="#EA580C" />
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

function toCardDisplay(
  s: MarketplaceServiceItem,
  t: (key: string, opts?: Record<string, unknown>) => string,
): ServiceCardDisplay {
  const count = typeof s.activeGivenCount === "number" ? s.activeGivenCount : 0;
  return {
    id: s.id,
    title: s.name,
    description: s.description?.trim() || "—",
    duration: t("client.categoryServices.durationVaries"),
    price: t("client.categoryServices.priceOnRequest"),
    unit: "",
    image: s.servicePhoto?.trim() || null,
    activeGivenCount: count,
  };
}

export const ListOfServicesScreen: React.FC<Props> = ({
  navigation,
  route,
}) => {
  const { categoryId, categoryName } = route.params;
  const { t } = useAppTranslation();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [services, setServices] = useState<MarketplaceServiceItem[]>([]);
  const [isCategoryFavorite, setIsCategoryFavorite] = useState(false);
  const [categoryFavoriteLoading, setCategoryFavoriteLoading] = useState(false);
  const [favoriteServiceIds, setFavoriteServiceIds] = useState<Set<string>>(
    new Set(),
  );
  const [favoriteBusyIds, setFavoriteBusyIds] = useState<Set<string>>(new Set());
  const [sheetVisible, setSheetVisible] = useState(false);
  const [selected, setSelected] = useState<MarketplaceServiceItem | null>(null);
  const [selectedImage, setSelectedImage] = useState("");

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [res, favRes] = await Promise.all([
        api.listServicesByCategoryId(categoryId),
        api.getClientFavorites({ type: "SERVICE" }),
      ]);
      setServices(res.data as MarketplaceServiceItem[]);
      const favItems = (favRes.data?.items ?? []) as Array<{ targetId: string }>;
      setFavoriteServiceIds(new Set(favItems.map((item) => item.targetId)));
    } catch {
      setError(t("client.categoryServices.loadError"));
      setServices([]);
      setFavoriteServiceIds(new Set());
    } finally {
      setLoading(false);
    }
  }, [categoryId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    setCategoryFavoriteLoading(true);
    void api
      .getClientFavorites({ type: "CATEGORY" })
      .then((res) => {
        if (cancelled) return;
        const items = (res.data?.items ?? []) as Array<{ targetId: string }>;
        setIsCategoryFavorite(items.some((item) => item.targetId === categoryId));
      })
      .catch(() => {
        if (!cancelled) setIsCategoryFavorite(false);
      })
      .finally(() => {
        if (!cancelled) setCategoryFavoriteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [categoryId]);

  const openSheet = (item: MarketplaceServiceItem) => {
    setSelected(item);
    setSelectedImage(item.servicePhoto?.trim() ?? "");
    setSheetVisible(true);
  };

  const closeSheet = () => {
    setSheetVisible(false);
    setSelected(null);
  };

  const toggleCardFavorite = async (serviceId: string) => {
    if (favoriteBusyIds.has(serviceId)) return;
    setFavoriteBusyIds((prev) => new Set(prev).add(serviceId));
    const isFavorite = favoriteServiceIds.has(serviceId);
    try {
      if (isFavorite) {
        await api.deleteClientFavorite("SERVICE", serviceId);
        setFavoriteServiceIds((prev) => {
          const next = new Set(prev);
          next.delete(serviceId);
          return next;
        });
      } else {
        await api.createClientFavorite({ type: "SERVICE", targetId: serviceId });
        setFavoriteServiceIds((prev) => {
          const next = new Set(prev);
          next.add(serviceId);
          return next;
        });
      }
    } finally {
      setFavoriteBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(serviceId);
        return next;
      });
    }
  };

  const toggleCategoryFavorite = async () => {
    if (categoryFavoriteLoading) return;
    setCategoryFavoriteLoading(true);
    try {
      if (isCategoryFavorite) {
        await api.deleteClientFavorite("CATEGORY", categoryId);
        setIsCategoryFavorite(false);
      } else {
        await api.createClientFavorite({ type: "CATEGORY", targetId: categoryId });
        setIsCategoryFavorite(true);
      }
    } finally {
      setCategoryFavoriteLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screenWrap}>
        <View style={{ backgroundColor: "#F1F5F9" }}>
          <CategoryServicesHeader
            title={categoryName}
            onBack={() => navigation.goBack()}
            onToggleFavorite={() => {
              void toggleCategoryFavorite();
            }}
            isFavorite={isCategoryFavorite}
            favoriteLoading={categoryFavoriteLoading}
          />
        </View>

        {loading ? (
          <View style={styles.centerWrap}>
            <ActivityIndicator size="large" color="#EA580C" />
          </View>
        ) : error ? (
          <View style={styles.centerWrap}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.listHeader}>
              <Text style={styles.listTitle}>
                {t("client.categoryServices.availableServices")}
              </Text>
              <Text style={styles.resultText}>
                {t("client.categoryServices.results", {
                  count: services.length,
                })}
              </Text>
            </View>

            {services.length === 0 ? (
              <Text style={[styles.errorText, { color: "#6b7280" }]}>
                {t("client.categoryServices.empty")}
              </Text>
            ) : (
              services.map((item) => {
                const card = toCardDisplay(item, t);
                return (
                  <ServiceDiscoveryCard
                    key={item.id}
                    service={card}
                    isFavorite={favoriteServiceIds.has(item.id)}
                    favoriteLoading={favoriteBusyIds.has(item.id)}
                    onToggleFavorite={() => {
                      void toggleCardFavorite(item.id);
                    }}
                    providersCountLabel={t(
                      "client.categoryServices.cardProvidersCount",
                      { count: card.activeGivenCount },
                    )}
                    onPress={() => openSheet(item)}
                  />
                );
              })
            )}
          </ScrollView>
        )}
      </View>

      <ServiceDetailsScreen
        visible={sheetVisible}
        onClose={closeSheet}
        sheetStyles={styles}
        service={selected}
        imageUri={selectedImage}
        initialActiveGivenCount={
          selected && typeof selected.activeGivenCount === "number"
            ? selected.activeGivenCount
            : undefined
        }
      />
    </SafeAreaView>
  );
};
