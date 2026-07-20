export type ChatActorType = "user" | "mitra" | "customer";

export interface ChatActor {
  type: ChatActorType;
  id: string;
}

export interface ChatUserSummaryEntity {
  id: string;
  name: string | null;
  email?: string | null;
  image?: string | null;
  departments?: { name: string | null } | null;
  sites?: { name: string | null } | null;
}

export interface ChatParticipantEntity {
  id?: string;
  userId: string | null;
  actorType: string;
  actorId: string | null;
  lastReadAt?: Date | null;
  user?: ChatUserSummaryEntity | null;
}

export interface ChatMessageEntity {
  id: string;
  conversationId: string;
  senderId: string | null;
  actorType: string;
  actorId: string | null;
  content: string | null;
  imageUrl: string | null;
  createdAt: Date;
  sender: ChatUserSummaryEntity | null;
}

export interface ChatConversationEntity {
  id: string;
  name: string | null;
  isGlobal: boolean;
  tenantId?: string | null;
  updatedAt: Date;
  participants?: ChatParticipantEntity[];
  messages?: ChatMessageEntity[];
}

export interface CreateMessageInput {
  conversationId: string;
  sender: ChatActor;
  content?: string | null;
  imageUrl?: string | null;
}

export interface CreateConversationInput {
  participants: ChatActor[];
  name?: string;
  isGlobal?: boolean;
}
