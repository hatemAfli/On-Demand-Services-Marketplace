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
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import type { ClientStackParamList } from "../../../navigation/types";
import { getCategoryOption } from "../complaints/categoryMeta";

type Props = NativeStackScreenProps<
  ClientStackParamList,
  "ClientComplaintSuccess"
>;

const BRAND_ORANGE = "#EA580C";
const SUCCESS_GREEN = "#10B981";

const STEPS = [
  "Admin team reviews your complaint and evidence",
  "Provider is notified and given a chance to respond",
  "Admin takes action and updates you with the outcome",
] as const;

const INFO_ITEMS: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  iconColor: string;
  iconBg: string;
}[] = [
  {
    icon: "search-outline",
    title: "Under review",
    body: "Our team will investigate the issue thoroughly",
    iconColor: BRAND_ORANGE,
    iconBg: "#FFEDD5",
  },
  {
    icon: "notifications-outline",
    title: "We'll keep you updated",
    body: "You'll receive notifications as your complaint progresses",
    iconColor: "#2563EB",
    iconBg: "#EFF6FF",
  },
  {
    icon: "lock-closed-outline",
    title: "Your privacy is protected",
    body: "The provider will not see your personal information",
    iconColor: "#059669",
    iconBg: "#D1FAE5",
  },
];

