import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from "react-native";
import { FontAwesome5 as Icon } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAppTranslation } from "../../../hooks/useAppTranslation";
import type { ClientStackParamList } from "../../../navigation/types";
import { api } from "../../../services/api";
import { styles } from "./styles";

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

/** Grid uses ~4 items per row (`categoryItem` width 22%); show 2 rows when collapsed. */
const CATEGORY_ITEMS_PER_ROW = 4;
const CATEGORY_COLLAPSED_ROWS = 2;
const CATEGORY_COLLAPSED_MAX =
  CATEGORY_ITEMS_PER_ROW * CATEGORY_COLLAPSED_ROWS;

type ServiceCategoriesProps = {
  refreshSignal?: number;
};

export const ServiceCategories: React.FC<ServiceCategoriesProps> = ({
  refreshSignal = 0,
}) => {
  const { t, isRTL } = useAppTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<ClientStackParamList>>();
  const [categories, setCategories] = useState<CategoryApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.listServiceCategories();
      setCategories(res.data as CategoryApi[]);
    } catch {
      setError(t("client.home.categoriesLoadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load, refreshSignal]);

  const showCategoryToggle = categories.length > CATEGORY_COLLAPSED_MAX;
  const visibleCategories =
    categoriesExpanded || !showCategoryToggle
      ? categories
      : categories.slice(0, CATEGORY_COLLAPSED_MAX);

  return (
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
        {showCategoryToggle ? (
          <TouchableOpacity
            onPress={() => setCategoriesExpanded((v) => !v)}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.viewAllButton}>
              {categoriesExpanded
                ? t("client.home.categoriesViewLess")
                : t("client.home.categoriesViewMore")}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {loading ? (
        <View style={{ paddingVertical: 24, alignItems: "center" }}>
          <ActivityIndicator color="#4f46e5" />
        </View>
      ) : error ? (
        <Text
          style={[
            styles.categoryName,
            { textAlign: "center", color: "#b91c1c" },
          ]}
        >
          {error}
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
                      style={{ width: 40, height: 40, borderRadius: 12 }}
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
    </View>
  );
};
