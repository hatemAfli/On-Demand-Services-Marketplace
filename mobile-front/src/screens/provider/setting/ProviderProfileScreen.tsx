import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ProviderStackParamList } from "../../../navigation/types";
import { useAuth } from "../../../context/AuthContext";
import { api } from "../../../services/api";
import type { UserWithProfile } from "../../../types";
import { ProviderType } from "../../../types";
import { useAppTranslation } from "../../../hooks/useAppTranslation";
import {
  computeProviderProfileStrength,
  extractActiveApprovedServicesFromDocuments,
  type ProfileStrengthGivenService,
  type ProfileStrengthMissingItem,
  type ProfileStrengthResult,
} from "../../../utils/computeProviderProfileStrength";

type ProfileDocumentsScreenProps = {
  onPressBack?: () => void;
  onPressSettings?: () => void;
  onPressEditPhoto?: () => void;
  onPressEditPersonalInfo?: () => void;
  onPressAddSkill?: () => void;
  onPressRemoveSkill?: (skill: string) => void;
  onPressDocument?: (doc: ProviderVerificationDocument) => void;
  onPressUploadNewCertificate?: () => void;
  onPressUploadDocument?: () => void;
  onPressServiceSkill?: (service: {
    id: string;
    name: string;
    categoryName: string;
    description?: string | null;
  }) => void;
  profile?: UserWithProfile | null;
  loading?: boolean;
  verificationRequest?: LatestVerificationRequest | null;
  allDocuments?: ProviderVerificationDocument[];
  profileStrength?: ProfileStrengthResult | null;
  profileStrengthLoading?: boolean;
};

type TabKey = "Details" | "Documents";

type LatestVerificationDocument = {
  id: string;
  type: string;
  fichierUrl: string;
  uploadedAt: string;
  validatedAt: string | null;
  isAccepted?: boolean | null;
  rejectionReason?: string | null;
};

type LatestVerificationRequest = {
  id: string;
  requestStatus: "PENDING" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | string;
  documents: LatestVerificationDocument[];
};

type ProviderVerificationDocument = LatestVerificationDocument & {
  verificationRequest: {
    id: string;
    requestStatus: string;
    ownerType?: string | null;
    createdAt: string;
    updatedAt?: string;
    adminComment?: string | null;
    ownerComment?: string | null;
    serviceId?: string | null;
    service?: {
      id: string;
      servicePhoto?: string | null;
      isActiveForOwner?: boolean;
      name: string;
      description?: string | null;
      category?: {
        slug: string;
        name: string;
        iconUrl?: string | null;
      } | null;
    } | null;
  } | null;
};

function ProfileStrengthComputingCard({
  title,
  hint,
  computingLabel,
}: {
  title: string;
  hint: string;
  computingLabel: string;
}) {
  const shimmer = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const fillWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmerAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    const pulseAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    const fillAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(fillWidth, {
          toValue: 1,
          duration: 1100,
          useNativeDriver: false,
        }),
        Animated.timing(fillWidth, {
          toValue: 0.25,
          duration: 1100,
          useNativeDriver: false,
        }),
      ]),
    );

    shimmerAnim.start();
    pulseAnim.start();
    fillAnim.start();

    return () => {
      shimmerAnim.stop();
      pulseAnim.stop();
      fillAnim.stop();
    };
  }, [fillWidth, pulse, shimmer]);

  const shimmerTranslate = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-140, 320],
  });

  const animatedFillWidth = fillWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ["22%", "78%"],
  });

  return (
    <View style={styles.strengthCard}>
      <View style={styles.strengthHeaderRow}>
        <View style={styles.strengthTitleBlock}>
          <Text style={styles.strengthTitle}>{title}</Text>
          <Text style={styles.strengthSub}>{hint}</Text>
        </View>
        <View style={styles.strengthLoadingBadge}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      </View>

      <View style={styles.strengthTrack}>
        <Animated.View
          style={[
            styles.strengthLoadingFill,
            { width: animatedFillWidth },
          ]}
        >
          <Animated.View
            style={[styles.strengthLoadingFillPulse, { opacity: pulse }]}
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.strengthShimmer,
            { transform: [{ translateX: shimmerTranslate }] },
          ]}
        />
      </View>

      <View style={styles.strengthLoadingRow}>
        <View style={styles.strengthLoadingDots}>
          {[0, 1, 2].map((index) => (
            <Animated.View
              key={index}
              style={[
                styles.strengthLoadingDot,
                {
                  opacity: pulse.interpolate({
                    inputRange: [0.35, 1],
                    outputRange: index === 1 ? [0.45, 1] : [0.25, 0.85],
                  }),
                  transform: [
                    {
                      scale: pulse.interpolate({
                        inputRange: [0.35, 1],
                        outputRange:
                          index === 1 ? [0.85, 1.15] : [0.9, 1.05],
                      }),
                    },
                  ],
                },
              ]}
            />
          ))}
        </View>
        <Text style={styles.strengthLoadingText}>{computingLabel}</Text>
      </View>
    </View>
  );
}

