"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRealtime } from "@/lib/realtime/RealtimeContext";
import { useRealtimeEvent } from "@/lib/realtime/hooks/useRealtimeEvent";
import { useRealtimeScope } from "@/lib/realtime/hooks/useRealtimeScope";
import { type TicketMessagePayload } from "../types";

export interface ChatReply {
  id: string;
  message: string;
  isFromAdmin: boolean;
  createdAt: string;
  sender?: {
    id: string;
    name: string;
    image?: string;
  } | null;
  attachments?: string[] | null;
}

interface UseRealtimeTicketChatOptions {
  ticketId: string;
  initialReplies?: ChatReply[];
}

interface UseRealtimeTicketChatResult {
  replies: ChatReply[];
  isConnected: boolean;
  addReply: (reply: ChatReply) => void;
  setReplies: (replies: ChatReply[]) => void;
}

/**
 * Hook for real-time ticket chat with WebSocket
 * Listens for new messages and updates the chat instantly
 */
export function useRealtimeTicketChat(
  options: UseRealtimeTicketChatOptions,
): UseRealtimeTicketChatResult {
  const { ticketId, initialReplies = [] } = options;
  const { isConnected } = useRealtime();

  const [replies, setReplies] = useState<ChatReply[]>(initialReplies);

  const prevInitialRepliesRef = useRef(initialReplies);

  // Update replies when initial data changes
  useEffect(() => {
    if (
      initialReplies !== prevInitialRepliesRef.current &&
      initialReplies.length > 0
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReplies(initialReplies);
      prevInitialRepliesRef.current = initialReplies;
    }
  }, [initialReplies]);

  useRealtimeScope(ticketId ? { kind: "ticket", id: ticketId } : null);

  // Handle new message from WebSocket
  const handleNewMessage = useCallback(
    (payload: TicketMessagePayload) => {
      // Only process if it's for this ticket
      if (payload.ticketId !== ticketId) return;

      console.log(
        "[TicketChat] New message received:",
        payload.reply.message.substring(0, 50),
      );

      // Add new reply to the list (avoid duplicates)
      setReplies((prev) => {
        const exists = prev.some((r) => r.id === payload.reply.id);
        if (exists) return prev;
        return [...prev, payload.reply];
      });
    },
    [ticketId],
  );

  useRealtimeEvent<TicketMessagePayload>("ticket.message", handleNewMessage);

  // Manually add a reply (for optimistic updates after sending)
  const addReply = useCallback((reply: ChatReply) => {
    setReplies((prev) => {
      const exists = prev.some((r) => r.id === reply.id);
      if (exists) return prev;
      return [...prev, reply];
    });
  }, []);

  return {
    replies,
    isConnected,
    addReply,
    setReplies,
  };
}
