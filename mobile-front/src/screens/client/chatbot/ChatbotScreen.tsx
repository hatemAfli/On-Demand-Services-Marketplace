import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthNoticeModal, ConfirmModal } from "../../../components/common";
import { COLORS } from "../../../constants";
import { useAppTranslation } from "../../../hooks/useAppTranslation";
import {
  api,
  type ChatbotSearchResult,
  type ChatbotSessionSummary,
  type ChatbotStoredMessage,
} from "../../../services/api";
import {
  getCachedData,
  invalidateCache,
  peekCachedData,
} from "../../../services/client-data-cache";
import type { ClientStackParamList } from "../../../navigation/types";

type ChatMessage =
  | { id: string; role: "user"; text: string; createdAt: Date }
  | {
      id: string;
      role: "assistant";
      text: string;
      providers: ChatbotSearchResult[];
      suggestions: string[];
      fallback: boolean;
      createdAt: Date;
    };

function mapStoredMessages(stored: ChatbotStoredMessage[]): ChatMessage[] {
  return stored.map((m) => {
    if (m.role === "user") {
      return {
        id: m.id,
        role: "user" as const,
        text: m.text,
        createdAt: new Date(m.createdAt),
      };
    }
    return {
      id: m.id,
      role: "assistant" as const,
      text: m.text,
      providers: (m.providers ?? []) as ChatbotSearchResult[],
      suggestions: m.suggestions ?? [],
      fallback: Boolean(m.fallback),
      createdAt: new Date(m.createdAt),
    };
  });
}

function formatSessionDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function TypingIndicator() {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.3,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
      );

    const a1 = pulse(dot1, 0);
    const a2 = pulse(dot2, 150);
    const a3 = pulse(dot3, 300);
    a1.start();
    a2.start();
    a3.start();
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [dot1, dot2, dot3]);

  return (
    <View style={styles.typingRow}>
      {[dot1, dot2, dot3].map((d, i) => (
        <Animated.View
          key={i}
          style={[styles.typingDot, { opacity: d, transform: [{ scale: d }] }]}
        />
      ))}
    </View>
  );
}

type MiniCardProps = {
  item: ChatbotSearchResult;
  onPress: () => void;
  isRTL: boolean;
  t: (key: string) => string;
};

function ProviderMiniCard({ item, onPress, isRTL, t }: MiniCardProps) {
  const isCompany = item.owner_type === "COMPANY";
  return (
    <Pressable style={styles.miniCard} onPress={onPress}>
      {item.photo_url ? (
        <Image source={{ uri: item.photo_url }} style={styles.miniAvatar} />
      ) : (
        <View
          style={[
            styles.miniAvatar,
            styles.miniAvatarFallback,
            isCompany && styles.miniAvatarCompany,
          ]}
        >
          <Text style={styles.miniAvatarText}>{initials(item.provider_name)}</Text>
        </View>
      )}
      {isCompany ? (
        <View style={styles.companyBadge}>
          <Text style={styles.companyBadgeText}>{t("client.chatbot.company")}</Text>
        </View>
      ) : null}
      <Text style={[styles.miniService, isRTL && styles.rtlText]} numberOfLines={2}>
        {item.service_name}
      </Text>
      <Text style={[styles.miniProvider, isRTL && styles.rtlText]} numberOfLines={1}>
        {item.provider_name}
      </Text>
      <Text style={styles.miniMeta} numberOfLines={1}>
        {item.city} · {item.price} TND
      </Text>
      <View style={styles.miniRatingRow}>
        <Ionicons name="star" size={12} color="#F59E0B" />
        <Text style={styles.miniRating}>
          {item.average_rating.toFixed(1)} ({item.total_reviews})
        </Text>
      </View>
      <Text style={styles.miniView}>{t("client.chatbot.viewProfile")} →</Text>
    </Pressable>
  );
}

