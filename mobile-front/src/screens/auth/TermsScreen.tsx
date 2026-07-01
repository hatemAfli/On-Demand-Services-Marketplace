import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useAppTranslation } from "../../hooks/useAppTranslation";
import { api } from "../../services/api";
import { LegalMarkdownRenderer } from "../../components/common/LegalMarkdownRenderer";
import {
  LEGAL_ACCENT,
  legalScreenStyles as styles,
} from "./legalScreenUi";

interface TermsScreenProps {
  navigation: { goBack: () => void };
}

export const TermsScreen: React.FC<TermsScreenProps> = ({ navigation }) => {
  const { isRTL, t, language } = useAppTranslation();
  const insets = useSafeAreaInsets();
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

  const displayTitle =
    title ?? t("legal.termsTitle", { defaultValue: "Terms & Conditions" });

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" />

      <View style={[styles.topBackContainer, { top: insets.top + 6 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.8}
        >
          <Text style={styles.back}>
            {isRTL ? "→" : "←"} {t("common.back")}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.content}>
          <View style={styles.headerRow}>
            <View style={styles.iconWrap}>
              <Ionicons name="document-text-outline" size={22} color={LEGAL_ACCENT} />
            </View>
            <View style={styles.titleWrap}>
              <Text style={[styles.title, isRTL && styles.rtl]}>{displayTitle}</Text>
              <Text style={[styles.subtitle, isRTL && styles.rtl]}>
                {t("legal.termsSubtitle", {
                  defaultValue: "Please read our terms before using the app.",
                })}
              </Text>
            </View>
          </View>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={LEGAL_ACCENT} size="large" />
              <Text style={styles.loadingText}>
                {t("legal.loadingTerms", {
                  defaultValue: "Loading latest terms...",
                })}
              </Text>
            </View>
          ) : (
            <>
              {error ? (
                <View style={styles.errorBox}>
                  <Text style={[styles.error, isRTL && styles.rtl]}>{error}</Text>
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
