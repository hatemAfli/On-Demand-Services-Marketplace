import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import type { ProviderStackParamList } from "../../../navigation/types";
import { AuthNoticeModal } from "../../../components/common";
import { api } from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import { uploadProviderGalleryImage } from "../../../services/providerServiceGalleryUpload";
import type { AxiosError } from "axios";

type PricingTypeOption = "FIXED" | "HOURLY";

type Nav = NativeStackNavigationProp<
  ProviderStackParamList,
  "ProviderManageService"
>;
type R = RouteProp<ProviderStackParamList, "ProviderManageService">;

type GivenServiceApi = {
  id?: string;
  pricingType?: string;
  price?: number | string;
  minimumHours?: number | null;
  estimatedDurationMinutes?: number | null;
  description?: string | null;
  whatIsIncluded?: string | null;
  whatIsNotIncluded?: string | null;
  toolsProvidedByProvider?: boolean | null;
  serviceAreaNotes?: string | null;
  advanceBookingRequiredHours?: number | null;
  serviceRadiusKm?: number | string | null;
  isAvailableImmediately?: boolean | null;
  clientMustProvide?: string | null;
};
type GalleryImage = { id: string; imageUrl: string };

const ACCENT = "#EA580C";
const ACCENT_LIGHT = "#FFF7ED";
const ACCENT_BORDER = "#FFEDD5";
const SCREEN_BG = "#F1F5F9";

const MAX_GALLERY_PHOTOS = 40;

function numToInput(v: number | string | null | undefined): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : "";
}

function applyGivenServiceToForm(
  row: GivenServiceApi,
  setters: {
    setPricingType: (v: PricingTypeOption) => void;
    setBasePrice: (v: string) => void;
    setMinimumHours: (v: string) => void;
    setEstimatedDurationMinutes: (v: string) => void;
    setDescription: (v: string) => void;
    setWhatIsIncluded: (v: string) => void;
    setWhatIsNotIncluded: (v: string) => void;
    setToolsProvidedByProvider: (v: boolean) => void;
    setServiceAreaNotes: (v: string) => void;
    setAdvanceBookingRequiredHours: (v: string) => void;
    setServiceRadiusKm: (v: string) => void;
    setIsAvailableImmediately: (v: boolean) => void;
    setClientMustProvide: (v: string) => void;
  },
) {
  const pt = (row.pricingType ?? "FIXED").toString().toUpperCase();
  setters.setPricingType(pt === "HOURLY" ? "HOURLY" : "FIXED");
  setters.setBasePrice(numToInput(row.price ?? 0));
  setters.setMinimumHours(numToInput(row.minimumHours));
  setters.setEstimatedDurationMinutes(numToInput(row.estimatedDurationMinutes));
  setters.setDescription(row.description ?? "");
  setters.setWhatIsIncluded(row.whatIsIncluded ?? "");
  setters.setWhatIsNotIncluded(row.whatIsNotIncluded ?? "");
  setters.setToolsProvidedByProvider(Boolean(row.toolsProvidedByProvider));
  setters.setServiceAreaNotes(row.serviceAreaNotes ?? "");
  setters.setAdvanceBookingRequiredHours(
    numToInput(row.advanceBookingRequiredHours),
  );
  setters.setServiceRadiusKm(numToInput(row.serviceRadiusKm));
  setters.setIsAvailableImmediately(Boolean(row.isAvailableImmediately));
  setters.setClientMustProvide(row.clientMustProvide ?? "");
}

function parseOptionalInt(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = parseInt(t, 10);
  if (!Number.isFinite(n) || n < 0) throw new Error("Invalid whole number");
  return n;
}

function parseOptionalFloat(raw: string): number | null {
  const t = raw.trim().replace(",", ".");
  if (t === "") return null;
  const n = parseFloat(t);
  if (!Number.isFinite(n) || n < 0) throw new Error("Invalid number");
  return n;
}

