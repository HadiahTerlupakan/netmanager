import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type {
  ChatActor,
  ChatParticipantEntity,
} from "../domain/entities/ChatEntity";
import { DEFAULT_MESSAGE_LIMIT } from "./chat.constants";

/** Build participant create data — set userId hanya untuk aktor User. */
function participantUncheckedCreate(
  conversationId: string,
  actor: ChatActor,
  tenantId: string,
): Prisma.ConversationParticipantUncheckedCreateInput {
  return {
    conversationId,
    userId: actor.type === "user" ? actor.id : null,
    actorType: actor.type,
    actorId: actor.id,
    tenantId,
  };
}

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
    sender: ChatActor;
    tenantId: string;
    content?: string | null;
    imageUrl?: string | null;
  }) {
    const message = await prisma.message.create({
      data: {
        conversationId: input.conversationId,
        senderId: input.sender.type === "user" ? input.sender.id : null,
        actorType: input.sender.type,
        actorId: input.sender.id,
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
    excludeActor: ChatActor,
    tenantId: string,
  ): Promise<ChatParticipantEntity[]> {
    const participants = await prisma.conversationParticipant.findMany({
      where: {
        conversationId,
        tenantId,
        NOT: {
          actorType: excludeActor.type,
          actorId: excludeActor.id,
        },
      },
      select: {
        userId: true,
        actorType: true,
        actorId: true,
        user: { select: { id: true, name: true, image: true } },
      },
    });
    return participants as ChatParticipantEntity[];
  }

  /** Cek apakah actor adalah participant conversation. */
  async isParticipant(
    conversationId: string,
    actor: ChatActor,
    tenantId: string,
  ) {
    const participant = await prisma.conversationParticipant.findFirst({
      where: {
        conversationId,
        tenantId,
        actorType: actor.type,
        actorId: actor.id,
      },
    });
    return Boolean(participant);
  }

  /** Tambahkan actor sebagai participant conversation bila belum ada. */
  async addParticipant(
    conversationId: string,
    actor: ChatActor,
    tenantId: string,
  ) {
    return prisma.conversationParticipant.upsert({
      where: {
        conversationId_actorType_actorId: {
          conversationId,
          actorType: actor.type,
          actorId: actor.id,
        },
      },
      create: participantUncheckedCreate(conversationId, actor, tenantId),
      update: { tenantId },
    });
  }

  /** Update waktu baca terakhir participant. */
  async updateLastRead(
    conversationId: string,
    actor: ChatActor,
    tenantId: string,
  ) {
    return prisma.conversationParticipant.updateMany({
      where: {
        conversationId,
        tenantId,
        actorType: actor.type,
        actorId: actor.id,
      },
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
