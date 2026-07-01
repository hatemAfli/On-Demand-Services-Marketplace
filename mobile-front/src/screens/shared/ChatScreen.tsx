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
  Dimensions,
  FlatList,
  I18nManager,
  Image,
  Keyboard,
  type KeyboardEvent,
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
import { ChatMessageActionSheet } from "../../components/chat/ChatMessageActionSheet";
import { ConfirmModal } from "../../components/common/ConfirmModal";

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

/** Distance from the bottom of the window to the top of the keyboard. */
function keyboardInsetFromEvent(e: KeyboardEvent): number {
  const { height, screenY } = e.endCoordinates;
  const windowH = Dimensions.get("window").height;
  const fromWindow = Math.max(0, windowH - screenY);
  if (height > 0) return Math.max(height, fromWindow);
  return fromWindow;
}

function normalizeMessage(raw: unknown): ChatMessage {
  const m = raw as Record<string, unknown>;
  const status = (m.status as MessageStatus) ?? "SENT";
  const editedAt =
    typeof m.editedAt === "string"
      ? m.editedAt
      : m.editedAt != null
        ? new Date(String(m.editedAt)).toISOString()
        : null;
  const deletedAt =
    typeof m.deletedAt === "string"
      ? m.deletedAt
      : m.deletedAt != null
        ? new Date(String(m.deletedAt)).toISOString()
        : null;
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
    editedAt,
    deletedAt,
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
    editedAt: msg.editedAt ?? null,
    deletedAt: msg.deletedAt ?? null,
  };
}

function isWithdrawn(m: UiMessage): boolean {
  return m.deletedAt != null;
}

