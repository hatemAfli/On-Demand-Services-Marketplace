import React, { useMemo, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ProviderStackParamList } from "../../../navigation/types";

type RatingsPerformanceScreenProps = {
  onPressHelp?: () => void;
  onPressNotifications?: () => void;
  onPressViewAllReviews?: () => void;
};

function RatingsPerformanceScreen(props: RatingsPerformanceScreenProps) {
  const [headerElevated, setHeaderElevated] = useState(false);
  const [showMetricsModal, setShowMetricsModal] = useState(false);
  const [showTip, setShowTip] = useState(true);

  const headerStyle = useMemo(
    () => [styles.header, headerElevated && styles.headerElevated],
    [headerElevated],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />

      <View style={headerStyle}>
        <View style={styles.headerInner}>
          <Text style={styles.headerTitle}>Ratings & Performance</Text>

          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={props.onPressHelp}
              activeOpacity={0.85}
              style={styles.headerIconBtn}
            >
              <Text style={styles.headerIcon}>?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={props.onPressNotifications}
              activeOpacity={0.85}
              style={styles.headerIconBtn}
            >
              <Text style={styles.headerIcon}>{"\u{1F514}"}</Text>
              <View style={styles.headerDot} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          setHeaderElevated(y > 10);
        }}
        scrollEventThrottle={16}
      >
        <View style={styles.sectionPad}>
          <View style={styles.heroCard}>
            <View style={styles.heroGlowTopRight} />
            <View style={styles.heroGlowBottomLeft} />

            <View style={styles.heroInner}>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>ELITE PROVIDER</Text>
              </View>

              <View style={styles.heroScoreRow}>
                <Text style={styles.heroScore}>4.9</Text>
                <Text style={styles.heroScoreOutOf}>/ 5.0</Text>
              </View>

              <View style={styles.starsRow}>
                <Text style={styles.star}>{"\u2605"}</Text>
                <Text style={styles.star}>{"\u2605"}</Text>
                <Text style={styles.star}>{"\u2605"}</Text>
                <Text style={styles.star}>{"\u2605"}</Text>
                <Text style={[styles.star, styles.starHalf]}>{"\u2605"}</Text>
              </View>

              <Text style={styles.heroBasedOn}>Based on 142 reviews</Text>

              <View style={styles.badgesRow}>
                <View style={styles.badgeItem}>
                  <View style={styles.badgeIconCircle}>
                    <Text style={[styles.badgeIcon, { color: colors.primary }]}>
                      {"\u{1F3C5}"}
                    </Text>
                  </View>
                  <Text style={styles.badgeLabel}>TOP RATED</Text>
                </View>

                <View style={styles.badgeItem}>
                  <View style={styles.badgeIconCircle}>
                    <Text style={[styles.badgeIcon, { color: colors.success }]}>
                      {"\u{1F6E1}"}
                    </Text>
                  </View>
                  <Text style={styles.badgeLabel}>VERIFIED</Text>
                </View>

                <View style={styles.badgeItem}>
                  <View style={styles.badgeIconCircle}>
                    <Text
                      style={[styles.badgeIcon, { color: colors.infoBlue }]}
                    >
                      {"\u26A1"}
                    </Text>
                  </View>
                  <Text style={styles.badgeLabel}>FAST</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.sectionPad}>
          <View style={styles.kpiHeaderRow}>
            <Text style={styles.kpiTitle}>Performance Metrics</Text>
            <TouchableOpacity
              onPress={() => setShowMetricsModal(true)}
              activeOpacity={0.85}
              style={styles.kpiHowBtn}
            >
              <Text style={styles.kpiHowText}>How is this calculated?</Text>
              <Text style={styles.kpiHowIcon}>?</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.kpiGrid}>
            <View style={styles.kpiCard}>
              <View style={styles.kpiCornerGlowSuccess} />

              <View style={styles.kpiTopRow}>
                <View
                  style={[styles.kpiIconCircle, styles.kpiIconCircleSuccess]}
                >
                  <Text style={[styles.kpiIcon, { color: colors.success }]}>
                    {"\u2713"}
                  </Text>
                </View>
                <View style={[styles.kpiTag, styles.kpiTagGood]}>
                  <Text style={[styles.kpiTagText, { color: colors.success }]}>
                    Good
                  </Text>
                </View>
              </View>

              <Text style={styles.kpiLabel}>Acceptance Rate</Text>
              <Text style={styles.kpiValue}>92%</Text>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: "92%", backgroundColor: colors.success },
                  ]}
                />
              </View>
              <Text style={styles.kpiHint}>Target: &gt;85%</Text>
            </View>

            <View style={styles.kpiCard}>
              <View style={styles.kpiCornerGlowInfo} />

              <View style={styles.kpiTopRow}>
                <View style={[styles.kpiIconCircle, styles.kpiIconCircleInfo]}>
                  <Text style={[styles.kpiIcon, { color: colors.infoBlue }]}>
                    {"\u{1F3C1}"}
                  </Text>
                </View>
                <View style={[styles.kpiTag, styles.kpiTagWarn]}>
                  <Text style={[styles.kpiTagText, { color: colors.warning }]}>
                    Warning
                  </Text>
                </View>
              </View>

              <Text style={styles.kpiLabel}>Completion Rate</Text>
              <Text style={styles.kpiValue}>88%</Text>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: "88%", backgroundColor: colors.warning },
                  ]}
                />
              </View>
              <Text style={styles.kpiHint}>Target: &gt;90%</Text>
            </View>
          </View>
        </View>

        {showTip ? (
          <View style={styles.sectionPad}>
            <View style={styles.tipCard}>
              <View style={styles.tipIconCircle}>
                <Text style={styles.tipIcon}>{"\u{1F4A1}"}</Text>
              </View>

              <View style={styles.tipTextBlock}>
                <Text style={styles.tipTitle}>Boost your Completion Rate</Text>
                <Text style={styles.tipBody}>
                  Your completion rate is slightly below target. Avoid
                  cancelling jobs after accepting them to reach Elite status
                  again.
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setShowTip(false)}
                activeOpacity={0.85}
                style={styles.tipCloseBtn}
              >
                <Text style={styles.tipCloseText}>{"\u00D7"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <View style={styles.sectionPad}>
          <Text style={styles.sectionTitle}>Cancellation Analysis</Text>

          <View style={styles.analysisCard}>
            <View style={styles.analysisRow}>
              <View style={styles.donutWrap}>
                <View style={styles.donutOuter}>
                  <View style={styles.donutInner} />
                </View>
                <Text style={styles.donutLabel}>10 Total</Text>
              </View>

              <View style={styles.analysisLegend}>
                <LegendRow
                  dotColor={colors.error}
                  label="Client Unreachable"
                  value="6 (60%)"
                />
                <LegendRow
                  dotColor={colors.warning}
                  label="Distance too far"
                  value="3 (30%)"
                />
                <LegendRow
                  dotColor={colors.success}
                  label="Other"
                  value="1 (10%)"
                />
              </View>
            </View>

            <Text style={styles.analysisFootnote}>
              *Cancellations by client do not affect your score
            </Text>
          </View>
        </View>

        <View style={[styles.sectionPad, styles.sectionBottomSpace]}>
          <View style={styles.reviewsHeaderRow}>
            <Text style={styles.sectionTitle}>Recent Reviews</Text>
            <TouchableOpacity
              onPress={props.onPressViewAllReviews}
              activeOpacity={0.85}
            >
              <Text style={styles.reviewsLink}>View All</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.reviewCard}>
            <View style={styles.reviewTopRow}>
              <View style={styles.reviewUserRow}>
                <Image
                  source={{
                    uri: "https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-6.jpg",
                  }}
                  style={styles.reviewAvatar}
                />
                <View>
                  <Text style={styles.reviewName}>Fatima Al-Sayed</Text>
                  <Text style={styles.reviewMeta}>
                    AC Maintenance • Yesterday
                  </Text>
                </View>
              </View>

              <View style={styles.reviewRatingPill}>
                <Text style={styles.reviewRatingStar}>{"\u2605"}</Text>
                <Text style={styles.reviewRatingText}>5.0</Text>
              </View>
            </View>

            <Text style={styles.reviewBody}>
              "Excellent service! He arrived on time and fixed the issue very
              quickly. Very polite and professional."
            </Text>

            <View style={styles.tagRow}>
              <View style={styles.tagPill}>
                <Text style={styles.tagText}>Punctual</Text>
              </View>
              <View style={styles.tagPill}>
                <Text style={styles.tagText}>Professional</Text>
              </View>
            </View>
          </View>

          <View style={styles.reviewCard}>
            <View style={styles.reviewTopRow}>
              <View style={styles.reviewUserRow}>
                <Image
                  source={{
                    uri: "https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-2.jpg",
                  }}
                  style={styles.reviewAvatar}
                />
                <View>
                  <Text style={styles.reviewName}>Ahmed Karim</Text>
                  <Text style={styles.reviewMeta}>
                    Plumbing Repair • 2 days ago
                  </Text>
                </View>
              </View>

              <View style={styles.reviewRatingPill}>
                <Text style={styles.reviewRatingStar}>{"\u2605"}</Text>
                <Text style={styles.reviewRatingText}>4.0</Text>
              </View>
            </View>

            <Text style={styles.reviewBody}>
              "Good work, but arrived 15 minutes late. The repair itself was
              solid though."
            </Text>
          </View>

          <View style={styles.reviewCard}>
            <View style={styles.reviewTopRow}>
              <View style={styles.reviewUserRow}>
                <View style={styles.initialsAvatar}>
                  <Text style={styles.initialsText}>MA</Text>
                </View>
                <View>
                  <Text style={styles.reviewName}>Mohammed Ali</Text>
                  <Text style={styles.reviewMeta}>
                    Electrical Wiring • 4 days ago
                  </Text>
                </View>
              </View>

              <View style={styles.reviewRatingPill}>
                <Text style={styles.reviewRatingStar}>{"\u2605"}</Text>
                <Text style={styles.reviewRatingText}>5.0</Text>
              </View>
            </View>

            <Text style={styles.reviewBody}>
              "Very knowledgeable and explained everything clearly. Highly
              recommended!"
            </Text>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={showMetricsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMetricsModal(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setShowMetricsModal(false)}
        >
          <Pressable
            style={styles.modalSheet}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalGrabber} />

            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>How Metrics Work</Text>
              <Text style={styles.modalSub}>
                Understanding your performance score
              </Text>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.metricBlock}>
                <View style={styles.metricHeaderRow}>
                  <View
                    style={[
                      styles.metricIconCircle,
                      styles.metricIconCircleSuccess,
                    ]}
                  >
                    <Text
                      style={[styles.metricIcon, { color: colors.success }]}
                    >
                      {"\u2713"}
                    </Text>
                  </View>
                  <Text style={styles.metricTitle}>Acceptance Rate</Text>
                </View>
                <Text style={styles.metricBody}>
                  The percentage of job requests you accept out of the total
                  requests sent to you.
                </Text>
                <View style={styles.metricFormulaBox}>
                  <Text style={styles.metricFormulaText}>
                    <Text style={styles.metricFormulaStrong}>Formula:</Text>{" "}
                    (Accepted Jobs / Total Requests) {"\u00D7"} 100
                  </Text>
                  <Text style={styles.metricFormulaDanger}>
                    * Declining too many jobs lowers your visibility.
                  </Text>
                </View>
              </View>

              <View style={styles.metricBlock}>
                <View style={styles.metricHeaderRow}>
                  <View
                    style={[
                      styles.metricIconCircle,
                      styles.metricIconCircleInfo,
                    ]}
                  >
                    <Text
                      style={[styles.metricIcon, { color: colors.infoBlue }]}
                    >
                      {"\u{1F3C1}"}
                    </Text>
                  </View>
                  <Text style={styles.metricTitle}>Completion Rate</Text>
                </View>
                <Text style={styles.metricBody}>
                  The percentage of accepted jobs that you successfully complete
                  without cancelling.
                </Text>
                <View style={styles.metricFormulaBox}>
                  <Text style={styles.metricFormulaText}>
                    <Text style={styles.metricFormulaStrong}>Formula:</Text>{" "}
                    (Completed Jobs / Accepted Jobs) {"\u00D7"} 100
                  </Text>
                  <Text style={styles.metricFormulaWarn}>
                    * Cancellations by the customer do NOT hurt this score.
                  </Text>
                </View>
              </View>

              <View style={styles.metricBlock}>
                <View style={styles.metricHeaderRow}>
                  <View
                    style={[
                      styles.metricIconCircle,
                      styles.metricIconCircleStar,
                    ]}
                  >
                    <Text
                      style={[styles.metricIcon, { color: colors.warning }]}
                    >
                      {"\u2605"}
                    </Text>
                  </View>
                  <Text style={styles.metricTitle}>Average Rating</Text>
                </View>
                <Text style={styles.metricBody}>
                  The average star rating from your last 100 completed jobs.
                </Text>
                <View style={styles.metricFormulaBox}>
                  <Text style={styles.metricFormulaOk}>
                    Maintain &gt;4.8 to keep "Top Rated" badge.
                  </Text>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                onPress={() => setShowMetricsModal(false)}
                activeOpacity={0.9}
                style={styles.modalCta}
              >
                <Text style={styles.modalCtaText}>Got it</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function LegendRow(props: { dotColor: string; label: string; value: string }) {
  return (
    <View style={styles.legendRow}>
      <View style={styles.legendLeft}>
        <View style={[styles.legendDot, { backgroundColor: props.dotColor }]} />
        <Text style={styles.legendLabel}>{props.label}</Text>
      </View>
      <Text style={styles.legendValue}>{props.value}</Text>
    </View>
  );
}