export const ChatbotScreen: React.FC = () => {
  const { t, isRTL, language } = useAppTranslation();
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<ClientStackParamList>>();
  const route = useRoute<RouteProp<ClientStackParamList, "ClientChatbot">>();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sessions, setSessions] = useState<ChatbotSessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    sessionId: string;
    title: string;
  } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteErrorVisible, setDeleteErrorVisible] = useState(false);

  const locale = language.startsWith("ar") ? "ar" : "en";
  const idCounter = useRef(0);
  const newId = () => {
    idCounter.current += 1;
    return `local-${Date.now()}-${idCounter.current}`;
  };

  const loadSessionFromServer = useCallback(
    async (id: string, preferCache = true) => {
      const cacheKey = `chatbot:session:${id}`;
      if (preferCache) {
        const cached = peekCachedData<{ messages: ChatbotStoredMessage[] }>(
          cacheKey,
        );
        if (cached?.messages) {
          setSessionId(id);
          setMessages(mapStoredMessages(cached.messages).reverse());
        }
      }
      const detail = await getCachedData(
        cacheKey,
        async () => (await api.getChatbotSession(id)).data,
        60 * 60 * 1000,
      );
      setSessionId(id);
      setMessages(mapStoredMessages(detail.messages).reverse());
      await getCachedData(
        "chatbot:active-session",
        async () => ({ sessionId: id }),
        7 * 24 * 60 * 60 * 1000,
      );
    },
    [],
  );

  const startNewSession = useCallback(async () => {
    const res = await api.createChatbotSession({ locale });
    const id = res.data.sessionId;
    setSessionId(id);
    setMessages([]);
    await invalidateCache("chatbot:sessions");
    await getCachedData(
      "chatbot:active-session",
      async () => ({ sessionId: id }),
      7 * 24 * 60 * 60 * 1000,
    );
  }, [locale]);

  /** Reuse the latest empty session, or start a new one if the latest has messages. */
  const resolveEntrySession = useCallback(async () => {
    const list = await getCachedData(
      "chatbot:sessions",
      async () => (await api.listChatbotSessions()).data,
      3 * 60 * 1000,
      { forceRefresh: true },
    );
    const latest = list[0];
    if (latest && latest.messageCount === 0) {
      await loadSessionFromServer(latest.sessionId, false);
      return;
    }
    await startNewSession();
  }, [loadSessionFromServer, startNewSession]);

  const bootstrap = useCallback(async () => {
    setInitializing(true);
    try {
      const paramId = route.params?.sessionId;
      if (paramId) {
        await loadSessionFromServer(paramId);
        return;
      }
      await resolveEntrySession();
    } catch {
      await startNewSession();
    } finally {
      setInitializing(false);
    }
  }, [
    loadSessionFromServer,
    resolveEntrySession,
    route.params?.sessionId,
    startNewSession,
  ]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const list = await getCachedData(
        "chatbot:sessions",
        async () => (await api.listChatbotSessions()).data,
        3 * 60 * 1000,
      );
      setSessions(list);
    } catch {
      setSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  const openHistory = useCallback(() => {
    setHistoryOpen(true);
    void loadSessions();
  }, [loadSessions]);

  const selectSession = useCallback(
    async (id: string) => {
      setHistoryOpen(false);
      setInitializing(true);
      try {
        await loadSessionFromServer(id, false);
      } finally {
        setInitializing(false);
      }
    },
    [loadSessionFromServer],
  );

  const handleNewChat = useCallback(async () => {
    setHistoryOpen(false);
    setInitializing(true);
    try {
      await startNewSession();
    } finally {
      setInitializing(false);
    }
  }, [startNewSession]);

  const handleDeleteSession = useCallback(
    (id: string) => {
      const target = sessions.find((s) => s.sessionId === id);
      setDeleteTarget({
        sessionId: id,
        title: target?.title?.trim() || t("client.chatbot.untitledSession"),
      });
    },
    [sessions, t],
  );

  const confirmDeleteSession = useCallback(async () => {
    if (!deleteTarget || deleteLoading) return;
    const { sessionId: id } = deleteTarget;
    setDeleteLoading(true);
    try {
      await api.deleteChatbotSession(id);
      await invalidateCache(`chatbot:session:${id}`);
      await invalidateCache("chatbot:sessions");
      setSessions((prev) => prev.filter((s) => s.sessionId !== id));
      setDeleteTarget(null);
      if (sessionId === id) {
        setInitializing(true);
        try {
          await resolveEntrySession();
        } catch {
          await startNewSession();
        } finally {
          setInitializing(false);
        }
      }
    } catch {
      setDeleteTarget(null);
      setDeleteErrorVisible(true);
    } finally {
      setDeleteLoading(false);
    }
  }, [
    deleteLoading,
    deleteTarget,
    resolveEntrySession,
    sessionId,
    startNewSession,
  ]);

  const welcomeSuggestions =
    locale === "ar"
      ? [
          "أحتاج سبّاك",
          "ابحث لي عن شركة تنظيف",
          "إصلاح مكيّف قريب مني",
        ]
      : [
          "I need a plumber",
          "Find me a cleaning company",
          "AC repair near me",
        ];

  const openResult = useCallback(
    (item: ChatbotSearchResult) => {
      if (item.owner_type === "COMPANY") {
        navigation.navigate("ClientCompanyProfile", {
          companyId: item.owner_id,
          serviceId: item.service_id,
          serviceName: item.service_name,
        });
      } else {
        navigation.navigate("ClientProviderProfile", {
          givenServiceId: item.given_service_id,
        });
      }
    },
    [navigation],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading || !sessionId) return;

      const userMsg: ChatMessage = {
        id: newId(),
        role: "user",
        text: trimmed,
        createdAt: new Date(),
      };
      setMessages((prev) => [userMsg, ...prev]);
      setInputText("");
      setLoading(true);

      try {
        const res = await api.chatbotChat({
          message: trimmed,
          sessionId,
          locale,
        });
        const data = res.data;
        const botMsg: ChatMessage = {
          id: newId(),
          role: "assistant",
          text: data.message,
          providers: data.providers ?? [],
          suggestions: data.suggestions ?? [],
          fallback: Boolean(data.fallback),
          createdAt: new Date(),
        };
        setMessages((prev) => [botMsg, ...prev]);
        await invalidateCache(`chatbot:session:${sessionId}`);
        await invalidateCache("chatbot:sessions");
      } catch {
        const errMsg: ChatMessage = {
          id: newId(),
          role: "assistant",
          text: t("client.chatbot.error"),
          providers: [],
          suggestions: [],
          fallback: true,
          createdAt: new Date(),
        };
        setMessages((prev) => [errMsg, ...prev]);
      } finally {
        setLoading(false);
      }
    },
    [loading, locale, sessionId, t],
  );

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    if (item.role === "user") {
      return (
        <View style={[styles.userRow, isRTL && styles.userRowRtl]}>
          <View style={styles.userBubble}>
            <Text style={[styles.userText, isRTL && styles.rtlText]}>
              {item.text}
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.botRow, isRTL && styles.botRowRtl]}>
        <View style={styles.botBubble}>
          <Text style={[styles.botText, isRTL && styles.rtlText]}>
            {item.text}
          </Text>
          {item.providers.length > 0 ? (
            <FlatList
              horizontal
              data={item.providers}
              keyExtractor={(p) => p.given_service_id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.cardsScroll}
              renderItem={({ item: p }) => (
                <ProviderMiniCard
                  item={p}
                  onPress={() => openResult(p)}
                  isRTL={isRTL}
                  t={t}
                />
              )}
            />
          ) : null}
          {item.suggestions.length > 0 ? (
            <View style={[styles.chipsRow, isRTL && styles.chipsRowRtl]}>
              {item.suggestions.map((chip) => (
                <Pressable
                  key={chip}
                  style={styles.chip}
                  onPress={() => sendMessage(chip)}
                >
                  <Text style={styles.chipText}>{chip}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  const listHeader =
    messages.length === 0 && !loading ? (
      <View style={styles.welcome}>
        <View style={styles.welcomeIconWrap}>
          <Ionicons name="sparkles" size={40} color={COLORS.primary} />
        </View>
        <Text style={[styles.welcomeTitle, isRTL && styles.rtlText]}>
          {t("client.chatbot.welcomeTitle")}
        </Text>
        <Text style={[styles.welcomeSub, isRTL && styles.rtlText]}>
          {t("client.chatbot.welcomeSub")}
        </Text>
        <View style={[styles.chipsRow, styles.welcomeChips, isRTL && styles.chipsRowRtl]}>
          {welcomeSuggestions.map((chip) => (
            <Pressable
              key={chip}
              style={styles.chip}
              onPress={() => sendMessage(chip)}
            >
              <Text style={styles.chipText}>{chip}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    ) : null;

  const listFooter = loading ? (
    <View style={[styles.botRow, isRTL && styles.botRowRtl]}>
      <View style={[styles.botBubble, styles.typingBubble]}>
        <TypingIndicator />
      </View>
    </View>
  ) : null;

  if (initializing) {
    return (
      <View style={[styles.root, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={8}
        >
          <Ionicons
            name={isRTL ? "chevron-forward" : "chevron-back"}
            size={24}
            color={COLORS.text.primary}
          />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{t("client.chatbot.title")}</Text>
          <Text style={styles.headerSub}>{t("client.chatbot.subtitle")}</Text>
        </View>
        <Pressable style={styles.historyBtn} onPress={openHistory} hitSlop={8}>
          <Ionicons name="time-outline" size={22} color={COLORS.text.primary} />
        </Pressable>
      </View>

      <Modal visible={historyOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalSheet,
              { paddingBottom: Math.max(insets.bottom, 16) },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("client.chatbot.history")}</Text>
              <Pressable onPress={() => setHistoryOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={24} color={COLORS.text.primary} />
              </Pressable>
            </View>
            <Pressable style={styles.newChatBtn} onPress={() => void handleNewChat()}>
              <Ionicons name="add-circle-outline" size={20} color={COLORS.primary} />
              <Text style={styles.newChatText}>{t("client.chatbot.newChat")}</Text>
            </Pressable>
            {sessionsLoading ? (
              <ActivityIndicator style={{ marginTop: 24 }} color={COLORS.primary} />
            ) : (
              <FlatList
                data={sessions}
                keyExtractor={(s) => s.sessionId}
                contentContainerStyle={
                  sessions.length === 0 ? styles.historyEmptyWrap : undefined
                }
                ListEmptyComponent={
                  <Text style={styles.historyEmpty}>
                    {t("client.chatbot.historyEmpty")}
                  </Text>
                }
                renderItem={({ item }) => (
                  <Pressable
                    style={[
                      styles.historyRow,
                      item.sessionId === sessionId && styles.historyRowActive,
                    ]}
                    onPress={() => void selectSession(item.sessionId)}
                    onLongPress={() => handleDeleteSession(item.sessionId)}
                  >
                    <View style={styles.historyRowBody}>
                      <Text style={styles.historyTitle} numberOfLines={1}>
                        {item.title || t("client.chatbot.untitledSession")}
                      </Text>
                      <Text style={styles.historyMeta}>
                        {formatSessionDate(item.updatedAt)} · {item.messageCount}{" "}
                        msgs
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={COLORS.text.tertiary}
                    />
                  </Pressable>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <FlatList
          inverted
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderMessage}
          contentContainerStyle={[
            styles.listContent,
            messages.length === 0 && styles.listContentEmpty,
          ]}
          ListFooterComponent={listHeader}
          ListHeaderComponent={listFooter}
          keyboardShouldPersistTaps="handled"
        />

        <View
          style={[
            styles.inputBar,
            { paddingBottom: Math.max(insets.bottom, 10) },
          ]}
        >
          <TextInput
            style={[styles.input, isRTL && styles.rtlText]}
            placeholder={t("client.chatbot.inputPlaceholder")}
            placeholderTextColor={COLORS.text.tertiary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={2000}
            editable={!loading}
            textAlign={isRTL ? "right" : "left"}
          />
          <Pressable
            style={[styles.sendBtn, loading && styles.sendBtnDisabled]}
            onPress={() => sendMessage(inputText)}
            disabled={loading || !inputText.trim()}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons name="send" size={18} color="#FFF" />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <ConfirmModal
        visible={deleteTarget !== null}
        onDismiss={() => !deleteLoading && setDeleteTarget(null)}
        loading={deleteLoading}
        title={t("client.chatbot.deleteSessionConfirmTitle")}
        message={
          deleteTarget
            ? t("client.chatbot.deleteSessionConfirmMessage", {
                title: deleteTarget.title,
              })
            : ""
        }
        cancelLabel={t("common.cancel")}
        confirmLabel={t("client.chatbot.deleteSessionConfirm")}
        confirmVariant="destructive"
        onConfirm={() => void confirmDeleteSession()}
      />

      <AuthNoticeModal
        visible={deleteErrorVisible}
        onClose={() => setDeleteErrorVisible(false)}
        title={t("client.chatbot.error")}
        message={t("client.chatbot.deleteSessionError")}
        primaryLabel={t("common.close")}
        onPrimary={() => setDeleteErrorVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { flex: 1, marginHorizontal: 8 },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.text.primary,
  },
  headerSub: { fontSize: 12, color: COLORS.text.secondary, marginTop: 2 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  historyBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    maxHeight: "72%",
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text.primary,
  },
  newChatBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: COLORS.primary + "12",
    marginBottom: 8,
  },
  newChatText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.primary,
  },
  historyEmptyWrap: { flexGrow: 1, justifyContent: "center", paddingVertical: 32 },
  historyEmpty: {
    textAlign: "center",
    color: COLORS.text.secondary,
    fontSize: 14,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  historyRowActive: { backgroundColor: COLORS.primary + "10" },
  historyRowBody: { flex: 1, marginRight: 8 },
  historyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text.primary,
  },
  historyMeta: {
    fontSize: 12,
    color: COLORS.text.secondary,
    marginTop: 4,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary + "18",
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: { paddingHorizontal: 14, paddingVertical: 12, flexGrow: 1 },
  listContentEmpty: { justifyContent: "flex-end" },
  userRow: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 10 },
  userRowRtl: { flexDirection: "row-reverse" },
  userBubble: {
    maxWidth: "82%",
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userText: { color: "#FFF", fontSize: 15, lineHeight: 21 },
  botRow: { flexDirection: "row", justifyContent: "flex-start", marginBottom: 10 },
  botRowRtl: { flexDirection: "row-reverse" },
  botBubble: {
    maxWidth: "92%",
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  botText: { color: COLORS.text.primary, fontSize: 15, lineHeight: 22 },
  typingBubble: { paddingVertical: 14, paddingHorizontal: 18 },
  typingRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.gray[400],
  },
  cardsScroll: { gap: 10, paddingVertical: 10, paddingHorizontal: 2 },
  miniCard: {
    width: 168,
    backgroundColor: COLORS.gray[50],
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 10,
  },
  miniAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginBottom: 6,
  },
  miniAvatarFallback: {
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  miniAvatarCompany: { backgroundColor: "#EDE9FE" },
  miniAvatarText: { fontSize: 14, fontWeight: "800", color: COLORS.primaryDark },
  companyBadge: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.roles.company + "22",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4,
    marginTop: -4,
  },
  companyBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.roles.company,
  },
  miniService: { fontSize: 13, fontWeight: "800", color: COLORS.text.primary },
  miniProvider: { fontSize: 12, color: COLORS.text.secondary, marginTop: 2 },
  miniMeta: { fontSize: 11, color: COLORS.text.tertiary, marginTop: 4 },
  miniRatingRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  miniRating: { fontSize: 11, color: COLORS.text.secondary },
  miniView: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primary,
  },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  chipsRowRtl: { flexDirection: "row-reverse" },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.primary + "44",
    backgroundColor: COLORS.primary + "10",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  chipText: { fontSize: 12, fontWeight: "600", color: COLORS.primaryDark },
  welcome: { alignItems: "center", paddingVertical: 32, paddingHorizontal: 20 },
  welcomeIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary + "18",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.text.primary,
    textAlign: "center",
  },
  welcomeSub: {
    fontSize: 14,
    color: COLORS.text.secondary,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  welcomeChips: { justifyContent: "center", marginTop: 20 },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 96,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.text.primary,
    backgroundColor: COLORS.gray[50],
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.6 },
  rtlText: { writingDirection: "rtl", textAlign: "right" },
});
