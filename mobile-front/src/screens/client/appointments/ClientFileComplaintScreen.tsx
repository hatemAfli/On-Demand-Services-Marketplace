import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { isAxiosError } from "axios";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import type { ClientStackParamList } from "../../../navigation/types";
import { COLORS } from "../../../constants";
import { api, type ComplaintCategory } from "../../../services/api";
import { uploadComplaintEvidencePhotos } from "../../../services/complaintEvidencePhotosUpload";
import { useAuth } from "../../../context/AuthContext";
import { useAppTranslation } from "../../../hooks/useAppTranslation";
import { CATEGORY_OPTIONS } from "../complaints/categoryMeta";

type Props = NativeStackScreenProps<
  ClientStackParamList,
  "ClientFileComplaint"
>;

const BRAND_ORANGE = "#EA580C";
const MAX_PHOTOS = 5;
const DESC_MIN = 20;
const DESC_MAX = 2000;
const COMPLAINT_RED = "#DC2626";

function parseYmdLocal(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatBookingDateTime(
  scheduledDate: string,
  scheduledTime: string,
): string {
  try {
    const d = parseYmdLocal(scheduledDate);
    const day = d.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    return `${day} · ${scheduledTime}`;
  } catch {
    return `${scheduledDate} · ${scheduledTime}`;
  }
}

function chunkPairs<T>(arr: T[]): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < arr.length; i += 2) {
    rows.push(arr.slice(i, i + 2));
  }
  return rows;
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

