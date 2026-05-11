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
import { COLORS } from "../../../constants";

type Props = NativeStackScreenProps<
  ClientStackParamList,
  "ClientBookingConfirmation"
>;

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
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
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
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Success Icon with Animation */}
        <Animated.View
          style={[
            styles.iconOuter,
            {
              transform: [{ scale: scaleAnim }],
              opacity: fadeAnim,
            },
          ]}
        >
          <View style={styles.iconCircle}>
            <Ionicons name="checkmark-circle" size={56} color={CHECK_GREEN} />
          </View>
        </Animated.View>

        {/* Main Title */}
        <Animated.Text
          style={[
            styles.title,
            {
              opacity: fadeAnim,
            },
          ]}
        >
          Request sent!
        </Animated.Text>

        {/* Subtitle */}
        <Animated.Text
          style={[
            styles.subtitle,
            {
              opacity: fadeAnim,
            },
          ]}
        >
          Your booking request has been sent to{" "}
          <Text style={styles.subtitleBold}>{providerName}</Text>. You'll be
          notified once they respond.
        </Animated.Text>

        {/* Recap Card with Icon Badges */}
        <Animated.View
          style={[
            styles.recapCard,
            {
              opacity: fadeAnim,
            },
          ]}
        >
          {/* Service Row */}
          <View style={styles.recapRow}>
            <View style={styles.iconBadge}>
              <Ionicons name="briefcase" size={20} color={COLORS.primary} />
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
            <View style={styles.iconBadge}>
              <Ionicons name="person" size={20} color={COLORS.primary} />
            </View>
            <View style={styles.recapTextCol}>
              <Text style={styles.recapLabel}>Provider</Text>
              <Text style={styles.recapValue} numberOfLines={1}>
                {providerName}
              </Text>
            </View>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Date Row */}
          <View style={styles.recapRow}>
            <View style={styles.iconBadge}>
              <Ionicons name="calendar" size={20} color={COLORS.primary} />
            </View>
            <View style={styles.recapTextCol}>
              <Text style={styles.recapLabel}>Scheduled Date</Text>
              <Text style={styles.recapValue}>{dateFormatted}</Text>
            </View>
          </View>

          {/* Time Row */}
          <View style={styles.recapRow}>
            <View style={styles.iconBadge}>
              <Ionicons name="time" size={20} color={COLORS.primary} />
            </View>
            <View style={styles.recapTextCol}>
              <Text style={styles.recapLabel}>Scheduled Time</Text>
              <Text style={styles.recapValue}>{scheduledTime}</Text>
            </View>
          </View>

          {/* Status Row */}
          <View style={[styles.recapRow, styles.statusRow]}>
            <Text style={styles.recapLabel}>Status</Text>
            <View style={styles.badgePending}>
              <View style={styles.badgeDot} />
              <Text style={styles.badgePendingText}>Awaiting Response</Text>
            </View>
          </View>
        </Animated.View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Ionicons
            name="information-circle"
            size={20}
            color={COLORS.primary}
          />
          <Text style={styles.infoText}>
            Check your notifications for updates. You can also view all your
            appointments from your bookings.
          </Text>
        </View>

        {/* Action Buttons */}
        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={goBookings}
          activeOpacity={0.8}
        >
          <Ionicons name="calendar-clear" size={18} color={COLORS.white} />
          <Text style={styles.btnPrimaryText}>View My Bookings</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btnSecondary}
          onPress={goHome}
          activeOpacity={0.8}
        >
          <Ionicons name="home-outline" size={18} color={COLORS.primary} />
          <Text style={styles.btnSecondaryText}>Back to Home</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingTop: 24,
  },

  /* Icon Animation */
  iconOuter: {
    alignSelf: "center",
    marginBottom: 24,
  },
  iconCircle: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: SUCCESS_BG,
    borderWidth: 2.5,
    borderColor: SUCCESS_BORDER,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: CHECK_GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },

  /* Typography */
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: COLORS.text.primary,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 14,
    fontSize: 16,
    color: COLORS.text.secondary,
    textAlign: "center",
    lineHeight: 24,
  },
  subtitleBold: {
    fontWeight: "700",
    color: COLORS.text.primary,
  },

  /* Recap Card */
  recapCard: {
    marginTop: 32,
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    gap: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  recapRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: `${COLORS.primary}15`,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  recapTextCol: {
    flex: 1,
    justifyContent: "center",
  },
  recapLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.text.tertiary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  recapValue: {
    marginTop: 5,
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text.primary,
  },

  /* Divider */
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 4,
  },

  /* Status Row */
  statusRow: {
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: 8,
  },
  badgePending: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#B45309",
  },
  badgePendingText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#B45309",
    letterSpacing: 0.3,
  },

  /* Info Box */
  infoBox: {
    marginTop: 28,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: `${COLORS.primary}10`,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `${COLORS.primary}25`,
    padding: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text.secondary,
    lineHeight: 21,
    fontWeight: "500",
  },

  /* Buttons */
  btnPrimary: {
    marginTop: 28,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  btnPrimaryText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  btnSecondary: {
    marginTop: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  btnSecondaryText: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.primary,
  },
});
