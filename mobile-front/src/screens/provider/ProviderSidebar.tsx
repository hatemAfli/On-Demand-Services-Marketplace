import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  I18nManager,
  useWindowDimensions,
  Image,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../../constants";
import type { ProviderStackParamList } from "../../navigation/types";
import { useAuth } from "../../context/AuthContext";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAppTranslation } from "../../hooks/useAppTranslation";
import type { UserWithProfile } from "../../types";
import { ProviderType } from "../../types";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

const MENU_ITEMS: {
  key: keyof ProviderStackParamList;
  labelKey: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: "ProviderHome", labelKey: "provider.sidebar.menu.home", icon: "home-outline" },
  {
    key: "ProviderDashboard",
    labelKey: "provider.sidebar.menu.dashboard",
    icon: "stats-chart-outline",
  },
  {
    key: "ProviderServices",
    labelKey: "provider.sidebar.menu.services",
    icon: "construct-outline",
  },
  {
    key: "ProviderMessages",
    labelKey: "provider.sidebar.menu.messages",
    icon: "chatbubbles-outline",
  },
  {
    key: "ProviderNotifications",
    labelKey: "provider.sidebar.menu.notifications",
    icon: "notifications-outline",
  },
  {
    key: "ProviderReclamations",
    labelKey: "provider.sidebar.menu.reclamations",
    icon: "alert-circle-outline",
  },
  {
    key: "ProviderOrders",
    labelKey: "provider.sidebar.menu.orders",
    icon: "receipt-outline",
  },
  {
    key: "ProviderSchedule",
    labelKey: "provider.sidebar.menu.schedule",
    icon: "calendar-outline",
  },
  {
    key: "ProviderGallery",
    labelKey: "provider.sidebar.menu.gallery",
    icon: "images-outline",
  },
  {
    key: "ProviderRatings",
    labelKey: "provider.sidebar.menu.ratings",
    icon: "star-outline",
  },
  {
    key: "ProviderProfile",
    labelKey: "provider.sidebar.menu.profile",
    icon: "person-outline",
  },
  {
    key: "ProviderSettings",
    labelKey: "provider.sidebar.menu.settings",
    icon: "settings-outline",
  },
];

const VERTICAL_MARGIN = 14;
const HORIZONTAL_MARGIN = 8;

export const ProviderSidebar: React.FC<Props> = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const { t } = useAppTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const drawerWidth = Math.min(340, Math.max(280, width * 0.86));

  const profile = user as UserWithProfile | null;
  const providerType = profile?.provider?.type;
  const typeLabel =
    providerType === ProviderType.INDEPENDENT ||
    providerType === ProviderType.EMPLOYEE
      ? t(`provider.type.${providerType}`)
      : t("provider.type.unknown");

  const navigation =
    useNavigation<NativeStackNavigationProp<ProviderStackParamList>>();

  const handleLogout = async () => {
    onClose();
    await logout();
  };

  const marginTop = insets.top + VERTICAL_MARGIN;
  const marginBottom = insets.bottom + VERTICAL_MARGIN;

  const avatarUri = profile?.provider?.photoUrl;

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
                <Ionicons name="construct" size={26} color={COLORS.primaryLight} />
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
            {(profile?.firstName ?? "") + " " + (profile?.lastName ?? "")}
          </Text>

          <Text
            style={[
              styles.typeText,
              { textAlign: I18nManager.isRTL ? "right" : "left" },
            ]}
            numberOfLines={1}
          >
            {typeLabel}
          </Text>

          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>
              {t("provider.sidebar.statusProvider")}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.menuScroll}
        contentContainerStyle={[
          styles.menuScrollContent,
          { paddingBottom: Math.max(insets.bottom, 12) },
        ]}
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
        bounces
      >
        <Text style={styles.sectionTitle}>{t("provider.sidebar.mySpace")}</Text>

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
      </ScrollView>
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
    backgroundColor: "rgba(255,255,255,0.12)",
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
    marginBottom: 4,
    alignSelf: "stretch",
  },
  typeText: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
    marginBottom: 8,
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
  menuScroll: {
    flex: 1,
  },
  menuScrollContent: {
    paddingHorizontal: 14,
    paddingTop: 8,
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
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    marginBottom: 6,
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
    marginTop: 10,
    marginBottom: 8,
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
