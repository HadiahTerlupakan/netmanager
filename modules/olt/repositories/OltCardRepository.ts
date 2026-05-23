import { prisma } from "@/modules/database";
import type {
  OltCard,
  OltCardListItem,
  OltCardUpsertInput,
  OltCardUpdateInput,
} from "../domain/entities/olt-card.entity";

export class OltCardRepository {
  async findById(id: string, tenantId: string): Promise<OltCard | null> {
    const card = await prisma.oltCard.findFirst({
      where: { id, tenantId },
    });
    return card as OltCard | null;
  }

  async listByOlt(tenantId: string, oltId: string): Promise<OltCardListItem[]> {
    const cards = await prisma.oltCard.findMany({
      where: { tenantId, oltId },
      orderBy: [{ slotFrame: "asc" }, { slot: "asc" }],
    });

    if (cards.length === 0) return [];

    const onuCounts = await prisma.onuDevice.groupBy({
      by: ["slotFrame", "slot"],
      where: { oltId, tenantId },
      _count: { id: true },
    });

    const countMap = new Map<string, number>();
    for (const row of onuCounts) {
      countMap.set(`${row.slotFrame}:${row.slot}`, row._count.id);
    }

    return cards.map((card) => ({
      ...(card as unknown as OltCard),
      onuCount: countMap.get(`${card.slotFrame}:${card.slot}`) ?? 0,
    }));
  }

  async upsertByPosition(input: OltCardUpsertInput): Promise<OltCard> {
    const card = await prisma.oltCard.upsert({
      where: {
        oltId_slotFrame_slot: {
          oltId: input.oltId,
          slotFrame: input.slotFrame,
          slot: input.slot,
        },
      },
      create: {
        tenantId: input.tenantId,
        oltId: input.oltId,
        slotFrame: input.slotFrame,
        slot: input.slot,
        cardType: input.cardType ?? null,
        ponCount: input.ponCount,
        status: input.status ?? "ACTIVE",
      },
      update: {
        cardType: input.cardType ?? undefined,
        ponCount: input.ponCount,
        status: input.status ?? undefined,
      },
    });
    return card as unknown as OltCard;
  }

  async updateById(
    id: string,
    tenantId: string,
    input: OltCardUpdateInput,
  ): Promise<OltCard> {
    const result = await prisma.oltCard.updateMany({
      where: { id, tenantId },
      data: input as Parameters<typeof prisma.oltCard.updateMany>[0]["data"],
    });
    if (result.count === 0) {
      throw new Error("Card tidak ditemukan");
    }
    const card = await prisma.oltCard.findUnique({ where: { id } });
    return card as unknown as OltCard;
  }

  async findOnuPositions(
    tenantId: string,
    oltId: string,
  ): Promise<{ slotFrame: number; slot: number; maxPonPort: number }[]> {
    const positions = await prisma.onuDevice.groupBy({
      by: ["slotFrame", "slot"],
      where: { oltId, tenantId },
      _max: { ponPort: true },
    });

    return positions.map((p) => ({
      slotFrame: p.slotFrame,
      slot: p.slot,
      maxPonPort: p._max.ponPort ?? 0,
    }));
  }
}
