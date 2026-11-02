import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { ChatActor } from "../domain/entities/ChatEntity";
import { GLOBAL_CHAT_NAME } from "../domain/chat.constants";

type ParticipantNestedCreate =
  Prisma.ConversationParticipantCreateWithoutConversationInput;

/** Build participant create data — set userId hanya untuk aktor User. */
function participantNestedCreate(
  actor: ChatActor,
  tenantId: string,
): ParticipantNestedCreate {
  return {
    userId: actor.type === "user" ? actor.id : null,
    actorType: actor.type,
    actorId: actor.id,
    tenantId,
  } as ParticipantNestedCreate;
}

/** Global chat tertua tenant: acuan tunggal bila pernah tercipta ganda. */
function findOldestGlobalChat(tenantId: string) {
  return prisma.conversation.findFirst({
    where: { isGlobal: true, tenantId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
}

/** Query conversation chat utama. */
export class ChatConversationRepository {
  /** Ambil semua conversation milik actor dalam tenant. */
  async findConversationsForUser(actor: ChatActor, tenantId: string) {
    return prisma.conversation.findMany({
      where: {
        tenantId,
        participants: {
          some: {
            actorType: actor.type,
            actorId: actor.id,
            tenantId,
          },
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

  /**
   * Ambil atau buat global chat tenant.
   *
   * Tidak ada unique constraint "satu global chat per tenant", jadi dua
   * permintaan pertama yang bersamaan bisa sama-sama membuatnya. Semua
   * pemanggil selalu memakai yang tertua, sehingga anggota tidak terpecah ke
   * dua global chat.
   */
  async findOrCreateGlobalChat(tenantId: string) {
    const globalChat = await findOldestGlobalChat(tenantId);
    if (globalChat) {
      return globalChat;
    }

    await prisma.conversation.create({
      data: {
        name: GLOBAL_CHAT_NAME,
        isGlobal: true,
        tenantId,
      },
    });
    return (await findOldestGlobalChat(tenantId))!;
  }

  /** Buat conversation baru beserta participant awal. */
  async createConversation(input: {
    participants: ChatActor[];
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
          create: input.participants.map((actor) =>
            participantNestedCreate(actor, input.tenantId),
          ),
        },
      },
    });
  }

  /**
   * Cari direct conversation yang sudah ada antara dua actor: keduanya
   * peserta, dan tidak ada peserta lain. Percakapan yang hanya berisi salah
   * satunya, atau grup bernama, bukan chat langsung mereka.
   */
  async findExisting1on1(actors: [ChatActor, ChatActor], tenantId: string) {
    if (actors.length !== 2) {
      return null;
    }

    return prisma.conversation.findFirst({
      where: {
        isGlobal: false,
        tenantId,
        name: null,
        AND: [
          ...actors.map((actor) => ({
            participants: {
              some: { actorType: actor.type, actorId: actor.id },
            },
          })),
          {
            participants: {
              every: {
                OR: actors.map((actor) => ({
                  actorType: actor.type,
                  actorId: actor.id,
                })),
              },
            },
          },
        ],
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  }
}
