"use client";

import { useCallback, useState } from "react";
import {
  playStaffNotificationSound,
  previewStaffNotificationSound,
} from "@/lib/notification-sound";
import { usePermission } from "@/hooks/use-permission";
import { useRealtimeEvent } from "@/lib/realtime/hooks/useRealtimeEvent";
import { shouldNotifyForChatMessage } from "@/modules/chat/client";
import { BroadcastModal } from "./_components/BroadcastModal";
import { ConversationSidebar } from "./_components/ConversationSidebar";
import { MessagePane } from "./_components/MessagePane";
import { NewChatModal } from "./_components/NewChatModal";
import { useChatConversations } from "./_hooks/useChatConversations";
import { useChatMessages } from "./_hooks/useChatMessages";
import {
  requestNotificationPermissionOnGesture,
  showChatBrowserNotification,
} from "./_lib/browser-notification";
import type { ChatRealtimeMessage } from "./_lib/chat-types";

const TEST_NOTIFICATION_ALERT =
  "Tes notifikasi dikirim. Jika tidak bunyi chat.mp3, akan memakai nada standar";

function notifyIncomingMessage(
  message: ChatRealtimeMessage,
  selectedConversationId: string | null,
): void {
  const isNotifiable = shouldNotifyForChatMessage({
    isOwnMessage: Boolean(message.isOwn),
    selectedConversationId,
    incomingConversationId: message.conversationId,
  });
  if (!isNotifiable) return;
  playStaffNotificationSound();
  showChatBrowserNotification(
    message.senderName || "User",
    message.content || "Gambar",
  );
}

function sendTestNotification(): void {
  requestNotificationPermissionOnGesture();
  previewStaffNotificationSound();
  showChatBrowserNotification(
    "Test System",
    "Ini adalah tes notifikasi suara dan visual.",
  );
  alert(TEST_NOTIFICATION_ALERT);
}

/** Halaman chat admin: merangkai sidebar, panel pesan, modal, dan event realtime. */
export default function ChatPageClient() {
  const { hasPermission } = usePermission();
  const canSendMessage = hasPermission("chat:create");
  const canBroadcast = hasPermission("broadcast:create");

  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);

  const {
    conversations,
    globalChat,
    isLoadingConversations,
    reloadConversations,
    applyIncomingMessage,
  } = useChatConversations();
  const {
    messages,
    conversationInfo,
    isLoadingMessages,
    isSendingMessage,
    reloadMessages,
    appendIncomingMessage,
    sendMessage,
  } = useChatMessages(selectedConversationId);

  const handleIncomingMessage = useCallback(
    (message: ChatRealtimeMessage) => {
      notifyIncomingMessage(message, selectedConversationId);
      appendIncomingMessage(message);
      applyIncomingMessage(message, selectedConversationId);
    },
    [selectedConversationId, appendIncomingMessage, applyIncomingMessage],
  );
  useRealtimeEvent<ChatRealtimeMessage>("chat.message", handleIncomingMessage);

  const selectConversation = (conversationId: string) => {
    requestNotificationPermissionOnGesture();
    setSelectedConversationId(conversationId);
  };

  const handleSendMessage = async (content: string) => {
    if (!canSendMessage) return false;
    requestNotificationPermissionOnGesture();
    const isSent = await sendMessage(content);
    if (isSent) reloadConversations();
    return isSent;
  };

  const handleConversationCreated = (conversationId: string) => {
    setIsNewChatOpen(false);
    setSelectedConversationId(conversationId);
    reloadConversations();
    reloadMessages();
  };

  const handleBroadcastSent = () => {
    setIsBroadcastOpen(false);
    reloadConversations();
    if (!globalChat) return;
    // Buka Global Chat agar broadcast yang baru dikirim langsung terlihat.
    setSelectedConversationId(globalChat.id);
    reloadMessages();
  };

  return (
    <div className="h-[calc(100vh-120px)] flex bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden shadow-lg">
      <ConversationSidebar
        conversations={conversations}
        globalChat={globalChat}
        selectedConversationId={selectedConversationId}
        isLoading={isLoadingConversations}
        canSendMessage={canSendMessage}
        canBroadcast={canBroadcast}
        onSelectConversation={selectConversation}
        onOpenNewChat={() => setIsNewChatOpen(true)}
        onOpenBroadcast={() => setIsBroadcastOpen(true)}
      />

      <MessagePane
        hasSelectedConversation={selectedConversationId !== null}
        conversationInfo={conversationInfo}
        messages={messages}
        isLoadingMessages={isLoadingMessages}
        isSendingMessage={isSendingMessage}
        canSendMessage={canSendMessage}
        canBroadcast={canBroadcast}
        onSendMessage={handleSendMessage}
        onOpenBroadcast={() => setIsBroadcastOpen(true)}
        onTestNotification={sendTestNotification}
      />

      <NewChatModal
        isOpen={isNewChatOpen && canSendMessage}
        onClose={() => setIsNewChatOpen(false)}
        onConversationCreated={handleConversationCreated}
      />

      <BroadcastModal
        isOpen={isBroadcastOpen && canBroadcast}
        onClose={() => setIsBroadcastOpen(false)}
        onBroadcastSent={handleBroadcastSent}
      />
    </div>
  );
}
