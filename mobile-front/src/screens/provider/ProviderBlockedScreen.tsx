import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  I18nManager,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Image,
  Modal,
  Pressable,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { useAppTranslation } from "../../hooks/useAppTranslation";
import { AccountStatus } from "../../types";
import { ClientHeaderLanguageChips, AuthNoticeModal } from "../../components/common";
import { api } from "../../services/api";
import { supabase } from "../../services/supabase";
import { requestPhotoLibraryPermission } from "../../services/clientAvatarUpload";
import {
  uploadProviderVerificationDocument,
  isImageMimeOrPath,
} from "../../services/providerDocumentUpload";
import {
  PROVIDER_DOCUMENT_TYPES,
  type ProviderDocumentType,
} from "../../types/documents";

const DOC_ACCENT = "#C9A84C";

type BlockConfig = {
  accent: string;
  softBg: string;
  softBorder: string;
  badgeBg: string;
  badgeBorder: string;
  titleColor: string;
  messageColor: string;
  logoutBg: string;
  titleKey: string;
  messageKey: string;
};

const BLOCK_ICON: keyof typeof Ionicons.glyphMap = "shield-outline";

type PendingDoc = {
  id: string;
  localUri: string;
  mimeType?: string | null;
  fileName?: string | null;
  documentType: ProviderDocumentType;
};

