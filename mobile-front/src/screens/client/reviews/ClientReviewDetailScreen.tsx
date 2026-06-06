import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { isAxiosError } from "axios";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ClientStackParamList } from "../../../navigation/types";
import { api, type ClientReviewListItem } from "../../../services/api";
import { useAppTranslation } from "../../../hooks/useAppTranslation";
import { ConfirmModal } from "../../../components/common";
import {
  formatBookingLine,
  formatReviewDate,
  initialsFromName,
  parseClientReviewRow,
} from "./reviewUi";

type Props = NativeStackScreenProps<ClientStackParamList, "ClientReviewDetail">;

const STAR_GOLD = "#F59E0B";
const STAR_EMPTY = "#D1D5DB";
const MAX_COMMENT = 1000;
const BRAND = "#EA580C";
const BRAND_LIGHT = "#FFF7ED";
const BRAND_MID = "#FFEDD5";
const BRAND_DARK = "#C2410C";
const SUCCESS = "#059669";
const DANGER = "#DC2626";
const DANGER_BG = "#FEF2F2";
const DANGER_BORDER = "#FECACA";

function extractErrorMessage(err: unknown): string {
  if (isAxiosError(err)) {
    const data = err.response?.data;
    if (data && typeof data === "object" && "message" in data) {
      const m = (data as { message: unknown }).message;
      if (typeof m === "string") return m;
      if (Array.isArray(m)) return m.map(String).join(", ");
    }
  }
  return "";
}

