import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../../navigation/types";
import { useAppTranslation } from "../../hooks/useAppTranslation";

interface PrivacyScreenProps {
  navigation: NativeStackNavigationProp<AuthStackParamList, "Privacy">;
}

export const PrivacyScreen: React.FC<PrivacyScreenProps> = ({ navigation }) => {
  const { isRTL, t } = useAppTranslation();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← {t("common.back")}</Text>
        </TouchableOpacity>
        <Text style={[styles.title, isRTL && styles.rtl]}>
          {t("legal.privacyTitle", { defaultValue: "Privacy Policy" })}
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.paragraph, isRTL && styles.rtl]}>
          {t("legal.privacyP1", {
            defaultValue:
              "We collect only the data needed to provide account access and service matching, such as profile details and authentication information.",
          })}
        </Text>
        <Text style={[styles.paragraph, isRTL && styles.rtl]}>
          {t("legal.privacyP2", {
            defaultValue:
              "Your data is processed securely and used to operate and improve platform features.",
          })}
        </Text>
        <Text style={[styles.paragraph, isRTL && styles.rtl]}>
          {t("legal.privacyP3", {
            defaultValue:
              "You can request updates or deletion of personal information through support channels.",
          })}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0A0E1A" },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6 },
  back: { color: "#E8C97A", fontSize: 15, fontWeight: "600" },
  title: { color: "#FFFFFF", fontSize: 24, fontWeight: "700", marginTop: 12 },
  content: { padding: 20, gap: 14 },
  paragraph: { color: "#B5B8C9", lineHeight: 22, fontSize: 15 },
  rtl: { textAlign: "right", writingDirection: "rtl" },
});
