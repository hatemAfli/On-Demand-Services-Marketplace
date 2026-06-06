import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { navigationRef } from "../../../navigation/rootNavigationRef";
import type { AppNotification } from "../../../services/api";
import { navigateAdminTab } from "../adminNavigation";

function normalizeData(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
    return null;
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return null;
}

function readId(
  data: Record<string, unknown> | null | undefined,
  key: string,
): string | undefined {
  const value = data?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

const COMPLAINT_TYPES = new Set([
  "COMPLAINT_FILED",
  "COMPLAINT_STATUS_UPDATED",
  "COMPLAINT_RESOLVED",
  "COMPLAINT_DISMISSED",
]);

/** Navigate to the appropriate admin detail screen for a notification. */
export function navigateFromAdminNotification(
  navigation: NavigationProp<ParamListBase>,
  item: AppNotification,
): void {
  const data = normalizeData(item.data);
  const text = `${item.title} ${item.body}`;

  const screen = readId(data, "screen");
  const complaintId = readId(data, "complaintId");
  const requestId =
    readId(data, "verificationRequestId") ?? readId(data, "requestId");
  const userId = readId(data, "userId");

  if (screen === "AdminComplaintDetail" && complaintId) {
    navigateAdminTab(navigation, "ComplaintsTab", {
      screen: "AdminComplaintDetail",
      params: { complaintId },
    });
    return;
  }

  if (screen === "ValidationProviderDetail" && requestId) {
    navigateAdminTab(navigation, "ValidationsTab", {
      screen: "ValidationProviderDetail",
      params: { requestId },
    });
    return;
  }

  if (screen === "AdminUserDetail" && userId) {
    navigateAdminTab(navigation, "UsersTab", {
      screen: "AdminUserDetail",
      params: { userId },
    });
    return;
  }

  if (
    complaintId &&
    (COMPLAINT_TYPES.has(item.type) || item.type === "SYSTEM_ANNOUNCEMENT")
  ) {
    navigateAdminTab(navigation, "ComplaintsTab", {
      screen: "AdminComplaintDetail",
      params: { complaintId },
    });
    return;
  }

  if (requestId) {
    navigateAdminTab(navigation, "ValidationsTab", {
      screen: "ValidationProviderDetail",
      params: { requestId },
    });
    return;
  }

  if (userId) {
    navigateAdminTab(navigation, "UsersTab", {
      screen: "AdminUserDetail",
      params: { userId },
    });
    return;
  }

  if (COMPLAINT_TYPES.has(item.type) || /complaint|reclamation/i.test(text)) {
    navigateAdminTab(navigation, "ComplaintsTab");
    return;
  }

  if (/verification|validat/i.test(text)) {
    navigateAdminTab(navigation, "ValidationsTab");
  }
}

/** Root-level navigation for push notification taps (admin). */
export function navigateAdminPushNotification(
  data: Record<string, unknown> | undefined,
): boolean {
  if (!data || !navigationRef.current?.isReady()) return false;

  const screen = typeof data.screen === "string" ? data.screen : undefined;
  const complaintId =
    typeof data.complaintId === "string" ? data.complaintId : undefined;
  const requestId =
    typeof data.verificationRequestId === "string"
      ? data.verificationRequestId
      : typeof data.requestId === "string"
        ? data.requestId
        : undefined;
  const userId = typeof data.userId === "string" ? data.userId : undefined;

  if (screen === "AdminComplaintDetail" && complaintId) {
    navigationRef.current.navigate("ComplaintsTab", {
      screen: "AdminComplaintDetail",
      params: { complaintId },
    });
    return true;
  }

  if (screen === "ValidationProviderDetail" && requestId) {
    navigationRef.current.navigate("ValidationsTab", {
      screen: "ValidationProviderDetail",
      params: { requestId },
    });
    return true;
  }

  if (screen === "AdminUserDetail" && userId) {
    navigationRef.current.navigate("UsersTab", {
      screen: "AdminUserDetail",
      params: { userId },
    });
    return true;
  }

  if (complaintId) {
    navigationRef.current.navigate("ComplaintsTab", {
      screen: "AdminComplaintDetail",
      params: { complaintId },
    });
    return true;
  }

  if (requestId) {
    navigationRef.current.navigate("ValidationsTab", {
      screen: "ValidationProviderDetail",
      params: { requestId },
    });
    return true;
  }

  return false;
}