export const ClientComplaintSuccessScreen: React.FC<Props> = ({
  route,
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const { category, providerName } = route.params;
  const categoryMeta = getCategoryOption(category);
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
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
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 16) + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.banner}>
          <View style={styles.bannerCircleLarge} />
          <View style={styles.bannerCircleSmall} />
          <View style={styles.bannerContent}>
            <Animated.View
              style={[
                styles.bannerIconWrap,
                { transform: [{ scale: scaleAnim }] },
              ]}
            >
              <Ionicons name="shield-checkmark" size={32} color={SUCCESS_GREEN} />
            </Animated.View>
            <Text style={styles.bannerTitle}>Complaint submitted</Text>
            <Text style={styles.bannerSubTitle}>
              We received your report about {providerName}
            </Text>
            {categoryMeta ? (
              <View style={styles.categoryChip}>
                <Ionicons
                  name={categoryMeta.icon}
                  size={14}
                  color={BRAND_ORANGE}
                />
                <Text style={styles.categoryChipText}>{categoryMeta.label}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.contentWrap}>
          <View style={styles.cardFloating}>
            <View style={styles.reviewPill}>
              <Ionicons name="time-outline" size={16} color={BRAND_ORANGE} />
              <Text style={styles.reviewPillText}>
                Review within 48 hours
              </Text>
            </View>

            <View style={styles.infoList}>
              {INFO_ITEMS.map((item) => (
                <View key={item.title} style={styles.infoRow}>
                  <View
                    style={[styles.infoIconWrap, { backgroundColor: item.iconBg }]}
                  >
                    <Ionicons
                      name={item.icon}
                      size={20}
                      color={item.iconColor}
                    />
                  </View>
                  <View style={styles.infoTextWrap}>
                    <Text style={styles.infoTitle}>{item.title}</Text>
                    <Text style={styles.infoBody}>{item.body}</Text>
                  </View>
                </View>
              ))}
            </View>

            <Text style={styles.sectionTitle}>What happens next</Text>
            <View style={styles.timelineWrap}>
              <View style={styles.timelineTrack} />
              <View style={styles.timelineProgress} />
              <View style={styles.timelineSteps}>
                {STEPS.map((line, i) => {
                  const isDone = i === 0;
                  const isActive = i === 1;
                  return (
                    <View key={line} style={styles.timelineStep}>
                      {isDone ? (
                        <View style={styles.timelineDotDone}>
                          <Ionicons
                            name="checkmark"
                            size={12}
                            color="#FFFFFF"
                          />
                        </View>
                      ) : null}
                      {isActive ? (
                        <View style={styles.timelineDotActive}>
                          <View style={styles.timelineDotActiveInner} />
                        </View>
                      ) : null}
                      {!isDone && !isActive ? (
                        <View style={styles.timelineDotPending} />
                      ) : null}
                      <View style={styles.timelineStepTextWrap}>
                        <Text
                          style={[
                            styles.timelineStepLabel,
                            (isDone || isActive) &&
                              styles.timelineStepLabelHighlight,
                          ]}
                        >
                          {line}
                        </Text>
                        {isActive ? (
                          <Text style={styles.timelineStepMeta}>In progress</Text>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>

          <View style={styles.actionsWrap}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={goMyComplaints}
              activeOpacity={0.9}
            >
              <Text style={styles.primaryButtonText}>View my complaints</Text>
              <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={goHome}
              activeOpacity={0.88}
            >
              <Text style={styles.secondaryButtonText}>Back to home</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  banner: {
    backgroundColor: BRAND_ORANGE,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 52,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    position: "relative",
    overflow: "hidden",
  },
  bannerCircleLarge: {
    position: "absolute",
    top: -64,
    right: -64,
    width: 220,
    height: 220,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 110,
  },
  bannerCircleSmall: {
    position: "absolute",
    bottom: -48,
    left: -40,
    width: 130,
    height: 130,
    backgroundColor: "rgba(234,88,12,0.28)",
    borderRadius: 65,
  },
  bannerContent: {
    alignItems: "center",
  },
  bannerIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#1E1B4B",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
    elevation: 4,
  },
  bannerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 6,
    textAlign: "center",
  },
  bannerSubTitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "#FFEDD5",
    textAlign: "center",
    lineHeight: 19,
    paddingHorizontal: 12,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: BRAND_ORANGE,
  },
  contentWrap: {
    paddingHorizontal: 24,
    marginTop: -36,
  },
  cardFloating: {
    backgroundColor: "#FFFFFF",
    borderRadius: 32,
    padding: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 20,
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 22,
    elevation: 4,
  },
  reviewPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    alignSelf: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FDBA74",
    marginBottom: 22,
  },
  reviewPillText: {
    fontSize: 13,
    fontWeight: "700",
    color: BRAND_ORANGE,
  },
  infoList: {
    gap: 14,
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  infoIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  infoTextWrap: {
    flex: 1,
    paddingTop: 2,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 4,
  },
  infoBody: {
    fontSize: 13,
    fontWeight: "500",
    color: "#64748B",
    lineHeight: 19,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 16,
  },
  timelineWrap: {
    position: "relative",
    paddingVertical: 4,
    minHeight: 168,
  },
  timelineTrack: {
    position: "absolute",
    left: 10,
    top: 14,
    bottom: 14,
    width: 2,
    backgroundColor: "#F1F5F9",
    borderRadius: 1,
  },
  timelineProgress: {
    position: "absolute",
    left: 10,
    top: 14,
    width: 2,
    height: 56,
    backgroundColor: SUCCESS_GREEN,
    borderRadius: 1,
  },
  timelineSteps: {
    gap: 20,
  },
  timelineStep: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  timelineDotDone: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: SUCCESS_GREEN,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineDotActive: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#34D399",
    alignItems: "center",
    justifyContent: "center",
  },
  timelineDotActiveInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FFFFFF",
  },
  timelineDotPending: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#E2E8F0",
  },
  timelineStepTextWrap: {
    flex: 1,
    paddingTop: 1,
  },
  timelineStepLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#94A3B8",
    lineHeight: 20,
  },
  timelineStepLabelHighlight: {
    color: "#0F172A",
    fontWeight: "700",
  },
  timelineStepMeta: {
    fontSize: 11,
    fontWeight: "600",
    color: SUCCESS_GREEN,
    marginTop: 4,
  },
  actionsWrap: {
    gap: 12,
    marginBottom: 8,
  },
  primaryButton: {
    backgroundColor: BRAND_ORANGE,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    shadowColor: BRAND_ORANGE,
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 16,
    elevation: 4,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  secondaryButton: {
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
  },
});
