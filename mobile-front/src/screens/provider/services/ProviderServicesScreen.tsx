import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../services/api";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ProviderStackParamList } from "../../../navigation/types";

type ServiceCardVariant = "tall" | "addNew";

type ServiceCard = {
  id: string;
  variant: ServiceCardVariant;
  category: string;
  categoryTone: "primary" | "blue" | "pink" | "gray";
  title: string;
  description: string;
  priceAed?: number;
  imageUrl?: string;
  durationLabel?: string;
  staffLabel?: string;
  isActive?: boolean;
};

type ProviderVerificationDoc = {
  verificationRequest?: {
    requestStatus?: string;
    service?: {
      id: string;
      name: string;
      description?: string | null;
      servicePhoto?: string | null;
      category?: { name: string } | null;
    } | null;
  } | null;
};

type Nav = NativeStackNavigationProp<
  ProviderStackParamList,
  "ProviderServices"
>;

const COLORS = {
  bg: "#F8FAFC",
  white: "#FFFFFF",
  text: "#0F172A",
  textMuted: "#475569",
  textMuted2: "#576577",
  border: "#E2E8F0",
  surface2: "#F1F5F9",
  primary: "#7621C2",
  primaryBg: "#F5F0FF",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  blue: "#2563EB",
  pink: "#EC4899",
  gray600: "#4B5563",
  shadow: "rgba(0,0,0,0.08)",
};

function Icon({
  name,
  color = COLORS.textMuted,
  size = 16,
}: {
  name: string;
  color?: string;
  size?: number;
}) {
  return (
    <Text style={{ color, fontSize: size, fontWeight: "700" }}>{name}</Text>
  );
}

