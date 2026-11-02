"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  HiOutlineChatBubbleLeftRight,
  HiOutlineGlobeAlt,
  HiOutlineMagnifyingGlass,
  HiOutlineMegaphone,
  HiOutlinePlus,
  HiOutlineUserGroup,
} from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
import { ChatSpinner } from "./ChatSpinner";
import type { ChatConversation, GlobalChatInfo } from "../_lib/chat-types";

interface ConversationSidebarProps {
  conversations: ChatConversation[];
  globalChat: GlobalChatInfo | null;
  selectedConversationId: string | null;
  isLoading: boolean;
  canSendMessage: boolean;
  canBroadcast: boolean;
  onSelectConversation: (conversationId: string) => void;
  onOpenNewChat: () => void;
  onOpenBroadcast: () => void;
}

/** Sidebar kiri: tombol aksi, pencarian, Global Chat, dan daftar percakapan. */
export function ConversationSidebar({
  conversations,
  globalChat,
  selectedConversationId,
  isLoading,
  canSendMessage,
  canBroadcast,
  onSelectConversation,
  onOpenNewChat,
  onOpenBroadcast,
}: ConversationSidebarProps) {
  const [searchInput, setSearchInput] = useState("");
  const normalizedSearch = searchInput.toLowerCase();
  const filteredConversations = conversations.filter((conversation) =>
    conversation.name.toLowerCase().includes(normalizedSearch),
  );

  return (
    <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Chat
          </h2>
          <div className="flex gap-2">
            {canBroadcast && (
              <Button
                variant="warning"
                size="icon"
                onClick={onOpenBroadcast}
                title="Broadcast"
              >
                <HiOutlineMegaphone className="w-5 h-5" />
              </Button>
            )}
            {canSendMessage && (
              <Button size="icon" onClick={onOpenNewChat} title="New Chat">
                <HiOutlinePlus className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>
        <div className="relative">
          <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Cari percakapan..."
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <ChatSpinner className="text-purple-500 w-6 h-6" />
          </div>
        ) : (
          <>
            {globalChat && (
              <GlobalChatItem
                globalChat={globalChat}
                isSelected={selectedConversationId === globalChat.id}
                onSelect={onSelectConversation}
              />
            )}

            {filteredConversations.map((conversation) => (
              <ConversationListItem
                key={conversation.id}
                conversation={conversation}
                isSelected={selectedConversationId === conversation.id}
                onSelect={onSelectConversation}
              />
            ))}

            {filteredConversations.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <HiOutlineChatBubbleLeftRight className="mx-auto mb-2 opacity-50 w-12 h-12" />
                <p>Belum ada percakapan</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function GlobalChatItem({
  globalChat,
  isSelected,
  onSelect,
}: {
  globalChat: GlobalChatInfo;
  isSelected: boolean;
  onSelect: (conversationId: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(globalChat.id)}
      className={`w-full flex items-center gap-3 p-4 border-b-2 border-purple-200 dark:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition ${
        isSelected
          ? "bg-purple-100 dark:bg-purple-900/50"
          : "bg-purple-50 dark:bg-purple-900/20"
      }`}
    >
      <div className="h-12 w-12 rounded-full bg-purple-500 dark:bg-purple-600 flex items-center justify-center">
        <HiOutlineGlobeAlt className="w-6 h-6 text-white" />
      </div>
      <div className="flex-1 text-left">
        <div className="font-bold text-purple-900 dark:text-purple-100">
          Global Chat
        </div>
        <div className="text-sm text-purple-700 dark:text-purple-300 flex items-center gap-1">
          <HiOutlineUserGroup className="w-4 h-4" />
          {globalChat.participantCount} anggota
        </div>
      </div>
    </button>
  );
}

function ConversationListItem({
  conversation,
  isSelected,
  onSelect,
}: {
  conversation: ChatConversation;
  isSelected: boolean;
  onSelect: (conversationId: string) => void;
}) {
  const { lastMessage } = conversation;

  return (
    <button
      onClick={() => onSelect(conversation.id)}
      className={`w-full flex items-center gap-3 p-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition ${
        isSelected ? "bg-gray-100 dark:bg-gray-700" : ""
      }`}
    >
      <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
        <HiOutlineChatBubbleLeftRight className="w-6 h-6 text-purple-600 dark:text-purple-400" />
      </div>
      <div className="flex-1 text-left min-w-0">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-gray-900 dark:text-white truncate">
            {conversation.name}
          </span>
          {lastMessage && (
            <span className="text-xs text-gray-400">
              {formatDistanceToNow(new Date(lastMessage.createdAt), {
                addSuffix: true,
                locale: idLocale,
              })}
            </span>
          )}
        </div>
        {lastMessage && (
          <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
            <span className="font-medium">{lastMessage.senderName}: </span>
            {lastMessage.content}
          </div>
        )}
      </div>
      {conversation.hasUnread && (
        <div className="h-3 w-3 rounded-full bg-purple-500 dark:bg-purple-400" />
      )}
    </button>
  );
}
