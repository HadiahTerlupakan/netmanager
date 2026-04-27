import type { Prisma } from "@prisma/client";
import type {
  CreateConversationInput,
  CreateMessageInput,
} from "../entities/ChatEntity";

export interface IChatRepository {
  findConversationsForUser(
    userId: string,
    tenantId: string,
  ): Promise<
    Array<
      Prisma.ConversationGetPayload<{
        include: {
          participants: {
            include: {
              user: {
                select: { id: true; name: true; image: true; email: true };
              };
            };
          };
          messages: {
            include: { sender: { select: { id: true; name: true } } };
          };
        };
      }>
    >
  >;
  findConversationById(
    conversationId: string,
    tenantId: string,
  ): Promise<Prisma.ConversationGetPayload<{
    include: {
      participants: {
        include: { user: { select: { id: true; name: true; image: true } } };
      };
    };
  }> | null>;
  findMessages(
    conversationId: string,
    tenantId: string,
    options?: { cursor?: string; limit?: number },
  ): Promise<
    Array<
      Prisma.MessageGetPayload<{
        include: { sender: { select: { id: true; name: true; image: true } } };
      }>
    >
  >;
  createMessage(input: CreateMessageInput & { tenantId: string }): Promise<
    Prisma.MessageGetPayload<{
      include: { sender: { select: { id: true; name: true; image: true } } };
    }>
  >;
  findOrCreateGlobalChat(
    tenantId: string,
  ): Promise<Prisma.ConversationGetPayload<Record<string, never>>>;
  isParticipant(
    conversationId: string,
    userId: string,
    tenantId: string,
  ): Promise<boolean>;
  addParticipant(
    conversationId: string,
    userId: string,
    tenantId: string,
  ): Promise<Prisma.ConversationParticipantGetPayload<Record<string, never>>>;
  updateLastRead(
    conversationId: string,
    userId: string,
    tenantId: string,
  ): Promise<Prisma.BatchPayload>;
  createConversation(
    input: CreateConversationInput & { tenantId: string },
  ): Promise<Prisma.ConversationGetPayload<Record<string, never>>>;
  findExisting1on1(
    userIds: string[],
    tenantId: string,
  ): Promise<Prisma.ConversationGetPayload<Record<string, never>> | null>;
  getOtherParticipants(
    conversationId: string,
    excludeUserId: string,
    tenantId: string,
  ): Promise<Array<{ userId: string }>>;
  getParticipantCount(
    conversationId: string,
    tenantId: string,
  ): Promise<number>;
  searchUsers(
    tenantId: string,
    search?: string,
    excludeUserId?: string,
  ): Promise<
    Array<
      Prisma.UserGetPayload<{
        select: {
          id: true;
          name: true;
          email: true;
          image: true;
          departments: { select: { name: true } };
          sites: { select: { name: true } };
        };
      }>
    >
  >;
  isEmployeeUser(userId: string, tenantId: string): Promise<boolean>;
  getAllActiveUsers(tenantId: string): Promise<Array<{ id: string }>>;
}
