import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  useFocusEffect,
  useNavigation,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../../constants";
import { useAuth } from "../../context/AuthContext";
import { api, type ConversationListItem } from "../../services/api";
import { UserRole } from "../../types";

type ChatNav = NativeStackNavigationProp<{
  ChatScreen: {
    conversationId: string;
    otherUserName: string;
    otherUserPhoto: string | null;
  };
}>;

function buildName(first?: string | null, last?: string | null): string {
  return [first, last].filter(Boolean).join(" ").trim() || "?";
}

function initials(first?: string | null, last?: string | null): string {
  const a = first?.trim()?.charAt(0) ?? "";
  const b = last?.trim()?.charAt(0) ?? "";
  const out = (a + b).toUpperCase();
  return out || "?";
}

function formatConversationTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const t = d.getTime();
  if (Number.isNaN(t)) return "";

  const now = new Date();
  const startToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const startMsg = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffMs = now.getTime() - t;
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "Now";
  if (diffMin < 60) return `${diffMin} min`;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yStart = new Date(
    yesterday.getFullYear(),
    yesterday.getMonth(),
    yesterday.getDate(),
  ).getTime();
  if (startMsg === yStart) return "Yesterday";

  if (startMsg === startToday) {
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (diffMin < 24 * 60 * 7) {
    return d.toLocaleDateString(undefined, { weekday: "short" });
  }

  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export const ConversationListScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const navigation = useNavigation<ChatNav>();

  const role = user?.role;
  const isClient = role === UserRole.CLIENT;

  const [items, setItems] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.getMyConversations();
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  const totalUnread = useMemo(() => {
    if (!user || (user.role !== UserRole.CLIENT && user.role !== UserRole.PROVIDER))
      return 0;
    return items.reduce((acc, row) => {
      const n =
        user.role === UserRole.CLIENT ? row.unreadClient : row.unreadProvider;
      return acc + (typeof n === "number" ? n : 0);
    }, 0);
  }, [items, user]);

  const otherParty = useCallback(
    (row: ConversationListItem) => {
      if (isClient) {
        return {
          name: buildName(
            row.provider.user.firstName,
            row.provider.user.lastName,
          ),
          photo: row.provider.photoUrl,
        };
      }
      return {
        name: buildName(row.client.user.firstName, row.client.user.lastName),
        photo: row.client.imageUrl,
      };
    },
    [isClient],
  );

  const senderIsCurrentUser = useCallback(
    (sender: ConversationListItem["lastMessageSender"]) => {
      if (!sender || !role) return false;
      if (role === UserRole.CLIENT) return sender === "CLIENT";
      if (role === UserRole.PROVIDER) return sender === "PROVIDER";
      return false;
    },
    [role],
  );

  const unreadForRow = useCallback(
    (row: ConversationListItem) => {
      if (isClient) return row.unreadClient ?? 0;
      return row.unreadProvider ?? 0;
    },
    [isClient],
  );

  const openChat = useCallback(
    (row: ConversationListItem) => {
      const o = otherParty(row);
      navigation.navigate("ChatScreen", {
        conversationId: row.id,
        otherUserName: o.name,
        otherUserPhoto: o.photo ?? null,
      });
    },
    [navigation, otherParty],
  );

  const renderRow = useCallback(
    ({ item }: { item: ConversationListItem }) => {
      const o = otherParty(item);
      const unread = unreadForRow(item);
      const previewRaw = item.lastMessageText?.trim() || "";
      const preview =
        item.lastMessageText == null && !previewRaw
          ? "No messages yet"
          : senderIsCurrentUser(item.lastMessageSender)
            ? `You: ${previewRaw || "📷 Photo"}`
            : previewRaw || "📷 Photo";
      const timeLabel = formatConversationTime(item.lastMessageAt);

      return (
        <TouchableOpacity
          style={styles.row}
          onPress={() => openChat(item)}
          activeOpacity={0.88}
        >
          <View style={styles.avatarWrap}>
            {o.photo ? (
              <Image source={{ uri: o.photo }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitials}>
                  {initials(
                    isClient
                      ? item.provider.user.firstName
                      : item.client.user.firstName,
                    isClient
                      ? item.provider.user.lastName
                      : item.client.user.lastName,
                  )}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.rowBody}>
            <View style={styles.rowTop}>
              <Text
                style={[styles.name, unread > 0 && styles.nameUnread]}
                numberOfLines={1}
              >
                {o.name}
              </Text>
              <Text style={styles.time}>{timeLabel}</Text>
            </View>
            <View style={styles.rowBottom}>
              <Text style={styles.preview} numberOfLines={2}>
                {preview}
              </Text>
              <View style={styles.rowMeta}>
                {unread > 0 ? (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>
                      {unread > 99 ? "99+" : String(unread)}
                    </Text>
                  </View>
                ) : null}
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={COLORS.gray[400]}
                />
              </View>
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [isClient, openChat, otherParty, senderIsCurrentUser, unreadForRow],
  );

  if (!user || (user.role !== UserRole.CLIENT && user.role !== UserRole.PROVIDER)) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.muted}>Sign in as a client or provider to view messages.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Messages</Text>
        {totalUnread > 0 ? (
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>
              {totalUnread > 99 ? "99+" : String(totalUnread)}
            </Text>
          </View>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          renderItem={renderRow}
          contentContainerStyle={[
            styles.listContent,
            items.length === 0 && styles.listEmpty,
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name="chatbubbles-outline"
                  size={40}
                  color={COLORS.gray[400]}
                />
              </View>
              <Text style={styles.emptyTitle}>No conversations yet</Text>
              <Text style={styles.emptySub}>
                When you message a provider or client, your chats will appear here.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    marginLeft: 4,
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.text.primary,
  },
  headerSpacer: { width: 36 },
  headerBadge: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBadgeText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "800",
  },
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
  },
  listEmpty: {
    flexGrow: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.gray[100],
    padding: 12,
    marginBottom: 10,
  },
  avatarWrap: {
    marginRight: 12,
  },
  avatarImg: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.gray[100],
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.gray[100],
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.primary,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text.primary,
  },
  nameUnread: {
    fontWeight: "800",
  },
  time: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.text.tertiary,
  },
  rowBottom: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: 4,
    gap: 8,
  },
  preview: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.text.secondary,
  },
  rowMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadBadgeText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: "800",
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingTop: 48,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.gray[100],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text.primary,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.text.secondary,
    textAlign: "center",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  muted: {
    fontSize: 14,
    color: COLORS.text.secondary,
    textAlign: "center",
  },
});
