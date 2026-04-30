export interface SendMessageInput {
  conversationId: string;
  senderId: string;
  senderName: string;
  tenantId: string;
  content?: string | null;
  imageUrl?: string | null;
}

export interface CreateChatInput {
  creatorId: string;
  participantIds: string[];
  tenantId: string;
  name?: string;
}

export interface BroadcastMessageInput {
  senderId: string;
  senderName: string;
  tenantId: string;
  content: string;
  title?: string;
}

export interface ChatMessagesQuery {
  conversationId: string;
  userId: string;
  tenantId: string;
  cursor?: string;
  limit?: number;
}

export interface ChatMessageSocketPayload {
  id: string;
  content: string | null;
  imageUrl?: string | null;
  conversationId: string;
  senderId: string;
  senderName: string;
  createdAt: string;
  isOwn: boolean;
  isBroadcast?: boolean;
}
