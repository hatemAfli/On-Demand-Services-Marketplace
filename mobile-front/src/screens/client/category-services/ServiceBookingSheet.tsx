import React, { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
} from "react-native";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { useAppTranslation } from "../../../hooks/useAppTranslation";
import { styles } from "./styles";
import type { MarketplaceServiceItem } from "./types";

const durationOptions = [2, 3, 4, 5];

type Props = {
  visible: boolean;
  onClose: () => void;
  service: MarketplaceServiceItem | null;
  imageUri: string;
};

export const ServiceBookingSheet: React.FC<Props> = ({
  visible,
  onClose,
  service,
  imageUri,
}) => {
  const { t } = useAppTranslation();
  const [selectedDuration, setSelectedDuration] = useState(3);
  const [cleaners, setCleaners] = useState(1);
  const [materials, setMaterials] = useState(false);
  const [vacuum, setVacuum] = useState(false);

  const totalPrice = useMemo(() => {
    const durationValue = selectedDuration === 5 ? 5 : selectedDuration;
    const base = durationValue * cleaners * 35;
    const extras = (materials ? 15 : 0) + (vacuum ? 20 : 0);
    return base + extras;
  }, [cleaners, materials, selectedDuration, vacuum]);

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
            <View style={styles.sheetTitleWrap}>
              <Text style={styles.sheetTitle}>{service.name}</Text>
              <Text style={styles.sheetSubtitle}>{sheetSubtitle}</Text>
            </View>
          </View>

          <ScrollView
            style={styles.sheetBody}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.sheetDesc}>{desc}</Text>
            <Text style={styles.readMore}>{t("client.categoryServices.readMore")}</Text>

            <Text style={styles.sectionTitle}>
              {t("client.categoryServices.sectionHours")}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.durationWrap}
            >
              {durationOptions.map((hours) => {
                const selected = selectedDuration === hours;
                return (
                  <TouchableOpacity
                    key={hours}
                    style={[
                      styles.durationCard,
                      selected ? styles.durationCardSelected : undefined,
                    ]}
                    onPress={() => setSelectedDuration(hours)}
                  >
                    {hours === 3 ? (
                      <Text style={styles.recommended}>
                        {t("client.categoryServices.recommended")}
                      </Text>
                    ) : null}
                    <Text
                      style={[
                        styles.durationHours,
                        selected ? styles.durationHoursSelected : undefined,
                      ]}
                    >
                      {hours === 5
                        ? t("client.categoryServices.hoursPlus")
                        : hours}
                    </Text>
                    <Text
                      style={[
                        styles.durationLabel,
                        selected ? styles.durationLabelSelected : undefined,
                      ]}
                    >
                      {t("client.categoryServices.hours")}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.sectionTitle}>
              {t("client.categoryServices.sectionCleaners")}
            </Text>
            <View style={styles.counterCard}>
              <View>
                <Text style={styles.counterTitle}>
                  {t("client.categoryServices.professionals")}
                </Text>
                <Text style={styles.counterSubtitle}>
                  {t("client.categoryServices.perPersonRate")}
                </Text>
              </View>
              <View style={styles.counterActions}>
                <TouchableOpacity
                  style={styles.counterBtn}
                  onPress={() => setCleaners((prev) => Math.max(1, prev - 1))}
                >
                  <FontAwesome6 name="minus" size={12} color="#6B7280" />
                </TouchableOpacity>
                <Text style={styles.counterValue}>{cleaners}</Text>
                <TouchableOpacity
                  style={[styles.counterBtn, styles.counterBtnAdd]}
                  onPress={() => setCleaners((prev) => Math.min(5, prev + 1))}
                >
                  <FontAwesome6 name="plus" size={12} color="#4F46E5" />
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.sectionTitle}>
              {t("client.categoryServices.sectionAddons")}
            </Text>
            <TouchableOpacity
              style={styles.addonRow}
              onPress={() => setMaterials((prev) => !prev)}
            >
              <View>
                <Text style={styles.addonTitle}>
                  {materials ? "☑" : "☐"}{" "}
                  {t("client.categoryServices.addonMaterials")}
                </Text>
                <Text style={styles.addonSubtitle}>
                  {t("client.categoryServices.addonMaterialsSub")}
                </Text>
              </View>
              <Text style={styles.addonPrice}>
                {t("client.categoryServices.addonPriceMaterials")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addonRow}
              onPress={() => setVacuum((prev) => !prev)}
            >
              <View>
                <Text style={styles.addonTitle}>
                  {vacuum ? "☑" : "☐"}{" "}
                  {t("client.categoryServices.addonVacuum")}
                </Text>
                <Text style={styles.addonSubtitle}>
                  {t("client.categoryServices.addonVacuumSub")}
                </Text>
              </View>
              <Text style={styles.addonPrice}>
                {t("client.categoryServices.addonPriceVacuum")}
              </Text>
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>
              {t("client.categoryServices.specialInstructions")}
            </Text>
            <TextInput
              multiline
              numberOfLines={3}
              placeholder={t("client.categoryServices.instructionsPlaceholder")}
              placeholderTextColor="#9CA3AF"
              style={styles.textArea}
            />

            <View style={styles.sheetSpacer} />
          </ScrollView>

          <View style={styles.footerBar}>
            <View style={styles.totalWrap}>
              <View>
                <Text style={styles.totalLabel}>
                  {t("client.categoryServices.totalEstimation")}
                </Text>
                <Text style={styles.totalValue}>
                  {t("client.categoryServices.sar")} {totalPrice}
                </Text>
              </View>
              <Text style={styles.totalMeta}>
                {t("client.categoryServices.totalMeta", {
                  hours:
                    selectedDuration === 5 ? "5+" : String(selectedDuration),
                  cleaners: cleaners,
                })}
              </Text>
            </View>
            <TouchableOpacity style={styles.bookButton} activeOpacity={0.92}>
              <Text style={styles.bookText}>
                {t("client.categoryServices.bookAppointment")}
              </Text>
              <FontAwesome6 name="arrow-right" size={14} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
