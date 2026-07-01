import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Modal,
  PanResponder,
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
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppTranslation } from "../../../hooks/useAppTranslation";
import {
  type IncomingJobRequestData,
  clientDisplayName,
  clientInitials,
  formatJobPrice,
} from "../../../utils/incomingJobRequest";

const colors = {
  primary: "#EA580C",
  primaryDark: "#C2410C",
  secondary: "#10B981",
  background: "#F8FAFC",
  surface: "#FFFFFF",
  textMain: "#111827",
  textMuted: "#6B7280",
  textLight: "#9CA3AF",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  border: "#E5E7EB",
  gray50: "#F9FAFB",
  gray100: "#F3F4F6",
  gray200: "#E5E7EB",
  gray300: "#D1D5DB",
  infoBlue: "#3B82F6",
  emerald50: "#ECFDF5",
  emerald100: "#D1FAE5",
  emerald600: "#059669",
  orange50: "#FFF7ED",
  orange100: "#FFEDD5",
  yellow50: "#FFFBEB",
  yellow100: "#FEF3C7",
  yellow400: "#FBBF24",
  yellow800: "#92400E",
  yellow900: "#78350F",
};

export type IncomingJobRequestScreenProps = {
  visible: boolean;
  data: IncomingJobRequestData | null;
  secondsRemaining: number;
  acceptPct: number | null;
  distanceKm: number | null;
  etaMinutes: number | null;
  isSubmitting: boolean;
  onAccept: () => void;
  onDecline: (reason: string) => void;
  onViewMap: () => void;
};

