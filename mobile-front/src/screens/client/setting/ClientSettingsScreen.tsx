import React, { useCallback, useLayoutEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { FontAwesome6, Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import type { ClientStackParamList } from "../../../navigation/types";
import { useAppTranslation } from "../../../hooks/useAppTranslation";
import { useAuth } from "../../../context/AuthContext";
import { AuthNoticeModal } from "../../../components/common";
import { api } from "../../../services/api";
import { SettingsRow } from "./SettingsRow";
import { styles } from "./styles";

type Nav = NativeStackNavigationProp<ClientStackParamList>;

const APP_VERSION =
  Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? "1.0.0";

function StatValue({
  loading,
  children,
}: {
  loading: boolean;
  children: React.ReactNode;
}) {
  if (loading) {
    return (
      <View style={statStyles.valueWrap}>
        <ActivityIndicator size="small" color="#4F46E5" />
      </View>
    );
  }
  return <Text style={styles.statValue}>{children}</Text>;
}

const statStyles = StyleSheet.create({
  valueWrap: {
    minHeight: 22,
    justifyContent: "center",
    alignItems: "flex-start",
  },
});

export const ClientSettingsScreen: React.FC = () => {
  const { t, language, setLanguage } = useAppTranslation();
  const { user, logout, refreshUser } = useAuth();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const [inAppNotificationsEnabled, setInAppNotificationsEnabled] =
    useState(true);
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] =
    useState(true);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [ordersCount, setOrdersCount] = useState(0);
  const [reviewsCount, setReviewsCount] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t("client.screenTitles.ClientSettings"),
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ marginLeft: 8, padding: 4 }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={24} color="#1A1A2E" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, t]);

  useFocusEffect(
    useCallback(() => {
      void refreshUser();

      let alive = true;

      const loadStats = async () => {
        setStatsLoading(true);
        try {
          const [appointmentsRes, favoritesRes, reviewsRes] = await Promise.all([
            api.getMyAppointmentsAsClient(),
            api.getClientFavorites(),
            api.getMyClientReviewsCount(),
          ]);

          if (!alive) return;

          const appointments = Array.isArray(appointmentsRes.data)
            ? appointmentsRes.data
            : [];
          setOrdersCount(appointments.length);

          const favoriteItems = favoritesRes.data?.items;
          setSavedCount(
            Array.isArray(favoriteItems) ? favoriteItems.length : 0,
          );

          const reviewTotal = reviewsRes.data?.count;
          setReviewsCount(
            typeof reviewTotal === "number" && Number.isFinite(reviewTotal)
              ? reviewTotal
              : 0,
          );
        } catch {
          if (!alive) return;
          setOrdersCount(0);
          setReviewsCount(0);
          setSavedCount(0);
        } finally {
          if (alive) setStatsLoading(false);
        }
      };

      void loadStats();

      return () => {
        alive = false;
      };
    }, [refreshUser]),
  );

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    t("client.settings.guestName");

  const handle = user?.email
    ? `@${user.email.split("@")[0]}`
    : t("client.settings.noHandle");

  const city = user?.client?.city?.trim();
  const locationLine = city
    ? t("client.settings.locationCity", { city })
    : t("client.settings.noLocation");

  const avatarUri = user?.client?.imageUrl?.trim();

  const onLogout = () => setLogoutModalVisible(true);

  return (
    <SafeAreaView style={styles.safeArea} edges={[ "left", "right"]}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 32 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <Text style={styles.title}>
              {t("client.settings.profileTitle")}
            </Text>
            <TouchableOpacity
              style={styles.iconButton}
              activeOpacity={0.85}
              onPress={() => navigation.navigate("ClientEditProfile")}
            >
              <FontAwesome6 name="pen-to-square" size={14} color="#475569" />
            </TouchableOpacity>
          </View>

          <View style={styles.profileRow}>
            <View style={styles.avatarWrap}>
              <View style={styles.avatarOuterRing}>
                <View style={styles.avatarRingInner}>
                  {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <FontAwesome6 name="user" size={24} color="#F08E10" />
                    </View>
                  )}
                </View>
              </View>
              <TouchableOpacity
                style={styles.cameraButton}
                activeOpacity={0.85}
                onPress={() => navigation.navigate("ClientEditProfile")}
              >
                <FontAwesome6 name="camera" size={9} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{displayName}</Text>
              <Text style={styles.username}>{handle}</Text>
              <View style={styles.badgeRow}>
                <View style={styles.memberBadge}>
                  <FontAwesome6 name="crown" size={8} color="#4F46E5" />
                  <Text style={styles.memberBadgeText}>
                    {t("client.settings.goldMember")}
                  </Text>
                </View>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.location}>{locationLine}</Text>
              </View>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>
                {t("client.settings.statOrders")}
              </Text>
              <StatValue loading={statsLoading}>{ordersCount}</StatValue>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>
                {t("client.settings.statReviews")}
              </Text>
              <StatValue loading={statsLoading}>{reviewsCount}</StatValue>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>
                {t("client.settings.statSaved")}
              </Text>
              <StatValue loading={statsLoading}>{savedCount}</StatValue>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            {t("client.settings.sectionAccount")}
          </Text>
          <View style={styles.card}>
            <SettingsRow
              icon="user"
              iconBackground="#EEF2FF"
              iconColor="#4F46E5"
              title={t("client.settings.menuProfile")}
              subtitle={t("client.settings.menuProfileHint")}
              onPress={() => navigation.navigate("ClientEditProfile")}
            />
            <View style={styles.cardDivider} />
            <SettingsRow
              icon="envelope"
              iconBackground="#EFF6FF"
              iconColor="#2563EB"
              title={t("client.settings.menuChangeEmail")}
              subtitle={t("client.settings.menuChangeEmailHint")}
              onPress={() => navigation.navigate("ClientChangeEmail")}
            />
            <View style={styles.cardDivider} />
            <SettingsRow
              icon="phone"
              iconBackground="#ECFDF5"
              iconColor="#059669"
              title={t("client.settings.menuChangePhone")}
              subtitle={t("client.settings.menuChangePhoneHint")}
              onPress={() => navigation.navigate("ClientChangePhone")}
            />
            <View style={styles.cardDivider} />
            <SettingsRow
              icon="lock"
              iconBackground="#FFF7ED"
              iconColor="#EA580C"
              title={t("client.settings.menuChangePassword")}
              subtitle={t("client.settings.menuChangePasswordHint")}
              onPress={() => navigation.navigate("ClientChangePassword")}
            />
            <View style={styles.cardDivider} />
            <SettingsRow
              icon="location-dot"
              iconBackground="#F5F3FF"
              iconColor="#7C3AED"
              title={t("client.settings.savedAddresses")}
              subtitle={t("client.settings.savedAddressesHint")}
              onPress={() => navigation.navigate("ClientSavedAddresses")}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            {t("client.settings.sectionApp")}
          </Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={[styles.rowIcon, { backgroundColor: "#EEF2FF" }]}>
                  <FontAwesome6 name="language" size={15} color="#4F46E5" />
                </View>
                <View style={styles.rowTextBlock}>
                  <Text style={styles.rowTitle}>
                    {t("client.settings.language")}
                  </Text>
                  <Text style={[styles.rowSubtitle, styles.arabicText]}>
                    {t("client.settings.languageBilingualLine")}
                  </Text>
                </View>
              </View>

              <View style={styles.languagePillGroup}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={
                    language === "en"
                      ? styles.languageActive
                      : styles.languageInactive
                  }
                  onPress={() => void setLanguage("en")}
                >
                  <Text
                    style={
                      language === "en"
                        ? styles.languageActiveText
                        : styles.languageInactiveText
                    }
                  >
                    EN
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={
                    language === "ar"
                      ? styles.languageActive
                      : styles.languageInactive
                  }
                  onPress={() => void setLanguage("ar")}
                >
                  <Text
                    style={[
                      language === "ar"
                        ? styles.languageActiveText
                        : styles.languageInactiveText,
                      styles.arabicText,
                    ]}
                  >
                    عربي
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.cardDivider} />

            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={[styles.rowIcon, { backgroundColor: "#FFF7ED" }]}>
                  <FontAwesome6 name="bell" size={15} color="#F97316" />
                </View>
                <View style={styles.rowTextBlock}>
                  <Text style={styles.rowTitle}>
                    {t("client.settings.inAppNotification")}
                  </Text>
                  <Text style={styles.rowSubtitle}>
                    {t("client.settings.inAppNotificationHint")}
                  </Text>
                </View>
              </View>

              <Switch
                value={inAppNotificationsEnabled}
                onValueChange={setInAppNotificationsEnabled}
                trackColor={{ false: "#CBD5E1", true: "#60A5FA" }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.cardDivider} />

            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={[styles.rowIcon, { backgroundColor: "#EFF6FF" }]}>
                  <FontAwesome6 name="envelope" size={15} color="#2563EB" />
                </View>
                <View style={styles.rowTextBlock}>
                  <Text style={styles.rowTitle}>
                    {t("client.settings.emailNotification")}
                  </Text>
                  <Text style={styles.rowSubtitle}>
                    {t("client.settings.emailNotificationHint")}
                  </Text>
                </View>
              </View>

              <Switch
                value={emailNotificationsEnabled}
                onValueChange={setEmailNotificationsEnabled}
                trackColor={{ false: "#CBD5E1", true: "#60A5FA" }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            {t("client.settings.sectionApplication")}
          </Text>
          <View style={styles.card}>
            <SettingsRow
              icon="tag"
              iconBackground="#F1F5F9"
              iconColor="#475569"
              title={t("client.settings.menuVersion")}
              subtitle={t("client.settings.menuVersionHint")}
              showChevron={false}
              trailing={<Text style={styles.trailingText}>{APP_VERSION}</Text>}
            />
            <View style={styles.cardDivider} />
            <SettingsRow
              icon="file-lines"
              iconBackground="#EEF2FF"
              iconColor="#4F46E5"
              title={t("client.settings.menuTerms")}
              subtitle={t("client.settings.menuTermsHint")}
              onPress={() => navigation.navigate("ClientTerms")}
            />
            <View style={styles.cardDivider} />
            <SettingsRow
              icon="shield-halved"
              iconBackground="#FAF5FF"
              iconColor="#A855F7"
              title={t("client.settings.menuPrivacy")}
              subtitle={t("client.settings.menuPrivacyHint")}
              onPress={() => navigation.navigate("ClientPrivacy")}
            />
            <View style={styles.cardDivider} />
            <SettingsRow
              icon="circle-question"
              iconBackground="#EEF2FF"
              iconColor="#4F46E5"
              title={t("support.menuFaq")}
              subtitle={t("support.menuFaqHint")}
              onPress={() => navigation.navigate("ClientFaq")}
            />
            <View style={styles.cardDivider} />
            <SettingsRow
              icon="envelope-open-text"
              iconBackground="#F0FDFA"
              iconColor="#0F766E"
              title={t("support.menuContact")}
              subtitle={t("support.menuContactHint")}
              onPress={() => navigation.navigate("ClientContactUs")}
            />
          </View>
        </View>

        <View style={[styles.section, styles.bottomSection]}>
          <Text style={styles.sectionLabel}>
            {t("client.settings.sectionActions")}
          </Text>
          <View style={styles.card}>
            <SettingsRow
              icon="user-slash"
              iconBackground="#FEF2F2"
              iconColor="#EF4444"
              title={t("client.settings.deleteAccount")}
              subtitle={t("client.settings.deleteAccountHint")}
              destructive
              onPress={() => navigation.navigate("ClientDeleteAccount")}
            />
            <View style={styles.cardDivider} />
            <TouchableOpacity
              activeOpacity={0.9}
              style={[styles.row, styles.logoutRow]}
              onPress={onLogout}
            >
              <View style={styles.rowLeft}>
                <View style={[styles.rowIcon, styles.logoutIcon]}>
                  <FontAwesome6
                    name="arrow-right-from-bracket"
                    size={15}
                    color="#EF4444"
                  />
                </View>
                <View style={styles.rowTextBlock}>
                  <Text style={[styles.rowTitle, styles.logoutTitle]}>
                    {t("client.sidebar.logout")}
                  </Text>
                  <Text style={styles.rowSubtitle}>
                    {t("client.settings.logoutHint")}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <AuthNoticeModal
        visible={logoutModalVisible}
        onClose={() => setLogoutModalVisible(false)}
        title={t("client.settings.logoutConfirmTitle")}
        message={t("client.settings.logoutConfirmMessage")}
        primaryLabel={t("client.settings.logoutConfirmButton")}
        onPrimary={() => {
          void logout();
        }}
        showDismissLink
        dismissLabel={t("common.cancel")}
      />
    </SafeAreaView>
  );
};
