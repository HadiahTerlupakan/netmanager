"use client";

import Image from "next/image";
import {
  HiOutlineChatBubbleLeftRight,
  HiOutlineGlobeAlt,
  HiOutlineUserGroup,
} from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
import type { ChatConversationInfo } from "../_lib/chat-types";

interface ConversationHeaderProps {
  conversationInfo: ChatConversationInfo | null;
  canBroadcast: boolean;
  onOpenBroadcast: () => void;
  onTestNotification: () => void;
}

/** Kepala panel pesan: nama, jumlah peserta, tes notifikasi, dan tombol broadcast. */
export function ConversationHeader({
  conversationInfo,
  canBroadcast,
  onOpenBroadcast,
  onTestNotification,
}: ConversationHeaderProps) {
  return (
    <>
      <div className="px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div
            className={`h-10 w-10 rounded-full flex items-center justify-center ${
              conversationInfo?.isGlobal
                ? "bg-purple-500 dark:bg-purple-600"
                : "bg-purple-100 dark:bg-purple-900"
            }`}
          >
            {conversationInfo?.isGlobal ? (
              <HiOutlineGlobeAlt className="w-5 h-5 text-white" />
            ) : (
              <HiOutlineChatBubbleLeftRight className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {conversationInfo?.name || "Chat"}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {conversationInfo?.participants?.length || 0} peserta
            </p>
          </div>
        </div>
      </div>

      {conversationInfo && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-white dark:bg-gray-800">
          <div className="flex items-center space-x-3">
            <div className="relative w-10 h-10">
              {conversationInfo.image ? (
                <Image
                  src={conversationInfo.image}
                  alt={conversationInfo.name || "Conversation"}
                  fill
                  className="rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                  <HiOutlineUserGroup className="w-6 h-6 text-gray-500" />
                </div>
              )}
              {conversationInfo.isGlobal && (
                <div className="absolute -bottom-1 -right-1 bg-blue-500 dark:bg-blue-400 rounded-full p-0.5">
                  <HiOutlineGlobeAlt className="w-3 h-3 text-white" />
                </div>
              )}
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">
                {conversationInfo.name}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {conversationInfo.isGlobal
                  ? "Broadcast Channel"
                  : "Conversation"}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onTestNotification}
              title="Test Notification"
            >
              <span className="text-xl">🔔</span>
            </Button>

            {canBroadcast && (
              <Button onClick={onOpenBroadcast} size="sm">
                Broadcast
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
