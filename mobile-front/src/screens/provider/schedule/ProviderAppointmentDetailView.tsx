import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { PhotoCarousel } from "../../../components/common";
import type { ProviderStackParamList } from "../../../navigation/types";

const ACCENT = "#EA580C";
const ACCENT_DARK = "#C2410C";
const SCREEN_BG = "#F8FAFC";
const SCREEN_HEIGHT = Dimensions.get("window").height;

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

const STATUS_ORDER = [
  "PENDING",
  "CONFIRMED",
  "EN_ROUTE",
  "IN_PROGRESS",
  "COMPLETED",
] as const;

type TimelineProgress = {
  doneThrough: number;
  activeIdx: number;
};

function timelineStatusKey(status: string): string {
  if (status === "RESCHEDULED") return "CONFIRMED";
  if ((STATUS_ORDER as readonly string[]).includes(status)) return status;
  return "PENDING";
}

function getTimelineProgress(status: string): TimelineProgress {
  const idx = STATUS_ORDER.indexOf(
    timelineStatusKey(status) as (typeof STATUS_ORDER)[number],
  );
  const lastIdx = ORDER_STATUS_STEPS.length - 1;

  if (idx < 0) {
    return { doneThrough: -1, activeIdx: 0 };
  }

  if (idx >= lastIdx) {
    return { doneThrough: lastIdx, activeIdx: -1 };
  }

  return { doneThrough: idx, activeIdx: idx + 1 };
}

function getStepState(
  stepIdx: number,
  progress: TimelineProgress,
): "done" | "active" | "pending" {
  if (stepIdx <= progress.doneThrough) return "done";
  if (progress.activeIdx >= 0 && stepIdx === progress.activeIdx) return "active";
  return "pending";
}

export type ProviderAppointmentDetailViewModel = {
  id: string;
  status: string;
  scheduledDate: string;
  scheduledTime: string;
  notes: string | null;
  photoUrls: string[];
  refusalReason: string | null;
  rescheduleDate: string | null;
  rescheduleTime: string | null;
  enRouteAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMinutes: number | null;
  beforePhotoUrls: string[];
  afterPhotoUrls: string[];
  cancellationReason: string | null;
  latitude: number | null;
  longitude: number | null;
  givenService: {
    serviceName: string;
    categoryName: string;
    price: number;
    pricingType: string;
    estimatedDurationMinutes: number | null;
  };
  client: { firstName: string; lastName: string; imageUrl: string | null };
};

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
  return !["REFUSED", "CANCELLED_CLIENT", "CANCELLED_PROVIDER"].includes(
    status,
  );
}

