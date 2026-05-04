import React from "react";
import {
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ProviderStackParamList } from "../../../navigation/types";
import { useAppTranslation } from "../../../hooks/useAppTranslation";

type Nav = NativeStackNavigationProp<
  ProviderStackParamList,
  "ProviderDocumentDetails"
>;
type DocRoute = RouteProp<ProviderStackParamList, "ProviderDocumentDetails">;

export const ProviderDocumentDetailsScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<DocRoute>();
  const { t } = useAppTranslation();
  const { document } = route.params;

  const formatDate = (value: string) => {
    try {
      return new Date(value).toLocaleString("en-GB", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return value;
    }
  };

  const prettify = (raw: string) =>
    raw
      .toLowerCase()
      .split("_")
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ");

  const status = document.validatedAt
    ? "APPROVED"
    : (document.verificationRequest?.requestStatus ?? "PENDING");

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.back}
          onPress={() => navigation.goBack()}
          activeOpacity={0.85}
        >
          <Text style={styles.backText}>
            ← {t("provider.documentDetails.back")}
          </Text>
        </TouchableOpacity>

        <View style={styles.card}>
          <Text style={styles.title}>
            {t("provider.documentDetails.title")}
          </Text>
          <View style={styles.row}>
            <Text style={styles.label}>
              {t("provider.documentDetails.type")}
            </Text>
            <Text style={styles.value}>{prettify(document.type)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>
              {t("provider.documentDetails.status")}
            </Text>
            <Text style={styles.value}>{status}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>
              {t("provider.documentDetails.uploadedAt")}
            </Text>
            <Text style={styles.value}>{formatDate(document.uploadedAt)}</Text>
          </View>
          {document.validatedAt ? (
            <View style={styles.row}>
              <Text style={styles.label}>
                {t("provider.documentDetails.validatedAt")}
              </Text>
              <Text style={styles.value}>
                {formatDate(document.validatedAt)}
              </Text>
            </View>
          ) : null}
          <View style={styles.row}>
            <Text style={styles.label}>
              {t("provider.documentDetails.requestId")}
            </Text>
            <Text style={styles.value}>
              {document.verificationRequest?.id ?? "—"}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>
              {t("provider.documentDetails.ownerType")}
            </Text>
            <Text style={styles.value}>
              {document.verificationRequest?.ownerType ?? "—"}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>
              {t("provider.documentDetails.requestStatus")}
            </Text>
            <Text style={styles.value}>
              {document.verificationRequest?.requestStatus ?? "—"}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>
              {t("provider.documentDetails.requestCreated")}
            </Text>
            <Text style={styles.value}>
              {document.verificationRequest?.createdAt
                ? formatDate(document.verificationRequest.createdAt)
                : "—"}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>
              {t("provider.documentDetails.requestUpdated")}
            </Text>
            <Text style={styles.value}>
              {document.verificationRequest?.updatedAt
                ? formatDate(document.verificationRequest.updatedAt)
                : "—"}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>
              {t("provider.documentDetails.service")}
            </Text>
            <Text style={styles.value}>
              {document.verificationRequest?.service?.name ?? "—"}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>
              {t("provider.documentDetails.serviceCategory")}
            </Text>
            <Text style={styles.value}>
              {document.verificationRequest?.service?.category?.name ?? "—"}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>
              {t("provider.documentDetails.serviceId")}
            </Text>
            <Text style={styles.value}>
              {document.verificationRequest?.service?.id ??
                document.verificationRequest?.serviceId ??
                "—"}
            </Text>
          </View>
          {document.verificationRequest?.ownerComment ? (
            <View style={styles.rowBlock}>
              <Text style={styles.label}>
                {t("provider.documentDetails.myNote")}
              </Text>
              <Text style={styles.value}>
                {document.verificationRequest.ownerComment}
              </Text>
            </View>
          ) : null}
          {document.verificationRequest?.adminComment ? (
            <View style={styles.rowBlock}>
              <Text style={styles.label}>
                {t("provider.documentDetails.adminComment")}
              </Text>
              <Text style={styles.value}>
                {document.verificationRequest.adminComment}
              </Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={styles.openBtn}
            onPress={() => void Linking.openURL(document.fichierUrl)}
            activeOpacity={0.9}
          >
            <Ionicons name="open-outline" size={18} color="#FFF" />
            <Text style={styles.openText}>
              {t("provider.documentDetails.consultDocument")}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F8FAFC" },
  content: { padding: 16, paddingBottom: 24 },
  back: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  backText: { color: "#4F46E5", fontSize: 16, fontWeight: "600" },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    gap: 10,
  },
  title: { fontSize: 20, fontWeight: "800", color: "#0F172A", marginBottom: 4 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingBottom: 8,
  },
  rowBlock: {
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingBottom: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
  },
  value: {
    flex: 1,
    textAlign: "right",
    fontSize: 13,
    color: "#0F172A",
    fontWeight: "600",
  },
  openBtn: {
    marginTop: 8,
    height: 46,
    borderRadius: 12,
    backgroundColor: "#4F46E5",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  openText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
});
