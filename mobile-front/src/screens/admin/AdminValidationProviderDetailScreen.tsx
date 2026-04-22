import React, { useCallback, useEffect, useState } from "react";
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
import { api } from "../../services/api";
import { AuthNoticeModal } from "../../components/common";
import { COLORS } from "../../constants";
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
      <Ionicons name={icon} size={16} color={COLORS.gray[400]} />
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
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  rowText: { flex: 1, minWidth: 0 },
  rowLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.text.tertiary,
    textTransform: "uppercase",
    letterSpacing: 0.35,
    marginBottom: 2,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text.primary,
    lineHeight: 19,
  },
  rowMono: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 11,
  },
});

export const AdminValidationProviderDetailScreen: React.FC<Props> = ({
  navigation,
  route,
}) => {
  const { requestId, displayName, email: paramEmail } = route.params;
  const insets = useSafeAreaInsets();

  const [request, setRequest] = useState<VerificationRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  const [rejectVisible, setRejectVisible] = useState(false);
  const [rejectCustom, setRejectCustom] = useState("");
  const [rejectPreset, setRejectPreset] = useState<string | null>(null);

  const [approveVisible, setApproveVisible] = useState(false);

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

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.getAdminVerificationRequest(requestId);
      setRequest(res.data as VerificationRequest);
    } catch {
      setError("Could not load requests.");
      setRequest(null);
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
    setNotice({
      visible: true,
      title: "Success",
      message,
    });
  };

  const actionable =
    request?.requestStatus === "PENDING" ||
    request?.requestStatus === "UNDER_REVIEW";

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
    if (!request) return;
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
      showSuccess(
        "Submission rejected. The applicant has been notified by email.",
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
              <Ionicons name="person" size={18} color="#6D28D9" />
            </View>
            <View style={styles.sectionCardTitles}>
              <Text style={styles.sectionCardTitle}>Company administrator</Text>
            </View>
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
                <Ionicons name="business" size={18} color="#0369A1" />
              </View>
              <View style={styles.sectionCardTitles}>
                <Text style={styles.sectionCardTitle}>Company</Text>
              </View>
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
                  <Ionicons name="navigate" size={18} color="#0369A1" />
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
            <Ionicons name="warning-outline" size={20} color="#B45309" />
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
    const hasCoords =
      p != null && p.latitude != null && p.longitude != null;
    return (
      <View style={styles.sectionCard}>
        <View style={styles.sectionCardHeader}>
          <View style={[styles.sectionIcon, { backgroundColor: "#D1FAE5" }]}>
            <Ionicons name="briefcase-outline" size={18} color="#047857" />
          </View>
          <View style={styles.sectionCardTitles}>
            <Text style={styles.sectionCardTitle}>Provider profile</Text>
          </View>
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
                  <Ionicons name="navigate" size={18} color="#0369A1" />
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

  return (
    <View style={styles.root}>
      <View style={[styles.topBar, { paddingTop: insets.top + 14 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={26} color={COLORS.text.primary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.hero}>
        <View style={styles.heroMainRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
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
          <>
            <View style={styles.heroMetaRow}>
              <View
                style={[
                  styles.heroKind,
                  company ? styles.heroKindCompany : styles.heroKindProvider,
                ]}
              >
                <Ionicons
                  name={company ? "business" : "briefcase-outline"}
                  size={12}
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
                <Text style={styles.statusPillText}>
                  {request.requestStatus}
                </Text>
              </View>
              <Text style={styles.submittedAtInline} numberOfLines={1}>
                {formatDate(request.createdAt)}
              </Text>
            </View>
          </>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={ACCENT} size="large" />
        </View>
      ) : error || !request ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>
            {error ?? "Could not load requests."}
          </Text>
          <TouchableOpacity onPress={() => void load()} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
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
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            showsVerticalScrollIndicator={false}
          >
            {renderCompanySections()}
            {renderProviderProfile()}

            {request.ownerComment?.trim() ? (
              <View style={styles.ownerCommentBox}>
                <Text style={styles.ownerCommentLabel}>Applicant note</Text>
                <Text style={styles.ownerCommentText}>
                  {request.ownerComment}
                </Text>
              </View>
            ) : null}

            <Text style={styles.sectionTitle}>
              Submitted documents ({request.documents.length})
            </Text>

            {request.documents.map((doc, index) => (
              <View key={doc.id} style={styles.docCard}>
                <View style={styles.docCardHeader}>
                  <Text style={styles.docIndex}>Document {index + 1}</Text>
                  <Text style={styles.docType}>{doc.type}</Text>
                </View>
                <Text style={styles.docDate}>{formatDate(doc.uploadedAt)}</Text>
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
                        size={40}
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
                      size={20}
                      color={COLORS.text.primary}
                    />
                    <Text style={styles.openBtnText}>Open file</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {request.requestStatus === "REJECTED" && request.adminComment ? (
              <View style={styles.commentBox}>
                <Text style={styles.commentLabel}>Rejection reason</Text>
                <Text style={styles.commentText}>{request.adminComment}</Text>
              </View>
            ) : null}
          </ScrollView>

          {actionable ? (
            <View
              style={[
                styles.footerActions,
                {
                  paddingBottom: 15,
                  paddingTop: 8,
                },
              ]}
            >
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionReview]}
                  onPress={() => void runUnderReview()}
                  disabled={acting}
                >
                  {acting ? (
                    <ActivityIndicator color="#0369A1" size="small" />
                  ) : (
                    <>
                      <Ionicons name="eye-outline" size={18} color="#0369A1" />
                      <Text style={styles.actionReviewText}>Under review</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionApprove]}
                  onPress={() => setApproveVisible(true)}
                  disabled={acting}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color={COLORS.gray[900]}
                  />
                  <Text style={styles.actionApproveText}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionReject]}
                  onPress={() => {
                    setRejectCustom("");
                    setRejectPreset(null);
                    setRejectVisible(true);
                  }}
                  disabled={acting}
                >
                  <Ionicons name="close-circle" size={18} color="#B91C1C" />
                  <Text style={styles.actionRejectText}>Reject</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </>
      )}

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
            <Text style={styles.modalTitle}>Approve verification</Text>
            <Text style={styles.modalSub}>
              This approves every file in this submission. The applicant will be
              notified by email.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setApproveVisible(false)}
              >
                <Text style={styles.modalCancelText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={() => void submitApprove()}
              >
                <Text style={styles.modalConfirmText}>Confirm approve</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

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
              placeholderTextColor={COLORS.gray[400]}
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

function statusPillStyle(status: string) {
  switch (status) {
    case "APPROVED":
      return { backgroundColor: "#D1FAE5" };
    case "REJECTED":
      return { backgroundColor: "#FEE2E2" };
    case "UNDER_REVIEW":
      return { backgroundColor: "#DBEAFE" };
    default:
      return { backgroundColor: "#FEF3C7" };
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  topBar: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: COLORS.background,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
  },
  backText: {
    color: COLORS.text.primary,
    fontSize: 17,
    fontWeight: "600",
  },
  hero: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  heroMainRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  heroTextCol: {
    flex: 1,
    minWidth: 0,
  },
  heroMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
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
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(232,201,122,0.25)",
    borderWidth: 2,
    borderColor: "rgba(232,201,122,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#B45309",
  },
  heroTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.text.primary,
    textAlign: "left",
  },
  heroEmail: {
    marginTop: 2,
    fontSize: 13,
    color: COLORS.text.secondary,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: COLORS.gray[800],
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  submittedAtInline: {
    fontSize: 11,
    color: COLORS.text.tertiary,
    fontWeight: "600",
    flexShrink: 1,
  },
  scrollInner: { paddingHorizontal: 14, gap: 10, paddingTop: 10 },
  sectionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingBottom: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  sectionCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    marginBottom: 2,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionCardTitles: { flex: 1 },
  sectionCardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.text.primary,
  },
  companyLogo: {
    width: "100%",
    height: 72,
    borderRadius: 10,
    marginBottom: 6,
    marginTop: 4,
    backgroundColor: COLORS.gray[100],
  },
  mapActions: {
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    marginTop: 4,
  },
  mapBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#E0F2FE",
    borderRadius: 10,
  },
  mapBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0369A1",
  },
  coordsText: {
    marginTop: 8,
    fontSize: 12,
    color: COLORS.text.tertiary,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  zonesBlock: { paddingVertical: 8 },
  zonesLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.text.tertiary,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  zonesWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  zoneChip: {
    backgroundColor: COLORS.gray[100],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  zoneChipText: { fontSize: 12, fontWeight: "600", color: COLORS.gray[700] },
  metaFoot: {
    fontSize: 11,
    color: COLORS.text.tertiary,
    paddingBottom: 8,
    fontStyle: "italic",
  },
  warnBanner: {
    flexDirection: "row",
    gap: 8,
    padding: 10,
    backgroundColor: "#FFFBEB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  warnBannerText: { flex: 1, fontSize: 13, color: "#92400E", lineHeight: 18 },
  ownerCommentBox: {
    backgroundColor: "#F0FDF4",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  ownerCommentLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#047857",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  ownerCommentText: {
    fontSize: 14,
    color: COLORS.gray[800],
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.text.primary,
    marginBottom: 2,
    marginTop: 2,
  },
  docCard: {
    borderRadius: 12,
    padding: 12,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  docCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  docIndex: { fontSize: 12, fontWeight: "700", color: COLORS.text.tertiary },
  docType: { fontSize: 15, fontWeight: "700", color: COLORS.text.primary },
  docDate: { fontSize: 12, color: COLORS.text.secondary, marginBottom: 12 },
  previewRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "stretch",
  },
  previewImg: {
    width: 100,
    height: 100,
    borderRadius: 14,
    backgroundColor: COLORS.gray[100],
  },
  previewPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 14,
    backgroundColor: "rgba(232,201,122,0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(232,201,122,0.35)",
  },
  previewHint: { fontSize: 10, color: COLORS.text.tertiary, marginTop: 4 },
  openBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 14,
    alignSelf: "center",
  },
  openBtnText: {
    color: COLORS.text.primary,
    fontWeight: "800",
    fontSize: 15,
  },
  commentBox: {
    marginTop: 4,
    padding: 14,
    borderRadius: 12,
    backgroundColor: COLORS.gray[100],
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  commentLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.text.tertiary,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  commentText: { fontSize: 13, color: COLORS.text.primary, lineHeight: 18 },
  footerActions: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.white,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 8 },
    }),
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    minWidth: "30%",
    flexGrow: 1,
    justifyContent: "center",
  },
  actionReview: {
    backgroundColor: "#E0F2FE",
    borderWidth: 1,
    borderColor: "#7DD3FC",
  },
  actionReviewText: { color: "#0369A1", fontWeight: "700", fontSize: 12 },
  actionApprove: {
    backgroundColor: ACCENT,
  },
  actionApproveText: {
    color: COLORS.gray[900],
    fontWeight: "800",
    fontSize: 12,
  },
  actionReject: {
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  actionRejectText: { color: "#B91C1C", fontWeight: "700", fontSize: 12 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  errorText: {
    color: COLORS.error,
    textAlign: "center",
    marginBottom: 12,
  },
  retryBtn: { paddingVertical: 10, paddingHorizontal: 16 },
  retryBtnText: { color: "#B45309", fontWeight: "700", fontSize: 16 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalCard: {
    borderRadius: 18,
    backgroundColor: COLORS.white,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalCardLarge: {
    borderRadius: 18,
    backgroundColor: COLORS.white,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    maxHeight: "88%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text.primary,
    marginBottom: 8,
  },
  modalSub: {
    fontSize: 13,
    color: COLORS.text.secondary,
    marginBottom: 12,
    lineHeight: 18,
  },
  rejectHint: {
    fontSize: 13,
    color: COLORS.text.secondary,
    marginBottom: 12,
    lineHeight: 18,
  },
  presetChip: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: COLORS.gray[50],
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  presetChipOn: {
    borderColor: ACCENT,
    backgroundColor: "rgba(232,201,122,0.2)",
  },
  presetChipText: { fontSize: 14, color: COLORS.text.primary },
  presetChipTextOn: { color: "#B45309", fontWeight: "700" },
  customLabel: {
    marginTop: 8,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text.secondary,
  },
  input: {
    minHeight: 80,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    color: COLORS.text.primary,
    textAlignVertical: "top",
    marginBottom: 16,
    backgroundColor: COLORS.gray[50],
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  modalCancel: { paddingVertical: 12, paddingHorizontal: 16 },
  modalCancelText: { color: COLORS.text.secondary, fontWeight: "600" },
  modalConfirm: {
    backgroundColor: ACCENT,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  modalDanger: { backgroundColor: "#b91c1c" },
  modalConfirmText: { color: COLORS.gray[900], fontWeight: "800" },
  modalConfirmTextLight: { color: "#FFFFFF", fontWeight: "800" },
});
