import { useEffect, useRef } from "react";
import { supabase } from "../services/supabase";
import type { MessageStatus } from "../services/api";

export type IncomingMessage = {
  id: string;
  conversationId: string;
  senderUserId: string;
  senderRole: "CLIENT" | "PROVIDER";
  text: string | null;
  mediaUrls: string[];
  createdAt: string;
  status?: MessageStatus;
  editedAt?: string | null;
  deletedAt?: string | null;
};

export type MessagesStatusPayload = {
  messageIds: string[];
  status: MessageStatus;
};

export type MessageWithdrawnPayload = {
  id: string;
  conversationId: string;
  deletedAt: string | null;
};

export type ConversationRealtimeHandlers = {
  onNewMessage: (msg: IncomingMessage) => void;
  onMessagesStatus?: (payload: MessagesStatusPayload) => void;
  onMessageUpdated?: (msg: IncomingMessage) => void;
  onMessageWithdrawn?: (payload: MessageWithdrawnPayload) => void;
};

export function useConversationRealtime(
  conversationId: string | null,
  handlers: ConversationRealtimeHandlers,
) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on("broadcast", { event: "new_message" }, ({ payload }) => {
        handlersRef.current.onNewMessage(payload as IncomingMessage);
      })
      .on("broadcast", { event: "messages_status" }, ({ payload }) => {
        handlersRef.current.onMessagesStatus?.(
          payload as MessagesStatusPayload,
        );
      })
      .on("broadcast", { event: "message_updated" }, ({ payload }) => {
        handlersRef.current.onMessageUpdated?.(payload as IncomingMessage);
      })
      .on("broadcast", { event: "message_withdrawn" }, ({ payload }) => {
        handlersRef.current.onMessageWithdrawn?.(
          payload as MessageWithdrawnPayload,
        );
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId]);
}
