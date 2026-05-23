import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { isAxiosError } from "axios";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import type { ClientStackParamList } from "../../../navigation/types";
import { COLORS } from "../../../constants";
import { api } from "../../../services/api";
import { useAppTranslation } from "../../../hooks/useAppTranslation";

type Props = NativeStackScreenProps<ClientStackParamList, "ClientLeaveReview">;

const STAR_GOLD = "#fbbf24";
const STAR_EMPTY = "#e2e8f0";
const MAX_FEEDBACK_LENGTH = 200;

const TAGS_HIGH: string[] = [
  "Professional",
  "On time",
  "Quality work",
  "Would hire again",
  "Clean workspace",
];

const TAGS_LOW: string[] = [
  "Late arrival",
  "Poor quality",
  "Unprofessional",
  "Different than expected",
];

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

function ratingLabelMeta(
  r: number,
): { text: string; color: string } | null {
  switch (r) {
    case 1:
      return { text: "Very bad", color: "#DC2626" };
    case 2:
      return { text: "Bad", color: "#EA580C" };
    case 3:
      return { text: "Okay", color: "#D97706" };
    case 4:
      return { text: "Good", color: "#2563EB" };
    case 5:
      return { text: "Excellent!", color: "#16A34A" };
    default:
      return null;
  }
}

function firstNameFromFull(name: string): string {
  const part = name.trim().split(/\s+/)[0];
  return part || name.trim() || "your provider";
}

