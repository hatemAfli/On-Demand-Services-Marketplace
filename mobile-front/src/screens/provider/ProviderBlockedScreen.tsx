import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  I18nManager,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { useAppTranslation } from "../../hooks/useAppTranslation";
import { AccountStatus } from "../../types";
import { COLORS } from "../../constants";
import { ClientHeaderLanguageChips } from "../../components/common";

type BlockConfig = {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  gradient: [string, string, string, string];
  titleKey: string;
  messageKey: string;
};

export const ProviderBlockedScreen: React.FC = () => {
  const { user, logout } = useAuth();
  const { t, isRTL } = useAppTranslation();
  const insets = useSafeAreaInsets();
  const status = user?.status;

  const config = useMemo((): BlockConfig => {
    switch (status) {
      case AccountStatus.PENDING:
        return {
          icon: "hourglass-outline",
          iconColor: "#FBBF24",
          gradient: ["#0f172a", "#1e1b4b", "#312e81", "#4c1d95"],
          titleKey: "provider.status.pendingTitle",
          messageKey: "provider.status.pendingMessage",
        };
      case AccountStatus.REJECTED:
        return {
          icon: "close-circle-outline",
          iconColor: "#FB7185",
          gradient: ["#1a0a0f", "#3f0d1a", "#7f1d1d", "#451a03"],
          titleKey: "provider.status.rejectedTitle",
          messageKey: "provider.status.rejectedMessage",
        };
      case AccountStatus.SUSPENDED:
        return {
          icon: "pause-circle-outline",
          iconColor: "#FBBF24",
          gradient: ["#0c1220", "#1c2b45", "#1e3a5f", "#0f2847"],
          titleKey: "provider.status.suspendedTitle",
          messageKey: "provider.status.suspendedMessage",
        };
      case AccountStatus.DELETED:
        return {
          icon: "trash-outline",
          iconColor: "#94A3B8",
          gradient: ["#0a0e14", "#1e293b", "#334155", "#1e293b"],
          titleKey: "provider.status.deletedTitle",
          messageKey: "provider.status.deletedMessage",
        };
      default:
        return {
          icon: "help-circle-outline",
          iconColor: ACCENT,
          gradient: ["#0f172a", "#1e293b", "#334155", "#1e293b"],
          titleKey: "provider.status.unknownTitle",
          messageKey: "provider.status.unknownMessage",
        };
    }
  }, [status]);

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={config.gradient}
        locations={[0, 0.35, 0.72, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <View
        style={[
          styles.headerBar,
          {
            paddingTop: insets.top + 8,
            flexDirection: I18nManager.isRTL ? "row-reverse" : "row",
          },
        ]}
      >
        <View style={{ flex: 1 }} />
        <ClientHeaderLanguageChips />
      </View>

      <View style={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
        <View style={[styles.iconWrap, isRTL && styles.rtlAlign]}>
          <LinearGradient
            colors={["rgba(255,255,255,0.12)", "rgba(255,255,255,0.04)"]}
            style={styles.iconCircle}
          >
            <Ionicons name={config.icon} size={56} color={config.iconColor} />
          </LinearGradient>
        </View>

        <Text style={[styles.title, isRTL && styles.rtlText]}>
          {t(config.titleKey)}
        </Text>
        <Text style={[styles.message, isRTL && styles.rtlText]}>
          {t(config.messageKey)}
        </Text>

        {user?.email ? (
          <Text style={[styles.emailNote, isRTL && styles.rtlText]}>
            {t("provider.status.signedInAs", { email: user.email })}
          </Text>
        ) : null}

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => void logout()}
          activeOpacity={0.88}
        >
          <Ionicons name="log-out-outline" size={22} color="#fff" />
          <Text style={styles.logoutText}>{t("client.sidebar.logout")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const ACCENT = "#A78BFA";

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  headerBar: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  body: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: "center",
  },
  rtlAlign: {
    alignSelf: "stretch",
    alignItems: "flex-end",
  },
  rtlText: {
    textAlign: "right",
    writingDirection: "rtl",
  },
  iconWrap: {
    marginBottom: 28,
    alignItems: "center",
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#f8fafc",
    textAlign: "center",
    marginBottom: 14,
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    color: "rgba(226,232,240,0.92)",
    textAlign: "center",
  },
  emailNote: {
    marginTop: 20,
    fontSize: 13,
    color: "rgba(148,163,184,0.95)",
    textAlign: "center",
  },
  logoutBtn: {
    marginTop: 36,
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
