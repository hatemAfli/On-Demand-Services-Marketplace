import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  Image,
} from "react-native";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { useAppTranslation } from "../../../hooks/useAppTranslation";
import { api } from "../../../services/api";
import { styles } from "./styles";
import type { MarketplaceServiceItem } from "./types";

type Props = {
  visible: boolean;
  onClose: () => void;
  service: MarketplaceServiceItem | null;
  imageUri: string;
  /** From list payload (`activeGivenCount`); avoids blank count before refetch. */
  initialActiveGivenCount?: number;
};

export const ServiceBookingSheet: React.FC<Props> = ({
  visible,
  onClose,
  service,
  imageUri,
  initialActiveGivenCount,
}) => {
  const { t } = useAppTranslation();
  const [providerCount, setProviderCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);

  useEffect(() => {
    if (!visible || !service?.id) {
      return;
    }
    let cancelled = false;
    setProviderCount(
      typeof initialActiveGivenCount === "number"
        ? initialActiveGivenCount
        : null,
    );
    setCountLoading(true);
    void api
      .getCatalogServiceActiveGivenCount(service.id)
      .then((res) => {
        if (!cancelled) {
          const raw = res.data as { count?: unknown };
          const n =
            typeof raw?.count === "number"
              ? raw.count
              : Number(raw?.count);
          setProviderCount(Number.isFinite(n) ? n : 0);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProviderCount(
            typeof initialActiveGivenCount === "number"
              ? initialActiveGivenCount
              : null,
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCountLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [visible, service?.id, initialActiveGivenCount]);

  if (!service) {
    return null;
  }

  const desc =
    service.description?.trim() ||
    t("client.categoryServices.empty");

  const sheetSubtitle = t("client.categoryServices.sheetSubtitle", {
    name: service.name,
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.sheetImageWrap}>
            <Image source={{ uri: imageUri }} style={styles.sheetImage} />
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <FontAwesome6 name="xmark" size={14} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.sheetBody}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.sheetTitleBlock}>
              <Text style={styles.sheetTitle}>{service.name}</Text>
              <Text style={styles.sheetSubtitle}>{sheetSubtitle}</Text>
            </View>
            <Text style={styles.sheetDesc}>{desc}</Text>
            <Text style={styles.readMore}>{t("client.categoryServices.readMore")}</Text>

            <Text style={styles.sectionTitle}>
              {t("client.categoryServices.sectionCleaners")}
            </Text>
            <View style={styles.counterCard}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.counterTitle}>
                  {t("client.categoryServices.professionals")}
                </Text>
                <Text style={styles.counterSubtitle}>
                  {t("client.categoryServices.providersCountHint")}
                </Text>
              </View>
              {countLoading ? (
                <ActivityIndicator color="#4F46E5" />
              ) : (
                <Text style={styles.providersCountValue}>
                  {providerCount !== null ? String(providerCount) : "—"}
                </Text>
              )}
            </View>

            <View style={styles.sheetSpacer} />
          </ScrollView>

          <View style={styles.footerBar}>
            <TouchableOpacity style={styles.bookButton} activeOpacity={0.92}>
              <Text style={styles.bookText}>
                {t("client.categoryServices.searchProviders")}
              </Text>
              <FontAwesome6 name="arrow-right" size={14} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