export function ProfileDocumentsScreen(props: ProfileDocumentsScreenProps) {
  const { t } = useAppTranslation();
  const [activeTab, setActiveTab] = useState<TabKey>("Details");
  const [headerElevated, setHeaderElevated] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const headerStyle = useMemo(
    () => [styles.header, headerElevated && styles.headerElevated],
    [headerElevated],
  );

  const avatarUri = props.profile?.provider?.photoUrl;
  const providerType = props.profile?.provider?.type;
  const roleBadgeLabel =
    providerType === ProviderType.EMPLOYEE
      ? t("provider.profileDocuments.employee")
      : t("provider.profileDocuments.independent");
  const fullName =
    `${props.profile?.firstName ?? ""} ${props.profile?.lastName ?? ""}`.trim() ||
    t("provider.profileDocuments.providerFallbackName");
  const cityText = props.profile?.provider?.city?.trim() || "—";
  const addressText = props.profile?.provider?.address?.trim() || "—";
  const taglineText =
    props.profile?.provider?.tagline?.trim() ||
    t("provider.profileDocuments.notSet");
  const bioText =
    props.profile?.provider?.bio?.trim() ||
    t("provider.profileDocuments.notSet");
  const yearsRaw = props.profile?.provider?.yearsOfExperience;
  const yearsText =
    yearsRaw !== null &&
    yearsRaw !== undefined &&
    Number.isFinite(Number(yearsRaw))
      ? t("provider.profileDocuments.yearsValue", { count: Number(yearsRaw) })
      : t("provider.profileDocuments.notSet");
  const langs = props.profile?.provider?.languagesSpoken;
  const languagesText =
    Array.isArray(langs) && langs.some((x) => String(x).trim())
      ? langs
          .map((x) => String(x).trim())
          .filter(Boolean)
          .join(", ")
      : t("provider.profileDocuments.notSet");
  const genderRaw = props.profile?.provider?.gender;
  const genderText =
    genderRaw === "FEMALE"
      ? t("provider.profileDocuments.genderFEMALE")
      : genderRaw === "MALE"
        ? t("provider.profileDocuments.genderMALE")
        : t("provider.profileDocuments.notSet");
  const verificationDocs = props.allDocuments ?? [];
  const providedServices = useMemo(() => {
    const seen = new Set<string>();
    const services: Array<{
      id: string;
      name: string;
      categoryName: string;
      imageUrl: string | null;
      description?: string | null;
    }> = [];
    for (const doc of verificationDocs) {
      const requestStatus = doc.verificationRequest?.requestStatus;
      if (requestStatus !== "APPROVED") continue;
      const service = doc.verificationRequest?.service;
      if (!service?.isActiveForOwner) continue;
      const name = service?.name?.trim();
      if (!service?.id || !name) continue;
      const key = service.id;
      if (seen.has(key)) continue;
      seen.add(key);
      services.push({
        id: service.id,
        name,
        categoryName:
          service.category?.name ??
          t("provider.profileDocuments.uncategorized"),
        imageUrl:
          service.servicePhoto?.trim() ||
          service.category?.iconUrl?.trim() ||
          null,
        description: service.description ?? null,
      });
    }
    return services;
  }, [verificationDocs, t]);

  const profileStrengthPercent = props.profileStrength?.percent ?? 0;
  const topMissingItem = props.profileStrength?.missingItems[0] ?? null;

  const handleFixMissingItem = (item: ProfileStrengthMissingItem) => {
    if (item.action === "edit-profile") {
      props.onPressEditPersonalInfo?.();
      return;
    }
    if (item.action === "documents") {
      setActiveTab("Documents");
      return;
    }
    if (item.action === "manage-service" && item.serviceId) {
      const service = providedServices.find((entry) => entry.id === item.serviceId);
      if (service) {
        props.onPressServiceSkill?.(service);
        return;
      }
    }
    props.onPressEditPersonalInfo?.();
  };

  const formatDate = (value: string) => {
    try {
      return new Date(value).toLocaleDateString("en-GB", {
        year: "numeric",
        month: "short",
        day: "2-digit",
      });
    } catch {
      return value;
    }
  };

  const prettifyDocType = (raw: string) =>
    raw
      .toLowerCase()
      .split("_")
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ");

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[0, 3]}
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          setHeaderElevated(y > 10);
        }}
        scrollEventThrottle={16}
      >
        <View style={headerStyle}>
          <View style={styles.headerInner}>
            <View style={styles.headerLeft}>
              <TouchableOpacity
                onPress={props.onPressBack}
                activeOpacity={0.85}
                style={styles.backButton}
              >
                <Text style={styles.backButtonText}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>
                {t("provider.profileDocuments.title")}
              </Text>
            </View>

            <View style={styles.headerRight}>
              <View style={styles.roleBadge}>
                <View style={styles.roleDot} />
                <Text style={styles.roleText}>{roleBadgeLabel}</Text>
              </View>

              <TouchableOpacity
                onPress={props.onPressSettings}
                activeOpacity={0.85}
                style={styles.headerIconBtn}
              >
                <Text style={styles.headerIcon}>⚙</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.sectionPadTop}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarOuterRing}>
              <View style={styles.avatarRingInner}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Ionicons name="person" size={42} color="#F08E10" />
                  </View>
                )}
              </View>

              <TouchableOpacity
                onPress={props.onPressEditPhoto}
                activeOpacity={0.85}
                style={styles.editPhotoBtn}
              >
                <Text style={styles.editPhotoIcon}>📷</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.profileName}>{fullName}</Text>

            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedIcon}>✔</Text>
              <Text style={styles.verifiedText}>
                {t("provider.profileDocuments.verifiedProvider")}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionPad}>
          {props.profileStrengthLoading ? (
            <ProfileStrengthComputingCard
              title={t("provider.profileDocuments.profileStrength")}
              hint={t("provider.profileDocuments.profileStrengthHint")}
              computingLabel={t(
                "provider.profileDocuments.profileStrengthComputing",
              )}
            />
          ) : (
            <View style={styles.strengthCard}>
              <View style={styles.strengthHeaderRow}>
                <View style={styles.strengthTitleBlock}>
                  <Text style={styles.strengthTitle}>
                    {t("provider.profileDocuments.profileStrength")}
                  </Text>
                  <Text style={styles.strengthSub}>
                    {t("provider.profileDocuments.profileStrengthHint")}
                  </Text>
                </View>
                <Text style={styles.strengthPercent}>{profileStrengthPercent}%</Text>
              </View>

              <View style={styles.strengthTrack}>
                <View
                  style={[
                    styles.strengthFill,
                    { width: `${profileStrengthPercent}%` },
                  ]}
                />
              </View>

              {profileStrengthPercent >= 100 ? (
                <View style={styles.missingRow}>
                  <Text style={styles.missingCompleteIcon}>✓</Text>
                  <Text style={styles.missingCompleteText}>
                    {t("provider.profileDocuments.profileStrengthComplete")}
                  </Text>
                </View>
              ) : topMissingItem ? (
                <View style={styles.missingRow}>
                  <Text style={styles.missingIcon}>⚠</Text>
                  <Text style={styles.missingText}>
                    {t(topMissingItem.labelKey, topMissingItem.labelParams)}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleFixMissingItem(topMissingItem)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.missingFix}>
                      {t("provider.profileDocuments.fix")}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          )}
        </View>

        <View style={styles.tabsStickyWrap}>
          <View style={styles.tabsPill}>
            <TabButton
              label={t("provider.profileDocuments.detailsTab")}
              active={activeTab === "Details"}
              onPress={() => setActiveTab("Details")}
            />
            <TabButton
              label={t("provider.profileDocuments.documentsTab")}
              active={activeTab === "Documents"}
              onPress={() => setActiveTab("Documents")}
            />
          </View>
        </View>

        <View style={styles.sectionPad}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionKicker}>
              {activeTab === "Details"
                ? t("provider.profileDocuments.sectionPersonalInfo")
                : t("provider.profileDocuments.sectionOfficialDocs")}
            </Text>
            {activeTab === "Details" ? (
              <TouchableOpacity
                onPress={props.onPressEditPersonalInfo}
                activeOpacity={0.9}
                style={styles.editBtn}
              >
                <View style={styles.editBtnContent}>
                  <Ionicons
                    name="create-outline"
                    size={12}
                    color={colors.primary}
                  />
                  <Text style={styles.editBtnText}>
                    {t("provider.profileDocuments.edit")}
                  </Text>
                </View>
              </TouchableOpacity>
            ) : null}
          </View>

          {activeTab === "Details" ? (
            <View style={styles.detailsCard}>
              <InfoRow
                label={t("provider.profileDocuments.fullName")}
                value={fullName}
              />
              <InfoRow
                label={t("provider.profileDocuments.city")}
                value={cityText}
              />
              <InfoRow
                label={t("provider.profileDocuments.address")}
                value={addressText}
              />
              <InfoRow
                label={t("provider.profileDocuments.tagline")}
                value={taglineText}
              />
              <InfoRow
                label={t("provider.profileDocuments.bio")}
                value={bioText}
                multiline
              />
              <InfoRow
                label={t("provider.profileDocuments.yearsExperience")}
                value={yearsText}
              />
              <InfoRow
                label={t("provider.profileDocuments.languagesSpoken")}
                value={languagesText}
              />
              <InfoRow
                label={t("provider.profileDocuments.gender")}
                value={genderText}
                last
              />
            </View>
          ) : (
            <View style={styles.docList}>
              {verificationDocs.length === 0 ? (
                <View style={styles.emptyDocsCard}>
                  <Text style={styles.emptyDocsTitle}>
                    {t("provider.profileDocuments.noDocuments")}
                  </Text>
                  <Text style={styles.emptyDocsSub}>
                    {t("provider.profileDocuments.noDocumentsHint")}
                  </Text>
                </View>
              ) : (
                verificationDocs.map((doc) => {
                  const reqStatus = doc.verificationRequest?.requestStatus;
                  const isFileAccepted = doc.isAccepted === true;
                  const isFileRejected = doc.isAccepted === false;
                  const isApproved =
                    isFileAccepted ||
                    (doc.isAccepted == null &&
                      Boolean(doc.validatedAt) &&
                      reqStatus !== "REJECTED");
                  const statusLabel = isFileAccepted
                    ? t("provider.profileDocuments.approved")
                    : isFileRejected
                      ? t("provider.profileDocuments.rejected")
                      : reqStatus === "REJECTED"
                        ? t("provider.profileDocuments.rejected")
                        : reqStatus === "UNDER_REVIEW"
                          ? t("provider.profileDocuments.underReview")
                          : t("provider.profileDocuments.pending");
                  return (
                    <TouchableOpacity
                      key={doc.id}
                      onPress={() => props.onPressDocument?.(doc)}
                      activeOpacity={0.85}
                      style={[
                        styles.docCard,
                        isFileRejected
                          ? styles.docCardWarn
                          : isApproved
                            ? styles.docCardApproved
                            : styles.docCardWarn,
                      ]}
                    >
                      <View style={styles.docLeft}>
                        <View
                          style={[
                            styles.docIconBox,
                            isFileRejected
                              ? styles.docIconBoxWarn
                              : isApproved
                                ? styles.docIconBoxSuccess
                                : styles.docIconBoxWarn,
                          ]}
                        >
                          <Text
                            style={[
                              styles.docIcon,
                              {
                                color: isFileRejected
                                  ? colors.warning
                                  : isApproved
                                    ? colors.success
                                    : colors.warning,
                              },
                            ]}
                          >
                            📄
                          </Text>
                        </View>
                        <View>
                          <Text style={styles.docTitle}>
                            {prettifyDocType(doc.type)}
                          </Text>
                          <View style={styles.docMetaRow}>
                            <Text style={styles.docMeta}>
                              {t("provider.profileDocuments.uploadedOn", {
                                date: formatDate(doc.uploadedAt),
                              })}
                            </Text>
                            <View style={styles.metaDot} />
                            <Text
                              style={[
                                styles.docMeta,
                                isFileRejected
                                  ? styles.docMetaWarn
                                  : isApproved
                                    ? styles.docMetaSuccess
                                    : styles.docMetaWarn,
                              ]}
                            >
                              {statusLabel}
                            </Text>
                          </View>
                          {isFileRejected && doc.rejectionReason?.trim() ? (
                            <Text
                              style={styles.docRejectionHint}
                              numberOfLines={3}
                            >
                              {doc.rejectionReason.trim()}
                            </Text>
                          ) : null}
                          {doc.validatedAt ? (
                            <Text style={styles.validatedText}>
                              {t("provider.profileDocuments.validatedOn", {
                                date: formatDate(doc.validatedAt),
                              })}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                      <Text style={styles.chev}>›</Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          )}
        </View>

        <View style={styles.sectionPad}>
          <View style={styles.skillsHeaderRow}>
            <Text style={styles.skillsTitle}>
              {t("provider.profileDocuments.serviceSkills")}
            </Text>
          </View>

          <View style={styles.skillsCard}>
            <View style={styles.skillTagsWrap}>
              {providedServices.length > 0 ? (
                providedServices.map((service) => (
                  <TouchableOpacity
                    key={service.id}
                    style={styles.serviceCard}
                    activeOpacity={0.88}
                    onPress={() => props.onPressServiceSkill?.(service)}
                  >
                    {service.imageUrl ? (
                      <Image
                        source={{ uri: service.imageUrl }}
                        style={styles.serviceCardImage}
                      />
                    ) : (
                      <View style={styles.serviceCardImageFallback}>
                        <Ionicons
                          name="construct-outline"
                          size={20}
                          color="#4F46E5"
                        />
                      </View>
                    )}
                    <View style={styles.serviceCardTextWrap}>
                      <Text style={styles.serviceCardTitle}>
                        {service.name}
                      </Text>
                      <Text style={styles.serviceCardSubtitle}>
                        {service.categoryName}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={colors.textLight}
                    />
                  </TouchableOpacity>
                ))
              ) : props.loading ? (
                <>
                  <View style={styles.serviceCardSkeleton}>
                    <View style={styles.serviceCardSkeletonImage} />
                    <View style={styles.serviceCardSkeletonTextWrap}>
                      <View style={styles.serviceCardSkeletonTitle} />
                      <View style={styles.serviceCardSkeletonSubtitle} />
                    </View>
                  </View>
                  <View style={styles.serviceCardSkeleton}>
                    <View style={styles.serviceCardSkeletonImage} />
                    <View style={styles.serviceCardSkeletonTextWrap}>
                      <View style={styles.serviceCardSkeletonTitle} />
                      <View style={styles.serviceCardSkeletonSubtitle} />
                    </View>
                  </View>
                </>
              ) : (
                <Text style={styles.skillsHint}>
                  {t("provider.profileDocuments.noSkills")}
                </Text>
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={showUploadModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUploadModal(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setShowUploadModal(false)}
        >
          <Pressable
            style={styles.modalSheet}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Upload Document</Text>
              <TouchableOpacity
                onPress={() => setShowUploadModal(false)}
                activeOpacity={0.85}
                style={styles.modalCloseBtn}
              >
                <Text style={styles.modalCloseText}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={styles.modalScroll}
            >
              <View style={styles.modalBlock}>
                <Text style={styles.modalLabel}>Document Type</Text>
                <View style={styles.selectLike}>
                  <Text style={styles.selectLikeText}>Vehicle Insurance</Text>
                  <Text style={styles.selectLikeChev}>▾</Text>
                </View>
              </View>

              <View style={styles.modalBlock}>
                <Pressable style={styles.uploadArea}>
                  <View style={styles.uploadIconCircle}>
                    <Text style={styles.uploadIcon}>📷</Text>
                  </View>
                  <Text style={styles.uploadTitle}>Tap to take photo</Text>
                  <Text style={styles.uploadSub}>
                    or browse files (JPG, PNG, PDF)
                  </Text>
                </Pressable>
              </View>

              <View style={styles.tipsBox}>
                <Text style={styles.tipsIcon}>ℹ</Text>
                <View style={styles.tipsTextBlock}>
                  <Text style={styles.tipsTitle}>Tips for fast approval:</Text>
                  <Text style={styles.tipItem}>
                    • Ensure all 4 corners are visible
                  </Text>
                  <Text style={styles.tipItem}>• Avoid glare and shadows</Text>
                  <Text style={styles.tipItem}>
                    • Text must be clearly readable
                  </Text>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                onPress={props.onPressUploadDocument}
                activeOpacity={0.9}
                style={styles.modalCta}
              >
                <Text style={styles.modalCtaText}>Upload Document</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function TabButton(props: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={props.onPress}
      activeOpacity={0.9}
      style={[styles.tabBtn, props.active && styles.tabBtnActive]}
    >
      <Text style={[styles.tabText, props.active && styles.tabTextActive]}>
        {props.label}
      </Text>
    </TouchableOpacity>
  );
}

function InfoRow(props: {
  label: string;
  value: string;
  right?: React.ReactNode;
  last?: boolean;
  multiline?: boolean;
}) {
  return (
    <View style={[styles.infoRow, props.last && styles.infoRowLast]}>
      <Text style={styles.infoLabel}>{props.label.toUpperCase()}</Text>
      <View style={styles.infoValueRow}>
        <Text
          style={[
            styles.infoValue,
            props.multiline ? styles.infoValueMultiline : undefined,
          ]}
          {...(props.multiline ? {} : { numberOfLines: 3 })}
        >
          {props.value}
        </Text>
        {props.right ? (
          <View style={styles.infoRight}>{props.right}</View>
        ) : null}
      </View>
    </View>
  );
}

const colors = {
  primary: "#F08E10",
  primaryHover: "#D97D08",
  success: "#10B981",
  error: "#EF4444",
  warning: "#F59E0B",
  background: "#F8FAFC",
  surface: "#FFFFFF",
  textMain: "#111827",
  textMuted: "#6B7280",
  textLight: "#9CA3AF",
  input: "#F3F4F6",
  border: "#E5E7EB",
  infoBlue: "#3B82F6",
  infoBg: "#EFF6FF",
  purpleSoft: "#EEF2FF",
  purpleText: "#4F46E5",
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  header: {
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#F3F4F6",
  },
  headerElevated: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  headerInner: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  backButtonText: {
    fontSize: 22,
    fontWeight: "900",
    color: colors.textMain,
    marginTop: -3,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.textMain,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.purpleSoft,
    borderWidth: 1,
    borderColor: "#E0E7FF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginRight: 10,
  },
  roleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.purpleText,
    marginRight: 8,
  },
  roleText: {
    fontSize: 10,
    fontWeight: "900",
    color: colors.purpleText,
    letterSpacing: 0.8,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  headerIcon: {
    fontSize: 14,
    color: colors.textMuted,
  },
  sectionPadTop: {
    paddingHorizontal: 16,
    marginTop: 24,
    marginBottom: 18,
  },
  sectionPad: {
    paddingHorizontal: 16,
    marginBottom: 18,
  },
  sectionBottom: {
    marginBottom: 10,
  },
  profileHeader: {
    alignItems: "center",
  },
  avatarOuterRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primary,
    padding: 4,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 30,
    elevation: 6,
  },
  avatarRingInner: {
    flex: 1,
    borderRadius: 44,
    backgroundColor: colors.surface,
    borderWidth: 4,
    borderColor: colors.surface,
    overflow: "hidden",
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
  avatarFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FDBA74",
  },
  editPhotoBtn: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  editPhotoIcon: {
    fontSize: 12,
    color: colors.primary,
  },
  profileName: {
    marginTop: 12,
    fontSize: 20,
    fontWeight: "900",
    color: colors.textMain,
  },
  verifiedBadge: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16,185,129,0.10)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.20)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  verifiedIcon: {
    color: colors.success,
    fontSize: 12,
    marginRight: 8,
  },
  verifiedText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: "900",
  },
  strengthCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 1,
  },
  strengthHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  strengthTitleBlock: {
    flex: 1,
    paddingRight: 12,
  },
  strengthLoadingBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(240,142,16,0.10)",
    borderWidth: 1,
    borderColor: "rgba(240,142,16,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  strengthLoadingFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(240,142,16,0.22)",
  },
  strengthLoadingFillPulse: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    backgroundColor: "rgba(240,142,16,0.35)",
  },
  strengthShimmer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 72,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  strengthLoadingRow: {
    marginTop: 12,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "rgba(240,142,16,0.14)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  strengthLoadingDots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  strengthLoadingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  strengthLoadingText: {
    flex: 1,
    fontSize: 11,
    fontWeight: "800",
    color: "#92400E",
    lineHeight: 15,
  },
  strengthTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: colors.textMain,
  },
  strengthSub: {
    marginTop: 3,
    fontSize: 10,
    fontWeight: "700",
    color: colors.textMuted,
  },
  strengthPercent: {
    fontSize: 18,
    fontWeight: "900",
    color: colors.primary,
  },
  strengthTrack: {
    height: 8,
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
    overflow: "hidden",
  },
  strengthFill: {
    height: 8,
    backgroundColor: colors.primary,
    borderRadius: 999,
  },
  missingCompleteIcon: {
    fontSize: 12,
    color: colors.success,
    marginRight: 8,
    fontWeight: "900",
  },
  missingCompleteText: {
    flex: 1,
    fontSize: 11,
    fontWeight: "700",
    color: colors.success,
    lineHeight: 15,
  },
  missingRow: {
    marginTop: 12,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#F3F4F6",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  missingIcon: {
    fontSize: 12,
    color: colors.warning,
    marginRight: 10,
  },
  missingText: {
    flex: 1,
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
  },
  missingFix: {
    fontSize: 12,
    fontWeight: "900",
    color: colors.primary,
  },
  tabsStickyWrap: {
    backgroundColor: "rgba(248,250,252,0.95)",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  tabsPill: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    flexDirection: "row",
  },
  tabBtn: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBtnActive: {
    backgroundColor: colors.primary,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  tabText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.surface,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionKicker: {
    fontSize: 11,
    fontWeight: "900",
    color: colors.textMuted,
    letterSpacing: 1,
  },
  editBtn: {
    height: 32,
    borderRadius: 10,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(240,142,16,0.10)",
  },
  editBtnContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: "900",
    color: colors.primary,
  },
  detailsCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    padding: 16,
  },
  infoRow: {
    paddingBottom: 14,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  infoRowLast: {
    marginBottom: 0,
    paddingBottom: 0,
    borderBottomWidth: 0,
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: colors.textMuted,
    letterSpacing: 0.9,
    marginBottom: 6,
  },
  infoValueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textMain,
    flex: 1,
    paddingRight: 10,
  },
  infoValueMultiline: {
    lineHeight: 20,
  },
  infoRight: {
    marginLeft: 10,
    alignItems: "flex-end",
  },
  lockIcon: {
    fontSize: 12,
    color: "#D1D5DB",
  },
  verifiedPill: {
    backgroundColor: "rgba(16,185,129,0.10)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  verifiedPillText: {
    fontSize: 10,
    fontWeight: "900",
    color: colors.success,
  },
  smallActionIcon: {
    fontSize: 12,
    color: colors.textLight,
  },
  skillsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  skillsTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: colors.textMain,
    letterSpacing: 1,
  },
  skillsCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    padding: 16,
  },
  skillTagsWrap: {
    gap: 10,
  },
  serviceCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EEF2FF",
    borderRadius: 14,
    padding: 10,
  },
  serviceCardImage: {
    width: 48,
    height: 48,
    borderRadius: 12,
    marginRight: 10,
  },
  serviceCardImageFallback: {
    width: 48,
    height: 48,
    borderRadius: 12,
    marginRight: 10,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  serviceCardTextWrap: {
    flex: 1,
  },
  serviceCardTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: colors.textMain,
  },
  serviceCardSubtitle: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
  },
  serviceCardSkeleton: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F1F5F9",
    borderRadius: 14,
    padding: 10,
    backgroundColor: "#FFFFFF",
  },
  serviceCardSkeletonImage: {
    width: 48,
    height: 48,
    borderRadius: 12,
    marginRight: 10,
    backgroundColor: "#E5E7EB",
  },
  serviceCardSkeletonTextWrap: {
    flex: 1,
    gap: 6,
  },
  serviceCardSkeletonTitle: {
    width: "55%",
    height: 10,
    borderRadius: 999,
    backgroundColor: "#E5E7EB",
  },
  serviceCardSkeletonSubtitle: {
    width: "35%",
    height: 8,
    borderRadius: 999,
    backgroundColor: "#E5E7EB",
  },
  skillsHint: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: "700",
    color: colors.textMuted,
    lineHeight: 14,
  },
  docList: {
    marginTop: 12,
  },
  docCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  docLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 10,
  },
  docIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 1,
  },
  docIcon: {
    fontSize: 18,
  },
  docIconBoxSuccess: {
    backgroundColor: "#ECFDF5",
    borderColor: "#D1FAE5",
  },
  docIconBoxWarn: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FEF3C7",
  },
  docIconBoxError: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FEE2E2",
  },
  docTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: colors.textMain,
    marginBottom: 4,
  },
  docMetaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  docMeta: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textMuted,
  },
  docMetaSuccess: {
    color: colors.success,
    fontWeight: "900",
  },
  docMetaWarn: {
    color: colors.warning,
    fontWeight: "900",
  },
  docRejectionHint: {
    marginTop: 6,
    fontSize: 11,
    lineHeight: 15,
    color: "#B91C1C",
    fontWeight: "600",
    maxWidth: 220,
  },
  docMetaError: {
    color: colors.error,
    fontWeight: "900",
  },
  metaDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
    marginHorizontal: 8,
  },
  chev: {
    fontSize: 18,
    fontWeight: "900",
    color: "#D1D5DB",
  },
  chevMuted: {
    fontSize: 14,
    fontWeight: "900",
    color: "#D1D5DB",
  },
  docCardWarn: {
    borderColor: "rgba(245,158,11,0.30)",
  },
  docCardApproved: {
    borderColor: "rgba(16,185,129,0.30)",
  },
  docWarnBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: colors.warning,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  docCardError: {
    borderColor: "rgba(239,68,68,0.30)",
  },
  docErrorBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: colors.error,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  reuploadBtn: {
    backgroundColor: colors.error,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  reuploadBtnText: {
    color: colors.surface,
    fontSize: 11,
    fontWeight: "900",
  },
  uploadNewBtn: {
    height: 48,
    borderRadius: 14,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  uploadNewIcon: {
    fontSize: 12,
    color: colors.textMuted,
    marginRight: 8,
  },
  uploadNewText: {
    fontSize: 12,
    fontWeight: "900",
    color: colors.textMuted,
  },
  validatedText: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: "700",
    color: colors.success,
  },
  emptyDocsCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    padding: 16,
  },
  emptyDocsTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.textMain,
    marginBottom: 6,
  },
  emptyDocsSub: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.60)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    overflow: "hidden",
  },
  modalHeaderRow: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: colors.textMain,
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseText: {
    fontSize: 22,
    fontWeight: "900",
    color: colors.textMuted,
    marginTop: -2,
  },
  modalScroll: {
    paddingHorizontal: 18,
  },
  modalBlock: {
    marginTop: 18,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: colors.textMain,
    marginBottom: 10,
  },
  selectLike: {
    backgroundColor: colors.input,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectLikeText: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.textMain,
  },
  selectLikeChev: {
    color: colors.textMuted,
    fontWeight: "900",
  },
  uploadArea: {
    height: 160,
    borderRadius: 18,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  uploadIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(240,142,16,0.10)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  uploadIcon: {
    fontSize: 18,
    color: colors.primary,
  },
  uploadTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: colors.textMain,
  },
  uploadSub: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: "700",
    color: colors.textMuted,
  },
  tipsBox: {
    marginTop: 18,
    backgroundColor: "#EFF6FF",
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  tipsIcon: {
    color: colors.infoBlue,
    fontSize: 12,
    fontWeight: "900",
    marginRight: 10,
    marginTop: 2,
  },
  tipsTextBlock: {
    flex: 1,
  },
  tipsTitle: {
    fontSize: 10,
    fontWeight: "900",
    color: colors.infoBlue,
    marginBottom: 6,
  },
  tipItem: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textMuted,
    lineHeight: 14,
  },
  modalFooter: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    backgroundColor: "#F9FAFB",
  },
  modalCta: {
    width: "100%",
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 3,
  },
  modalCtaText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: "900",
  },
});

