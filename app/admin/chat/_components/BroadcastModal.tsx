"use client";

import { useState } from "react";
import { HiOutlineMegaphone } from "react-icons/hi2";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ChatFormError } from "./ChatFormError";
import { postChatBroadcast } from "../_lib/chat-api";

interface BroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBroadcastSent: () => void;
}

/** Modal menulis dan mengirim broadcast ke Global Chat. */
export function BroadcastModal({
  isOpen,
  onClose,
  onBroadcastSent,
}: BroadcastModalProps) {
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastContent, setBroadcastContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const closeModal = () => {
    setSendError(null);
    onClose();
  };

  const sendBroadcast = async () => {
    if (!broadcastContent.trim() || isSending) return;

    setIsSending(true);
    setSendError(null);
    const result = await postChatBroadcast({
      title: broadcastTitle.trim() || undefined,
      content: broadcastContent,
    });
    setIsSending(false);

    if (!result.isOk) {
      setSendError(result.message);
      return;
    }
    setBroadcastTitle("");
    setBroadcastContent("");
    onBroadcastSent();
  };

  return (
    <Modal isOpen={isOpen} onClose={closeModal} title="Broadcast" size="md">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Judul (opsional)
          </label>
          <input
            type="text"
            placeholder="Contoh: Pengumuman Penting"
            value={broadcastTitle}
            onChange={(event) => setBroadcastTitle(event.target.value)}
            className="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-700"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Pesan
          </label>
          <textarea
            placeholder="Tulis pesan broadcast..."
            value={broadcastContent}
            onChange={(event) => setBroadcastContent(event.target.value)}
            rows={4}
            className="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-700 resize-none"
          />
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          📢 Pesan akan dikirim ke Global Chat dan notifikasi ke semua user
        </p>
        <ChatFormError message={sendError} />
      </div>
      <ModalFooter>
        <Button
          variant="warning"
          onClick={() => void sendBroadcast()}
          disabled={!broadcastContent.trim() || isSending}
          loading={isSending}
          className="w-full"
        >
          <HiOutlineMegaphone className="w-5 h-5" />
          Kirim Broadcast
        </Button>
      </ModalFooter>
    </Modal>
  );
}