// ─── Animated Star ────────────────────────────────────────────────────────────
const AnimatedStar: React.FC<{
  index: number;
  filled: boolean;
  onPress: () => void;
  disabled: boolean;
}> = ({ index, filled, onPress, disabled }) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    if (disabled) return;
    Animated.sequence([
      Animated.spring(scale, {
        toValue: 1.35,
        useNativeDriver: true,
        speed: 40,
        bounciness: 12,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 30,
        bounciness: 6,
      }),
    ]).start();
    onPress();
  };

  return (
    <TouchableOpacity onPress={handlePress} disabled={disabled} hitSlop={8} activeOpacity={0.8}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons
          name={filled ? "star" : "star-outline"}
          size={38}
          color={filled ? STAR_GOLD : STAR_EMPTY}
        />
      </Animated.View>
    </TouchableOpacity>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export const ClientReviewDetailScreen: React.FC<Props> = ({
  navigation,
  route,
}) => {
  const { t } = useAppTranslation();
  const insets = useSafeAreaInsets();
  const { reviewId } = route.params;

  const [review, setReview] = useState<ClientReviewListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveSucceeded, setSaveSucceeded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [commentFocused, setCommentFocused] = useState(false);
  const savedFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Entrance animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    if (!loading && review) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 380,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          speed: 18,
          bounciness: 4,
        }),
      ]).start();
    }
  }, [loading, review]);

  const clearSaveFeedback = useCallback(() => {
    if (savedFeedbackTimer.current) {
      clearTimeout(savedFeedbackTimer.current);
      savedFeedbackTimer.current = null;
    }
    setSaveSucceeded(false);
  }, []);

  useEffect(() => () => clearSaveFeedback(), [clearSaveFeedback]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getMyClientReview(reviewId);
      const parsed = parseClientReviewRow(res.data);
      if (!parsed) throw new Error("invalid");
      setReview(parsed);
      setRating(parsed.rating);
      setComment(parsed.comment ?? "");
    } catch {
      Alert.alert(t("common.error"), t("client.reviews.loadError"), [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } finally {
      setLoading(false);
    }
  }, [reviewId, navigation, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t("client.screenTitles.ClientReviewDetail"),
      headerTitleAlign: "center",
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ marginLeft: 8, padding: 4 }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={24} color="#1A1A2E" />
        </TouchableOpacity>
      ),
      headerRight: () => <View style={{ width: 40, marginRight: 8 }} />,
    });
  }, [navigation, t]);

  const onSave = async () => {
    if (rating < 1 || rating > 5) {
      Alert.alert(t("common.error"), t("client.reviews.ratingRequired"));
      return;
    }
    clearSaveFeedback();
    setSaving(true);
    try {
      const res = await api.updateMyClientReview(reviewId, {
        rating,
        comment: comment.trim() || undefined,
      });
      const parsed = parseClientReviewRow(res.data);
      if (parsed) setReview(parsed);
      setSaveSucceeded(true);
      savedFeedbackTimer.current = setTimeout(() => {
        setSaveSucceeded(false);
        savedFeedbackTimer.current = null;
      }, 2500);
    } catch (err) {
      Alert.alert(
        t("common.error"),
        extractErrorMessage(err) || t("client.reviews.saveError"),
      );
    } finally {
      setSaving(false);
    }
  };

  const onConfirmDelete = async () => {
    setDeleteModalVisible(false);
    setDeleting(true);
    try {
      await api.deleteMyClientReview(reviewId);
      navigation.goBack();
    } catch (err) {
      Alert.alert(
        t("common.error"),
        extractErrorMessage(err) || t("client.reviews.deleteError"),
      );
    } finally {
      setDeleting(false);
    }
  };

  if (loading || !review) {
    return (
      <View style={styles.centered}>
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color={BRAND} />
          <Text style={styles.loadingText}>Loading review…</Text>
        </View>
      </View>
    );
  }

  const busy = saving || deleting;
  const charPct = comment.length / MAX_COMMENT;
  const charBarColor = charPct > 0.9 ? DANGER : charPct > 0.7 ? STAR_GOLD : BRAND;

  // Star label
  const starLabels = ["", "Poor", "Fair", "Good", "Great", "Excellent"];

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: 32 + insets.bottom },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
            gap: 14,
          }}
        >
          {/* ── Provider card ── */}
          <View style={styles.providerCard}>
            {/* Decorative top stripe */}
            <View style={styles.cardStripe} />
            <View style={styles.providerCardInner}>
              <View style={styles.avatarWrap}>
                {review.providerPhotoUrl ? (
                  <Image
                    source={{ uri: review.providerPhotoUrl }}
                    style={styles.avatar}
                  />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarInitials}>
                      {initialsFromName(review.providerName)}
                    </Text>
                  </View>
                )}
                {/* Online-ish badge dot */}
                <View style={styles.avatarBadge} />
              </View>
              <View style={styles.providerInfo}>
                <Text style={styles.providerName}>{review.providerName}</Text>
                <View style={styles.serviceRow}>
                  <Ionicons name="cut-outline" size={12} color={BRAND} />
                  <Text style={styles.serviceName}>{review.serviceName}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Ionicons name="calendar-outline" size={11} color="#94A3B8" />
                  <Text style={styles.metaLine}>
                    {formatBookingLine(review.scheduledDate, review.scheduledTime)}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Ionicons name="time-outline" size={11} color="#94A3B8" />
                  <Text style={styles.metaLine}>
                    {t("client.reviews.postedOn", {
                      date: formatReviewDate(review.createdAt),
                    })}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* ── Provider reply ── */}
          {review.providerReply ? (
            <View style={styles.replyBox}>
              <View style={styles.replyHeader}>
                <View style={styles.replyIconWrap}>
                  <Ionicons name="chatbubble-ellipses" size={14} color={BRAND} />
                </View>
                <Text style={styles.replyLabel}>
                  {t("client.reviews.providerReplyLabel")}
                </Text>
              </View>
              <Text style={styles.replyText}>{review.providerReply}</Text>
            </View>
          ) : null}

          {/* ── Rating section ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: STAR_GOLD }]} />
              <Text style={styles.sectionTitle}>{t("client.reviews.yourRating")}</Text>
            </View>
            <View style={styles.starPickRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <AnimatedStar
                  key={n}
                  index={n}
                  filled={n <= rating}
                  onPress={() => {
                    clearSaveFeedback();
                    setRating(n);
                  }}
                  disabled={busy}
                />
              ))}
            </View>
            {rating > 0 && (
              <View style={styles.ratingLabelWrap}>
                <Text style={styles.ratingLabel}>{starLabels[rating]}</Text>
              </View>
            )}
          </View>

          {/* ── Comment section ── */}
          <View style={[styles.section, commentFocused && styles.sectionFocused]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: BRAND }]} />
              <Text style={styles.sectionTitle}>{t("client.reviews.yourComment")}</Text>
            </View>
            <TextInput
              style={[styles.commentInput, commentFocused && styles.commentInputFocused]}
              value={comment}
              onChangeText={(text) => {
                clearSaveFeedback();
                setComment(text);
              }}
              onFocus={() => setCommentFocused(true)}
              onBlur={() => setCommentFocused(false)}
              placeholder={t("client.reviews.commentPlaceholder")}
              placeholderTextColor="#CBD5E1"
              multiline
              maxLength={MAX_COMMENT}
              editable={!busy}
            />
            {/* Char progress bar */}
            <View style={styles.charBarTrack}>
              <View
                style={[
                  styles.charBarFill,
                  {
                    width: `${Math.min(charPct * 100, 100)}%` as any,
                    backgroundColor: charBarColor,
                  },
                ]}
              />
            </View>
            <Text style={[styles.charCount, { color: charBarColor }]}>
              {comment.length} / {MAX_COMMENT}
            </Text>
          </View>

          {/* ── Save button ── */}
          <TouchableOpacity
            style={[
              styles.saveBtn,
              saveSucceeded && styles.saveBtnSuccess,
              busy && styles.btnDisabled,
            ]}
            onPress={() => void onSave()}
            disabled={busy}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : saveSucceeded ? (
              <View style={styles.saveBtnContent}>
                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                <Text style={styles.saveBtnText}>
                  {t("client.reviews.savedTitle")}
                </Text>
              </View>
            ) : (
              <View style={styles.saveBtnContent}>
                <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" />
                <Text style={styles.saveBtnText}>{t("client.reviews.saveChanges")}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* ── Divider ── */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* ── Delete button ── */}
          <TouchableOpacity
            style={[styles.deleteBtn, busy && styles.btnDisabled]}
            onPress={() => setDeleteModalVisible(true)}
            disabled={busy}
            activeOpacity={0.85}
          >
            {deleting ? (
              <ActivityIndicator color={DANGER} />
            ) : (
              <>
                <Ionicons name="trash-outline" size={17} color={DANGER} />
                <Text style={styles.deleteBtnText}>
                  {t("client.reviews.deleteReview")}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>

      <ConfirmModal
        visible={deleteModalVisible}
        onDismiss={() => !deleting && setDeleteModalVisible(false)}
        loading={deleting}
        title={t("client.reviews.deleteAlertTitle")}
        message={t("client.reviews.deleteAlertMessage")}
        cancelLabel={t("common.cancel")}
        confirmLabel={t("client.reviews.deleteConfirm")}
        confirmVariant="destructive"
        onConfirm={() => void onConfirmDelete()}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  // ── Layout ──────────────────────────────────────────────────────────────────
  root: { flex: 1, backgroundColor: "#F1F5F9" },
  scroll: { padding: 16, gap: 0 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
  },
  loadingCard: {
    alignItems: "center",
    gap: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 32,
    shadowColor: BRAND,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
  loadingText: {
    fontSize: 14,
    color: "#94A3B8",
    fontWeight: "600",
    letterSpacing: 0.2,
  },

  // ── Provider card ────────────────────────────────────────────────────────────
  providerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: BRAND,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#EDEDF5",
  },
  cardStripe: {
    height: 4,
    backgroundColor: BRAND,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  providerCardInner: {
    flexDirection: "row",
    gap: 14,
    padding: 16,
  },
  avatarWrap: {
    width: 60,
    height: 60,
    borderRadius: 18,
    overflow: "visible",
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 18,
  },
  avatarFallback: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: BRAND_LIGHT,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: BRAND_MID,
  },
  avatarInitials: {
    fontSize: 20,
    fontWeight: "800",
    color: BRAND,
    letterSpacing: -0.5,
  },
  avatarBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: SUCCESS,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  providerInfo: { flex: 1, gap: 5, justifyContent: "center" },
  providerName: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  serviceName: {
    fontSize: 13,
    fontWeight: "600",
    color: BRAND,
    letterSpacing: 0.1,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaLine: {
    fontSize: 12,
    color: "#94A3B8",
    fontWeight: "500",
  },

  // ── Reply box ────────────────────────────────────────────────────────────────
  replyBox: {
    backgroundColor: BRAND_LIGHT,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: BRAND_MID,
    gap: 8,
    marginBottom: 14,
  },
  replyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  replyIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: BRAND_MID,
    alignItems: "center",
    justifyContent: "center",
  },
  replyLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: BRAND,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  replyText: {
    fontSize: 14,
    color: BRAND_DARK,
    lineHeight: 21,
    fontWeight: "400",
  },

  // ── Sections ─────────────────────────────────────────────────────────────────
  section: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#EDEDF5",
    gap: 10,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 14,
  },
  sectionFocused: {
    borderColor: BRAND_MID,
    shadowColor: BRAND,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  sectionDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.9,
  },

  // ── Stars ────────────────────────────────────────────────────────────────────
  starPickRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 6,
  },
  ratingLabelWrap: {
    alignItems: "center",
  },
  ratingLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: STAR_GOLD,
    letterSpacing: 0.3,
  },

  // ── Comment input ─────────────────────────────────────────────────────────────
  commentInput: {
    minHeight: 116,
    borderWidth: 1.5,
    borderColor: "#E8EAF0",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#0F172A",
    textAlignVertical: "top",
    backgroundColor: "#FAFBFC",
    lineHeight: 21,
  },
  commentInputFocused: {
    borderColor: BRAND_MID,
    backgroundColor: "#FFFBF7",
  },
  charBarTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: "#E8EAF0",
    overflow: "hidden",
  },
  charBarFill: {
    height: 3,
    borderRadius: 2,
  },
  charCount: {
    fontSize: 11,
    textAlign: "right",
    fontWeight: "600",
    letterSpacing: 0.2,
  },

  // ── Buttons ──────────────────────────────────────────────────────────────────
  saveBtn: {
    backgroundColor: BRAND,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: BRAND,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
    marginBottom: 12,
  },
  saveBtnSuccess: {
    backgroundColor: SUCCESS,
    shadowColor: SUCCESS,
  },
  saveBtnContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
    letterSpacing: 0.2,
  },

  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E8EAF0",
  },
  dividerText: {
    fontSize: 12,
    color: "#CBD5E1",
    fontWeight: "600",
  },

  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: DANGER_BORDER,
    backgroundColor: DANGER_BG,
  },
  deleteBtnText: {
    color: DANGER,
    fontWeight: "700",
    fontSize: 14,
    letterSpacing: 0.1,
  },
  btnDisabled: { opacity: 0.55 },
});

