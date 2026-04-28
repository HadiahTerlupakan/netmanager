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
  userId: string;
  lastReadAt?: Date | null;
  user?: ChatUserSummaryEntity;
}

export interface ChatMessageEntity {
  id: string;
  conversationId: string;
  senderId: string;
  content: string | null;
  imageUrl: string | null;
  createdAt: Date;
  sender: ChatUserSummaryEntity;
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
  senderId: string;
  content?: string | null;
  imageUrl?: string | null;
}

export interface CreateConversationInput {
  participantIds: string[];
  name?: string;
  isGlobal?: boolean;
}
