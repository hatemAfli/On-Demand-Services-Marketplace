import React from "react";
import {
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ProviderStackParamList } from "../../../navigation/types";
import { useAppTranslation } from "../../../hooks/useAppTranslation";

type Nav = NativeStackNavigationProp<
  ProviderStackParamList,
  "ProviderDocumentDetails"
>;
type DocRoute = RouteProp<ProviderStackParamList, "ProviderDocumentDetails">;

export const ProviderDocumentDetailsScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<DocRoute>();
  const { t } = useAppTranslation();
  const { document } = route.params;

  const formatDate = (value: string) => {
    try {
      return new Date(value).toLocaleString("en-GB", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return value;
    }
  };

  const prettify = (raw: string) =>
    raw
      .toLowerCase()
      .split("_")
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ");

  const fileDecisionLabel =
    document.isAccepted === true
      ? t("provider.documentDetails.fileAccepted")
      : document.isAccepted === false
        ? t("provider.documentDetails.fileRejected")
        : t("provider.documentDetails.filePending");

  const status =
    document.isAccepted === true
      ? t("provider.documentDetails.fileAccepted")
      : document.isAccepted === false
        ? t("provider.documentDetails.fileRejected")
        : document.validatedAt
          ? "APPROVED"
          : (document.verificationRequest?.requestStatus ?? "PENDING");

  const statusColors = {
    bg:
      document.isAccepted === true
        ? "#ECFDF5"
        : document.isAccepted === false
          ? "#FEF2F2"
          : "#F5F3FF",
    border:
      document.isAccepted === true
        ? "#6EE7B7"
        : document.isAccepted === false
          ? "#FECACA"
          : "#C4B5FD",
    text:
      document.isAccepted === true
        ? "#059669"
        : document.isAccepted === false
          ? "#DC2626"
          : "#7C5CFC",
    icon:
      document.isAccepted === true
        ? "checkmark-circle"
        : document.isAccepted === false
          ? "close-circle"
          : "time-outline",
  } as const;

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <View style={styles.backBtnInner}>
            <Ionicons name="chevron-back" size={18} color="#1A1A2E" />
          </View>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            {t("provider.documentDetails.title")}
          </Text>
          <Text style={styles.headerSubtitle}>{prettify(document.type)}</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Status banner */}
        <View
          style={[
            styles.statusBanner,
            {
              backgroundColor: statusColors.bg,
              borderColor: statusColors.border,
            },
          ]}
        >
          <Ionicons
            name={statusColors.icon}
            size={20}
            color={statusColors.text}
          />
          <Text style={[styles.statusBannerText, { color: statusColors.text }]}>
            {status}
          </Text>
        </View>

        {/* Document info card */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconWrap}>
            <Ionicons name="document-text-outline" size={13} color="#7C5CFC" />
          </View>
          <Text style={styles.sectionLabel}>
            {t("provider.documentDetails.type")}
          </Text>
        </View>
        <View style={styles.card}>
          <InfoRow
            label={t("provider.documentDetails.type")}
            value={prettify(document.type)}
          />
          <InfoRow
            label={t("provider.documentDetails.adminFileDecision")}
            value={fileDecisionLabel}
            valueColor={statusColors.text}
          />
          {document.rejectionReason?.trim() ? (
            <InfoBlock
              label={t("provider.documentDetails.rejectionReasonLabel")}
              value={document.rejectionReason.trim()}
              valueColor="#DC2626"
            />
          ) : null}
          <InfoRow
            label={t("provider.documentDetails.uploadedAt")}
            value={formatDate(document.uploadedAt)}
            mono
          />
          {document.validatedAt ? (
            <InfoRow
              label={t("provider.documentDetails.validatedAt")}
              value={formatDate(document.validatedAt)}
              mono
              last
            />
          ) : null}
        </View>

        {/* Verification request card */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconWrap}>
            <Ionicons
              name="shield-checkmark-outline"
              size={13}
              color="#7C5CFC"
            />
          </View>
          <Text style={styles.sectionLabel}>
            {t("provider.documentDetails.requestId")}
          </Text>
        </View>
        <View style={styles.card}>
          <InfoRow
            label={t("provider.documentDetails.requestId")}
            value={document.verificationRequest?.id ?? "—"}
            mono
          />
          <InfoRow
            label={t("provider.documentDetails.ownerType")}
            value={document.verificationRequest?.ownerType ?? "—"}
          />
          <InfoRow
            label={t("provider.documentDetails.requestStatus")}
            value={document.verificationRequest?.requestStatus ?? "—"}
          />
          <InfoRow
            label={t("provider.documentDetails.requestCreated")}
            value={
              document.verificationRequest?.createdAt
                ? formatDate(document.verificationRequest.createdAt)
                : "—"
            }
            mono
          />
          <InfoRow
            label={t("provider.documentDetails.requestUpdated")}
            value={
              document.verificationRequest?.updatedAt
                ? formatDate(document.verificationRequest.updatedAt)
                : "—"
            }
            mono
            last
          />
        </View>

        {/* Service card */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconWrap}>
            <Ionicons name="layers-outline" size={13} color="#7C5CFC" />
          </View>
          <Text style={styles.sectionLabel}>
            {t("provider.documentDetails.service")}
          </Text>
        </View>
        <View style={styles.card}>
          <InfoRow
            label={t("provider.documentDetails.service")}
            value={document.verificationRequest?.service?.name ?? "—"}
          />
          <InfoRow
            label={t("provider.documentDetails.serviceCategory")}
            value={document.verificationRequest?.service?.category?.name ?? "—"}
          />
          <InfoRow
            label={t("provider.documentDetails.serviceId")}
            value={
              document.verificationRequest?.service?.id ??
              document.verificationRequest?.serviceId ??
              "—"
            }
            mono
            last
          />
        </View>

        {/* Comments card (only if present) */}
        {document.verificationRequest?.ownerComment ||
        document.verificationRequest?.adminComment ? (
          <>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconWrap}>
                <Ionicons name="chatbubble-outline" size={13} color="#7C5CFC" />
              </View>
              <Text style={styles.sectionLabel}>
                {t("provider.documentDetails.myNote")}
              </Text>
            </View>
            <View style={styles.card}>
              {document.verificationRequest?.ownerComment ? (
                <InfoBlock
                  label={t("provider.documentDetails.myNote")}
                  value={document.verificationRequest.ownerComment}
                />
              ) : null}
              {document.verificationRequest?.ownerComment &&
              document.verificationRequest?.adminComment ? (
                <View style={styles.blockDivider} />
              ) : null}
              {document.verificationRequest?.adminComment ? (
                <InfoBlock
                  label={t("provider.documentDetails.adminComment")}
                  value={document.verificationRequest.adminComment}
                  last
                />
              ) : null}
            </View>
          </>
        ) : null}

        {/* Open document button */}
        <TouchableOpacity
          style={styles.openBtn}
          onPress={() => void Linking.openURL(document.fichierUrl)}
          activeOpacity={0.85}
        >
          <Ionicons name="open-outline" size={17} color="#FFF" />
          <Text style={styles.openText}>
            {t("provider.documentDetails.consultDocument")}
          </Text>
        </TouchableOpacity>

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
};

