import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type {
  ChatActor,
  ChatParticipantEntity,
} from "../domain/entities/ChatEntity";
import { isPrismaUniqueConstraintError } from "@/lib/prisma-errors";
import { DEFAULT_MESSAGE_LIMIT } from "../domain/chat.constants";

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
      // `id` memecah seri: pesan dengan createdAt sama tidak terlewat atau
      // terulang di batas halaman.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
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

  /**
   * Tambahkan actor sebagai participant conversation bila belum ada.
   *
   * Ekstensi tenant menambah `tenantId` ke `where` upsert, sehingga Prisma
   * tidak memakai upsert native dan dua permintaan bersamaan (broadcast dan
   * buka global chat) bisa sama-sama mencoba insert. Yang kalah membaca baris
   * pemenangnya, bukan menggagalkan permintaan dengan 409.
   */
  async addParticipant(
    conversationId: string,
    actor: ChatActor,
    tenantId: string,
  ) {
    const kunci = {
      conversationId_actorType_actorId: {
        conversationId,
        actorType: actor.type,
        actorId: actor.id,
      },
    };
    try {
      return await prisma.conversationParticipant.upsert({
        where: kunci,
        create: participantUncheckedCreate(conversationId, actor, tenantId),
        update: { tenantId },
      });
    } catch (error) {
      if (!isPrismaUniqueConstraintError(error)) throw error;
      return prisma.conversationParticipant.findUniqueOrThrow({ where: kunci });
    }
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