function statusLabel(status: MessageStatus): string {
  if (status === "READ") return "Read";
  if (status === "DELIVERED") return "Delivered";
  return "Sent";
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

function MessageMeta({
  createdAt,
  editedAt,
  status,
  isMine,
  showStatus = isMine,
}: {
  createdAt: string;
  editedAt?: string | null;
  status: MessageStatus;
  isMine: boolean;
  showStatus?: boolean;
}) {
  return (
    <View style={[styles.metaRow, !isMine && styles.metaRowOther]}>
      <Text
        style={[
          styles.timeInBubble,
          isMine ? styles.timeInBubbleMine : styles.timeInBubbleOther,
        ]}
      >
        {formatTime(createdAt)}
        {editedAt ? " · Edited" : ""}
      </Text>
      {showStatus ? (
        <Text style={styles.statusLabel}>{statusLabel(status)}</Text>
      ) : null}
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
  const [composerHeight, setComposerHeight] = useState(72);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [editingMessage, setEditingMessage] = useState<UiMessage | null>(null);
  const [editText, setEditText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [actionMenuMessage, setActionMenuMessage] = useState<UiMessage | null>(
    null,
  );
  const [withdrawTarget, setWithdrawTarget] = useState<UiMessage | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);

  const userIdRef = useRef(user?.id);
  userIdRef.current = user?.id;

  const conversationIdRef = useRef(conversationId);
  conversationIdRef.current = conversationId;

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
      const uid = userIdRef.current;
      if (uid) {
        const toDeliver = list
          .filter((m) => m.senderUserId !== uid && m.status === "SENT")
          .map((m) => m.id);
        if (toDeliver.length > 0) {
          void api
            .markMessagesDelivered(conversationId, toDeliver)
            .catch(() => {});
        }
      }
    } catch {
      setMessages([]);
      setHasMore(false);
      setOldestCursor(null);
    } finally {
      setLoadingInitial(false);
    }
  }, [conversationId]);

  useEffect(() => {
    const onShow = (e: KeyboardEvent) => {
      setKeyboardInset(keyboardInsetFromEvent(e));
    };
    const onHide = () => setKeyboardInset(0);

    const subs = [
      Keyboard.addListener("keyboardDidShow", onShow),
      Keyboard.addListener("keyboardDidHide", onHide),
    ];
    if (Platform.OS === "ios") {
      subs.push(
        Keyboard.addListener("keyboardWillShow", onShow),
        Keyboard.addListener("keyboardWillHide", onHide),
      );
    }

    return () => subs.forEach((s) => s.remove());
  }, []);

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
    const cid = conversationIdRef.current;
    void api.markMessagesDelivered(cid, [msg.id]).catch(() => {});
    void api.markConversationRead(cid).catch(() => {});
  }, []);

  const onMessagesStatus = useCallback(
    (payload: { messageIds: string[]; status: MessageStatus }) => {
      const ids = new Set(payload.messageIds);
      setMessages((prev) =>
        prev.map((m) =>
          ids.has(m.id) ? { ...m, status: payload.status } : m,
        ),
      );
    },
    [],
  );

  const onMessageUpdated = useCallback((msg: IncomingMessage) => {
    const next = incomingToChatMessage(msg);
    setMessages((prev) =>
      prev.map((m) => (m.id === next.id ? { ...m, ...next } : m)),
    );
  }, []);

  const onMessageWithdrawn = useCallback(
    (payload: { id: string; deletedAt: string | null }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === payload.id
            ? {
                ...m,
                deletedAt: payload.deletedAt,
                text: null,
                mediaUrls: [],
                localPreviewUris: undefined,
              }
            : m,
        ),
      );
    },
    [],
  );

  useConversationRealtime(conversationId, {
    onNewMessage,
    onMessagesStatus,
    onMessageUpdated,
    onMessageWithdrawn,
  });

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

  const openEditModal = useCallback((m: UiMessage) => {
    setEditingMessage(m);
    setEditText(m.text ?? "");
  }, []);

  const closeEditModal = useCallback(() => {
    if (savingEdit) return;
    setEditingMessage(null);
    setEditText("");
  }, [savingEdit]);

  const handleSaveEdit = useCallback(async () => {
    if (!editingMessage) return;
    const trimmed = editText.trim();
    if (!trimmed) {
      Alert.alert("Empty message", "Message text cannot be empty.");
      return;
    }
    setSavingEdit(true);
    try {
      const res = await api.updateChatMessage(editingMessage.id, trimmed);
      const updated = normalizeMessage(res.data);
      setMessages((prev) =>
        prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)),
      );
      closeEditModal();
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Could not update message.";
      Alert.alert("Update failed", msg);
    } finally {
      setSavingEdit(false);
    }
  }, [closeEditModal, editText, editingMessage]);

  const confirmWithdraw = useCallback((m: UiMessage) => {
    setWithdrawTarget(m);
  }, []);

  const closeActionMenu = useCallback(() => {
    setActionMenuMessage(null);
  }, []);

  const handleWithdrawConfirm = useCallback(async () => {
    if (!withdrawTarget) return;
    setWithdrawing(true);
    try {
      const res = await api.withdrawChatMessage(withdrawTarget.id);
      const updated = normalizeMessage(res.data);
      setMessages((prev) =>
        prev.map((item) =>
          item.id === updated.id ? { ...item, ...updated } : item,
        ),
      );
      setWithdrawTarget(null);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Could not withdraw message.";
      Alert.alert("Withdraw failed", msg);
    } finally {
      setWithdrawing(false);
    }
  }, [withdrawTarget]);

  const handleMessageLongPress = useCallback(
    (m: UiMessage) => {
      const uid = user?.id;
      if (!uid || m.senderUserId !== uid) return;
      if (isWithdrawn(m) || m.id.startsWith("local-")) return;
      setActionMenuMessage(m);
    },
    [user?.id],
  );

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
      const withdrawn = isWithdrawn(m);
      const showCompact =
        item.index < messages.length - 1 &&
        messages[item.index + 1].senderUserId === m.senderUserId;

      const thumbs =
        !withdrawn && m.localPreviewUris && m.localPreviewUris.length > 0
          ? m.localPreviewUris
          : !withdrawn
            ? m.mediaUrls
            : [];

      return (
        <View
          style={[
            styles.bubbleRow,
            isMine ? styles.bubbleRowMine : styles.bubbleRowOther,
            { marginBottom: showCompact ? 4 : 12 },
          ]}
        >
          <Pressable
            onLongPress={
              isMine && !withdrawn
                ? () => handleMessageLongPress(m)
                : undefined
            }
            delayLongPress={350}
            style={[
              styles.bubble,
              isMine ? styles.bubbleMine : styles.bubbleOther,
              withdrawn ? styles.bubbleWithdrawn : null,
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
            {withdrawn ? (
              <Text
                style={[
                  styles.bubbleText,
                  styles.withdrawnText,
                  isMine ? styles.bubbleTextMine : styles.bubbleTextOther,
                ]}
              >
                This message was withdrawn
              </Text>
            ) : m.text ? (
              <Text
                style={[
                  styles.bubbleText,
                  isMine ? styles.bubbleTextMine : styles.bubbleTextOther,
                ]}
              >
                {m.text}
              </Text>
            ) : null}
            <MessageMeta
              createdAt={m.createdAt}
              editedAt={withdrawn ? null : m.editedAt}
              status={m.status}
              isMine={isMine}
              showStatus={isMine && !withdrawn}
            />
          </Pressable>
        </View>
      );
    },
    [handleMessageLongPress, messages, user?.id],
  );

  const inputMaxHeight = INPUT_LINE_HEIGHT * INPUT_MAX_LINES + 16;

  const keyboardOpen = keyboardInset > 0;
  const composerBottom = keyboardOpen ? keyboardInset : 0;
  const composerInnerPad = keyboardOpen ? 0 : Math.max(insets.bottom, 10);
  // Inverted list: paddingTop = space above composer (newest messages at visual bottom).
  const listComposerPad =
    composerHeight +
    composerInnerPad +
    (keyboardOpen ? keyboardInset : 0) +
    16;

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

      <View style={styles.body}>
        {loadingInitial ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <FlatList
            style={styles.flex}
            data={rows}
            inverted
            keyExtractor={(r) => r.key}
            renderItem={renderItem}
            contentContainerStyle={[
              styles.listContent,
              { paddingTop: listComposerPad },
            ]}
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
            keyboardDismissMode="interactive"
            maintainVisibleContentPosition={
              Platform.OS === "ios"
                ? { minIndexForVisible: 0, autoscrollToTopThreshold: 48 }
                : undefined
            }
          />
        )}

        {!loadingInitial ? (
          <View
            style={[
              styles.composerWrap,
              { bottom: composerBottom, paddingBottom: composerInnerPad },
            ]}
          >
            <View
              style={styles.composer}
              onLayout={(e) => {
                const h = e.nativeEvent.layout.height;
                if (h > 0 && Math.abs(h - composerHeight) > 1) {
                  setComposerHeight(h);
                }
              }}
            >
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

              <View style={styles.inputBar}>
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
            </View>
          </View>
        ) : null}
      </View>

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

      <Modal
        visible={!!editingMessage}
        transparent
        animationType="slide"
        onRequestClose={closeEditModal}
      >
        <View style={styles.editModalBackdrop}>
          <View style={styles.editModalCard}>
            <Text style={styles.editModalTitle}>Edit message</Text>
            <TextInput
              style={styles.editModalInput}
              value={editText}
              onChangeText={setEditText}
              multiline
              maxLength={2000}
              autoFocus
            />
            <View style={styles.editModalActions}>
              <TouchableOpacity
                style={styles.editModalBtnSecondary}
                onPress={closeEditModal}
                disabled={savingEdit}
              >
                <Text style={styles.editModalBtnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.editModalBtnPrimary,
                  savingEdit && styles.sendBtnDisabled,
                ]}
                onPress={() => void handleSaveEdit()}
                disabled={savingEdit}
              >
                {savingEdit ? (
                  <ActivityIndicator color={COLORS.white} size="small" />
                ) : (
                  <Text style={styles.editModalBtnPrimaryText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ChatMessageActionSheet
        visible={!!actionMenuMessage}
        message={actionMenuMessage}
        bottomInset={insets.bottom}
        onClose={closeActionMenu}
        onEdit={() => {
          const target = actionMenuMessage;
          closeActionMenu();
          if (target) openEditModal(target);
        }}
        onWithdraw={() => {
          const target = actionMenuMessage;
          closeActionMenu();
          if (target) confirmWithdraw(target);
        }}
      />

      <ConfirmModal
        visible={!!withdrawTarget}
        onDismiss={() => !withdrawing && setWithdrawTarget(null)}
        title="Withdraw message?"
        message="This message will be removed for everyone in the chat. This cannot be undone."
        cancelLabel="Keep message"
        confirmLabel="Withdraw"
        confirmVariant="destructive"
        onConfirm={handleWithdrawConfirm}
        loading={withdrawing}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  flex: { flex: 1 },
  body: {
    flex: 1,
    position: "relative",
  },
  composerWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    zIndex: 10,
    elevation: 12,
  },
  composer: {
    backgroundColor: COLORS.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 8,
  },
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
    paddingBottom: 12,
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
  timeInBubbleMine: { color: "rgba(255,255,255,0.75)" },
  timeInBubbleOther: { color: COLORS.text.tertiary },
  metaRow: {
    marginTop: 4,
    alignSelf: "flex-end",
    alignItems: "flex-end",
    gap: 2,
  },
  metaRowOther: {
    alignSelf: "flex-start",
    alignItems: "flex-start",
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.85)",
  },
  bubbleWithdrawn: {
    opacity: 0.85,
  },
  withdrawnText: {
    fontStyle: "italic",
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
  editModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  editModalCard: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  editModalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.text.primary,
    marginBottom: 12,
  },
  editModalInput: {
    minHeight: 96,
    maxHeight: 160,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.text.primary,
    textAlignVertical: "top",
  },
  editModalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 16,
  },
  editModalBtnSecondary: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.gray[100],
  },
  editModalBtnSecondaryText: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text.secondary,
  },
  editModalBtnPrimary: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    minWidth: 72,
    alignItems: "center",
  },
  editModalBtnPrimaryText: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.white,
  },
});
