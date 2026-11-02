"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { ChatSpinner } from "./ChatSpinner";
import type { ChatMessage } from "../_lib/chat-types";

interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
}

/** Daftar gelembung pesan; otomatis menggulir ke pesan terbaru. */
export function MessageList({ messages, isLoading }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <ChatSpinner className="text-purple-500 w-8 h-8" />
        </div>
      ) : (
        messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const { isOwn } = message;

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[70%] ${isOwn ? "order-2" : "order-1"}`}>
        {!isOwn && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 ml-1">
            {message.senderName}
          </div>
        )}
        <div
          className={`rounded-2xl px-4 py-2 ${
            isOwn
              ? "bg-purple-500 text-white"
              : "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow"
          }`}
        >
          {message.imageUrl && (
            <div className="relative w-full max-w-[300px] aspect-square mb-2">
              <Image
                src={message.imageUrl}
                alt="Chat image"
                fill
                className="rounded-lg object-cover"
              />
            </div>
          )}
          {message.content && (
            <p className="whitespace-pre-wrap">{message.content}</p>
          )}
        </div>
        <div
          className={`text-xs text-gray-400 mt-1 ${isOwn ? "text-right mr-1" : "ml-1"}`}
        >
          {formatDistanceToNow(new Date(message.createdAt), {
            addSuffix: true,
            locale: idLocale,
          })}
        </div>
      </div>
    </div>
  );
}
