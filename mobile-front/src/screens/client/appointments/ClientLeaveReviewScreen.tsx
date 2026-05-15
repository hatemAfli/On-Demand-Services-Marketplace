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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ClientStackParamList } from "../../../navigation/types";
import { COLORS } from "../../../constants";
import { api } from "../../../services/api";
import { useAppTranslation } from "../../../hooks/useAppTranslation";

type Props = NativeStackScreenProps<ClientStackParamList, "ClientLeaveReview">;

const STAR_GOLD = "#F59E0B";
const STAR_EMPTY = "#D1D5DB";

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
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [successVisible, setSuccessVisible] = useState(false);

  const starScales = useRef<Record<number, Animated.Value>>({
    1: new Animated.Value(1),
    2: new Animated.Value(1),
    3: new Animated.Value(1),
    4: new Animated.Value(1),
    5: new Animated.Value(1),
  }).current;

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
    navigation.setOptions({
      title: t("client.screenTitles.ClientLeaveReview"),
      headerStyle: { backgroundColor: COLORS.white },
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBack}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color={COLORS.text.primary}
          />
        </TouchableOpacity>
      ),
    });
  }, [navigation, t]);

  const suggestionTags = useMemo(() => {
    if (rating >= 4) return TAGS_HIGH;
    if (rating >= 1 && rating <= 3) return TAGS_LOW;
    return [];
  }, [rating]);

  const onPressStar = useCallback(
    (value: number) => {
      animateStar(value);
      setRating(value);
    },
    [animateStar],
  );

  const onChipPress = useCallback((tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) return;

    setSelectedTags((prev) => {
      if (prev.includes(trimmed)) return prev;
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
  const initials = useMemo(
    () => initialsFromName(providerName),
    [providerName],
  );

  if (checking) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const showReadOnly = alreadyReviewed;
  const showForm = canReview && !alreadyReviewed;
  const showBlocked = !canReview && !alreadyReviewed;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, 16) + 24,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.recapCard}>
          {providerPhoto ? (
            <Image
              source={{ uri: providerPhoto }}
              style={styles.avatar}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
          )}
          <View style={styles.recapTextCol}>
            <Text style={styles.providerName}>{providerName}</Text>
            <Text style={styles.serviceName}>{serviceName}</Text>
            <Text style={styles.experiencePrompt}>How was your experience?</Text>
          </View>
        </View>

        {showReadOnly ? (
          <View style={styles.blockCard}>
            <Text style={styles.blockTitle}>
              You have already reviewed this appointment
            </Text>
            <View style={styles.readOnlyStars}>
              {[1, 2, 3, 4, 5].map((i) => (
                <Ionicons
                  key={i}
                  name={
                    existingRating != null && i <= existingRating
                      ? "star"
                      : "star-outline"
                  }
                  size={40}
                  color={
                    existingRating != null && i <= existingRating
                      ? STAR_GOLD
                      : STAR_EMPTY
                  }
                />
              ))}
            </View>
          </View>
        ) : null}

        {showBlocked ? (
          <View style={styles.blockCard}>
            <Text style={styles.blockTitle}>
              {"You can't leave a review for this appointment"}
            </Text>
            <Text style={styles.blockHint}>
              Reviews are only available for your own completed appointments.
            </Text>
          </View>
        ) : null}

        {showForm ? (
          <>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => onPressStar(i)}
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                  accessibilityRole="button"
                  accessibilityLabel={`${i} stars`}
                >
                  <Animated.View style={{ transform: [{ scale: starScales[i]! }] }}>
                    <Ionicons
                      name={i <= rating ? "star" : "star-outline"}
                      size={44}
                      color={i <= rating ? STAR_GOLD : STAR_EMPTY}
                    />
                  </Animated.View>
                </TouchableOpacity>
              ))}
            </View>

            {labelMeta ? (
              <Text style={[styles.ratingLabel, { color: labelMeta.color }]}>
                {labelMeta.text}
              </Text>
            ) : (
              <Text style={styles.ratingHint}>Tap a star to rate</Text>
            )}

            <Text style={styles.sectionLabel}>Comment (optional)</Text>
            <View style={styles.inputCard}>
              <TextInput
                style={styles.input}
                placeholder="Tell others about your experience (optional)"
                placeholderTextColor={COLORS.gray[400]}
                multiline
                maxLength={1000}
                value={comment}
                onChangeText={setComment}
                textAlignVertical="top"
              />
              <Text style={styles.counter}>
                {comment.length}/1000
              </Text>
            </View>

            {suggestionTags.length > 0 ? (
              <View style={styles.tagsSection}>
                <Text style={styles.sectionLabel}>Quick tags</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.tagsRow}
                >
                  {suggestionTags.map((tag) => {
                    const selected = selectedTags.includes(tag);
                    return (
                      <TouchableOpacity
                        key={tag}
                        style={[
                          styles.chip,
                          selected && styles.chipSelected,
                        ]}
                        onPress={() => onChipPress(tag)}
                        activeOpacity={0.85}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            selected && styles.chipTextSelected,
                          ]}
                        >
                          {tag}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

            <TouchableOpacity
              style={[
                styles.submitBtn,
                (rating === 0 || submitting) && styles.submitBtnDisabled,
              ]}
              onPress={() => void onSubmit()}
              disabled={rating === 0 || submitting}
              activeOpacity={0.9}
            >
              {submitting ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.submitBtnText}>Submit review</Text>
              )}
            </TouchableOpacity>
          </>
        ) : null}
      </ScrollView>

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
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.white },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.white,
  },
  scrollContent: { paddingHorizontal: 20 },
  headerBack: { marginLeft: 4, padding: 4 },
  recapCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.gray[50],
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 24,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginRight: 14,
  },
  avatarPlaceholder: {
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.primaryDark,
  },
  recapTextCol: { flex: 1 },
  providerName: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.text.primary,
  },
  serviceName: {
    marginTop: 4,
    fontSize: 14,
    color: COLORS.text.secondary,
  },
  experiencePrompt: {
    marginTop: 10,
    fontSize: 14,
    color: COLORS.text.tertiary,
  },
  starsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  ratingLabel: {
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 20,
  },
  ratingHint: {
    textAlign: "center",
    fontSize: 15,
    color: COLORS.gray[400],
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text.secondary,
    marginBottom: 8,
  },
  inputCard: {
    position: "relative",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    backgroundColor: COLORS.gray[50],
    padding: 12,
    minHeight: 120,
    marginBottom: 20,
  },
  input: {
    fontSize: 15,
    color: COLORS.text.primary,
    minHeight: 88,
    paddingBottom: 22,
  },
  counter: {
    position: "absolute",
    right: 12,
    bottom: 10,
    fontSize: 12,
    color: COLORS.text.tertiary,
  },
  tagsSection: { marginBottom: 8 },
  tagsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  chipSelected: {
    borderColor: COLORS.primary,
    backgroundColor: "rgba(79, 70, 229, 0.12)",
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text.secondary,
  },
  chipTextSelected: {
    color: COLORS.primaryDark,
  },
  submitBtn: {
    marginTop: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnDisabled: {
    backgroundColor: COLORS.gray[300],
  },
  submitBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "700",
  },
  blockCard: {
    backgroundColor: COLORS.gray[50],
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  blockTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text.primary,
    marginBottom: 12,
  },
  blockHint: {
    fontSize: 14,
    color: COLORS.text.secondary,
    lineHeight: 20,
  },
  readOnlyStars: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
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
