import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type {
  CreateConversationInput,
  CreateMessageInput,
} from "../domain/entities/ChatEntity";
import type { IChatRepository } from "../domain/ports/IChatRepository";

const GLOBAL_CHAT_NAME = "Global Chat";
const DEFAULT_MESSAGE_LIMIT = 50;
const DEFAULT_USER_SEARCH_LIMIT = 50;

/**
 * Chat repository implementation.
 */
export class ChatRepository implements IChatRepository {
  /**
   * Find all conversations for a user within tenant.
   */
  async findConversationsForUser(userId: string, tenantId: string) {
    return prisma.conversation.findMany({
      where: {
        tenantId,
        participants: {
          some: { userId, tenantId },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
                email: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            sender: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  /**
   * Find conversation by ID within tenant.
   */
  async findConversationById(conversationId: string, tenantId: string) {
    return prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, name: true, image: true },
            },
          },
        },
      },
    });
  }

  /**
   * Get messages for a conversation with pagination.
   */
  async findMessages(
    conversationId: string,
    tenantId: string,
    options: { cursor?: string; limit?: number } = {},
  ) {
    const { cursor, limit = DEFAULT_MESSAGE_LIMIT } = options;

    return prisma.message.findMany({
      where: { conversationId, tenantId },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      include: {
        sender: {
          select: { id: true, name: true, image: true },
        },
      },
    });
  }

  /**
   * Create a new message and update conversation timestamp.
   */
  async createMessage(input: CreateMessageInput & { tenantId: string }) {
    const message = await prisma.message.create({
      data: {
        conversationId: input.conversationId,
        senderId: input.senderId,
        content: input.content?.trim() || null,
        imageUrl: input.imageUrl || null,
        tenantId: input.tenantId,
      },
      include: {
        sender: {
          select: { id: true, name: true, image: true },
        },
      },
    });

    await prisma.conversation.update({
      where: { id: input.conversationId, tenantId: input.tenantId },
      data: { updatedAt: new Date() },
    });

    return message;
  }

  /**
   * Find or create global chat within tenant.
   */
  async findOrCreateGlobalChat(tenantId: string) {
    let globalChat = await prisma.conversation.findFirst({
      where: { isGlobal: true, tenantId },
    });

    if (!globalChat) {
      globalChat = await prisma.conversation.create({
        data: {
          name: GLOBAL_CHAT_NAME,
          isGlobal: true,
          tenantId,
        },
      });
    }

    return globalChat;
  }

  /**
   * Check if user is participant of a conversation.
   */
  async isParticipant(
    conversationId: string,
    userId: string,
    tenantId: string,
  ) {
    const participant = await prisma.conversationParticipant.findFirst({
      where: { conversationId, userId, tenantId },
    });
    return !!participant;
  }

  /**
   * Add user as participant to conversation.
   */
  async addParticipant(
    conversationId: string,
    userId: string,
    tenantId: string,
  ) {
    return prisma.conversationParticipant.upsert({
      where: { conversationId_userId: { conversationId, userId } },
      create: { conversationId, userId, tenantId },
      update: { tenantId },
    });
  }

  /**
   * Update last read timestamp for a participant.
   */
  async updateLastRead(
    conversationId: string,
    userId: string,
    tenantId: string,
  ) {
    return prisma.conversationParticipant.updateMany({
      where: { conversationId, userId, tenantId },
      data: { lastReadAt: new Date() },
    });
  }

  /**
   * Create a new conversation.
   */
  async createConversation(
    input: CreateConversationInput & { tenantId: string },
  ) {
    return prisma.conversation.create({
      data: {
        name: input.name || null,
        isGlobal: input.isGlobal || false,
        tenantId: input.tenantId,
        participants: {
          create: input.participantIds.map((userId) => ({
            userId,
            tenantId: input.tenantId,
          })),
        },
      },
    });
  }

  /**
   * Find existing 1-on-1 conversation between two users.
   */
  async findExisting1on1(userIds: string[], tenantId: string) {
    if (userIds.length !== 2) return null;

    return prisma.conversation.findFirst({
      where: {
        isGlobal: false,
        tenantId,
        participants: {
          every: { userId: { in: userIds } },
        },
        AND: {
          participants: {
            none: { userId: { notIn: userIds } },
          },
        },
      },
    });
  }

  /**
   * Get all participants of a conversation except one user.
   */
  async getOtherParticipants(
    conversationId: string,
    excludeUserId: string,
    tenantId: string,
  ) {
    return prisma.conversationParticipant.findMany({
      where: {
        conversationId,
        tenantId,
        userId: { not: excludeUserId },
      },
      select: { userId: true },
    });
  }

  /**
   * Get participant count for a conversation.
   */
  async getParticipantCount(conversationId: string, tenantId: string) {
    return prisma.conversationParticipant.count({
      where: { conversationId, tenantId },
    });
  }

  /**
   * Search active users for creating new chat.
   */
  async searchUsers(tenantId: string, search?: string, excludeUserId?: string) {
    const where: Prisma.UserWhereInput = {
      isActive: true,
      tenantId,
      ...(excludeUserId && { id: { not: excludeUserId } }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    return prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        departments: { select: { name: true } },
        sites: { select: { name: true } },
      },
      take: DEFAULT_USER_SEARCH_LIMIT,
      orderBy: { name: "asc" },
    });
  }

  /**
   * Check whether user exists in employee table.
   */
  async isEmployeeUser(userId: string, tenantId: string) {
    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { id: true },
    });
    return Boolean(user);
  }

  /**
   * Get active users for broadcast within tenant.
   */
  async getAllActiveUsers(tenantId: string) {
    return prisma.user.findMany({
      where: { isActive: true, tenantId },
      select: { id: true },
      orderBy: { name: "asc" },
    });
  }
}
