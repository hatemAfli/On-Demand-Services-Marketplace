import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { isAxiosError } from "axios";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ClientStackParamList } from "../../../navigation/types";
import { COLORS } from "../../../constants";
import { api, type ComplaintCategory } from "../../../services/api";
import { useAppTranslation } from "../../../hooks/useAppTranslation";

import { CATEGORY_OPTIONS } from "../complaints/categoryMeta";

type Props = NativeStackScreenProps<ClientStackParamList, "ClientFileComplaint">;

const MAX_PHOTOS = 5;
const DESC_MIN = 20;
const DESC_MAX = 2000;

function parseYmdLocal(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatBookingDateTime(scheduledDate: string, scheduledTime: string): string {
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

function PhotoThumb({ uri, onRemove }: { uri: string; onRemove: () => void }) {
  return (
    <View style={styles.thumbWrap}>
      <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />
      <TouchableOpacity
        style={styles.thumbRemove}
        onPress={onRemove}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Ionicons name="close" size={12} color={COLORS.white} />
      </TouchableOpacity>
    </View>
  );
}

export const ClientFileComplaintScreen: React.FC<Props> = ({
  route,
  navigation,
}) => {
  const { t } = useAppTranslation();
  const insets = useSafeAreaInsets();
  const { width } = Dimensions.get("window");
  const { appointmentId, providerName, serviceName } = route.params;

  const [selectedCategory, setSelectedCategory] = useState<ComplaintCategory | null>(
    null,
  );
  const [description, setDescription] = useState("");
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [descriptionTouched, setDescriptionTouched] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [scheduleLine, setScheduleLine] = useState<string | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(true);

  const cardGap = 10;
  const pad = 16;
  const colW = (width - pad * 2 - cardGap) / 2;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t("client.screenTitles.ClientFileComplaint"),
      headerStyle: { backgroundColor: COLORS.surface },
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBack}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.text.primary} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, t]);

  useEffect(() => {
    let cancelled = false;
    setScheduleLoading(true);
    void api
      .getAppointmentById(appointmentId)
      .then((res) => {
        if (cancelled) return;
        const raw = res.data as Record<string, unknown>;
        const sd = typeof raw.scheduledDate === "string" ? raw.scheduledDate : "";
        const st = typeof raw.scheduledTime === "string" ? raw.scheduledTime : "";
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
      const add = result.assets!.map((a) => a.uri).filter(Boolean).slice(0, rem);
      return [...prev, ...add].slice(0, MAX_PHOTOS);
    });
  }, [photoUris]);

  const onAddPhotos = useCallback(() => {
    if (photoUris.length >= MAX_PHOTOS) return;
    Alert.alert("Add photo", undefined, [
      { text: "Camera", onPress: () => void openCamera() },
      { text: "Photo library", onPress: () => void openLibrary() },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [openCamera, openLibrary, photoUris.length]);

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
      await api.createComplaint({
        appointmentId,
        category: selectedCategory,
        description: descTrim,
        evidenceUrls: photoUris.length ? photoUris : undefined,
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
  ]);

  const categoryRows = useMemo(() => chunkPairs(CATEGORY_OPTIONS), []);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: 12,
          paddingBottom: insets.bottom + 120,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.recapCard}>
          <Text style={styles.recapProvider}>{providerName}</Text>
          <Text style={styles.recapService}>{serviceName}</Text>
          {scheduleLoading ? (
            <ActivityIndicator
              size="small"
              color={COLORS.gray[400]}
              style={{ marginTop: 8 }}
            />
          ) : (
            <View style={styles.recapRow}>
              <Ionicons name="calendar-outline" size={15} color={COLORS.gray[500]} />
              <Text style={styles.recapWhen}>
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
          <Text style={styles.categoryError}>Please select a category below.</Text>
        ) : null}

        {categoryRows.map((row, ri) => (
          <View
            key={ri}
            style={[styles.catRow, { paddingHorizontal: pad, gap: cardGap }]}
          >
            {row.map((item) => {
              const selected = selectedCategory === item.value;
              return (
                <TouchableOpacity
                  key={item.value}
                  style={[
                    styles.catCard,
                    { flex: 1, maxWidth: colW },
                    selected ? styles.catCardSelected : styles.catCardIdle,
                  ]}
                  onPress={() => setSelectedCategory(item.value)}
                  activeOpacity={0.88}
                >
                  {selected ? (
                    <View style={styles.catCheck}>
                      <Ionicons name="checkmark" size={12} color={COLORS.white} />
                    </View>
                  ) : null}
                  <Ionicons
                    name={item.icon}
                    size={26}
                    color={selected ? COLORS.primary : COLORS.gray[500]}
                  />
                  <Text
                    style={[styles.catLabel, selected && styles.catLabelSelected]}
                    numberOfLines={2}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        <Text style={styles.sectionTitle}>Details</Text>
        <TextInput
          style={[styles.descInput, showDescError && styles.descInputError]}
          placeholder="Describe what happened in detail. Include dates, times, and specific issues…"
          placeholderTextColor={COLORS.gray[400]}
          multiline
          value={description}
          onChangeText={(v) => setDescription(v.slice(0, DESC_MAX))}
          onBlur={() => setDescriptionTouched(true)}
          textAlignVertical="top"
        />
        <View style={styles.descFooter}>
          <Text style={styles.descHint}>Minimum 20 characters required</Text>
          <Text
            style={[
              styles.charCount,
              descTrim.length >= 16 &&
                descTrim.length < DESC_MIN &&
                (descriptionTouched || submitAttempted)
                ? { color: COLORS.warning }
                : null,
            ]}
          >
            {descTrim.length}/{DESC_MAX}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Add photos (optional)</Text>
        <View style={styles.photosCard}>
          {photoUris.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbRow}
            >
              {photoUris.map((uri) => (
                <PhotoThumb key={uri} uri={uri} onRemove={() => onRemovePhoto(uri)} />
              ))}
            </ScrollView>
          ) : null}
          <TouchableOpacity
            style={[
              styles.addPhotoBtn,
              photoUris.length >= MAX_PHOTOS && styles.addPhotoBtnDisabled,
            ]}
            onPress={onAddPhotos}
            disabled={photoUris.length >= MAX_PHOTOS}
            activeOpacity={0.85}
          >
            <View
              style={[
                styles.addPhotoIconBox,
                photoUris.length >= MAX_PHOTOS && styles.addPhotoIconBoxDisabled,
              ]}
            >
              <Ionicons
                name="camera-outline"
                size={18}
                color={photoUris.length >= MAX_PHOTOS ? COLORS.gray[400] : COLORS.primary}
              />
            </View>
            <Text
              style={[
                styles.addPhotoText,
                photoUris.length >= MAX_PHOTOS && { color: COLORS.gray[400] },
              ]}
            >
              {photoUris.length >= MAX_PHOTOS
                ? "Maximum photos reached"
                : `Add photos · ${photoUris.length}/${MAX_PHOTOS}`}
            </Text>
            {photoUris.length < MAX_PHOTOS ? (
              <Ionicons name="chevron-forward" size={14} color={COLORS.gray[400]} />
            ) : null}
          </TouchableOpacity>
        </View>

        <View style={styles.noticeCard}>
          <Ionicons name="information-circle-outline" size={22} color="#B45309" />
          <Text style={styles.noticeText}>
            Your complaint will be reviewed by our team within 48 hours. The provider
            will be notified that a complaint has been filed but will not see your
            personal details.
          </Text>
        </View>
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          { paddingBottom: Math.max(insets.bottom, 14), paddingHorizontal: pad },
        ]}
      >
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
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.submitBtnText}>Submit complaint</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  headerBack: { marginLeft: 8, padding: 4 },
  recapCard: {
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 16,
    borderRadius: 14,
    backgroundColor: COLORS.gray[50],
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  recapProvider: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.text.primary,
  },
  recapService: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.gray[600],
  },
  recapRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  recapWhen: { fontSize: 14, color: COLORS.text.secondary },
  recapHint: {
    marginTop: 12,
    fontSize: 13,
    color: COLORS.gray[500],
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text.primary,
    marginBottom: 10,
    marginHorizontal: 16,
  },
  catRow: {
    flexDirection: "row",
    marginBottom: 10,
  },
  categoryError: {
    color: COLORS.error,
    fontSize: 13,
    fontWeight: "600",
    marginHorizontal: 16,
    marginBottom: 8,
  },
  catCard: {
    minHeight: 100,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  catCardIdle: {
    backgroundColor: COLORS.gray[100],
    borderWidth: 1,
    borderColor: COLORS.gray[200],
  },
  catCardSelected: {
    backgroundColor: "#EEF2FF",
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  catCheck: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  catLabel: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.gray[600],
    textAlign: "center",
  },
  catLabelSelected: { color: COLORS.primaryDark },
  descInput: {
    marginHorizontal: 16,
    minHeight: 140,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    fontSize: 15,
    color: COLORS.text.primary,
    backgroundColor: COLORS.gray[50],
  },
  descInputError: {
    borderColor: COLORS.error,
    borderWidth: 1.5,
  },
  descFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 20,
  },
  descHint: { fontSize: 12, color: COLORS.gray[500] },
  charCount: { fontSize: 12, color: COLORS.gray[500] },
  photosCard: {
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.gray[50],
    overflow: "hidden",
  },
  thumbRow: { gap: 10, paddingHorizontal: 12, paddingTop: 12 },
  thumbWrap: { width: 72, height: 72, borderRadius: 10, overflow: "hidden" },
  thumb: { width: "100%", height: "100%" },
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
  addPhotoBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 10,
  },
  addPhotoBtnDisabled: { opacity: 0.7 },
  addPhotoIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  addPhotoIconBoxDisabled: { backgroundColor: COLORS.gray[200] },
  addPhotoText: { flex: 1, fontSize: 14, fontWeight: "600", color: COLORS.text.primary },
  noticeCard: {
    flexDirection: "row",
    gap: 12,
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    color: "#92400E",
    lineHeight: 19,
  },
  bottomBar: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
    paddingTop: 12,
  },
  submitBtn: {
    backgroundColor: "#DC2626",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnDisabled: { opacity: 0.45 },
  submitBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "700",
  },
});
