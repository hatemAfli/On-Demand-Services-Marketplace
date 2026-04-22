import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAppTranslation } from "../../hooks/useAppTranslation";

export const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage } = useAppTranslation();

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={[styles.chip, language === "en" && styles.chipActive]}
        onPress={() => setLanguage("en")}
      >
        <Text style={[styles.text, language === "en" && styles.textActive]}>EN</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.chip, language === "ar" && styles.chipActive]}
        onPress={() => setLanguage("ar")}
      >
        <Text style={[styles.text, language === "ar" && styles.textActive]}>AR</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10, alignItems: "center" },
  chip: {
    minWidth: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#F9FAFB",
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: {
    borderColor: "#C9A84C",
    backgroundColor: "#FEF3C7",
  },
  text: {
    color: "#374151",
    fontWeight: "700",
    fontSize: 15,
  },
  textActive: { color: "#92400E" },
});
