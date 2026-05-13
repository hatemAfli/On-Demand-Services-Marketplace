import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api, type ConversationListItem } from "../services/api";
import { UserRole } from "../types";

function sumUnreadForRole(
  list: ConversationListItem[],
  role: UserRole.CLIENT | UserRole.PROVIDER,
): number {
  return list.reduce((acc, row) => {
    const n =
      role === UserRole.CLIENT ? row.unreadClient : row.unreadProvider;
    return acc + (typeof n === "number" ? n : 0);
  }, 0);
}

/** Fetches `/messaging/conversations` and sums unread for the current client/provider role. */
export function useMessagingUnreadTotal(enabled: boolean): {
  total: number;
  refresh: () => Promise<void>;
} {
  const { user } = useAuth();
  const [total, setTotal] = useState(0);

  const refresh = useCallback(async () => {
    if (!user || (user.role !== UserRole.CLIENT && user.role !== UserRole.PROVIDER)) {
      setTotal(0);
      return;
    }
    try {
      const res = await api.getMyConversations();
      const list: ConversationListItem[] = Array.isArray(res.data)
        ? res.data
        : [];
      setTotal(sumUnreadForRole(list, user.role));
    } catch {
      setTotal(0);
    }
  }, [user]);

  useEffect(() => {
    if (enabled) void refresh();
  }, [enabled, refresh]);

  return { total, refresh };
}
