import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../../../constants";
import i18n from "../../../i18n";
import {
  api,
  type ComplaintCategory,
  type ComplaintDecision,
  type ComplaintStatus,
} from "../../../services/api";
import { ProviderType } from "../../../types";
import { CATEGORY_OPTIONS, getCategoryOption } from "../../client/complaints/categoryMeta";
import type { AdminComplaintsStackParamList } from "./adminComplaintsNavigation";

const ACCENT = "#EA580C";
const ACCENT_DARK = "#C2410C";
const ACCENT_DIM = "#FFF7ED";
const ACCENT_BORDER = "#FFEDD5";

type Props = NativeStackScreenProps<AdminComplaintsStackParamList, "AdminComplaintDetail">;

type AdminComplaintDetailModel = {
  id: string;
  category: ComplaintCategory;
  status: ComplaintStatus;
  description: string;
  evidenceUrls: string[];
  targetIsEmployee: boolean;
  adminNotes: string | null;
  adminResponse: string | null;
  decision: ComplaintDecision | null;
  createdAt: string;
  client: {
    imageUrl: string | null;
    user: { firstName: string; lastName: string };
  };
  provider: {
    photoUrl: string | null;
    city: string;
    type: ProviderType;
    user: { firstName: string; lastName: string };
  };
  appointment: {
    scheduledDate: string;
    scheduledTime: string;
    serviceName: string;
  };
};

const REVIEW_STATUSES: ComplaintStatus[] = ["UNDER_REVIEW", "RESOLVED", "DISMISSED"];

const DECISION_OPTIONS: {
  value: ComplaintDecision;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: "WARNING_ISSUED", label: "Warning issued", icon: "warning-outline" },
  { value: "NO_ACTION", label: "No action", icon: "remove-circle-outline" },
  { value: "ACCOUNT_SUSPENDED", label: "Account suspended", icon: "lock-closed-outline" },
  { value: "ACCOUNT_BANNED", label: "Account banned", icon: "ban-outline" },
  { value: "REFUND_ISSUED", label: "Refund issued", icon: "cash-outline" },
];

function pickLocaleName(
  translations: { locale: string; name: string }[] | undefined,
): string {
  if (!translations?.length) return "";
  const want = i18n.language?.startsWith("ar") ? "AR" : "EN";
  return (
    translations.find((t) => t.locale === want)?.name ??
    translations[0]?.name ??
    ""
  );
}

function parseYmdLocal(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatBookingLine(scheduledDate: string, scheduledTime: string): string {
  try {
    const d = parseYmdLocal(scheduledDate.slice(0, 10));
    const day = d.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    return `${day} · ${scheduledTime}`;
  } catch {
    return `${scheduledDate} · ${scheduledTime}`;
  }
}

function formatFiledAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function parseDetail(raw: unknown): AdminComplaintDetailModel | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : null;
  if (!id) return null;

  const clientRaw = r.client as Record<string, unknown> | undefined;
  const cu = clientRaw?.user as Record<string, unknown> | undefined;
  if (!clientRaw || !cu) return null;

  const provRaw = r.provider as Record<string, unknown> | undefined;
  const pu = provRaw?.user as Record<string, unknown> | undefined;
  if (!provRaw || !pu) return null;

  const apRaw = r.appointment as Record<string, unknown> | undefined;
  const gs = apRaw?.givenService as Record<string, unknown> | undefined;
  const svc = gs?.service as
    | { translations?: { locale: string; name: string }[] }
    | undefined;
  if (!apRaw) return null;

  const scheduledDate =
    typeof apRaw.scheduledDate === "string"
      ? apRaw.scheduledDate.slice(0, 10)
      : apRaw.scheduledDate instanceof Date
        ? apRaw.scheduledDate.toISOString().slice(0, 10)
        : String(apRaw.scheduledDate ?? "").slice(0, 10);
  const scheduledTime = String(apRaw.scheduledTime ?? "");

  const evidenceUrls = Array.isArray(r.evidenceUrls)
    ? (r.evidenceUrls as string[])
    : [];

  const typeRaw = provRaw.type as string | undefined;
  const providerType =
    typeRaw === ProviderType.EMPLOYEE || typeRaw === "EMPLOYEE"
      ? ProviderType.EMPLOYEE
      : ProviderType.INDEPENDENT;

  return {
    id,
    category: r.category as ComplaintCategory,
    status: r.status as ComplaintStatus,
    description: typeof r.description === "string" ? r.description : "",
    evidenceUrls,
    targetIsEmployee: Boolean(r.targetIsEmployee),
    adminNotes: (r.adminNotes as string | null) ?? null,
    adminResponse: (r.adminResponse as string | null) ?? null,
    decision: (r.decision as ComplaintDecision | null) ?? null,
    createdAt: typeof r.createdAt === "string" ? r.createdAt : String(r.createdAt ?? ""),
    client: {
      imageUrl:
        typeof clientRaw.imageUrl === "string"
          ? clientRaw.imageUrl
          : clientRaw.imageUrl === null
            ? null
            : null,
      user: {
        firstName: String(cu.firstName ?? ""),
        lastName: String(cu.lastName ?? ""),
      },
    },
    provider: {
      photoUrl:
        typeof provRaw.photoUrl === "string"
          ? provRaw.photoUrl
          : provRaw.photoUrl === null
            ? null
            : null,
      city: String(provRaw.city ?? "").trim(),
      type: providerType,
      user: {
        firstName: String(pu.firstName ?? ""),
        lastName: String(pu.lastName ?? ""),
      },
    },
    appointment: {
      scheduledDate,
      scheduledTime,
      serviceName: pickLocaleName(svc?.translations) || "Service",
    },
  };
}

