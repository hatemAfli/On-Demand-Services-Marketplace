import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AdminDashboardScreen } from "./AdminDashboardScreen";
import { AdminUsersScreen } from "./users/AdminUsersScreen";
import { AdminValidationsScreen } from "./validations/AdminValidationsScreen";
import { AdminValidationProviderDetailScreen } from "./validations/AdminValidationProviderDetailScreen";
import { AdminComplaintsScreen } from "./complaints/AdminComplaintsScreen";
import { AdminComplaintDetailScreen } from "./complaints/AdminComplaintDetailScreen";
import { AdminProfileScreen } from "./AdminProfileScreen";
import type { AdminValidationsStackParamList } from "./validations/adminValidationsNavigation";
import type { AdminComplaintsStackParamList } from "./complaints/adminComplaintsNavigation";

type AdminTabParamList = {
  DashboardTab: undefined;
  UsersTab: undefined;
  ValidationsTab: undefined;
  ComplaintsTab: undefined;
  ProfileTab: undefined;
};

type AdminDashboardStackParamList = {
  Dashboard: undefined;
};

const Tab = createBottomTabNavigator<AdminTabParamList>();
const DashboardStackNav =
  createNativeStackNavigator<AdminDashboardStackParamList>();
const UsersStackNav = createNativeStackNavigator<{ Users: undefined }>();
const ComplaintsStackNav =
  createNativeStackNavigator<AdminComplaintsStackParamList>();
const ProfileStackNav = createNativeStackNavigator<{ Profile: undefined }>();
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
