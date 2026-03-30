import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../../navigation/types";
import { useAppTranslation } from "../../hooks/useAppTranslation";

interface TermsScreenProps {
  navigation: NativeStackNavigationProp<AuthStackParamList, "Terms">;
}

export const TermsScreen: React.FC<TermsScreenProps> = ({ navigation }) => {
  const { isRTL, t } = useAppTranslation();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← {t("common.back")}</Text>
        </TouchableOpacity>
        <Text style={[styles.title, isRTL && styles.rtl]}>
          {t("legal.termsTitle", { defaultValue: "Terms of Service" })}
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.paragraph, isRTL && styles.rtl]}>
          {t("legal.termsP1", {
            defaultValue:
              "Welcome to ServeMe. By using this app, you agree to use the platform in accordance with applicable laws and community rules.",
          })}
        </Text>
        <Text style={[styles.paragraph, isRTL && styles.rtl]}>
          {t("legal.termsP2", {
            defaultValue:
              "You are responsible for account security, the accuracy of submitted data, and lawful use of services.",
          })}
        </Text>
        <Text style={[styles.paragraph, isRTL && styles.rtl]}>
          {t("legal.termsP3", {
            defaultValue:
              "We may update these terms over time. Continued use means you accept the latest version.",
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
