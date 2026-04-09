import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS } from "../../constants";
import { useAppTranslation } from "../../hooks/useAppTranslation";
import type { ProviderStackParamList } from "../../navigation/types";

type Props = {
  screenKey: keyof ProviderStackParamList;
};

/** Shared placeholder layout for provider routes (title + short message). */
export const ProviderSimpleScreen: React.FC<Props> = ({ screenKey }) => {
  const { t } = useAppTranslation();
  const title = t(`provider.screenTitles.${screenKey}`);
  const message = t(`provider.screens.${screenKey}`);

  return (
    <LinearGradient
      colors={["#ffffff", "#eef2ff", "#f5f3ff"]}
      style={styles.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View style={styles.center}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardHint}>{message}</Text>
        </View>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  center: { flex: 1, justifyContent: "center", padding: 24 },
  card: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 18,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.18)",
    shadowColor: "#4338ca",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 5,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: COLORS.text.primary,
    textAlign: "center",
    marginBottom: 10,
  },
  cardHint: {
    fontSize: 14,
    color: COLORS.text.secondary,
    textAlign: "center",
    lineHeight: 22,
  },
});
