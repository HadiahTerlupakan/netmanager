export interface CreateMessageInput {
  conversationId: string;
  senderId: string;
  content?: string | null;
  imageUrl?: string | null;
}

export interface CreateConversationInput {
  participantIds: string[];
  name?: string;
  isGlobal?: boolean;
}
