import React, { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import {
  Animated,
  BackHandler,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ClientStackParamList } from "../../../navigation/types";
import { COLORS } from "../../../constants";

type Props = NativeStackScreenProps<
  ClientStackParamList,
  "ClientComplaintSuccess"
>;

const SHIELD_BG = "#FEF2F2";
const SHIELD_ICON = "#DC2626";

const STEPS = [
  "Admin team reviews your complaint and evidence",
  "Provider is notified and given a chance to respond",
  "Admin takes action and updates you with the outcome",
] as const;

const INFO_ROWS: { title: string; body: string }[] = [
  {
    title: "🔍 Under review",
    body: "Our team will investigate the issue thoroughly",
  },
  {
    title: "📬 We'll keep you updated",
    body: "You'll receive notifications as your complaint progresses",
  },
  {
    title: "🔒 Your privacy is protected",
    body: "The provider will not see your personal information",
  },
];

export const ClientComplaintSuccessScreen: React.FC<Props> = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => null,
      gestureEnabled: false,
    });
  }, [navigation]);

  useEffect(() => {
    scaleAnim.setValue(0);
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 45,
      friction: 7,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const goHome = useCallback(() => {
    navigation.reset({
      index: 0,
      routes: [{ name: "ClientHome" }],
    });
  }, [navigation]);

  const goMyComplaints = useCallback(() => {
    navigation.replace("ClientMyComplaints");
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        goHome();
        return true;
      });
      return () => sub.remove();
    }, [goHome]),
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.shieldCircle,
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          <Ionicons name="shield-checkmark" size={80} color={SHIELD_ICON} />
        </Animated.View>

        <Text style={styles.title}>Complaint submitted</Text>
        <Text style={styles.subtitle}>
          Your complaint has been received and will be reviewed within 48 hours.
        </Text>

        <View style={styles.infoBlock}>
          {INFO_ROWS.map((row) => (
            <View key={row.title} style={styles.infoCard}>
              <Text style={styles.infoTitle}>{row.title}</Text>
              <Text style={styles.infoBody}>{row.body}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionHeading}>What happens next</Text>
        <View style={styles.stepsCard}>
          {STEPS.map((line, i) => (
            <View key={line} style={styles.stepRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>{i + 1}</Text>
              </View>
              <Text style={styles.stepText}>{line}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom, 16),
            paddingHorizontal: 20,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={goMyComplaints}
          activeOpacity={0.9}
        >
          <Text style={styles.btnPrimaryText}>View my complaints</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btnSecondary}
          onPress={goHome}
          activeOpacity={0.88}
        >
          <Text style={styles.btnSecondaryText}>Back to home</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 22,
    alignItems: "center",
    paddingTop: 28,
  },
  shieldCircle: {
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: SHIELD_BG,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.text.primary,
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.gray[600],
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
    maxWidth: 360,
  },
  infoBlock: {
    width: "100%",
    maxWidth: 400,
    gap: 12,
    marginBottom: 28,
  },
  infoCard: {
    backgroundColor: COLORS.gray[50],
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text.primary,
    marginBottom: 4,
  },
  infoBody: {
    fontSize: 14,
    color: COLORS.gray[600],
    lineHeight: 20,
  },
  sectionHeading: {
    alignSelf: "stretch",
    maxWidth: 400,
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.text.primary,
    marginBottom: 12,
  },
  stepsCard: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: COLORS.gray[50],
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 14,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  stepBadgeText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "800",
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.gray[700],
    lineHeight: 21,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.white,
    paddingTop: 14,
    gap: 10,
  },
  btnPrimary: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
  },
  btnPrimaryText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "700",
  },
  btnSecondary: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: COLORS.gray[300],
    backgroundColor: COLORS.white,
  },
  btnSecondaryText: {
    color: COLORS.text.primary,
    fontSize: 16,
    fontWeight: "700",
  },
});
