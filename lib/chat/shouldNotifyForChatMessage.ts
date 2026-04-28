import { shouldNotifyForChatMessage as shouldNotifyForChatMessageFromModule } from "@/modules/chat/utils/shouldNotifyForChatMessage";

/** Menentukan apakah pesan chat perlu memicu notifikasi UI. */
export function shouldNotifyForChatMessage(
  isOwnMessage: boolean,
  selectedConversationId: string | null,
  incomingConversationId: string,
): boolean {
  return shouldNotifyForChatMessageFromModule({
    isOwnMessage,
    selectedConversationId,
    incomingConversationId,
  });
}
