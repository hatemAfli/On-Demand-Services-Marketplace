import React, { useRef, type ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { COLORS } from "../../../constants";
import type { ClientStackParamList } from "../../../navigation/types";
import type { ClientAppointmentDetailModel } from "./ClientAppointmentDetailScreen";

const ACCENT = "#EA580C";
const ACCENT_DARK = "#C2410C";
const SCREEN_BG = "#F8FAFC";
const ORDER_STATUS_STEPS = [
  {
    label: "Order\nsent",
    icon: "paper-plane" as const,
    pendingIcon: "mail-outline" as const,
  },
  {
    label: "Provider\nconfirmed",
    icon: "checkmark-circle" as const,
    pendingIcon: "checkmark-circle-outline" as const,
  },
  {
    label: "On the\nway",
    icon: "car" as const,
    pendingIcon: "car-outline" as const,
  },
  {
    label: "Start\nservice",
    icon: "construct" as const,
    pendingIcon: "construct-outline" as const,
  },
  {
    label: "Done",
    icon: "flag" as const,
    pendingIcon: "flag-outline" as const,
  },
] as const;

export type ClientTimelineProgress = {
  doneThrough: number;
  activeIdx: number;
};

function getStepState(
  stepIdx: number,
  progress: ClientTimelineProgress,
): "done" | "active" | "pending" {
  if (stepIdx <= progress.doneThrough) return "done";
  if (progress.activeIdx >= 0 && stepIdx === progress.activeIdx) return "active";
  return "pending";
}

type MainAction = {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  backgroundColor: string;
  onPress: () => void;
} | null;

type CurrentCard = {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
} | null;

function showOrderStatusStepper(status: string): boolean {
  return ![
    "REFUSED",
    "CANCELLED_CLIENT",
    "CANCELLED_PROVIDER",
    "DISPUTED",
  ].includes(status);
}

function formatTimeOnly(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

function providerInitials(first: string, last: string): string {
  const a = first.trim().charAt(0).toUpperCase();
  const b = last.trim().charAt(0).toUpperCase();
  if (a && b) return `${a}${b}`;
  return (a || b || "?").slice(0, 2);
}

export type ClientAppointmentDetailViewProps = {
  navigation: NativeStackNavigationProp<
    ClientStackParamList,
    "ClientAppointmentDetail"
  >;
  insetsTop: number;
  insetsBottom: number;
  appointment: ClientAppointmentDetailModel;
  appointmentRef: string;
  statusLabel: string;
  statusPillColor: string;
  providerFullName: string;
  priceLabel: string;
  actionLoading: boolean;
  timelineProgress: ClientTimelineProgress;
  showAwaitingClientStart: boolean;
  showTimerPhase: boolean;
  showConfirmComplete: boolean;
  elapsedSeconds: number;
  checkingReview: boolean;
  canReview: boolean;
  alreadyReviewed: boolean;
  existingReviewRating: number | null;
  existingReviewComment: string | null;
  canManageReview: boolean;
  showReportProblemLink: boolean;
  canOpenProviderProfile: boolean;
  clientPhotosSection: ReactNode;
  servicePhotosSection: ReactNode;
  formatBookingDateTime: (date: string, time: string) => string;
  formatLongDate: (ymd: string | null) => string;
  formatRescheduleDetail: (
    rescheduleDate: string | null,
    rescheduleTime: string | null,
  ) => string;
  onBack: () => void;
  onCancelRequest: () => void;
  onCancelConfirmed: () => void;
  onDeclineReschedule: () => void;
  onAcceptReschedule: () => void;
  onConfirmStart: () => void;
  onConfirmComplete: () => void;
  onOpenProviderProfile: () => void;
  onOpenComplaintDetail: () => void;
  onReportProblem: () => void;
  onLeaveReview: () => void;
  onEditReview: () => void;
  onRemoveReview: () => void;
  onFindAnotherProvider: () => void;
  onBookAgain: () => void;
};

export function ClientAppointmentDetailView({
  navigation,
  insetsTop,
  insetsBottom,
  appointment,
  appointmentRef,
  statusLabel,
  statusPillColor,
  providerFullName,
  priceLabel,
  actionLoading,
  timelineProgress,
  showAwaitingClientStart,
  showTimerPhase,
  showConfirmComplete,
  elapsedSeconds,
  checkingReview,
  canReview,
  alreadyReviewed,
  existingReviewRating,
  existingReviewComment,
  canManageReview,
  showReportProblemLink,
  canOpenProviderProfile,
  clientPhotosSection,
  servicePhotosSection,
  formatBookingDateTime,
  formatLongDate,
  formatRescheduleDetail,
  onBack,
  onCancelRequest,
  onCancelConfirmed,
  onDeclineReschedule,
  onAcceptReschedule,
  onConfirmStart,
  onConfirmComplete,
  onOpenProviderProfile,
  onOpenComplaintDetail,
  onReportProblem,
  onLeaveReview,
  onEditReview,
  onRemoveReview,
  onFindAnotherProvider,
  onBookAgain,
}: ClientAppointmentDetailViewProps) {
  const scrollRef = useRef<ScrollView>(null);
  const detailsYRef = useRef(0);

  const stepperVisible = showOrderStatusStepper(appointment.status);
  const progressIndex =
    timelineProgress.activeIdx >= 0
      ? timelineProgress.activeIdx
      : timelineProgress.doneThrough;
  const stepProgressWidth = `${(Math.max(0, progressIndex) / (ORDER_STATUS_STEPS.length - 1)) * 100}%`;

  const initials = providerInitials(
    appointment.provider.firstName,
    appointment.provider.lastName,
  );

  const scrollToDetails = () => {
    scrollRef.current?.scrollTo({
      y: Math.max(0, detailsYRef.current - 12),
      animated: true,
    });
  };

  const reportProblemLink = (marginTop?: number) =>
    showReportProblemLink ? (
      <TouchableOpacity
        style={[styles.reportProblemLinkRow, marginTop != null && { marginTop }]}
        onPress={onReportProblem}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      >
        <Ionicons
          name="flag-outline"
          size={16}
          color={COLORS.error || "#EF4444"}
        />
        <Text style={styles.reportProblemLinkText}>Report a problem</Text>
      </TouchableOpacity>
    ) : null;

  const mainAction: MainAction = (() => {
    if (showAwaitingClientStart) {
      return {
        title: "Start Service",
        icon: "play",
        backgroundColor: ACCENT,
        onPress: onConfirmStart,
      };
    }
    if (showConfirmComplete) {
      return {
        title: "Confirm Service Complete",
        icon: "checkmark-done",
        backgroundColor: "#10B981",
        onPress: onConfirmComplete,
      };
    }
    return null;
  })();

  const currentCard: CurrentCard = (() => {
    if (appointment.status === "PENDING") {
      return {
        title: "Awaiting provider",
        description: `Waiting for ${providerFullName} to confirm your request.`,
        icon: "hourglass-outline",
      };
    }
    if (appointment.status === "CONFIRMED") {
      return {
        title: "Appointment confirmed",
        description: `Confirmed for ${formatLongDate(appointment.scheduledDate)}.`,
        icon: "checkmark-circle-outline",
      };
    }
    if (appointment.status === "RESCHEDULED") {
      return {
        title: "New time proposed",
        description: formatRescheduleDetail(
          appointment.rescheduleDate,
          appointment.rescheduleTime,
        ),
        icon: "calendar-outline",
      };
    }
    if (appointment.status === "EN_ROUTE") {
      return {
        title: "Provider is on the way",
        description: appointment.enRouteAt
          ? `Departed at ${formatTimeOnly(appointment.enRouteAt)}`
          : "Your provider is heading to you.",
        icon: "car-outline",
      };
    }
    if (showAwaitingClientStart) {
      return {
        title: "Provider has arrived",
        description: "Please confirm to start the service.",
        icon: "location-outline",
      };
    }
    if (showTimerPhase) {
      return {
        title: "Service in progress",
        description: "Your service is currently underway.",
        icon: "timer-outline",
      };
    }
    if (showConfirmComplete) {
      return {
        title: "Confirm completion",
        description: "The provider has ended the service. Please confirm.",
        icon: "hourglass-outline",
      };
    }
    if (appointment.status === "COMPLETED") {
      return {
        title: "Service completed",
        description: "This appointment has been closed successfully.",
        icon: "checkmark-done-outline",
      };
    }
    return null;
  })();

  const timestampText = (() => {
    if (appointment.enRouteAt) {
      return `En route at ${formatTimeOnly(appointment.enRouteAt)}`;
    }
    if (appointment.startedAt) {
      return `Started at ${formatTimeOnly(appointment.startedAt)}`;
    }
    return `Scheduled ${formatBookingDateTime(
      appointment.scheduledDate,
      appointment.scheduledTime,
    )}`;
  })();


  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={SCREEN_BG} />

      <View style={[styles.header, { paddingTop: insetsTop + 10 }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={onBack}
            style={styles.iconButton}
          >
            <Ionicons name="chevron-back" size={18} color="#111827" />
          </TouchableOpacity>
          <View>
            <Text style={styles.jobTitle}>{appointmentRef}</Text>
            <View
              style={[
                styles.statusPill,
                { backgroundColor: `${statusPillColor}1A` },
              ]}
            >
              <Text style={[styles.statusText, { color: statusPillColor }]}>
                {statusLabel.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.navigate("Notifications")}
          >
            <Ionicons name="notifications-outline" size={16} color="#6B7280" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={scrollToDetails}>
            <Ionicons name="information-circle-outline" size={16} color="#6B7280" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insetsBottom + 32 },
        ]}
      >
        {stepperVisible ? (
          <View style={styles.stepperCard}>
            <View style={styles.stepLine}>
              <View style={[styles.stepLineFill, { width: stepProgressWidth }]} />
            </View>
            <View style={styles.stepperRow}>
              {ORDER_STATUS_STEPS.map((step, index) => {
                const state = getStepState(index, timelineProgress);
                let circleStyle = styles.stepCirclePending;
                let iconName: keyof typeof Ionicons.glyphMap = step.pendingIcon;
                let iconColor = "#9CA3AF";
                let textStyle = styles.stepTextPending;
                let wrapperStyle: object = styles.stepItem;
                if (state === "done") {
                  circleStyle = styles.stepCircleCompleted;
                  iconName = "checkmark";
                  iconColor = "#FFFFFF";
                  textStyle = styles.stepTextCompleted;
                } else if (state === "active") {
                  circleStyle = styles.stepCircleActive;
                  iconName = step.icon;
                  iconColor = "#FFFFFF";
                  textStyle = styles.stepTextActive;
                } else {
                  wrapperStyle = [styles.stepItem, styles.stepItemPending];
                }
                return (
                  <View key={step.label} style={wrapperStyle}>
                    <View style={circleStyle}>
                      <Ionicons name={iconName} size={10} color={iconColor} />
                    </View>
                    <Text style={textStyle}>{step.label}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {appointment.status === "DISPUTED" ? (
          <View style={styles.section}>
            <View style={styles.disputedBanner}>
              <View style={styles.disputedIconWrap}>
                <Ionicons name="flag" size={20} color={COLORS.error || "#EF4444"} />
              </View>
              <View style={styles.disputedCopy}>
                <Text style={styles.disputedTitle}>Complaint in progress</Text>
                <Text style={styles.disputedSubtitle}>
                  A complaint has been filed for this appointment. Our team is reviewing it.
                </Text>
                <TouchableOpacity
                  onPress={onOpenComplaintDetail}
                  style={styles.disputedLinkRow}
                >
                  <Text style={styles.disputedLink}>View details</Text>
                  <Ionicons name="arrow-forward" size={14} color={COLORS.error || "#EF4444"} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}

        {appointment.status === "REFUSED" ? (
          <View style={styles.section}>
            <View style={styles.alertCard}>
              <Ionicons name="close-circle" size={16} color="#EF4444" style={styles.alertIcon} />
              <View style={styles.alertCopy}>
                <Text style={styles.alertTitle}>Request refused</Text>
                {appointment.refusalReason ? (
                  <Text style={styles.alertText}>{appointment.refusalReason}</Text>
                ) : null}
              </View>
            </View>
            <TouchableOpacity
              style={[styles.primaryAction, { backgroundColor: ACCENT, marginTop: 12 }]}
              onPress={onFindAnotherProvider}
            >
              <Text style={styles.primaryActionText}>Find Another Provider</Text>
              <Ionicons name="search" size={12} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ) : null}

        {(appointment.status === "CANCELLED_CLIENT" ||
          appointment.status === "CANCELLED_PROVIDER") && (
          <View style={styles.section}>
            <View style={styles.alertCardNeutral}>
              <Ionicons name="ban-outline" size={16} color="#6B7280" style={styles.alertIcon} />
              <View style={styles.alertCopy}>
                <Text style={styles.alertTitleNeutral}>Appointment cancelled</Text>
                <Text style={styles.alertTextNeutral}>
                  {appointment.status === "CANCELLED_CLIENT"
                    ? "Cancelled by you"
                    : "Cancelled by provider"}
                </Text>
                {appointment.cancellationReason ? (
                  <Text style={styles.alertTextNeutral}>
                    "{appointment.cancellationReason}"
                  </Text>
                ) : null}
              </View>
            </View>
            <TouchableOpacity
              style={[styles.primaryAction, { backgroundColor: ACCENT, marginTop: 12 }]}
              onPress={onBookAgain}
            >
              <Text style={styles.primaryActionText}>Book Again</Text>
              <Ionicons name="add-circle-outline" size={12} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}

        {currentCard ? (
          <View style={styles.section}>
            <View style={styles.currentCard}>
              <View style={styles.decorativeGlow} />
              <View style={styles.currentCardHeader}>
                <View style={styles.currentCardCopy}>
                  <Text style={styles.sectionTitle}>{currentCard.title}</Text>
                  <Text style={styles.sectionSubtitle}>{currentCard.description}</Text>
                  {showTimerPhase ? (
                    <Text style={styles.timerLarge}>{formatElapsed(elapsedSeconds)}</Text>
                  ) : null}
                </View>
                <View style={styles.currentIconWrap}>
                  <Ionicons name={currentCard.icon} size={18} color={ACCENT} />
                </View>
              </View>

              {appointment.status === "RESCHEDULED" ? (
                <View style={styles.rescheduleButtonRow}>
                  <TouchableOpacity
                    style={[styles.secondaryDangerBtn, styles.flex1]}
                    onPress={onDeclineReschedule}
                    disabled={actionLoading}
                  >
                    <Text style={styles.secondaryDangerText}>Decline</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.primaryAction, styles.flex1, { backgroundColor: "#10B981" }]}
                    onPress={onAcceptReschedule}
                    disabled={actionLoading}
                  >
                    {actionLoading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <>
                        <Text style={styles.primaryActionText}>Accept</Text>
                        <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              ) : null}

              {mainAction ? (
                <TouchableOpacity
                  style={[
                    styles.primaryAction,
                    { backgroundColor: mainAction.backgroundColor },
                    actionLoading && styles.btnDisabled,
                  ]}
                  onPress={mainAction.onPress}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Text style={styles.primaryActionText}>{mainAction.title}</Text>
                      <Ionicons name={mainAction.icon} size={12} color="#FFFFFF" />
                    </>
                  )}
                </TouchableOpacity>
              ) : null}

              {appointment.status === "PENDING" ? (
                <TouchableOpacity
                  style={styles.secondaryDangerBtn}
                  onPress={onCancelRequest}
                  disabled={actionLoading}
                >
                  <Text style={styles.secondaryDangerText}>Cancel Request</Text>
                </TouchableOpacity>
              ) : null}

              {appointment.status === "CONFIRMED" ? (
                <TouchableOpacity
                  onPress={onCancelConfirmed}
                  disabled={actionLoading}
                  style={styles.cancelLinkWrap}
                >
                  <Text style={styles.cancelDangerLink}>Cancel appointment</Text>
                </TouchableOpacity>
              ) : null}

              {appointment.status === "EN_ROUTE" ? reportProblemLink(12) : null}
              {appointment.status === "IN_PROGRESS" ? reportProblemLink(12) : null}

              {appointment.status === "COMPLETED" ? (
                <View style={styles.completedSummary}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Started</Text>
                    <Text style={styles.summaryValue}>
                      {formatDateTime(appointment.startedAt)}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Ended</Text>
                    <Text style={styles.summaryValue}>
                      {formatDateTime(appointment.completedAt)}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Duration</Text>
                    <Text style={styles.summaryValue}>
                      {appointment.durationMinutes != null
                        ? `${appointment.durationMinutes} min`
                        : "—"}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.timestampRow}>
                  <Ionicons name="time-outline" size={10} color="#9CA3AF" />
                  <Text style={styles.timestampText}>{timestampText}</Text>
                </View>
              )}
            </View>
          </View>
        ) : null}

        {appointment.status === "COMPLETED" ? (
          <View style={styles.section}>
            {checkingReview ? (
              <View style={styles.reviewCheckRow}>
                <ActivityIndicator size="small" color="#D97706" />
              </View>
            ) : canReview && !alreadyReviewed ? (
              <View style={styles.reviewPromoCard}>
                <View style={styles.reviewPromoHeader}>
                  <View style={styles.reviewPromoIconWrap}>
                    <Ionicons name="star" size={24} color="#D97706" />
                  </View>
                  <View style={styles.reviewPromoHeaderText}>
                    <Text style={styles.reviewPromoTitle}>How was your experience?</Text>
                    <Text style={styles.reviewPromoSub}>
                      Help others by sharing your feedback.
                    </Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.reviewPromoBtn} onPress={onLeaveReview}>
                  <Text style={styles.reviewPromoBtnText}>Leave a review</Text>
                  <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ) : alreadyReviewed ? (
              <View style={styles.existingReviewCard}>
                <View style={styles.existingReviewHeader}>
                  <View style={styles.reviewPromoIconWrap}>
                    <Ionicons name="star" size={22} color="#D97706" />
                  </View>
                  <View style={styles.reviewPromoHeaderText}>
                    <Text style={styles.existingReviewTitle}>Your review</Text>
                    <Text style={styles.existingReviewSub}>
                      Shared after this appointment
                    </Text>
                  </View>
                </View>

                {existingReviewRating != null ? (
                  <View style={styles.existingStarsRow}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Ionicons
                        key={i}
                        name={
                          i <= existingReviewRating ? "star" : "star-outline"
                        }
                        size={18}
                        color={i <= existingReviewRating ? "#F59E0B" : "#D1D5DB"}
                      />
                    ))}
                    <Text style={styles.existingRatingText}>
                      {existingReviewRating}/5
                    </Text>
                  </View>
                ) : null}

                {existingReviewComment ? (
                  <View style={styles.existingCommentBox}>
                    <Text style={styles.existingCommentText} numberOfLines={4}>
                      {existingReviewComment}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.existingNoComment}>
                    No written feedback
                  </Text>
                )}

                {canManageReview ? (
                  <View style={styles.reviewActionRow}>
                    <TouchableOpacity
                      style={styles.reviewEditBtn}
                      onPress={onEditReview}
                      activeOpacity={0.88}
                    >
                      <Ionicons name="create-outline" size={14} color="#FFFFFF" />
                      <Text style={styles.reviewEditBtnText}>Edit review</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.reviewRemoveBtn}
                      onPress={onRemoveReview}
                      activeOpacity={0.88}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={14}
                        color={COLORS.error || "#DC2626"}
                      />
                      <Text style={styles.reviewRemoveBtnText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            ) : null}
            {reportProblemLink(14)}
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.infoCard}>
            <View style={styles.mapPreview}>
              <View style={styles.mapPlaceholder}>
                <Ionicons name="location-outline" size={28} color="#9CA3AF" />
              </View>
              <View style={styles.mapOverlay} />
              <View style={styles.mapLabel}>
                <Text style={styles.mapLabelSmall}>Service area</Text>
                <Text style={styles.mapLabelLarge} numberOfLines={2}>
                  {appointment.provider.city || "Provider location"}
                </Text>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.customerRow,
                pressed && canOpenProviderProfile && styles.rowPressed,
              ]}
              onPress={canOpenProviderProfile ? onOpenProviderProfile : undefined}
              disabled={!canOpenProviderProfile}
            >
              <View style={styles.customerLeft}>
                <View style={styles.avatarWrap}>
                  {appointment.provider.photoUrl ? (
                    <Image
                      source={{ uri: appointment.provider.photoUrl }}
                      style={styles.avatar}
                    />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Text style={styles.avatarInitials}>{initials}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.providerTextCol}>
                  <Text style={styles.customerName}>{providerFullName}</Text>
                  {appointment.provider.tagline ? (
                    <Text style={styles.providerTagline} numberOfLines={1}>
                      {appointment.provider.tagline}
                    </Text>
                  ) : null}
                  <View style={styles.customerMetaRow}>
                    <Ionicons name="briefcase-outline" size={10} color="#6B7280" />
                    <Text style={styles.customerMetaText}>Provider</Text>
                  </View>
                </View>
              </View>
              <View style={styles.customerActions}>
                <TouchableOpacity
                  style={styles.messageButton}
                  onPress={() => navigation.navigate("ConversationList")}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={14} color="#3B82F6" />
                </TouchableOpacity>
                {canOpenProviderProfile ? (
                  <TouchableOpacity
                    style={styles.phoneButton}
                    onPress={onOpenProviderProfile}
                  >
                    <Ionicons name="person-outline" size={14} color="#10B981" />
                  </TouchableOpacity>
                ) : null}
              </View>
            </Pressable>
          </View>
        </View>

        <View
          style={styles.section}
          onLayout={(e) => {
            detailsYRef.current = e.nativeEvent.layout.y;
          }}
        >
          <View style={styles.detailsCard}>
            <View style={styles.detailsHeader}>
              <Text style={styles.detailsTitle}>Job Details</Text>
              <TouchableOpacity onPress={scrollToDetails}>
                <Text style={styles.detailsLink}>View Full Order</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.detailRow}>
              <View style={styles.detailIconWrap}>
                <Ionicons name="briefcase-outline" size={14} color="#6B7280" />
              </View>
              <View style={styles.detailCopy}>
                <Text style={styles.detailPrimary}>
                  {appointment.givenService.serviceName || "Service"}
                </Text>
                <Text style={styles.detailSecondary}>
                  {appointment.givenService.categoryName || "Uncategorized"}
                  {appointment.givenService.estimatedDurationMinutes != null
                    ? ` · Est. ${appointment.givenService.estimatedDurationMinutes} mins`
                    : ""}
                </Text>
              </View>
              <Text style={styles.detailPrice}>{priceLabel}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <View style={styles.detailIconWrap}>
                <Ionicons name="calendar-outline" size={14} color="#6B7280" />
              </View>
              <View style={styles.detailCopy}>
                <Text style={styles.detailPrimary}>Scheduled</Text>
                <Text style={styles.detailSecondary}>
                  {formatBookingDateTime(
                    appointment.scheduledDate,
                    appointment.scheduledTime,
                  )}
                </Text>
              </View>
            </View>

            {appointment.notes ? (
              <>
                <View style={styles.divider} />
                <View style={styles.noteBox}>
                  <Text style={styles.noteBoxLabel}>Notes for provider</Text>
                  <Text style={styles.noteText}>{appointment.notes}</Text>
                </View>
              </>
            ) : null}

            {clientPhotosSection ? (
              <>
                <View style={styles.divider} />
                <View style={styles.attachmentsBlock}>
                  <Text style={styles.attachmentsLabel}>Your photos</Text>
                  {clientPhotosSection}
                </View>
              </>
            ) : null}

            {servicePhotosSection ? (
              <>
                <View style={styles.divider} />
                <View style={styles.attachmentsBlock}>
                  <Text style={styles.attachmentsLabel}>Service photos</Text>
                  {servicePhotosSection}
                </View>
              </>
            ) : null}

            <View style={styles.divider} />

            <View style={styles.orderSummary}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>
                  {appointment.givenService.serviceName}
                </Text>
                <Text style={styles.summaryValue}>{priceLabel}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Platform Fee</Text>
                <Text style={styles.summaryValue}>$0</Text>
              </View>
              <View style={[styles.summaryRow, styles.summaryRowTotal]}>
                <Text style={styles.summaryTotalLabel}>Total</Text>
                <Text style={styles.summaryTotalValue}>{priceLabel}</Text>
              </View>
            </View>
          </View>
        </View>

        {appointment.status === "PENDING" || appointment.status === "CONFIRMED" ? (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.btnCancelFull}
              onPress={
                appointment.status === "PENDING" ? onCancelRequest : onCancelConfirmed
              }
              disabled={actionLoading}
            >
              <Text style={styles.btnCancelFullText}>Cancel Appointment</Text>
            </TouchableOpacity>
            {reportProblemLink()}
          </View>
        ) : (
          reportProblemLink() ? (
            <View style={styles.section}>{reportProblemLink()}</View>
          ) : null
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: SCREEN_BG,
  },
  header: {
    paddingBottom: 16,
    paddingHorizontal: 24,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    zIndex: 20,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: "#F9FAFB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  jobTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 20,
  },
  statusPill: {
    alignSelf: "flex-start",
    marginTop: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  stepperCard: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 24,
    marginBottom: 8,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  stepperLoading: {
    minHeight: 72,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  stepperLoadingText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  stepLine: {
    position: "absolute",
    left: 24,
    right: 24,
    top: 24,
    height: 2,
    backgroundColor: "#E5E7EB",
    borderRadius: 999,
  },
  stepLineFill: {
    height: "100%",
    backgroundColor: ACCENT,
    borderRadius: 999,
  },
  stepperRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginTop: 2,
  },
  stepItem: {
    flex: 1,
    minWidth: 52,
    alignItems: "center",
  },
  stepItemPending: {
    opacity: 0.5,
  },
  stepCircleCompleted: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    elevation: 3,
  },
  stepCircleActive: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    elevation: 5,
  },
  stepCirclePending: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  stepTextCompleted: {
    marginTop: 8,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  stepTextActive: {
    marginTop: 8,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "700",
    color: ACCENT,
    textAlign: "center",
  },
  stepTextPending: {
    marginTop: 8,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "500",
    color: "#6B7280",
    textAlign: "center",
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  currentCard: {
    position: "relative",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    overflow: "hidden",
    elevation: 3,
  },
  decorativeGlow: {
    position: "absolute",
    right: -24,
    top: -24,
    width: 96,
    height: 96,
    borderRadius: 999,
    backgroundColor: "rgba(234, 88, 12, 0.05)",
  },
  currentCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  currentCardCopy: {
    flex: 1,
    paddingRight: 12,
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "700",
  },
  sectionSubtitle: {
    marginTop: 4,
    color: "#6B7280",
    fontSize: 12,
    lineHeight: 16,
  },
  currentIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: "rgba(234, 88, 12, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  timerLarge: {
    marginTop: 10,
    fontSize: 28,
    fontWeight: "800",
    color: ACCENT_DARK,
    fontVariant: ["tabular-nums"],
  },
  primaryAction: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    elevation: 3,
  },
  primaryActionText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    marginRight: 8,
  },
  btnDisabled: {
    opacity: 0.65,
  },
  secondaryDangerBtn: {
    marginTop: 12,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  secondaryDangerText: {
    color: "#DC2626",
    fontWeight: "700",
    fontSize: 13,
  },
  refuseBox: {
    marginTop: 12,
  },
  refuseInput: {
    minHeight: 88,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#111827",
    fontSize: 14,
    textAlignVertical: "top",
    marginBottom: 8,
  },
  refuseError: {
    color: "#DC2626",
    fontSize: 12,
    marginBottom: 8,
  },
  cancelLink: {
    marginTop: 10,
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  proposeLink: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  proposeLinkText: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: "700",
  },
  cancelLinkWrap: {
    alignItems: "center",
    marginTop: 12,
  },
  cancelDangerLink: {
    color: "#DC2626",
    fontWeight: "700",
    fontSize: 12,
  },
  timestampRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  timestampText: {
    marginLeft: 6,
    fontSize: 10,
    color: "#9CA3AF",
  },
  beforePhotosInline: {
    marginTop: 14,
  },
  infoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#F3F4F6",
    elevation: 2,
  },
  mapPreview: {
    height: 112,
    position: "relative",
  },
  mapImage: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  mapPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E5E7EB",
  },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  mapButtons: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
  },
  mapButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  mapLabel: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 12,
  },
  mapLabelSmall: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "500",
    opacity: 0.9,
  },
  mapLabelLarge: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 2,
  },
  customerRow: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  customerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 12,
  },
  avatarWrap: {
    width: 40,
    height: 40,
    marginRight: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
  },
  customerName: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
  },
  customerMetaRow: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  customerMetaText: {
    color: "#6B7280",
    fontSize: 10,
  },
  customerActions: {
    flexDirection: "row",
  },
  messageButton: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  phoneButton: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: "rgba(16,185,129,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  alertCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 16,
    padding: 12,
  },
  alertCardNeutral: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    padding: 12,
  },
  alertIcon: {
    marginTop: 2,
    marginRight: 12,
  },
  alertCopy: {
    flex: 1,
  },
  alertTitle: {
    color: "#991B1B",
    fontSize: 12,
    fontWeight: "700",
  },
  alertTitleNeutral: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "700",
  },
  alertText: {
    marginTop: 2,
    color: "rgba(146, 64, 14, 0.9)",
    fontSize: 11,
    lineHeight: 15,
  },
  alertTextNeutral: {
    marginTop: 2,
    color: "#6B7280",
    fontSize: 11,
    lineHeight: 15,
  },
  detailsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    elevation: 2,
  },
  detailsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  detailsTitle: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
  },
  detailsLink: {
    color: ACCENT,
    fontSize: 10,
    fontWeight: "700",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  detailIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#F9FAFB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  detailCopy: {
    flex: 1,
  },
  detailPrimary: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "700",
  },
  detailSecondary: {
    marginTop: 2,
    color: "#6B7280",
    fontSize: 11,
    lineHeight: 15,
  },
  detailPrice: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: "800",
    marginLeft: 8,
  },
  divider: {
    height: 1,
    backgroundColor: "#F9FAFB",
    marginVertical: 12,
  },
  noteBox: {
    backgroundColor: "#FEFCE8",
    borderRadius: 12,
    padding: 10,
  },
  noteBoxLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#D97706",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  noteText: {
    color: "#92400E",
    fontSize: 11,
    lineHeight: 15,
    fontStyle: "italic",
  },
  attachmentsBlock: {
    marginTop: 4,
  },
  attachmentsLabel: {
    marginBottom: 8,
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  attachmentsRow: {
    paddingBottom: 4,
  },
  photoThumb: {
    width: 64,
    height: 64,
    borderRadius: 10,
    overflow: "hidden",
    marginRight: 8,
    backgroundColor: "#F3F4F6",
  },
  photoImage: {
    width: "100%",
    height: "100%",
  },
  addPhotoButton: {
    width: 64,
    height: 64,
    borderRadius: 10,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  addPhotoText: {
    marginTop: 2,
    color: "#9CA3AF",
    fontSize: 8,
    fontWeight: "700",
  },
  interventionPhotoGroupSpaced: {
    marginTop: 12,
  },
  orderSummary: {
    marginTop: 4,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  summaryLabel: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "600",
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
  },
  summaryRowTotal: {
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    marginTop: 6,
    paddingTop: 10,
  },
  summaryTotalLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#111827",
  },
  summaryTotalValue: {
    fontSize: 13,
    fontWeight: "900",
    color: "#10B981",
  },
  completedSummary: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    paddingTop: 12,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  backdropTouchTarget: {
    flex: 1,
  },
  completionDrawer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "85%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    elevation: 12,
  },
  drawerHandle: {
    width: 48,
    height: 6,
    borderRadius: 999,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 14,
    backgroundColor: "#E5E7EB",
  },
  drawerBody: {
    flex: 1,
  },
  drawerScrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  drawerHeaderBlock: {
    alignItems: "center",
    marginBottom: 24,
  },
  completedIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 999,
    backgroundColor: "rgba(16,185,129,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  drawerTitle: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "700",
  },
  drawerSubtitle: {
    marginTop: 4,
    color: "#6B7280",
    fontSize: 14,
    textAlign: "center",
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    marginBottom: 8,
    color: "#111827",
    fontSize: 12,
    fontWeight: "700",
  },
  proofGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  takePhotoCard: {
    width: 96,
    height: 96,
    borderRadius: 16,
    backgroundColor: "#F9FAFB",
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  takePhotoText: {
    marginTop: 6,
    color: "#6B7280",
    fontSize: 10,
    fontWeight: "700",
  },
  proofThumb: {
    width: 96,
    height: 96,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#F3F4F6",
  },
  removeProofButton: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  drawerActions: {
    marginBottom: 8,
  },
  submitButton: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  cancelButtonText: {
    marginTop: 12,
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  flex1: { flex: 1 },
  rescheduleButtonRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  disputedBanner: {
    flexDirection: "row",
    borderRadius: 16,
    padding: 12,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    gap: 12,
  },
  disputedIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  disputedCopy: { flex: 1 },
  disputedTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#991B1B",
    marginBottom: 4,
  },
  disputedSubtitle: {
    fontSize: 11,
    color: "#B91C1C",
    lineHeight: 15,
    marginBottom: 8,
  },
  disputedLinkRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  disputedLink: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.error || "#EF4444",
  },
  reportProblemLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
  },
  reportProblemLinkText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.error || "#EF4444",
  },
  reviewCheckRow: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 28,
    marginBottom: 12,
  },
  reviewPromoCard: {
    backgroundColor: "#FFFBEB",
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  reviewPromoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 16,
  },
  reviewPromoIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "rgba(217, 119, 6, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  reviewPromoHeaderText: { flex: 1 },
  reviewPromoTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#92400E",
  },
  reviewPromoSub: {
    marginTop: 4,
    fontSize: 12,
    color: "#B45309",
    lineHeight: 18,
  },
  reviewPromoBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#D97706",
    borderRadius: 14,
    minHeight: 48,
  },
  reviewPromoBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
  reviewedChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 6,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(5, 150, 105, 0.25)",
  },
  reviewedChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#047857",
  },
  existingReviewCard: {
    backgroundColor: "#FFFBEB",
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  existingReviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 14,
  },
  existingReviewTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#92400E",
  },
  existingReviewSub: {
    marginTop: 2,
    fontSize: 11,
    color: "#B45309",
    lineHeight: 16,
  },
  existingStarsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 12,
  },
  existingRatingText: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: "700",
    color: "#92400E",
  },
  existingCommentBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FDE68A",
    padding: 12,
    marginBottom: 14,
  },
  existingCommentText: {
    fontSize: 12,
    color: "#78350F",
    lineHeight: 18,
  },
  existingNoComment: {
    fontSize: 12,
    fontStyle: "italic",
    color: "#B45309",
    marginBottom: 14,
  },
  reviewActionRow: {
    flexDirection: "row",
    gap: 10,
  },
  reviewEditBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "#D97706",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  reviewEditBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  reviewRemoveBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  reviewRemoveBtnText: {
    color: COLORS.error || "#DC2626",
    fontSize: 12,
    fontWeight: "700",
  },
  providerTextCol: { flex: 1 },
  providerTagline: {
    marginTop: 2,
    fontSize: 11,
    color: "#6B7280",
  },
  rowPressed: { opacity: 0.88 },
  btnCancelFull: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
  },
  btnCancelFullText: {
    color: "#DC2626",
    fontWeight: "700",
    fontSize: 13,
  },
});