export const ClientLeaveReviewScreen: React.FC<Props> = ({
  route,
  navigation,
}) => {
  const { t } = useAppTranslation();
  const insets = useSafeAreaInsets();
  const { appointmentId, providerName, serviceName, providerPhoto } =
    route.params;

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [canReview, setCanReview] = useState(false);
  const [existingRating, setExistingRating] = useState<number | null>(null);
  const [existingComment, setExistingComment] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [platformRating, setPlatformRating] = useState<"up" | "down" | null>(
    null,
  );
  const [successVisible, setSuccessVisible] = useState(false);

  const starScales = useRef<Record<number, Animated.Value>>({
    1: new Animated.Value(1),
    2: new Animated.Value(1),
    3: new Animated.Value(1),
    4: new Animated.Value(1),
    5: new Animated.Value(1),
  }).current;

  const orderRef = useMemo(
    () => `#${appointmentId.replace(/-/g, "").slice(0, 8).toUpperCase()}`,
    [appointmentId],
  );

  const animateStar = useCallback(
    (index: number) => {
      const s = starScales[index];
      if (!s) return;
      s.setValue(1);
      Animated.sequence([
        Animated.spring(s, {
          toValue: 0.85,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.spring(s, {
          toValue: 1.1,
          friction: 5,
          useNativeDriver: true,
        }),
        Animated.spring(s, {
          toValue: 1,
          friction: 6,
          useNativeDriver: true,
        }),
      ]).start();
    },
    [starScales],
  );

  const loadEligibility = useCallback(async () => {
    setChecking(true);
    try {
      const { data } = await api.checkCanReview(appointmentId);
      setAlreadyReviewed(!!data.alreadyReviewed);
      setCanReview(!!data.canReview);
      const er = data.existingRating;
      setExistingRating(typeof er === "number" ? er : null);
      const ec = data.existingComment;
      setExistingComment(typeof ec === "string" && ec.trim() ? ec.trim() : null);
    } catch {
      Alert.alert("Error", "Could not verify review eligibility.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } finally {
      setChecking(false);
    }
  }, [appointmentId, navigation]);

  useEffect(() => {
    void loadEligibility();
  }, [loadEligibility]);

  useEffect(() => {
    if (!successVisible) return;
    const id = setTimeout(() => {
      setSuccessVisible(false);
      navigation.goBack();
    }, 1500);
    return () => clearTimeout(id);
  }, [successVisible, navigation]);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const suggestionTags = useMemo(() => {
    if (rating >= 4) return TAGS_HIGH;
    if (rating >= 1 && rating <= 3) return TAGS_LOW;
    return [];
  }, [rating]);

  const feedbackCount = useMemo(() => comment.length, [comment]);

  const onPressStar = useCallback(
    (value: number) => {
      animateStar(value);
      setRating(value);
    },
    [animateStar],
  );

  const toggleTag = useCallback((tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) return;

    setSelectedTags((prev) => {
      if (prev.includes(trimmed)) {
        return prev.filter((t) => t !== trimmed);
      }
      setComment((c) => {
        const next = c.trim();
        if (!next) return trimmed;
        if (next.includes(trimmed)) return next;
        return `${next}, ${trimmed}`;
      });
      return [...prev, trimmed];
    });
  }, []);

  const onSubmit = useCallback(async () => {
    if (rating < 1 || rating > 5) return;
    setSubmitting(true);
    try {
      await api.createReview({
        appointmentId,
        rating,
        comment: comment.trim() || undefined,
      });
      setSuccessVisible(true);
    } catch (e) {
      if (isAxiosError(e) && e.response?.status === 409) {
        Alert.alert(
          "Already reviewed",
          "You have already reviewed this appointment",
        );
        await loadEligibility();
        return;
      }
      Alert.alert("Something went wrong", "Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [appointmentId, comment, rating, loadEligibility]);

  const labelMeta = ratingLabelMeta(rating);
  const existingLabelMeta = useMemo(
    () =>
      existingRating != null ? ratingLabelMeta(existingRating) : null,
    [existingRating],
  );
  const initials = useMemo(
    () => initialsFromName(providerName),
    [providerName],
  );
  const providerFirstName = useMemo(
    () => firstNameFromFull(providerName),
    [providerName],
  );

  const handleReportIssue = useCallback(() => {
    navigation.navigate("ClientFileComplaint", {
      appointmentId,
      providerName,
      serviceName,
    });
  }, [appointmentId, navigation, providerName, serviceName]);

  if (checking) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </SafeAreaView>
    );
  }

  const showReadOnly = alreadyReviewed;
  const showForm = canReview && !alreadyReviewed;
  const showBlocked = !canReview && !alreadyReviewed;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
          >
            <Ionicons name="arrow-back" size={18} color="#0f172a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {t("client.screenTitles.ClientLeaveReview")}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 16) + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.banner}>
            <View style={styles.bannerCircleLarge} />
            <View style={styles.bannerCircleSmall} />
            <View style={styles.bannerContent}>
              <View style={styles.bannerIconWrap}>
                <Ionicons name="checkmark" size={26} color="#10b981" />
              </View>
              <Text style={styles.bannerTitle}>Service Completed!</Text>
              <Text style={styles.bannerSubTitle}>
                {orderRef} — {serviceName}
              </Text>
            </View>
          </View>

          <View style={styles.contentWrap}>
            <View style={styles.cardFloating}>
              <View style={styles.providerWrap}>
                <View style={styles.providerAvatarWrap}>
                  {providerPhoto ? (
                    <Image
                      source={{ uri: providerPhoto }}
                      style={styles.providerAvatar}
                      accessibilityIgnoresInvertColors
                    />
                  ) : (
                    <View
                      style={[
                        styles.providerAvatar,
                        styles.providerAvatarPlaceholder,
                      ]}
                    >
                      <Text style={styles.providerAvatarInitials}>
                        {initials}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.providerName}>{providerName}</Text>
                <Text style={styles.providerMeta}>{serviceName}</Text>
              </View>

              {showReadOnly ? (
                <View style={styles.existingReviewBlock}>
                  <Text style={styles.stateBlockTitle}>
                    You have already reviewed this appointment
                  </Text>
                  <View style={styles.ratingSection}>
                    <Text style={styles.sectionLabel}>Your rating</Text>
                    <View style={styles.readOnlyStars}>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Ionicons
                          key={i}
                          name={
                            existingRating != null && i <= existingRating
                              ? "star"
                              : "star-outline"
                          }
                          size={28}
                          color={
                            existingRating != null && i <= existingRating
                              ? STAR_GOLD
                              : STAR_EMPTY
                          }
                        />
                      ))}
                    </View>
                    {existingRating != null ? (
                      <Text style={styles.existingRatingValue}>
                        {existingRating}
                        <Text style={styles.existingRatingOutOf}> / 5</Text>
                        {existingLabelMeta ? (
                          <Text
                            style={[
                              styles.existingRatingLabel,
                              { color: existingLabelMeta.color },
                            ]}
                          >
                            {" "}
                            · {existingLabelMeta.text}
                          </Text>
                        ) : null}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.existingCommentLabel}>
                    Your feedback
                  </Text>
                  <View style={styles.existingCommentBox}>
                    <Text style={styles.existingCommentText}>
                      {existingComment ?? "No written feedback."}
                    </Text>
                  </View>
                </View>
              ) : null}

              {showBlocked ? (
                <View style={styles.stateBlock}>
                  <Text style={styles.stateBlockTitle}>
                    {"You can't leave a review for this appointment"}
                  </Text>
                  <Text style={styles.stateBlockHint}>
                    Reviews are only available for your own completed
                    appointments.
                  </Text>
                </View>
              ) : null}

              {showForm ? (
                <>
                  <View style={styles.ratingSection}>
                    <Text style={styles.sectionLabel}>
                      {`How was ${providerFirstName}'s service?`}
                    </Text>
                    <View style={styles.ratingRow}>
                      {[1, 2, 3, 4, 5].map((value) => (
                        <TouchableOpacity
                          key={value}
                          onPress={() => onPressStar(value)}
                          activeOpacity={0.8}
                          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                          accessibilityRole="button"
                          accessibilityLabel={`${value} stars`}
                        >
                          <Animated.View
                            style={{
                              transform: [{ scale: starScales[value]! }],
                            }}
                          >
                            <Ionicons
                              name={rating >= value ? "star" : "star-outline"}
                              size={28}
                              color={rating >= value ? STAR_GOLD : STAR_EMPTY}
                            />
                          </Animated.View>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {labelMeta ? (
                      <Text
                        style={[
                          styles.ratingLabelText,
                          { color: labelMeta.color },
                        ]}
                      >
                        {labelMeta.text}
                      </Text>
                    ) : (
                      <Text style={styles.ratingHintText}>
                        Tap a star to rate
                      </Text>
                    )}
                  </View>

                  {suggestionTags.length > 0 ? (
                    <View style={styles.tagsSection}>
                      <Text style={styles.tagsTitle}>
                        {rating >= 4 ? "What went well?" : "What could improve?"}
                      </Text>
                      <View style={styles.tagsRow}>
                        {suggestionTags.map((tag) => {
                          const isSelected = selectedTags.includes(tag);
                          return (
                            <TouchableOpacity
                              key={tag}
                              onPress={() => toggleTag(tag)}
                              style={[
                                styles.tagChip,
                                isSelected && styles.tagChipActive,
                              ]}
                              activeOpacity={0.9}
                            >
                              <Text
                                style={[
                                  styles.tagText,
                                  isSelected && styles.tagTextActive,
                                ]}
                              >
                                {tag}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  ) : null}

                  <View style={styles.feedbackWrap}>
                    <TextInput
                      value={comment}
                      onChangeText={setComment}
                      placeholder="Write your feedback here... (Optional)"
                      placeholderTextColor="#94a3b8"
                      style={styles.feedbackInput}
                      multiline
                      maxLength={MAX_FEEDBACK_LENGTH}
                      textAlignVertical="top"
                    />
                    <Text style={styles.feedbackCount}>
                      {feedbackCount}/{MAX_FEEDBACK_LENGTH}
                    </Text>
                  </View>
                </>
              ) : null}
            </View>

            {showForm ? (
              <>
                <View style={styles.cardCompact}>
                  <View style={styles.platformLeft}>
                    <View style={styles.platformIconWrap}>
                      <Ionicons name="business" size={16} color="#4f46e5" />
                    </View>
                    <View>
                      <Text style={styles.platformTitle}>ServeMe Platform</Text>
                      <Text style={styles.platformMeta}>
                        Rate your app experience
                      </Text>
                    </View>
                  </View>
                  <View style={styles.platformActions}>
                    <TouchableOpacity
                      onPress={() => setPlatformRating("up")}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel="Thumbs up"
                    >
                      <Ionicons
                        name={
                          platformRating === "up"
                            ? "thumbs-up"
                            : "thumbs-up-outline"
                        }
                        size={24}
                        color={platformRating === "up" ? "#22c55e" : "#cbd5e1"}
                      />
                    </TouchableOpacity>
                    <View style={styles.platformDivider} />
                    <TouchableOpacity
                      onPress={() => setPlatformRating("down")}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel="Thumbs down"
                    >
                      <Ionicons
                        name={
                          platformRating === "down"
                            ? "thumbs-down"
                            : "thumbs-down-outline"
                        }
                        size={24}
                        color={
                          platformRating === "down" ? "#ef4444" : "#cbd5e1"
                        }
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.actionsWrap}>
                  <TouchableOpacity
                    style={[
                      styles.primaryButton,
                      (rating === 0 || submitting) && styles.primaryButtonDisabled,
                    ]}
                    onPress={() => void onSubmit()}
                    disabled={rating === 0 || submitting}
                    activeOpacity={0.9}
                  >
                    {submitting ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <>
                        <Text style={styles.primaryButtonText}>
                          Submit Review
                        </Text>
                        <Ionicons
                          name="arrow-forward"
                          size={14}
                          color="#ffffff"
                        />
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    activeOpacity={0.7}
                    disabled={submitting}
                  >
                    <Text style={styles.secondaryButtonText}>Skip Feedback</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.footerActions}>
                  <TouchableOpacity
                    style={styles.footerButton}
                    activeOpacity={0.7}
                    onPress={handleReportIssue}
                  >
                    <Ionicons
                      name="alert-circle-outline"
                      size={14}
                      color="#94a3b8"
                    />
                    <Text style={styles.footerText}>Report Issue</Text>
                  </TouchableOpacity>
                  <View style={styles.footerDivider} />
                  <TouchableOpacity
                    style={styles.footerButton}
                    activeOpacity={0.7}
                    onPress={() =>
                      Alert.alert(
                        "Not available",
                        "Blocking a provider is not available yet.",
                      )
                    }
                  >
                    <Ionicons name="ban-outline" size={14} color="#94a3b8" />
                    <Text style={styles.footerText}>Block Provider</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={successVisible} transparent animationType="fade">
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <Text style={styles.successEmoji}>⭐</Text>
            <Text style={styles.successTitle}>
              Thank you for your review! ⭐
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f1f5f9",
  },
  flex: { flex: 1 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 12,
    paddingTop: 4,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(226,232,240,0.8)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  headerSpacer: {
    width: 40,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  banner: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    position: "relative",
    overflow: "hidden",
  },
  bannerCircleLarge: {
    position: "absolute",
    top: -64,
    right: -64,
    width: 220,
    height: 220,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 110,
  },
  bannerCircleSmall: {
    position: "absolute",
    bottom: -48,
    left: -40,
    width: 130,
    height: 130,
    backgroundColor: "rgba(37,99,235,0.25)",
    borderRadius: 65,
  },
  bannerContent: {
    alignItems: "center",
  },
  bannerIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#1e1b4b",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
    elevation: 4,
  },
  bannerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 4,
  },
  bannerSubTitle: {
    fontSize: 12,
    color: "#dbeafe",
    textAlign: "center",
  },
  contentWrap: {
    paddingHorizontal: 24,
    marginTop: -32,
  },
  cardFloating: {
    backgroundColor: "#ffffff",
    borderRadius: 32,
    padding: 24,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 24,
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 22,
    elevation: 4,
  },
  providerWrap: {
    alignItems: "center",
    marginTop: -36,
    marginBottom: 12,
  },
  providerAvatarWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  providerAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: "#ffffff",
    backgroundColor: "#eef2ff",
  },
  providerAvatarPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  providerAvatarInitials: {
    fontSize: 24,
    fontWeight: "800",
    color: "#4f46e5",
  },
  providerName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    marginTop: 12,
    textAlign: "center",
  },
  providerMeta: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
    textAlign: "center",
  },
  stateBlock: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  existingReviewBlock: {
    marginTop: 8,
    width: "100%",
  },
  stateBlockTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    textAlign: "center",
    marginBottom: 16,
  },
  stateBlockHint: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 19,
  },
  readOnlyStars: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  existingRatingValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
    marginTop: 4,
  },
  existingRatingOutOf: {
    fontSize: 14,
    fontWeight: "600",
    color: "#94a3b8",
  },
  existingRatingLabel: {
    fontSize: 14,
    fontWeight: "700",
  },
  existingCommentLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  existingCommentBox: {
    minHeight: 72,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    padding: 16,
  },
  existingCommentText: {
    fontSize: 13,
    color: "#334155",
    lineHeight: 20,
  },
  ratingSection: {
    alignItems: "center",
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 12,
    textAlign: "center",
  },
  ratingRow: {
    flexDirection: "row",
    gap: 12,
  },
  ratingLabelText: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: "700",
  },
  ratingHintText: {
    marginTop: 10,
    fontSize: 13,
    color: "#94a3b8",
  },
  tagsSection: {
    marginBottom: 24,
  },
  tagsTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    textAlign: "center",
    marginBottom: 12,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  tagChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  tagChipActive: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a",
  },
  tagText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
  },
  tagTextActive: {
    color: "#ffffff",
  },
  feedbackWrap: {
    position: "relative",
  },
  feedbackInput: {
    minHeight: 96,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    padding: 16,
    fontSize: 13,
    color: "#334155",
    paddingBottom: 28,
  },
  feedbackCount: {
    position: "absolute",
    right: 12,
    bottom: 12,
    fontSize: 10,
    color: "#94a3b8",
    fontWeight: "600",
  },
  cardCompact: {
    backgroundColor: "#ffffff",
    borderRadius: 28,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#0f172a",
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 2,
  },
  platformLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  platformIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
  },
  platformTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  platformMeta: {
    fontSize: 10,
    color: "#94a3b8",
  },
  platformActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  platformDivider: {
    width: 8,
  },
  actionsWrap: {
    gap: 12,
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: "#0f172a",
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    shadowColor: "#0f172a",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 16,
    elevation: 4,
  },
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
  },
  secondaryButtonText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
    textAlign: "center",
  },
  footerActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingBottom: 8,
  },
  footerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  footerText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94a3b8",
  },
  footerDivider: {
    width: 1,
    height: 14,
    backgroundColor: "#e2e8f0",
  },
  successOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
    paddingBottom: 48,
  },
  successCard: {
    marginHorizontal: 20,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  successEmoji: { fontSize: 36, marginBottom: 8 },
  successTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.text.primary,
    textAlign: "center",
  },
});