export const ProviderManageServiceScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const route = useRoute<R>();
  const mode = route.params?.mode ?? "create";
  const serviceId = route.params?.serviceId;
  const serviceName = route.params?.serviceName ?? "";
  const category = route.params?.serviceCategory ?? "";
  const serviceDescription = route.params?.serviceDescription ?? "";

  const [loading, setLoading] = useState(mode === "edit" && !!serviceId);
  const [saving, setSaving] = useState(false);

  const [pricingType, setPricingType] = useState<PricingTypeOption>("FIXED");
  const [givenServiceId, setGivenServiceId] = useState<string | null>(null);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [basePrice, setBasePrice] = useState("0");
  const [minimumHours, setMinimumHours] = useState("");
  const [estimatedDurationMinutes, setEstimatedDurationMinutes] = useState("");
  const [description, setDescription] = useState("");
  const [whatIsIncluded, setWhatIsIncluded] = useState("");
  const [whatIsNotIncluded, setWhatIsNotIncluded] = useState("");
  const [toolsProvidedByProvider, setToolsProvidedByProvider] = useState(false);
  const [serviceAreaNotes, setServiceAreaNotes] = useState("");
  const [advanceBookingRequiredHours, setAdvanceBookingRequiredHours] =
    useState("");
  const [serviceRadiusKm, setServiceRadiusKm] = useState("");
  const [isAvailableImmediately, setIsAvailableImmediately] = useState(false);
  const [clientMustProvide, setClientMustProvide] = useState("");
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [galleryRemovingId, setGalleryRemovingId] = useState<string | null>(null);

  const loadFromApi = useCallback(async () => {
    if (mode !== "edit" || !serviceId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api.getProviderGivenService(serviceId);
      const row = (res.data ?? {}) as GivenServiceApi;
      setGivenServiceId(typeof row.id === "string" ? row.id : null);
      applyGivenServiceToForm(row, {
        setPricingType,
        setBasePrice,
        setMinimumHours,
        setEstimatedDurationMinutes,
        setDescription,
        setWhatIsIncluded,
        setWhatIsNotIncluded,
        setToolsProvidedByProvider,
        setServiceAreaNotes,
        setAdvanceBookingRequiredHours,
        setServiceRadiusKm,
        setIsAvailableImmediately,
        setClientMustProvide,
      });

      const galleryRes = await api.getProviderServiceGallery(serviceId);
      const gallery = (galleryRes.data ?? {}) as {
        images?: GalleryImage[];
      };
      setGallery(Array.isArray(gallery.images) ? gallery.images : []);
    } catch (e) {
      const err = e as AxiosError<{ message?: string | string[] }>;
      const msg =
        (typeof err.response?.data?.message === "string"
          ? err.response.data.message
          : Array.isArray(err.response?.data?.message)
            ? err.response.data.message.join(", ")
            : null) ?? "Could not load your service offer.";
      Alert.alert("Load failed", msg);
    } finally {
      setLoading(false);
    }
  }, [mode, serviceId]);

  const onAddGalleryPhotos = async () => {
    if (mode !== "edit" || !serviceId || !user?.id || !givenServiceId) return;
    if (gallery.length >= MAX_GALLERY_PHOTOS) {
      Alert.alert("Limit reached", `Maximum ${MAX_GALLERY_PHOTOS} images.`);
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow photo library access to attach images.");
      return;
    }
    const remaining = MAX_GALLERY_PHOTOS - gallery.length;
    if (remaining <= 0) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: remaining,
    });
    if (result.canceled || !result.assets?.length) return;

    const assets = result.assets.filter((a) => a.uri).slice(0, remaining);
    if (!assets.length) return;

    setGalleryUploading(true);
    try {
      const uploaded: GalleryImage[] = [];
      for (const asset of assets) {
        const publicUrl = await uploadProviderGalleryImage(
          user.id,
          givenServiceId,
          asset.uri,
          asset.mimeType,
        );
        uploaded.push({
          id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          imageUrl: publicUrl,
        });
      }
      setGallery((prev) => [...prev, ...uploaded].slice(0, MAX_GALLERY_PHOTOS));
    } catch (e) {
      Alert.alert(
        "Upload failed",
        e instanceof Error ? e.message : "Could not upload image.",
      );
    } finally {
      setGalleryUploading(false);
    }
  };

  const removeGalleryImage = async (id: string) => {
    if (mode !== "edit" || !serviceId) return;
    const item = gallery.find((g) => g.id === id);
    if (!item) return;

    setGalleryRemovingId(id);
    try {
      await api.removeProviderGalleryImage(serviceId, {
        imageUrl: item.imageUrl,
        galleryId: id.startsWith("local-") ? undefined : id,
      });
      setGallery((prev) => prev.filter((g) => g.id !== id));
    } catch (e) {
      const err = e as AxiosError<{ message?: string | string[] }>;
      const msg =
        (typeof err.response?.data?.message === "string"
          ? err.response.data.message
          : Array.isArray(err.response?.data?.message)
            ? err.response.data.message.join(", ")
            : null) ?? "Could not remove this image.";
      Alert.alert("Remove failed", msg);
    } finally {
      setGalleryRemovingId(null);
    }
  };

  useFocusEffect(
    useCallback(() => {
      void loadFromApi();
    }, [loadFromApi]),
  );

  const buildUpdatePayload = (): Record<string, unknown> => {
    const pt = pricingType;
    const priceRaw = basePrice.trim().replace(",", ".");
    const priceNum = parseFloat(priceRaw);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      throw new Error("Enter a valid price (0 or greater).");
    }
    return {
      pricingType: pt,
      price: priceNum,
      minimumHours: parseOptionalInt(minimumHours),
      estimatedDurationMinutes: parseOptionalInt(estimatedDurationMinutes),
      description: description.trim() === "" ? null : description.trim(),
      whatIsIncluded:
        whatIsIncluded.trim() === "" ? null : whatIsIncluded.trim(),
      whatIsNotIncluded:
        whatIsNotIncluded.trim() === "" ? null : whatIsNotIncluded.trim(),
      clientMustProvide:
        clientMustProvide.trim() === "" ? null : clientMustProvide.trim(),
      serviceAreaNotes:
        serviceAreaNotes.trim() === "" ? null : serviceAreaNotes.trim(),
      advanceBookingRequiredHours: parseOptionalInt(
        advanceBookingRequiredHours,
      ),
      serviceRadiusKm: parseOptionalFloat(serviceRadiusKm),
      toolsProvidedByProvider,
      isAvailableImmediately,
    };
  };

  const onSave = async () => {
    if (mode !== "edit" || !serviceId) {
      Alert.alert(
        "Not available",
        "Saving is only supported when editing an existing catalog service.",
      );
      return;
    }
    let payload: Record<string, unknown>;
    try {
      payload = buildUpdatePayload();
    } catch (err) {
      Alert.alert(
        "Check input",
        err instanceof Error ? err.message : "Invalid values.",
      );
      return;
    }
    setSaving(true);
    try {
      await api.updateProviderGivenService(serviceId, payload);
      await api.updateProviderServiceGallery(serviceId, {
        imageUrls: gallery.map((g) => g.imageUrl),
      });
      setSuccessModalVisible(true);
    } catch (e) {
      const err = e as AxiosError<{ message?: string | string[] }>;
      const msg =
        (typeof err.response?.data?.message === "string"
          ? err.response.data.message
          : Array.isArray(err.response?.data?.message)
            ? err.response.data.message.join(", ")
            : null) ?? "Could not save changes.";
      Alert.alert("Save failed", msg);
    } finally {
      setSaving(false);
    }
  };

  const canSave =
    mode === "edit" &&
    !!serviceId &&
    !loading &&
    !saving &&
    !galleryUploading &&
    !galleryRemovingId;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <View style={styles.backBtnInner}>
            <Ionicons name="chevron-back" size={22} color="#1A1A2E" />
          </View>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>
            {mode === "edit" ? "Edit Service" : "Create Service"}
          </Text>
          <Text style={styles.subtitle}>
            {mode === "edit"
              ? "Update your service details"
              : "Set up your new service"}
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={ACCENT} />
            <Text style={styles.loadingText}>Loading your offer…</Text>
          </View>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Section: Basics */}
          <SectionHeader icon="layers-outline" label="Basics" />
          <View style={styles.card}>
            <Field label="Service Name">
              <TextInput
                value={serviceName}
                editable={false}
                style={[styles.input, styles.readOnlyInput]}
              />
            </Field>
            <View style={styles.divider} />
            <Field label="Category">
              <TextInput
                value={category}
                editable={false}
                style={[styles.input, styles.readOnlyInput]}
              />
            </Field>
            <View style={styles.divider} />
            <Field label="Description">
              <TextInput
                value={serviceDescription?.trim() || description}
                editable={false}
                style={[styles.input, styles.multiline, styles.readOnlyInput]}
                multiline
              />
            </Field>
          </View>

          {/* Section: Service Scope */}
          <SectionHeader icon="document-text-outline" label="Service Scope" />
          <View style={styles.card}>
            <Field label="Given Service Description">
              <TextInput
                value={description}
                onChangeText={setDescription}
                style={[styles.input, styles.multiline]}
                multiline
                placeholder="Describe what you offer…"
                placeholderTextColor="#BDBDBD"
              />
            </Field>
            <View style={styles.divider} />
            <Field label="What is Included">
              <TextInput
                value={whatIsIncluded}
                onChangeText={setWhatIsIncluded}
                style={[styles.input, styles.multiline]}
                multiline
                placeholder="List what's included…"
                placeholderTextColor="#BDBDBD"
              />
            </Field>
            <View style={styles.divider} />
            <Field label="What is Not Included">
              <TextInput
                value={whatIsNotIncluded}
                onChangeText={setWhatIsNotIncluded}
                style={[styles.input, styles.multiline]}
                multiline
                placeholder="List exclusions…"
                placeholderTextColor="#BDBDBD"
              />
            </Field>
            <View style={styles.divider} />
            <Field label="Client Must Provide">
              <TextInput
                value={clientMustProvide}
                onChangeText={setClientMustProvide}
                style={[styles.input, styles.multiline]}
                multiline
                placeholder="What the client should have ready…"
                placeholderTextColor="#BDBDBD"
              />
            </Field>
          </View>

          {/* Section: Availability */}
          <SectionHeader
            icon="location-outline"
            label="Availability and Area"
          />
          <View style={styles.card}>
            <Field label="Service Area Notes">
              <TextInput
                value={serviceAreaNotes}
                onChangeText={setServiceAreaNotes}
                style={[styles.input, styles.multiline]}
                multiline
                placeholder="Describe your service area…"
                placeholderTextColor="#BDBDBD"
              />
            </Field>
            <View style={styles.divider} />
            <View style={styles.row}>
              <View style={styles.col}>
                <Field label="Advance Booking (hrs)">
                  <TextInput
                    value={advanceBookingRequiredHours}
                    onChangeText={setAdvanceBookingRequiredHours}
                    keyboardType="numeric"
                    style={styles.input}
                    placeholder="0"
                    placeholderTextColor="#BDBDBD"
                  />
                </Field>
              </View>
              <View style={styles.colSpacer} />
              <View style={styles.col}>
                <Field label="Service Radius (km)">
                  <TextInput
                    value={serviceRadiusKm}
                    onChangeText={setServiceRadiusKm}
                    keyboardType="numeric"
                    style={styles.input}
                    placeholder="0"
                    placeholderTextColor="#BDBDBD"
                  />
                </Field>
              </View>
            </View>
            <View style={styles.divider} />
            <SwitchRow
              label="Tools Provided By Provider"
              value={toolsProvidedByProvider}
              onValueChange={setToolsProvidedByProvider}
            />
            <View style={styles.switchDivider} />
            <SwitchRow
              label="Available Immediately"
              value={isAvailableImmediately}
              onValueChange={setIsAvailableImmediately}
            />
          </View>

          {/* Section: Pricing */}
          <SectionHeader icon="pricetag-outline" label="Pricing and Duration" />
          <View style={styles.card}>
            <View style={styles.field}>
              <Text style={styles.label}>Pricing Type</Text>
              <View style={styles.pricingTypeToggle}>
                <Pressable
                  style={[
                    styles.pricingTypeBtn,
                    pricingType === "FIXED" && styles.pricingTypeBtnActive,
                  ]}
                  onPress={() => setPricingType("FIXED")}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={14}
                    color={pricingType === "FIXED" ? ACCENT : "#C4C4C4"}
                    style={styles.pricingTypeIcon}
                  />
                  <Text
                    style={[
                      styles.pricingTypeBtnText,
                      pricingType === "FIXED" &&
                        styles.pricingTypeBtnTextActive,
                    ]}
                  >
                    Fixed
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.pricingTypeBtn,
                    pricingType === "HOURLY" && styles.pricingTypeBtnActive,
                  ]}
                  onPress={() => setPricingType("HOURLY")}
                >
                  <Ionicons
                    name="time-outline"
                    size={14}
                    color={pricingType === "HOURLY" ? ACCENT : "#C4C4C4"}
                    style={styles.pricingTypeIcon}
                  />
                  <Text
                    style={[
                      styles.pricingTypeBtnText,
                      pricingType === "HOURLY" &&
                        styles.pricingTypeBtnTextActive,
                    ]}
                  >
                    Hourly
                  </Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.divider} />
            <Field label="Price">
              <View style={styles.priceInputWrap}>
                <Text style={styles.priceCurrency}>$</Text>
                <TextInput
                  value={basePrice}
                  onChangeText={setBasePrice}
                  keyboardType="decimal-pad"
                  style={[styles.input, styles.priceInput]}
                  placeholder="0.00"
                  placeholderTextColor="#BDBDBD"
                />
              </View>
            </Field>
            <View style={styles.divider} />
            <View style={styles.row}>
              <View style={styles.col}>
                <Field label="Minimum Hours">
                  <TextInput
                    value={minimumHours}
                    onChangeText={setMinimumHours}
                    keyboardType="numeric"
                    style={styles.input}
                    placeholder="—"
                    placeholderTextColor="#BDBDBD"
                  />
                </Field>
              </View>
              <View style={styles.colSpacer} />
              <View style={styles.col}>
                <Field label="Est. Duration (min)">
                  <TextInput
                    value={estimatedDurationMinutes}
                    onChangeText={setEstimatedDurationMinutes}
                    keyboardType="numeric"
                    style={styles.input}
                    placeholder="—"
                    placeholderTextColor="#BDBDBD"
                  />
                </Field>
              </View>
            </View>
          </View>

          {/* Section: Gallery */}
          <SectionHeader icon="images-outline" label="Realization Gallery" />
          <View style={styles.card}>
            <Text style={styles.galleryHint}>
              Add real project photos so clients can see your work quality.
            </Text>
            <GallerySection
              items={gallery}
              onAdd={() => void onAddGalleryPhotos()}
              onRemove={(id) => void removeGalleryImage(id)}
              uploading={galleryUploading}
              removingId={galleryRemovingId}
            />
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[
              styles.loginButton,
              (!canSave || saving) && styles.loginButtonDisabled,
            ]}
            onPress={() => void onSave()}
            activeOpacity={0.85}
            disabled={!canSave || saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <View style={styles.loginButtonContent}>
                <Ionicons name="sparkles-outline" size={16} color="#FFFFFF" />
                <Text style={styles.loginButtonText}>Save Changes</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.bottomPad} />
        </ScrollView>
      )}

      <AuthNoticeModal
        visible={successModalVisible}
        onClose={() => setSuccessModalVisible(false)}
        title="Saved"
        message="Your given service was updated."
        primaryLabel="OK"
        onPrimary={() => navigation.goBack()}
      />
    </SafeAreaView>
  );
};