export const ProviderRatingsScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<ProviderStackParamList>>();

  return (
    <RatingsPerformanceScreen
      onPressHelp={() => {}}
      onPressNotifications={() => navigation.navigate("ProviderNotifications")}
      onPressViewAllReviews={() => navigation.navigate("ProviderRatings")}
    />
  );
};

const colors = {
  primary: "#F08E10",
  primaryHover: "#D97D08",
  success: "#10B981",
  error: "#EF4444",
  warning: "#F59E0B",
  background: "#F8FAFC",
  surface: "#FFFFFF",
  textMain: "#111827",
  textMuted: "#6B7280",
  textLight: "#9CA3AF",
  input: "#F3F4F6",
  infoBlue: "#3B82F6",
  infoBg: "#EFF6FF",
  purpleSoft: "#EEF2FF",
  purpleText: "#4F46E5",
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#F3F4F6",
  },
  headerElevated: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  headerInner: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.textMain,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },
  headerIcon: {
    fontSize: 14,
    fontWeight: "900",
    color: colors.textMuted,
  },
  headerDot: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.error,
    borderWidth: 1,
    borderColor: colors.surface,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 86,
    paddingBottom: 24,
  },
  sectionPad: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.textMain,
    marginBottom: 12,
  },
  heroCard: {
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 30,
    elevation: 6,
  },
  heroGlowTopRight: {
    position: "absolute",
    top: -40,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  heroGlowBottomLeft: {
    position: "absolute",
    bottom: -40,
    left: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  heroInner: {
    padding: 22,
    alignItems: "center",
  },
  heroBadge: {
    backgroundColor: "rgba(255,255,255,0.20)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 14,
  },
  heroBadgeText: {
    color: colors.surface,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  heroScoreRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 6,
  },
  heroScore: {
    color: colors.surface,
    fontSize: 52,
    fontWeight: "900",
    letterSpacing: -1,
    marginRight: 8,
  },
  heroScoreOutOf: {
    color: "rgba(255,255,255,0.90)",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  starsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  star: {
    color: colors.surface,
    fontSize: 18,
    marginHorizontal: 2,
  },
  starHalf: {
    opacity: 0.9,
  },
  heroBasedOn: {
    color: "rgba(255,255,255,0.80)",
    fontSize: 12,
    fontWeight: "700",
  },
  badgesRow: {
    marginTop: 18,
    flexDirection: "row",
    justifyContent: "center",
  },
  badgeItem: {
    alignItems: "center",
    marginHorizontal: 12,
  },
  badgeIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 6,
  },
  badgeIcon: {
    fontSize: 18,
  },
  badgeLabel: {
    color: colors.surface,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
  },
  kpiHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  kpiTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.textMain,
  },
  kpiHowBtn: {
    flexDirection: "row",
    alignItems: "center",
  },
  kpiHowText: {
    fontSize: 10,
    fontWeight: "900",
    color: colors.primary,
    marginRight: 6,
  },
  kpiHowIcon: {
    fontSize: 12,
    fontWeight: "900",
    color: colors.primary,
  },
  kpiGrid: {
    flexDirection: "row",
  },
  kpiCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 1,
    overflow: "hidden",
  },
  kpiCornerGlowSuccess: {
    position: "absolute",
    top: -10,
    right: -10,
    width: 70,
    height: 70,
    borderRadius: 18,
    backgroundColor: "rgba(16,185,129,0.06)",
  },
  kpiCornerGlowInfo: {
    position: "absolute",
    top: -10,
    right: -10,
    width: 70,
    height: 70,
    borderRadius: 18,
    backgroundColor: colors.infoBg,
  },
  kpiTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  kpiIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  kpiIconCircleSuccess: {
    backgroundColor: "rgba(16,185,129,0.10)",
  },
  kpiIconCircleInfo: {
    backgroundColor: colors.infoBg,
  },
  kpiIcon: {
    fontSize: 12,
    fontWeight: "900",
  },
  kpiTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  kpiTagGood: {
    backgroundColor: "rgba(16,185,129,0.10)",
  },
  kpiTagWarn: {
    backgroundColor: "rgba(245,158,11,0.10)",
  },
  kpiTagText: {
    fontSize: 9,
    fontWeight: "900",
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
    marginBottom: 2,
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: "900",
    color: colors.textMain,
  },
  progressTrack: {
    height: 6,
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 10,
  },
  progressFill: {
    height: 6,
    borderRadius: 999,
  },
  kpiHint: {
    marginTop: 8,
    fontSize: 10,
    fontWeight: "700",
    color: colors.textMuted,
  },
  tipCard: {
    backgroundColor: colors.purpleSoft,
    borderWidth: 1,
    borderColor: "#E0E7FF",
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  tipIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 1,
    marginTop: 2,
  },
  tipIcon: {
    color: colors.purpleText,
    fontSize: 14,
  },
  tipTextBlock: {
    flex: 1,
    paddingRight: 6,
  },
  tipTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: colors.purpleText,
    marginBottom: 6,
  },
  tipBody: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
    lineHeight: 16,
  },
  tipCloseBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  tipCloseText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#9CA3AF",
    marginTop: -2,
  },
  analysisCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 1,
  },
  analysisRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  donutWrap: {
    width: 130,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  donutOuter: {
    width: 116,
    height: 116,
    borderRadius: 58,
    borderWidth: 12,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  donutInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
  },
  donutLabel: {
    position: "absolute",
    fontSize: 12,
    fontWeight: "900",
    color: colors.textMain,
  },
  analysisLegend: {
    flex: 1,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  legendLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  legendLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
  },
  legendValue: {
    fontSize: 12,
    fontWeight: "900",
    color: colors.textMain,
  },
  analysisFootnote: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#FAFAFA",
    textAlign: "center",
    fontSize: 10,
    fontWeight: "700",
    color: colors.textLight,
  },
  sectionBottomSpace: {
    paddingBottom: 10,
  },
  reviewsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  reviewsLink: {
    fontSize: 10,
    fontWeight: "900",
    color: colors.primary,
  },
  reviewCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 1,
    marginBottom: 12,
  },
  reviewTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  reviewUserRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 10,
  },
  reviewAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    marginRight: 10,
  },
  initialsAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  initialsText: {
    fontSize: 12,
    fontWeight: "900",
    color: colors.textMuted,
  },
  reviewName: {
    fontSize: 12,
    fontWeight: "900",
    color: colors.textMain,
  },
  reviewMeta: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: "700",
    color: colors.textMuted,
  },
  reviewRatingPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEFCE8",
    borderWidth: 1,
    borderColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  reviewRatingStar: {
    fontSize: 10,
    color: colors.warning,
    marginRight: 6,
  },
  reviewRatingText: {
    fontSize: 11,
    fontWeight: "900",
    color: colors.textMain,
  },
  reviewBody: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
    lineHeight: 18,
  },
  tagRow: {
    flexDirection: "row",
    marginTop: 10,
  },
  tagPill: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#F3F4F6",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginRight: 8,
  },
  tagText: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.textLight,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.50)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
    maxHeight: "85%",
  },
  modalGrabber: {
    width: 48,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#E5E7EB",
    alignSelf: "center",
    marginBottom: 14,
  },
  modalHeader: {
    alignItems: "center",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: colors.textMain,
  },
  modalSub: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMuted,
  },
  modalScroll: {
    flexGrow: 0,
  },
  modalScrollContent: {
    paddingBottom: 10,
  },
  metricBlock: {
    marginTop: 16,
  },
  metricHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  metricIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  metricIconCircleSuccess: {
    backgroundColor: "rgba(16,185,129,0.10)",
  },
  metricIconCircleInfo: {
    backgroundColor: colors.infoBg,
  },
  metricIconCircleStar: {
    backgroundColor: "#FEFCE8",
  },
  metricIcon: {
    fontSize: 12,
    fontWeight: "900",
  },
  metricTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: colors.textMain,
  },
  metricBody: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
    lineHeight: 18,
  },
  metricFormulaBox: {
    marginTop: 10,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#F3F4F6",
    borderRadius: 12,
    padding: 12,
  },
  metricFormulaText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
    lineHeight: 16,
  },
  metricFormulaStrong: {
    fontWeight: "900",
    color: colors.textMain,
  },
  metricFormulaDanger: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: "800",
    color: colors.error,
  },
  metricFormulaWarn: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: "800",
    color: colors.warning,
  },
  metricFormulaOk: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.success,
  },
  modalFooter: {
    marginTop: 12,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  modalCta: {
    width: "100%",
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 3,
  },
  modalCtaText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: "900",
  },
});
