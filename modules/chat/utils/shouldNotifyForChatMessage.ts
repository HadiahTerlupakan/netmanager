interface ChatNotificationContext {
  isOwnMessage: boolean;
  selectedConversationId: string | null;
  incomingConversationId: string;
}

/** Menentukan apakah pesan chat perlu memicu notifikasi UI. */
export function shouldNotifyForChatMessage({
  isOwnMessage,
  selectedConversationId,
  incomingConversationId,
}: ChatNotificationContext): boolean {
  if (isOwnMessage) {
    return false;
  }

  return selectedConversationId !== incomingConversationId;
}
