"use client";

import { useState } from "react";
import { HiOutlinePaperAirplane } from "react-icons/hi2";
import { Button } from "@/components/ui/Button";

interface MessageComposerProps {
  isSending: boolean;
  /** Mengembalikan true bila pesan terkirim; input dikosongkan hanya saat itu. */
  onSend: (content: string) => Promise<boolean>;
}

/** Kotak ketik pesan + tombol kirim. Teks tetap ada bila pengiriman gagal. */
export function MessageComposer({ isSending, onSend }: MessageComposerProps) {
  const [messageInput, setMessageInput] = useState("");
  const canSubmit = messageInput.trim().length > 0 && !isSending;

  const submitMessage = async () => {
    if (!canSubmit) return;
    const isSent = await onSend(messageInput);
    if (isSent) setMessageInput("");
  };

  return (
    <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Ketik pesan..."
          value={messageInput}
          onChange={(event) => setMessageInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) void submitMessage();
          }}
          className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <Button
          size="icon"
          onClick={() => void submitMessage()}
          disabled={!canSubmit}
          loading={isSending}
        >
          <HiOutlinePaperAirplane className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}
