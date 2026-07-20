import type { ChatActor } from "../domain/entities/ChatEntity";

export interface SendMessageInput {
  conversationId: string;
  sender: ChatActor;
  senderName: string;
  tenantId: string;
  content?: string | null;
  imageUrl?: string | null;
}

export interface CreateChatInput {
  creator: ChatActor;
  participants: ChatActor[];
  tenantId: string;
  name?: string;
}

export interface BroadcastMessageInput {
  sender: ChatActor;
  senderName: string;
  tenantId: string;
  content: string;
  title?: string;
}

export interface ChatMessagesQuery {
  conversationId: string;
  actor: ChatActor;
  tenantId: string;
  cursor?: string;
  limit?: number;
}

export interface ChatMessageSocketPayload {
  id: string;
  content: string | null;
  imageUrl?: string | null;
  conversationId: string;
  senderActorType: string;
  senderActorId: string;
  senderName: string;
  createdAt: string;
  isOwn: boolean;
  isBroadcast?: boolean;
}
