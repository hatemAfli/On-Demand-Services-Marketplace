import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ClientStackParamList } from "../../../navigation/types";
import { useAppTranslation } from "../../../hooks/useAppTranslation";
import { api } from "../../../services/api";

const ACCENT = "#EA580C";
const ACCENT_LIGHT = "#FFF7ED";
const ACCENT_BORDER = "#FFEDD5";
const SCREEN_BG = "#F1F5F9";

type Props = NativeStackScreenProps<ClientStackParamList, "ClientCompanyProfile">;

type CompanyProvider = {
  id: string;
  givenServiceId: string;
  displayName: string;
  photoUrl: string | null;
  tagline: string | null;
  city: string;
  averageRating: number;
  totalReviews: number;
  isTopProvider: boolean;
  pricingType: string;
  price: number;
  estimatedDurationMinutes: number | null;
  isAvailableImmediately: boolean | null;
};

type CompanyProfile = {
  id: string;
  companyName: string;
  logo: string | null;
  city: string;
  address: string | null;
  averageRating: number;
  totalReviews: number;
  totalEmployees: number;
  service: {
    serviceId: string;
    serviceName: string | null;
    categoryName: string | null;
    fromPrice: number | null;
    providerCount: number;
  } | null;
  providers: CompanyProvider[];
};

function Stars({ rating, count }: { rating: number; count: number }) {
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((sIdx) => (
        <Ionicons
          key={sIdx}
          name={
            rating >= sIdx
              ? "star"
              : rating >= sIdx - 0.5
                ? "star-half"
                : "star-outline"
          }
          size={13}
          color="#F59E0B"
        />
      ))}
      <Text style={styles.starsCount}>({count})</Text>
    </View>
  );
}

