import { useEffect } from "react";
import Constants from "expo-constants";
import { Platform } from "react-native";
import type React from "react";
import { api } from "./api";

/**
 * Remote push is disabled in Expo Go on Android (SDK 53+).
 * Use a development build (`npx expo run:android` or EAS) to test push.
 */
export function isRemotePushUnsupportedInCurrentRuntime(): boolean {
  return Platform.OS === "android" && Constants.appOwnership === "expo";
}

type ExpoNotifications = typeof import("expo-notifications");

let notificationsModulePromise: Promise<ExpoNotifications> | null = null;
let notificationHandlerConfigured = false;

async function loadNotifications(): Promise<ExpoNotifications | null> {
  if (isRemotePushUnsupportedInCurrentRuntime()) {
    return null;
  }
  if (!notificationsModulePromise) {
    notificationsModulePromise = import("expo-notifications");
  }
  return notificationsModulePromise;
}

async function ensureNotificationHandler(): Promise<void> {
  const Notifications = await loadNotifications();
  if (!Notifications || notificationHandlerConfigured) return;
  notificationHandlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (isRemotePushUnsupportedInCurrentRuntime()) {
    console.warn(
      "[push] Remote notifications are not available in Expo Go on Android. Use a development build to test push.",
    );
    return null;
  }

  const Notifications = await loadNotifications();
  if (!Notifications) return null;

  await ensureNotificationHandler();

  const Device = await import("expo-device");
  if (!Device.isDevice) {
    return null;
  }

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== "granted") {
    return null;
  }

  const token = (await Notifications.getExpoPushTokenAsync()).data;
  const platform = Platform.OS === "ios" ? "ios" : "android";

  try {
    await api.registerPushToken({ token, platform });
  } catch (error) {
    console.error("Failed to register push token with backend:", error);
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  return token;
}

export function useNotificationNavigation(
  navigationRef: React.RefObject<any>,
): void {
  useEffect(() => {
    if (isRemotePushUnsupportedInCurrentRuntime()) {
      return;
    }

    let cancelled = false;
    let subscription: { remove: () => void } | undefined;

    void (async () => {
      const Notifications = await loadNotifications();
      if (!Notifications || cancelled) return;
      await ensureNotificationHandler();
      subscription = Notifications.addNotificationResponseReceivedListener(
        (response) => {
          const data = response.notification.request.content.data as
            | Record<string, unknown>
            | undefined;
          const screen =
            typeof data?.screen === "string" ? data.screen : undefined;
          const appointmentId =
            typeof data?.appointmentId === "string"
              ? data.appointmentId
              : undefined;

          if (!screen || !navigationRef.current?.isReady?.()) {
            return;
          }

          if (screen === "ClientAppointmentDetail" && appointmentId) {
            navigationRef.current.navigate("ClientAppointmentDetail", {
              appointmentId,
            });
          } else if (screen === "ProviderAppointmentDetail" && appointmentId) {
            navigationRef.current.navigate("ProviderAppointmentDetail", {
              appointmentId,
            });
          } else if (screen === "ProviderServices") {
            navigationRef.current.navigate("ProviderServices");
          } else if (screen === "ClientAppointments") {
            navigationRef.current.navigate("ClientAppointments");
          } else if (screen === "ProviderRequestService") {
            navigationRef.current.navigate("ProviderRequestService");
          }
        },
      );
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [navigationRef]);
}

export function useNotificationBadge(): void {
  useEffect(() => {
    if (isRemotePushUnsupportedInCurrentRuntime()) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const Notifications = await loadNotifications();
      if (!Notifications || cancelled) return;
      await Notifications.setBadgeCountAsync(0);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
}
