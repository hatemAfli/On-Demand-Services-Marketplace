import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { useAppTranslation } from "../../hooks/useAppTranslation";
import { COLORS } from "../../constants";
import type { UserWithProfile } from "../../types";

const ACCENT = "#C4B5FD";
const BG = "#0A0E1A";

function formatMediumDate(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
  } catch {
    return iso;
  }
}

export const AdminPlatformDashboardScreen: React.FC = () => {
  const { user, logout } = useAuth();
  const { t, isRTL } = useAppTranslation();
  const insets = useSafeAreaInsets();

  const profile = user as UserWithProfile | null;
  const pa = profile?.platformAdmin;

  const displayName =
    [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim() ||
    profile?.email ||
    "—";

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={["#0A0E1A", "#0F172A", "#1E1B4B", "#312E81"]}
        locations={[0, 0.35, 0.72, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: Math.max(insets.top, 16),
            paddingBottom: 28 + insets.bottom,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.badgeRow, isRTL && styles.rowRtl]}>
          <View style={styles.badge}>
            <Ionicons name="shield-checkmark" size={18} color={ACCENT} />
            <Text style={[styles.badgeText, isRTL && styles.rtlText]}>
              {t("admin.platform.badge")}
            </Text>
          </View>
        </View>

        <Text style={[styles.title, isRTL && styles.rtlText]}>
          {t("admin.platform.title")}
        </Text>
        <Text style={[styles.subtitle, isRTL && styles.rtlText]}>
          {t("admin.platform.subtitle")}
        </Text>

        <View style={styles.heroCard}>
          <View style={[styles.avatarRing, isRTL && styles.rowRtl]}>
            <LinearGradient
              colors={["#6366F1", "#8B5CF6", "#A78BFA"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatarInner}
            >
              <Ionicons name="person" size={40} color="#fff" />
            </LinearGradient>
            <View style={styles.heroTextWrap}>
              <Text style={[styles.heroName, isRTL && styles.rtlText]}>
                {displayName}
              </Text>
              <Text style={[styles.heroEmail, isRTL && styles.rtlText]}>
                {profile?.email}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={[styles.statLabel, isRTL && styles.rtlText]}>
              {t("admin.platform.roleLabel")}
            </Text>
            <Text style={[styles.statValue, isRTL && styles.rtlText]}>
              {profile?.role}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statLabel, isRTL && styles.rtlText]}>
              {t("admin.platform.statusLabel")}
            </Text>
            <Text
              style={[
                styles.statValue,
                profile?.status === "ACTIVE"
                  ? styles.statusOk
                  : styles.statusWarn,
                isRTL && styles.rtlText,
              ]}
            >
              {profile?.status}
            </Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
          {t("admin.platform.accountSection")}
        </Text>
        <View style={styles.detailCard}>
          {profile?.phoneNumber ? (
            <View style={[styles.detailRow, isRTL && styles.rowRtl]}>
              <Text style={[styles.detailLabel, isRTL && styles.rtlText]}>
                {t("admin.platform.phoneLabel")}
              </Text>
              <Text style={[styles.detailValue, isRTL && styles.rtlText]}>
                {profile.phoneNumber}
              </Text>
            </View>
          ) : null}
          <View style={[styles.detailRow, isRTL && styles.rowRtl]}>
            <Text style={[styles.detailLabel, isRTL && styles.rtlText]}>
              {t("admin.platform.userIdLabel")}
            </Text>
            <Text
              style={[styles.detailValueMono, isRTL && styles.rtlText]}
              selectable
            >
              {profile?.id ?? "—"}
            </Text>
          </View>
          <View style={[styles.verifyRow, isRTL && styles.rowRtl]}>
            <Ionicons
              name={profile?.isEmailVerified ? "checkmark-circle" : "ellipse-outline"}
              size={18}
              color={
                profile?.isEmailVerified
                  ? COLORS.success
                  : "rgba(148,163,184,0.6)"
              }
            />
            <Text style={[styles.verifyText, isRTL && styles.rtlText]}>
              {t("admin.platform.emailVerified")}
            </Text>
          </View>
          <View style={[styles.verifyRow, isRTL && styles.rowRtl]}>
            <Ionicons
              name={
                profile?.isPhoneVerified ? "checkmark-circle" : "ellipse-outline"
              }
              size={18}
              color={
                profile?.isPhoneVerified
                  ? COLORS.success
                  : "rgba(148,163,184,0.6)"
              }
            />
            <Text style={[styles.verifyText, isRTL && styles.rtlText]}>
              {t("admin.platform.phoneVerified")}
            </Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
          {t("admin.platform.platformAccessSection")}
        </Text>
        <View style={styles.detailCard}>
          {pa?.permissions?.length ? (
            <View style={[styles.permWrap, isRTL && styles.rowRtl]}>
              {pa.permissions.map((p) => (
                <View key={p} style={styles.permChip}>
                  <Text style={styles.permChipText}>{p}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.mutedNote, isRTL && styles.rtlText]}>
              {t("admin.platform.noPermissions")}
            </Text>
          )}
          <View style={[styles.detailRow, styles.detailRowSpaced, isRTL && styles.rowRtl]}>
            <Text style={[styles.detailLabel, isRTL && styles.rtlText]}>
              {t("admin.platform.adminSince")}
            </Text>
            <Text style={[styles.detailValue, isRTL && styles.rtlText]}>
              {formatMediumDate(pa?.createdAt)}
            </Text>
          </View>
          <View style={[styles.detailRow, isRTL && styles.rowRtl]}>
            <Text style={[styles.detailLabel, isRTL && styles.rtlText]}>
              {t("admin.platform.recordUpdated")}
            </Text>
            <Text style={[styles.detailValue, isRTL && styles.rtlText]}>
              {formatMediumDate(pa?.updatedAt)}
            </Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
          {t("admin.platform.toolsSection")}
        </Text>
        <View style={styles.toolsGrid}>
          <View style={[styles.toolTile, styles.toolTileDisabled]}>
            <Ionicons name="people-outline" size={26} color="rgba(255,255,255,0.35)" />
            <Text style={[styles.toolTitle, styles.toolTitleMuted, isRTL && styles.rtlText]}>
              {t("admin.platform.toolUsers")}
            </Text>
            <Text style={[styles.toolSoon, isRTL && styles.rtlText]}>
              {t("admin.platform.soon")}
            </Text>
          </View>
          <View style={[styles.toolTile, styles.toolTileDisabled]}>
            <Ionicons name="bar-chart-outline" size={26} color="rgba(255,255,255,0.35)" />
            <Text style={[styles.toolTitle, styles.toolTitleMuted, isRTL && styles.rtlText]}>
              {t("admin.platform.toolAnalytics")}
            </Text>
            <Text style={[styles.toolSoon, isRTL && styles.rtlText]}>
              {t("admin.platform.soon")}
            </Text>
          </View>
          <View style={[styles.toolTile, styles.toolTileDisabled]}>
            <Ionicons name="settings-outline" size={26} color="rgba(255,255,255,0.35)" />
            <Text style={[styles.toolTitle, styles.toolTitleMuted, isRTL && styles.rtlText]}>
              {t("admin.platform.toolSettings")}
            </Text>
            <Text style={[styles.toolSoon, isRTL && styles.rtlText]}>
              {t("admin.platform.soon")}
            </Text>
          </View>
        </View>

        <View style={styles.comingBanner}>
          <Ionicons name="sparkles-outline" size={20} color={ACCENT} />
          <Text style={[styles.comingText, isRTL && styles.rtlText]}>
            {t("admin.platform.comingSoon")}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => void logout()}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel={t("client.sidebar.logout")}
        >
          <Ionicons name="log-out-outline" size={22} color="#fff" />
          <Text style={styles.logoutText}>{t("client.sidebar.logout")}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  scroll: {
    paddingHorizontal: 20,
  },
  rowRtl: {
    flexDirection: "row-reverse",
  },
  rtlText: {
    textAlign: "right",
    writingDirection: "rtl",
  },
  badgeRow: {
    flexDirection: "row",
    marginBottom: 14,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(99,102,241,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.35)",
  },
  badgeText: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#F8FAFC",
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "rgba(203,213,225,0.92)",
    lineHeight: 22,
    marginBottom: 22,
  },
  heroCard: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    padding: 18,
    marginBottom: 16,
  },
  avatarRing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  avatarInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTextWrap: {
    flex: 1,
  },
  heroName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#F1F5F9",
  },
  heroEmail: {
    marginTop: 4,
    fontSize: 14,
    color: "rgba(148,163,184,0.95)",
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 26,
  },
  statCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(148,163,184,0.95)",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  statValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#E2E8F0",
  },
  statusOk: {
    color: COLORS.success,
  },
  statusWarn: {
    color: COLORS.warning,
  },
  detailCard: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    padding: 16,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  detailRowSpaced: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(148,163,184,0.95)",
    flexShrink: 0,
    maxWidth: "42%",
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#E2E8F0",
    flex: 1,
    textAlign: "right",
  },
  detailValueMono: {
    fontSize: 11,
    fontWeight: "500",
    color: "#CBD5E1",
    flex: 1,
    textAlign: "right",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
  },
  verifyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  verifyText: {
    fontSize: 13,
    color: "rgba(226,232,240,0.9)",
  },
  permWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  permChip: {
    backgroundColor: "rgba(99,102,241,0.25)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.35)",
  },
  permChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#E9D5FF",
  },
  mutedNote: {
    fontSize: 13,
    color: "rgba(148,163,184,0.9)",
    marginBottom: 14,
    fontStyle: "italic",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: ACCENT,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  toolsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
  },
  toolTile: {
    width: "31%",
    minWidth: 100,
    flexGrow: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    ...Platform.select({
      android: { elevation: 0 },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
    }),
  },
  toolTileDisabled: {
    opacity: 0.85,
  },
  toolTitle: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: "700",
    color: "#E2E8F0",
  },
  toolTitleMuted: {
    color: "rgba(226,232,240,0.55)",
  },
  toolSoon: {
    marginTop: 4,
    fontSize: 11,
    color: "rgba(148,163,184,0.85)",
    fontWeight: "600",
  },
  comingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(99,102,241,0.12)",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(129,140,248,0.25)",
    marginBottom: 22,
  },
  comingText: {
    flex: 1,
    fontSize: 14,
    color: "rgba(226,232,240,0.95)",
    lineHeight: 20,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: COLORS.error,
    paddingVertical: 16,
    borderRadius: 14,
  },
  logoutText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
