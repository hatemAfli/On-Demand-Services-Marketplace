import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Pressable,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { api } from "../../../services/api";
import { AuthNoticeModal } from "../../../components/common";
import { COLORS } from "../../../constants";
import type { AdminValidationsStackParamList } from "./adminValidationsNavigation";

const ACCENT = "#E8C97A";

type CompanyEntity = {
  id: string;
  companyName: string;
  taxId: string;
  logo: string | null;
  city: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  serviceZones: string[];
  email: string | null;
  createdAt: string;
};

type CompanyAdminJoin = {
  id: string;
  companyId: string;
  createdAt: string;
  company: CompanyEntity | null;
} | null;

type ProviderJoin = {
  type: string;
  city: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  photoUrl: string | null;
  companyId: string | null;
} | null;

type VerificationUser = {
  id: string;
  email: string;
  phoneNumber?: string | null;
  firstName: string;
  lastName: string;
  role?: string;
  status?: string;
  companyAdmin?: CompanyAdminJoin;
  provider?: ProviderJoin;
};

type VerificationDoc = {
  id: string;
  type: string;
  fichierUrl: string;
  uploadedAt: string;
  validatedAt: string | null;
  isAccepted?: boolean | null;
  rejectionReason?: string | null;
};

type PriorSubmission = {
  id: string;
  requestStatus: string;
  createdAt: string;
  adminComment: string | null;
  documents: VerificationDoc[];
};

type ServiceDetail = {
  id: string;
  name: string;
  category?: { name: string; slug: string };
} | null;

type VerificationRequest = {
  id: string;
  requestStatus: string;
  ownerType?: string;
  createdAt: string;
  adminComment: string | null;
  ownerComment?: string | null;
  user: VerificationUser;
  service: ServiceDetail;
  documents: VerificationDoc[];
};

const REJECT_PRESET_LABELS = [
  "Incomplete or missing information",
  "Document illegible or low quality",
  "Wrong document type for this category",
  "Expired or out-of-date document",
  "Does not match registered profile information",
] as const;

function isCompanyRequest(r: VerificationRequest | null): boolean {
  if (!r) return false;
  return r.ownerType === "COMPANY" || r.user.role === "COMPANY_ADMIN";
}

function isImageUrl(url: string): boolean {
  const u = url.split("?")[0]?.toLowerCase() ?? "";
  return /\.(jpg|jpeg|png|gif|webp|heic|bmp)$/i.test(u);
}

function docReviewStatusLabel(doc: VerificationDoc): string {
  if (doc.isAccepted === true) return "Accepted";
  if (doc.isAccepted === false) return "Rejected";
  return "Pending review";
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function openMaps(lat: number, lng: number): void {
  const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  void Linking.openURL(url);
}

type Props = NativeStackScreenProps<
  AdminValidationsStackParamList,
  "ValidationProviderDetail"
>;

function DetailRow({
  icon,
  label,
  value,
  mono,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  mono?: boolean;
}) {
  if (!value || value === "—") return null;
  return (
    <View style={detailStyles.row}>
      <View style={detailStyles.rowIconWrap}>
        <Ionicons name={icon} size={14} color="#9B9BB0" />
      </View>
      <View style={detailStyles.rowText}>
        <Text style={detailStyles.rowLabel}>{label}</Text>
        <Text
          style={[detailStyles.rowValue, mono && detailStyles.rowMono]}
          selectable={mono}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

const detailStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "#F4F3FA",
  },
  rowIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#F4F3FA",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  rowText: { flex: 1, minWidth: 0 },
  rowLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#9B9BB0",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1A1A2E",
    lineHeight: 19,
  },
  rowMono: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 11,
    color: "#6B6B80",
  },
});