export function IncomingJobRequestScreen({
  visible,
  data,
  secondsRemaining,
  acceptPct,
  distanceKm,
  etaMinutes,
  isSubmitting,
  onAccept,
  onDecline,
  onViewMap,
}: IncomingJobRequestScreenProps) {
  const { t, isRTL } = useAppTranslation();
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [declineReasonError, setDeclineReasonError] = useState("");
  const [isAccepted, setIsAccepted] = useState(false);
  const [swipeWidth, setSwipeWidth] = useState(0);

  const translateX = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(1)).current;
  const currentDrag = useRef(0);
  const handleWidth = 56;
  const maxDrag = Math.max(0, swipeWidth - handleWidth - 8);

  useEffect(() => {
    if (!visible) {
      setShowDeclineModal(false);
      setDeclineReason("");
      setDeclineReasonError("");
      setIsAccepted(false);
      translateX.setValue(0);
      textOpacity.setValue(1);
      currentDrag.current = 0;
    }
  }, [visible, translateX, textOpacity]);

  const resetSwipe = useCallback(() => {
    setIsAccepted(false);
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start();
  }, [textOpacity, translateX]);

  const completeAccept = useCallback(() => {
    if (isSubmitting) return;
    setIsAccepted(true);
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: maxDrag,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start(() => onAccept());
  }, [isSubmitting, maxDrag, onAccept, textOpacity, translateX]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !isAccepted && !isSubmitting,
        onMoveShouldSetPanResponder: () => !isAccepted && !isSubmitting,
        onPanResponderMove: (_, gestureState) => {
          if (isAccepted || isSubmitting) return;
          const next = Math.max(0, Math.min(gestureState.dx, maxDrag));
          currentDrag.current = next;
          translateX.setValue(next);
          textOpacity.setValue(1 - next / Math.max(maxDrag, 1));
        },
        onPanResponderRelease: () => {
          if (isAccepted || isSubmitting) return;
          if (currentDrag.current > maxDrag * 0.85) {
            completeAccept();
            return;
          }
          resetSwipe();
        },
      }),
    [
      completeAccept,
      isAccepted,
      isSubmitting,
      maxDrag,
      resetSwipe,
      textOpacity,
      translateX,
    ],
  );

  const handleDecline = () => {
    const reason = declineReason.trim();
    if (!reason) {
      setDeclineReasonError(t("provider.incomingRequest.declineReasonRequired"));
      return;
    }
    setShowDeclineModal(false);
    onDecline(reason);
  };

  const openDeclineModal = () => {
    setDeclineReason("");
    setDeclineReasonError("");
    setShowDeclineModal(true);
  };

  if (!data) return null;

  const clientName = clientDisplayName(data.client.firstName, data.client.lastName);
  const initials = clientInitials(data.client.firstName, data.client.lastName);
  const payout = formatJobPrice(data.price, data.pricingType);
  const addressLine =
    data.client.address?.trim() ||
    [data.client.city, data.latitude != null ? "" : ""].filter(Boolean).join(", ");
  const cityLine = data.client.city || t("provider.incomingRequest.locationUnknown");
  const durationLabel =
    data.estimatedDurationMinutes != null
      ? t("provider.incomingRequest.durationMin", {
          count: data.estimatedDurationMinutes,
        })
      : t("provider.incomingRequest.durationFlexible");
  const pricingLabel =
    data.pricingType === "HOURLY"
      ? t("provider.incomingRequest.pricingHourly")
      : t("provider.incomingRequest.pricingFixed");

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

        <View pointerEvents="none" style={styles.backgroundMap} />

        <View pointerEvents="none" style={styles.headerBackdrop}>
          <View style={styles.headerCard}>
            <View style={styles.headerRow}>
              <View style={styles.avatarPlaceholder} />
              <View style={styles.headerCopy}>
                <View style={styles.headerLineShort} />
                <View style={styles.headerLineLong} />
              </View>
              <View style={styles.headerIconPlaceholder} />
            </View>
          </View>
        </View>

        <View style={styles.overlay}>
          <View style={styles.modalShell}>
            <View style={styles.pullHandle} />

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.topSection}>
                <View style={styles.topRow}>
                  <View style={styles.badgeGroup}>
                    <View style={styles.newRequestBadge}>
                      <View style={styles.newRequestDot} />
                      <Text style={styles.newRequestText}>
                        {t("provider.incomingRequest.newRequest")}
                      </Text>
                    </View>
                    <View style={styles.instantBadge}>
                      <Ionicons name="flash" size={10} color={colors.warning} />
                      <Text style={styles.instantText}>
                        {t("provider.incomingRequest.instant")}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.timerWrap}>
                    <View style={styles.timerRipple} />
                    <View style={styles.timerRing}>
                      <View style={styles.timerInner}>
                        <Text style={styles.timerValue}>{secondsRemaining}</Text>
                        <Text style={styles.timerLabel}>
                          {t("provider.incomingRequest.sec")}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                <Text style={[styles.jobTitle, isRTL && styles.rtl]}>
                  {data.serviceName}
                </Text>
                <Text style={[styles.jobSubtitle, isRTL && styles.rtl]}>
                  {data.categoryName}
                  {data.scheduledDate && data.scheduledTime
                    ? ` · ${data.scheduledDate} ${data.scheduledTime}`
                    : ""}
                </Text>

                <View style={styles.payoutCard}>
                  <View style={styles.payoutLeft}>
                    <View style={styles.payoutIconCircle}>
                      <Ionicons name="cash-outline" size={18} color={colors.success} />
                    </View>
                    <View>
                      <Text style={styles.payoutLabel}>
                        {t("provider.incomingRequest.estimatedPayout")}
                      </Text>
                      <View style={styles.payoutRow}>
                        <Text style={styles.payoutValue}>{payout}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.commissionChip}>
                    <Text style={styles.commissionText}>{durationLabel}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.customerRow}>
                <View style={styles.customerAvatarWrap}>
                  <View style={styles.customerAvatarFrame}>
                    {data.client.imageUrl ? (
                      <Image
                        source={{ uri: data.client.imageUrl }}
                        style={styles.customerAvatar}
                      />
                    ) : (
                      <View style={styles.customerAvatarFallback}>
                        <Text style={styles.customerAvatarFallbackText}>{initials}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.ratingBadge}>
                    <Ionicons name="person" size={10} color={colors.primary} />
                  </View>
                </View>

                <View style={styles.customerMeta}>
                  <Text style={[styles.customerName, isRTL && styles.rtl]}>
                    {clientName}
                  </Text>
                  <View style={styles.customerStatsRow}>
                    <Text style={styles.statText}>{cityLine}</Text>
                  </View>
                </View>

                {distanceKm != null ? (
                  <View style={styles.distanceWrap}>
                    <Text style={styles.distanceValue}>
                      {distanceKm < 1
                        ? t("provider.incomingRequest.distanceM", {
                            count: Math.round(distanceKm * 1000),
                          })
                        : t("provider.incomingRequest.distanceKm", {
                            value: distanceKm.toFixed(1),
                          })}
                    </Text>
                    {etaMinutes != null ? (
                      <Text style={styles.distanceEta}>
                        {t("provider.incomingRequest.etaMin", { count: etaMinutes })}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </View>

              <View style={styles.divider} />

              <View style={styles.locationSection}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionLabel}>
                    {t("provider.incomingRequest.location")}
                  </Text>
                  <Pressable onPress={onViewMap} hitSlop={8}>
                    <Text style={styles.mapLink}>
                      {t("provider.incomingRequest.viewOnMap")}
                    </Text>
                  </Pressable>
                </View>

                <Pressable onPress={onViewMap} style={styles.mapCard}>
                  <View style={styles.mapPlaceholder}>
                    <View style={styles.mapGridLineA} />
                    <View style={styles.mapGridLineB} />
                  </View>
                  <View style={styles.mapOverlay} />

                  <View style={styles.mapPinWrap}>
                    <View style={styles.mapPinPulse} />
                    <View style={styles.mapPinInner}>
                      <Ionicons name="location" size={14} color={colors.primary} />
                    </View>
                  </View>

                  <View style={styles.addressChip}>
                    <Ionicons name="location-outline" size={12} color={colors.primary} />
                    <View style={styles.addressTextWrap}>
                      <Text style={styles.addressTitle} numberOfLines={1}>
                        {addressLine || cityLine}
                      </Text>
                      <Text style={styles.addressSubtitle}>{cityLine}</Text>
                    </View>
                  </View>
                </Pressable>
              </View>

              <View style={styles.gridRow}>
                <View style={styles.infoCard}>
                  <Text style={styles.infoLabel}>
                    {t("provider.incomingRequest.serviceLevel")}
                  </Text>
                  <View style={styles.infoValueRow}>
                    <Ionicons name="layers-outline" size={14} color={colors.infoBlue} />
                    <Text style={styles.infoValue}>{data.categoryName}</Text>
                  </View>
                </View>

                <View style={styles.infoCard}>
                  <Text style={styles.infoLabel}>
                    {t("provider.incomingRequest.payment")}
                  </Text>
                  <View style={styles.infoValueRow}>
                    <Ionicons name="card-outline" size={14} color={colors.textMain} />
                    <Text style={styles.infoValue}>{pricingLabel}</Text>
                  </View>
                </View>
              </View>

              {data.notes?.trim() ? (
                <View style={styles.noteCard}>
                  <Text style={styles.noteTitle}>
                    <Ionicons name="document-text-outline" size={12} color={colors.yellow800} />
                    {"  "}
                    {t("provider.incomingRequest.customerNote")}
                  </Text>
                  <Text style={[styles.noteText, isRTL && styles.rtl]}>
                    "{data.notes.trim()}"
                  </Text>
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.footer}>
              <View style={styles.declineRow}>
                <TouchableOpacity
                  activeOpacity={0.86}
                  disabled={isSubmitting}
                  onPress={openDeclineModal}
                >
                  <Text style={styles.declineText}>
                    <Ionicons name="close" size={12} color={colors.textMuted} />
                    {"  "}
                    {t("provider.incomingRequest.declineJob")}
                  </Text>
                </TouchableOpacity>
              </View>

              <View
                style={[
                  styles.swipeContainer,
                  (isAccepted || isSubmitting) && styles.swipeContainerAccepted,
                ]}
                onLayout={(event) => setSwipeWidth(event.nativeEvent.layout.width)}
              >
                <Animated.View style={[styles.swipeTextWrap, { opacity: textOpacity }]}>
                  {isAccepted || isSubmitting ? (
                    <View style={styles.acceptingRow}>
                      <ActivityIndicator color={colors.surface} size="small" />
                      <Text style={styles.swipeText}>
                        {t("provider.incomingRequest.accepting")}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.swipeText}>
                      {t("provider.incomingRequest.swipeToAccept")}
                    </Text>
                  )}
                </Animated.View>

                <Animated.View
                  {...panResponder.panHandlers}
                  style={[
                    styles.swipeHandle,
                    { transform: [{ translateX }] },
                    (isAccepted || isSubmitting) && styles.swipeHandleAccepted,
                  ]}
                >
                  <Ionicons
                    name={isAccepted || isSubmitting ? "checkmark" : "chevron-forward"}
                    size={20}
                    color={isAccepted || isSubmitting ? colors.surface : colors.primary}
                  />
                </Animated.View>
              </View>

              <Text style={styles.footerCopy}>
                {t("provider.incomingRequest.autoRejectPrefix")}{" "}
                <Text style={styles.footerCopyStrong}>{secondsRemaining}s</Text>
                {acceptPct != null ? (
                  <>
                    {" · "}
                    {t("provider.incomingRequest.acceptRate")}:{" "}
                    <Text style={styles.footerCopySuccess}>{acceptPct}%</Text>
                  </>
                ) : null}
              </Text>
            </View>
          </View>

          <View style={styles.bottomSafeSpacer} />
        </View>

        <Modal
          visible={showDeclineModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDeclineModal(false)}
        >
          <View style={styles.declineBackdropWrap}>
            <Pressable
              style={styles.declineBackdrop}
              onPress={() => setShowDeclineModal(false)}
            />

            <View style={styles.declineCard}>
              <View style={styles.pullHandle} />
              <Text style={styles.declineTitle}>
                {t("provider.incomingRequest.declineTitle")}
              </Text>
              <Text style={styles.declineDescription}>
                {t("provider.incomingRequest.declineDescription")}
              </Text>

              <Text style={styles.declineInputLabel}>
                {t("provider.incomingRequest.declineReasonLabel")}
              </Text>
              <TextInput
                style={[styles.declineInput, isRTL && styles.rtlInput]}
                placeholder={t("provider.incomingRequest.declineReasonPlaceholder")}
                placeholderTextColor={colors.textLight}
                value={declineReason}
                onChangeText={(text) => {
                  setDeclineReason(text);
                  if (declineReasonError) setDeclineReasonError("");
                }}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={500}
                editable={!isSubmitting}
              />
              {declineReasonError ? (
                <Text style={styles.declineInputError}>{declineReasonError}</Text>
              ) : null}

              <View style={styles.declineActionRow}>
                <Pressable
                  onPress={() => setShowDeclineModal(false)}
                  style={styles.cancelButton}
                >
                  <Text style={styles.cancelButtonText}>{t("common.cancel")}</Text>
                </Pressable>
                <Pressable
                  onPress={handleDecline}
                  disabled={isSubmitting}
                  style={[
                    styles.confirmButton,
                    isSubmitting && styles.confirmButtonDisabled,
                  ]}
                >
                  <Text style={styles.confirmButtonText}>
                    {t("provider.incomingRequest.confirmDecline")}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
}

export default IncomingJobRequestScreen;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  backgroundMap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#E2E8F0",
    opacity: 0.35,
  },
  headerBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 12,
    paddingHorizontal: 24,
    opacity: 0.35,
  },
  headerCard: {
    backgroundColor: "rgba(255,255,255,0.82)",
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 24,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: colors.gray200,
  },
  headerCopy: { flex: 1, marginHorizontal: 12, gap: 6 },
  headerLineShort: {
    width: 80,
    height: 12,
    borderRadius: 8,
    backgroundColor: colors.gray200,
  },
  headerLineLong: {
    width: 120,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.gray300,
  },
  headerIconPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: colors.gray200,
  },
  overlay: { flex: 1, justifyContent: "flex-end", alignItems: "center" },
  modalShell: {
    width: "100%",
    maxWidth: 420,
    flex: 1,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -10 },
    elevation: 18,
    overflow: "hidden",
  },
  pullHandle: {
    alignSelf: "center",
    width: 48,
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.gray200,
    marginTop: 12,
    marginBottom: 8,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 24 },
  topSection: { paddingTop: 12, paddingBottom: 20, gap: 12 },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  badgeGroup: { flex: 1, gap: 8 },
  newRequestBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.orange50,
    borderWidth: 1,
    borderColor: colors.orange100,
  },
  newRequestDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  newRequestText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  instantBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.gray100,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  instantText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  timerWrap: {
    width: 68,
    height: 68,
    alignItems: "center",
    justifyContent: "center",
  },
  timerRipple: {
    position: "absolute",
    width: 68,
    height: 68,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(234, 88, 12, 0.35)",
  },
  timerRing: {
    width: 64,
    height: 64,
    borderRadius: 999,
    borderWidth: 4,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  timerInner: { alignItems: "center", justifyContent: "center" },
  timerValue: {
    color: colors.textMain,
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 20,
  },
  timerLabel: {
    color: colors.textMuted,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginTop: 2,
  },
  jobTitle: {
    color: colors.textMain,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "900",
  },
  jobSubtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  payoutCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 20,
    padding: 16,
    backgroundColor: colors.emerald50,
    borderWidth: 1,
    borderColor: colors.emerald100,
  },
  payoutLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  payoutIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.emerald100,
  },
  payoutLabel: {
    color: colors.emerald600,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  payoutRow: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  payoutValue: { color: colors.textMain, fontSize: 20, fontWeight: "900" },
  commissionChip: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.gray100,
  },
  commissionText: { color: colors.textMuted, fontSize: 10, fontWeight: "600" },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.gray100,
    marginVertical: 8,
  },
  customerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 8,
  },
  customerAvatarWrap: { width: 56, height: 56, justifyContent: "center" },
  customerAvatarFrame: {
    width: 56,
    height: 56,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.gray100,
    backgroundColor: colors.gray100,
  },
  customerAvatar: { width: "100%", height: "100%" },
  customerAvatarFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.orange50,
  },
  customerAvatarFallbackText: {
    color: colors.primaryDark,
    fontSize: 18,
    fontWeight: "800",
  },
  ratingBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.gray50,
  },
  customerMeta: { flex: 1, gap: 4 },
  customerName: { color: colors.textMain, fontSize: 18, fontWeight: "800" },
  customerStatsRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  statText: { color: colors.textMuted, fontSize: 13, fontWeight: "500" },
  distanceWrap: { alignItems: "flex-end" },
  distanceValue: { color: colors.textMain, fontSize: 18, fontWeight: "800" },
  distanceEta: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.gray100,
  },
  locationSection: { gap: 8 },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  mapLink: { color: colors.primary, fontSize: 11, fontWeight: "800" },
  mapCard: {
    height: 128,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  mapPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#CBD5E1",
  },
  mapGridLineA: {
    position: "absolute",
    top: "30%",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  mapGridLineB: {
    position: "absolute",
    left: "40%",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  mapOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.22)" },
  mapPinWrap: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -16,
    marginTop: -16,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  mapPinPulse: {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 999,
    backgroundColor: colors.primary,
    opacity: 0.35,
  },
  mapPinInner: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  addressChip: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 10,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.65)",
  },
  addressTextWrap: { flex: 1 },
  addressTitle: { color: colors.textMain, fontSize: 12, fontWeight: "800" },
  addressSubtitle: { marginTop: 2, color: colors.textMuted, fontSize: 10 },
  gridRow: { flexDirection: "row", gap: 12, marginTop: 12 },
  infoCard: {
    flex: 1,
    backgroundColor: colors.gray50,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.gray100,
  },
  infoLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  infoValueRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  infoValue: { color: colors.textMain, fontSize: 13, fontWeight: "700", flex: 1 },
  noteCard: {
    marginTop: 12,
    backgroundColor: colors.yellow50,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.yellow100,
    borderLeftWidth: 4,
    borderLeftColor: colors.yellow400,
  },
  noteTitle: {
    color: colors.yellow800,
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 6,
  },
  noteText: {
    color: colors.yellow900,
    fontSize: 12,
    lineHeight: 18,
    fontStyle: "italic",
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
    backgroundColor: colors.surface,
  },
  declineRow: { alignItems: "center", marginBottom: 14 },
  declineText: { color: colors.textMuted, fontSize: 12, fontWeight: "800" },
  swipeContainer: {
    position: "relative",
    height: 64,
    borderRadius: 999,
    backgroundColor: colors.primary,
    overflow: "hidden",
    justifyContent: "center",
    padding: 4,
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  swipeContainerAccepted: {
    backgroundColor: colors.secondary,
    shadowColor: colors.secondary,
  },
  swipeTextWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  swipeText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  acceptingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  swipeHandle: {
    width: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  swipeHandleAccepted: { backgroundColor: colors.secondary },
  footerCopy: {
    marginTop: 12,
    textAlign: "center",
    color: colors.textLight,
    fontSize: 10,
  },
  footerCopyStrong: { color: colors.textMuted, fontWeight: "800" },
  footerCopySuccess: { color: colors.success, fontWeight: "800" },
  bottomSafeSpacer: { height: 24, backgroundColor: colors.surface },
  declineBackdropWrap: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  declineBackdrop: { ...StyleSheet.absoluteFillObject },
  declineCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 8,
  },
  declineTitle: {
    color: colors.textMain,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
  },
  declineDescription: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  declineInputLabel: {
    color: colors.textMain,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },
  declineInput: {
    minHeight: 112,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: colors.gray50,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMain,
    marginBottom: 8,
  },
  rtlInput: {
    textAlign: "right",
    writingDirection: "rtl",
  },
  declineInputError: {
    color: colors.error,
    fontSize: 12,
    marginBottom: 16,
  },
  declineActionRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.gray100,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
  cancelButtonText: { color: colors.textMain, fontSize: 14, fontWeight: "800" },
  confirmButton: {
    flex: 1,
    backgroundColor: colors.textMain,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
  confirmButtonDisabled: { opacity: 0.45 },
  confirmButtonText: { color: colors.surface, fontSize: 14, fontWeight: "800" },
  rtl: { textAlign: "right", writingDirection: "rtl" },
});
