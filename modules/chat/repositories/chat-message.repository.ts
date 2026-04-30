import { prisma } from "@/lib/prisma";
import { DEFAULT_MESSAGE_LIMIT } from "./chat.constants";

/** Query message chat dan status baca. */
export class ChatMessageRepository {
  /** Ambil message conversation dengan pagination cursor. */
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
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        sender: {
          select: { id: true, name: true, image: true },
        },
      },
    });
  }

  /** Buat message baru dan sinkronkan updatedAt conversation. */
  async createMessage(input: {
    conversationId: string;
    senderId: string;
    tenantId: string;
    content?: string | null;
    imageUrl?: string | null;
  }) {
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

  /** Ambil participant lain selain pengirim. */
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

  /** Cek apakah user adalah participant conversation. */
  async isParticipant(
    conversationId: string,
    userId: string,
    tenantId: string,
  ) {
    const participant = await prisma.conversationParticipant.findFirst({
      where: { conversationId, userId, tenantId },
    });
    return Boolean(participant);
  }

  /** Tambahkan participant ke conversation bila belum ada. */
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

  /** Update waktu baca terakhir participant. */
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

  /** Hitung jumlah participant dalam conversation. */
  async getParticipantCount(conversationId: string, tenantId: string) {
    return prisma.conversationParticipant.count({
      where: { conversationId, tenantId },
    });
  }
}
