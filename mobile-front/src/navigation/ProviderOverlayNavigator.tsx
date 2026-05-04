import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  I18nManager,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useWindowDimensions } from "react-native";
import type { ProviderStackParamList } from "./types";
import { COLORS } from "../constants";
import { useAppTranslation } from "../hooks/useAppTranslation";

import { ProviderSidebar } from "../screens/provider/ProviderSidebar";
import { ProviderHomeScreen } from "../screens/provider/home/ProviderHomeScreen";
import { ProviderDashboardScreen } from "../screens/provider/ProviderDashboardScreen";
import { ProviderServicesScreen } from "../screens/provider/services/ProviderServicesScreen";
import { ProviderManageServiceScreen } from "../screens/provider/services/ProviderManageServiceScreen";
import { ProviderMessagesScreen } from "../screens/provider/ProviderMessagesScreen";
import { ProviderNotificationsScreen } from "../screens/provider/ProviderNotificationsScreen";
import { ProviderReclamationsScreen } from "../screens/provider/ProviderReclamationsScreen";
import { ProviderOrdersScreen } from "../screens/provider/ProviderOrdersScreen";
import { ProviderScheduleScreen } from "../screens/provider/ProviderScheduleScreen";
import { ProviderSubscriptionPlanScreen } from "../screens/provider/subscription-plan/ProviderSubscriptionPlanScreen";
import { ProviderRatingsScreen } from "../screens/provider/rating/ProviderRatingsScreen";
import { ProviderProfileScreen } from "../screens/provider/setting/ProviderProfileScreen";
import { ProviderEditProfileScreen } from "../screens/provider/setting/ProviderEditProfileScreen";
import { ProviderSettingsScreen } from "../screens/provider/setting/ProviderSettingsScreen";
import { ProviderChangeEmailScreen } from "../screens/provider/setting/ProviderChangeEmailScreen";
import { ProviderChangePhoneScreen } from "../screens/provider/setting/ProviderChangePhoneScreen";
import { ProviderChangePasswordScreen } from "../screens/provider/setting/ProviderChangePasswordScreen";
import { ProviderDeleteAccountScreen } from "../screens/provider/setting/ProviderDeleteAccountScreen";
import { ProviderDocumentDetailsScreen } from "../screens/provider/setting/ProviderDocumentDetailsScreen";
import { TermsScreen } from "../screens/auth/TermsScreen";
import { PrivacyScreen } from "../screens/auth/PrivacyScreen";

const Stack = createNativeStackNavigator<ProviderStackParamList>();

