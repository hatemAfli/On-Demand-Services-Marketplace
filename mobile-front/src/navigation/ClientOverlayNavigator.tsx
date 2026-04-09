import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  I18nManager,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useWindowDimensions } from "react-native";
import type { ClientStackParamList } from "./types";
import { COLORS } from "../constants";
import { useAppTranslation } from "../hooks/useAppTranslation";
import { ClientHeaderLanguageChips } from "../components/common";

import { ClientSidebar } from "../screens/client/ClientSidebar";

import { ClientHomeScreen } from "../screens/client/ClientHomeScreen";
import { ClientSearchProviderScreen } from "../screens/client/ClientSearchProviderScreen";
import { ClientMessagesScreen } from "../screens/client/ClientMessagesScreen";
import { ClientReclamationScreen } from "../screens/client/ClientReclamationScreen";
import { ClientReservationScreen } from "../screens/client/ClientReservationScreen";
import { ClientFavoritesScreen } from "../screens/client/ClientFavoritesScreen";
import { ClientNotificationsScreen } from "../screens/client/ClientNotificationsScreen";
import { ClientProfileScreen } from "../screens/client/ClientProfileScreen";
import { ClientSettingsScreen } from "../screens/client/ClientSettingsScreen";

const Stack = createNativeStackNavigator<ClientStackParamList>();

export const ClientOverlayNavigator: React.FC = () => {
  const { t } = useAppTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const drawerWidth = useMemo(
    () => Math.min(340, Math.max(280, width * 0.86)),
    [width],
  );

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
        initialRouteName="ClientHome"
        screenOptions={({ route }) => ({
          headerShown: true,
          headerTitleStyle: { fontWeight: "800", color: COLORS.text.primary },
          headerStyle: {
            backgroundColor: COLORS.background,
          },
          title: t(
            `client.screenTitles.${route.name as keyof ClientStackParamList}`,
          ),
          headerRight: () => <ClientHeaderLanguageChips />,
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
        <Stack.Screen name="ClientHome" component={ClientHomeScreen} />
        <Stack.Screen
          name="ClientSearchProvider"
          component={ClientSearchProviderScreen}
        />
        <Stack.Screen name="ClientMessages" component={ClientMessagesScreen} />
        <Stack.Screen
          name="ClientReclamation"
          component={ClientReclamationScreen}
        />
        <Stack.Screen
          name="ClientReservation"
          component={ClientReservationScreen}
        />
        <Stack.Screen
          name="ClientFavorites"
          component={ClientFavoritesScreen}
        />
        <Stack.Screen
          name="ClientNotifications"
          component={ClientNotificationsScreen}
        />
        <Stack.Screen name="ClientProfile" component={ClientProfileScreen} />
        <Stack.Screen name="ClientSettings" component={ClientSettingsScreen} />
      </Stack.Navigator>

      {/** Backdrop */}
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

      {/** Sidebar */}
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
        <ClientSidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
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
