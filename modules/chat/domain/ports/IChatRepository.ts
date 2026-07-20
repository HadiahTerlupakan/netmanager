import type {
  ChatActor,
  ChatConversationEntity,
  ChatMessageEntity,
  ChatParticipantEntity,
  ChatUserSummaryEntity,
  CreateConversationInput,
  CreateMessageInput,
} from "../entities/ChatEntity";

type ChatRepositoryResult = ChatConversationEntity & Record<string, unknown>;
type ChatMessageResult = ChatMessageEntity & Record<string, unknown>;
type ChatParticipantResult = ChatParticipantEntity & Record<string, unknown>;
type ChatUserResult = ChatUserSummaryEntity & Record<string, unknown>;

export interface IChatRepository {
  findConversationsForUser(
    actor: ChatActor,
    tenantId: string,
  ): Promise<ChatRepositoryResult[]>;
  findConversationById(
    conversationId: string,
    tenantId: string,
  ): Promise<ChatRepositoryResult | null>;
  findMessages(
    conversationId: string,
    tenantId: string,
    options?: { cursor?: string; limit?: number },
  ): Promise<ChatMessageResult[]>;
  createMessage(
    input: CreateMessageInput & { tenantId: string },
  ): Promise<ChatMessageResult>;
  findOrCreateGlobalChat(tenantId: string): Promise<ChatRepositoryResult>;
  isParticipant(
    conversationId: string,
    actor: ChatActor,
    tenantId: string,
  ): Promise<boolean>;
  addParticipant(
    conversationId: string,
    actor: ChatActor,
    tenantId: string,
  ): Promise<ChatParticipantResult>;
  updateLastRead(
    conversationId: string,
    actor: ChatActor,
    tenantId: string,
  ): Promise<{ count: number }>;
  createConversation(
    input: CreateConversationInput & { tenantId: string },
  ): Promise<ChatRepositoryResult>;
  findExisting1on1(
    actors: [ChatActor, ChatActor],
    tenantId: string,
  ): Promise<ChatRepositoryResult | null>;
  getOtherParticipants(
    conversationId: string,
    excludeActor: ChatActor,
    tenantId: string,
  ): Promise<ChatParticipantEntity[]>;
  getParticipantCount(
    conversationId: string,
    tenantId: string,
  ): Promise<number>;
  searchUsers(
    tenantId: string,
    search?: string,
    excludeUserId?: string,
  ): Promise<ChatUserResult[]>;
  isEmployeeUser(userId: string, tenantId: string): Promise<boolean>;
  getAllActiveUsers(tenantId: string): Promise<Array<{ id: string }>>;
}
