import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AdminDashboardScreen } from "./dashboard/AdminDashboardScreen";
import type { AdminTabParamList } from "./adminNavigation";
import { AdminUsersScreen } from "./users/AdminUsersScreen";
import { AdminUserDetailScreen } from "./users/AdminUserDetailScreen";
import type { AdminUsersStackParamList } from "./users/adminUsersNavigation";
import { AdminValidationsScreen } from "./validations/AdminValidationsScreen";
import { AdminValidationProviderDetailScreen } from "./validations/AdminValidationProviderDetailScreen";
import { AdminComplaintsScreen } from "./complaints/AdminComplaintsScreen";
import { AdminComplaintDetailScreen } from "./complaints/AdminComplaintDetailScreen";
import { AdminProfileScreen } from "./profile/AdminProfileScreen";
import { AdminEditProfileScreen } from "./profile/AdminEditProfileScreen";
import { AdminChangeEmailScreen } from "./profile/AdminChangeEmailScreen";
import { AdminChangePhoneScreen } from "./profile/AdminChangePhoneScreen";
import { AdminChangePasswordScreen } from "./profile/AdminChangePasswordScreen";
import type { AdminProfileStackParamList } from "./profile/adminProfileNavigation";
import { NotificationsScreen } from "../shared/NotificationsScreen";
import { TermsScreen } from "../auth/TermsScreen";
import { PrivacyScreen } from "../auth/PrivacyScreen";
import type { AdminValidationsStackParamList } from "./validations/adminValidationsNavigation";
import type { AdminComplaintsStackParamList } from "./complaints/adminComplaintsNavigation";

type AdminDashboardStackParamList = {
  Dashboard: undefined;
};

const Tab = createBottomTabNavigator<AdminTabParamList>();
const DashboardStackNav =
  createNativeStackNavigator<AdminDashboardStackParamList>();
const UsersStackNav = createNativeStackNavigator<AdminUsersStackParamList>();
const ComplaintsStackNav =
  createNativeStackNavigator<AdminComplaintsStackParamList>();
const ProfileStackNav =
  createNativeStackNavigator<AdminProfileStackParamList>();
const ValidationsStackNav =
  createNativeStackNavigator<AdminValidationsStackParamList>();

const defaultStackScreenOptions = {
  headerShown: false,
  contentStyle: { backgroundColor: "#F9FAFB" },
};

const DashboardStack: React.FC = () => (
  <DashboardStackNav.Navigator screenOptions={defaultStackScreenOptions}>
    <DashboardStackNav.Screen name="Dashboard" component={AdminDashboardScreen} />
  </DashboardStackNav.Navigator>
);

const UsersStack: React.FC = () => (
  <UsersStackNav.Navigator screenOptions={defaultStackScreenOptions}>
    <UsersStackNav.Screen name="Users" component={AdminUsersScreen} />
    <UsersStackNav.Screen
      name="AdminUserDetail"
      component={AdminUserDetailScreen}
    />
  </UsersStackNav.Navigator>
);

const ValidationsStack: React.FC = () => (
  <ValidationsStackNav.Navigator screenOptions={defaultStackScreenOptions}>
    <ValidationsStackNav.Screen
      name="ValidationsHome"
      component={AdminValidationsScreen}
    />
    <ValidationsStackNav.Screen
      name="ValidationProviderDetail"
      component={AdminValidationProviderDetailScreen}
    />
  </ValidationsStackNav.Navigator>
);

const ComplaintsStack: React.FC = () => (
  <ComplaintsStackNav.Navigator screenOptions={defaultStackScreenOptions}>
    <ComplaintsStackNav.Screen
      name="AdminComplaints"
      component={AdminComplaintsScreen}
    />
    <ComplaintsStackNav.Screen
      name="AdminComplaintDetail"
      component={AdminComplaintDetailScreen}
    />
  </ComplaintsStackNav.Navigator>
);

const ProfileStack: React.FC = () => (
  <ProfileStackNav.Navigator screenOptions={defaultStackScreenOptions}>
    <ProfileStackNav.Screen name="Profile" component={AdminProfileScreen} />
    <ProfileStackNav.Screen
      name="AdminEditProfile"
      component={AdminEditProfileScreen}
    />
    <ProfileStackNav.Screen
      name="AdminChangeEmail"
      component={AdminChangeEmailScreen}
    />
    <ProfileStackNav.Screen
      name="AdminChangePhone"
      component={AdminChangePhoneScreen}
    />
    <ProfileStackNav.Screen
      name="AdminChangePassword"
      component={AdminChangePasswordScreen}
    />
    <ProfileStackNav.Screen name="AdminNotifications">
      {() => <NotificationsScreen variant="admin" />}
    </ProfileStackNav.Screen>
    <ProfileStackNav.Screen
      name="AdminTerms"
      component={TermsScreen}
      options={{ headerShown: true, title: "Terms" }}
    />
    <ProfileStackNav.Screen
      name="AdminPrivacy"
      component={PrivacyScreen}
      options={{ headerShown: true, title: "Privacy" }}
    />
  </ProfileStackNav.Navigator>
);

type TabIconName =
  | "speedometer-outline"
  | "people-outline"
  | "checkmark-done-outline"
  | "shield-outline"
  | "person-circle-outline";

const getTabIcon = (routeName: keyof AdminTabParamList): TabIconName => {
  switch (routeName) {
    case "DashboardTab":
      return "speedometer-outline";
    case "UsersTab":
      return "people-outline";
    case "ValidationsTab":
      return "checkmark-done-outline";
    case "ComplaintsTab":
      return "shield-outline";
    case "ProfileTab":
      return "person-circle-outline";
    default:
      return "speedometer-outline";
  }
};

export const AdminNavigator: React.FC = () => {
  const insets = useSafeAreaInsets();
  const tabBarBottomPad = Math.max(10, 8 + insets.bottom);
  const tabBarMinHeight = 52 + tabBarBottomPad;

  return (
    <Tab.Navigator
      initialRouteName="DashboardTab"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: "#E8C97A",
        tabBarInactiveTintColor: "#6B7280",
        tabBarStyle: {
          minHeight: tabBarMinHeight,
          paddingTop: 8,
          paddingBottom: tabBarBottomPad,
          backgroundColor: "#FFFFFF",
          borderTopColor: "#E5E7EB",
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
        tabBarIcon: ({ color, size }) => (
          <Ionicons
            name={getTabIcon(route.name)}
            color={color}
            size={size}
          />
        ),
      })}
    >
      <Tab.Screen
        name="DashboardTab"
        component={DashboardStack}
        options={{ title: "Dashboard" }}
      />
      <Tab.Screen
        name="UsersTab"
        component={UsersStack}
        options={{ title: "Users" }}
      />
      <Tab.Screen
        name="ValidationsTab"
        component={ValidationsStack}
        options={{ title: "Validations" }}
      />
      <Tab.Screen
        name="ComplaintsTab"
        component={ComplaintsStack}
        options={{ title: "Complaints" }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStack}
        options={{ title: "Profile" }}
      />
    </Tab.Navigator>
  );
};
