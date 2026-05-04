import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppTranslation } from "../../hooks/useAppTranslation";
import { api } from "../../services/api";
import { LegalMarkdownRenderer } from "../../components/common/LegalMarkdownRenderer";

interface TermsScreenProps {
  navigation: { goBack: () => void };
}

export const TermsScreen: React.FC<TermsScreenProps> = ({ navigation }) => {
  const { isRTL, t, language } = useAppTranslation();
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.getLatestLegalDocument("TERMS");
        if (!mounted) return;
        setTitle(res.data.title);
        setContent(res.data.contentMarkdown);
      } catch (e) {
        if (!mounted) return;
        const maybeMessage = (
          e as { response?: { data?: { message?: unknown } } }
        )?.response?.data?.message;
        if (typeof maybeMessage === "string") setError(maybeMessage);
        else setError(t("common.error", { defaultValue: "Error" }));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [language, t]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Text style={styles.back}>← {t("common.back")}</Text>
        </TouchableOpacity>
        <Text style={[styles.title, isRTL && styles.rtl]}>
          {title ??
            t("legal.termsTitle", { defaultValue: "Terms & Conditions" })}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color="#111827" />
              <Text style={styles.loadingText}>Loading latest terms...</Text>
            </View>
          ) : (
            <>
              {error ? (
                <View style={styles.errorBox}>
                  <Text style={[styles.error, isRTL && styles.rtl]}>
                    {error}
                  </Text>
                </View>
              ) : null}
              <LegalMarkdownRenderer
                markdown={content?.trim() ?? ""}
                isRTL={isRTL}
              />
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFFFFF" },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backButton: {
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingRight: 8,
  },
  back: { color: "#111827", fontSize: 15, fontWeight: "600" },
  title: {
    color: "#111827",
    fontSize: 26,
    fontWeight: "800",
    marginTop: 20,
  },
  content: { padding: 20, paddingTop: 4 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
  },
  loadingWrap: { alignItems: "center", paddingVertical: 24, gap: 10 },
  loadingText: { color: "#6B7280", fontSize: 13 },
  errorBox: {
    borderRadius: 10,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    padding: 10,
    marginBottom: 12,
  },
  error: { color: "#B91C1C", lineHeight: 20, fontSize: 13 },
  rtl: { textAlign: "right", writingDirection: "rtl" },
});
