import React, { useLayoutEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ClientStackParamList } from "../../../navigation/types";
import { COLORS } from "../../../constants";
import { useAppTranslation } from "../../../hooks/useAppTranslation";

type Props = NativeStackScreenProps<ClientStackParamList, "ClientLeaveReview">;

/** Placeholder — full review flow can be added here. */
export const ClientLeaveReviewScreen: React.FC<Props> = ({ route, navigation }) => {
  const { t } = useAppTranslation();
  useLayoutEffect(() => {
    navigation.setOptions({
      title: t("client.screenTitles.ClientLeaveReview"),
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ marginLeft: 8, padding: 4 }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.text.primary} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, t]);

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <View style={styles.root}>
        <Text style={styles.hint}>Review coming soon.</Text>
        <Text style={styles.meta} selectable>
          Appointment: {route.params.appointmentId}
        </Text>
        <Text style={styles.meta} selectable>
          Provider: {route.params.providerId}
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.gray[50] },
  root: { flex: 1, padding: 24 },
  hint: { fontSize: 16, fontWeight: "700", color: COLORS.text.primary },
  meta: { marginTop: 10, fontSize: 13, color: COLORS.text.secondary },
});