export const ProviderProfileScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<ProviderStackParamList>>();
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserWithProfile | null>(user ?? null);
  const [verificationRequest, setVerificationRequest] =
    useState<LatestVerificationRequest | null>(null);
  const [allDocuments, setAllDocuments] = useState<
    ProviderVerificationDocument[]
  >([]);
  const [profileStrength, setProfileStrength] =
    useState<ProfileStrengthResult | null>(null);
  const [profileStrengthLoading, setProfileStrengthLoading] = useState(true);
  const [loading, setLoading] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setProfileStrengthLoading(true);
    try {
      const [profileRes, verificationRes, docsRes] = await Promise.all([
        api.getProviderProfile(),
        api.getMyLatestVerificationRequest(),
        api.getMyVerificationDocuments(),
      ]);
      const nextProfile = profileRes.data as UserWithProfile;
      const nextDocuments =
        (docsRes.data as ProviderVerificationDocument[]) ?? [];
      const activeServices =
        extractActiveApprovedServicesFromDocuments(nextDocuments);

      const givenServiceResults = await Promise.allSettled(
        activeServices.map(async (service) => {
          const res = await api.getProviderGivenService(service.id);
          const row = res.data as {
            price?: number | string;
            description?: string | null;
            whatIsIncluded?: string | null;
            serviceAreaNotes?: string | null;
            clientMustProvide?: string | null;
            estimatedDurationMinutes?: number | null;
            minimumHours?: number | null;
            serviceRadiusKm?: number | string | null;
            galleries?: Array<{ id: string }>;
          };

          const price =
            typeof row.price === "number"
              ? row.price
              : Number.parseFloat(String(row.price ?? ""));

          const serviceRadiusKm =
            typeof row.serviceRadiusKm === "number"
              ? row.serviceRadiusKm
              : row.serviceRadiusKm != null
                ? Number.parseFloat(String(row.serviceRadiusKm))
                : null;

          return {
            serviceId: service.id,
            serviceName: service.name,
            servicePhoto: service.servicePhoto,
            description: row.description ?? service.description ?? null,
            price: Number.isFinite(price) ? price : null,
            whatIsIncluded: row.whatIsIncluded ?? null,
            serviceAreaNotes: row.serviceAreaNotes ?? null,
            clientMustProvide: row.clientMustProvide ?? null,
            estimatedDurationMinutes: row.estimatedDurationMinutes ?? null,
            minimumHours: row.minimumHours ?? null,
            serviceRadiusKm: Number.isFinite(Number(serviceRadiusKm))
              ? Number(serviceRadiusKm)
              : null,
            galleryCount: Array.isArray(row.galleries) ? row.galleries.length : 0,
          } satisfies ProfileStrengthGivenService;
        }),
      );

      const givenServices: ProfileStrengthGivenService[] = [];
      for (const result of givenServiceResults) {
        if (result.status === "fulfilled") {
          givenServices.push(result.value);
        }
      }

      setProfile(nextProfile);
      setVerificationRequest(
        (verificationRes.data as LatestVerificationRequest | null) ?? null,
      );
      setAllDocuments(nextDocuments);
      setProfileStrength(
        computeProviderProfileStrength({
          profile: nextProfile,
          givenServices,
        }),
      );
    } catch {
      setProfile((user as UserWithProfile | null) ?? null);
      setVerificationRequest(null);
      setAllDocuments([]);
      setProfileStrength(
        computeProviderProfileStrength({
          profile: (user as UserWithProfile | null) ?? null,
          givenServices: [],
        }),
      );
    } finally {
      setLoading(false);
      setProfileStrengthLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setProfile((prev) => {
      if (!prev) return user;
      if (!user.provider) return { ...prev, ...user };
      return {
        ...prev,
        ...user,
        provider: { ...(prev.provider ?? {}), ...user.provider },
      };
    });
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile]),
  );

  if (loading && !profile) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <ProfileDocumentsScreen
      profile={profile}
      loading={loading}
      verificationRequest={verificationRequest}
      allDocuments={allDocuments}
      profileStrength={profileStrength}
      profileStrengthLoading={profileStrengthLoading}
      onPressBack={() => navigation.goBack()}
      onPressEditPersonalInfo={() => navigation.navigate("ProviderEditProfile")}
      onPressEditPhoto={() => navigation.navigate("ProviderEditProfile")}
      onPressDocument={(doc) =>
        navigation.navigate("ProviderDocumentDetails", { document: doc })
      }
      onPressServiceSkill={(service) =>
        navigation.navigate("ProviderManageService", {
          mode: "edit",
          serviceId: service.id,
          serviceName: service.name,
          serviceCategory: service.categoryName,
          serviceDescription: service.description ?? undefined,
        })
      }
    />
  );
};
