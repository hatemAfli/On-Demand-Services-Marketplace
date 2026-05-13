import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  I18nManager,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";

import type { ClientStackParamList } from "../../navigation/types";
import type { ProviderStackParamList } from "../../navigation/types";
import { COLORS } from "../../constants";
import { useAuth } from "../../context/AuthContext";
import { UserRole } from "../../types";
import { api, type ChatMessage, type MessageStatus } from "../../services/api";
import { uploadChatMessagePhoto } from "../../services/chatMediaUpload";
import {
  useConversationRealtime,
  type IncomingMessage,
} from "../../hooks/useConversationRealtime";

type Props =
  | NativeStackScreenProps<ClientStackParamList, "ChatScreen">
  | NativeStackScreenProps<ProviderStackParamList, "ChatScreen">;

type UiMessage = ChatMessage & { localPreviewUris?: string[] };

type ChatRow =
  | { kind: "msg"; key: string; message: UiMessage; index: number }
  | { kind: "sep"; key: string; label: string };

const PAGE_SIZE = 30;
const MAX_ATTACHMENTS = 3;
const INPUT_MAX_LINES = 5;
const INPUT_LINE_HEIGHT = 22;

function normalizeMessage(raw: unknown): ChatMessage {
  const m = raw as Record<string, unknown>;
  const status = (m.status as MessageStatus) ?? "SENT";
  return {
    id: String(m.id),
    conversationId: String(m.conversationId),
    senderUserId: String(m.senderUserId),
    senderRole: (m.senderRole as "CLIENT" | "PROVIDER") ?? "CLIENT",
    text: (m.text as string | null) ?? null,
    mediaUrls: Array.isArray(m.mediaUrls)
      ? (m.mediaUrls as string[]).filter((u) => typeof u === "string")
      : [],
    status,
    createdAt:
      typeof m.createdAt === "string"
        ? m.createdAt
        : new Date(String(m.createdAt)).toISOString(),
  };
}

