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

/**
 * Pencari ringkasan aktor untuk satu permintaan. Mitra dan pelanggan tidak
 * punya relasi `sender`/`user`, jadi namanya dicari di database lain; tanpa
 * penyimpan ini satu halaman 50 pesan dari mitra yang sama memicu 50 query.
 */
export class ActorSummaryLookup {
  private readonly hasilPerAktor = new Map<
    string,
    Promise<ActorSummary | null>
  >();

  /** Ringkasan aktor; aktor yang sama hanya dicari sekali. */
  find(actor: ChatActor): Promise<ActorSummary | null> {
    const kunci = `${actor.type}:${actor.id}`;
    let hasil = this.hasilPerAktor.get(kunci);
    if (!hasil) {
      hasil = resolveActorSummary(actor);
      this.hasilPerAktor.set(kunci, hasil);
    }
    return hasil;
  }
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
