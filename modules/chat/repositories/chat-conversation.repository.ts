import { prisma } from "@/lib/prisma";
import { GLOBAL_CHAT_NAME } from "./chat.constants";

/** Query conversation chat utama. */
export class ChatConversationRepository {
  /** Ambil semua conversation milik user dalam tenant. */
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

  /** Ambil detail conversation berdasarkan ID. */
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

  /** Ambil atau buat global chat tenant. */
  async findOrCreateGlobalChat(tenantId: string) {
    const globalChat = await prisma.conversation.findFirst({
      where: { isGlobal: true, tenantId },
    });
    if (globalChat) {
      return globalChat;
    }

    return prisma.conversation.create({
      data: {
        name: GLOBAL_CHAT_NAME,
        isGlobal: true,
        tenantId,
      },
    });
  }

  /** Buat conversation baru beserta participant awal. */
  async createConversation(input: {
    participantIds: string[];
    tenantId: string;
    name?: string;
    isGlobal?: boolean;
  }) {
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

  /** Cari conversation direct yang sudah ada. */
  async findExisting1on1(userIds: string[], tenantId: string) {
    if (userIds.length !== 2) {
      return null;
    }

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
}