function PhotoThumb({ uri, onRemove }: { uri: string; onRemove: () => void }) {
  return (
    <View style={styles.thumbWrap}>
      <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />
      <TouchableOpacity
        style={styles.thumbRemove}
        onPress={onRemove}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Ionicons name="close" size={12} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

function PhotoSourceSheet({
  visible,
  bottomInset,
  slotsRemaining,
  onClose,
  onCamera,
  onGallery,
}: {
  visible: boolean;
  bottomInset: number;
  slotsRemaining: number;
  onClose: () => void;
  onCamera: () => void;
  onGallery: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.sourceBackdrop} onPress={onClose}>
        <Pressable
          style={[styles.sourceSheet, { paddingBottom: Math.max(bottomInset, 16) + 12 }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.sourceHandle} />
          <Text style={styles.sourceTitle}>Add evidence photo</Text>
          <Text style={styles.sourceSubtitle}>
            {slotsRemaining > 1
              ? `You can add up to ${slotsRemaining} more photos`
              : "You can add 1 more photo"}
          </Text>

          <View style={styles.sourceOptionsRow}>
            <TouchableOpacity
              style={styles.sourceOption}
              onPress={onCamera}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel="Take a photo with camera"
            >
              <View style={[styles.sourceIconCircle, styles.sourceIconCamera]}>
                <Ionicons name="camera" size={30} color={BRAND_ORANGE} />
              </View>
              <Text style={styles.sourceOptionTitle}>Camera</Text>
              <Text style={styles.sourceOptionSub}>Take a new photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sourceOption}
              onPress={onGallery}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel="Choose from photo library"
            >
              <View style={[styles.sourceIconCircle, styles.sourceIconGallery]}>
                <Ionicons name="images" size={30} color="#2563EB" />
              </View>
              <Text style={styles.sourceOptionTitle}>Gallery</Text>
              <Text style={styles.sourceOptionSub}>From your storage</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.sourceCancelBtn}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={styles.sourceCancelText}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export const ClientFileComplaintScreen: React.FC<Props> = ({
  route,
  navigation,
}) => {
  const { t } = useAppTranslation();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { appointmentId, providerName, serviceName } = route.params;

  const [selectedCategory, setSelectedCategory] =
    useState<ComplaintCategory | null>(null);
  const [description, setDescription] = useState("");
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [descriptionTouched, setDescriptionTouched] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [scheduleLine, setScheduleLine] = useState<string | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [photoSourceOpen, setPhotoSourceOpen] = useState(false);

  const orderRef = useMemo(
    () => `#${appointmentId.replace(/-/g, "").slice(0, 8).toUpperCase()}`,
    [appointmentId],
  );
  const initials = useMemo(
    () => initialsFromName(providerName),
    [providerName],
  );

  const cardGap = 10;
  const colW = (width - 24 * 2 - 24 * 2 - cardGap) / 2;

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    let cancelled = false;
    setScheduleLoading(true);
    void api
      .getAppointmentById(appointmentId)
      .then((res) => {
        if (cancelled) return;
        const raw = res.data as Record<string, unknown>;
        const sd =
          typeof raw.scheduledDate === "string" ? raw.scheduledDate : "";
        const st =
          typeof raw.scheduledTime === "string" ? raw.scheduledTime : "";
        const ymd = sd.includes("T") ? sd.slice(0, 10) : sd;
        if (ymd && st) setScheduleLine(formatBookingDateTime(ymd, st));
        else setScheduleLine(null);
      })
      .catch(() => {
        if (!cancelled) setScheduleLine(null);
      })
      .finally(() => {
        if (!cancelled) setScheduleLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [appointmentId]);

  const onRemovePhoto = useCallback(
    (uri: string) => setPhotoUris((prev) => prev.filter((u) => u !== uri)),
    [],
  );

  const openCamera = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow camera access to take a photo.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    const uri = result.assets[0].uri;
    setPhotoUris((prev) =>
      prev.length >= MAX_PHOTOS ? prev : [...prev, uri].slice(0, MAX_PHOTOS),
    );
  }, []);

  const openLibrary = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "Allow photo library access to attach images.",
      );
      return;
    }
    const remaining = MAX_PHOTOS - photoUris.length;
    if (remaining <= 0) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: remaining,
    });
    if (result.canceled || !result.assets?.length) return;
    setPhotoUris((prev) => {
      const rem = MAX_PHOTOS - prev.length;
      if (rem <= 0) return prev;
      const add = result
        .assets!.map((a) => a.uri)
        .filter(Boolean)
        .slice(0, rem);
      return [...prev, ...add].slice(0, MAX_PHOTOS);
    });
  }, [photoUris]);

  const closePhotoSource = useCallback(() => setPhotoSourceOpen(false), []);

  const onPickCamera = useCallback(() => {
    closePhotoSource();
    void openCamera();
  }, [closePhotoSource, openCamera]);

  const onPickGallery = useCallback(() => {
    closePhotoSource();
    void openLibrary();
  }, [closePhotoSource, openLibrary]);

  const onAddPhotos = useCallback(() => {
    if (photoUris.length >= MAX_PHOTOS) return;
    setPhotoSourceOpen(true);
  }, [photoUris.length]);

  const photoSlotsRemaining = MAX_PHOTOS - photoUris.length;

  const descTrim = description.trim();
  const descOk = descTrim.length >= DESC_MIN && descTrim.length <= DESC_MAX;
  const canSubmitContent = !!selectedCategory && descOk;

  const descInvalidShort = descTrim.length > 0 && descTrim.length < DESC_MIN;
  const showDescError =
    (submitAttempted || descriptionTouched) && descInvalidShort;

  const onSubmit = useCallback(async () => {
    if (!selectedCategory) {
      setSubmitAttempted(true);
      Alert.alert(
        "Select a category",
        "Choose the option that best describes your issue.",
      );
      return;
    }
    if (!descOk) {
      setSubmitAttempted(true);
      return;
    }
    setSubmitting(true);
    try {
      let evidenceUrls: string[] | undefined;
      if (photoUris.length > 0) {
        const clientId = user?.id;
        if (!clientId) {
          Alert.alert(
            "Sign in required",
            "Log in to attach evidence photos to your complaint.",
          );
          return;
        }
        evidenceUrls = await uploadComplaintEvidencePhotos(
          appointmentId,
          clientId,
          photoUris,
        );
      }
      await api.createComplaint({
        appointmentId,
        category: selectedCategory,
        description: descTrim,
        evidenceUrls,
      });
      navigation.replace("ClientComplaintSuccess", {
        category: selectedCategory,
        providerName,
      });
    } catch (e) {
      const msg =
        isAxiosError(e) && typeof e.response?.data === "object"
          ? (e.response?.data as { message?: string }).message
          : undefined;
      Alert.alert(
        "Could not submit",
        typeof msg === "string" ? msg : "Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }, [
    appointmentId,
    descOk,
    descTrim,
    navigation,
    photoUris,
    providerName,
    selectedCategory,
    user?.id,
  ]);

  const categoryRows = useMemo(() => chunkPairs(CATEGORY_OPTIONS), []);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
          >
            <Ionicons name="chevron-back" size={20} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {t("client.screenTitles.ClientFileComplaint")}
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
                <Ionicons name="flag" size={26} color={COMPLAINT_RED} />
              </View>
              <Text style={styles.bannerTitle}>Report a problem</Text>
              <Text style={styles.bannerSubTitle}>
                {orderRef} — {serviceName}
              </Text>
            </View>
          </View>

          <View style={styles.contentWrap}>
            <View style={styles.cardFloating}>
              <View style={styles.providerWrap}>
                <View style={styles.providerAvatarPlaceholder}>
                  <Text style={styles.providerAvatarInitials}>{initials}</Text>
                </View>
                <Text style={styles.providerName}>{providerName}</Text>
                <Text style={styles.providerMeta}>{serviceName}</Text>
                {scheduleLoading ? (
                  <ActivityIndicator
                    size="small"
                    color="#94A3B8"
                    style={{ marginTop: 10 }}
                  />
                ) : (
                  <View style={styles.schedulePill}>
                    <Ionicons
                      name="calendar-outline"
                      size={14}
                      color="#64748B"
                    />
                    <Text style={styles.schedulePillText}>
                      {scheduleLine ?? "Date & time unavailable"}
                    </Text>
                  </View>
                )}
                <Text style={styles.recapHint}>
                  Describe the issue clearly so our team can investigate
                </Text>
              </View>

              <Text style={styles.sectionTitle}>What went wrong?</Text>
              {submitAttempted && !selectedCategory ? (
                <Text style={styles.inlineError}>
                  Please select a category below.
                </Text>
              ) : null}

              {categoryRows.map((row, ri) => (
                <View key={ri} style={[styles.catRow, { gap: cardGap }]}>
                  {row.map((item) => {
                    const selected = selectedCategory === item.value;
                    return (
                      <TouchableOpacity
                        key={item.value}
                        style={[
                          styles.catCard,
                          { maxWidth: colW, flex: 1 },
                          selected
                            ? styles.catCardSelected
                            : styles.catCardIdle,
                        ]}
                        onPress={() => setSelectedCategory(item.value)}
                        activeOpacity={0.88}
                      >
                        {selected ? (
                          <View style={styles.catCheck}>
                            <Ionicons
                              name="checkmark"
                              size={10}
                              color="#FFFFFF"
                            />
                          </View>
                        ) : null}
                        <View
                          style={[
                            styles.catIconBox,
                            selected && styles.catIconBoxSelected,
                          ]}
                        >
                          <Ionicons
                            name={item.icon}
                            size={22}
                            color={selected ? BRAND_ORANGE : "#64748B"}
                          />
                        </View>
                        <Text
                          style={[
                            styles.catLabel,
                            selected && styles.catLabelSelected,
                          ]}
                          numberOfLines={2}
                        >
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}

              <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>
                Describe what happened
              </Text>
              <View
                style={[
                  styles.feedbackWrap,
                  showDescError && styles.feedbackWrapError,
                ]}
              >
                <TextInput
                  style={styles.feedbackInput}
                  placeholder="Include dates, times, and specific issues you experienced…"
                  placeholderTextColor="#94A3B8"
                  multiline
                  value={description}
                  onChangeText={(v) => setDescription(v.slice(0, DESC_MAX))}
                  onBlur={() => setDescriptionTouched(true)}
                  textAlignVertical="top"
                />
                <Text style={styles.feedbackCount}>
                  {descTrim.length}/{DESC_MAX}
                </Text>
              </View>
              {showDescError ? (
                <Text style={styles.descErrorText}>
                  Minimum {DESC_MIN} characters required
                </Text>
              ) : (
                <Text style={styles.descHint}>
                  Minimum {DESC_MIN} characters required
                </Text>
              )}

              <View style={styles.evidenceHeader}>
                <Text style={styles.sectionTitle}>Evidence photos</Text>
                <Text style={styles.optionalBadge}>optional</Text>
              </View>

              <View style={styles.photosCard}>
                {photoUris.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.thumbRow}
                  >
                    {photoUris.map((uri) => (
                      <PhotoThumb
                        key={uri}
                        uri={uri}
                        onRemove={() => onRemovePhoto(uri)}
                      />
                    ))}
                    {photoUris.length < MAX_PHOTOS ? (
                      <TouchableOpacity
                        style={styles.thumbGhost}
                        onPress={onAddPhotos}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="add" size={22} color="#94A3B8" />
                      </TouchableOpacity>
                    ) : null}
                  </ScrollView>
                ) : null}
                <TouchableOpacity
                  style={[
                    styles.addPhotoRow,
                    photoUris.length >= MAX_PHOTOS &&
                      styles.addPhotoRowDisabled,
                  ]}
                  onPress={onAddPhotos}
                  disabled={photoUris.length >= MAX_PHOTOS}
                  activeOpacity={0.85}
                >
                  <View
                    style={[
                      styles.addPhotoIconBox,
                      photoUris.length >= MAX_PHOTOS &&
                        styles.addPhotoIconBoxDisabled,
                    ]}
                  >
                    <Ionicons
                      name="camera-outline"
                      size={18}
                      color={
                        photoUris.length >= MAX_PHOTOS
                          ? "#94A3B8"
                          : BRAND_ORANGE
                      }
                    />
                  </View>
                  <View style={styles.addPhotoTextWrap}>
                    <Text
                      style={[
                        styles.addPhotoText,
                        photoUris.length >= MAX_PHOTOS &&
                          styles.addPhotoTextMuted,
                      ]}
                    >
                      {photoUris.length >= MAX_PHOTOS
                        ? "Maximum photos reached"
                        : "Add photos"}
                    </Text>
                    <Text style={styles.addPhotoSub}>
                      {photoUris.length}/{MAX_PHOTOS} · Camera or library
                    </Text>
                  </View>
                  {photoUris.length < MAX_PHOTOS ? (
                    <Ionicons
                      name="chevron-forward"
                      size={14}
                      color="#94A3B8"
                    />
                  ) : null}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.noticeCard}>
              <Ionicons
                name="information-circle-outline"
                size={22}
                color="#B45309"
              />
              <Text style={styles.noticeText}>
                Your complaint will be reviewed by our team within 48 hours. The
                provider will be notified that a complaint has been filed but
                will not see your personal details.
              </Text>
            </View>

            <View style={styles.actionsWrap}>
              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  (!canSubmitContent || submitting) && styles.submitBtnDisabled,
                ]}
                onPress={() => void onSubmit()}
                disabled={submitting}
                activeOpacity={0.9}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.submitBtnText}>Submit complaint</Text>
                    <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
                  </>
                )}
              </TouchableOpacity>
              <Text style={styles.submitHint}>
                {canSubmitContent
                  ? "Ready to submit"
                  : "Select a category and add at least 20 characters"}
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <PhotoSourceSheet
        visible={photoSourceOpen}
        bottomInset={insets.bottom}
        slotsRemaining={photoSlotsRemaining}
        onClose={closePhotoSource}
        onCamera={onPickCamera}
        onGallery={onPickGallery}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },
  flex: { flex: 1 },
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
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
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
    backgroundColor: BRAND_ORANGE,
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
    backgroundColor: "rgba(234,88,12,0.28)",
    borderRadius: 65,
  },
  bannerContent: {
    alignItems: "center",
  },
  bannerIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#1E1B4B",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
    elevation: 4,
  },
  bannerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  bannerSubTitle: {
    fontSize: 12,
    color: "#FFEDD5",
    textAlign: "center",
  },
  contentWrap: {
    paddingHorizontal: 24,
    marginTop: -32,
  },
  cardFloating: {
    backgroundColor: "#FFFFFF",
    borderRadius: 32,
    padding: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 20,
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 22,
    elevation: 4,
  },
  providerWrap: {
    alignItems: "center",
    marginTop: -36,
    marginBottom: 20,
  },
  providerAvatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: "#FFFFFF",
    backgroundColor: "#FFEDD5",
    alignItems: "center",
    justifyContent: "center",
  },
  providerAvatarInitials: {
    fontSize: 24,
    fontWeight: "800",
    color: BRAND_ORANGE,
  },
  providerName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 12,
    textAlign: "center",
  },
  providerMeta: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
    textAlign: "center",
  },
  schedulePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  schedulePillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
  recapHint: {
    marginTop: 12,
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 19,
    paddingHorizontal: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  sectionTitleSpaced: {
    marginTop: 8,
  },
  inlineError: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.error,
    marginBottom: 10,
    marginTop: -4,
  },
  catRow: {
    flexDirection: "row",
    marginBottom: 10,
  },
  catCard: {
    minHeight: 100,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  catCardIdle: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  catCardSelected: {
    backgroundColor: "#FFF7ED",
    borderWidth: 2,
    borderColor: BRAND_ORANGE,
  },
  catCheck: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: BRAND_ORANGE,
    alignItems: "center",
    justifyContent: "center",
  },
  catIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  catIconBoxSelected: {
    backgroundColor: "#FFEDD5",
  },
  catLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
    textAlign: "center",
  },
  catLabelSelected: {
    color: BRAND_ORANGE,
  },
  feedbackWrap: {
    position: "relative",
    marginBottom: 6,
  },
  feedbackWrapError: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: COLORS.error,
  },
  feedbackInput: {
    minHeight: 120,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
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
    color: "#94A3B8",
    fontWeight: "600",
  },
  descHint: {
    fontSize: 11,
    color: "#94A3B8",
    marginBottom: 20,
  },
  descErrorText: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.error,
    marginBottom: 20,
  },
  evidenceHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  optionalBadge: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  photosCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    overflow: "hidden",
    marginBottom: 4,
  },
  thumbRow: {
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 4,
  },
  thumbWrap: {
    width: 72,
    height: 72,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  thumb: {
    width: "100%",
    height: "100%",
  },
  thumbRemove: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbGhost: {
    width: 72,
    height: 72,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  addPhotoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  addPhotoRowDisabled: {
    opacity: 0.65,
  },
  addPhotoIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#FFEDD5",
    alignItems: "center",
    justifyContent: "center",
  },
  addPhotoIconBoxDisabled: {
    backgroundColor: "#E2E8F0",
  },
  addPhotoTextWrap: {
    flex: 1,
  },
  addPhotoText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  addPhotoTextMuted: {
    color: "#94A3B8",
  },
  addPhotoSub: {
    fontSize: 10,
    color: "#94A3B8",
    marginTop: 2,
  },
  noticeCard: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    marginBottom: 20,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    color: "#92400E",
    lineHeight: 19,
  },
  actionsWrap: {
    gap: 10,
    marginBottom: 8,
  },
  submitBtn: {
    backgroundColor: COMPLAINT_RED,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    shadowColor: COMPLAINT_RED,
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 16,
    elevation: 4,
  },
  submitBtnDisabled: {
    opacity: 0.45,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  submitHint: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94A3B8",
    textAlign: "center",
  },
  sourceBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "flex-end",
  },
  sourceSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderBottomWidth: 0,
    shadowColor: "#0F172A",
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: -6 },
    shadowRadius: 20,
    elevation: 12,
  },
  sourceHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
    marginBottom: 18,
  },
  sourceTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
    marginBottom: 6,
  },
  sourceSubtitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "#64748B",
    textAlign: "center",
    marginBottom: 22,
  },
  sourceOptionsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  sourceOption: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 10,
    borderRadius: 20,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  sourceIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    borderWidth: 1,
  },
  sourceIconCamera: {
    backgroundColor: "#FFEDD5",
    borderColor: "#FDBA74",
  },
  sourceIconGallery: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
  },
  sourceOptionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 4,
  },
  sourceOptionSub: {
    fontSize: 11,
    fontWeight: "500",
    color: "#94A3B8",
    textAlign: "center",
  },
  sourceCancelBtn: {
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
  },
  sourceCancelText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748B",
  },
});
