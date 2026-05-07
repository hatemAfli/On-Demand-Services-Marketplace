import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ProviderStackParamList } from "../../../navigation/types";
import { api } from "../../../services/api";
import { supabase } from "../../../services/supabase";
import { requestPhotoLibraryPermission } from "../../../services/clientAvatarUpload";
import {
  uploadProviderVerificationDocument,
  isImageMimeOrPath,
} from "../../../services/providerDocumentUpload";
import {
  PROVIDER_DOCUMENT_TYPES,
  type ProviderDocumentType,
} from "../../../types/documents";
import { Ionicons } from "@expo/vector-icons";

type Nav = NativeStackNavigationProp<
  ProviderStackParamList,
  "ProviderRequestService"
>;

type ServiceRow = {
  id: string;
  name: string;
  category?: { id?: string; name: string } | null;
  active?: boolean;
};

type PendingDoc = {
  id: string;
  localUri: string;
  mimeType?: string | null;
  fileName?: string | null;
  documentType: ProviderDocumentType;
};

export const ProviderRequestServiceScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(
    null,
  );
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(
    null,
  );
  const [pendingDocs, setPendingDocs] = useState<PendingDoc[]>([]);
  const [typePickerVisible, setTypePickerVisible] = useState(false);
  const [sourcePickerVisible, setSourcePickerVisible] = useState(false);
  const [pendingPick, setPendingPick] = useState<{
    uri: string;
    mimeType?: string | null;
    fileName?: string | null;
  } | null>(null);

  const loadServices = useCallback(async () => {
    setLoading(true);
    try {
      const [servicesRes, requestsRes] = await Promise.all([
        api.listServices(),
        api.getMyVerificationRequests(),
      ]);
      const all = (
        Array.isArray(servicesRes.data) ? servicesRes.data : []
      ) as ServiceRow[];
      const requests = (
        Array.isArray(requestsRes.data) ? requestsRes.data : []
      ) as Array<{ service?: { id: string } | null; requestStatus: string }>;

      const blocked = new Set(
        requests
          .filter((r) => r.requestStatus === "APPROVED")
          .map((r) => r.service?.id)
          .filter((id): id is string => Boolean(id)),
      );
      setServices(all.filter((s) => s.active !== false && !blocked.has(s.id)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadServices();
  }, [loadServices]);

  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; items: ServiceRow[] }>();
    for (const s of services) {
      const key = s.category?.id ?? "other";
      const name = s.category?.name ?? "Other services";
      const bucket = map.get(key);
      if (bucket) bucket.items.push(s);
      else map.set(key, { name, items: [s] });
    }
    return Array.from(map.entries()).map(([id, bucket]) => ({
      id,
      ...bucket,
    }));
  }, [services]);

  useEffect(() => {
    if (grouped.length === 0) {
      setExpandedCategoryId(null);
      return;
    }
    if (
      expandedCategoryId &&
      grouped.some((group) => group.id === expandedCategoryId)
    ) {
      return;
    }
    setExpandedCategoryId(grouped[0].id);
  }, [expandedCategoryId, grouped]);

  const labelForDocType = (dt: string) => {
    const map: Record<string, string> = {
      IDENTITY: "Identity",
      LICENSE: "License",
      QUALIFICATION: "Qualification",
      INSURANCE: "Insurance",
      OTHER: "Other",
    };
    return map[dt] ?? dt;
  };

  const onPickFromGallery = async () => {
    setSourcePickerVisible(false);
    const ok = await requestPhotoLibraryPermission();
    if (!ok) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.9,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      const asset = result.assets[0];
      setPendingPick({
        uri: asset.uri,
        mimeType: asset.mimeType ?? undefined,
        fileName: null,
      });
      setTypePickerVisible(true);
    }
  };

  const onPickFromFiles = async () => {
    setSourcePickerVisible(false);
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      type: [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ],
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setPendingPick({
      uri: asset.uri,
      mimeType: asset.mimeType ?? undefined,
      fileName: asset.name,
    });
    setTypePickerVisible(true);
  };

  const confirmDocType = (documentType: ProviderDocumentType) => {
    if (!pendingPick) return;
    setPendingDocs((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        localUri: pendingPick.uri,
        mimeType: pendingPick.mimeType,
        fileName: pendingPick.fileName,
        documentType,
      },
    ]);
    setPendingPick(null);
    setTypePickerVisible(false);
  };

  const submit = async () => {
    if (!selectedServiceId || pendingDocs.length === 0) return;
    setSubmitting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user?.id) throw new Error("Not signed in");
      const uid = session.user.id;
      const docs: { type: string; fichierUrl: string }[] = [];
      for (const d of pendingDocs) {
        const url = await uploadProviderVerificationDocument(uid, d.localUri, {
          mimeType: d.mimeType,
          fileName: d.fileName,
        });
        docs.push({ type: d.documentType, fichierUrl: url });
      }
      await api.createProviderServiceRequest({
        serviceId: selectedServiceId,
        documents: docs,
      });
      navigation.goBack();
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit =
    !!selectedServiceId && pendingDocs.length > 0 && !submitting;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <View style={styles.backBtnInner}>
            <Ionicons name="chevron-back" size={18} color="#1A1A2E" />
          </View>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Request a New Service</Text>
          <Text style={styles.subtitle}>
            Select a service and attach your documents
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color="#7C5CFC" />
            <Text style={styles.loadingText}>Loading services…</Text>
          </View>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Section: Choose a service */}
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconWrap}>
              <Ionicons name="grid-outline" size={13} color="#7C5CFC" />
            </View>
            <Text style={styles.sectionTitle}>Choose a service</Text>
          </View>

          {grouped.map((group) => {
            const expanded = expandedCategoryId === group.id;
            return (
              <View key={group.id} style={styles.card}>
                <TouchableOpacity
                  style={styles.categoryHeader}
                  onPress={() =>
                    setExpandedCategoryId(expanded ? null : group.id)
                  }
                  activeOpacity={0.85}
                >
                  <View style={styles.categoryTitleWrap}>
                    <Text style={styles.groupTitle}>{group.name}</Text>
                    <Text style={styles.categoryCount}>
                      {group.items.length} service
                      {group.items.length > 1 ? "s" : ""}
                    </Text>
                  </View>
                  <Ionicons
                    name={expanded ? "chevron-up" : "chevron-down"}
                    size={18}
                    color="#6B7280"
                  />
                </TouchableOpacity>
                {expanded ? (
                  <>
                    <View style={styles.groupDivider} />
                    {group.items.map((s, idx) => {
                      const selected = s.id === selectedServiceId;
                      return (
                        <React.Fragment key={s.id}>
                          {idx > 0 && <View style={styles.itemDivider} />}
                          <TouchableOpacity
                            style={[
                              styles.serviceRow,
                              selected && styles.serviceRowSelected,
                            ]}
                            onPress={() => setSelectedServiceId(s.id)}
                            activeOpacity={0.7}
                          >
                            <View
                              style={[
                                styles.serviceRadio,
                                selected && styles.serviceRadioSelected,
                              ]}
                            >
                              {selected && <View style={styles.serviceRadioDot} />}
                            </View>
                            <Text
                              style={[
                                styles.serviceText,
                                selected && styles.serviceTextSel,
                              ]}
                            >
                              {s.name}
                            </Text>
                            {selected && (
                              <Ionicons
                                name="checkmark-circle"
                                size={18}
                                color="#7C5CFC"
                              />
                            )}
                          </TouchableOpacity>
                        </React.Fragment>
                      );
                    })}
                  </>
                ) : null}
              </View>
            );
          })}

          {/* Section: Documents */}
          <View style={[styles.sectionHeader, { marginTop: 20 }]}>
            <View style={styles.sectionIconWrap}>
              <Ionicons
                name="shield-checkmark-outline"
                size={13}
                color="#7C5CFC"
              />
            </View>
            <Text style={styles.sectionTitle}>Verification documents</Text>
          </View>

          {pendingDocs.length > 0 && (
            <View style={styles.card}>
              {pendingDocs.map((d, idx) => (
                <React.Fragment key={d.id}>
                  {idx > 0 && <View style={styles.itemDivider} />}
                  <View style={styles.docRow}>
                    {isImageMimeOrPath(d.mimeType, d.localUri) ? (
                      <Image
                        source={{ uri: d.localUri }}
                        style={styles.docThumb}
                      />
                    ) : (
                      <View style={styles.docThumbPlaceholder}>
                        <Ionicons
                          name="document-text-outline"
                          size={20}
                          color="#7C5CFC"
                        />
                      </View>
                    )}
                    <View style={styles.docInfo}>
                      <Text style={styles.docName}>
                        {labelForDocType(d.documentType)}
                      </Text>
                      {d.fileName ? (
                        <Text style={styles.docFileName} numberOfLines={1}>
                          {d.fileName}
                        </Text>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      style={styles.docRemoveBtn}
                      onPress={() =>
                        setPendingDocs((prev) =>
                          prev.filter((it) => it.id !== d.id),
                        )
                      }
                    >
                      <Ionicons
                        name="trash-outline"
                        size={15}
                        color="#EF4444"
                      />
                    </TouchableOpacity>
                  </View>
                </React.Fragment>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={styles.addDocBtn}
            onPress={() => setSourcePickerVisible(true)}
            activeOpacity={0.75}
          >
            <View style={styles.addDocIconWrap}>
              <Ionicons name="add" size={16} color="#7C5CFC" />
            </View>
            <Text style={styles.addDocText}>Add verification document</Text>
          </TouchableOpacity>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
            disabled={!canSubmit}
            onPress={() => void submit()}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <View style={styles.submitBtnContent}>
                <Ionicons name="send-outline" size={15} color="#FFF" />
                <Text style={styles.submitText}>Submit request</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.bottomPad} />
        </ScrollView>
      )}

      {/* Source picker modal */}
      <Modal visible={sourcePickerVisible} transparent animationType="fade">
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setSourcePickerVisible(false)}
        >
          <Pressable
            style={styles.modalCard}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Add document</Text>
            <TouchableOpacity
              style={styles.modalRow}
              onPress={() => void onPickFromGallery()}
            >
              <View style={styles.modalIconWrap}>
                <Ionicons name="images-outline" size={18} color="#7C5CFC" />
              </View>
              <Text style={styles.modalText}>Photo from gallery</Text>
              <Ionicons name="chevron-forward" size={16} color="#C4C4C4" />
            </TouchableOpacity>
            <View style={styles.modalDivider} />
            <TouchableOpacity
              style={styles.modalRow}
              onPress={() => void onPickFromFiles()}
            >
              <View style={styles.modalIconWrap}>
                <Ionicons
                  name="folder-open-outline"
                  size={18}
                  color="#7C5CFC"
                />
              </View>
              <Text style={styles.modalText}>Document from files</Text>
              <Ionicons name="chevron-forward" size={16} color="#C4C4C4" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setSourcePickerVisible(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Type picker modal */}
      <Modal visible={typePickerVisible} transparent animationType="fade">
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setTypePickerVisible(false)}
        >
          <Pressable
            style={styles.modalCard}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Document type</Text>
            {PROVIDER_DOCUMENT_TYPES.map((dt, idx) => (
              <React.Fragment key={dt}>
                {idx > 0 && <View style={styles.modalDivider} />}
                <TouchableOpacity
                  style={styles.modalRow}
                  onPress={() => confirmDocType(dt)}
                >
                  <View style={styles.modalIconWrap}>
                    <Ionicons
                      name={
                        dt === "IDENTITY"
                          ? "card-outline"
                          : dt === "LICENSE"
                            ? "ribbon-outline"
                            : dt === "QUALIFICATION"
                              ? "school-outline"
                              : dt === "INSURANCE"
                                ? "shield-outline"
                                : "document-outline"
                      }
                      size={18}
                      color="#7C5CFC"
                    />
                  </View>
                  <Text style={styles.modalText}>{labelForDocType(dt)}</Text>
                  <Ionicons name="chevron-forward" size={16} color="#C4C4C4" />
                </TouchableOpacity>
              </React.Fragment>
            ))}
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setTypePickerVisible(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F3FA" },

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
    shadowColor: "#7C5CFC",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  backBtn: { padding: 4 },
  backBtnInner: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#F4F3FA",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E8E8F0",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerSpacer: { width: 44 },
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
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    gap: 14,
    shadowColor: "#7C5CFC",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 4,
  },
  loadingText: {
    fontSize: 14,
    color: "#7C5CFC",
    fontWeight: "600",
    letterSpacing: 0.1,
  },

  /* Content */
  content: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 20 },
  bottomPad: { height: 16 },

  /* Section header */
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: "#EDE9FE",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#7C5CFC",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },

  /* Card */
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EBEBF5",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    shadowColor: "#1A1A2E",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  groupTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#3A3A50",
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  categoryTitleWrap: {
    flex: 1,
    gap: 2,
  },
  categoryCount: {
    fontSize: 11,
    color: "#9B9BB0",
    fontWeight: "600",
  },
  groupDivider: {
    height: 1,
    backgroundColor: "#F4F3FA",
    marginVertical: 8,
  },
  itemDivider: {
    height: 1,
    backgroundColor: "#F4F3FA",
    marginVertical: 2,
  },

  /* Service row */
  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 2,
    borderRadius: 10,
  },
  serviceRowSelected: {
    backgroundColor: "#F5F3FF",
    paddingHorizontal: 8,
    marginHorizontal: -4,
    borderRadius: 10,
  },
  serviceRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#DEDEE8",
    alignItems: "center",
    justifyContent: "center",
  },
  serviceRadioSelected: { borderColor: "#7C5CFC" },
  serviceRadioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#7C5CFC",
  },
  serviceText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#3A3A50",
  },
  serviceTextSel: { color: "#7C5CFC", fontWeight: "700" },

  /* Doc row */
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  docThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#EBEBF5",
  },
  docThumbPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#EDE9FE",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#C4B5FD",
  },
  docInfo: { flex: 1, gap: 2 },
  docName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1A1A2E",
  },
  docFileName: {
    fontSize: 11,
    color: "#9B9BB0",
    fontWeight: "500",
  },
  docRemoveBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FECACA",
  },

  /* Add doc button */
  addDocBtn: {
    height: 50,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#C4B5FD",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#FAFAFF",
    marginBottom: 20,
  },
  addDocIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: "#EDE9FE",
    alignItems: "center",
    justifyContent: "center",
  },
  addDocText: {
    color: "#7C5CFC",
    fontWeight: "700",
    fontSize: 14,
  },

  /* Submit button */
  submitBtn: {
    height: 52,
    borderRadius: 999,
    backgroundColor: "#7C5CFC",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#7C5CFC",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  submitBtnDisabled: { opacity: 0.45, shadowOpacity: 0 },
  submitBtnContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  submitText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 15,
    letterSpacing: 0.2,
  },

  /* Modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,15,35,0.45)",
    justifyContent: "flex-end",
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#EBEBF5",
    paddingBottom: 4,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E0E0EC",
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#9B9BB0",
    textTransform: "uppercase",
    letterSpacing: 0.9,
    textAlign: "center",
    paddingVertical: 10,
  },
  modalDivider: {
    height: 1,
    backgroundColor: "#F4F3FA",
    marginHorizontal: 14,
  },
  modalRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  modalIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#EDE9FE",
    alignItems: "center",
    justifyContent: "center",
  },
  modalText: {
    flex: 1,
    color: "#1A1A2E",
    fontWeight: "600",
    fontSize: 15,
  },
  modalCancelBtn: {
    margin: 12,
    marginTop: 6,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#F4F3FA",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#EBEBF5",
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#6B6B80",
  },
});
