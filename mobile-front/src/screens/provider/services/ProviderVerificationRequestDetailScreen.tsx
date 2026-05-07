import React, { useMemo } from "react";
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ProviderStackParamList } from "../../../navigation/types";

type R = RouteProp<ProviderStackParamList, "ProviderVerificationRequestDetail">;
type Nav = NativeStackNavigationProp<
  ProviderStackParamList,
  "ProviderVerificationRequestDetail"
>;

const statusUI = (status: string) => {
  switch (status) {
    case "APPROVED":
      return { label: "Approved", bg: "#ECFDF5", text: "#059669" };
    case "REJECTED":
      return { label: "Rejected", bg: "#FEF2F2", text: "#DC2626" };
    case "UNDER_REVIEW":
      return { label: "Under review", bg: "#EFF6FF", text: "#2563EB" };
    default:
      return { label: "Pending", bg: "#FFFBEB", text: "#D97706" };
  }
};

const prettyDocType = (v: string) =>
  v
    .toLowerCase()
    .split("_")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");

const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return d;
  }
};

export const ProviderVerificationRequestDetailScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<R>();
  const req = route.params.request;
  const cfg = useMemo(() => statusUI(req.requestStatus), [req.requestStatus]);

  const openFile = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      // no-op: keep screen stable if URL cannot open
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={18} color="#1A1A2E" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Request details</Text>
          <Text style={styles.subtitle}>{req.service?.name ?? "Service request"}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryCard}>
          <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.statusText, { color: cfg.text }]}>{cfg.label}</Text>
          </View>
          <Text style={styles.meta}>Submitted: {fmtDate(req.createdAt)}</Text>
          {req.adminComment ? (
            <View style={styles.adminCommentBox}>
              <Text style={styles.adminCommentLabel}>Admin comment</Text>
              <Text style={styles.adminCommentText}>{req.adminComment}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.docsCard}>
          <Text style={styles.sectionTitle}>Uploaded files</Text>
          {(req.documents ?? []).length === 0 ? (
            <Text style={styles.emptyText}>No files found for this request.</Text>
          ) : (
            (req.documents ?? []).map((doc, i) => {
              const docStatus =
                doc.isAccepted === true
                  ? { label: "Accepted", color: "#059669", bg: "#ECFDF5" }
                  : doc.isAccepted === false
                    ? { label: "Rejected", color: "#DC2626", bg: "#FEF2F2" }
                    : req.requestStatus === "UNDER_REVIEW"
                      ? { label: "Under review", color: "#2563EB", bg: "#EFF6FF" }
                      : { label: "Pending", color: "#D97706", bg: "#FFFBEB" };
              return (
                <View key={doc.id}>
                  {i > 0 && <View style={styles.divider} />}
                  <View style={styles.docRow}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={styles.docType}>{prettyDocType(doc.type)}</Text>
                      <View style={[styles.docStatusPill, { backgroundColor: docStatus.bg }]}>
                        <Text style={[styles.docStatusText, { color: docStatus.color }]}>
                          {docStatus.label}
                        </Text>
                      </View>
                      <Text style={styles.docMeta}>Uploaded: {fmtDate(doc.uploadedAt)}</Text>
                      {doc.rejectionReason ? (
                        <Text style={styles.rejectionReason}>{doc.rejectionReason}</Text>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      style={styles.openBtn}
                      onPress={() => void openFile(doc.fichierUrl)}
                    >
                      <Ionicons name="eye-outline" size={16} color="#2563EB" />
                      <Text style={styles.openBtnText}>View</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
  title: { fontSize: 16, fontWeight: "800", color: "#0F172A" },
  subtitle: { fontSize: 12, color: "#64748B", marginTop: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 30 },
  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    gap: 10,
  },
  statusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusText: { fontSize: 11, fontWeight: "800" },
  meta: { fontSize: 12, color: "#64748B" },
  adminCommentBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 10,
    gap: 4,
  },
  adminCommentLabel: { fontSize: 11, fontWeight: "700", color: "#475569" },
  adminCommentText: { fontSize: 13, color: "#0F172A", lineHeight: 18 },
  docsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: "#0F172A", marginBottom: 8 },
  emptyText: { fontSize: 13, color: "#64748B" },
  divider: { height: 1, backgroundColor: "#F1F5F9", marginVertical: 10 },
  docRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  docType: { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  docStatusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  docStatusText: { fontSize: 10, fontWeight: "800" },
  docMeta: { fontSize: 11, color: "#64748B" },
  rejectionReason: { fontSize: 12, color: "#B91C1C", lineHeight: 17 },
  openBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },
  openBtnText: { fontSize: 12, fontWeight: "700", color: "#2563EB" },
});
