"use client";

import { useState } from "react";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ChatFormError } from "./ChatFormError";
import { ChatSpinner } from "./ChatSpinner";
import { useChatUserSearch } from "../_hooks/useChatUserSearch";
import { createChatConversation } from "../_lib/chat-api";
import type { ChatUser } from "../_lib/chat-types";

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConversationCreated: (conversationId: string) => void;
}

/** Modal memilih pegawai lalu membuat percakapan baru. */
export function NewChatModal({
  isOpen,
  onClose,
  onConversationCreated,
}: NewChatModalProps) {
  const { searchTerm, setSearchTerm, users, isSearching, searchError } =
    useChatUserSearch(isOpen);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const toggleUser = (userId: string) => {
    setSelectedUserIds((previous) =>
      previous.includes(userId)
        ? previous.filter((id) => id !== userId)
        : [...previous, userId],
    );
  };

  const closeModal = () => {
    setCreateError(null);
    onClose();
  };

  const startConversation = async () => {
    if (selectedUserIds.length === 0 || isCreating) return;

    setIsCreating(true);
    setCreateError(null);
    const result = await createChatConversation(selectedUserIds);
    setIsCreating(false);

    if (!result.isOk) {
      setCreateError(result.message);
      return;
    }
    setSelectedUserIds([]);
    onConversationCreated(result.data.id);
  };

  return (
    <Modal isOpen={isOpen} onClose={closeModal} title="Chat Baru" size="md">
      <div className="space-y-4">
        <input
          type="text"
          placeholder="Cari nama atau email..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700"
        />
        <ChatFormError message={searchError} />
        <div className="mt-4 max-h-60 overflow-y-auto space-y-2">
          {isSearching ? (
            <div className="text-center py-4">
              <ChatSpinner className="mx-auto text-purple-500 w-6 h-6" />
            </div>
          ) : users.length > 0 ? (
            users.map((user) => (
              <UserOption
                key={user.id}
                user={user}
                isSelected={selectedUserIds.includes(user.id)}
                onToggle={toggleUser}
              />
            ))
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p>Tidak ada user ditemukan</p>
            </div>
          )}
        </div>
        <ChatFormError message={createError} />
      </div>
      <ModalFooter>
        <Button
          onClick={() => void startConversation()}
          disabled={selectedUserIds.length === 0 || isCreating}
          loading={isCreating}
          className="w-full"
        >
          Mulai Chat ({selectedUserIds.length} dipilih)
        </Button>
      </ModalFooter>
    </Modal>
  );
}

function UserOption({
  user,
  isSelected,
  onToggle,
}: {
  user: ChatUser;
  isSelected: boolean;
  onToggle: (userId: string) => void;
}) {
  return (
    <button
      onClick={() => onToggle(user.id)}
      className={`w-full flex items-center gap-3 p-3 rounded-lg transition ${
        isSelected
          ? "bg-purple-100 dark:bg-purple-900/50 border-2 border-purple-500"
          : "bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border-2 border-transparent"
      }`}
    >
      <div className="h-10 w-10 rounded-full bg-purple-200 dark:bg-purple-800 flex items-center justify-center text-purple-600 dark:text-purple-300 font-semibold">
        {user.name?.charAt(0) || "?"}
      </div>
      <div className="flex-1 text-left">
        <div className="font-medium text-gray-900 dark:text-white">
          {user.name}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {user.department || user.email}
        </div>
      </div>
    </button>
  );
}
