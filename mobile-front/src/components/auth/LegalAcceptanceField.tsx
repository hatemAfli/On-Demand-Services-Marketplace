import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAppTranslation } from "../../hooks/useAppTranslation";
import { fetchLatestLegalVersionIds } from "../../services/legal-acceptance";
import type { AuthStackParamList } from "../../navigation/types";

const ACCENT = "#EA580C";

interface LegalAcceptanceFieldProps {
  navigation: NativeStackNavigationProp<AuthStackParamList>;
  accepted: boolean;
  onAcceptedChange: (accepted: boolean) => void;
  onVersionIdsReady: (versionIds: string[]) => void;
  error?: string;
}

export const LegalAcceptanceField: React.FC<LegalAcceptanceFieldProps> = ({
  navigation,
  accepted,
  onAcceptedChange,
  onVersionIdsReady,
  error,
}) => {
  const { t, isRTL } = useAppTranslation();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const versionIds = await fetchLatestLegalVersionIds();
        if (!cancelled) {
          onVersionIdsReady(versionIds);
          setLoadError(null);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setLoadError(
            e instanceof Error
              ? e.message
              : t("auth.legalAcceptanceLoadFailed"),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [onVersionIdsReady, t]);

  if (loading) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator color={ACCENT} size="small" />
        <Text style={styles.loadingText}>{t("auth.legalAcceptanceLoading")}</Text>
      </View>
    );
  }

  if (loadError) {
    return <Text style={styles.errorText}>{loadError}</Text>;
  }

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.85}
        onPress={() => onAcceptedChange(!accepted)}
      >
        <View style={[styles.checkbox, accepted && styles.checkboxChecked]}>
          {accepted ? <Text style={styles.checkmark}>✓</Text> : null}
        </View>
        <Text style={[styles.label, isRTL && styles.rtlText]}>
          {t("auth.legalAcceptancePrefix")}{" "}
          <Text
            style={styles.link}
            onPress={() => navigation.navigate("Terms")}
          >
            {t("welcome.termsLabel")}
          </Text>{" "}
          {t("auth.legalAcceptanceJoiner")}{" "}
          <Text
            style={styles.link}
            onPress={() => navigation.navigate("Privacy")}
          >
            {t("welcome.privacyLabel")}
          </Text>
        </Text>
      </TouchableOpacity>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  checkmark: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  label: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: "#475569",
  },
  link: {
    color: ACCENT,
    fontWeight: "600",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 13,
    color: "#64748B",
  },
  errorText: {
    marginTop: 6,
    fontSize: 12,
    color: "#DC2626",
  },
  rtlText: {
    textAlign: "right",
    writingDirection: "rtl",
  },
});