function sameCalendarDay(isoA: string, isoB: string): boolean {
  const a = new Date(isoA);
  const b = new Date(isoB);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function daySeparatorLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const startD = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
  ).getTime();
  const diffDays = Math.round((startToday - startD) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function incomingToChatMessage(msg: IncomingMessage): UiMessage {
  return {
    id: msg.id,
    conversationId: msg.conversationId,
    senderUserId: msg.senderUserId,
    senderRole: msg.senderRole,
    text: msg.text,
    mediaUrls: Array.isArray(msg.mediaUrls) ? msg.mediaUrls : [],
    status: msg.status ?? "DELIVERED",
    createdAt: msg.createdAt,
  };
}

function buildRows(messages: UiMessage[]): ChatRow[] {
  const rows: ChatRow[] = [];
  for (let i = 0; i < messages.length; i++) {
    rows.push({
      kind: "msg",
      key: messages[i].id,
      message: messages[i],
      index: i,
    });
    if (
      i < messages.length - 1 &&
      !sameCalendarDay(messages[i].createdAt, messages[i + 1].createdAt)
    ) {
      rows.push({
        kind: "sep",
        key: `sep-${messages[i + 1].id}`,
        label: daySeparatorLabel(messages[i + 1].createdAt),
      });
    }
  }
  return rows;
}

function ReadReceipt({ status }: { status: MessageStatus }) {
  const gray = COLORS.gray[400];
  const blue = COLORS.primary;
  if (status === "READ") {
    return (
      <View style={styles.readRow}>
        <Ionicons name="checkmark-done" size={14} color={blue} />
      </View>
    );
  }
  if (status === "DELIVERED") {
    return (
      <View style={styles.readRow}>
        <Ionicons name="checkmark-done" size={14} color={gray} />
      </View>
    );
  }
  return (
    <View style={styles.readRow}>
      <Ionicons name="checkmark" size={14} color={gray} />
    </View>
  );
}

export const ChatScreen: React.FC<Props> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { conversationId, otherUserName, otherUserPhoto } = route.params;

  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [text, setText] = useState("");
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [oldestCursor, setOldestCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const userIdRef = useRef(user?.id);
  userIdRef.current = user?.id;

  const latestOutgoingIndex = useMemo(() => {
    const uid = user?.id;
    if (!uid) return -1;
    return messages.findIndex((m) => m.senderUserId === uid);
  }, [messages, user?.id]);

  const rows = useMemo(() => buildRows(messages), [messages]);

  const loadInitial = useCallback(async () => {
    setLoadingInitial(true);
    try {
      const res = await api.getMessages(conversationId, PAGE_SIZE);
      const list = Array.isArray(res.data)
        ? res.data.map((m) => normalizeMessage(m))
        : [];
      setMessages(list);
      setHasMore(list.length >= PAGE_SIZE);
      setOldestCursor(
        list.length > 0 ? list[list.length - 1].createdAt : null,
      );
    } catch {
      setMessages([]);
      setHasMore(false);
      setOldestCursor(null);
    } finally {
      setLoadingInitial(false);
    }
  }, [conversationId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadInitial();
      if (cancelled) return;
      try {
        await api.markConversationRead(conversationId);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId, loadInitial]);

  const onNewMessage = useCallback((msg: IncomingMessage) => {
    const uid = userIdRef.current;
    if (!uid) return;
    if (msg.senderUserId === uid) return;
    const next = incomingToChatMessage(msg);
    setMessages((prev) => {
      if (prev.some((m) => m.id === next.id)) return prev;
      return [next, ...prev];
    });
  }, []);

  useConversationRealtime(conversationId, onNewMessage);

  const loadOlder = useCallback(async () => {
    if (!hasMore || loadingMore || !oldestCursor) return;
    setLoadingMore(true);
    try {
      const res = await api.getMessages(
        conversationId,
        PAGE_SIZE,
        oldestCursor,
      );
      const older = Array.isArray(res.data)
        ? res.data.map((m) => normalizeMessage(m))
        : [];
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const merged = older.filter((m) => !seen.has(m.id));
        if (merged.length === 0) {
          queueMicrotask(() => setHasMore(false));
          return prev;
        }
        const next = [...prev, ...merged];
        queueMicrotask(() => {
          setOldestCursor(next[next.length - 1].createdAt);
          setHasMore(older.length >= PAGE_SIZE);
        });
        return next;
      });
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [conversationId, hasMore, loadingMore, oldestCursor]);

  const handleEndReached = useCallback(() => {
    if (!loadingInitial && hasMore && !loadingMore) {
      void loadOlder();
    }
  }, [hasMore, loadOlder, loadingInitial, loadingMore]);

  const pickPhotos = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Permission needed",
        "Allow photo library access to attach images.",
      );
      return;
    }
    const remaining = MAX_ATTACHMENTS - photoUris.length;
    if (remaining <= 0) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: Platform.OS === "ios",
      ...(Platform.OS === "ios" ? { selectionLimit: remaining } : {}),
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.length) return;

    setPhotoUris((prev) => {
      const next = [...prev];
      for (const a of result.assets) {
        if (next.length >= MAX_ATTACHMENTS) break;
        if (a.uri) next.push(a.uri);
      }
      return next;
    });
  }, [photoUris.length]);

  const handleSend = useCallback(async () => {
    const uid = user?.id;
    const role = user?.role;
    if (!uid || (role !== UserRole.CLIENT && role !== UserRole.PROVIDER)) return;

    const trimmed = text.trim();
    const uris = [...photoUris];
    if (!trimmed && uris.length === 0) return;

    const savedText = trimmed;
    const savedUris = [...uris];
    const optimisticId = `local-${Date.now()}`;
    const senderRole = role === UserRole.CLIENT ? "CLIENT" : "PROVIDER";

    setText("");
    setPhotoUris([]);
    setSending(true);

    const optimistic: UiMessage = {
      id: optimisticId,
      conversationId,
      senderUserId: uid,
      senderRole,
      text: savedText.length > 0 ? savedText : null,
      mediaUrls: [],
      status: "SENT",
      createdAt: new Date().toISOString(),
      localPreviewUris: savedUris.length > 0 ? savedUris : undefined,
    };
    setMessages((prev) => [optimistic, ...prev]);

    try {
      let mediaUrls: string[] = [];
      if (savedUris.length > 0) {
        for (const uri of savedUris) {
          const url = await uploadChatMessagePhoto(conversationId, uid, uri);
          mediaUrls.push(url);
        }
      }
      const res = await api.sendMessage({
        conversationId,
        ...(savedText.length > 0 ? { text: savedText } : {}),
        ...(mediaUrls.length > 0 ? { mediaUrls } : {}),
      });
      const real = normalizeMessage(res.data);
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticId ? { ...real } : m)),
      );
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setText(savedText);
      setPhotoUris(savedUris);
      const msg =
        e instanceof Error ? e.message : "Could not send. Try again.";
      Alert.alert("Send failed", msg);
    } finally {
      setSending(false);
    }
  }, [
    conversationId,
    photoUris,
    text,
    user?.id,
    user?.role,
  ]);

  const removePhotoAt = useCallback((ix: number) => {
    setPhotoUris((prev) => prev.filter((_, i) => i !== ix));
  }, []);

  const canSend =
    (text.trim().length > 0 || photoUris.length > 0) && !sending;

  const renderItem = useCallback(
    ({ item }: { item: ChatRow }) => {
      if (item.kind === "sep") {
        return (
          <View style={styles.sepWrap}>
            <View style={styles.sepPill}>
              <Text style={styles.sepText}>{item.label}</Text>
            </View>
          </View>
        );
      }

      const m = item.message;
      const uid = user?.id;
      const isMine = !!uid && m.senderUserId === uid;
      const showCompact =
        item.index < messages.length - 1 &&
        messages[item.index + 1].senderUserId === m.senderUserId;
      const showReceipt =
        isMine && item.index === latestOutgoingIndex;

      const thumbs =
        m.localPreviewUris && m.localPreviewUris.length > 0
          ? m.localPreviewUris
          : m.mediaUrls;

      return (
        <View
          style={[
            styles.bubbleRow,
            isMine ? styles.bubbleRowMine : styles.bubbleRowOther,
            { marginBottom: showCompact ? 4 : 12 },
          ]}
        >
          <View
            style={[
              styles.bubble,
              isMine ? styles.bubbleMine : styles.bubbleOther,
            ]}
          >
            {thumbs.length > 0 ? (
              <View style={styles.thumbRow}>
                {thumbs.map((uri) => (
                  <Pressable
                    key={uri}
                    onPress={() => setPreviewUri(uri)}
                    style={styles.thumbHit}
                  >
                    <Image
                      source={{ uri }}
                      style={styles.thumb}
                      accessibilityLabel="Attachment"
                    />
                  </Pressable>
                ))}
              </View>
            ) : null}
            {m.text ? (
              <Text
                style={[
                  styles.bubbleText,
                  isMine ? styles.bubbleTextMine : styles.bubbleTextOther,
                ]}
              >
                {m.text}
              </Text>
            ) : null}
            <Text
              style={[
                styles.timeInBubble,
                isMine ? styles.timeInBubbleMine : styles.timeInBubbleOther,
              ]}
            >
              {formatTime(m.createdAt)}
            </Text>
            {showReceipt ? <ReadReceipt status={m.status} /> : null}
          </View>
        </View>
      );
    },
    [latestOutgoingIndex, messages, user?.id],
  );

  const inputMaxHeight = INPUT_LINE_HEIGHT * INPUT_MAX_LINES + 16;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons
            name={I18nManager.isRTL ? "chevron-forward" : "chevron-back"}
            size={22}
            color={COLORS.text.primary}
          />
        </TouchableOpacity>
        <View style={styles.headerAvatarWrap}>
          {otherUserPhoto ? (
            <Image
              source={{ uri: otherUserPhoto }}
              style={styles.headerAvatar}
            />
          ) : (
            <View style={[styles.headerAvatar, styles.headerAvatarPh]}>
              <Ionicons name="person" size={16} color={COLORS.gray[500]} />
            </View>
          )}
          <View style={styles.onlineDot} />
        </View>
        <View style={styles.headerTitles}>
          <Text style={styles.headerName} numberOfLines={1}>
            {otherUserName}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 52 : 0}
      >
        {loadingInitial ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <FlatList
            data={rows}
            inverted
            keyExtractor={(r) => r.key}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.25}
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.loadMore}>
                  <ActivityIndicator color={COLORS.primary} />
                </View>
              ) : null
            }
            keyboardShouldPersistTaps="handled"
            maintainVisibleContentPosition={
              Platform.OS === "ios"
                ? { minIndexForVisible: 0, autoscrollToTopThreshold: 48 }
                : undefined
            }
          />
        )}

        {photoUris.length > 0 ? (
          <View style={styles.previewStrip}>
            {photoUris.map((uri, ix) => (
              <View key={uri} style={styles.previewTile}>
                <Image source={{ uri }} style={styles.previewImg} />
                <TouchableOpacity
                  style={styles.previewRemove}
                  onPress={() => removePhotoAt(ix)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={16} color={COLORS.white} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : null}

        <View
          style={[
            styles.inputBar,
            { paddingBottom: Math.max(insets.bottom, 10) },
          ]}
        >
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => void pickPhotos()}
            disabled={photoUris.length >= MAX_ATTACHMENTS}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name="camera-outline"
              size={26}
              color={
                photoUris.length >= MAX_ATTACHMENTS
                  ? COLORS.gray[300]
                  : COLORS.primary
              }
            />
          </TouchableOpacity>
          <TextInput
            style={[styles.input, { maxHeight: inputMaxHeight }]}
            value={text}
            onChangeText={setText}
            placeholder="Write a message…"
            placeholderTextColor={COLORS.text.tertiary}
            multiline
            maxLength={2000}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
            onPress={() => void handleSend()}
            disabled={!canSend}
          >
            {sending ? (
              <ActivityIndicator color={COLORS.white} size="small" />
            ) : (
              <Ionicons name="arrow-up" size={22} color={COLORS.white} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={!!previewUri}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewUri(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setPreviewUri(null)}
        >
          {previewUri ? (
            <Image
              source={{ uri: previewUri }}
              style={styles.modalImage}
              resizeMode="contain"
            />
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 8,
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
  headerAvatarWrap: {
    position: "relative",
    marginEnd: 8,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.gray[100],
  },
  headerAvatarPh: {
    alignItems: "center",
    justifyContent: "center",
  },
  onlineDot: {
    position: "absolute",
    bottom: 0,
    end: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.gray[300],
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  headerTitles: {
    flex: 1,
    minWidth: 0,
  },
  headerName: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.text.primary,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },
  loadMore: {
    paddingVertical: 16,
    alignItems: "center",
  },
  sepWrap: {
    alignItems: "center",
    marginVertical: 12,
  },
  sepPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: COLORS.gray[100],
  },
  sepText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.text.secondary,
  },
  bubbleRow: {
    flexDirection: "row",
    width: "100%",
  },
  bubbleRowMine: { justifyContent: "flex-end" },
  bubbleRowOther: { justifyContent: "flex-start" },
  bubble: {
    maxWidth: "82%",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bubbleMine: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: "#F1F5F9",
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 20,
  },
  bubbleTextMine: { color: COLORS.white },
  bubbleTextOther: { color: COLORS.text.primary },
  timeInBubble: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "600",
  },
  timeInBubbleMine: { color: "rgba(255,255,255,0.75)", alignSelf: "flex-end" },
  timeInBubbleOther: { color: COLORS.text.tertiary, alignSelf: "flex-start" },
  readRow: {
    marginTop: 2,
    alignSelf: "flex-end",
  },
  thumbRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 6,
  },
  thumbHit: { borderRadius: 8, overflow: "hidden" },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: COLORS.gray[200],
  },
  previewStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: COLORS.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  previewTile: {
    position: "relative",
  },
  previewImg: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  previewRemove: {
    position: "absolute",
    top: -6,
    end: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.gray[800],
    alignItems: "center",
    justifyContent: "center",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 8,
    paddingTop: 8,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 6,
  },
  iconBtn: {
    paddingBottom: 10,
    paddingHorizontal: 4,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: INPUT_LINE_HEIGHT * INPUT_MAX_LINES + 16,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    lineHeight: INPUT_LINE_HEIGHT,
    backgroundColor: COLORS.gray[100],
    color: COLORS.text.primary,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginBottom: 2,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    backgroundColor: COLORS.gray[300],
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalImage: {
    width: "100%",
    height: "80%",
  },
});