function ServiceCardView({
  item,
  onOpenEditService,
  onRequestNewService,
}: {
  item: ServiceCard;
  onOpenEditService: () => void;
  onRequestNewService: () => void;
}) {
  if (item.variant === "addNew") {
    return (
      <Pressable
        onPress={onRequestNewService}
        style={({ pressed }) => [
          styles.addNewCard,
          pressed && { opacity: 0.94 },
        ]}
      >
        <View style={styles.addNewIconCircle}>
          <Icon name="+" color={COLORS.primary} size={20} />
        </View>
        <Text style={styles.addNewTitle}>Request a New Service</Text>
        <Text style={styles.addNewSubtitle}>
          Want to reach more audience? Expand your services.
        </Text>
      </Pressable>
    );
  }

  const categoryToneColor =
    item.categoryTone === "primary"
      ? COLORS.primary
      : item.categoryTone === "blue"
        ? COLORS.blue
        : item.categoryTone === "pink"
          ? COLORS.pink
          : COLORS.gray600;

  return (
    <Pressable
      onPress={onOpenEditService}
      style={({ pressed }) => [
        styles.serviceCard,
        pressed && { opacity: 0.95 },
      ]}
    >
      <View style={styles.tallMedia}>
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={styles.serviceImageCover}
          />
        ) : null}
        <View style={styles.categoryPill}>
          <Text style={[styles.categoryPillText, { color: categoryToneColor }]}>
            {item.category}
          </Text>
        </View>
      </View>
      <View style={styles.tallBody}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              flex: 1,
            }}
          >
            <Text style={styles.serviceTitle}>{item.title}</Text>
            <View style={styles.editIconCircle}>
              <Ionicons
                name="create-outline"
                color={COLORS.textMuted2}
                size={12}
              />
            </View>
          </View>
          <View
            style={[
              styles.stateBadge,
              item.isActive
                ? styles.stateBadgeActive
                : styles.stateBadgeInactive,
            ]}
          >
            <Text
              style={[
                styles.stateBadgeText,
                item.isActive
                  ? styles.stateBadgeTextActive
                  : styles.stateBadgeTextInactive,
              ]}
            >
              {item.isActive ? "Active" : "Not active"}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export const ProviderServicesScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { width } = useWindowDimensions();
  const [providedServices, setProvidedServices] = useState<ServiceCard[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);

  useFocusEffect(
    React.useCallback(() => {
      let alive = true;
      const load = async () => {
        if (alive) setLoadingServices(true);
        try {
          const res = await api.getMyVerificationDocuments();
          const docs = (
            Array.isArray(res.data) ? res.data : []
          ) as ProviderVerificationDoc[];
          const seen = new Set<string>();
          const mapped: ServiceCard[] = [];
          for (const doc of docs) {
            const svc = doc.verificationRequest?.service;
            if (!svc?.id || !svc.name || seen.has(svc.id)) continue;
            seen.add(svc.id);
            mapped.push({
              id: svc.id,
              variant: "tall",
              category: svc.category?.name ?? "Service",
              categoryTone: "primary",
              title: svc.name,
              description: svc.description?.trim() || "",
              priceAed: undefined,
              imageUrl: svc.servicePhoto ?? undefined,
              durationLabel: "—",
              staffLabel: "—",
              isActive: doc.verificationRequest?.requestStatus === "APPROVED",
            });
          }
          if (alive) setProvidedServices(mapped);
        } catch {
          if (alive) setProvidedServices([]);
        } finally {
          if (alive) setLoadingServices(false);
        }
      };
      void load();
      return () => {
        alive = false;
      };
    }, []),
  );

  const services: ServiceCard[] = useMemo(
    () => [
      ...providedServices,
      {
        id: "sAdd",
        variant: "addNew",
        category: "",
        categoryTone: "primary",
        title: "",
        description: "",
      },
    ],
    [providedServices],
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.headerTitle}>Your provided Services</Text>
            <Text style={styles.headerSubtitle}>
              Configure service offerings, pricing and gallery
            </Text>
          </View>
        </View>
        {loadingServices ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
              {services.map((s) => {
                const cardWidth = width - 24 * 2;
                return (
                  <View key={s.id} style={{ width: cardWidth }}>
                    <ServiceCardView
                      item={s}
                      onOpenEditService={() =>
                        navigation.navigate("ProviderManageService", {
                          mode: "edit",
                          serviceId: s.variant === "addNew" ? undefined : s.id,
                          serviceName:
                            s.variant === "addNew" ? undefined : s.title,
                          serviceCategory:
                            s.variant === "addNew" ? undefined : s.category,
                          serviceDescription:
                            s.variant === "addNew" ? undefined : s.description,
                        })
                      }
                      onRequestNewService={() =>
                        Alert.alert(
                          "Coming soon",
                          "This feature will be developed soon.",
                        )
                      }
                    />
                  </View>
                );
              })}
            </View>
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  headerTitle: { fontSize: 18, fontWeight: "800", color: COLORS.text },
  headerSubtitle: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: { padding: 16, paddingBottom: 30, gap: 16 },
  serviceCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    overflow: "hidden",
  },
  serviceImageCover: { width: "100%", height: "100%" },
  serviceTitle: { fontSize: 16, fontWeight: "900", color: "#111827" },
  stateBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  stateBadgeActive: {
    backgroundColor: "#ECFDF5",
    borderColor: "#BBF7D0",
  },
  stateBadgeInactive: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  stateBadgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  stateBadgeTextActive: {
    color: "#15803D",
  },
  stateBadgeTextInactive: {
    color: "#B91C1C",
  },
  editIconCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  tallMedia: { height: 160, backgroundColor: COLORS.surface2 },
  categoryPill: {
    position: "absolute",
    bottom: 12,
    left: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  categoryPillText: { fontSize: 12, fontWeight: "900" },
  tallBody: { padding: 14, gap: 10 },
  addNewCard: {
    minHeight: 165,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#CBD5E1",
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    gap: 8,
  },
  addNewIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  addNewTitle: { fontSize: 16, fontWeight: "900", color: "#111827" },
  addNewSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: "center",
    maxWidth: 250,
  },
});
