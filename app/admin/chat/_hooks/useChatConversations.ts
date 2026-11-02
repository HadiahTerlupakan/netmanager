"use client";

import { useCallback, useMemo } from "react";
import { clientLogger } from "@/lib/client-logger";
import { useApi, type FetchError } from "@/lib/hooks/useApi";
import { useToast } from "@/hooks/use-toast";
import {
  CHAT_FALLBACK_MESSAGES,
  CHAT_NETWORK_ERROR_MESSAGE,
} from "../_lib/chat-api";
import type {
  ChatConversation,
  ChatRealtimeMessage,
  GlobalChatInfo,
} from "../_lib/chat-types";

const CONVERSATIONS_URL = "/api/admin/chat/conversations";
const GLOBAL_CHAT_URL = "/api/admin/chat/global";
const NETWORK_ERROR_STATUS = 0;
const SERVER_ERROR_MIN_STATUS = 500;

/**
 * Pesan galat untuk pengguna dari galat useApi. Galat 5xx bisa berisi teks
 * teknis (mis. JSON rusak), jadi diganti kalimat cadangan.
 */
function describeLoadError(error: FetchError): string {
  if (error.status === NETWORK_ERROR_STATUS) return CHAT_NETWORK_ERROR_MESSAGE;
  if (error.status >= SERVER_ERROR_MIN_STATUS) {
    return CHAT_FALLBACK_MESSAGES.loadConversations;
  }
  return error.message || CHAT_FALLBACK_MESSAGES.loadConversations;
}

function describeLastMessage(message: ChatRealtimeMessage): string {
  if (message.content) return message.content;
  return message.imageUrl ? "📷 Gambar" : "Pesan baru";
}

/** Menaikkan percakapan yang menerima pesan ke urutan teratas. */
function moveConversationToTop(
  conversations: ChatConversation[],
  index: number,
  message: ChatRealtimeMessage,
  selectedConversationId: string | null,
): ChatConversation[] {
  const current = conversations[index];
  if (!current) return conversations;

  const isOpen = selectedConversationId === message.conversationId;
  const updated: ChatConversation = {
    ...current,
    lastMessage: {
      content: describeLastMessage(message),
      senderName: message.senderName || "User",
      createdAt: message.createdAt,
    },
    updatedAt: message.createdAt,
    hasUnread: !isOpen,
    unreadCount: isOpen ? 0 : (current.unreadCount || 0) + 1,
  };
  const others = conversations.filter((_, position) => position !== index);
  return [updated, ...others];
}

/** Daftar percakapan + Global Chat, termasuk pembaruan daftar dari pesan realtime. */
export function useChatConversations() {
  const { showToast } = useToast();
  const handleLoadError = useCallback(
    (error: FetchError) => {
      clientLogger.error("Error loading chat list:", error);
      showToast("error", describeLoadError(error));
    },
    [showToast],
  );

  const {
    data: conversationsData,
    mutate: mutateConversations,
    isLoading: isLoadingConversations,
  } = useApi<ChatConversation[]>(CONVERSATIONS_URL, {
    onError: handleLoadError,
  });
  // Galat Global Chat cukup dicatat: bila jaringan putus, toast dari daftar
  // percakapan sudah memberi tahu pengguna, jangan tampil dua kali.
  const { data: globalChat, mutate: mutateGlobalChat } = useApi<GlobalChatInfo>(
    GLOBAL_CHAT_URL,
    {
      onError: (error) =>
        clientLogger.error("Error loading global chat:", error),
    },
  );

  const conversations = useMemo(
    () => (conversationsData ?? []).filter((item) => !item.isGlobal),
    [conversationsData],
  );

  const reloadConversations = useCallback(() => {
    void mutateConversations();
    void mutateGlobalChat();
  }, [mutateConversations, mutateGlobalChat]);

  const applyIncomingMessage = useCallback(
    (message: ChatRealtimeMessage, selectedConversationId: string | null) => {
      void mutateConversations(
        (previous) => {
          if (!previous) return previous;
          const index = previous.findIndex(
            (item) => item.id === message.conversationId,
          );
          if (index === -1) {
            // Percakapan baru yang belum ada di daftar: ambil ulang dari server.
            void mutateConversations();
            return previous;
          }
          return moveConversationToTop(
            previous,
            index,
            message,
            selectedConversationId,
          );
        },
        { revalidate: false },
      );
    },
    [mutateConversations],
  );

  return {
    conversations,
    globalChat: globalChat ?? null,
    isLoadingConversations,
    reloadConversations,
    applyIncomingMessage,
  };
}
