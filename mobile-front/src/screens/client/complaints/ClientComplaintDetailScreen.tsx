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
import { ConfirmModal, PhotoCarousel } from "../../../components/common";
import { api, type AppointmentStatus, type ClientComplaintRow } from "../../../services/api";
import { useAppTranslation } from "../../../hooks/useAppTranslation";
import { CATEGORY_OPTIONS, getCategoryOption } from "./categoryMeta";
import { parseClientComplaintRow } from "./parseComplaint";
import {
  formatBookingDateTime,
  formatComplaintReference,
  formatComplaintTimestamp,
  statusBarColor,
  statusPillStyle,
} from "./complaintUi";

const ACCENT = "#EA580C";
const ACCENT_LIGHT = "#FFF7ED";
const ACCENT_BORDER = "#FFEDD5";
const SCREEN_BG = "#F1F5F9";

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

function appointmentStatusLabel(
  status: AppointmentStatus,
  t: (key: string) => string,
): string {
  const key = `client.complaints.detail.appointmentStatusLabels.${status}`;
  const label = t(key);
  return label === key ? status.replace(/_/g, " ") : label;
}

type DetailRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  isLast?: boolean;
};

function DetailRow({ icon, label, value, isLast = false }: DetailRowProps) {
  return (
    <View style={[styles.detailRow, isLast && styles.detailRowLast]}>
      <View style={styles.detailIconWrap}>
        <Ionicons name={icon} size={14} color="#EA580C" />
      </View>
      <View style={styles.detailTextCol}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
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
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
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
      headerTitleAlign: "center",
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ marginLeft: 8, padding: 4 }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={24} color="#1A1A2E" />
        </TouchableOpacity>
      ),
      headerRight: () => <View style={{ width: 40, marginRight: 8 }} />,
    });
  }, [navigation, t]);

  const confirmWithdraw = useCallback(async () => {
    if (!row) return;
    setWithdrawLoading(true);
    try {
      await api.withdrawComplaint(row.id);
      setRow((prev) => (prev ? { ...prev, status: "WITHDRAWN" } : prev));
      setWithdrawModalOpen(false);
    } catch (err) {
      const msg = isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message
        : undefined;
      Alert.alert(t("common.error"), msg ?? t("client.complaints.withdrawError"));
    } finally {
      setWithdrawLoading(false);
    }
  }, [row, t]);

  /* ── Loading ── */
  if (loading && !row) {
    return (
      <View
        style={[styles.root, styles.centered, { paddingBottom: insets.bottom }]}
      >
        <ActivityIndicator size="large" color="#EA580C" />
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
          <Ionicons name="refresh-outline" size={14} color="#EA580C" />
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
  const complaintRef = formatComplaintReference(row.id);
  const filedAt = row.createdAt
    ? formatComplaintTimestamp(row.createdAt)
    : "—";
  const reviewedAtLabel = row.reviewedAt
    ? formatComplaintTimestamp(row.reviewedAt)
    : null;
  const resolvedAtLabel = row.resolvedAt
    ? formatComplaintTimestamp(row.resolvedAt)
    : null;
  const appointmentId = row.appointment.id || row.appointmentId;
  const appointmentStatus = row.appointment.status;

  const complaintDetailRows: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value: string;
  }[] = [
    {
      icon: "finger-print-outline",
      label: t("client.complaints.detail.reference"),
      value: `#${complaintRef}`,
    },
    {
      icon: "time-outline",
      label: t("client.complaints.detail.filedAt"),
      value: filedAt,
    },
  ];
  if (reviewedAtLabel) {
    complaintDetailRows.push({
      icon: "eye-outline",
      label: t("client.complaints.detail.reviewedAt"),
      value: reviewedAtLabel,
    });
  }
  if (resolvedAtLabel) {
    complaintDetailRows.push({
      icon: "checkmark-circle-outline",
      label: t("client.complaints.detail.resolvedAt"),
      value: resolvedAtLabel,
    });
  }

  const appointmentDetailRows: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value: string;
  }[] = [];
  if (row.appointment.serviceName) {
    appointmentDetailRows.push({
      icon: "construct-outline",
      label: t("client.complaints.detail.service"),
      value: row.appointment.serviceName,
    });
  }
  if (row.appointment.categoryName) {
    appointmentDetailRows.push({
      icon: "grid-outline",
      label: t("client.complaints.detail.serviceCategory"),
      value: row.appointment.categoryName,
    });
  }
  appointmentDetailRows.push({
    icon: "calendar-outline",
    label: t("client.complaints.detail.scheduledFor"),
    value: schedule,
  });
  if (appointmentStatus) {
    appointmentDetailRows.push({
      icon: "pulse-outline",
      label: t("client.complaints.detail.appointmentStatus"),
      value: appointmentStatusLabel(appointmentStatus, t),
    });
  }
  if (row.appointment.notes?.trim()) {
    appointmentDetailRows.push({
      icon: "chatbubble-ellipses-outline",
      label: t("client.complaints.detail.bookingNotes"),
      value: row.appointment.notes.trim(),
    });
  }

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
              <Ionicons name={cat.icon as any} size={17} color="#EA580C" />
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

      <View style={styles.card}>
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionIconWrap}>
            <Ionicons name="information-circle-outline" size={13} color="#EA580C" />
          </View>
          <Text style={styles.sectionTitle}>
            {t("client.complaints.detail.complaintInfo")}
          </Text>
        </View>
        {complaintDetailRows.map((item, index) => (
          <DetailRow
            key={item.label}
            icon={item.icon}
            label={item.label}
            value={item.value}
            isLast={index === complaintDetailRows.length - 1}
          />
        ))}
      </View>

      <View style={styles.card}>
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionIconWrap}>
            <Ionicons name="calendar-outline" size={13} color="#EA580C" />
          </View>
          <Text style={styles.sectionTitle}>
            {t("client.complaints.detail.appointmentInfo")}
          </Text>
        </View>
        {appointmentDetailRows.map((item, index) => (
          <DetailRow
            key={item.label}
            icon={item.icon}
            label={item.label}
            value={item.value}
            isLast={
              index === appointmentDetailRows.length - 1 && !appointmentId
            }
          />
        ))}
        {appointmentId ? (
          <TouchableOpacity
            style={styles.viewAppointmentBtn}
            onPress={() =>
              navigation.navigate("ClientAppointmentDetail", {
                appointmentId,
              })
            }
            activeOpacity={0.88}
          >
            <Text style={styles.viewAppointmentBtnText}>
              {t("client.complaints.detail.viewAppointment")}
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#EA580C" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* ── Description ── */}
      <View style={styles.card}>
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionIconWrap}>
            <Ionicons name="document-text-outline" size={13} color="#EA580C" />
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
              <Ionicons name="images-outline" size={13} color="#EA580C" />
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
          <PhotoCarousel
            photos={row.evidenceUrls}
            accessibilityLabelPrefix={t("client.complaints.evidence")}
            horizontalInset={64}
            activeDotColor="#EA580C"
          />
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
          onPress={() => setWithdrawModalOpen(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="close-circle-outline" size={18} color="#DC2626" />
          <Text style={styles.withdrawWideText}>
            {t("client.complaints.withdraw")}
          </Text>
        </TouchableOpacity>
      ) : null}

      <ConfirmModal
        visible={withdrawModalOpen}
        onDismiss={() => !withdrawLoading && setWithdrawModalOpen(false)}
        title={t("client.complaints.withdrawAlertTitle")}
        message={t("client.complaints.withdrawAlertMessage")}
        cancelLabel={t("common.cancel")}
        confirmLabel={t("client.complaints.withdrawConfirmAction")}
        confirmVariant="destructive"
        loading={withdrawLoading}
        onConfirm={confirmWithdraw}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F1F5F9",
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
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FFEDD5",
  },
  retryBtnText: {
    color: "#EA580C",
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
    backgroundColor: "#FFF7ED",
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
    backgroundColor: "#F1F5F9",
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
    backgroundColor: "#F1F5F9",
    flexShrink: 0,
  },
  avatarPlaceholder: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#FFF7ED",
    borderWidth: 1.5,
    borderColor: "#FFEDD5",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarInitial: {
    fontSize: 16,
    fontWeight: "800",
    color: "#EA580C",
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
    backgroundColor: "#FFF7ED",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 11,
    fontWeight: "800",
    color: "#EA580C",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  countPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FFEDD5",
  },
  countPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#EA580C",
  },
  bodyText: {
    fontSize: 14,
    color: "#3A3A50",
    lineHeight: 21,
    fontWeight: "400",
  },

  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  detailRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  detailIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: "#FFF7ED",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    flexShrink: 0,
  },
  detailTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9B9BB0",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1A1A2E",
    lineHeight: 20,
  },
  viewAppointmentBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FFEDD5",
  },
  viewAppointmentBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#EA580C",
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
    backgroundColor: "#F1F5F9",
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
