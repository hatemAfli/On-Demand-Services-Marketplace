import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { navigationRef } from "../../navigation/rootNavigationRef";

export type AdminTabParamList = {
  DashboardTab: undefined;
  UsersTab:
    | undefined
    | {
        screen?: "Users" | "AdminUserDetail";
        params?: { userId?: string };
      };
  ValidationsTab:
    | undefined
    | {
        screen?: "ValidationsHome" | "ValidationProviderDetail";
        params?: { requestId?: string; userEmail?: string };
      };
  ComplaintsTab:
    | undefined
    | {
        screen?: "AdminComplaints" | "AdminComplaintDetail";
        params?: { complaintId?: string };
      };
  ProfileTab:
    | undefined
    | {
        screen?: keyof import("./profile/adminProfileNavigation").AdminProfileStackParamList;
        params?: object;
      };
};

/** Cross-tab navigation from any nested admin stack screen. */
export function navigateAdminTab(
  navigation: NavigationProp<ParamListBase>,
  tab: keyof AdminTabParamList,
  nested?: { screen: string; params?: object },
): void {
  const nestedParams = nested
    ? { screen: nested.screen, params: nested.params }
    : undefined;

  if (navigationRef.current?.isReady()) {
    navigationRef.current.navigate(tab as string, nestedParams);
    return;
  }

  const tabNav = navigation.getParent();
  if (tabNav) {
    tabNav.navigate(tab as string, nestedParams);
  }
}
