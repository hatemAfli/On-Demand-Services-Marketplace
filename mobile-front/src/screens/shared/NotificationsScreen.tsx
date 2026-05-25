import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../../constants";
import { useNotificationsRealtime } from "../../context/NotificationsRealtimeContext";
import { api, type AppNotification, type NotificationType } from "../../services/api";

type NotificationIconConfig = {
  icon: keyof typeof Ionicons.glyphMap;
  bgColor: string;
  iconColor: string;
};

export function getNotificationVisual(type: NotificationType): NotificationIconConfig {
  if (type === "APPOINTMENT_NEW_REQUEST") {
    return { icon: "calendar-outline", bgColor: "#DBEAFE", iconColor: "#2563EB" };
  }
  if (type === "APPOINTMENT_CONFIRMED") {
    return {
      icon: "checkmark-outline",
      bgColor: "#DCFCE7",
      iconColor: "#16A34A",
    };
  }
  if (type === "APPOINTMENT_REFUSED") {
    return { icon: "close-outline", bgColor: "#FEE2E2", iconColor: "#DC2626" };
  }
  if (type === "APPOINTMENT_RESCHEDULED") {
    return { icon: "time-outline", bgColor: "#FEF3C7", iconColor: "#D97706" };
  }
  if (
    type === "APPOINTMENT_CANCELLED_CLIENT" ||
    type === "APPOINTMENT_CANCELLED_PROVIDER"
  ) {
    return {
      icon: "close-circle-outline",
      bgColor: "#FEE2E2",
      iconColor: "#DC2626",
    };
  }
  if (type === "APPOINTMENT_EN_ROUTE") {
    return { icon: "car-outline", bgColor: "#EDE9FE", iconColor: "#7C3AED" };
  }
  if (type === "APPOINTMENT_PROVIDER_ENDED") {
    return {
      icon: "checkmark-done-outline",
      bgColor: "#FEF3C7",
      iconColor: "#D97706",
    };
  }
  if (type === "APPOINTMENT_COMPLETED") {
    return { icon: "trophy-outline", bgColor: "#DCFCE7", iconColor: "#16A34A" };
  }
  if (type === "APPOINTMENT_REMINDER_24H" || type === "APPOINTMENT_REMINDER_1H") {
    return { icon: "alarm-outline", bgColor: "#E0E7FF", iconColor: "#4F46E5" };
  }
  if (type === "ACCOUNT_VERIFIED") {
    return {
      icon: "shield-checkmark-outline",
      bgColor: "#DCFCE7",
      iconColor: "#16A34A",
    };
  }
  if (type === "ACCOUNT_REJECTED") {
    return { icon: "shield-outline", bgColor: "#FEE2E2", iconColor: "#DC2626" };
  }
  if (type === "DOCUMENT_ACCEPTED") {
    return { icon: "document-outline", bgColor: "#DCFCE7", iconColor: "#16A34A" };
  }
  if (type === "DOCUMENT_REJECTED") {
    return { icon: "document-outline", bgColor: "#FEE2E2", iconColor: "#DC2626" };
  }
  if (
    type === "COMPLAINT_FILED" ||
    type === "COMPLAINT_STATUS_UPDATED" ||
    type === "COMPLAINT_RESOLVED" ||
    type === "COMPLAINT_DISMISSED"
  ) {
    return {
      icon: "shield-outline",
      bgColor: type === "COMPLAINT_RESOLVED" ? "#DCFCE7" : "#FEF3C7",
      iconColor: type === "COMPLAINT_RESOLVED" ? "#16A34A" : "#B45309",
    };
  }

  return {
    icon: "notifications-outline",
    bgColor: COLORS.gray[200],
    iconColor: COLORS.gray[600],
  };
}

