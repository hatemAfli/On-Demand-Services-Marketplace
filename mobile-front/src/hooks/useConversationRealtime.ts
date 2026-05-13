import { useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";

export type IncomingMessage = {
  id: string;
  conversationId: string;
  senderUserId: string;
  senderRole: "CLIENT" | "PROVIDER";
  text: string | null;
  mediaUrls: string[];
  createdAt: string;
  status?: "SENT" | "DELIVERED" | "READ";
};

export function useConversationRealtime(
  conversationId: string | null,
  onNewMessage: (msg: IncomingMessage) => void,
) {
  const callbackRef = useRef(onNewMessage);
  callbackRef.current = onNewMessage;

  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on("broadcast", { event: "new_message" }, ({ payload }) => {
        callbackRef.current(payload as IncomingMessage);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId]);
}
