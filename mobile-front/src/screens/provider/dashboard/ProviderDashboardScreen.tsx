import React, { useLayoutEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS } from "../../../constants";
import { useAppTranslation } from "../../../hooks/useAppTranslation";
import type { ProviderStackParamList } from "../../../navigation/types";

type Nav = NativeStackNavigationProp<
  ProviderStackParamList,
  "ProviderDashboard"
>;

export const ProviderDashboardScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { t } = useAppTranslation();

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t("provider.screenTitles.ProviderDashboard"),
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ marginLeft: 8, padding: 4 }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color={COLORS.text.primary}
          />
        </TouchableOpacity>
      ),
    });
  }, [navigation, t]);

  const title = t("provider.screenTitles.ProviderDashboard");
  const message = t("provider.screens.ProviderDashboard");

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
