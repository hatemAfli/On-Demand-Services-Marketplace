import React, { useMemo } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../../constants";
import type { NotificationDetailParams } from "../../navigation/types";

const ACCENT = "#EA580C";
const SCREEN_BG = "#F1F5F9";
import type { NotificationType } from "../../services/api";
import { getNotificationVisual } from "./NotificationsScreen";

type NotificationDetailRoute = RouteProp<
  { NotificationDetail: NotificationDetailParams },
  "NotificationDetail"
>;

function typeLabel(type: NotificationType): string {
  if (type === "DOCUMENT_ACCEPTED") return "Document accepted";
  if (type === "ACCOUNT_VERIFIED") return "Account verified";
  return type;
}

export const NotificationDetailScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { params } = useRoute<NotificationDetailRoute>();

  const visual = useMemo(() => getNotificationVisual(params.type), [params.type]);
  const receivedAt = useMemo(() => {
    const d = new Date(params.createdAt);
    return Number.isNaN(d.getTime())
      ? params.createdAt
      : d.toLocaleString(undefined, {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
  }, [params.createdAt]);

  const verificationRequestId =
    typeof params.data?.verificationRequestId === "string"
      ? params.data.verificationRequestId
      : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerSide}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.85}
          >
            <Ionicons name="chevron-back" size={22} color={COLORS.text.primary} />
          </TouchableOpacity>
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Notification</Text>
        </View>
        <View style={styles.headerSide} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={[styles.iconCircle, { backgroundColor: visual.bgColor }]}>
            <Ionicons name={visual.icon} size={36} color={visual.iconColor} />
          </View>
          <Text style={styles.typeBadge}>{typeLabel(params.type)}</Text>
          <Text style={styles.title}>{params.title}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Message</Text>
          <Text style={styles.body}>{params.body}</Text>
          <View style={styles.divider} />
          <Text style={styles.sectionLabel}>Received</Text>
          <Text style={styles.meta}>{receivedAt}</Text>
          {verificationRequestId ? (
            <>
              <View style={styles.divider} />
              <Text style={styles.sectionLabel}>Verification request</Text>
              <Text style={styles.mono} selectable>
                {verificationRequestId}
              </Text>
            </>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SCREEN_BG,
  },
  header: {
    height: 56,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
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
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text.primary,
    textAlign: "center",
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
  },
  hero: {
    alignItems: "center",
    marginBottom: 24,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  typeBadge: {
    fontSize: 12,
    fontWeight: "700",
    color: ACCENT,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text.primary,
    textAlign: "center",
    lineHeight: 26,
  },
  card: {
    backgroundColor: COLORS.gray[50],
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.gray[100],
    padding: 18,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.text.tertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.text.primary,
    fontWeight: "500",
  },
  meta: {
    fontSize: 14,
    color: COLORS.text.secondary,
    fontWeight: "500",
  },
  mono: {
    fontSize: 13,
    fontVariant: ["tabular-nums"],
    color: COLORS.text.secondary,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.gray[200],
    marginVertical: 16,
  },
});
