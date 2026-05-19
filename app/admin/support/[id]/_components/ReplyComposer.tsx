"use client";

import { useState } from "react";
import Image from "next/image";
import { HiPaperAirplane, HiPaperClip, HiXMark } from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
import { useFileUpload } from "./useFileUpload";

interface ReplyComposerProps {
  sending: boolean;
  onSend: (input: {
    message: string;
    attachments: string[];
  }) => Promise<boolean>;
}

export function ReplyComposer({ sending, onSend }: ReplyComposerProps) {
  const [message, setMessage] = useState("");
  const {
    fileInputRef,
    uploading,
    attachments,
    onPickFile,
    onFileSelect,
    removeAttachment,
    setAttachments,
  } = useFileUpload();
  const isBusy = sending || uploading;
  const isDisabled = (!message.trim() && attachments.length === 0) || isBusy;

  const handleSend = async () => {
    if (isDisabled) return;
    const messageToSend = message.trim();
    const attachmentsToSend = [...attachments];

    setMessage("");
    setAttachments([]);

    const ok = await onSend({
      message: messageToSend,
      attachments: attachmentsToSend,
    });

    if (!ok) {
      // Restore inputs jika gagal kirim agar user tidak hilang teks
      setMessage(messageToSend);
      setAttachments(attachmentsToSend);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
      {attachments.length > 0 && (
        <div className="px-4 pt-4 flex gap-3 overflow-x-auto pb-2">
          {attachments.map((url, idx) => (
            <div key={idx} className="relative w-20 h-20 shrink-0 group">
              <Image
                src={url}
                alt="Preview"
                fill
                className="object-cover rounded-lg border border-gray-200 dark:border-gray-700"
              />
              <Button
                onClick={() => removeAttachment(idx)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
              >
                <HiXMark className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="p-4 flex gap-3 items-end">
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          onChange={onFileSelect}
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={onPickFile}
          disabled={isBusy}
          title="Lampirkan Gambar"
        >
          <HiPaperClip className="w-5 h-5" />
        </Button>
        <div className="flex-1 relative">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ketik balasan..."
            rows={1}
            className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 resize-y min-h-[46px] max-h-32"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
          />
        </div>
        <Button
          size="lg"
          onClick={handleSend}
          disabled={isDisabled}
          className="h-[46px]"
        >
          {isBusy ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <HiPaperAirplane className="w-5 h-5" />
              <span>Kirim</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
