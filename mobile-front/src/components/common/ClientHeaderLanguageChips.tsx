import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAppTranslation } from "../../hooks/useAppTranslation";
import { COLORS } from "../../constants";

/** Compact EN / AR chips for native stack header (light background). */
export const ClientHeaderLanguageChips: React.FC = () => {
  const { language, setLanguage, t } = useAppTranslation();

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={[styles.chip, language === "en" && styles.chipActive]}
        onPress={() => setLanguage("en")}
        accessibilityLabel={t("common.english")}
      >
        <Text style={[styles.text, language === "en" && styles.textActive]}>
          EN
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.chip, language === "ar" && styles.chipActive]}
        onPress={() => setLanguage("ar")}
        accessibilityLabel={t("common.arabic")}
      >
        <Text style={[styles.text, language === "ar" && styles.textActive]}>
          AR
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginEnd: 8,
  },
  chip: {
    minWidth: 40,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: {
    borderColor: COLORS.primary,
    backgroundColor: "rgba(79,70,229,0.08)",
  },
  text: {
    color: COLORS.text.secondary,
    fontWeight: "800",
    fontSize: 13,
  },
  textActive: {
    color: COLORS.primary,
  },
});