function statusLabel(status: ComplaintStatus): string {
  return status.replace(/_/g, " ");
}

function providerTypeLabel(
  type: ProviderType,
  targetIsEmployee: boolean,
): "Independent" | "Employee" {
  if (targetIsEmployee || type === ProviderType.EMPLOYEE) return "Employee";
  return "Independent";
}

export const AdminComplaintDetailScreen: React.FC<Props> = ({
  route,
  navigation,
}) => {
  const { complaintId } = route.params;
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const [row, setRow] = useState<AdminComplaintDetailModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const [selectedStatus, setSelectedStatus] = useState<ComplaintStatus | null>(null);
  const [selectedDecision, setSelectedDecision] = useState<ComplaintDecision | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [adminResponse, setAdminResponse] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getComplaintById(complaintId);
      const parsed = parseDetail(res.data);
      setRow(parsed);
      if (parsed) {
        setAdminNotes(parsed.adminNotes ?? "");
        setAdminResponse(parsed.adminResponse ?? "");
        setSelectedDecision(parsed.decision);
      }
    } catch {
      setRow(null);
    } finally {
      setLoading(false);
    }
  }, [complaintId]);

  useEffect(() => {
    void load();
  }, [load]);

  const isActionable = useMemo(() => {
    if (!row) return false;
    return row.status === "OPEN" || row.status === "UNDER_REVIEW";
  }, [row]);

  const showDecisionPicker = useMemo(() => {
    return (
      selectedStatus === "RESOLVED" || selectedStatus === "DISMISSED"
    );
  }, [selectedStatus]);

  const submitDisabled = useMemo(() => {
    if (!selectedStatus) return true;
    if (selectedStatus === "RESOLVED" || selectedStatus === "DISMISSED") {
      return !selectedDecision;
    }
    return false;
  }, [selectedStatus, selectedDecision]);

  const submitReview = useCallback(() => {
    if (!row || !selectedStatus || submitDisabled) return;

    const run = () => {
      setSubmitting(true);
      void api
        .reviewComplaint(row.id, {
          status: selectedStatus,
          adminNotes: adminNotes.trim() || undefined,
          adminResponse: adminResponse.trim() || undefined,
          decision:
            selectedStatus === "RESOLVED" || selectedStatus === "DISMISSED"
              ? selectedDecision ?? undefined
              : undefined,
        })
        .then(() => {
          navigation.goBack();
        })
        .catch(() => {
          Alert.alert("Error", "Could not submit review. Please try again.");
        })
        .finally(() => setSubmitting(false));
    };

    if (
      selectedDecision === "ACCOUNT_SUSPENDED" ||
      selectedDecision === "ACCOUNT_BANNED"
    ) {
      Alert.alert(
        "Confirm action",
        "⚠️ This will suspend/ban the provider's account. Are you sure?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Submit", style: "destructive", onPress: run },
        ],
      );
      return;
    }

    void run();
  }, [
    row,
    selectedStatus,
    selectedDecision,
    adminNotes,
    adminResponse,
    submitDisabled,
    navigation,
  ]);

  const showPreviousSection = useMemo(() => {
    if (!row) return false;
    if (row.status === "OPEN" || row.status === "UNDER_REVIEW") return false;
    return true;
  }, [row]);

  if (loading && !row) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  if (!row) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.muted}>Complaint not found.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
          <Text style={styles.link}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const cat =
    getCategoryOption(row.category) ?? CATEGORY_OPTIONS[CATEGORY_OPTIONS.length - 1];
  const clientName = `${row.client.user.firstName} ${row.client.user.lastName}`.trim();
  const providerName = `${row.provider.user.firstName} ${row.provider.user.lastName}`.trim();
  const pType = providerTypeLabel(row.provider.type, row.targetIsEmployee);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={22} color="#1A1A2E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Complaint</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Section 1 */}
        <Text style={styles.sectionHeading}>Complaint info</Text>
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Category</Text>
            <View style={styles.inlineIcon}>
              <Ionicons name={cat.icon} size={18} color={ACCENT} />
              <Text style={styles.valueBold}>{cat.label}</Text>
            </View>
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Status</Text>
            <Text style={styles.value}>{statusLabel(row.status)}</Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Filed</Text>
            <Text style={styles.value}>{formatFiledAt(row.createdAt)}</Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Target</Text>
            <Text style={styles.value}>
              {row.targetIsEmployee ? "Employee complaint" : "Independent provider"}
            </Text>
          </View>
        </View>

        {/* Section 2 */}
        <Text style={styles.sectionHeading}>Parties</Text>
        <View style={styles.partiesWrap}>
          <View style={styles.partyCard}>
            {row.client.imageUrl ? (
              <Image source={{ uri: row.client.imageUrl }} style={styles.partyImg} />
            ) : (
              <View style={[styles.partyImg, styles.partyImgPh]}>
                <Ionicons name="person" size={22} color={COLORS.gray[400]} />
              </View>
            )}
            <Text style={styles.partyName}>{clientName}</Text>
            <Text style={styles.partyRole}>Client</Text>
          </View>
          <Ionicons name="arrow-forward" size={22} color={ACCENT} />
          <View style={styles.partyCard}>
            {row.provider.photoUrl ? (
              <Image source={{ uri: row.provider.photoUrl }} style={styles.partyImg} />
            ) : (
              <View style={[styles.partyImg, styles.partyImgPh]}>
                <Ionicons name="person" size={22} color={COLORS.gray[400]} />
              </View>
            )}
            <Text style={styles.partyName}>{providerName}</Text>
            <Text style={styles.partyRole}>{pType}</Text>
            {row.provider.city ? (
              <Text style={styles.partyCity}>{row.provider.city}</Text>
            ) : null}
          </View>
        </View>

        {/* Section 3 */}
        <Text style={styles.sectionHeading}>Appointment</Text>
        <View style={styles.card}>
          <Text style={styles.valueBold}>{row.appointment.serviceName}</Text>
          <Text style={styles.apptLine}>
            {formatBookingLine(row.appointment.scheduledDate, row.appointment.scheduledTime)}
          </Text>
        </View>

        {/* Section 4 */}
        <Text style={styles.sectionHeading}>Client description</Text>
        <View style={styles.card}>
          <Text style={styles.bodyText}>{row.description}</Text>
          {row.evidenceUrls.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
              <View style={{ flexDirection: "row", gap: 10 }}>
                {row.evidenceUrls.map((uri) => (
                  <TouchableOpacity key={uri} onPress={() => setPreviewUri(uri)}>
                    <Image source={{ uri }} style={styles.evidenceThumb} />
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          ) : null}
        </View>

        {/* Section 5 */}
        {isActionable ? (
          <>
            <Text style={styles.sectionHeading}>Admin action</Text>
            <View style={styles.card}>
              <Text style={styles.label}>Next status</Text>
              <View style={styles.chipWrap}>
                {REVIEW_STATUSES.map((st) => {
                  const active = selectedStatus === st;
                  return (
                    <TouchableOpacity
                      key={st}
                      style={[styles.statusChip, active && styles.statusChipOn]}
                      onPress={() => {
                        setSelectedStatus(st);
                        if (st === "UNDER_REVIEW") setSelectedDecision(null);
                      }}
                    >
                      <Text style={[styles.statusChipTxt, active && styles.statusChipTxtOn]}>
                        {statusLabel(st)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {showDecisionPicker ? (
                <>
                  <Text style={[styles.label, { marginTop: 16 }]}>Decision</Text>
                  <View style={styles.decisionGrid}>
                    {DECISION_OPTIONS.map((d) => {
                      const on = selectedDecision === d.value;
                      return (
                        <TouchableOpacity
                          key={d.value}
                          style={[styles.decisionChip, on && styles.decisionChipOn]}
                          onPress={() => setSelectedDecision(d.value)}
                        >
                          <Ionicons
                            name={d.icon}
                            size={18}
                            color={on ? "#1E293B" : COLORS.gray[500]}
                          />
                          <Text style={[styles.decisionTxt, on && styles.decisionTxtOn]}>
                            {d.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              ) : null}

              <Text style={[styles.label, { marginTop: 16 }]}>Internal notes</Text>
              <TextInput
                style={styles.input}
                placeholder="Internal notes (not visible to client)"
                placeholderTextColor={COLORS.gray[400]}
                multiline
                maxLength={3000}
                value={adminNotes}
                onChangeText={setAdminNotes}
              />

              <Text style={[styles.label, { marginTop: 12 }]}>Client message</Text>
              <TextInput
                style={styles.input}
                placeholder="Message to send to the client"
                placeholderTextColor={COLORS.gray[400]}
                multiline
                maxLength={1000}
                value={adminResponse}
                onChangeText={setAdminResponse}
              />

              <TouchableOpacity
                style={[styles.submitBtn, submitDisabled && styles.submitBtnOff]}
                disabled={submitDisabled || submitting}
                onPress={submitReview}
              >
                {submitting ? (
                  <ActivityIndicator color="#0F172A" />
                ) : (
                  <Text style={styles.submitBtnTxt}>Submit decision</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        ) : null}

        {/* Section 6 */}
        {showPreviousSection ? (
          <>
            <Text style={styles.sectionHeading}>Previous admin notes</Text>
            <View style={styles.card}>
              <Text style={styles.label}>Internal notes</Text>
              <Text style={styles.readonly}>
                {row.adminNotes?.trim() ? row.adminNotes : "—"}
              </Text>
              <Text style={[styles.label, { marginTop: 12 }]}>Client message</Text>
              <Text style={styles.readonly}>
                {row.adminResponse?.trim() ? row.adminResponse : "—"}
              </Text>
            </View>
          </>
        ) : null}
      </ScrollView>

      <Modal
        visible={!!previewUri}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewUri(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setPreviewUri(null)}>
          <Image
            source={{ uri: previewUri ?? "" }}
            style={{ width: width * 0.92, height: height * 0.55 }}
            resizeMode="contain"
          />
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F4F3FA" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F4F3FA" },
  muted: { color: COLORS.gray[500] },
  link: { color: ACCENT, fontWeight: "700" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#EBEBF5",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: ACCENT_DIM,
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontWeight: "800", color: "#1A1A2E", letterSpacing: -0.3 },
  scroll: { padding: 16, gap: 8 },
  sectionHeading: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.gray[500],
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 8,
    marginBottom: 4,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 8,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  label: { fontSize: 12, fontWeight: "700", color: COLORS.gray[500] },
  value: { fontSize: 14, fontWeight: "600", color: COLORS.text.primary, maxWidth: "58%" },
  valueBold: { fontSize: 14, fontWeight: "800", color: COLORS.text.primary },
  inlineIcon: { flexDirection: "row", alignItems: "center", gap: 8, maxWidth: "62%" },
  partiesWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 8,
  },
  partyCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
  },
  partyImg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.gray[100],
  },
  partyImgPh: { justifyContent: "center", alignItems: "center" },
  partyName: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.text.primary,
    textAlign: "center",
  },
  partyRole: { marginTop: 2, fontSize: 12, fontWeight: "600", color: ACCENT },
  partyCity: { marginTop: 4, fontSize: 11, color: COLORS.gray[500] },
  apptLine: { marginTop: 6, fontSize: 14, color: COLORS.gray[600] },
  bodyText: { fontSize: 15, color: COLORS.text.primary, lineHeight: 22 },
  evidenceThumb: {
    width: 88,
    height: 88,
    borderRadius: 10,
    backgroundColor: COLORS.gray[100],
  },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.gray[100],
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statusChipOn: {
    backgroundColor: ACCENT_DIM,
    borderColor: ACCENT_BORDER,
  },
  statusChipTxt: { fontSize: 12, fontWeight: "700", color: COLORS.gray[600] },
  statusChipTxtOn: { color: ACCENT_DARK },
  decisionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  decisionChip: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.gray[50],
  },
  decisionChipOn: {
    backgroundColor: ACCENT_DIM,
    borderColor: ACCENT_BORDER,
  },
  decisionTxt: { fontSize: 12, fontWeight: "700", color: COLORS.text.secondary, flex: 1 },
  decisionTxtOn: { color: ACCENT_DARK },
  input: {
    marginTop: 6,
    minHeight: 88,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    color: COLORS.text.primary,
    textAlignVertical: "top",
    backgroundColor: "#FAFAFA",
  },
  submitBtn: {
    marginTop: 16,
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitBtnOff: { opacity: 0.45 },
  submitBtnTxt: { fontSize: 16, fontWeight: "800", color: "#FFFFFF" },
  readonly: {
    marginTop: 4,
    fontSize: 14,
    color: COLORS.text.primary,
    lineHeight: 20,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
  },
});
