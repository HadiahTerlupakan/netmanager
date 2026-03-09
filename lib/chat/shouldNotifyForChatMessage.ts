export function shouldNotifyForChatMessage(
  isOwnMessage: boolean,
  selectedConversationId: string | null,
  incomingConversationId: string,
): boolean {
  if (isOwnMessage) {
    return false
  }

  return selectedConversationId !== incomingConversationId
}
