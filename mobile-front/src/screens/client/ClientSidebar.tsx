import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  I18nManager,
  useWindowDimensions,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../../constants";
import type { ClientStackParamList } from "../../navigation/types";
import { useAuth } from "../../context/AuthContext";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAppTranslation } from "../../hooks/useAppTranslation";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

const MENU_ITEMS: {
  key: keyof ClientStackParamList;
  labelKey: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    key: "ClientHome",
    labelKey: "client.sidebar.menu.home",
    icon: "home-outline",
  },
  {
    key: "ClientSearchProvider",
    labelKey: "client.sidebar.menu.searchProvider",
    icon: "search-outline",
  },
  {
    key: "ClientMessages",
    labelKey: "client.sidebar.menu.messages",
    icon: "chatbubbles-outline",
  },
  {
    key: "ClientReclamation",
    labelKey: "client.sidebar.menu.reclamation",
    icon: "alert-circle-outline",
  },
  {
    key: "ClientReservation",
    labelKey: "client.sidebar.menu.reservation",
    icon: "calendar-outline",
  },
  {
    key: "ClientFavorites",
    labelKey: "client.sidebar.menu.favorites",
    icon: "heart-outline",
  },
  {
    key: "ClientNotifications",
    labelKey: "client.sidebar.menu.notifications",
    icon: "notifications-outline",
  },
  {
    key: "ClientProfile",
    labelKey: "client.sidebar.menu.profile",
    icon: "person-outline",
  },
  {
    key: "ClientSettings",
    labelKey: "client.sidebar.menu.settings",
    icon: "settings-outline",
  },
];

const VERTICAL_MARGIN = 14;
const HORIZONTAL_MARGIN = 8;

export const ClientSidebar: React.FC<Props> = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const { t } = useAppTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const drawerWidth = Math.min(340, Math.max(280, width * 0.86));

  const statusLabel = t("client.sidebar.statusClient");

  const navigation =
    useNavigation<NativeStackNavigationProp<ClientStackParamList>>();

  const handleLogout = async () => {
    onClose();
    await logout();
  };

  const marginTop = insets.top + VERTICAL_MARGIN;
  const marginBottom = insets.bottom + VERTICAL_MARGIN;

  const avatarUri = user?.client?.imageUrl;

  return (
    <View
      style={[
        styles.drawer,
        {
          width: drawerWidth,
          marginTop,
          marginBottom,
          marginHorizontal: HORIZONTAL_MARGIN,
          opacity: isOpen ? 1 : 0,
        },
      ]}
      pointerEvents={isOpen ? "auto" : "none"}
    >
      <LinearGradient
        colors={["#0b1020", "#1f1b4a", "#2b1b77"]}
        style={styles.headerGradient}
      >
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel={t("client.a11y.closeSidebar")}
        >
          <Ionicons name="close" size={26} color="rgba(255,255,255,0.92)" />
        </TouchableOpacity>

        <View style={styles.profileBlock}>
          <View style={styles.avatarOuter}>
            <View style={styles.avatarInner}>
              {avatarUri ? (
                <Image
                  source={{ uri: avatarUri }}
                  style={styles.avatarImage}
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <Ionicons name="person" size={26} color={COLORS.primaryLight} />
              )}
            </View>
          </View>

          <Text
            style={[
              styles.nameText,
              { textAlign: I18nManager.isRTL ? "right" : "left" },
            ]}
            numberOfLines={2}
          >
            {(user?.firstName ?? "") + " " + (user?.lastName ?? "")}
          </Text>

          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>{statusLabel}</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.content}>
        <Text style={styles.sectionTitle}>{t("client.sidebar.mySpace")}</Text>

        {MENU_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={styles.itemRow}
            onPress={() => {
              navigation.navigate(item.key);
              onClose();
            }}
            activeOpacity={0.8}
          >
            <Ionicons
              name={item.icon}
              size={20}
              color="rgba(255,255,255,0.9)"
            />
            <Text style={styles.itemLabel}>{t(item.labelKey)}</Text>
            <Ionicons
              name={I18nManager.isRTL ? "chevron-back" : "chevron-forward"}
              size={16}
              color="rgba(255,255,255,0.35)"
            />
          </TouchableOpacity>
        ))}

        <View style={styles.separator} />

        <TouchableOpacity
          style={[styles.itemRow, styles.logoutRow]}
          onPress={handleLogout}
          activeOpacity={0.85}
        >
          <Ionicons name="log-out-outline" size={20} color="#fecaca" />
          <Text style={[styles.itemLabel, styles.logoutLabel]}>
            {t("client.sidebar.logout")}
          </Text>
          <Ionicons
            name={I18nManager.isRTL ? "chevron-back" : "chevron-forward"}
            size={16}
            color="rgba(255,255,255,0.35)"
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  drawer: {
    backgroundColor: "#0b1020",
    borderRadius: 18,
    overflow: "hidden",
    flex: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  headerGradient: {
    paddingTop: 12,
    paddingBottom: 16,
    paddingHorizontal: 16,
    position: "relative",
  },
  closeButton: {
    position: "absolute",
    top: 8,
    end: 8,
    zIndex: 2,
    padding: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  profileBlock: {
    alignItems: "flex-start",
    paddingTop: 4,
    paddingEnd: 48,
    maxWidth: "100%",
  },
  avatarOuter: {
    width: 64,
    height: 64,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  avatarInner: {
    width: 54,
    height: 54,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
  },
  nameText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.2,
    marginBottom: 6,
    alignSelf: "stretch",
  },
  statusRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-start",
    alignItems: "center",
    marginTop: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.secondaryLight,
  },
  statusText: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 13,
    fontWeight: "700",
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 12,
    flexGrow: 1,
  },
  sectionTitle: {
    color: "rgba(255,255,255,0.65)",
    fontWeight: "800",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    marginBottom: 10,
    marginStart: 10,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 14,
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    marginBottom: 8,
  },
  itemLabel: {
    flex: 1,
    color: "rgba(255,255,255,0.92)",
    fontSize: 14,
    fontWeight: "800",
  },
  separator: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginTop: 14,
    marginBottom: 10,
  },
  logoutRow: {
    backgroundColor: "rgba(239,68,68,0.14)",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.35)",
    marginTop: 4,
  },
  logoutLabel: {
    color: "#fecaca",
  },
});
