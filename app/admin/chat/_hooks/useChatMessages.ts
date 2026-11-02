"use client";

import { useCallback, useEffect, useState } from "react";
import { clientLogger } from "@/lib/client-logger";
import { useToast } from "@/hooks/use-toast";
import { fetchConversationDetail, postChatMessage } from "../_lib/chat-api";
import type {
  ChatConversationInfo,
  ChatMessage,
  ChatRealtimeMessage,
} from "../_lib/chat-types";

interface LoadedConversation {
  conversationId: string;
  info: ChatConversationInfo | null;
  /** Urutan tampilan: terlama di atas. */
  messages: ChatMessage[];
}

function appendUniqueMessage(
  messages: ChatMessage[],
  message: ChatMessage,
): ChatMessage[] {
  if (messages.some((item) => item.id === message.id)) return messages;
  return [...messages, message];
}

/** Memuat dan mengirim pesan untuk percakapan yang sedang dipilih. */
export function useChatMessages(selectedConversationId: string | null) {
  const { showToast } = useToast();
  const [loaded, setLoaded] = useState<LoadedConversation | null>(null);
  const [reloadCount, setReloadCount] = useState(0);
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  useEffect(() => {
    if (!selectedConversationId) return undefined;
    let isStale = false;

    void fetchConversationDetail(selectedConversationId).then((result) => {
      if (isStale) return;
      if (!result.isOk) {
        clientLogger.error("Error loading messages:", result.message);
        showToast("error", result.message);
        setLoaded({
          conversationId: selectedConversationId,
          info: null,
          messages: [],
        });
        return;
      }
      setLoaded({
        conversationId: selectedConversationId,
        info: result.data.conversation,
        // Server mengirim terbaru lebih dulu; tampilan butuh terlama di atas.
        messages: [...result.data.messages].reverse(),
      });
    });

    return () => {
      isStale = true;
    };
  }, [selectedConversationId, reloadCount, showToast]);

  const isCurrentLoaded =
    loaded !== null && loaded.conversationId === selectedConversationId;
  const isLoadingMessages = selectedConversationId !== null && !isCurrentLoaded;

  const reloadMessages = useCallback(() => {
    setReloadCount((count) => count + 1);
  }, []);

  const appendIncomingMessage = useCallback((message: ChatRealtimeMessage) => {
    setLoaded((current) => {
      if (!current || current.conversationId !== message.conversationId) {
        return current;
      }
      return {
        ...current,
        messages: appendUniqueMessage(current.messages, message),
      };
    });
  }, []);

  /** Mengirim pesan; mengembalikan true bila terkirim agar input bisa dikosongkan. */
  const sendMessage = useCallback(
    async (content: string): Promise<boolean> => {
      if (!selectedConversationId || !content.trim()) return false;

      setIsSendingMessage(true);
      const result = await postChatMessage(selectedConversationId, content);
      setIsSendingMessage(false);

      if (!result.isOk) {
        clientLogger.error("Error sending message:", result.message);
        showToast("error", result.message);
        return false;
      }
      setLoaded((current) => {
        if (!current || current.conversationId !== selectedConversationId) {
          return current;
        }
        return {
          ...current,
          messages: appendUniqueMessage(current.messages, result.data),
        };
      });
      return true;
    },
    [selectedConversationId, showToast],
  );

  return {
    messages: isCurrentLoaded ? loaded.messages : [],
    conversationInfo: isCurrentLoaded ? loaded.info : null,
    isLoadingMessages,
    isSendingMessage,
    reloadMessages,
    appendIncomingMessage,
    sendMessage,
  };
}
