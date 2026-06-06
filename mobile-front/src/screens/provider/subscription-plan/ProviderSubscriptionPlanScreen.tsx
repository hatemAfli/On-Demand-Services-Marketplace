import React, { useLayoutEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ProviderStackParamList } from "../../../navigation/types";
import { useAppTranslation } from "../../../hooks/useAppTranslation";

type Nav = NativeStackNavigationProp<
  ProviderStackParamList,
  "ProviderSubscriptionPlan"
>;

const SCREEN_BG = "#F1F5F9";

export function ProviderSubscriptionPlanScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useAppTranslation();

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t("provider.screenTitles.ProviderSubscriptionPlan"),
      headerTitleAlign: "center",
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerSide}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={22} color="#0F172A" />
        </TouchableOpacity>
      ),
      headerRight: () => <View style={styles.headerSide} />,
    });
  }, [navigation, t]);

  return (
    <SafeAreaView style={styles.screen} edges={["bottom", "left", "right"]}>
      <View style={styles.content}>
        <Text style={styles.message}>
          {t("provider.screens.ProviderSubscriptionPlan")}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: SCREEN_BG,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  message: {
    fontSize: 15,
    fontWeight: "600",
    color: "#64748B",
    textAlign: "center",
    lineHeight: 22,
  },
  headerSide: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
});
