import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { useAppTranslation } from "../../hooks/useAppTranslation";
import { AccountStatus } from "../../types";

const BLOCK_ICON: keyof typeof Ionicons.glyphMap = "shield-outline";
const ACCENT = "#A78BFA";

type BlockConfig = {
  accent: string;
  softBg: string;
  softBorder: string;
  badgeBg: string;
  badgeBorder: string;
  titleColor: string;
  messageColor: string;
  logoutBg: string;
  titleKey: string;
  messageKey: string;
};

export const ClientBlockedScreen: React.FC = () => {
  const { user, logout, refreshUser } = useAuth();
  const { t, isRTL } = useAppTranslation();
  const insets = useSafeAreaInsets();
  const status = user?.status;
  const [checkingStatus, setCheckingStatus] = useState(false);

  const config = useMemo((): BlockConfig => {
    switch (status) {
      case AccountStatus.PENDING:
        return {
          accent: "#B45309",
          softBg: "#FFFBEB",
          softBorder: "#FDE68A",
          badgeBg: "#FFFBEB",
          badgeBorder: "#FDE68A",
          titleColor: "#78350F",
          messageColor: "#92400E",
          logoutBg: "#D97706",
          titleKey: "client.status.pendingTitle",
          messageKey: "client.status.pendingMessage",
        };
      case AccountStatus.REJECTED:
        return {
          accent: "#B91C1C",
          softBg: "#FEF2F2",
          softBorder: "#FECACA",
          badgeBg: "#FEF2F2",
          badgeBorder: "#FECACA",
          titleColor: "#7F1D1D",
          messageColor: "#991B1B",
          logoutBg: "#DC2626",
          titleKey: "client.status.rejectedTitle",
          messageKey: "client.status.rejectedMessage",
        };
      case AccountStatus.SUSPENDED:
        return {
          accent: "#7C3AED",
          softBg: "#F5F3FF",
          softBorder: "#DDD6FE",
          badgeBg: "#FFFBEB",
          badgeBorder: "#DDD6FE",
          titleColor: "#4C1D95",
          messageColor: "#5B21B6",
          logoutBg: "#7C3AED",
          titleKey: "client.status.suspendedTitle",
          messageKey: "client.status.suspendedMessage",
        };
      case AccountStatus.DELETED:
        return {
          accent: "#334155",
          softBg: "#F8FAFC",
          softBorder: "#CBD5E1",
          badgeBg: "#F8FAFC",
          badgeBorder: "#CBD5E1",
          titleColor: "#1E293B",
          messageColor: "#334155",
          logoutBg: "#334155",
          titleKey: "client.status.deletedTitle",
          messageKey: "client.status.deletedMessage",
        };
      default:
        return {
          accent: ACCENT,
          softBg: "#F5F3FF",
          softBorder: "#DDD6FE",
          badgeBg: "#F5F3FF",
          badgeBorder: "#DDD6FE",
          titleColor: "#5B21B6",
          messageColor: "#6D28D9",
          logoutBg: "#7C3AED",
          titleKey: "client.status.unknownTitle",
          messageKey: "client.status.unknownMessage",
        };
    }
  }, [status]);

  const handleCheckStatusAgain = useCallback(async () => {
    setCheckingStatus(true);
    try {
      await refreshUser();
    } finally {
      setCheckingStatus(false);
    }
  }, [refreshUser]);

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollInner,
            { paddingBottom: insets.bottom + 32 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.heroCard,
              { borderColor: config.softBorder, backgroundColor: config.softBg },
            ]}
          >
            <View
              style={[styles.statusRibbon, { backgroundColor: config.accent }]}
            />
            <View
              style={[
                styles.iconWrap,
                {
                  backgroundColor: config.badgeBg,
                  borderColor: config.badgeBorder,
                },
              ]}
            >
              <Ionicons name={BLOCK_ICON} size={52} color={config.accent} />
            </View>

            <Text style={[styles.title, { color: config.titleColor }]}>
              {t(config.titleKey)}
            </Text>
            <Text style={[styles.message, { color: config.messageColor }]}>
              {t(config.messageKey)}
            </Text>

            {user?.email ? (
              <View style={styles.emailPill}>
                <Ionicons name="mail-outline" size={16} color="#6B7280" />
                <Text style={styles.emailPillText}>{user.email}</Text>
              </View>
            ) : null}
          </View>

          <TouchableOpacity
            style={[
              styles.refreshStatusBtn,
              {
                borderColor: config.accent,
                flexDirection: isRTL ? "row-reverse" : "row",
              },
              checkingStatus && styles.refreshStatusBtnDimmed,
            ]}
            onPress={() => void handleCheckStatusAgain()}
            disabled={checkingStatus}
            activeOpacity={0.85}
          >
            {checkingStatus ? (
              <ActivityIndicator size="small" color={config.accent} />
            ) : (
              <Ionicons name="refresh" size={22} color={config.accent} />
            )}
            <Text
              style={[
                styles.refreshStatusText,
                { color: config.titleColor },
                isRTL && styles.rtlText,
              ]}
            >
              {t("client.status.checkStatusAgain")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.logoutBtn, { backgroundColor: config.logoutBg }]}
            onPress={() => void logout()}
            activeOpacity={0.88}
          >
            <Ionicons name="log-out-outline" size={20} color="#FFFFFF" />
            <Text style={styles.logoutText}>{t("client.sidebar.logout")}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FAFAFA",
  },
  flex: { flex: 1 },
  scrollInner: {
    paddingHorizontal: 20,
    flexGrow: 1,
    justifyContent: "center",
  },
  heroCard: {
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    alignItems: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
    marginBottom: 16,
  },
  statusRibbon: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 5,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  iconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
    marginTop: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 10,
    letterSpacing: -0.3,
    alignSelf: "stretch",
  },
  message: {
    fontSize: 15,
    lineHeight: 23,
    textAlign: "center",
    alignSelf: "stretch",
  },
  emailPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  emailPillText: {
    fontSize: 13,
    color: "#4B5563",
    fontWeight: "600",
  },
  refreshStatusBtn: {
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    backgroundColor: "#FFFFFF",
    marginTop: 4,
    marginBottom: 10,
  },
  refreshStatusBtnDimmed: {
    opacity: 0.65,
  },
  refreshStatusText: {
    fontSize: 16,
    fontWeight: "700",
  },
  logoutBtn: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 15,
    borderRadius: 14,
    marginTop: 4,
  },
  logoutText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  rtlText: {
    writingDirection: "rtl",
  },
});
