"use client";

import { HiOutlineChatBubbleLeftRight } from "react-icons/hi2";
import { ConversationHeader } from "./ConversationHeader";
import { MessageComposer } from "./MessageComposer";
import { MessageList } from "./MessageList";
import type { ChatConversationInfo, ChatMessage } from "../_lib/chat-types";

interface MessagePaneProps {
  hasSelectedConversation: boolean;
  conversationInfo: ChatConversationInfo | null;
  messages: ChatMessage[];
  isLoadingMessages: boolean;
  isSendingMessage: boolean;
  canSendMessage: boolean;
  canBroadcast: boolean;
  onSendMessage: (content: string) => Promise<boolean>;
  onOpenBroadcast: () => void;
  onTestNotification: () => void;
}

/** Panel kanan: isi percakapan terpilih, atau ajakan memilih percakapan. */
export function MessagePane({
  hasSelectedConversation,
  conversationInfo,
  messages,
  isLoadingMessages,
  isSendingMessage,
  canSendMessage,
  canBroadcast,
  onSendMessage,
  onOpenBroadcast,
  onTestNotification,
}: MessagePaneProps) {
  return (
    <div className="flex-1 flex flex-col bg-gray-100 dark:bg-gray-900">
      {hasSelectedConversation ? (
        <>
          <ConversationHeader
            conversationInfo={conversationInfo}
            canBroadcast={canBroadcast}
            onOpenBroadcast={onOpenBroadcast}
            onTestNotification={onTestNotification}
          />
          <MessageList messages={messages} isLoading={isLoadingMessages} />
          {canSendMessage && (
            <MessageComposer
              isSending={isSendingMessage}
              onSend={onSendMessage}
            />
          )}
        </>
      ) : (
        <NoConversationSelected canSendMessage={canSendMessage} />
      )}
    </div>
  );
}

function NoConversationSelected({
  canSendMessage,
}: {
  canSendMessage: boolean;
}) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center text-gray-500">
        <HiOutlineChatBubbleLeftRight className="mx-auto mb-4 opacity-50 w-16 h-16" />
        <p className="text-lg">Pilih percakapan untuk mulai chat</p>
        {canSendMessage && (
          <p className="text-sm mt-2">
            Atau buat chat baru dengan tombol + di sidebar
          </p>
        )}
      </div>
    </div>
  );
}