/* ─── Sub-components ────────────────────────────────────────────────────── */

function InfoRow({
  label,
  value,
  mono,
  last,
  valueColor,
}: {
  label: string;
  value: string;
  mono?: boolean;
  last?: boolean;
  valueColor?: string;
}) {
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text
        style={[
          styles.rowValue,
          mono && styles.rowValueMono,
          valueColor ? { color: valueColor } : undefined,
        ]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

function InfoBlock({
  label,
  value,
  last,
  valueColor,
}: {
  label: string;
  value: string;
  last?: boolean;
  valueColor?: string;
}) {
  return (
    <View style={[styles.block, last && styles.rowLast]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text
        style={[
          styles.blockValue,
          valueColor ? { color: valueColor } : undefined,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

/* ─── Styles ────────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F4F3FA" },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#EBEBF5",
    shadowColor: "#7C5CFC",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  backBtn: { padding: 4 },
  backBtnInner: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#F4F3FA",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E8E8F0",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerSpacer: { width: 44 },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1A1A2E",
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    color: "#9B9BB0",
    fontWeight: "500",
    marginTop: 1,
  },

  /* Content */
  content: { paddingHorizontal: 16, paddingTop: 20 },
  bottomPad: { height: 24 },

  /* Status banner */
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 13,
    marginBottom: 20,
  },
  statusBannerText: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.1,
  },

  /* Section header */
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
    marginTop: 4,
    paddingHorizontal: 2,
  },
  sectionIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: "#EDE9FE",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#7C5CFC",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },

  /* Card */
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EBEBF5",
    paddingHorizontal: 14,
    paddingTop: 4,
    marginBottom: 16,
    shadowColor: "#1A1A2E",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
    overflow: "hidden",
  },

  /* Row (inline label + value) */
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F4F3FA",
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9B9BB0",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    flexShrink: 0,
    maxWidth: "42%",
  },
  rowValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 13,
    color: "#1A1A2E",
    fontWeight: "600",
  },
  rowValueMono: {
    fontVariant: ["tabular-nums"],
    fontSize: 12,
    color: "#6B6B80",
  },

  /* Block (stacked label + value) */
  block: {
    gap: 5,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F4F3FA",
  },
  blockValue: {
    fontSize: 13,
    color: "#1A1A2E",
    fontWeight: "600",
    lineHeight: 19,
  },
  blockDivider: {
    height: 1,
    backgroundColor: "#F4F3FA",
  },

  /* Open button */
  openBtn: {
    height: 52,
    borderRadius: 999,
    backgroundColor: "#7C5CFC",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    shadowColor: "#7C5CFC",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
    marginTop: 4,
    marginBottom: 8,
  },
  openText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 15,
    letterSpacing: 0.2,
  },
});