export const ProviderOverlayNavigator: React.FC = () => {
  const { t } = useAppTranslation();
  const { width } = useWindowDimensions();

  const drawerWidth = useMemo(
    () => Math.min(340, Math.max(280, width * 0.86)),
    [width],
  );

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentRouteName, setCurrentRouteName] =
    useState<keyof ProviderStackParamList>("ProviderHome");

  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: isSidebarOpen ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [anim, isSidebarOpen]);

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: I18nManager.isRTL ? [drawerWidth, 0] : [-drawerWidth, 0],
  });

  const backdropOpacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.45],
  });
  const isRTL = I18nManager.isRTL;

  return (
    <React.Fragment>
      <Stack.Navigator
        initialRouteName="ProviderHome"
        screenListeners={{
          state: (e) => {
            const state = e.data.state;
            const next = state.routes[state.index]
              ?.name as keyof ProviderStackParamList;
            if (next) {
              setCurrentRouteName(next);
              if (next === "ProviderTerms" || next === "ProviderPrivacy") {
                setIsSidebarOpen(false);
              }
            }
          },
        }}
        screenOptions={({ route }) => ({
          headerShown:
            route.name !== "ProviderTerms" &&
            route.name !== "ProviderPrivacy" &&
            route.name !== "ProviderProfile" &&
            route.name !== "ProviderEditProfile" &&
            route.name !== "ProviderDocumentDetails" &&
            route.name !== "ProviderChangeEmail" &&
            route.name !== "ProviderChangePhone" &&
            route.name !== "ProviderChangePassword" &&
            route.name !== "ProviderDeleteAccount" &&
            route.name !== "ProviderManageService",
          headerTitleStyle: { fontWeight: "800", color: COLORS.text.primary },
          headerStyle: {
            backgroundColor: COLORS.background,
          },
          title: t(
            `provider.screenTitles.${route.name as keyof ProviderStackParamList}`,
          ),
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => setIsSidebarOpen(true)}
              style={styles.menuButton}
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
              accessibilityLabel={t("client.a11y.openMenu")}
            >
              <Ionicons name="menu" size={26} color={COLORS.text.primary} />
            </TouchableOpacity>
          ),
        })}
      >
        <Stack.Screen name="ProviderHome" component={ProviderHomeScreen} />
        <Stack.Screen
          name="ProviderDashboard"
          component={ProviderDashboardScreen}
        />
        <Stack.Screen
          name="ProviderServices"
          component={ProviderServicesScreen}
        />
        <Stack.Screen
          name="ProviderManageService"
          component={ProviderManageServiceScreen}
        />
        <Stack.Screen
          name="ProviderMessages"
          component={ProviderMessagesScreen}
        />
        <Stack.Screen
          name="ProviderNotifications"
          component={ProviderNotificationsScreen}
        />
        <Stack.Screen
          name="ProviderReclamations"
          component={ProviderReclamationsScreen}
        />
        <Stack.Screen name="ProviderOrders" component={ProviderOrdersScreen} />
        <Stack.Screen
          name="ProviderSchedule"
          component={ProviderScheduleScreen}
        />
        <Stack.Screen
          name="ProviderSubscriptionPlan"
          component={ProviderSubscriptionPlanScreen}
        />
        <Stack.Screen
          name="ProviderRatings"
          component={ProviderRatingsScreen}
        />
        <Stack.Screen
          name="ProviderProfile"
          component={ProviderProfileScreen}
        />
        <Stack.Screen
          name="ProviderEditProfile"
          component={ProviderEditProfileScreen}
        />
        <Stack.Screen
          name="ProviderDocumentDetails"
          component={ProviderDocumentDetailsScreen}
        />
        <Stack.Screen
          name="ProviderSettings"
          component={ProviderSettingsScreen}
        />
        <Stack.Screen
          name="ProviderChangeEmail"
          component={ProviderChangeEmailScreen}
        />
        <Stack.Screen
          name="ProviderChangePhone"
          component={ProviderChangePhoneScreen}
        />
        <Stack.Screen
          name="ProviderChangePassword"
          component={ProviderChangePasswordScreen}
        />
        <Stack.Screen
          name="ProviderDeleteAccount"
          component={ProviderDeleteAccountScreen}
        />
        <Stack.Screen name="ProviderTerms" component={TermsScreen} />
        <Stack.Screen name="ProviderPrivacy" component={PrivacyScreen} />
      </Stack.Navigator>

      <Animated.View
        pointerEvents={isSidebarOpen ? "auto" : "none"}
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: "#000", opacity: backdropOpacity },
        ]}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={() => setIsSidebarOpen(false)}
          activeOpacity={1}
        />
      </Animated.View>

      <Animated.View
        pointerEvents={isSidebarOpen ? "auto" : "none"}
        style={[
          {
            position: "absolute",
            top: 0,
            bottom: 0,
            width: drawerWidth,
            left: isRTL ? undefined : 0,
            right: isRTL ? 0 : undefined,
            transform: [{ translateX }],
          },
        ]}
      >
        <ProviderSidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          currentRouteName={currentRouteName}
        />
      </Animated.View>
    </React.Fragment>
  );
};

const styles = StyleSheet.create({
  menuButton: {
    marginStart: 10,
  },
});
