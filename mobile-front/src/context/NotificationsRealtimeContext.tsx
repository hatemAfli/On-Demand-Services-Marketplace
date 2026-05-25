import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "../lib/supabase";
import { api, type AppNotification } from "../services/api";
import { useAuth } from "./AuthContext";

type NewNotificationListener = (notification: AppNotification) => void;

interface NotificationsRealtimeContextType {
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
  adjustUnreadCount: (delta: number) => void;
  addNewNotificationListener: (listener: NewNotificationListener) => () => void;
}

const NotificationsRealtimeContext = createContext<
  NotificationsRealtimeContextType | undefined
>(undefined);

export const NotificationsRealtimeProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const listenersRef = useRef(new Set<NewNotificationListener>());

  const refreshUnreadCount = useCallback(async () => {
    if (!user?.id) {
      setUnreadCount(0);
      return;
    }
    try {
      const res = await api.getUnreadCount();
      setUnreadCount(res.data?.count ?? 0);
    } catch {
      setUnreadCount(0);
    }
  }, [user?.id]);

  const adjustUnreadCount = useCallback((delta: number) => {
    setUnreadCount((prev) => Math.max(0, prev + delta));
  }, []);

  const addNewNotificationListener = useCallback(
    (listener: NewNotificationListener) => {
      listenersRef.current.add(listener);
      return () => {
        listenersRef.current.delete(listener);
      };
    },
    [],
  );

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setUnreadCount(0);
      return;
    }
    void refreshUnreadCount();
  }, [isAuthenticated, user?.id, refreshUnreadCount]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on("broadcast", { event: "new_notification" }, ({ payload }) => {
        const notification = payload as AppNotification;
        setUnreadCount((prev) => prev + 1);
        listenersRef.current.forEach((listener) => listener(notification));
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isAuthenticated, user?.id]);

  const value = useMemo(
    () => ({
      unreadCount,
      refreshUnreadCount,
      adjustUnreadCount,
      addNewNotificationListener,
    }),
    [
      unreadCount,
      refreshUnreadCount,
      adjustUnreadCount,
      addNewNotificationListener,
    ],
  );

  return (
    <NotificationsRealtimeContext.Provider value={value}>
      {children}
    </NotificationsRealtimeContext.Provider>
  );
};

export function useNotificationsRealtime(): NotificationsRealtimeContextType {
  const ctx = useContext(NotificationsRealtimeContext);
  if (!ctx) {
    throw new Error(
      "useNotificationsRealtime must be used within NotificationsRealtimeProvider",
    );
  }
  return ctx;
}
