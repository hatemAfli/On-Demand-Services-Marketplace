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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
import type { AxiosError } from "axios";

type PricingTypeOption = "FIXED" | "HOURLY";

type Nav = NativeStackNavigationProp<
  ProviderStackParamList,
  "ProviderManageService"
>;
type R = RouteProp<ProviderStackParamList, "ProviderManageService">;

type GivenServiceApi = {
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
  const route = useRoute<R>();
  const mode = route.params?.mode ?? "create";
  const serviceId = route.params?.serviceId;
  const serviceName = route.params?.serviceName ?? "";
  const category = route.params?.serviceCategory ?? "";
  const serviceDescription = route.params?.serviceDescription ?? "";

  const [loading, setLoading] = useState(mode === "edit" && !!serviceId);
  const [saving, setSaving] = useState(false);

  const [pricingType, setPricingType] = useState<PricingTypeOption>("FIXED");
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

  const loadFromApi = useCallback(async () => {
    if (mode !== "edit" || !serviceId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api.getProviderGivenService(serviceId);
      const row = (res.data ?? {}) as GivenServiceApi;
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

  const canSave = mode === "edit" && !!serviceId && !loading && !saving;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>
          {mode === "edit" ? "Edit Given Service" : "Create Given Service"}
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loadingText}>Loading your offer…</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Basics</Text>
            <Field label="Service Name">
              <TextInput
                value={serviceName}
                editable={false}
                style={[styles.input, styles.readOnlyInput]}
              />
            </Field>

            <Field label="Category">
              <TextInput
                value={category}
                editable={false}
                style={[styles.input, styles.readOnlyInput]}
              />
            </Field>

            <Field label="Description">
              <TextInput
                value={serviceDescription}
                editable={false}
                style={[styles.input, styles.multiline, styles.readOnlyInput]}
                multiline
              />
            </Field>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Service Scope</Text>
            <Field label="Given Service Description">
              <TextInput
                value={description}
                onChangeText={setDescription}
                style={[styles.input, styles.multiline]}
                multiline
              />
            </Field>
            <Field label="What is Included">
              <TextInput
                value={whatIsIncluded}
                onChangeText={setWhatIsIncluded}
                style={[styles.input, styles.multiline]}
                multiline
              />
            </Field>
            <Field label="What is Not Included">
              <TextInput
                value={whatIsNotIncluded}
                onChangeText={setWhatIsNotIncluded}
                style={[styles.input, styles.multiline]}
                multiline
              />
            </Field>
            <Field label="Client Must Provide">
              <TextInput
                value={clientMustProvide}
                onChangeText={setClientMustProvide}
                style={[styles.input, styles.multiline]}
                multiline
              />
            </Field>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Availability and Area</Text>
            <Field label="Service Area Notes">
              <TextInput
                value={serviceAreaNotes}
                onChangeText={setServiceAreaNotes}
                style={[styles.input, styles.multiline]}
                multiline
              />
            </Field>
            <View style={styles.row}>
              <View style={styles.col}>
                <Field label="Advance Booking Required Hours">
                  <TextInput
                    value={advanceBookingRequiredHours}
                    onChangeText={setAdvanceBookingRequiredHours}
                    keyboardType="numeric"
                    style={styles.input}
                  />
                </Field>
              </View>
              <View style={styles.col}>
                <Field label="Service Radius (Km)">
                  <TextInput
                    value={serviceRadiusKm}
                    onChangeText={setServiceRadiusKm}
                    keyboardType="numeric"
                    style={styles.input}
                  />
                </Field>
              </View>
            </View>
            <SwitchRow
              label="Tools Provided By Provider"
              value={toolsProvidedByProvider}
              onValueChange={setToolsProvidedByProvider}
            />
            <SwitchRow
              label="Available Immediately"
              value={isAvailableImmediately}
              onValueChange={setIsAvailableImmediately}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Pricing and Duration</Text>
            <View style={styles.field}>
              <Text style={styles.label}>Pricing type</Text>
              <View style={styles.pricingTypeToggle}>
                <Pressable
                  style={[
                    styles.pricingTypeBtn,
                    pricingType === "FIXED" && styles.pricingTypeBtnActive,
                  ]}
                  onPress={() => setPricingType("FIXED")}
                >
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
            <Field label="Price">
              <TextInput
                value={basePrice}
                onChangeText={setBasePrice}
                keyboardType="decimal-pad"
                style={styles.input}
              />
            </Field>
            <View style={styles.row}>
              <View style={styles.col}>
                <Field label="Minimum Hours">
                  <TextInput
                    value={minimumHours}
                    onChangeText={setMinimumHours}
                    keyboardType="numeric"
                    style={styles.input}
                  />
                </Field>
              </View>
              <View style={styles.col}>
                <Field label="Estimated Duration Minutes">
                  <TextInput
                    value={estimatedDurationMinutes}
                    onChangeText={setEstimatedDurationMinutes}
                    keyboardType="numeric"
                    style={styles.input}
                  />
                </Field>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.loginButton,
              (!canSave || saving) && styles.loginButtonDisabled,
            ]}
            onPress={() => void onSave()}
            activeOpacity={0.9}
            disabled={!canSave || saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <View style={styles.loginButtonContent}>
                <Ionicons name="sparkles-outline" size={16} color="#FFFFFF" />
                <Text style={styles.loginButtonText}>Save</Text>
              </View>
            )}
          </TouchableOpacity>
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
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    backgroundColor: "#FFF",
  },
  backBtn: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  backText: { color: "#4F46E5", fontSize: 15, fontWeight: "700" },
  title: { fontSize: 20, fontWeight: "900", color: "#111827", marginTop: 2 },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: { fontSize: 14, color: "#64748B", fontWeight: "600" },
  content: { padding: 16, gap: 14, paddingBottom: 32 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    gap: 10,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: "#0F172A",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  row: { flexDirection: "row", gap: 12 },
  col: { flex: 1 },
  field: { gap: 6 },
  label: { fontSize: 12, fontWeight: "800", color: "#334155" },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    backgroundColor: "#FFF",
    paddingHorizontal: 12,
    fontSize: 13,
    color: "#111827",
  },
  readOnlyInput: {
    backgroundColor: "#F8FAFC",
    color: "#475569",
  },
  multiline: {
    minHeight: 90,
    height: 90,
    textAlignVertical: "top",
    paddingTop: 10,
  },
  switchRow: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFF",
    paddingHorizontal: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  switchLabel: { fontSize: 13, fontWeight: "700", color: "#334155" },
  pricingTypeToggle: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  pricingTypeBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 8,
  },
  pricingTypeBtnActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  pricingTypeBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  pricingTypeBtnTextActive: {
    color: "#4F46E5",
    fontWeight: "700",
  },
  loginButton: {
    alignSelf: "center",
    minWidth: 170,
    height: 48,
    borderRadius: 999,
    backgroundColor: "#6366F1",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    shadowColor: "#4338CA",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 3,
  },
  loginButtonDisabled: { opacity: 0.55 },
  loginButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});
