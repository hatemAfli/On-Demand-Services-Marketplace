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

import { ClientSidebar } from "../screens/client/sidebar/ClientSidebar";

import { ClientHomeScreen } from "../screens/client/home/ClientHomeScreen";
import { ClientHomeSearchScreen } from "../screens/client/home/ClientHomeSearchScreen";
import { ListOfServicesScreen } from "../screens/client/category-services/ListOfServicesScreen";
import { ClientSearchProviderScreen } from "../screens/client/search";
import { ClientProviderProfileScreen } from "../screens/client/provider/ClientProviderProfileScreen";
import { ClientCompanyProfileScreen } from "../screens/client/provider/ClientCompanyProfileScreen";
import { PublicProviderReviewsScreen } from "../screens/client/provider/PublicProviderReviewsScreen";
import { ClientSlotPickerScreen } from "../screens/client/appointments/ClientSlotPickerScreen";
import { ClientBookingConfirmationScreen } from "../screens/client/appointments/ClientBookingConfirmationScreen";
import { ConversationListScreen } from "../screens/shared/ConversationListScreen";
import { ChatScreen } from "../screens/shared/ChatScreen";
import { ClientAppointmentsScreen } from "../screens/client/appointments/ClientAppointmentsScreen";
import { ClientAppointmentDetailScreen } from "../screens/client/appointments/ClientAppointmentDetailScreen";
import { ClientLeaveReviewScreen } from "../screens/client/appointments/ClientLeaveReviewScreen";
import { ClientFileComplaintScreen } from "../screens/client/appointments/ClientFileComplaintScreen";
import { ClientComplaintSuccessScreen } from "../screens/client/appointments/ClientComplaintSuccessScreen";
import { ClientMyComplaintsScreen } from "../screens/client/complaints/ClientMyComplaintsScreen";
import { ClientComplaintDetailScreen } from "../screens/client/complaints/ClientComplaintDetailScreen";
import {
  ClientMyReviewsScreen,
  ClientReviewDetailScreen,
} from "../screens/client/reviews";
import { ClientFavoritesScreen } from "../screens/client/favorite/ClientFavoritesScreen";
import { ClientFavoritesListScreen } from "../screens/client/favorite/ClientFavoritesListScreen";
import { NotificationsScreen } from "../screens/shared/NotificationsScreen";
import { NotificationDetailScreen } from "../screens/shared/NotificationDetailScreen";
import {
  ClientChangeEmailScreen,
  ClientChangePhoneScreen,
  ClientChangePasswordScreen,
  ClientDeleteAccountScreen,
  ClientEditProfileScreen,
  ClientSavedAddressesScreen,
  ClientSettingsScreen,
} from "../screens/client/setting";
import { TermsScreen } from "../screens/auth/TermsScreen";
import { PrivacyScreen } from "../screens/auth/PrivacyScreen";
import { FaqScreen } from "../screens/shared/FaqScreen";
import { ContactUsScreen } from "../screens/shared/ContactUsScreen";
import { ChatbotScreen } from "../screens/client/chatbot/ChatbotScreen";

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
          headerShown:
            route.name !== "ClientHomeSearch" &&
            route.name !== "ClientCategoryServices" &&
            route.name !== "ClientSearchProvider" &&
            route.name !== "ClientProviderProfile" &&
            route.name !== "ClientCompanyProfile" &&
            route.name !== "ClientSlotPicker" &&
            route.name !== "ClientBookingConfirmation" &&
            route.name !== "ClientComplaintSuccess" &&
            route.name !== "ClientFavoritesList" &&
            route.name !== "ClientEditProfile" &&
            route.name !== "ClientChangeEmail" &&
            route.name !== "ClientChangePhone" &&
            route.name !== "ClientChangePassword" &&
            route.name !== "ClientSavedAddresses" &&
            route.name !== "ClientDeleteAccount" &&
            route.name !== "ClientTerms" &&
            route.name !== "ClientPrivacy" &&
            route.name !== "Notifications" &&
            route.name !== "NotificationDetail" &&
            route.name !== "ConversationList" &&
            route.name !== "ClientMessages" &&
            route.name !== "ChatScreen" &&
            route.name !== "ClientChatbot",
          headerTitleStyle: { fontWeight: "800", color: COLORS.text.primary },
          headerStyle: {
            backgroundColor: COLORS.background,
          },
          title: t(
            `client.screenTitles.${route.name as keyof ClientStackParamList}`,
          ),
          // Avoid native "arrow-back" flashing when screens use a custom chevron in headerLeft.
          headerBackVisible: false,
          ...(route.name === "ClientHome"
            ? {
                headerLeft: () => (
                  <TouchableOpacity
                    onPress={() => setIsSidebarOpen(true)}
                    style={styles.menuButton}
                    hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                    accessibilityLabel={t("client.a11y.openMenu")}
                  >
                    <Ionicons
                      name="menu"
                      size={26}
                      color={COLORS.text.primary}
                    />
                  </TouchableOpacity>
                ),
              }
            : {}),
        })}
      >
        <Stack.Screen name="ClientHome" component={ClientHomeScreen} />
        <Stack.Screen
          name="ClientHomeSearch"
          component={ClientHomeSearchScreen}
        />
        <Stack.Screen
          name="ClientCategoryServices"
          component={ListOfServicesScreen}
        />
        <Stack.Screen
          name="ClientSearchProvider"
          component={ClientSearchProviderScreen}
        />
        <Stack.Screen
          name="ClientProviderProfile"
          component={ClientProviderProfileScreen}
        />
        <Stack.Screen
          name="ClientCompanyProfile"
          component={ClientCompanyProfileScreen}
        />
        <Stack.Screen
          name="PublicProviderReviews"
          component={PublicProviderReviewsScreen}
        />
        <Stack.Screen
          name="ClientSlotPicker"
          component={ClientSlotPickerScreen}
        />
        <Stack.Screen
          name="ClientBookingConfirmation"
          component={ClientBookingConfirmationScreen}
          options={{ gestureEnabled: false }}
        />
        <Stack.Screen
          name="ClientMessages"
          component={ConversationListScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ConversationList"
          component={ConversationListScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ChatScreen"
          component={ChatScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ClientAppointments"
          component={ClientAppointmentsScreen}
        />
        <Stack.Screen
          name="ClientAppointmentDetail"
          component={ClientAppointmentDetailScreen}
        />
        <Stack.Screen
          name="ClientLeaveReview"
          component={ClientLeaveReviewScreen}
        />
        <Stack.Screen
          name="ClientFileComplaint"
          component={ClientFileComplaintScreen}
        />
        <Stack.Screen
          name="ClientComplaintSuccess"
          component={ClientComplaintSuccessScreen}
          options={{ headerShown: false, gestureEnabled: false }}
        />
        <Stack.Screen
          name="ClientMyComplaints"
          component={ClientMyComplaintsScreen}
        />
        <Stack.Screen
          name="ClientComplaintDetail"
          component={ClientComplaintDetailScreen}
        />
        <Stack.Screen
          name="ClientMyReviews"
          component={ClientMyReviewsScreen}
        />
        <Stack.Screen
          name="ClientReviewDetail"
          component={ClientReviewDetailScreen}
        />
        <Stack.Screen
          name="ClientFavorites"
          component={ClientFavoritesScreen}
        />
        <Stack.Screen
          name="ClientFavoritesList"
          component={ClientFavoritesListScreen}
        />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen
          name="NotificationDetail"
          component={NotificationDetailScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen name="ClientSettings" component={ClientSettingsScreen} />
        <Stack.Screen
          name="ClientEditProfile"
          component={ClientEditProfileScreen}
        />
        <Stack.Screen
          name="ClientChangeEmail"
          component={ClientChangeEmailScreen}
        />
        <Stack.Screen
          name="ClientChangePhone"
          component={ClientChangePhoneScreen}
        />
        <Stack.Screen
          name="ClientChangePassword"
          component={ClientChangePasswordScreen}
        />
        <Stack.Screen
          name="ClientSavedAddresses"
          component={ClientSavedAddressesScreen}
        />
        <Stack.Screen
          name="ClientDeleteAccount"
          component={ClientDeleteAccountScreen}
        />
        <Stack.Screen name="ClientTerms" component={TermsScreen} />
        <Stack.Screen name="ClientPrivacy" component={PrivacyScreen} />
        <Stack.Screen name="ClientFaq" component={FaqScreen} />
        <Stack.Screen name="ClientContactUs" component={ContactUsScreen} />
        <Stack.Screen
          name="ClientChatbot"
          component={ChatbotScreen}
          options={{ headerShown: false }}
        />
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