export const ProviderBlockedScreen: React.FC = () => {
  const { user, logout, refreshUser } = useAuth();
  const { t, isRTL } = useAppTranslation();
  const insets = useSafeAreaInsets();
  const status = user?.status;
  const [adminComment, setAdminComment] = useState<string | null>(null);
  const [loadingComment, setLoadingComment] = useState(false);
  const [ownerComment, setOwnerComment] = useState("");
  const [pendingDocs, setPendingDocs] = useState<PendingDoc[]>([]);
  const [docSourceModalVisible, setDocSourceModalVisible] = useState(false);
  const [typePickerVisible, setTypePickerVisible] = useState(false);
  const [pendingPick, setPendingPick] = useState<{
    uri: string;
    mimeType?: string | null;
    fileName?: string | null;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    visible: boolean;
    title: string;
    message: string;
  }>({ visible: false, title: "", message: "" });
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [statusRefreshKey, setStatusRefreshKey] = useState(0);

  const config = useMemo((): BlockConfig => {
    switch (status) {
      case AccountStatus.PENDING:
        return {
          accent: "#B45309",
          softBg: "#FFFBEB",
          softBorder: "#FDE68A",
          badgeBg: "#FFFBEB",
          badgeBorder: "#FDE68A",
          titleColor: "#78350F",
          messageColor: "#92400E",
          logoutBg: "#D97706",
          titleKey: "provider.status.pendingTitle",
          messageKey: "provider.status.pendingMessage",
        };
      case AccountStatus.REJECTED:
        return {
          accent: "#B91C1C",
          softBg: "#FEF2F2",
          softBorder: "#FECACA",
          badgeBg: "#FEF2F2",
          badgeBorder: "#FECACA",
          titleColor: "#7F1D1D",
          messageColor: "#991B1B",
          logoutBg: "#DC2626",
          titleKey: "provider.status.rejectedTitle",
          messageKey: "provider.status.rejectedMessage",
        };
      case AccountStatus.SUSPENDED:
        return {
          accent: "#7C3AED",
          softBg: "#F5F3FF",
          softBorder: "#DDD6FE",
          badgeBg: "#FFFBEB",
          badgeBorder: "#DDD6FE",
          titleColor: "#4C1D95",
          messageColor: "#5B21B6",
          logoutBg: "#7C3AED",
          titleKey: "provider.status.suspendedTitle",
          messageKey: "provider.status.suspendedMessage",
        };
      case AccountStatus.DELETED:
        return {
          accent: "#334155",
          softBg: "#F8FAFC",
          softBorder: "#CBD5E1",
          badgeBg: "#F8FAFC",
          badgeBorder: "#CBD5E1",
          titleColor: "#1E293B",
          messageColor: "#334155",
          logoutBg: "#334155",
          titleKey: "provider.status.deletedTitle",
          messageKey: "provider.status.deletedMessage",
        };
      default:
        return {
          accent: ACCENT,
          softBg: "#F5F3FF",
          softBorder: "#DDD6FE",
          badgeBg: "#F5F3FF",
          badgeBorder: "#DDD6FE",
          titleColor: "#5B21B6",
          messageColor: "#6D28D9",
          logoutBg: "#7C3AED",
          titleKey: "provider.status.unknownTitle",
          messageKey: "provider.status.unknownMessage",
        };
    }
  }, [status]);

  useEffect(() => {
    let cancelled = false;
    if (status !== AccountStatus.REJECTED) {
      setAdminComment(null);
      setLoadingComment(false);
      return;
    }

    const load = async () => {
      try {
        setLoadingComment(true);
        const res = await api.getMyLatestVerificationRequest();
        const data = res.data as {
          adminComment?: string | null;
          requestStatus?: string;
        } | null;
        const comment = String(data?.adminComment ?? "").trim();
        if (!cancelled) setAdminComment(comment || null);
      } catch {
        if (!cancelled) setAdminComment(null);
      } finally {
        if (!cancelled) setLoadingComment(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [status, statusRefreshKey]);

  const handleCheckStatusAgain = useCallback(async () => {
    setCheckingStatus(true);
    try {
      await refreshUser();
      setStatusRefreshKey((k) => k + 1);
    } finally {
      setCheckingStatus(false);
    }
  }, [refreshUser]);

  const labelForDocType = useCallback(
    (dt: string) => {
      const map: Record<string, string> = {
        IDENTITY: t("completeProfile.docTypeIdentity"),
        LICENSE: t("completeProfile.docTypeLicense"),
        QUALIFICATION: t("completeProfile.docTypeQualification"),
        INSURANCE: t("completeProfile.docTypeInsurance"),
        OTHER: t("completeProfile.docTypeOther"),
      };
      return map[dt] ?? dt;
    },
    [t],
  );

  const pickVerificationFromGallery = async () => {
    setDocSourceModalVisible(false);
    try {
      const ok = await requestPhotoLibraryPermission();
      if (!ok) {
        setNotice({
          visible: true,
          title: t("common.error"),
          message: t("completeProfile.photoPermissionDenied"),
        });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.9,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        const asset = result.assets[0];
        setPendingPick({
          uri: asset.uri,
          mimeType: asset.mimeType ?? undefined,
          fileName: null,
        });
        setTypePickerVisible(true);
      }
    } catch (e: unknown) {
      setNotice({
        visible: true,
        title: t("common.error"),
        message:
          e instanceof Error
            ? e.message
            : t("completeProfile.photoPermissionDenied"),
      });
    }
  };

  const pickVerificationFromFiles = async () => {
    setDocSourceModalVisible(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        type: [
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ],
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setPendingPick({
        uri: asset.uri,
        mimeType: asset.mimeType ?? undefined,
        fileName: asset.name,
      });
      setTypePickerVisible(true);
    } catch (e: unknown) {
      setNotice({
        visible: true,
        title: t("common.error"),
        message:
          e instanceof Error
            ? e.message
            : t("completeProfile.documentPickError"),
      });
    }
  };

  const confirmDocType = (documentType: ProviderDocumentType) => {
    if (!pendingPick) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setPendingDocs((prev) => [
      ...prev,
      {
        id,
        localUri: pendingPick.uri,
        mimeType: pendingPick.mimeType,
        fileName: pendingPick.fileName ?? null,
        documentType,
      },
    ]);
    setPendingPick(null);
    setTypePickerVisible(false);
    setDocError(null);
  };

  const removePendingDoc = (id: string) => {
    setPendingDocs((prev) => prev.filter((d) => d.id !== id));
  };

  const handleResubmit = async () => {
    if (pendingDocs.length === 0) {
      setDocError(t("provider.status.resubmitDocumentsRequired"));
      return;
    }
    setDocError(null);
    setSubmitting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        throw new Error(t("provider.status.resubmitNotSignedIn"));
      }
      const uid = session.user.id;

      const docPayload: { type: string; fichierUrl: string }[] = [];
      for (const d of pendingDocs) {
        const url = await uploadProviderVerificationDocument(uid, d.localUri, {
          mimeType: d.mimeType,
          fileName: d.fileName,
        });
        docPayload.push({ type: d.documentType, fichierUrl: url });
      }

      await api.resubmitVerificationRequest({
        ownerComment: ownerComment.trim() || null,
        documents: docPayload,
      });

      await refreshUser();
      setPendingDocs([]);
      setOwnerComment("");
      setNotice({
        visible: true,
        title: t("provider.status.resubmitSuccessTitle"),
        message: t("provider.status.resubmitSuccessMessage"),
      });
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data
              ?.message
          : null;
      setNotice({
        visible: true,
        title: t("common.error"),
        message:
          msg ||
          (e instanceof Error
            ? e.message
            : t("provider.status.resubmitError")),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const headerBarStyle = useMemo(
    () => ({
      paddingTop: insets.top + 8,
      flexDirection: (I18nManager.isRTL ? "row-reverse" : "row") as
        | "row"
        | "row-reverse",
    }),
    [insets.top],
  );

  return (
    <View style={styles.root}>
      <View style={[styles.headerBar, headerBarStyle]}>
        <View style={{ flex: 1 }} />
        <ClientHeaderLanguageChips />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollInner,
            { paddingBottom: insets.bottom + 32 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.heroCard,
              { borderColor: config.softBorder, backgroundColor: config.softBg },
            ]}
          >
            <View
              style={[styles.statusRibbon, { backgroundColor: config.accent }]}
            />
            <View
              style={[
                styles.iconWrap,
                {
                  backgroundColor: config.badgeBg,
                  borderColor: config.badgeBorder,
                },
              ]}
            >
              <Ionicons name={BLOCK_ICON} size={52} color={config.accent} />
            </View>

            <Text style={[styles.title, { color: config.titleColor }]}>
              {t(config.titleKey)}
            </Text>
            <Text style={[styles.message, { color: config.messageColor }]}>
              {t(config.messageKey)}
            </Text>

            {user?.email ? (
              <View style={styles.emailPill}>
                <Ionicons name="mail-outline" size={16} color="#6B7280" />
                <Text style={styles.emailPillText}>{user.email}</Text>
              </View>
            ) : null}

            {status === AccountStatus.REJECTED ? (
              <View style={styles.adminFeedback}>
                <View style={styles.adminFeedbackHeader}>
                  <Ionicons
                    name="chatbox-ellipses-outline"
                    size={20}
                    color={config.accent}
                  />
                  <Text style={[styles.adminFeedbackTitle, { color: config.titleColor }]}>
                    {t("provider.status.adminFeedbackTitle")}
                  </Text>
                </View>
                {loadingComment ? (
                  <View style={styles.commentLoadingRow}>
                    <ActivityIndicator size="small" color={config.accent} />
                    <Text style={styles.commentLoadingText}>
                      {t("common.loading")}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.adminFeedbackBody}>
                    {adminComment ?? t("provider.status.adminCommentEmpty")}
                  </Text>
                )}
              </View>
            ) : null}
          </View>

          {status === AccountStatus.REJECTED ? (
            <View style={styles.resubmitCard}>
              <Text style={[styles.resubmitHeading, isRTL && styles.rtlText]}>
                {t("provider.status.resubmitHeading")}
              </Text>
              <Text style={[styles.resubmitHint, isRTL && styles.rtlText]}>
                {t("provider.status.resubmitHint")}
              </Text>

              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>
                {t("provider.status.ownerCommentLabel")}
              </Text>
              <TextInput
                style={[
                  styles.commentInput,
                  isRTL && styles.rtlText,
                  { textAlign: isRTL ? "right" : "left" },
                ]}
                placeholder={t("provider.status.ownerCommentPlaceholder")}
                placeholderTextColor="#9CA3AF"
                value={ownerComment}
                onChangeText={setOwnerComment}
                multiline
                maxLength={4000}
                editable={!submitting}
              />

              <Text
                style={[
                  styles.fieldLabel,
                  { marginTop: 16 },
                  isRTL && styles.rtlText,
                ]}
              >
                {t("provider.status.resubmitDocumentsTitle")}
              </Text>
              <Text style={[styles.docsHint, isRTL && styles.rtlText]}>
                {t("completeProfile.minOneDoc")}
              </Text>

              {pendingDocs.map((d) => (
                <View key={d.id} style={styles.docRow}>
                  {isImageMimeOrPath(d.mimeType, d.localUri) ? (
                    <Image source={{ uri: d.localUri }} style={styles.docThumb} />
                  ) : (
                    <View style={styles.docThumbPlaceholder}>
                      <Ionicons
                        name="document-text-outline"
                        size={26}
                        color={DOC_ACCENT}
                      />
                    </View>
                  )}
                  <View style={styles.docRowText}>
                    <Text style={[styles.docRowTitle, isRTL && styles.rtlText]}>
                      {labelForDocType(d.documentType)}
                    </Text>
                    {d.fileName ? (
                      <Text
                        style={[styles.docFileName, isRTL && styles.rtlText]}
                        numberOfLines={1}
                      >
                        {d.fileName}
                      </Text>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    onPress={() => removePendingDoc(d.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    disabled={submitting}
                  >
                    <Ionicons name="trash-outline" size={22} color="#fecaca" />
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity
                style={styles.addDocButton}
                onPress={() => setDocSourceModalVisible(true)}
                activeOpacity={0.85}
                disabled={submitting}
              >
                <Ionicons name="add-circle-outline" size={22} color={DOC_ACCENT} />
                <Text style={[styles.addDocButtonText, isRTL && styles.rtlText]}>
                  {t("completeProfile.addVerificationDoc")}
                </Text>
              </TouchableOpacity>
              {docError ? (
                <Text style={styles.fieldError}>{docError}</Text>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  { backgroundColor: config.accent },
                  submitting && styles.submitBtnDisabled,
                ]}
                onPress={() => void handleResubmit()}
                disabled={submitting}
                activeOpacity={0.88}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="send-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.submitBtnText}>
                      {t("provider.status.resubmitSend")}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : null}

          <TouchableOpacity
            style={[
              styles.refreshStatusBtn,
              {
                borderColor: config.accent,
                flexDirection: isRTL ? "row-reverse" : "row",
              },
              (checkingStatus || submitting) && styles.refreshStatusBtnDimmed,
            ]}
            onPress={() => void handleCheckStatusAgain()}
            disabled={checkingStatus || submitting}
            activeOpacity={0.85}
          >
            {checkingStatus ? (
              <ActivityIndicator size="small" color={config.accent} />
            ) : (
              <Ionicons name="refresh" size={22} color={config.accent} />
            )}
            <Text
              style={[
                styles.refreshStatusText,
                { color: config.titleColor },
                isRTL && styles.rtlText,
              ]}
            >
              {t("provider.status.checkStatusAgain")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.logoutBtn, { backgroundColor: config.logoutBg }]}
            onPress={() => void logout()}
            activeOpacity={0.88}
          >
            <Ionicons name="log-out-outline" size={20} color="#FFFFFF" />
            <Text style={styles.logoutText}>{t("client.sidebar.logout")}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={docSourceModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDocSourceModalVisible(false)}
      >
        <Pressable
          style={styles.typeModalBackdrop}
          onPress={() => setDocSourceModalVisible(false)}
        >
          <Pressable
            style={styles.typeModalCard}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.typeModalTitle, isRTL && styles.rtlText]}>
              {t("completeProfile.docSourceModalTitle")}
            </Text>
            <TouchableOpacity
              style={styles.typeModalRow}
              onPress={() => void pickVerificationFromGallery()}
            >
              <Ionicons name="images-outline" size={22} color={DOC_ACCENT} />
              <Text style={[styles.typeModalRowText, isRTL && styles.rtlText]}>
                {t("completeProfile.addDocFromGallery")}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={DOC_ACCENT} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.typeModalRow}
              onPress={() => void pickVerificationFromFiles()}
            >
              <Ionicons name="folder-open-outline" size={22} color={DOC_ACCENT} />
              <Text style={[styles.typeModalRowText, isRTL && styles.rtlText]}>
                {t("completeProfile.addDocFromFiles")}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={DOC_ACCENT} />
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={typePickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setTypePickerVisible(false);
          setPendingPick(null);
        }}
      >
        <Pressable
          style={styles.typeModalBackdrop}
          onPress={() => {
            setTypePickerVisible(false);
            setPendingPick(null);
          }}
        >
          <Pressable
            style={styles.typeModalCard}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.typeModalTitle, isRTL && styles.rtlText]}>
              {t("completeProfile.docTypeModalTitle")}
            </Text>
            {PROVIDER_DOCUMENT_TYPES.map((dt) => (
              <TouchableOpacity
                key={dt}
                style={styles.typeModalRow}
                onPress={() => confirmDocType(dt)}
              >
                <Text
                  style={[styles.typeModalRowText, isRTL && styles.rtlText]}
                >
                  {labelForDocType(dt)}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={DOC_ACCENT} />
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <AuthNoticeModal
        visible={notice.visible}
        onClose={() => setNotice((n) => ({ ...n, visible: false }))}
        title={notice.title}
        message={notice.message}
        primaryLabel={t("common.close")}
        onPrimary={() => setNotice((n) => ({ ...n, visible: false }))}
      />
    </View>
  );
};

const ACCENT = "#A78BFA";

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FAFAFA",
  },
  flex: { flex: 1 },
  headerBar: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    alignItems: "center",
    justifyContent: "flex-end",
    backgroundColor: "#FAFAFA",
  },
  scrollInner: {
    paddingHorizontal: 20,
    flexGrow: 1,
    justifyContent: "center",
  },
  heroCard: {
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    alignItems: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
    marginBottom: 16,
  },
  statusRibbon: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 5,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  iconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
    marginTop: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 10,
    letterSpacing: -0.3,
    alignSelf: "stretch",
  },
  message: {
    fontSize: 15,
    lineHeight: 23,
    textAlign: "center",
    alignSelf: "stretch",
  },
  emailPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  emailPillText: {
    fontSize: 13,
    color: "#4B5563",
    fontWeight: "600",
  },
  adminFeedback: {
    marginTop: 20,
    alignSelf: "stretch",
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  adminFeedbackHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  adminFeedbackTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  adminFeedbackBody: {
    fontSize: 14,
    lineHeight: 21,
    color: "#374151",
  },
  commentLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  commentLoadingText: {
    fontSize: 13,
    color: "#6B7280",
  },
  resubmitCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 16,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  resubmitHeading: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
  },
  resubmitHint: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 19,
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  commentInput: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    color: "#111827",
    backgroundColor: "#F9FAFB",
  },
  docsHint: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 12,
  },
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#F9FAFB",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  docThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#E5E7EB",
  },
  docThumbPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },
  docRowText: { flex: 1 },
  docRowTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  docFileName: {
    marginTop: 4,
    fontSize: 11,
    color: "#9CA3AF",
  },
  addDocButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: DOC_ACCENT,
    borderStyle: "dashed",
    marginTop: 4,
  },
  addDocButtonText: {
    color: DOC_ACCENT,
    fontSize: 15,
    fontWeight: "600",
  },
  fieldError: {
    marginTop: 8,
    fontSize: 12,
    color: "#DC2626",
  },
  submitBtn: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  refreshStatusBtn: {
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    backgroundColor: "#FFFFFF",
    marginTop: 4,
    marginBottom: 10,
  },
  refreshStatusBtnDimmed: {
    opacity: 0.65,
  },
  refreshStatusText: {
    fontSize: 16,
    fontWeight: "700",
  },
  logoutBtn: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 15,
    borderRadius: 14,
    marginTop: 4,
  },
  logoutText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  rtlText: {
    writingDirection: "rtl",
  },
  typeModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.32)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  typeModalCard: {
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingVertical: 8,
    maxHeight: "70%",
  },
  typeModalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  typeModalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E7EB",
  },
  typeModalRowText: {
    fontSize: 16,
    color: "#374151",
    flex: 1,
  },
});
