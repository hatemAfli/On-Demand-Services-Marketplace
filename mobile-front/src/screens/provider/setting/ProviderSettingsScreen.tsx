import React, { useCallback, useLayoutEffect, useState } from "react";
import {
  Image,
  ScrollView,
  StatusBar,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { FontAwesome6, Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import type { ProviderStackParamList } from "../../../navigation/types";
import { useAppTranslation } from "../../../hooks/useAppTranslation";
import { useAuth } from "../../../context/AuthContext";
import { AuthNoticeModal } from "../../../components/common";
import { api } from "../../../services/api";
import { SettingsRow } from "../../client/setting/SettingsRow";
import { styles } from "../../client/setting/styles";

type Nav = NativeStackNavigationProp<ProviderStackParamList>;

const APP_VERSION =
  Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? "1.0.0";

export const ProviderSettingsScreen: React.FC = () => {
  const { t, language, setLanguage } = useAppTranslation();
  const { user, logout } = useAuth();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const [inAppNotificationsEnabled, setInAppNotificationsEnabled] =
    useState(true);
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] =
    useState(true);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [servicesCount, setServicesCount] = useState(0);

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    t("provider.settings.guestName");

  const city = user?.provider?.city?.trim();
  const locationLine = city
    ? t("provider.settings.locationCity", { city })
    : t("provider.settings.noLocation");

  const avatarUri = user?.provider?.photoUrl?.trim();

  const onLogout = () => setLogoutModalVisible(true);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t("provider.screenTitles.ProviderSettings"),
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
      let alive = true;
      const loadServicesCount = async () => {
        try {
          const res = await api.getMyVerificationDocuments();
          const docs = Array.isArray(res.data) ? (res.data as any[]) : [];
          const unique = new Set<string>();
          for (const doc of docs) {
            const id = doc?.verificationRequest?.service?.id;
            if (typeof id === "string" && id.trim()) unique.add(id);
          }
          if (alive) setServicesCount(unique.size);
        } catch {
          if (alive) setServicesCount(0);
        }
      };
      void loadServicesCount();
      return () => {
        alive = false;
      };
    }, []),
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
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
            <View />
            <TouchableOpacity
              style={styles.iconButton}
              activeOpacity={0.85}
              onPress={() => navigation.navigate("ProviderProfile")}
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
                onPress={() => navigation.navigate("ProviderProfile")}
              >
                <FontAwesome6 name="camera" size={9} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{displayName}</Text>
              <View style={styles.badgeRow}>
                <View style={styles.memberBadge}>
                  <FontAwesome6 name="wrench" size={8} color="#4F46E5" />
                  <Text style={styles.memberBadgeText}>
                    {t("provider.sidebar.statusProvider")}
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
                {t("provider.settings.statOrders")}
              </Text>
              <Text style={styles.statValue}>0</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>
                {t("provider.screenTitles.ProviderRatings")}
              </Text>
              <Text style={styles.statValue}>0</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>
                {t("provider.settings.statServices")}
              </Text>
              <Text style={styles.statValue}>{servicesCount}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            {t("provider.settings.sectionAccount")}
          </Text>
          <View style={styles.card}>
            <SettingsRow
              icon="user"
              iconBackground="#EEF2FF"
              iconColor="#4F46E5"
              title={t("provider.settings.menuProfile")}
              subtitle={t("provider.settings.menuProfileHint")}
              onPress={() => navigation.navigate("ProviderProfile")}
            />
            <View style={styles.cardDivider} />
            <SettingsRow
              icon="star"
              iconBackground="#FFFBEB"
              iconColor="#D97706"
              title={t("provider.settings.menuMyReviews")}
              subtitle={t("provider.settings.menuMyReviewsHint")}
              onPress={() => navigation.navigate("ProviderReviews")}
            />
            <View style={styles.cardDivider} />
            <SettingsRow
              icon="envelope"
              iconBackground="#EFF6FF"
              iconColor="#2563EB"
              title={t("provider.settings.menuChangeEmail")}
              subtitle={t("provider.settings.menuChangeEmailHint")}
              onPress={() => navigation.navigate("ProviderChangeEmail")}
            />
            <View style={styles.cardDivider} />
            <SettingsRow
              icon="phone"
              iconBackground="#ECFDF5"
              iconColor="#059669"
              title={t("provider.settings.menuChangePhone")}
              subtitle={t("provider.settings.menuChangePhoneHint")}
              onPress={() => navigation.navigate("ProviderChangePhone")}
            />
            <View style={styles.cardDivider} />
            <SettingsRow
              icon="lock"
              iconBackground="#FFF7ED"
              iconColor="#EA580C"
              title={t("provider.settings.menuChangePassword")}
              subtitle={t("provider.settings.menuChangePasswordHint")}
              onPress={() => navigation.navigate("ProviderChangePassword")}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            {t("provider.settings.sectionApp")}
          </Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={[styles.rowIcon, { backgroundColor: "#EEF2FF" }]}>
                  <FontAwesome6 name="language" size={15} color="#4F46E5" />
                </View>
                <View style={styles.rowTextBlock}>
                  <Text style={styles.rowTitle}>
                    {t("provider.settings.language")}
                  </Text>
                  <Text style={[styles.rowSubtitle, styles.arabicText]}>
                    {t("provider.settings.languageBilingualLine")}
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
                    {t("provider.settings.inAppNotification")}
                  </Text>
                  <Text style={styles.rowSubtitle}>
                    {t("provider.settings.inAppNotificationHint")}
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
                    {t("provider.settings.emailNotification")}
                  </Text>
                  <Text style={styles.rowSubtitle}>
                    {t("provider.settings.emailNotificationHint")}
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
            {t("provider.settings.sectionApplication")}
          </Text>
          <View style={styles.card}>
            <SettingsRow
              icon="tag"
              iconBackground="#F1F5F9"
              iconColor="#475569"
              title={t("provider.settings.menuVersion")}
              subtitle={t("provider.settings.menuVersionHint")}
              showChevron={false}
              trailing={<Text style={styles.trailingText}>{APP_VERSION}</Text>}
            />
            <View style={styles.cardDivider} />
            <SettingsRow
              icon="file-lines"
              iconBackground="#EEF2FF"
              iconColor="#4F46E5"
              title={t("provider.settings.menuTerms")}
              subtitle={t("provider.settings.menuTermsHint")}
              onPress={() => navigation.navigate("ProviderTerms")}
            />
            <View style={styles.cardDivider} />
            <SettingsRow
              icon="shield-halved"
              iconBackground="#FAF5FF"
              iconColor="#A855F7"
              title={t("provider.settings.menuPrivacy")}
              subtitle={t("provider.settings.menuPrivacyHint")}
              onPress={() => navigation.navigate("ProviderPrivacy")}
            />
          </View>
        </View>

        <View style={[styles.section, styles.bottomSection]}>
          <Text style={styles.sectionLabel}>
            {t("provider.settings.sectionActions")}
          </Text>
          <View style={styles.card}>
            <SettingsRow
              icon="headset"
              iconBackground="#F0FDFA"
              iconColor="#0F766E"
              title={t("provider.settings.helpCenter")}
              subtitle={t("provider.settings.helpCenterHint")}
              onPress={() => navigation.navigate("ProviderComplaints")}
            />
            <View style={styles.cardDivider} />
            <SettingsRow
              icon="user-slash"
              iconBackground="#FEF2F2"
              iconColor="#EF4444"
              title={t("provider.settings.deleteAccount")}
              subtitle={t("provider.settings.deleteAccountHint")}
              destructive
              onPress={() => navigation.navigate("ProviderDeleteAccount")}
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
                    {t("provider.settings.logoutHint")}
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
        title={t("provider.settings.logoutConfirmTitle")}
        message={t("provider.settings.logoutConfirmMessage")}
        primaryLabel={t("provider.settings.logoutConfirmButton")}
        onPrimary={() => {
          void logout();
        }}
        showDismissLink
        dismissLabel={t("common.cancel")}
      />
    </SafeAreaView>
  );
};