/* ─── Sub-components ────────────────────────────────────────────────────── */

function SectionHeader({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIconWrap}>
        <Ionicons name={icon as any} size={13} color={ACCENT} />
      </View>
      <Text style={styles.sectionLabel}>{label}</Text>
    </View>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function SwitchRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.switchRow}>
      <Text style={styles.switchLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: "#E8E8F0", true: ACCENT_BORDER }}
        thumbColor={value ? ACCENT : "#F4F4F8"}
        ios_backgroundColor="#E8E8F0"
      />
    </View>
  );
}

function GalleryPhotoThumb({
  uri,
  onRemove,
  removing,
}: {
  uri: string;
  onRemove: () => void;
  removing?: boolean;
}) {
  return (
    <View style={styles.photoPreview}>
      <Image source={{ uri }} style={styles.photoImage} resizeMode="cover" />
      <TouchableOpacity
        style={styles.photoOverlay}
        onPress={onRemove}
        disabled={removing}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        {removing ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Ionicons name="trash-outline" size={14} color="#FFFFFF" />
        )}
      </TouchableOpacity>
    </View>
  );
}

function GallerySection({
  items,
  onAdd,
  onRemove,
  uploading,
  removingId,
}: {
  items: GalleryImage[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  uploading: boolean;
  removingId: string | null;
}) {
  const atLimit = items.length >= MAX_GALLERY_PHOTOS;
  const busy = uploading || removingId !== null;

  return (
    <View style={styles.galleryPhotoCard}>
      <View style={styles.photoRow}>
        <TouchableOpacity
          style={[styles.addPhotoBtn, (atLimit || busy) && styles.addPhotoBtnDisabled]}
          onPress={onAdd}
          disabled={atLimit || busy}
          activeOpacity={0.85}
        >
          {uploading ? (
            <ActivityIndicator size="small" color="#9B9BB0" />
          ) : (
            <>
              <Ionicons
                name="camera-outline"
                size={16}
                color={atLimit ? "#C4C4C4" : "#6B6B80"}
              />
              <Text style={styles.addPhotoText}>
                {atLimit ? `${MAX_GALLERY_PHOTOS}/${MAX_GALLERY_PHOTOS}` : "Add Photo"}
              </Text>
            </>
          )}
        </TouchableOpacity>
        {items.map((item) => (
          <GalleryPhotoThumb
            key={item.id}
            uri={item.imageUrl}
            removing={removingId === item.id}
            onRemove={() => onRemove(item.id)}
          />
        ))}
      </View>
    </View>
  );
}

/* ─── Styles ────────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: SCREEN_BG,
  },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#EBEBF5",
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  backBtn: { padding: 4 },
  backBtnInner: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: SCREEN_BG,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E8E8F0",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerSpacer: { width: 40 },
  title: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1A1A2E",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 11,
    color: "#9B9BB0",
    fontWeight: "500",
    marginTop: 1,
  },

  /* Loading */
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    gap: 14,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 4,
  },
  loadingText: {
    fontSize: 14,
    color: ACCENT,
    fontWeight: "600",
    letterSpacing: 0.1,
  },

  /* Content */
  content: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 20,
  },
  bottomPad: { height: 16 },

  /* Section header */
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
    marginTop: 20,
    paddingHorizontal: 2,
  },
  sectionIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: ACCENT_LIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: ACCENT,
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },

  /* Card */
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EBEBF5",
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: "#1A1A2E",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  divider: {
    height: 1,
    backgroundColor: SCREEN_BG,
    marginVertical: 10,
  },

  /* Fields */
  field: { gap: 6 },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B6B80",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  input: {
    height: 44,
    borderWidth: 1.5,
    borderColor: "#EBEBF5",
    borderRadius: 12,
    backgroundColor: "#FAFAFA",
    paddingHorizontal: 14,
    fontSize: 14,
    color: "#1A1A2E",
    fontWeight: "500",
  },
  readOnlyInput: {
    backgroundColor: SCREEN_BG,
    color: "#9B9BB0",
    borderColor: "#EBEBF5",
  },
  multiline: {
    minHeight: 88,
    height: 88,
    textAlignVertical: "top",
    paddingTop: 12,
    lineHeight: 20,
  },

  /* Row / Col */
  row: { flexDirection: "row" },
  col: { flex: 1 },
  colSpacer: { width: 12 },

  /* Price input */
  priceInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#EBEBF5",
    borderRadius: 12,
    backgroundColor: "#FAFAFA",
    overflow: "hidden",
  },
  priceCurrency: {
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: "700",
    color: ACCENT,
  },
  priceInput: {
    flex: 1,
    height: 44,
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: "transparent",
    paddingLeft: 0,
  },

  /* Switch row */
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1A1A2E",
    flex: 1,
    marginRight: 12,
  },
  switchDivider: {
    height: 1,
    backgroundColor: SCREEN_BG,
    marginVertical: 6,
  },

  /* Pricing toggle */
  pricingTypeToggle: {
    flexDirection: "row",
    backgroundColor: SCREEN_BG,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: "#EBEBF5",
    gap: 4,
  },
  pricingTypeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
  },
  pricingTypeBtnActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  pricingTypeIcon: {},
  pricingTypeBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#9B9BB0",
  },
  pricingTypeBtnTextActive: {
    color: ACCENT,
    fontWeight: "700",
  },

  /* Save button */
  loginButton: {
    alignSelf: "center",
    minWidth: 200,
    height: 52,
    borderRadius: 999,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  loginButtonDisabled: { opacity: 0.45, shadowOpacity: 0 },
  loginButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  /* Gallery — same picker row as ClientSlotPickerScreen "Add Details" */
  galleryHint: {
    fontSize: 12,
    color: "#9B9BB0",
    marginBottom: 12,
    lineHeight: 17,
  },
  galleryPhotoCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EBEBF5",
    overflow: "hidden",
    backgroundColor: "#FAFAFA",
  },
  photoRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexWrap: "wrap",
  },
  addPhotoBtn: {
    width: 64,
    height: 64,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#EBEBF5",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  addPhotoBtnDisabled: { opacity: 0.4 },
  addPhotoText: {
    fontSize: 9,
    color: "#6B6B80",
    fontWeight: "600",
    marginTop: 4,
  },
  photoPreview: {
    width: 64,
    height: 64,
    borderRadius: 12,
    overflow: "hidden",
  },
  photoImage: {
    width: "100%",
    height: "100%",
  },
  photoOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
});
