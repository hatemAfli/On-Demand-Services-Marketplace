import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { isAxiosError } from "axios";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ClientStackParamList } from "../../../navigation/types";
import { COLORS } from "../../../constants";
import { api, type ClientComplaintRow } from "../../../services/api";
import { useAppTranslation } from "../../../hooks/useAppTranslation";
import { CATEGORY_OPTIONS, getCategoryOption } from "./categoryMeta";
import { parseClientComplaintRow } from "./parseComplaint";
import {
  formatBookingDateTime,
  statusBarColor,
  statusPillStyle,
} from "./complaintUi";

type Props = NativeStackScreenProps<
  ClientStackParamList,
  "ClientComplaintDetail"
>;

/* Status icon helper — same as the list screen */
function statusIcon(status: string): { name: string; color: string } {
  switch (status) {
    case "OPEN":
      return { name: "radio-button-on-outline", color: "#F59E0B" };
    case "UNDER_REVIEW":
      return { name: "eye-outline", color: "#3B82F6" };
    case "RESOLVED":
      return { name: "checkmark-circle-outline", color: "#059669" };
    case "DISMISSED":
      return { name: "close-circle-outline", color: "#9B9BB0" };
    case "WITHDRAWN":
      return { name: "arrow-undo-outline", color: "#9B9BB0" };
    default:
      return { name: "ellipse-outline", color: "#C4C4C4" };
  }
}

