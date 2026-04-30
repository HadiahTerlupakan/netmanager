interface ChatNotificationContext {
  isOwnMessage: boolean;
  selectedConversationId: string | null;
  incomingConversationId: string;
}

/** Menentukan apakah pesan chat perlu memicu notifikasi UI. */
export function shouldNotifyForChatMessage(
  isOwnMessage: boolean,
  selectedConversationId: string | null,
  incomingConversationId: string,
): boolean;

/** Menentukan apakah pesan chat perlu memicu notifikasi UI. */
export function shouldNotifyForChatMessage(
  context: ChatNotificationContext,
): boolean;

/** Menentukan apakah pesan chat perlu memicu notifikasi UI. */
export function shouldNotifyForChatMessage(
  inputOrIsOwnMessage: boolean | ChatNotificationContext,
  selectedConversationId?: string | null,
  incomingConversationId?: string,
): boolean {
  const context = normalizeChatNotificationContext(
    inputOrIsOwnMessage,
    selectedConversationId,
    incomingConversationId,
  );

  if (context.isOwnMessage) {
    return false;
  }

  return context.selectedConversationId !== context.incomingConversationId;
}

function normalizeChatNotificationContext(
  inputOrIsOwnMessage: boolean | ChatNotificationContext,
  selectedConversationId?: string | null,
  incomingConversationId?: string,
): ChatNotificationContext {
  if (typeof inputOrIsOwnMessage !== "boolean") {
    return inputOrIsOwnMessage;
  }

  return {
    isOwnMessage: inputOrIsOwnMessage,
    selectedConversationId: selectedConversationId ?? null,
    incomingConversationId: incomingConversationId ?? "",
  };
}
