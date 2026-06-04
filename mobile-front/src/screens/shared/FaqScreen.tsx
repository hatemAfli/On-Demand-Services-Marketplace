import React, { useCallback, useLayoutEffect, useState } from "react";
import {
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTranslation } from "../../hooks/useAppTranslation";
import { api } from "../../services/api";

type FaqItem = {
  id: string;
  question: string;
  answer: string;
};

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export const FaqScreen: React.FC = () => {
  const navigation = useNavigation();
  const { t, isRTL } = useAppTranslation();
  const [items, setItems] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t("support.faqTitle"),
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ marginLeft: 8, padding: 4 }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={24} color="#1A1A2E" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, t]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      const load = async () => {
        setLoading(true);
        setError(null);
        try {
          const res = await api.getFaq();
          if (!alive) return;
          setItems(Array.isArray(res.data) ? res.data : []);
        } catch {
          if (!alive) return;
          setItems([]);
          setError(t("support.faqLoadError"));
        } finally {
          if (alive) setLoading(false);
        }
      };
      void load();
      return () => {
        alive = false;
      };
    }, [t]),
  );

  const toggle = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId((current) => (current === id ? null : id));
  };

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#4F46E5" />
          </View>
        ) : error ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>{error}</Text>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="chatbubble-ellipses-outline" size={28} color="#94A3B8" />
            <Text style={[styles.emptyText, isRTL && styles.rtl]}>
              {t("support.faqEmpty")}
            </Text>
          </View>
        ) : (
          items.map((item, index) => {
            const open = expandedId === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.92}
                style={[styles.card, open && styles.cardOpen]}
                onPress={() => toggle(item.id)}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.indexBadge}>
                    <Text style={styles.indexText}>{index + 1}</Text>
                  </View>
                  <Text style={[styles.question, isRTL && styles.rtl]}>
                    {item.question}
                  </Text>
                  <Ionicons
                    name={open ? "chevron-up" : "chevron-down"}
                    size={18}
                    color="#64748B"
                  />
                </View>
                {open ? (
                  <Text style={[styles.answer, isRTL && styles.rtl]}>
                    {item.answer}
                  </Text>
                ) : null}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAFC" },
  content: { padding: 20, paddingBottom: 32 },
  centerBox: { paddingVertical: 48, alignItems: "center" },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  emptyText: {
    textAlign: "center",
    color: "#64748B",
    fontWeight: "600",
    lineHeight: 20,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cardOpen: {
    borderColor: "#C7D2FE",
    backgroundColor: "#FDFDFF",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  indexBadge: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  indexText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#4F46E5",
  },
  question: {
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
    lineHeight: 20,
  },
  answer: {
    marginTop: 12,
    marginLeft: 34,
    fontSize: 13,
    lineHeight: 21,
    color: "#475569",
    fontWeight: "600",
  },
  rtl: { textAlign: "right" },
});