export const ClientComplaintDetailScreen: React.FC<Props> = ({
  navigation,
  route,
}) => {
  const { complaintId } = route.params;
  const { t } = useAppTranslation();
  const insets = useSafeAreaInsets();
  const [row, setRow] = useState<ClientComplaintRow | null>(null);
  const [loading, setLoading] = useState(true);
  const rowRef = useRef<ClientComplaintRow | null>(null);
  rowRef.current = row;

  const load = useCallback(() => {
    if (!rowRef.current) setLoading(true);
    void api
      .getComplaintById(complaintId)
      .then((res) => {
        const parsed = parseClientComplaintRow(res.data);
        setRow(parsed);
      })
      .catch(() => setRow(null))
      .finally(() => setLoading(false));
  }, [complaintId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t("client.screenTitles.ClientComplaintDetail"),
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ marginLeft: 8, padding: 4 }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={24} color="#1A1A2E" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, t]);

  const withdrawComplaint = useCallback(() => {
    if (!row) return;
    Alert.alert(
      t("client.complaints.withdrawAlertTitle"),
      t("client.complaints.withdrawAlertMessage"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("client.complaints.withdrawConfirmAction"),
          style: "destructive",
          onPress: () => {
            void api
              .withdrawComplaint(row.id)
              .then(() => {
                setRow((prev) =>
                  prev ? { ...prev, status: "WITHDRAWN" } : prev,
                );
              })
              .catch((err) => {
                const msg = isAxiosError(err)
                  ? (err.response?.data as { message?: string })?.message
                  : undefined;
                Alert.alert(
                  t("common.error"),
                  msg ?? t("client.complaints.withdrawError"),
                );
              });
          },
        },
      ],
    );
  }, [row, t]);

  /* ── Loading ── */
  if (loading && !row) {
    return (
      <View
        style={[styles.root, styles.centered, { paddingBottom: insets.bottom }]}
      >
        <ActivityIndicator size="large" color="#7C5CFC" />
      </View>
    );
  }

  /* ── Error ── */
  if (!row) {
    return (
      <View
        style={[styles.root, styles.centered, { paddingBottom: insets.bottom }]}
      >
        <View style={styles.errorIconWrap}>
          <Ionicons name="alert-circle-outline" size={28} color="#DC2626" />
        </View>
        <Text style={styles.errorText}>{t("client.complaints.loadError")}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={load}>
          <Ionicons name="refresh-outline" size={14} color="#7C5CFC" />
          <Text style={styles.retryBtnText}>{t("common.retry")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const cat =
    getCategoryOption(row.category) ??
    CATEGORY_OPTIONS[CATEGORY_OPTIONS.length - 1];
  const bar = statusBarColor(row.status);
  const pill = statusPillStyle(row.status);
  const providerName =
    `${row.provider.firstName} ${row.provider.lastName}`.trim();
  const schedule = formatBookingDateTime(
    row.appointment.scheduledDate,
    row.appointment.scheduledTime,
  );
  const canWithdraw = row.status === "OPEN" || row.status === "UNDER_REVIEW";
  const decisionLabel =
    row.decision != null
      ? t(`client.complaints.decision.${row.decision}`)
      : null;
  const statusInfo = statusIcon(row.status);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingBottom: insets.bottom + 32 },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* ── Hero card ── */}
      <View style={styles.heroCard}>
        <View style={[styles.heroBar, { backgroundColor: bar }]} />
        <View style={styles.heroInner}>
          {/* Category + status */}
          <View style={styles.cardHeaderRow}>
            <View style={styles.catIconWrap}>
              <Ionicons name={cat.icon as any} size={17} color="#7C5CFC" />
            </View>
            <Text style={styles.categoryLabel}>{cat.label}</Text>
            <View
              style={[
                styles.statusPill,
                { backgroundColor: pill.bg, borderColor: pill.text + "30" },
              ]}
            >
              <Ionicons
                name={statusInfo.name as any}
                size={11}
                color={statusInfo.color}
              />
              <Text style={[styles.statusPillText, { color: pill.text }]}>
                {t(`client.complaints.status.${row.status}`)}
              </Text>
            </View>
          </View>

          {/* Divider */}
          <View style={styles.heroDivider} />

          {/* Provider meta */}
          <View style={styles.metaRow}>
            {row.provider.photoUrl ? (
              <Image
                source={{ uri: row.provider.photoUrl }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>
                  {providerName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.metaTextCol}>
              <Text style={styles.providerName}>{providerName}</Text>
              <View style={styles.scheduleRow}>
                <Ionicons name="calendar-outline" size={11} color="#C4C4C4" />
                <Text style={styles.scheduleLine}>{schedule}</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* ── Description ── */}
      <View style={styles.card}>
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionIconWrap}>
            <Ionicons name="document-text-outline" size={13} color="#7C5CFC" />
          </View>
          <Text style={styles.sectionTitle}>
            {t("client.complaints.description")}
          </Text>
        </View>
        <Text style={styles.bodyText}>{row.description}</Text>
      </View>

      {/* ── Evidence images ── */}
      {row.evidenceUrls.length > 0 ? (
        <View style={styles.card}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.sectionIconWrap}>
              <Ionicons name="images-outline" size={13} color="#7C5CFC" />
            </View>
            <Text style={styles.sectionTitle}>
              {t("client.complaints.evidence")}
            </Text>
            <View style={styles.countPill}>
              <Text style={styles.countPillText}>
                {row.evidenceUrls.length}
              </Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.evidenceRow}>
              {row.evidenceUrls.map((uri) => (
                <Image key={uri} source={{ uri }} style={styles.evidenceImg} />
              ))}
            </View>
          </ScrollView>
        </View>
      ) : null}

      {/* ── Admin response ── */}
      {row.adminResponse ? (
        <View style={styles.adminCard}>
          <View style={styles.adminCardTitleRow}>
            <Ionicons
              name="shield-checkmark-outline"
              size={13}
              color="#3B82F6"
            />
            <Text style={styles.adminCardTitle}>
              {t("client.complaints.adminResponse")}
            </Text>
          </View>
          <Text style={styles.adminCardBody}>{row.adminResponse}</Text>
        </View>
      ) : null}

      {/* ── Decision chip ── */}
      {decisionLabel ? (
        <View style={styles.decisionChip}>
          <Ionicons name="flag-outline" size={13} color="#6B6B80" />
          <Text style={styles.decisionChipText}>{decisionLabel}</Text>
        </View>
      ) : null}

      {/* ── Withdraw button ── */}
      {canWithdraw ? (
        <TouchableOpacity
          style={styles.withdrawWide}
          onPress={withdrawComplaint}
          activeOpacity={0.85}
        >
          <Ionicons name="close-outline" size={16} color="#DC2626" />
          <Text style={styles.withdrawWideText}>
            {t("client.complaints.withdraw")}
          </Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F4F3FA",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },

  /* ── States ── */
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  errorIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  errorText: {
    fontSize: 14,
    color: "#6B6B80",
    textAlign: "center",
    fontWeight: "500",
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#EDE9FE",
    borderWidth: 1,
    borderColor: "#C4B5FD",
  },
  retryBtnText: {
    color: "#7C5CFC",
    fontWeight: "700",
    fontSize: 14,
  },

  /* ── Hero card ── */
  heroCard: {
    flexDirection: "row",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EBEBF5",
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    shadowColor: "#1A1A2E",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  heroBar: {
    width: 4,
    alignSelf: "stretch",
  },
  heroInner: {
    flex: 1,
    padding: 16,
  },

  /* Category + status row */
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  catIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "#EDE9FE",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  categoryLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    color: "#1A1A2E",
    letterSpacing: -0.3,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    flexShrink: 0,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },

  heroDivider: {
    height: 1,
    backgroundColor: "#F4F3FA",
    marginVertical: 14,
  },

  /* Provider meta */
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#F4F3FA",
    flexShrink: 0,
  },
  avatarPlaceholder: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#EDE9FE",
    borderWidth: 1.5,
    borderColor: "#C4B5FD",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarInitial: {
    fontSize: 16,
    fontWeight: "800",
    color: "#7C5CFC",
  },
  metaTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  providerName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1A1A2E",
    letterSpacing: -0.1,
  },
  scheduleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  scheduleLine: {
    fontSize: 12,
    color: "#9B9BB0",
    fontWeight: "500",
  },

  /* ── Content card ── */
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EBEBF5",
    padding: 16,
    gap: 12,
    shadowColor: "#1A1A2E",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: "#EDE9FE",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 11,
    fontWeight: "800",
    color: "#7C5CFC",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  countPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "#EDE9FE",
    borderWidth: 1,
    borderColor: "#C4B5FD",
  },
  countPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#7C5CFC",
  },
  bodyText: {
    fontSize: 14,
    color: "#3A3A50",
    lineHeight: 21,
    fontWeight: "400",
  },

  /* Evidence */
  evidenceRow: {
    flexDirection: "row",
    gap: 10,
    paddingTop: 2,
  },
  evidenceImg: {
    width: 96,
    height: 96,
    borderRadius: 14,
    backgroundColor: "#F4F3FA",
    borderWidth: 1,
    borderColor: "#EBEBF5",
  },

  /* ── Admin response ── */
  adminCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    gap: 8,
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 1,
  },
  adminCardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  adminCardTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#3B82F6",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  adminCardBody: {
    fontSize: 14,
    color: "#1E40AF",
    lineHeight: 21,
    fontWeight: "500",
  },

  /* ── Decision chip ── */
  decisionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#F4F3FA",
    borderWidth: 1,
    borderColor: "#EBEBF5",
  },
  decisionChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B6B80",
  },

  /* ── Withdraw ── */
  withdrawWide: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    marginTop: 4,
  },
  withdrawWideText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#DC2626",
  },
});