export const AdminValidationProviderDetailScreen: React.FC<Props> = ({
  navigation,
  route,
}) => {
  const { requestId, displayName, email: paramEmail } = route.params;
  const insets = useSafeAreaInsets();

  const [request, setRequest] = useState<VerificationRequest | null>(null);
  const [previousSubmissions, setPreviousSubmissions] = useState<
    PriorSubmission[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  const [rejectVisible, setRejectVisible] = useState(false);
  const [rejectCustom, setRejectCustom] = useState("");
  const [rejectPreset, setRejectPreset] = useState<string | null>(null);

  const [approveVisible, setApproveVisible] = useState(false);

  const [docRejectVisible, setDocRejectVisible] = useState(false);
  const [docRejectTargetId, setDocRejectTargetId] = useState<string | null>(
    null,
  );
  const [docRejectReasonInput, setDocRejectReasonInput] = useState("");
  const [docReviewActingId, setDocReviewActingId] = useState<string | null>(
    null,
  );

  const [notice, setNotice] = useState<{
    visible: boolean;
    title: string;
    message: string;
  }>({ visible: false, title: "", message: "" });

  const headerTitle =
    displayName?.trim() ||
    [request?.user?.firstName, request?.user?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    "Applicant";
  const headerEmail = paramEmail || request?.user.email || "";
  const company = isCompanyRequest(request);

  const allDocsAccepted = useMemo(() => {
    if (!request?.documents?.length) return false;
    return request.documents.every((d) => d.isAccepted === true);
  }, [request]);
  const allDocsReviewed = useMemo(() => {
    if (!request?.documents?.length) return false;
    return request.documents.every(
      (d) => d.isAccepted === true || d.isAccepted === false,
    );
  }, [request]);

  const docSummary = useMemo(() => {
    if (!request?.documents?.length) {
      return { accepted: 0, pending: 0, rejected: 0 };
    }
    let accepted = 0;
    let pending = 0;
    let rejected = 0;
    for (const d of request.documents) {
      if (d.isAccepted === true) accepted += 1;
      else if (d.isAccepted === false) rejected += 1;
      else pending += 1;
    }
    return { accepted, pending, rejected };
  }, [request]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.getAdminVerificationRequest(requestId);
      const current = res.data as VerificationRequest;
      setRequest(current);

      if (current?.user?.id) {
        const historyRes = await api.listAdminVerificationRequests({
          userId: current.user.id,
          take: 100,
        });
        const historyData = historyRes.data as {
          items?: Array<{
            id: string;
            requestStatus: string;
            createdAt: string;
            adminComment: string | null;
            documents?: VerificationDoc[];
          }>;
        };
        const previous = (historyData.items ?? [])
          .filter((item) => item.id !== current.id)
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          )
          .map((item) => ({
            id: item.id,
            requestStatus: item.requestStatus,
            createdAt: item.createdAt,
            adminComment: item.adminComment,
            documents: item.documents ?? [],
          }));
        setPreviousSubmissions(previous);
      } else {
        setPreviousSubmissions([]);
      }
    } catch {
      setError("Could not load requests.");
      setRequest(null);
      setPreviousSubmissions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [requestId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    void load();
  };

  const openFile = (url: string) => {
    void Linking.openURL(url).catch(() => {
      setNotice({
        visible: true,
        title: "Error",
        message: "Could not open this file.",
      });
    });
  };

  const showSuccess = (message: string) => {
    setNotice({ visible: true, title: "Success", message });
  };

  const actionable =
    request?.requestStatus === "PENDING" ||
    request?.requestStatus === "UNDER_REVIEW";
  const isAlreadyUnderReview = request?.requestStatus === "UNDER_REVIEW";

  const runUnderReview = async () => {
    if (!request) return;
    setActing(true);
    try {
      await api.markVerificationUnderReview(request.id);
      showSuccess("Status updated. An email was sent to the applicant.");
      await load();
    } catch (e: unknown) {
      setNotice({
        visible: true,
        title: "Error",
        message:
          (e as { response?: { data?: { message?: string } } })?.response?.data
            ?.message ?? "Something went wrong. Try again.",
      });
    } finally {
      setActing(false);
    }
  };

  const submitApprove = async () => {
    if (!request || !allDocsAccepted) return;
    setActing(true);
    try {
      await api.approveVerificationRequest(request.id);
      setApproveVisible(false);
      showSuccess(
        "Submission approved. The applicant has been notified by email.",
      );
      await load();
    } catch (e: unknown) {
      setNotice({
        visible: true,
        title: "Error",
        message:
          (e as { response?: { data?: { message?: string } } })?.response?.data
            ?.message ?? "Something went wrong. Try again.",
      });
    } finally {
      setActing(false);
    }
  };

  const submitReject = async () => {
    if (!request) return;
    const reason =
      rejectCustom.trim() || rejectPreset || "No additional details provided";
    if (!reason.trim()) {
      setNotice({
        visible: true,
        title: "Error",
        message: "Select or enter a rejection reason.",
      });
      return;
    }
    setActing(true);
    try {
      await api.rejectVerificationRequest(request.id, {
        reason: reason.trim(),
      });
      setRejectVisible(false);
      setRejectCustom("");
      setRejectPreset(null);
      await load();
    } catch (e: unknown) {
      setNotice({
        visible: true,
        title: "Error",
        message:
          (e as { response?: { data?: { message?: string } } })?.response?.data
            ?.message ?? "Something went wrong. Try again.",
      });
    } finally {
      setActing(false);
    }
  };

  const submitDocumentAccept = async (documentId: string) => {
    if (!request) return;
    setDocReviewActingId(documentId);
    try {
      await api.reviewVerificationDocument(request.id, documentId, {
        decision: "accept",
      });
      await load();
    } catch (e: unknown) {
      setNotice({
        visible: true,
        title: "Error",
        message:
          (e as { response?: { data?: { message?: string } } })?.response?.data
            ?.message ?? "Could not update document.",
      });
    } finally {
      setDocReviewActingId(null);
    }
  };

  const openDocumentReject = (documentId: string) => {
    setDocRejectTargetId(documentId);
    setDocRejectReasonInput("");
    setDocRejectVisible(true);
  };

  const submitDocumentReject = async () => {
    if (!request || !docRejectTargetId) return;
    const reason = docRejectReasonInput.trim();
    if (!reason) {
      setNotice({
        visible: true,
        title: "Error",
        message: "Enter a short reason for rejecting this file.",
      });
      return;
    }
    setDocReviewActingId(docRejectTargetId);
    try {
      await api.reviewVerificationDocument(request.id, docRejectTargetId, {
        decision: "reject",
        rejectionReason: reason,
      });
      setDocRejectVisible(false);
      setDocRejectTargetId(null);
      setDocRejectReasonInput("");
      showSuccess("Document marked as rejected.");
      await load();
    } catch (e: unknown) {
      setNotice({
        visible: true,
        title: "Error",
        message:
          (e as { response?: { data?: { message?: string } } })?.response?.data
            ?.message ?? "Could not update document.",
      });
    } finally {
      setDocReviewActingId(null);
    }
  };

  const renderCompanySections = () => {
    if (!request || !company) return null;
    const u = request.user;
    const ca = u.companyAdmin;
    const co = ca?.company;

    return (
      <>
        <View style={styles.sectionCard}>
          <View style={styles.sectionCardHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: "#EDE9FE" }]}>
              <Ionicons name="person" size={16} color="#6D28D9" />
            </View>
            <Text style={styles.sectionCardTitle}>Company administrator</Text>
          </View>
          <DetailRow
            icon="person-outline"
            label="Full name"
            value={headerTitle}
          />
          <DetailRow icon="mail-outline" label="Email" value={u.email} />
          <DetailRow
            icon="call-outline"
            label="Phone"
            value={u.phoneNumber?.trim() || "—"}
          />
          <DetailRow
            icon="id-card-outline"
            label="Account status"
            value={u.status ?? "—"}
          />
          <DetailRow icon="shield-outline" label="Role" value={u.role ?? "—"} />
          <DetailRow icon="key-outline" label="User ID" value={u.id} mono />
          {ca ? (
            <DetailRow
              icon="link-outline"
              label="Company admin record ID"
              value={ca.id}
              mono
            />
          ) : null}
        </View>

        {co ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionCardHeader}>
              <View
                style={[styles.sectionIcon, { backgroundColor: "#E0F2FE" }]}
              >
                <Ionicons name="business" size={16} color="#0369A1" />
              </View>
              <Text style={styles.sectionCardTitle}>Company</Text>
            </View>
            {co.logo ? (
              <Image
                source={{ uri: co.logo }}
                style={styles.companyLogo}
                resizeMode="contain"
              />
            ) : null}
            <DetailRow
              icon="ribbon-outline"
              label="Company name"
              value={co.companyName}
            />
            <DetailRow
              icon="document-text-outline"
              label="Tax ID"
              value={co.taxId}
            />
            <DetailRow icon="location-outline" label="City" value={co.city} />
            <DetailRow
              icon="map-outline"
              label="Address"
              value={co.address?.trim() || "—"}
            />
            <DetailRow
              icon="mail-outline"
              label="Company email"
              value={co.email?.trim() || "—"}
            />
            <DetailRow
              icon="key-outline"
              label="Company ID"
              value={co.id}
              mono
            />
            {co.latitude != null && co.longitude != null ? (
              <View style={styles.mapActions}>
                <TouchableOpacity
                  style={styles.mapBtn}
                  onPress={() => openMaps(co.latitude!, co.longitude!)}
                >
                  <Ionicons name="navigate" size={15} color="#0369A1" />
                  <Text style={styles.mapBtnText}>Open in Maps</Text>
                </TouchableOpacity>
                <Text style={styles.coordsText}>
                  {co.latitude.toFixed(5)}, {co.longitude.toFixed(5)}
                </Text>
              </View>
            ) : null}
            {co.serviceZones?.length ? (
              <View style={styles.zonesBlock}>
                <Text style={styles.zonesLabel}>Service zones</Text>
                <View style={styles.zonesWrap}>
                  {co.serviceZones.map((z) => (
                    <View key={z} style={styles.zoneChip}>
                      <Text style={styles.zoneChipText}>{z}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
            <Text style={styles.metaFoot}>
              Company record since {formatDate(co.createdAt)}
            </Text>
          </View>
        ) : (
          <View style={styles.warnBanner}>
            <View style={styles.warnBannerIconWrap}>
              <Ionicons name="warning-outline" size={18} color="#B45309" />
            </View>
            <Text style={styles.warnBannerText}>
              Company profile is not linked to this admin yet. Check the
              database if details are missing.
            </Text>
          </View>
        )}
      </>
    );
  };

  const renderProviderProfile = () => {
    if (!request || company) return null;
    const p = request.user.provider;
    const svc = request.service;
    const hasServiceInfo = !!(svc?.name || svc?.category?.name);
    if (!p && !hasServiceInfo) return null;
    const hasCoords = p != null && p.latitude != null && p.longitude != null;
    return (
      <View style={styles.sectionCard}>
        <View style={styles.sectionCardHeader}>
          <View style={[styles.sectionIcon, { backgroundColor: "#D1FAE5" }]}>
            <Ionicons name="briefcase-outline" size={16} color="#047857" />
          </View>
          <Text style={styles.sectionCardTitle}>Provider profile</Text>
        </View>
        {svc?.name ? (
          <DetailRow
            icon="briefcase-outline"
            label="Service"
            value={svc.name}
          />
        ) : null}
        {svc?.category?.name ? (
          <DetailRow
            icon="folder-outline"
            label="Category"
            value={svc.category.name}
          />
        ) : null}
        {p ? (
          <>
            <DetailRow
              icon="git-branch-outline"
              label="Provider type"
              value={p.type}
            />
            <DetailRow icon="location-outline" label="City" value={p.city} />
            <DetailRow
              icon="map-outline"
              label="Address"
              value={p.address?.trim() || "—"}
            />
            {hasCoords ? (
              <View style={styles.mapActions}>
                <TouchableOpacity
                  style={styles.mapBtn}
                  onPress={() => openMaps(p.latitude!, p.longitude!)}
                >
                  <Ionicons name="navigate" size={15} color="#0369A1" />
                  <Text style={styles.mapBtnText}>Open in Maps</Text>
                </TouchableOpacity>
                <Text style={styles.coordsText}>
                  {p.latitude!.toFixed(5)}, {p.longitude!.toFixed(5)}
                </Text>
              </View>
            ) : null}
          </>
        ) : null}
      </View>
    );
  };

  /* ─── Render ─────────────────────────────────────────────────────────── */
  return (
    <View style={styles.root}>
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={12}
        >
          <View style={styles.backBtnInner}>
            <Ionicons name="chevron-back" size={18} color="#1A1A2E" />
          </View>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      </View>

      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.heroMainRow}>
          <View style={[styles.avatar, company && styles.avatarCompany]}>
            <Text
              style={[styles.avatarText, company && styles.avatarTextCompany]}
            >
              {(headerTitle || "?")
                .split(" ")
                .map((w) => w[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </Text>
          </View>
          <View style={styles.heroTextCol}>
            <Text style={styles.heroTitle} numberOfLines={2}>
              {headerTitle}
            </Text>
            <Text style={styles.heroEmail} numberOfLines={1}>
              {headerEmail}
            </Text>
          </View>
        </View>

        {request ? (
          <View style={styles.heroMetaRow}>
            <View
              style={[
                styles.heroKind,
                company ? styles.heroKindCompany : styles.heroKindProvider,
              ]}
            >
              <Ionicons
                name={company ? "business" : "briefcase-outline"}
                size={11}
                color={company ? "#6D28D9" : "#0369A1"}
              />
              <Text
                style={[
                  styles.heroKindText,
                  company ? styles.heroKindTextCo : styles.heroKindTextPr,
                ]}
              >
                {company ? "Company" : "Provider"}
              </Text>
            </View>
            <View
              style={[
                styles.statusPill,
                statusPillStyle(request.requestStatus),
              ]}
            >
              <View
                style={[
                  styles.statusPillDot,
                  statusDotStyle(request.requestStatus),
                ]}
              />
              <Text
                style={[
                  styles.statusPillText,
                  statusPillTextStyle(request.requestStatus),
                ]}
              >
                {request.requestStatus.replace("_", " ")}
              </Text>
            </View>
            <Text style={styles.submittedAtInline} numberOfLines={1}>
              {formatDate(request.createdAt)}
            </Text>
          </View>
        ) : null}

        {/* Doc progress bar */}
        {request && request.documents.length > 0 ? (
          <View style={styles.docProgressRow}>
            <View style={styles.docProgressBar}>
              {request.documents.length > 0 ? (
                <>
                  <View
                    style={[
                      styles.docProgressFill,
                      styles.docProgressAccepted,
                      { flex: docSummary.accepted },
                    ]}
                  />
                  <View
                    style={[
                      styles.docProgressFill,
                      styles.docProgressRejected,
                      { flex: docSummary.rejected },
                    ]}
                  />
                  <View
                    style={[
                      styles.docProgressFill,
                      styles.docProgressPending,
                      { flex: docSummary.pending },
                    ]}
                  />
                </>
              ) : null}
            </View>
            <Text style={styles.docProgressLabel}>
              {docSummary.accepted}/{request.documents.length} accepted
              {docSummary.rejected > 0
                ? ` · ${docSummary.rejected} rejected`
                : ""}
              {docSummary.pending > 0 ? ` · ${docSummary.pending} pending` : ""}
            </Text>
          </View>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <View style={styles.loadingCard}>
            <ActivityIndicator color={ACCENT} size="large" />
            <Text style={styles.loadingText}>Loading applicant data…</Text>
          </View>
        </View>
      ) : error || !request ? (
        <View style={styles.centered}>
          <View style={styles.errorCard}>
            <Ionicons name="cloud-offline-outline" size={36} color="#9B9BB0" />
            <Text style={styles.errorText}>
              {error ?? "Could not load requests."}
            </Text>
            <TouchableOpacity
              onPress={() => void load()}
              style={styles.retryBtn}
            >
              <Ionicons name="refresh-outline" size={14} color="#1A1A0A" />
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={[
              styles.scrollInner,
              {
                paddingBottom: actionable
                  ? 196 + insets.bottom
                  : 40 + insets.bottom,
              },
            ]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={ACCENT}
                colors={[ACCENT]}
              />
            }
            showsVerticalScrollIndicator={false}
          >
            {renderCompanySections()}
            {renderProviderProfile()}

            {request.ownerComment?.trim() ? (
              <View style={styles.ownerCommentBox}>
                <View style={styles.ownerCommentHeader}>
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={14}
                    color="#047857"
                  />
                  <Text style={styles.ownerCommentLabel}>Applicant note</Text>
                </View>
                <Text style={styles.ownerCommentText}>
                  {request.ownerComment}
                </Text>
              </View>
            ) : null}

            {previousSubmissions.some((s) => (s.documents?.length ?? 0) > 0) ? (
              <View style={styles.priorBox}>
                <View style={styles.priorTitleRow}>
                  <Ionicons name="time-outline" size={14} color="#9B9BB0" />
                  <Text style={styles.priorTitle}>Previous submissions</Text>
                </View>
                {previousSubmissions.map((submission) => (
                  <View key={submission.id} style={styles.priorSubmissionBlock}>
                    <View style={styles.priorMetaRow}>
                      <View
                        style={[
                          styles.priorStatusDot,
                          priorStatusDot(submission.requestStatus),
                        ]}
                      />
                      <Text style={styles.priorMeta}>
                        {submission.requestStatus} ·{" "}
                        {formatDate(submission.createdAt)}
                      </Text>
                    </View>
                    {submission.adminComment ? (
                      <Text style={styles.priorComment}>
                        {submission.adminComment}
                      </Text>
                    ) : null}
                    {submission.documents.map((doc, index) => (
                      <View key={doc.id} style={styles.priorDocRow}>
                        <View style={styles.priorDocMain}>
                          <Text style={styles.priorDocLine}>
                            {index + 1}. {doc.type} ·{" "}
                            {docReviewStatusLabel(doc)}
                          </Text>
                          {doc.rejectionReason ? (
                            <Text style={styles.priorDocReason}>
                              {doc.rejectionReason}
                            </Text>
                          ) : null}
                        </View>
                        <TouchableOpacity
                          style={styles.priorDocOpenBtn}
                          onPress={() => openFile(doc.fichierUrl)}
                          hitSlop={10}
                          accessibilityRole="button"
                          accessibilityLabel="Open previous document"
                        >
                          <Ionicons
                            name="eye-outline"
                            size={16}
                            color="#6B6B80"
                          />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            ) : null}

            {/* Documents section header */}
            <View style={styles.docsSectionHeader}>
              <View style={styles.docsSectionIconWrap}>
                <Ionicons
                  name="documents-outline"
                  size={13}
                  color={ACCENT === "#E8C97A" ? "#B45309" : "#B45309"}
                />
              </View>
              <Text style={styles.docsSectionTitle}>
                Current documents ({request.documents.length})
              </Text>
            </View>
            <Text style={styles.docWorkflowHint}>
              Accept or reject each file individually. You may approve the
              request only after every file is accepted.
            </Text>

            {request.documents.map((doc, index) => {
              const docStatus =
                doc.isAccepted === true
                  ? "accepted"
                  : doc.isAccepted === false
                    ? "rejected"
                    : "pending";
              return (
                <View
                  key={doc.id}
                  style={[
                    styles.docCard,
                    docStatus === "accepted" && styles.docCardAccepted,
                    docStatus === "rejected" && styles.docCardRejected,
                  ]}
                >
                  {/* Doc card stripe */}
                  <View
                    style={[
                      styles.docCardStripe,
                      docStatus === "accepted" && styles.docCardStripeAccepted,
                      docStatus === "rejected" && styles.docCardStripeRejected,
                      docStatus === "pending" && styles.docCardStripePending,
                    ]}
                  />

                  <View style={styles.docCardBody}>
                    <View style={styles.docCardHeader}>
                      <View style={styles.docIndexWrap}>
                        <Text style={styles.docIndex}>{index + 1}</Text>
                      </View>
                      <Text style={styles.docType}>{doc.type}</Text>
                      <View
                        style={[
                          styles.docStatusMini,
                          doc.isAccepted === true && styles.docStatusMiniOk,
                          doc.isAccepted === false && styles.docStatusMiniBad,
                        ]}
                      >
                        <Text
                          style={[
                            styles.docStatusMiniText,
                            doc.isAccepted === true &&
                              styles.docStatusMiniTextOk,
                            doc.isAccepted === false &&
                              styles.docStatusMiniTextBad,
                          ]}
                        >
                          {docReviewStatusLabel(doc)}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.docDate}>
                      {formatDate(doc.uploadedAt)}
                    </Text>

                    {doc.rejectionReason ? (
                      <View style={styles.docRejectReasonBox}>
                        <Ionicons
                          name="alert-circle-outline"
                          size={13}
                          color="#B91C1C"
                        />
                        <Text style={styles.docRejectReason}>
                          {doc.rejectionReason}
                        </Text>
                      </View>
                    ) : null}

                    <View style={styles.previewRow}>
                      {isImageUrl(doc.fichierUrl) ? (
                        <Image
                          source={{ uri: doc.fichierUrl }}
                          style={styles.previewImg}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.previewPlaceholder}>
                          <Ionicons
                            name="document-text"
                            size={32}
                            color="#B45309"
                          />
                          <Text style={styles.previewHint}>PDF / file</Text>
                        </View>
                      )}
                      <TouchableOpacity
                        style={styles.openBtn}
                        onPress={() => openFile(doc.fichierUrl)}
                        activeOpacity={0.85}
                      >
                        <Ionicons
                          name="open-outline"
                          size={17}
                          color="#1A1A0A"
                        />
                        <Text style={styles.openBtnText}>Open file</Text>
                      </TouchableOpacity>
                    </View>

                    {actionable ? (
                      <View style={styles.docDecisionRow}>
                        <TouchableOpacity
                          style={[
                            styles.docDecisionBtn,
                            styles.docDecisionBtnAccept,
                            doc.isAccepted === true &&
                              styles.docDecisionBtnDone,
                          ]}
                          onPress={() => void submitDocumentAccept(doc.id)}
                          disabled={
                            docReviewActingId !== null ||
                            doc.isAccepted === true
                          }
                        >
                          {docReviewActingId === doc.id ? (
                            <ActivityIndicator color="#065F46" size="small" />
                          ) : (
                            <>
                              <Ionicons
                                name="checkmark-circle"
                                size={15}
                                color={
                                  doc.isAccepted === true
                                    ? "#6EE7B7"
                                    : "#065F46"
                                }
                              />
                              <Text style={styles.docDecisionBtnAcceptText}>
                                Accept
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.docDecisionBtn,
                            styles.docDecisionBtnReject,
                            doc.isAccepted === false &&
                              styles.docDecisionBtnDone,
                          ]}
                          onPress={() => openDocumentReject(doc.id)}
                          disabled={
                            docReviewActingId !== null ||
                            doc.isAccepted === false
                          }
                        >
                          <Ionicons
                            name="close-circle"
                            size={15}
                            color={
                              doc.isAccepted === false ? "#FECACA" : "#991B1B"
                            }
                          />
                          <Text style={styles.docDecisionBtnRejectText}>
                            Reject
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })}

            {request.requestStatus === "REJECTED" && request.adminComment ? (
              <View style={styles.commentBox}>
                <View style={styles.commentHeader}>
                  <Ionicons
                    name="close-circle-outline"
                    size={14}
                    color="#B91C1C"
                  />
                  <Text style={styles.commentLabel}>Rejection reason</Text>
                </View>
                <Text style={styles.commentText}>{request.adminComment}</Text>
              </View>
            ) : null}
          </ScrollView>

          {/* Footer actions */}
          {actionable ? (
            <View
              style={[
                styles.footerActions,
                { paddingBottom: 15 + insets.bottom, paddingTop: 10 },
              ]}
            >
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    styles.actionReview,
                    isAlreadyUnderReview && styles.actionBtnDisabled,
                  ]}
                  onPress={() => void runUnderReview()}
                  disabled={acting || isAlreadyUnderReview}
                >
                  {acting ? (
                    <ActivityIndicator color="#0369A1" size="small" />
                  ) : (
                    <>
                      <Ionicons
                        name="eye-outline"
                        size={16}
                        color={isAlreadyUnderReview ? "#9B9BB0" : "#0369A1"}
                      />
                      <Text
                        style={[
                          styles.actionReviewText,
                          isAlreadyUnderReview && styles.actionReviewTextDisabled,
                        ]}
                      >
                        Under review
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    styles.actionApprove,
                    !allDocsAccepted && styles.actionBtnDisabled,
                  ]}
                  onPress={() => setApproveVisible(true)}
                  disabled={acting || !allDocsAccepted}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color={allDocsAccepted ? "#1A1A0A" : "#9B9BB0"}
                  />
                  <Text
                    style={[
                      styles.actionApproveText,
                      !allDocsAccepted && styles.actionApproveTextDisabled,
                    ]}
                  >
                    Approve
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    styles.actionReject,
                    !allDocsReviewed && styles.actionBtnDisabled,
                  ]}
                  onPress={() => {
                    setRejectCustom("");
                    setRejectPreset(null);
                    setRejectVisible(true);
                  }}
                  disabled={acting || !allDocsReviewed}
                >
                  <Ionicons name="close-circle" size={16} color="#B91C1C" />
                  <Text
                    style={[
                      styles.actionRejectText,
                      !allDocsReviewed && styles.actionRejectTextDisabled,
                    ]}
                  >
                    Reject
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </>
      )}

      {/* Approve modal */}
      <Modal
        visible={approveVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setApproveVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setApproveVisible(false)}
        >
          <Pressable
            style={styles.modalCard}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHandle} />
            <View style={styles.modalIconRow}>
              <View
                style={[
                  styles.modalTitleIcon,
                  { backgroundColor: "rgba(232,201,122,0.2)" },
                ]}
              >
                <Ionicons name="checkmark-circle" size={22} color="#B45309" />
              </View>
            </View>
            <Text style={styles.modalTitle}>Approve verification</Text>
            <Text style={styles.modalSub}>
              This confirms the whole submission after every individual file has
              been marked accepted. The applicant will be notified by email.
            </Text>
            {!allDocsAccepted ? (
              <View style={styles.modalWarnBox}>
                <Ionicons name="warning-outline" size={14} color="#B45309" />
                <Text style={styles.modalWarn}>
                  You must accept each document first (use Accept on every
                  file).
                </Text>
              </View>
            ) : null}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setApproveVisible(false)}
              >
                <Text style={styles.modalCancelText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirm,
                  !allDocsAccepted && styles.actionBtnDisabled,
                ]}
                onPress={() => void submitApprove()}
                disabled={!allDocsAccepted}
              >
                <Text style={styles.modalConfirmText}>Confirm approve</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Reject modal */}
      <Modal
        visible={rejectVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRejectVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setRejectVisible(false)}
        >
          <Pressable
            style={styles.modalCardLarge}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHandle} />
            <View style={styles.modalIconRow}>
              <View
                style={[styles.modalTitleIcon, { backgroundColor: "#FEF2F2" }]}
              >
                <Ionicons name="close-circle" size={22} color="#B91C1C" />
              </View>
            </View>
            <Text style={styles.modalTitle}>Reject verification</Text>
            <Text style={styles.rejectHint}>
              This rejects the entire submission (all files).
            </Text>
            {REJECT_PRESET_LABELS.map((label) => {
              const selected = rejectPreset === label;
              return (
                <TouchableOpacity
                  key={label}
                  style={[styles.presetChip, selected && styles.presetChipOn]}
                  onPress={() => {
                    setRejectPreset(label);
                    setRejectCustom("");
                  }}
                >
                  {selected ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={14}
                      color="#B45309"
                    />
                  ) : (
                    <Ionicons
                      name="ellipse-outline"
                      size={14}
                      color="#C4C4C4"
                    />
                  )}
                  <Text
                    style={[
                      styles.presetChipText,
                      selected && styles.presetChipTextOn,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <Text style={styles.customLabel}>Custom reason</Text>
            <TextInput
              style={styles.input}
              placeholder="Explain what is missing or incorrect…"
              placeholderTextColor="#C4C4C4"
              value={rejectCustom}
              onChangeText={(txt) => {
                setRejectCustom(txt);
                if (txt.trim()) setRejectPreset(null);
              }}
              multiline
              maxLength={4000}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setRejectVisible(false)}
              >
                <Text style={styles.modalCancelText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, styles.modalDanger]}
                onPress={() => void submitReject()}
              >
                <Text style={styles.modalConfirmTextLight}>Confirm reject</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Doc reject modal */}
      <Modal
        visible={docRejectVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setDocRejectVisible(false);
          setDocRejectTargetId(null);
        }}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => {
            setDocRejectVisible(false);
            setDocRejectTargetId(null);
          }}
        >
          <Pressable
            style={styles.modalCard}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHandle} />
            <View style={styles.modalIconRow}>
              <View
                style={[styles.modalTitleIcon, { backgroundColor: "#FEF2F2" }]}
              >
                <Ionicons name="document" size={22} color="#B91C1C" />
              </View>
            </View>
            <Text style={styles.modalTitle}>Reject this document</Text>
            <Text style={styles.modalSub}>
              The applicant will see this note next to the file. The overall
              request cannot be approved until every file is accepted.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Reason (required)…"
              placeholderTextColor="#C4C4C4"
              value={docRejectReasonInput}
              onChangeText={setDocRejectReasonInput}
              multiline
              maxLength={4000}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => {
                  setDocRejectVisible(false);
                  setDocRejectTargetId(null);
                }}
              >
                <Text style={styles.modalCancelText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, styles.modalDanger]}
                onPress={() => void submitDocumentReject()}
                disabled={docReviewActingId !== null}
              >
                <Text style={styles.modalConfirmTextLight}>
                  {docReviewActingId ? "Saving…" : "Reject file"}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <AuthNoticeModal
        visible={notice.visible}
        onClose={() => setNotice((n) => ({ ...n, visible: false }))}
        title={notice.title}
        message={notice.message}
        primaryLabel="Close"
        onPrimary={() => setNotice((n) => ({ ...n, visible: false }))}
      />
    </View>
  );
};

/* ─── Status helpers ────────────────────────────────────────────────────── */

function statusPillStyle(status: string) {
  switch (status) {
    case "APPROVED":
      return {
        backgroundColor: "#ECFDF5",
        borderColor: "#6EE7B7",
        borderWidth: 1,
      };
    case "REJECTED":
      return {
        backgroundColor: "#FEF2F2",
        borderColor: "#FECACA",
        borderWidth: 1,
      };
    case "UNDER_REVIEW":
      return {
        backgroundColor: "#EFF6FF",
        borderColor: "#93C5FD",
        borderWidth: 1,
      };
    default:
      return {
        backgroundColor: "#FFFBEB",
        borderColor: "#FDE68A",
        borderWidth: 1,
      };
  }
}

function statusPillTextStyle(status: string) {
  switch (status) {
    case "APPROVED":
      return { color: "#059669" };
    case "REJECTED":
      return { color: "#DC2626" };
    case "UNDER_REVIEW":
      return { color: "#1D4ED8" };
    default:
      return { color: "#B45309" };
  }
}

function statusDotStyle(status: string) {
  switch (status) {
    case "APPROVED":
      return { backgroundColor: "#059669" };
    case "REJECTED":
      return { backgroundColor: "#DC2626" };
    case "UNDER_REVIEW":
      return { backgroundColor: "#3B82F6" };
    default:
      return { backgroundColor: "#F59E0B" };
  }
}

function priorStatusDot(status: string) {
  switch (status) {
    case "APPROVED":
      return { backgroundColor: "#059669" };
    case "REJECTED":
      return { backgroundColor: "#DC2626" };
    case "UNDER_REVIEW":
      return { backgroundColor: "#3B82F6" };
    default:
      return { backgroundColor: "#F59E0B" };
  }
}

/* ─── Styles ────────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F4F3FA" },

  /* Top bar */
  topBar: {
    paddingHorizontal: 16,
    paddingBottom: 6,
    backgroundColor: "#FFFFFF",
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  backBtnInner: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: "#F4F3FA",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#EBEBF5",
  },
  backText: { color: "#1A1A2E", fontSize: 14, fontWeight: "700" },

  /* Hero */
  hero: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#EBEBF5",
    gap: 12,
    shadowColor: "#1A1A2E",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  heroMainRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  heroTextCol: { flex: 1, minWidth: 0 },
  heroMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  heroKind: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  heroKindCompany: { backgroundColor: "#EDE9FE" },
  heroKindProvider: { backgroundColor: "#E0F2FE" },
  heroKindText: { fontSize: 11, fontWeight: "800" },
  heroKindTextCo: { color: "#6D28D9" },
  heroKindTextPr: { color: "#0369A1" },

  /* Avatar */
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "rgba(232,201,122,0.22)",
    borderWidth: 2,
    borderColor: "rgba(232,201,122,0.5)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarCompany: {
    backgroundColor: "#EDE9FE",
    borderColor: "#C4B5FD",
  },
  avatarText: { fontSize: 18, fontWeight: "800", color: "#B45309" },
  avatarTextCompany: { color: "#6D28D9" },

  heroTitle: { fontSize: 17, fontWeight: "800", color: "#1A1A2E" },
  heroEmail: {
    marginTop: 2,
    fontSize: 12,
    color: "#9B9BB0",
    fontWeight: "500",
  },

  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusPillDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  submittedAtInline: {
    fontSize: 11,
    color: "#9B9BB0",
    fontWeight: "500",
    flexShrink: 1,
  },

  /* Doc progress */
  docProgressRow: { gap: 6 },
  docProgressBar: {
    height: 5,
    borderRadius: 999,
    backgroundColor: "#F4F3FA",
    flexDirection: "row",
    overflow: "hidden",
  },
  docProgressFill: { height: "100%" },
  docProgressAccepted: { backgroundColor: "#34D399" },
  docProgressRejected: { backgroundColor: "#F87171" },
  docProgressPending: { backgroundColor: "#FDE68A" },
  docProgressLabel: { fontSize: 11, color: "#9B9BB0", fontWeight: "600" },

  /* Scroll */
  scrollInner: { paddingHorizontal: 14, gap: 12, paddingTop: 14 },

  /* Section cards */
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingBottom: 6,
    borderWidth: 1,
    borderColor: "#EBEBF5",
    shadowColor: "#1A1A2E",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  sectionCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F4F3FA",
    marginBottom: 2,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionCardTitle: { fontSize: 14, fontWeight: "800", color: "#1A1A2E" },

  companyLogo: {
    width: "100%",
    height: 64,
    borderRadius: 10,
    marginBottom: 6,
    marginTop: 4,
    backgroundColor: "#F4F3FA",
  },
  mapActions: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#F4F3FA",
    marginTop: 4,
    gap: 8,
  },
  mapBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: "#E0F2FE",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BAE6FD",
  },
  mapBtnText: { fontSize: 13, fontWeight: "700", color: "#0369A1" },
  coordsText: {
    fontSize: 11,
    color: "#9B9BB0",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  zonesBlock: { paddingVertical: 8 },
  zonesLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#9B9BB0",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  zonesWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  zoneChip: {
    backgroundColor: "#F4F3FA",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#EBEBF5",
  },
  zoneChipText: { fontSize: 12, fontWeight: "600", color: "#6B6B80" },
  metaFoot: {
    fontSize: 11,
    color: "#9B9BB0",
    paddingBottom: 8,
    fontStyle: "italic",
  },

  warnBanner: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    backgroundColor: "#FFFBEB",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FDE68A",
    alignItems: "flex-start",
  },
  warnBannerIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  warnBannerText: {
    flex: 1,
    fontSize: 13,
    color: "#92400E",
    lineHeight: 18,
    fontWeight: "500",
  },

  /* Owner comment */
  ownerCommentBox: {
    backgroundColor: "#F0FDF4",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  ownerCommentHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  ownerCommentLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#047857",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  ownerCommentText: { fontSize: 14, color: "#1A4731", lineHeight: 20 },

  /* Prior submissions */
  priorBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#EBEBF5",
    gap: 8,
  },
  priorTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  priorTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#6B6B80",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  priorMetaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  priorStatusDot: { width: 7, height: 7, borderRadius: 4 },
  priorMeta: { fontSize: 11, color: "#9B9BB0", fontWeight: "600" },
  priorSubmissionBlock: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F4F3FA",
    gap: 4,
  },
  priorComment: { fontSize: 12, color: "#6B6B80", fontStyle: "italic" },
  priorDocRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: "#F4F3FA",
  },
  priorDocMain: { flex: 1, minWidth: 0 },
  priorDocOpenBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#F4F3FA",
    alignItems: "center",
    justifyContent: "center",
  },
  priorDocLine: { fontSize: 12, fontWeight: "600", color: "#1A1A2E" },
  priorDocReason: {
    fontSize: 11,
    color: "#B91C1C",
    marginTop: 3,
    lineHeight: 15,
  },

  /* Documents section header */
  docsSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  docsSectionIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: "rgba(232,201,122,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  docsSectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#B45309",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  docWorkflowHint: {
    fontSize: 12,
    color: "#9B9BB0",
    marginBottom: 4,
    lineHeight: 17,
    paddingHorizontal: 2,
  },

  /* Doc card */
  docCard: {
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EBEBF5",
    flexDirection: "row",
    overflow: "hidden",
    shadowColor: "#1A1A2E",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  docCardAccepted: { borderColor: "#86EFAC" },
  docCardRejected: { borderColor: "#FECACA" },
  docCardStripe: { width: 4, alignSelf: "stretch" },
  docCardStripeAccepted: { backgroundColor: "#34D399" },
  docCardStripeRejected: { backgroundColor: "#F87171" },
  docCardStripePending: { backgroundColor: "#FDE68A" },
  docCardBody: { flex: 1, padding: 12 },
  docCardHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  docIndexWrap: {
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: "#F4F3FA",
    alignItems: "center",
    justifyContent: "center",
  },
  docIndex: { fontSize: 11, fontWeight: "800", color: "#9B9BB0" },
  docType: { fontSize: 14, fontWeight: "700", color: "#1A1A2E", flex: 1 },
  docStatusMini: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "#F4F3FA",
    borderWidth: 1,
    borderColor: "#EBEBF5",
  },
  docStatusMiniOk: { backgroundColor: "#ECFDF5", borderColor: "#86EFAC" },
  docStatusMiniBad: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  docStatusMiniText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#9B9BB0",
    textTransform: "uppercase",
  },
  docStatusMiniTextOk: { color: "#059669" },
  docStatusMiniTextBad: { color: "#DC2626" },

  docDate: {
    fontSize: 11,
    color: "#9B9BB0",
    marginBottom: 8,
    fontWeight: "500",
  },
  docRejectReasonBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: "#FEF2F2",
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  docRejectReason: { fontSize: 12, color: "#B91C1C", flex: 1, lineHeight: 16 },

  previewRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "stretch",
    marginBottom: 0,
  },
  previewImg: {
    width: 88,
    height: 88,
    borderRadius: 12,
    backgroundColor: "#F4F3FA",
  },
  previewPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 12,
    backgroundColor: "rgba(232,201,122,0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(232,201,122,0.35)",
  },
  previewHint: { fontSize: 10, color: "#9B9BB0", marginTop: 4 },
  openBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 12,
    alignSelf: "stretch",
  },
  openBtnText: { color: "#1A1A0A", fontWeight: "800", fontSize: 14 },

  docDecisionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F4F3FA",
  },
  docDecisionBtn: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
  },
  docDecisionBtnDone: { opacity: 0.55 },
  docDecisionBtnAccept: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#86EFAC",
  },
  docDecisionBtnAcceptText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#065F46",
  },
  docDecisionBtnReject: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  docDecisionBtnRejectText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#991B1B",
  },

  /* Rejection comment box */
  commentBox: {
    marginTop: 4,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  commentLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#B91C1C",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  commentText: { fontSize: 13, color: "#7F1D1D", lineHeight: 18 },

  /* Footer actions */
  footerActions: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: "#EBEBF5",
    backgroundColor: "#FFFFFF",
    shadowColor: "#1A1A2E",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 10,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 14,
    justifyContent: "center",
  },
  actionReview: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1.5,
    borderColor: "#93C5FD",
  },
  actionReviewText: { color: "#0369A1", fontWeight: "700", fontSize: 12 },
  actionReviewTextDisabled: { color: "#9B9BB0" },
  actionApprove: { backgroundColor: ACCENT },
  actionApproveText: { color: "#1A1A0A", fontWeight: "800", fontSize: 12 },
  actionApproveTextDisabled: { color: "#9B9BB0" },
  actionBtnDisabled: { opacity: 0.45 },
  actionReject: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1.5,
    borderColor: "#FECACA",
  },
  actionRejectText: { color: "#B91C1C", fontWeight: "700", fontSize: 12 },
  actionRejectTextDisabled: { color: "#9B9BB0" },

  /* State screens */
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  loadingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderColor: "#EBEBF5",
    shadowColor: "#1A1A2E",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 3,
  },
  loadingText: { fontSize: 14, color: "#6B6B80", fontWeight: "600" },
  errorCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#EBEBF5",
  },
  errorText: {
    color: "#DC2626",
    textAlign: "center",
    fontWeight: "600",
    fontSize: 14,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: "rgba(232,201,122,0.2)",
    borderWidth: 1.5,
    borderColor: ACCENT,
  },
  retryBtnText: { color: "#1A1A0A", fontWeight: "700", fontSize: 14 },

  /* Modals */
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,15,35,0.5)",
    justifyContent: "flex-end",
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  modalCard: {
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderWidth: 1,
    borderColor: "#EBEBF5",
  },
  modalCardLarge: {
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderWidth: 1,
    borderColor: "#EBEBF5",
    maxHeight: "88%",
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E0E0EC",
    alignSelf: "center",
    marginBottom: 16,
  },
  modalIconRow: { alignItems: "center", marginBottom: 12 },
  modalTitleIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1A1A2E",
    marginBottom: 8,
  },
  modalSub: {
    fontSize: 13,
    color: "#9B9BB0",
    marginBottom: 14,
    lineHeight: 18,
  },
  modalWarnBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#FFFBEB",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FDE68A",
    marginBottom: 14,
  },
  modalWarn: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: "#B45309",
    lineHeight: 16,
  },
  rejectHint: {
    fontSize: 13,
    color: "#9B9BB0",
    marginBottom: 12,
    lineHeight: 18,
  },
  presetChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#F4F3FA",
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: "#EBEBF5",
  },
  presetChipOn: {
    borderColor: ACCENT,
    backgroundColor: "rgba(232,201,122,0.15)",
  },
  presetChipText: { fontSize: 13, color: "#6B6B80", flex: 1 },
  presetChipTextOn: { color: "#B45309", fontWeight: "700" },
  customLabel: {
    marginTop: 8,
    marginBottom: 8,
    fontSize: 12,
    fontWeight: "700",
    color: "#9B9BB0",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    minHeight: 80,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#EBEBF5",
    padding: 12,
    color: "#1A1A2E",
    textAlignVertical: "top",
    marginBottom: 16,
    backgroundColor: "#F9F8FF",
    fontSize: 14,
  },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  modalCancel: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#F4F3FA",
  },
  modalCancelText: { color: "#6B6B80", fontWeight: "700", fontSize: 14 },
  modalConfirm: {
    backgroundColor: ACCENT,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  modalDanger: { backgroundColor: "#B91C1C" },
  modalConfirmText: { color: "#1A1A0A", fontWeight: "800", fontSize: 14 },
  modalConfirmTextLight: { color: "#FFFFFF", fontWeight: "800", fontSize: 14 },
});