function buildMapPreviewUrl(lat: number, lng: number): string {
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=14&size=600x224&markers=${lat},${lng},red-pushpin`;
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

function clientInitials(first: string, last: string): string {
  const a = first.trim().charAt(0).toUpperCase();
  const b = last.trim().charAt(0).toUpperCase();
  if (a && b) return `${a}${b}`;
  return (a || b || "?").slice(0, 2);
}

export type ProviderAppointmentDetailViewProps = {
  navigation: NativeStackNavigationProp<
    ProviderStackParamList,
    "ProviderAppointmentDetail"
  >;
  insetsTop: number;
  insetsBottom: number;
  appointment: ProviderAppointmentDetailViewModel;
  appointmentRef: string;
  statusLabel: string;
  statusPillColor: string;
  clientName: string;
  priceLabel: string;
  isEmployee: boolean;
  actionLoading: boolean;
  statusRefreshing: boolean;
  refuseMode: boolean;
  refusalReason: string;
  refusalError: string;
  pendingSlotPassed: boolean;
  waitingClientStart: boolean;
  waitingClientEnd: boolean;
  showTimerPhase: boolean;
  elapsedSeconds: number;
  beforeLocalUris: string[];
  afterLocalUris: string[];
  maxInterventionPhotos: number;
  showCompletion: boolean;
  formatBookingDateTime: (date: string, time: string) => string;
  formatLongDate: (ymd: string | null) => string;
  formatRescheduleDetail: (
    rescheduleDate: string | null,
    rescheduleTime: string | null,
  ) => string;
  onBack: () => void;
  onAccept: () => void;
  onRefuseMode: () => void;
  onRefuseCancel: () => void;
  onRefusalReasonChange: (text: string) => void;
  onRefuseSubmit: () => void;
  onOpenReschedule: () => void;
  onMarkEnRoute: () => void;
  onCancelConfirmed: () => void;
  onStartService: () => void;
  onOpenCompletion: () => void;
  onCloseCompletion: () => void;
  onEndService: () => void;
  onPickBeforePhoto: () => void;
  onPickAfterPhoto: () => void;
  onRemoveBeforePhoto: (uri: string) => void;
  onRemoveAfterPhoto: (uri: string) => void;
};

export function ProviderAppointmentDetailView({
  navigation,
  insetsTop,
  insetsBottom,
  appointment,
  appointmentRef,
  statusLabel,
  statusPillColor,
  clientName,
  priceLabel,
  isEmployee,
  actionLoading,
  statusRefreshing,
  refuseMode,
  refusalReason,
  refusalError,
  pendingSlotPassed,
  waitingClientStart,
  waitingClientEnd,
  showTimerPhase,
  elapsedSeconds,
  beforeLocalUris,
  afterLocalUris,
  maxInterventionPhotos,
  showCompletion,
  formatBookingDateTime,
  formatLongDate,
  formatRescheduleDetail,
  onBack,
  onAccept,
  onRefuseMode,
  onRefuseCancel,
  onRefusalReasonChange,
  onRefuseSubmit,
  onOpenReschedule,
  onMarkEnRoute,
  onCancelConfirmed,
  onStartService,
  onOpenCompletion,
  onCloseCompletion,
  onEndService,
  onPickBeforePhoto,
  onPickAfterPhoto,
  onRemoveBeforePhoto,
  onRemoveAfterPhoto,
}: ProviderAppointmentDetailViewProps) {
  const scrollRef = useRef<ScrollView>(null);
  const detailsYRef = useRef(0);
  const sheetAnimation = useRef(new Animated.Value(0)).current;

  const timelineProgress = getTimelineProgress(appointment.status);
  const stepperVisible = showOrderStatusStepper(appointment.status);
  const progressIndex =
    timelineProgress.activeIdx >= 0
      ? timelineProgress.activeIdx
      : timelineProgress.doneThrough;
  const stepProgressWidth = `${(Math.max(0, progressIndex) / (ORDER_STATUS_STEPS.length - 1)) * 100}%`;

  useEffect(() => {
    Animated.timing(sheetAnimation, {
      toValue: showCompletion ? 1 : 0,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [sheetAnimation, showCompletion]);

  const progressTranslateY = sheetAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [SCREEN_HEIGHT, 0],
  });

  const initials = clientInitials(
    appointment.client.firstName,
    appointment.client.lastName,
  );

  const hasCoords =
    appointment.latitude != null && appointment.longitude != null;

  const locationLabel = hasCoords
    ? `${appointment.latitude!.toFixed(5)}, ${appointment.longitude!.toFixed(5)}`
    : "Location shared at booking";

  const openItinerary = () => {
    if (!hasCoords) return;
    navigation.navigate("ProviderItinerary", {
      clientLat: appointment.latitude!,
      clientLng: appointment.longitude!,
      clientName,
    });
  };

  const openGoogleMaps = () => {
    if (!hasCoords) return;
    void Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${appointment.latitude},${appointment.longitude}`,
    );
  };

  const openWaze = () => {
    if (!hasCoords) return;
    void Linking.openURL(
      `https://waze.com/ul?ll=${appointment.latitude}%2C${appointment.longitude}&navigate=yes`,
    );
  };

  const mainAction: MainAction = (() => {
    if (appointment.status === "CONFIRMED") {
      return {
        title: "Mark as En Route",
        icon: "arrow-forward",
        backgroundColor: "#111827",
        onPress: onMarkEnRoute,
      };
    }
    if (appointment.status === "EN_ROUTE") {
      return {
        title: "Start Service",
        icon: "play",
        backgroundColor: ACCENT,
        onPress: onStartService,
      };
    }
    if (
      appointment.status === "IN_PROGRESS" &&
      !waitingClientStart &&
      !waitingClientEnd
    ) {
      return {
        title: "Complete Job",
        icon: "checkmark",
        backgroundColor: "#10B981",
        onPress: onOpenCompletion,
      };
    }
    return null;
  })();

  const currentCard: CurrentCard = (() => {
    if (appointment.status === "CONFIRMED") {
      return {
        title: "Head to client",
        description: "Mark yourself en route to notify the customer.",
        icon: "car-outline",
      };
    }
    if (appointment.status === "EN_ROUTE") {
      return {
        title: "You have arrived",
        description: "Add before photos if needed, then start the service.",
        icon: "locate-outline",
      };
    }
    if (appointment.status === "IN_PROGRESS" && waitingClientStart) {
      return {
        title: "Awaiting client",
        description:
          "Waiting for the client to confirm the service has started.",
        icon: "hourglass-outline",
      };
    }
    if (appointment.status === "IN_PROGRESS" && waitingClientEnd) {
      return {
        title: "Awaiting confirmation",
        description: "Waiting for the client to confirm completion.",
        icon: "hourglass-outline",
      };
    }
    if (appointment.status === "IN_PROGRESS" && showTimerPhase) {
      return {
        title: "Service in Progress",
        description: "Mark as complete when finished.",
        icon: "timer-outline",
      };
    }
    if (appointment.status === "COMPLETED") {
      return {
        title: "Service Completed",
        description: "This job has been closed successfully.",
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

  const allBeforeUris = [
    ...appointment.beforePhotoUrls,
    ...beforeLocalUris,
  ];
  const allAfterUris = [...appointment.afterPhotoUrls, ...afterLocalUris];
  const referencePhotos = appointment.photoUrls;

  const scrollToDetails = () => {
    scrollRef.current?.scrollTo({
      y: Math.max(0, detailsYRef.current - 12),
      animated: true,
    });
  };

  const renderPendingBlock = () => {
    if (isEmployee || appointment.status !== "PENDING") return null;

    if (pendingSlotPassed) {
      return (
        <View style={styles.section}>
          <View style={styles.currentCard}>
            <View style={styles.currentCardHeader}>
              <View style={styles.currentCardCopy}>
                <Text style={styles.sectionTitle}>Time has passed</Text>
                <Text style={styles.sectionSubtitle}>
                  The requested slot (
                  {formatBookingDateTime(
                    appointment.scheduledDate,
                    appointment.scheduledTime,
                  )}
                  ) is in the past. Propose a new time for the client.
                </Text>
              </View>
              <View style={styles.currentIconWrap}>
                <Ionicons name="alert-circle-outline" size={18} color={ACCENT} />
              </View>
            </View>
            <TouchableOpacity
              style={[styles.primaryAction, { backgroundColor: ACCENT }]}
              onPress={onOpenReschedule}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.primaryActionText}>
                    Propose a different time
                  </Text>
                  <Ionicons name="calendar-outline" size={12} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.section}>
        <View style={styles.currentCard}>
          <View style={styles.currentCardHeader}>
            <View style={styles.currentCardCopy}>
              <Text style={styles.sectionTitle}>New booking request</Text>
              <Text style={styles.sectionSubtitle}>
                Accept to confirm or refuse with a reason.
              </Text>
            </View>
            <View style={styles.currentIconWrap}>
              <Ionicons name="mail-unread-outline" size={18} color={ACCENT} />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.primaryAction, { backgroundColor: "#10B981" }]}
            onPress={onAccept}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.primaryActionText}>Accept Appointment</Text>
                <Ionicons name="checkmark" size={12} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>

          {!refuseMode ? (
            <TouchableOpacity
              style={styles.secondaryDangerBtn}
              onPress={onRefuseMode}
              disabled={actionLoading}
            >
              <Ionicons name="close-circle-outline" size={14} color="#DC2626" />
              <Text style={styles.secondaryDangerText}>Refuse</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.refuseBox}>
              <TextInput
                style={styles.refuseInput}
                placeholder="Reason for refusal…"
                placeholderTextColor="#9CA3AF"
                value={refusalReason}
                onChangeText={onRefusalReasonChange}
                multiline
              />
              {refusalError ? (
                <Text style={styles.refuseError}>{refusalError}</Text>
              ) : null}
              <TouchableOpacity
                style={styles.secondaryDangerBtn}
                onPress={onRefuseSubmit}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#DC2626" />
                ) : (
                  <Text style={styles.secondaryDangerText}>Confirm refusal</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={onRefuseCancel} disabled={actionLoading}>
                <Text style={styles.cancelLink}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={styles.proposeLink}
            onPress={onOpenReschedule}
            disabled={actionLoading}
          >
            <Ionicons name="time-outline" size={14} color={ACCENT} />
            <Text style={styles.proposeLinkText}>Propose a different time</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderRescheduledBlock = () => {
    if (appointment.status !== "RESCHEDULED") return null;
    return (
      <View style={styles.section}>
        <View style={styles.currentCard}>
          <View style={styles.currentCardHeader}>
            <View style={styles.currentCardCopy}>
              <Text style={styles.sectionTitle}>Awaiting client response</Text>
              <Text style={styles.sectionSubtitle}>
                {formatRescheduleDetail(
                  appointment.rescheduleDate,
                  appointment.rescheduleTime,
                )}
              </Text>
            </View>
            <View style={styles.currentIconWrap}>
              <Ionicons name="calendar-outline" size={18} color={ACCENT} />
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderTerminalBlock = () => {
    if (appointment.status === "REFUSED") {
      return (
        <View style={styles.section}>
          <View style={styles.alertCard}>
            <Ionicons
              name="close-circle"
              size={16}
              color="#EF4444"
              style={styles.alertIcon}
            />
            <View style={styles.alertCopy}>
              <Text style={styles.alertTitle}>Request Refused</Text>
              {appointment.refusalReason ? (
                <Text style={styles.alertText}>{appointment.refusalReason}</Text>
              ) : null}
            </View>
          </View>
        </View>
      );
    }

    if (
      appointment.status === "CANCELLED_CLIENT" ||
      appointment.status === "CANCELLED_PROVIDER"
    ) {
      return (
        <View style={styles.section}>
          <View style={styles.alertCardNeutral}>
            <Ionicons
              name="ban-outline"
              size={16}
              color="#6B7280"
              style={styles.alertIcon}
            />
            <View style={styles.alertCopy}>
              <Text style={styles.alertTitleNeutral}>Appointment Cancelled</Text>
              <Text style={styles.alertTextNeutral}>
                {appointment.status === "CANCELLED_CLIENT"
                  ? "Cancelled by client"
                  : "Cancelled by you"}
              </Text>
              {appointment.cancellationReason ? (
                <Text style={styles.alertTextNeutral}>
                  "{appointment.cancellationReason}"
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      );
    }

    return null;
  };

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
        keyboardShouldPersistTaps="handled"
      >
        {stepperVisible ? (
          <View style={styles.stepperCard}>
            {statusRefreshing ? (
              <View style={styles.stepperLoading}>
                <ActivityIndicator size="small" color={ACCENT} />
                <Text style={styles.stepperLoadingText}>Updating status…</Text>
              </View>
            ) : (
              <>
                <View style={styles.stepLine}>
                  <View
                    style={[styles.stepLineFill, { width: stepProgressWidth }]}
                  />
                </View>
                <View style={styles.stepperRow}>
                  {ORDER_STATUS_STEPS.map((step, index) => {
                    const state = getStepState(index, timelineProgress);

                    let circleStyle = styles.stepCirclePending;
                    let iconName: keyof typeof Ionicons.glyphMap =
                      step.pendingIcon;
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
              </>
            )}
          </View>
        ) : null}

        {renderPendingBlock()}
        {renderRescheduledBlock()}
        {renderTerminalBlock()}

        {currentCard ? (
          <View style={styles.section}>
            <View style={styles.currentCard}>
              <View style={styles.decorativeGlow} />
              <View style={styles.currentCardHeader}>
                <View style={styles.currentCardCopy}>
                  <Text style={styles.sectionTitle}>{currentCard.title}</Text>
                  <Text style={styles.sectionSubtitle}>
                    {currentCard.description}
                  </Text>
                  {showTimerPhase ? (
                    <Text style={styles.timerLarge}>
                      {formatElapsed(elapsedSeconds)}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.currentIconWrap}>
                  <Ionicons
                    name={currentCard.icon}
                    size={18}
                    color={ACCENT}
                  />
                </View>
              </View>

              {mainAction ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={mainAction.onPress}
                  disabled={actionLoading}
                  style={[
                    styles.primaryAction,
                    { backgroundColor: mainAction.backgroundColor },
                    actionLoading && styles.btnDisabled,
                  ]}
                >
                  {actionLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Text style={styles.primaryActionText}>
                        {mainAction.title}
                      </Text>
                      <Ionicons
                        name={mainAction.icon}
                        size={12}
                        color="#FFFFFF"
                      />
                    </>
                  )}
                </TouchableOpacity>
              ) : null}

              {appointment.status === "CONFIRMED" && !isEmployee ? (
                <TouchableOpacity
                  onPress={onCancelConfirmed}
                  disabled={actionLoading}
                  style={styles.cancelLinkWrap}
                >
                  <Text style={styles.cancelDangerLink}>Cancel appointment</Text>
                </TouchableOpacity>
              ) : null}

              {appointment.status === "EN_ROUTE" ? (
                <View style={styles.beforePhotosInline}>
                  <Text style={styles.attachmentsLabel}>
                    Before photos (optional)
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.attachmentsRow}
                  >
                    {allBeforeUris.map((uri) => (
                      <View key={uri} style={styles.photoThumb}>
                        <Image source={{ uri }} style={styles.photoImage} />
                      </View>
                    ))}
                    <TouchableOpacity
                      style={styles.addPhotoButton}
                      onPress={onPickBeforePhoto}
                      disabled={
                        actionLoading ||
                        allBeforeUris.length >= maxInterventionPhotos
                      }
                    >
                      <Ionicons name="camera-outline" size={12} color="#9CA3AF" />
                      <Text style={styles.addPhotoText}>Add</Text>
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              ) : null}

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

        <View style={styles.section}>
          <View style={styles.infoCard}>
            <Pressable
              style={styles.mapPreview}
              onPress={hasCoords ? openItinerary : undefined}
            >
              {hasCoords ? (
                <Image
                  source={{
                    uri: buildMapPreviewUrl(
                      appointment.latitude!,
                      appointment.longitude!,
                    ),
                  }}
                  style={styles.mapImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.mapPlaceholder}>
                  <Ionicons name="map-outline" size={28} color="#9CA3AF" />
                </View>
              )}
              <View style={styles.mapOverlay} />

              {hasCoords ? (
                <View style={styles.mapButtons}>
                  <TouchableOpacity
                    style={styles.mapButton}
                    onPress={openGoogleMaps}
                  >
                    <Ionicons name="navigate-outline" size={14} color="#111827" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.mapButton} onPress={openWaze}>
                    <Ionicons name="car-outline" size={14} color="#111827" />
                  </TouchableOpacity>
                </View>
              ) : null}

              <View style={styles.mapLabel}>
                <Text style={styles.mapLabelSmall}>Service Location</Text>
                <Text style={styles.mapLabelLarge} numberOfLines={2}>
                  {locationLabel}
                </Text>
              </View>
            </Pressable>

            <View style={styles.customerRow}>
              <View style={styles.customerLeft}>
                <View style={styles.avatarWrap}>
                  {appointment.client.imageUrl ? (
                    <Image
                      source={{ uri: appointment.client.imageUrl }}
                      style={styles.avatar}
                    />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Text style={styles.avatarInitials}>{initials}</Text>
                    </View>
                  )}
                </View>
                <View>
                  <Text style={styles.customerName}>{clientName}</Text>
                  <View style={styles.customerMetaRow}>
                    <Ionicons name="person-outline" size={10} color="#6B7280" />
                    <Text style={styles.customerMetaText}>Customer</Text>
                  </View>
                </View>
              </View>

              <View style={styles.customerActions}>
                <TouchableOpacity
                  style={styles.messageButton}
                  onPress={() => navigation.navigate("ConversationList")}
                >
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={14}
                    color="#3B82F6"
                  />
                </TouchableOpacity>
                {hasCoords ? (
                  <TouchableOpacity
                    style={styles.phoneButton}
                    onPress={openItinerary}
                  >
                    <Ionicons name="navigate" size={14} color="#10B981" />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
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
                  {appointment.givenService.serviceName}
                </Text>
                <Text style={styles.detailSecondary}>
                  {appointment.givenService.categoryName}
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
                  <Text style={styles.noteBoxLabel}>Client notes</Text>
                  <Text style={styles.noteText}>{appointment.notes}</Text>
                </View>
              </>
            ) : null}

            {referencePhotos.length > 0 ? (
              <>
                <View style={styles.divider} />
                <View style={styles.attachmentsBlock}>
                  <Text style={styles.attachmentsLabel}>Client photos</Text>
                  <PhotoCarousel
                    photos={referencePhotos}
                    accessibilityLabelPrefix="Client photo"
                  />
                </View>
              </>
            ) : null}

            {(allBeforeUris.length > 0 || allAfterUris.length > 0) && (
              <>
                <View style={styles.divider} />
                <View style={styles.attachmentsBlock}>
                  <Text style={styles.attachmentsLabel}>Service Photos</Text>
                  {allBeforeUris.length > 0 ? (
                    <PhotoCarousel
                      photos={allBeforeUris}
                      groupLabel="Before"
                      accessibilityLabelPrefix="Before service photo"
                    />
                  ) : null}
                  {allAfterUris.length > 0 ? (
                    <PhotoCarousel
                      photos={allAfterUris}
                      groupLabel="After"
                      accessibilityLabelPrefix="After service photo"
                      style={
                        allBeforeUris.length > 0
                          ? styles.interventionPhotoGroupSpaced
                          : undefined
                      }
                    />
                  ) : null}
                </View>
              </>
            )}

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
      </ScrollView>

      <Modal
        visible={showCompletion}
        transparent
        animationType="none"
        onRequestClose={onCloseCompletion}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={styles.backdropTouchTarget}
            activeOpacity={1}
            onPress={onCloseCompletion}
          />

          <Animated.View
            style={[
              styles.completionDrawer,
              { transform: [{ translateY: progressTranslateY }] },
            ]}
          >
            <View style={styles.drawerHandle} />

            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              style={styles.drawerBody}
            >
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.drawerScrollContent}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.drawerHeaderBlock}>
                  <View style={styles.completedIconWrap}>
                    <Ionicons name="checkmark" size={24} color="#10B981" />
                  </View>
                  <Text style={styles.drawerTitle}>Job Completed?</Text>
                  <Text style={styles.drawerSubtitle}>
                    Add after photos if needed, then submit to close this order.
                  </Text>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>
                    Proof of Work (optional)
                  </Text>
                  <View style={styles.proofGrid}>
                    <TouchableOpacity
                      style={styles.takePhotoCard}
                      onPress={onPickAfterPhoto}
                      disabled={
                        actionLoading ||
                        afterLocalUris.length >= maxInterventionPhotos
                      }
                    >
                      <Ionicons name="camera-outline" size={20} color="#6B7280" />
                      <Text style={styles.takePhotoText}>Take Photo</Text>
                    </TouchableOpacity>

                    {afterLocalUris.map((uri) => (
                      <View key={uri} style={styles.proofThumb}>
                        <Image source={{ uri }} style={styles.photoImage} />
                        <TouchableOpacity
                          style={styles.removeProofButton}
                          onPress={() => onRemoveAfterPhoto(uri)}
                        >
                          <Ionicons name="close" size={10} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.drawerActions}>
                  <TouchableOpacity
                    style={[
                      styles.submitButton,
                      actionLoading && styles.btnDisabled,
                    ]}
                    onPress={onEndService}
                    disabled={actionLoading}
                  >
                    {actionLoading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.submitButtonText}>
                        Submit & Complete Job
                      </Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={onCloseCompletion}
                    disabled={actionLoading}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </Animated.View>
        </View>
      </Modal>
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
});