export const ClientCompanyProfileScreen: React.FC<Props> = ({
  route,
  navigation,
}) => {
  const { t } = useAppTranslation();
  const { companyId, serviceId, serviceName } = route.params;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<CompanyProfile | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getClientCompanyProfile(companyId, { serviceId });
      setProfile(res.data as CompanyProfile);
    } catch {
      setError(t("client.companyProfile.loadError"));
    } finally {
      setLoading(false);
    }
  }, [companyId, serviceId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const providers = profile?.providers ?? [];
  const hasProviders = providers.length > 0;
  const representative = providers[0];

  const bookAnyProvider = () => {
    if (!representative) return;
    navigation.navigate("ClientSlotPicker", {
      providerId: null,
      companyId,
      givenServiceId: representative.givenServiceId,
      providerName: profile?.companyName ?? serviceName,
      serviceName: profile?.service?.serviceName ?? serviceName,
      estimatedDurationMinutes: representative.estimatedDurationMinutes ?? 60,
    });
  };

  const viewProviderProfile = (p: CompanyProvider) => {
    navigation.navigate("ClientProviderProfile", {
      givenServiceId: p.givenServiceId,
    });
  };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerSide}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={22} color="#1A1A2E" />
          </TouchableOpacity>
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {t("client.companyProfile.title")}
          </Text>
        </View>
        <View style={styles.headerSide} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      ) : error || !profile ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={36} color="#9B9BB0" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => void load()}>
            <Text style={styles.retryText}>{t("common.retry")}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Company hero */}
          <View style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <View style={styles.logoWrap}>
                {profile.logo ? (
                  <Image source={{ uri: profile.logo }} style={styles.logo} />
                ) : (
                  <View style={styles.logoPlaceholder}>
                    <Ionicons name="business" size={26} color={ACCENT} />
                  </View>
                )}
              </View>
              <View style={styles.heroInfo}>
                <View style={styles.companyBadge}>
                  <Ionicons name="business" size={10} color={ACCENT} />
                  <Text style={styles.companyBadgeText}>
                    {t("client.companyProfile.companyTag")}
                  </Text>
                </View>
                <Text style={styles.companyName} numberOfLines={2}>
                  {profile.companyName}
                </Text>
                <Stars
                  rating={profile.averageRating}
                  count={profile.totalReviews}
                />
              </View>
            </View>

            <View style={styles.heroStatsRow}>
              <View style={styles.heroStat}>
                <Ionicons name="location-outline" size={14} color="#9B9BB0" />
                <Text style={styles.heroStatText}>{profile.city || "—"}</Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStat}>
                <Ionicons name="people-outline" size={14} color="#9B9BB0" />
                <Text style={styles.heroStatText}>
                  {t("client.companyProfile.teamCount", {
                    count: profile.totalEmployees,
                  })}
                </Text>
              </View>
            </View>
          </View>

          {/* Service summary */}
          <View style={styles.serviceCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.serviceLabel}>
                {t("client.companyProfile.serviceLabel")}
              </Text>
              <Text style={styles.serviceName} numberOfLines={1}>
                {profile.service?.serviceName ?? serviceName}
              </Text>
            </View>
            {profile.service?.fromPrice != null ? (
              <View style={styles.priceBlock}>
                <Text style={styles.priceLabel}>
                  {t("client.companyProfile.from")}
                </Text>
                <Text style={styles.priceValue}>
                  {profile.service.fromPrice}
                </Text>
              </View>
            ) : null}
          </View>

          {hasProviders ? (
            <>
              {/* Any-provider CTA */}
              <TouchableOpacity
                style={styles.anyProviderCard}
                activeOpacity={0.9}
                onPress={bookAnyProvider}
              >
                <View style={styles.anyProviderIcon}>
                  <Ionicons name="flash" size={20} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.anyProviderTitle}>
                    {t("client.companyProfile.anyProviderTitle")}
                  </Text>
                  <Text style={styles.anyProviderSub}>
                    {t("client.companyProfile.anyProviderSub")}
                  </Text>
                </View>
                <Ionicons name="arrow-forward" size={18} color={ACCENT} />
              </TouchableOpacity>

              {/* Provider list */}
              <Text style={styles.sectionTitle}>
                {t("client.companyProfile.chooseProvider")}
              </Text>
              {providers.map((p) => {
                const initials = p.displayName
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();
                return (
                  <View key={p.id} style={styles.providerCard}>
                    <View style={styles.avatarWrap}>
                      {p.photoUrl ? (
                        <Image
                          source={{ uri: p.photoUrl }}
                          style={styles.avatar}
                        />
                      ) : (
                        <View style={styles.avatarPlaceholder}>
                          <Text style={styles.avatarInitials}>{initials}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.providerBody}>
                      <View style={styles.providerNameRow}>
                        <Text style={styles.providerName} numberOfLines={1}>
                          {p.displayName}
                        </Text>
                        {p.isTopProvider ? (
                          <Ionicons name="medal" size={13} color="#B45309" />
                        ) : null}
                      </View>
                      <Stars rating={p.averageRating} count={p.totalReviews} />
                      <View style={styles.providerFooter}>
                        <View style={styles.priceRow}>
                          <Text style={styles.providerPrice}>{p.price}</Text>
                          <Text style={styles.providerPricingType}>
                            {p.pricingType === "HOURLY"
                              ? t("client.categoryServices.unitHour")
                              : t("client.searchProvider.pricingFixed")}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.viewBtn}
                          activeOpacity={0.85}
                          onPress={() => viewProviderProfile(p)}
                        >
                          <Text style={styles.viewBtnText}>
                            {t("client.companyProfile.view")}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })}
            </>
          ) : (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                <Ionicons name="people-outline" size={30} color="#9B9BB0" />
              </View>
              <Text style={styles.emptyTitle}>
                {t("client.companyProfile.emptyTitle")}
              </Text>
              <Text style={styles.emptySub}>
                {t("client.companyProfile.emptySub")}
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SCREEN_BG },
  header: {
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EBEBF5",
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
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#EBEBF5",
    backgroundColor: SCREEN_BG,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1A1A2E",
    textAlign: "center",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  errorText: { color: "#DC2626", fontSize: 14, fontWeight: "600" },
  retryBtn: {
    marginTop: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: ACCENT,
  },
  retryText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },

  scrollContent: { padding: 16, paddingBottom: 36, gap: 16 },

  /* Hero */
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#EBEBF5",
    padding: 16,
    gap: 14,
  },
  heroTopRow: { flexDirection: "row", gap: 14 },
  logoWrap: {
    width: 72,
    height: 72,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
  },
  logo: { width: "100%", height: "100%" },
  logoPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: ACCENT_LIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  heroInfo: { flex: 1, gap: 6 },
  companyBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: ACCENT_LIGHT,
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
  },
  companyBadgeText: { fontSize: 10, fontWeight: "800", color: ACCENT },
  companyName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1A1A2E",
    letterSpacing: -0.3,
  },
  starsRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  starsCount: { fontSize: 11, color: "#9B9BB0", fontWeight: "600", marginLeft: 3 },
  heroStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: SCREEN_BG,
    paddingTop: 12,
  },
  heroStat: { flexDirection: "row", alignItems: "center", gap: 5 },
  heroStatText: { fontSize: 12, color: "#6B6B80", fontWeight: "600" },
  heroStatDivider: { width: 1, height: 16, backgroundColor: "#EBEBF5" },

  /* Service summary */
  serviceCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EBEBF5",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  serviceLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#9B9BB0",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  serviceName: { fontSize: 16, fontWeight: "800", color: "#1A1A2E", marginTop: 2 },
  priceBlock: { alignItems: "flex-end" },
  priceLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#9B9BB0",
    textTransform: "uppercase",
  },
  priceValue: { fontSize: 20, fontWeight: "800", color: ACCENT },

  /* Any provider CTA */
  anyProviderCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: ACCENT_BORDER,
    padding: 14,
  },
  anyProviderIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  anyProviderTitle: { fontSize: 14, fontWeight: "800", color: "#1A1A2E" },
  anyProviderSub: {
    fontSize: 12,
    color: "#9B9BB0",
    fontWeight: "500",
    marginTop: 2,
  },

  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1A1A2E",
    marginTop: 4,
  },

  /* Provider card */
  providerCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EBEBF5",
    padding: 12,
  },
  avatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
  },
  avatar: { width: "100%", height: "100%" },
  avatarPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: ACCENT_LIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: { fontSize: 15, fontWeight: "800", color: ACCENT },
  providerBody: { flex: 1, gap: 6 },
  providerNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  providerName: { fontSize: 15, fontWeight: "800", color: "#1A1A2E", flexShrink: 1 },
  providerFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  providerPrice: { fontSize: 17, fontWeight: "800", color: "#1A1A2E" },
  providerPricingType: { fontSize: 11, fontWeight: "600", color: "#9B9BB0" },
  viewBtn: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: ACCENT,
  },
  viewBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },

  /* Empty */
  emptyWrap: { alignItems: "center", paddingTop: 40, gap: 10 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: ACCENT_LIGHT,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: ACCENT_BORDER,
  },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: "#1A1A2E" },
  emptySub: {
    fontSize: 13,
    color: "#9B9BB0",
    textAlign: "center",
    lineHeight: 19,
    paddingHorizontal: 24,
  },
});
