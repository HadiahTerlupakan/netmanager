"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { sanitizeAttachmentUrl } from "@/lib/utils/sanitize-attachment-url";
import type { Reply, TicketDetail } from "./types";

const NEAR_BOTTOM_THRESHOLD_PX = 100;

interface MessagesListProps {
  ticket: TicketDetail;
  replies: Reply[];
}

export function MessagesList({ ticket, replies }: MessagesListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isFirstRenderRef = useRef(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const isNearBottom = distanceFromBottom < NEAR_BOTTOM_THRESHOLD_PX;
    if (isFirstRenderRef.current || isNearBottom) {
      messagesEndRef.current?.scrollIntoView({
        behavior: isFirstRenderRef.current ? "auto" : "smooth",
      });
      isFirstRenderRef.current = false;
    }
  }, [replies]);

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Initial Ticket Message */}
      <div className="flex justify-start">
        <div className="max-w-[80%] bg-white dark:bg-gray-800 rounded-2xl rounded-tl-sm p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
            {ticket.description}
          </p>
          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
            <span>{ticket.pelanggan.nama}</span>
            <span>•</span>
            <span>
              {format(new Date(ticket.createdAt), "dd MMM yyyy HH:mm", {
                locale: id,
              })}
            </span>
          </div>
        </div>
      </div>

      {replies.map((reply) => (
        <ReplyBubble
          key={reply.id}
          reply={reply}
          customerName={ticket.pelanggan.nama}
        />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}

function ReplyBubble({
  reply,
  customerName,
}: {
  reply: Reply;
  customerName: string;
}) {
  return (
    <div
      className={`flex ${reply.isFromAdmin ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[80%] rounded-2xl p-4 shadow-sm ${
          reply.isFromAdmin
            ? "bg-teal-600 text-white rounded-tr-sm"
            : "bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-tl-sm"
        }`}
      >
        <p
          className={`text-sm whitespace-pre-wrap ${reply.isFromAdmin ? "text-white" : "text-gray-900 dark:text-white"}`}
        >
          {reply.message}
        </p>
        <div
          className={`flex items-center gap-2 mt-2 text-xs ${reply.isFromAdmin ? "text-teal-100" : "text-gray-500"}`}
        >
          <span>
            {reply.isFromAdmin ? reply.sender?.name || "Admin" : customerName}
          </span>
          <span>•</span>
          <span>
            {format(new Date(reply.createdAt), "dd MMM HH:mm", {
              locale: id,
            })}
          </span>
        </div>
        {reply.attachments &&
          Array.isArray(reply.attachments) &&
          reply.attachments.length > 0 && (
            <div className="mt-3 space-y-2">
              {reply.attachments.map((url, idx) => {
                const safeUrl = sanitizeAttachmentUrl(url);
                return (
                  <a
                    key={idx}
                    href={safeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-lg overflow-hidden border border-black/10 dark:border-white/10 relative w-full h-60"
                  >
                    <Image
                      src={safeUrl}
                      alt="Lampiran"
                      fill
                      className="object-cover"
                    />
                  </a>
                );
              })}
            </div>
          )}
      </div>
    </div>
  );
}
