import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons, FontAwesome5 as Icon } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ClientStackParamList } from "../../../navigation/types";
import { useAuth } from "../../../context/AuthContext";
import { api } from "../../../services/api";
import { getStoredClientCoords } from "../../../services/client-location-cache";
import type { MarketplaceServiceItem } from "../category-services/types";

type SearchHistoryItem = {
  id: string;
  query: string | null;
  service: MarketplaceServiceItem;
};

export const ClientHomeSearchScreen: React.FC = () => {
  const { session } = useAuth();
  const navigation =
    useNavigation<NativeStackNavigationProp<ClientStackParamList>>();
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [services, setServices] = useState<MarketplaceServiceItem[]>([]);
  const [recentSearches, setRecentSearches] = useState<SearchHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [historyDeleteTarget, setHistoryDeleteTarget] =
    useState<SearchHistoryItem | null>(null);
  const anim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim]);

  React.useEffect(() => {
    let cancelled = false;
    const loadServices = async () => {
      setLoading(true);
      try {
        const res = await api.listServices();
        if (!cancelled) {
          setServices(
            Array.isArray(res.data)
              ? (res.data as MarketplaceServiceItem[])
              : [],
          );
        }
      } catch {
        if (!cancelled) {
          setServices([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void loadServices();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadSearchHistory = React.useCallback(async () => {
    try {
      const res = await api.getClientSearchHistory();
      const rows = Array.isArray(res.data)
        ? (res.data as SearchHistoryItem[])
        : [];
      setRecentSearches(rows.slice(0, 8));
    } catch {
      setRecentSearches([]);
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      void loadSearchHistory();
    }, [loadSearchHistory]),
  );

  React.useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(searchValue);
    }, 200);
    return () => clearTimeout(handle);
  }, [searchValue]);

  const close = () => {
    Animated.timing(anim, {
      toValue: 0,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) navigation.goBack();
    });
  };

  const overlayStyle = {
    opacity: anim,
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [24, 0],
        }),
      },
    ],
  };

  const normalizedSearch = debouncedSearch.trim().toLowerCase();
  const hasInputValue = searchValue.trim().length > 0;

  const filteredServices = useMemo(() => {
    if (!normalizedSearch) return [];
    const tokens = normalizedSearch.split(/\s+/).filter(Boolean);
    return services
      .map((item) => {
        const name = item.name?.toLowerCase() ?? "";
        const score = tokens.reduce((acc, token) => {
          if (name === token) return acc + 10;
          if (name.startsWith(token)) return acc + 6;
          if (name.includes(token)) return acc + 3;
          return acc;
        }, 0);
        return { item, score };
      })
      .filter((entry) => entry.score > 0)
      .sort(
        (a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name),
      )
      .slice(0, 20)
      .map((entry) => entry.item);
  }, [normalizedSearch, services]);

  const onSelectService = async (service: MarketplaceServiceItem) => {
    setSearching(true);
    let clientLat: number | undefined;
    let clientLng: number | undefined;

    try {
      if (session?.user?.id) {
        const coords = await getStoredClientCoords(session.user.id);
        if (coords) {
          clientLat = coords.latitude;
          clientLng = coords.longitude;
        }
      }
    } catch {
      // Continue navigation without coordinates when location fails.
    } finally {
      setSearching(false);
    }

    setRecentSearches((prev) => {
      const deduped = prev.filter((item) => item.service.id !== service.id);
      return [
        {
          id: `temp:${service.id}`,
          query: searchValue.trim() || null,
          service,
        },
        ...deduped,
      ].slice(0, 8);
    });

    navigation.navigate("ClientSearchProvider", {
      serviceId: service.id,
      serviceName: service.name,
      serviceImage: service.servicePhoto ?? undefined,
      clientLat,
      clientLng,
    });

    // Persist in background; do not block navigation.
    const query = searchValue.trim();
    void api
      .addClientSearchHistory({
        serviceId: service.id,
        query: query.length > 0 ? query : undefined,
      })
      .catch(() => {
        // Keep optimistic local list if persistence fails.
      });
  };

  const syncHistoryAfterDelete = React.useCallback(
    async (next: SearchHistoryItem[]) => {
      try {
        await api.clearClientSearchHistory();
        await Promise.all(
          next.map((entry) =>
            api.addClientSearchHistory({
              serviceId: entry.service.id,
              query: entry.query ?? undefined,
            }),
          ),
        );
      } catch {
        // Best-effort background sync.
      }
    },
    [],
  );

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" />
      <Animated.View style={[styles.overlay, overlayStyle]}>
        <View style={styles.overlayHeader}>
          <Pressable onPress={close} style={styles.backButton}>
            <Ionicons name="close" size={18} color="#6B7280" />
          </Pressable>

          <View style={styles.overlayInputWrap}>
            <View style={styles.overlayIconLeft}>
              <Icon name="search" size={12} color="#9CA3AF" />
            </View>
            <TextInput
              placeholder="Search service by name..."
              placeholderTextColor="#9CA3AF"
              style={styles.overlayInput}
              value={searchValue}
              onChangeText={setSearchValue}
              autoFocus
            />
            <Pressable
              style={styles.clearButton}
              onPress={() => setSearchValue("")}
            >
              <Ionicons name="close-circle" size={16} color="#9CA3AF" />
            </Pressable>
          </View>
        </View>

        <View style={styles.overlayBody}>
          {recentSearches.length > 0 && !hasInputValue ? (
            <View style={styles.recentSection}>
              <View style={styles.recentHeader}>
                <Text style={styles.recentTitle}>Recent searches</Text>
                <Pressable
                  onPress={() => {
                    setRecentSearches([]);
                    void api.clearClientSearchHistory();
                  }}
                >
                  <Text style={styles.clearAllText}>Clear all</Text>
                </Pressable>
              </View>
              {recentSearches.map((item) => (
                <Pressable
                  key={item.id}
                  style={styles.serviceRow}
                  disabled={searching}
                  onPress={() => void onSelectService(item.service)}
                  onLongPress={() => setHistoryDeleteTarget(item)}
                  delayLongPress={280}
                  pressRetentionOffset={{ top: 2, left: 2, right: 2, bottom: 2 }}
                >
                  <View style={styles.serviceIconWrap}>
                    <Ionicons name="time-outline" size={14} color="#4F46E5" />
                  </View>
                  <View style={styles.serviceTextWrap}>
                    <Text style={styles.serviceName}>{item.service.name}</Text>
                    <Text style={styles.serviceMeta}>
                      {item.service.category?.name ?? "Service"}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                </Pressable>
              ))}
            </View>
          ) : null}

          {loading ? (
            <View style={styles.centerWrap}>
              <ActivityIndicator color="#4F46E5" />
            </View>
          ) : !normalizedSearch ? (
            <View style={styles.centerWrap}>
              <Text style={styles.hint}>
                Start typing to search services...
              </Text>
            </View>
          ) : filteredServices.length === 0 ? (
            <View style={styles.centerWrap}>
              <Text style={styles.hint}>No matching services found.</Text>
            </View>
          ) : (
            <FlatList
              data={filteredServices}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.serviceRow}
                  activeOpacity={0.8}
                  disabled={searching}
                  onPress={() => void onSelectService(item)}
                >
                  <View style={styles.serviceIconWrap}>
                    <Icon name="tools" size={14} color="#4F46E5" />
                  </View>
                  <View style={styles.serviceTextWrap}>
                    <Text style={styles.serviceName}>{item.name}</Text>
                    <Text style={styles.serviceMeta}>
                      {item.category?.name ?? "Service"}
                    </Text>
                  </View>
                  {searching ? (
                    <ActivityIndicator size="small" color="#4F46E5" />
                  ) : (
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color="#9CA3AF"
                    />
                  )}
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </Animated.View>
      <Modal
        visible={historyDeleteTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setHistoryDeleteTarget(null)}
      >
        <Pressable
          style={styles.confirmBackdrop}
          onPress={() => setHistoryDeleteTarget(null)}
        >
          <Pressable style={styles.confirmCard} onPress={() => undefined}>
            <Text style={styles.confirmTitle}>
              Delete from research history?
            </Text>
            <Text style={styles.confirmSubtitle}>
              This service will be removed from your recent searches.
            </Text>
            <View style={styles.confirmActions}>
              <Pressable
                style={styles.cancelButton}
                onPress={() => setHistoryDeleteTarget(null)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.deleteButton}
                onPress={() => {
                  const target = historyDeleteTarget;
                  setHistoryDeleteTarget(null);
                  if (!target) return;
                  const next = recentSearches.filter(
                    (item) => item.id !== target.id,
                  );
                  setRecentSearches(next);
                  void syncHistoryAfterDelete(next);
                }}
              >
                <Text style={styles.deleteButtonText}>Delete</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFFFF" },
  overlay: { flex: 1, backgroundColor: "#FFFFFF" },
  overlayHeader: {
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F9FAFB",
    alignItems: "center",
    justifyContent: "center",
  },
  overlayInputWrap: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F9FAFB",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
  },
  overlayIconLeft: {
    width: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  overlayInput: {
    flex: 1,
    fontSize: 14,
    color: "#111827",
    fontWeight: "600",
    paddingVertical: 0,
  },
  clearButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  overlayBody: {
    flex: 1,
  },
  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  listContent: { paddingHorizontal: 20, paddingVertical: 12 },
  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  serviceIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  serviceTextWrap: { flex: 1 },
  serviceName: { fontSize: 14, fontWeight: "700", color: "#111827" },
  serviceMeta: { marginTop: 2, fontSize: 12, color: "#6B7280" },
  hint: { color: "#9CA3AF", fontSize: 13, fontWeight: "500" },
  recentSection: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8 },
  recentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  recentTitle: { fontSize: 14, fontWeight: "700", color: "#111827" },
  clearAllText: { fontSize: 12, fontWeight: "600", color: "#4F46E5" },
  confirmBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.42)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  confirmCard: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    shadowColor: "#111827",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  confirmTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
  },
  confirmSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
    marginBottom: 14,
  },
  confirmActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  deleteButton: {
    minWidth: 82,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 11,
    backgroundColor: "#EF4444",
    alignItems: "center",
  },
  deleteButtonText: { color: "#FFF", fontWeight: "700", fontSize: 13 },
  cancelButton: {
    minWidth: 82,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 11,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },
  cancelButtonText: { color: "#374151", fontWeight: "700", fontSize: 13 },
});
