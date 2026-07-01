import React, { useCallback, useLayoutEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ClientStackParamList } from "../../../navigation/types";
import { api } from "../../../services/api";
import {
  getCachedData,
  invalidateCache,
  peekCachedData,
} from "../../../services/client-data-cache";

type Props = NativeStackScreenProps<
  ClientStackParamList,
  "ClientFavoritesList"
>;
type FavoriteType = "CATEGORY" | "SERVICE" | "PROVIDER";

type FavoriteItem = {
  id: string;
  type: FavoriteType;
  targetId: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  givenServiceId?: string;
  createdAt: string;
};

function getInitial(title: string): string {
  const c = title.trim().charAt(0);
  return c ? c.toUpperCase() : "?";
}

function screenTitle(type: FavoriteType): string {
  if (type === "CATEGORY") return "Favorite Categories";
  if (type === "SERVICE") return "Favorite Services";
  return "Favorite Providers";
}

/* type → accent color mapping */
function typeAccent(type: FavoriteType) {
  if (type === "CATEGORY")
    return { bg: "#FAF3EB", text: "#C4956A", border: "#EDE3D6" };
  if (type === "SERVICE")
    return { bg: "#F0F5F2", text: "#7C9E8F", border: "#D0E4DC" };
  return { bg: "#F4F2F9", text: "#9B8BB0", border: "#DDD9EC" };
}

