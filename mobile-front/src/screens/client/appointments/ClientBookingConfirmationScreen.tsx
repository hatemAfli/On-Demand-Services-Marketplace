import React, { useCallback, useEffect, useMemo, useRef } from "react";
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

type Props = NativeStackScreenProps<
  ClientStackParamList,
  "ClientBookingConfirmation"
>;

const ACCENT = "#EA580C";
const ACCENT_LIGHT = "#FFF7ED";
const ACCENT_BORDER = "#FFEDD5";
const SCREEN_BG = "#F1F5F9";
const SUCCESS_BG = "#ECFDF5";
const SUCCESS_BORDER = "#A7F3D0";
const CHECK_GREEN = "#059669";

function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export const ClientBookingConfirmationScreen: React.FC<Props> = ({
  route,
  navigation,
}) => {
  const { providerName, serviceName, scheduledDate, scheduledTime } =
    route.params;
  const insets = useSafeAreaInsets();
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 55,
        friction: 6.5,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 520,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, fadeAnim]);

  const goHome = useCallback(() => {
    navigation.reset({
      index: 0,
      routes: [{ name: "ClientHome" }],
    });
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

  const dateFormatted = useMemo(() => {
    try {
      return parseYmd(scheduledDate).toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return scheduledDate;
    }
  }, [scheduledDate]);

  const goBookings = () => {
    navigation.reset({
      index: 1,
      routes: [{ name: "ClientHome" }, { name: "ClientAppointments" }],
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      {/* cute, subtle background */}
      <View pointerEvents="none" style={styles.bg}>
        <View style={styles.blob1} />
        <View style={styles.blob2} />
        <View style={styles.blob3} />
        <Ionicons
          name="sparkles"
          size={18}
          color={ACCENT}
          style={styles.sparkleA}
        />
        <Ionicons
          name="sparkles"
          size={16}
          color="#F59E0B"
          style={styles.sparkleB}
        />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 28 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Success Icon with Animation */}
        <Animated.View
          style={[
            styles.iconOuter,
            { transform: [{ scale: scaleAnim }], opacity: fadeAnim },
          ]}
        >
          <View style={styles.iconHalo}>
            <View style={styles.iconCircle}>
              <Ionicons name="checkmark-circle" size={42} color={CHECK_GREEN} />
            </View>
          </View>

          <View style={styles.miniTag}>
            <Ionicons name="heart" size={11} color={ACCENT} />
            <Text style={styles.miniTagText}>All set</Text>
          </View>
        </Animated.View>

        {/* Main Title */}
        <Animated.Text style={[styles.title, { opacity: fadeAnim }]}>
          Request sent!
        </Animated.Text>

        {/* Subtitle */}
        <Animated.Text style={[styles.subtitle, { opacity: fadeAnim }]}>
          Your booking request has been sent to{" "}
          <Text style={styles.subtitleBold}>{providerName}</Text>. You'll be
          notified once they respond.
        </Animated.Text>

        {/* Recap Card */}
        <Animated.View style={[styles.recapCard, { opacity: fadeAnim }]}>
          <View style={styles.recapHeader}>
            <View style={styles.recapHeaderLeft}>
              <View style={styles.recapHeaderBadge}>
                <Ionicons name="receipt-outline" size={14} color={ACCENT} />
              </View>
              <View>
                <Text style={styles.recapHeaderTitle}>Booking details</Text>
                <Text style={styles.recapHeaderSub}>
                  Please review the request summary
                </Text>
              </View>
            </View>

            <View style={styles.statusPill}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Pending</Text>
            </View>
          </View>

          <View style={styles.softDivider} />

          {/* Service Row */}
          <View style={styles.recapRow}>
            <View style={[styles.iconBadge, styles.badgeAccent]}>
              <Ionicons name="briefcase-outline" size={16} color={ACCENT} />
            </View>
            <View style={styles.recapTextCol}>
              <Text style={styles.recapLabel}>Service</Text>
              <Text style={styles.recapValue} numberOfLines={1}>
                {serviceName}
              </Text>
            </View>
          </View>

          {/* Provider Row */}
          <View style={styles.recapRow}>
            <View style={[styles.iconBadge, styles.badgePink]}>
              <Ionicons name="person-outline" size={16} color="#DB2777" />
            </View>
            <View style={styles.recapTextCol}>
              <Text style={styles.recapLabel}>Provider</Text>
              <Text style={styles.recapValue} numberOfLines={1}>
                {providerName}
              </Text>
            </View>
          </View>

          {/* Date Row */}
          <View style={styles.recapRow}>
            <View style={[styles.iconBadge, styles.badgeSky]}>
              <Ionicons name="calendar-outline" size={16} color="#0284C7" />
            </View>
            <View style={styles.recapTextCol}>
              <Text style={styles.recapLabel}>Scheduled Date</Text>
              <Text style={styles.recapValue}>{dateFormatted}</Text>
            </View>
          </View>

          {/* Time Row */}
          <View style={styles.recapRow}>
            <View style={[styles.iconBadge, styles.badgeMint]}>
              <Ionicons name="time-outline" size={16} color="#059669" />
            </View>
            <View style={styles.recapTextCol}>
              <Text style={styles.recapLabel}>Scheduled Time</Text>
              <Text style={styles.recapValue}>{scheduledTime}</Text>
            </View>
          </View>

          {/* Clear “what next” footer */}
          <View style={styles.nextCard}>
            <Ionicons name="notifications-outline" size={15} color={ACCENT} />
            <Text style={styles.nextText}>
              We’ll notify you when the provider confirms or proposes a new
              time.
            </Text>
          </View>
        </Animated.View>

        {/* Action Buttons */}
        <View style={styles.actionsWrap}>
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={goBookings}
            activeOpacity={0.88}
          >
            <View style={styles.btnPrimaryIcon}>
              <Ionicons name="calendar-outline" size={15} color="#fff" />
            </View>
            <Text style={styles.btnPrimaryText}>View My Bookings</Text>
            <Ionicons
              name="chevron-forward"
              size={15}
              color="rgba(255,255,255,0.92)"
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnSecondary}
            onPress={goHome}
            activeOpacity={0.88}
          >
            <Ionicons name="home-outline" size={15} color={ACCENT} />
            <Text style={styles.btnSecondaryText}>Back to Home</Text>
          </TouchableOpacity>
        </View>

        {/* tiny reassurance */}
        <View style={styles.footerHint}>
          <Ionicons
            name="lock-closed-outline"
            size={14}
            color="#6B7280"
          />
          <Text style={styles.footerHintText}>
            Your details stay private and secure.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: SCREEN_BG },

  /* Background */
  bg: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  blob1: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 160,
    backgroundColor: ACCENT_LIGHT,
    top: -110,
    left: -110,
    opacity: 0.95,
  },
  blob2: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 150,
    backgroundColor: ACCENT_BORDER,
    top: 10,
    right: -130,
    opacity: 0.85,
  },
  blob3: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 170,
    backgroundColor: "#FFFBEB",
    bottom: -170,
    left: -90,
    opacity: 0.75,
  },
  sparkleA: { position: "absolute", top: 52, right: 28, opacity: 0.75 },
  sparkleB: { position: "absolute", top: 120, left: 22, opacity: 0.65 },

  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingTop: 16,
  },

  /* Icon */
  iconOuter: { alignSelf: "center", marginBottom: 10 },
  iconHalo: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 1,
    borderColor: "rgba(234,88,12,0.25)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: ACCENT,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: SUCCESS_BG,
    borderWidth: 2,
    borderColor: SUCCESS_BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  miniTag: {
    position: "absolute",
    right: -6,
    top: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(234,88,12,0.25)",
    shadowColor: ACCENT,
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  miniTagText: { fontSize: 10, fontWeight: "800", color: ACCENT },

  /* Typography */
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
    letterSpacing: -0.4,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 19,
    paddingHorizontal: 8,
  },
  subtitleBold: { fontWeight: "800", color: "#374151" },

  /* Recap card */
  recapCard: {
    marginTop: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
    padding: 12,
    gap: 10,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 3,
  },
  recapHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  recapHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  recapHeaderBadge: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: ACCENT_LIGHT,
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  recapHeaderTitle: { fontSize: 12, fontWeight: "800", color: "#111827" },
  recapHeaderSub: {
    marginTop: 1,
    fontSize: 11,
    fontWeight: "600",
    color: "#9CA3AF",
  },

  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FED7AA",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#F59E0B",
  },
  statusText: { fontSize: 10, fontWeight: "800", color: "#9A3412" },

  softDivider: {
    height: 1,
    backgroundColor: ACCENT_BORDER,
  },

  recapRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.05)",
  },
  badgeAccent: { backgroundColor: ACCENT_LIGHT },
  badgePink: { backgroundColor: "#FCE7F3" },
  badgeSky: { backgroundColor: "#E0F2FE" },
  badgeMint: { backgroundColor: "#ECFDF5" },

  recapTextCol: { flex: 1, justifyContent: "center" },
  recapLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  recapValue: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
  },

  nextCard: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: ACCENT_LIGHT,
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
    padding: 10,
    borderRadius: 14,
  },
  nextText: {
    flex: 1,
    fontSize: 11,
    fontWeight: "600",
    color: "#6B7280",
    lineHeight: 16,
  },

  /* Buttons — compact & cute */
  actionsWrap: {
    marginTop: 14,
    gap: 8,
    alignSelf: "stretch",
  },
  btnPrimary: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 3,
  },
  btnPrimaryIcon: {
    width: 26,
    height: 26,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimaryText: {
    flex: 1,
    textAlign: "center",
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.1,
  },

  btnSecondary: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  btnSecondaryText: { fontSize: 13, fontWeight: "800", color: ACCENT },

  footerHint: {
    marginTop: 14,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    opacity: 0.9,
  },
  footerHintText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B7280",
  },
});