function formatRelativeTime(createdAt: string): string {
  const now = Date.now();
  const ts = new Date(createdAt).getTime();
  if (Number.isNaN(ts)) return "";

  const diffMs = now - ts;
  const diffMin = Math.floor(diffMs / (60 * 1000));
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} min ago`;

  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} hours ago`;

  const date = new Date(ts);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export const NotificationsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const {
    unreadCount,
    refreshUnreadCount,
    adjustUnreadCount,
    addNewNotificationListener,
  } = useNotificationsRealtime();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [listRes] = await Promise.all([
        api.getMyNotifications(0, 30),
        refreshUnreadCount(),
      ]);
      setNotifications(Array.isArray(listRes.data) ? listRes.data : []);
    } finally {
      if (isRefresh) setRefreshing(false);
      else setLoading(false);
    }
  }, [refreshUnreadCount]);

  useFocusEffect(
    useCallback(() => {
      void load(false);
    }, [load]),
  );

  useEffect(() => {
    return addNewNotificationListener((notification) => {
      setNotifications((prev) => {
        if (prev.some((row) => row.id === notification.id)) return prev;
        return [notification, ...prev];
      });
    });
  }, [addNewNotificationListener]);

  const hasUnread = useMemo(
    () => unreadCount > 0 || notifications.some((n) => !n.isRead),
    [notifications, unreadCount],
  );

  const onPressBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const onMarkAllRead = useCallback(async () => {
    await api.markAllAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    void refreshUnreadCount();
  }, [refreshUnreadCount]);

  const handleNotificationPress = useCallback(
    async (item: AppNotification) => {
      if (!item.isRead) {
        await api.markNotificationsRead([item.id]);
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)),
        );
        adjustUnreadCount(-1);
      }

      if (item.type === "DOCUMENT_ACCEPTED" || item.type === "ACCOUNT_VERIFIED") {
        const raw = item.data;
        const dataCopy =
          raw && typeof raw === "object" && !Array.isArray(raw)
            ? { ...(raw as Record<string, unknown>) }
            : null;
        navigation.navigate("NotificationDetail", {
          id: item.id,
          type: item.type,
          title: item.title,
          body: item.body,
          createdAt: item.createdAt,
          data: dataCopy,
        });
        return;
      }

      const screen = typeof item.data?.screen === "string" ? item.data.screen : undefined;
      const appointmentId =
        typeof item.data?.appointmentId === "string"
          ? item.data.appointmentId
          : undefined;
      const complaintId =
        typeof item.data?.complaintId === "string" ? item.data.complaintId : undefined;
      if (!screen) return;

      if (screen === "ClientComplaintDetail" && complaintId) {
        navigation.navigate("ClientComplaintDetail", { complaintId });
        return;
      }
      if (screen === "ProviderComplaints") {
        navigation.navigate("ProviderComplaints");
        return;
      }

      if (screen === "ClientAppointmentDetail" && appointmentId) {
        navigation.navigate("ClientAppointmentDetail", { appointmentId });
        return;
      }
      if (screen === "ProviderAppointmentDetail" && appointmentId) {
        navigation.navigate("ProviderAppointmentDetail", { appointmentId });
        return;
      }
      navigation.navigate(screen, appointmentId ? { appointmentId } : undefined);
    },
    [navigation, adjustUnreadCount],
  );

  const renderRow = useCallback(
    ({ item }: { item: AppNotification }) => {
      const visual = getNotificationVisual(item.type);
      return (
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.row, !item.isRead && styles.rowUnread]}
          onPress={() => {
            void handleNotificationPress(item);
          }}
        >
          <View style={[styles.iconCircle, { backgroundColor: visual.bgColor }]}>
            <Ionicons name={visual.icon} size={18} color={visual.iconColor} />
          </View>

          <View style={styles.content}>
            <Text style={[styles.title, !item.isRead ? styles.titleUnread : null]}>
              {item.title}
            </Text>
            <Text style={styles.body} numberOfLines={2}>
              {item.body}
            </Text>
            <Text style={styles.time}>{formatRelativeTime(item.createdAt)}</Text>
          </View>

          {!item.isRead ? <View style={styles.unreadDot} /> : null}
        </TouchableOpacity>
      );
    },
    [handleNotificationPress],
  );

  if (loading) {
    return (
      <View style={[styles.loading, { paddingTop: insets.top + 12 }]}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onPressBack} activeOpacity={0.85}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {hasUnread ? (
          <TouchableOpacity onPress={() => void onMarkAllRead()} activeOpacity={0.85}>
            <Text style={styles.markAll}>Mark all read</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderRow}
        contentContainerStyle={[
          styles.listContent,
          notifications.length === 0 ? styles.emptyContent : null,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void load(true);
            }}
            tintColor={COLORS.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name="notifications-off-outline"
                size={28}
                color={COLORS.gray[400]}
              />
            </View>
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptySubtitle}>
              You will see updates about appointments and account activity here.
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  loading: {
    flex: 1,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    height: 56,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text.primary,
  },
  markAll: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.primary,
  },
  headerSpacer: {
    width: 72,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 24,
  },
  row: {
    flexDirection: "row",
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.gray[100],
    padding: 12,
    marginBottom: 10,
    alignItems: "flex-start",
  },
  rowUnread: {
    backgroundColor: "#F8FAFF",
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    marginTop: 2,
  },
  content: {
    flex: 1,
    paddingRight: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.text.primary,
  },
  titleUnread: {
    fontWeight: "700",
  },
  body: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.text.secondary,
  },
  time: {
    marginTop: 6,
    fontSize: 11,
    color: COLORS.text.tertiary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#3B82F6",
    marginTop: 8,
  },
  emptyContent: {
    flexGrow: 1,
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.gray[100],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text.primary,
  },
  emptySubtitle: {
    marginTop: 8,
    textAlign: "center",
    color: COLORS.text.secondary,
    fontSize: 13,
    lineHeight: 18,
  },
});