export const ClientFavoritesListScreen: React.FC<Props> = ({
  route,
  navigation,
}) => {
  const { type } = route.params;
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<FavoriteItem | null>(null);
  const [clearModalVisible, setClearModalVisible] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const load = useCallback(async () => {
    const cacheKey = `favorites:${type}`;
    try {
      if (!refreshing) setLoading(true);
      if (!refreshing) {
        const cached = peekCachedData<{ items: FavoriteItem[] }>(cacheKey);
        if (cached?.items) setItems(cached.items);
      }
      const data = await getCachedData(
        cacheKey,
        async () => {
          const res = await api.getClientFavorites({ type });
          return { items: (res.data?.items ?? []) as FavoriteItem[] };
        },
        5 * 60 * 1000,
        { forceRefresh: refreshing },
      );
      setItems(data.items);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing, type]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  const title = useMemo(() => screenTitle(type), [type]);
  const accent = useMemo(() => typeAccent(type), [type]);

  const removeOne = useCallback((item: FavoriteItem) => {
    setPendingRemove(item);
  }, []);

  const removeAll = useCallback(() => {
    if (items.length === 0) return;
    setClearModalVisible(true);
  }, [items.length, type]);

  const confirmRemoveOne = useCallback(async () => {
    if (!pendingRemove) return;
    try {
      setBusyId(pendingRemove.id);
      await api.deleteClientFavorite(pendingRemove.type, pendingRemove.targetId);
      await invalidateCache(`favorites:${pendingRemove.type}`);
      await invalidateCache("favorites:");
      setItems((prev) => prev.filter((x) => x.id !== pendingRemove.id));
      setPendingRemove(null);
    } finally {
      setBusyId(null);
    }
  }, [pendingRemove]);

  const confirmClearAll = useCallback(async () => {
    try {
      setClearing(true);
      await api.clearClientFavorites(type);
      await invalidateCache(`favorites:${type}`);
      await invalidateCache("favorites:");
      setItems([]);
      setClearModalVisible(false);
    } finally {
      setClearing(false);
    }
  }, [type]);

  const openFavorite = useCallback(
    (item: FavoriteItem) => {
      if (item.type === "CATEGORY") {
        navigation.navigate("ClientCategoryServices", {
          categoryId: item.targetId,
          categoryName: item.title,
        });
        return;
      }
      if (item.type === "SERVICE") {
        navigation.navigate("ClientSearchProvider", {
          serviceId: item.targetId,
          serviceName: item.title,
          serviceImage: item.imageUrl ?? undefined,
        });
        return;
      }
      if (item.givenServiceId) {
        navigation.navigate("ClientProviderProfile", {
          givenServiceId: item.givenServiceId,
        });
      }
    },
    [navigation],
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.loaderWrap} edges={["top", "bottom"]}>
        <ActivityIndicator size="large" color="#C4956A" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      {/* ── Header ── */}
      <View style={styles.listHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.85}
        >
          <Ionicons name="chevron-back" size={20} color="#1C1917" />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.listTitle}>{title}</Text>
          <Text style={styles.listSubtitle}>
            {items.length} saved {type.toLowerCase()}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.clearAllBtn,
            (items.length === 0 || clearing) && { opacity: 0.4 },
          ]}
          onPress={removeAll}
          disabled={items.length === 0 || clearing}
          activeOpacity={0.85}
        >
          {clearing ? (
            <ActivityIndicator size="small" color="#B91C1C" />
          ) : (
            <>
              <Ionicons name="trash-outline" size={13} color="#B91C1C" />
              <Text style={styles.clearAllText}>Clear all</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Divider ── */}
      <View style={styles.headerDivider} />

      {/* ── List ── */}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#C4956A"
            colors={["#C4956A"]}
          />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View
              style={[
                styles.emptyIconRing,
                { borderColor: accent.border, backgroundColor: accent.bg },
              ]}
            >
              <Ionicons name="heart-outline" size={28} color={accent.text} />
            </View>
            <Text style={styles.emptyTitle}>Nothing saved yet</Text>
            <Text style={styles.emptyText}>
              Start adding favorites and they will appear here.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const imageUri = item.imageUrl?.trim() ?? "";
          const isBusy = busyId === item.id;
          return (
            <View style={styles.favoriteItem}>
              <TouchableOpacity
                style={styles.itemMainPressable}
                activeOpacity={0.85}
                onPress={() => openFavorite(item)}
                disabled={type === "PROVIDER" && !item.givenServiceId}
              >
                {/* Thumbnail */}
                <View style={styles.thumbWrap}>
                  {imageUri ? (
                    <Image source={{ uri: imageUri }} style={styles.thumbImage} />
                  ) : (
                    <View
                      style={[
                        styles.thumbFallback,
                        { backgroundColor: accent.bg },
                      ]}
                    >
                      <Text style={[styles.thumbInitial, { color: accent.text }]}>
                        {getInitial(item.title)}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Meta */}
                <View style={styles.itemMeta}>
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {item.subtitle ? (
                    <Text style={styles.itemSubtitle} numberOfLines={1}>
                      {item.subtitle}
                    </Text>
                  ) : null}
                  <View
                    style={[
                      styles.typePill,
                      { backgroundColor: accent.bg, borderColor: accent.border },
                    ]}
                  >
                    <Text style={[styles.typePillText, { color: accent.text }]}>
                      {type.charAt(0) + type.slice(1).toLowerCase()}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              {/* Delete */}
              <TouchableOpacity
                style={[styles.deleteBtn, isBusy && { opacity: 0.5 }]}
                onPress={() => removeOne(item)}
                disabled={isBusy}
                activeOpacity={0.8}
              >
                {isBusy ? (
                  <ActivityIndicator size="small" color="#B91C1C" />
                ) : (
                  <Ionicons
                    name="heart-dislike-outline"
                    size={18}
                    color="#B91C1C"
                  />
                )}
              </TouchableOpacity>
            </View>
          );
        }}
      />

      <Modal
        visible={pendingRemove !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingRemove(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setPendingRemove(null)}
        >
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Remove favorite</Text>
            <Text style={styles.modalText}>
              {pendingRemove
                ? `Remove "${pendingRemove.title}" from favorites?`
                : ""}
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                activeOpacity={0.85}
                onPress={() => setPendingRemove(null)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalDangerBtn}
                activeOpacity={0.85}
                onPress={() => {
                  void confirmRemoveOne();
                }}
                disabled={busyId !== null}
              >
                {busyId !== null ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalDangerText}>Remove</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={clearModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setClearModalVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setClearModalVisible(false)}
        >
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Remove all favorites</Text>
            <Text style={styles.modalText}>
              {`Remove all ${type.toLowerCase()} favorites?`}
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                activeOpacity={0.85}
                onPress={() => setClearModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalDangerBtn}
                activeOpacity={0.85}
                onPress={() => {
                  void confirmClearAll();
                }}
                disabled={clearing}
              >
                {clearing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalDangerText}>Remove all</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FAFAF8",
  },
  loaderWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FAFAF8",
  },

  /* ── Header ── */
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingBottom: 14,
    paddingTop: 4,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8E6E1",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1C1917",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  listTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1C1917",
    letterSpacing: -0.5,
  },
  listSubtitle: {
    marginTop: 2,
    color: "#A8A29E",
    fontSize: 12,
    fontWeight: "500",
  },
  clearAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  clearAllText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#B91C1C",
  },
  headerDivider: {
    height: 1,
    backgroundColor: "#F0EDE8",
    marginHorizontal: 20,
    marginBottom: 14,
  },

  /* ── List ── */
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 10,
  },

  /* ── Favorite item ── */
  favoriteItem: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#F0EDE8",
    backgroundColor: "#FFFFFF",
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    shadowColor: "#1C1917",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  itemMainPressable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  thumbWrap: {
    width: 56,
    height: 56,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#F5F3EF",
    flexShrink: 0,
  },
  thumbImage: {
    width: "100%",
    height: "100%",
  },
  thumbFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbInitial: {
    fontSize: 22,
    fontWeight: "800",
  },
  itemMeta: {
    flex: 1,
    gap: 3,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1C1917",
    letterSpacing: -0.2,
  },
  itemSubtitle: {
    fontSize: 12,
    color: "#A8A29E",
    fontWeight: "400",
  },
  typePill: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 3,
  },
  typePillText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  deleteBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  /* ── Empty state ── */
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 96,
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyIconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#1C1917",
    letterSpacing: -0.4,
  },
  emptyText: {
    fontSize: 13,
    color: "#A8A29E",
    textAlign: "center",
    lineHeight: 19,
    fontWeight: "400",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.34)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E8E6E1",
    padding: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1C1917",
    marginBottom: 8,
  },
  modalText: {
    fontSize: 13,
    color: "#78716C",
    lineHeight: 19,
  },
  modalActions: {
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  modalCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E7E5E4",
    backgroundColor: "#FFFFFF",
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#57534E",
  },
  modalDangerBtn: {
    minWidth: 96,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
  },
  modalDangerText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
