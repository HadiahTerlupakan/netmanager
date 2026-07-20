import { prisma, prismaAuth } from "@/lib/prisma";
import { prismaMitraAuth } from "@/lib/prisma-mitra";
import type {
  ChatActor,
  ChatUserSummaryEntity,
} from "../domain/entities/ChatEntity";

type ActorSummary = {
  id: string;
  name: string | null;
  image?: string | null;
};

/** Resolve display name & image actor dari DB sesuai type (cross-DB lookup). */
export async function resolveActorSummary(
  actor: ChatActor,
): Promise<ActorSummary | null> {
  if (actor.type === "user") {
    const user = await prisma.user.findUnique({
      where: { id: actor.id },
      select: { id: true, name: true, image: true },
    });
    return user as ActorSummary | null;
  }

  if (actor.type === "mitra") {
    const mitra = await prismaMitraAuth.mitra.findUnique({
      where: { id: actor.id },
      select: { id: true, name: true, fotoDiri: true },
    });
    if (!mitra) return null;
    return { id: mitra.id, name: mitra.name, image: mitra.fotoDiri };
  }

  if (actor.type === "customer") {
    const pelanggan = await prismaAuth.pelanggan.findUnique({
      where: { id: actor.id },
      select: { id: true, nama: true },
    });
    if (!pelanggan) return null;
    return { id: pelanggan.id, name: pelanggan.nama, image: null };
  }

  return null;
}

/** Resolve ringkasan participant dari relasi user (jika User) atau fallback actor. */
export function participantSummary(participant: {
  userId: string | null;
  actorType: string;
  actorId: string | null;
  user?: ChatUserSummaryEntity | null;
}): ActorSummary | null {
  if (participant.user) {
    return {
      id: participant.user.id,
      name: participant.user.name,
      image: participant.user.image ?? null,
    };
  }
  if (!participant.actorId) return null;
  return {
    id: participant.actorId,
    name: null,
    image: null,
  };
}
