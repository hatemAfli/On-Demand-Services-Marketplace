import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ClientStackParamList } from "../../../navigation/types";
import { useAppTranslation } from "../../../hooks/useAppTranslation";
import { api } from "../../../services/api";
import { CategoryServicesHeader } from "./CategoryServicesHeader";
import { SubCategoryChips } from "./SubCategoryChips";
import {
  ServiceDiscoveryCard,
  type ServiceCardDisplay,
} from "./ServiceDiscoveryCard";
import { PromoBanner } from "./PromoBanner";
import { ServiceBookingSheet } from "./ServiceBookingSheet";
import { placeholderImageForService } from "./constants";
import type { MarketplaceServiceItem } from "./types";
import { styles } from "./styles";

type Props = NativeStackScreenProps<
  ClientStackParamList,
  "ClientCategoryServices"
>;

function toCardDisplay(
  s: MarketplaceServiceItem,
  index: number,
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
    image: s.servicePhoto?.trim() || placeholderImageForService(index),
    activeGivenCount: count,
  };
}

export const CategoryServicesScreen: React.FC<Props> = ({
  navigation,
  route,
}) => {
  const { categoryId, categoryName } = route.params;
  const { t } = useAppTranslation();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [services, setServices] = useState<MarketplaceServiceItem[]>([]);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [selected, setSelected] = useState<MarketplaceServiceItem | null>(null);
  const [selectedImage, setSelectedImage] = useState("");

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.listServicesByCategoryId(categoryId);
      setServices(res.data as MarketplaceServiceItem[]);
    } catch {
      setError(t("client.categoryServices.loadError"));
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, [categoryId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const openSheet = (item: MarketplaceServiceItem, index: number) => {
    setSelected(item);
    setSelectedImage(
      item.servicePhoto?.trim() || placeholderImageForService(index),
    );
    setSheetVisible(true);
  };

  const closeSheet = () => {
    setSheetVisible(false);
    setSelected(null);
  };

  const subLabels = [
    t("client.categoryServices.subAll"),
    t("client.categoryServices.subPopular"),
    t("client.categoryServices.subNew"),
    t("client.categoryServices.subOffers"),
  ] as [string, string, string, string];

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.screenWrap}>
        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderBottomWidth: 1,
            borderBottomColor: "#F3F4F6",
          }}
        >
          <CategoryServicesHeader
            title={categoryName}
            onBack={() => navigation.goBack()}
          />
        </View>

        {loading ? (
          <View style={styles.centerWrap}>
            <ActivityIndicator size="large" color="#4f46e5" />
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
            <SubCategoryChips labels={subLabels} />

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
              services.map((item, index) => {
                const card = toCardDisplay(item, index, t);
                return (
                  <ServiceDiscoveryCard
                    key={item.id}
                    service={card}
                    providersCountLabel={t(
                      "client.categoryServices.cardProvidersCount",
                      { count: card.activeGivenCount },
                    )}
                    onPress={() => openSheet(item, index)}
                  />
                );
              })
            )}

            <PromoBanner
              offerLabel={t("client.categoryServices.promoOfferLabel")}
              title={t("client.categoryServices.promoTitle")}
              subtitle={t("client.categoryServices.promoSubtitle")}
              claimLabel={t("client.categoryServices.claim")}
            />
          </ScrollView>
        )}
      </View>

      <ServiceBookingSheet
        visible={sheetVisible}
        onClose={closeSheet}
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
