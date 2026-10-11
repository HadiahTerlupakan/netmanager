import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type {
  IPlanningItemRepository,
  CreatePlanningItemInput,
  UpdatePlanningItemInput,
  FindAllPlanningItemFilters,
  UpsertPlanningItemBySourceKeyInput,
  HapusItemOtomatisFilter,
} from "../domain/ports/IPlanningItemRepository";
import type { PlanningItemEntity } from "../domain/entities/PlanningItemEntity";
import { PlanningItemMapper } from "../mappers/PlanningItemMapper";

export class PlanningItemRepository implements IPlanningItemRepository {
  /**
   * Find planning item by ID
   */
  async findById(id: string): Promise<PlanningItemEntity | null> {
    const item = await prisma.planningItem.findFirst({
      where: { id },
    });

    return item ? PlanningItemMapper.toEntity(item) : null;
  }

  /**
   * Find all planning items with filters and pagination
   */
  async findAll(
    filters: FindAllPlanningItemFilters,
  ): Promise<{ items: PlanningItemEntity[]; total: number }> {
    const { tenantId, planningId, page = 1, limit = 50 } = filters;

    const where: Prisma.PlanningItemWhereInput = {};

    if (tenantId) {
      where.tenantId = tenantId;
    }
    if (planningId) {
      where.planningId = planningId;
    }

    const [items, total] = await Promise.all([
      prisma.planningItem.findMany({
        where,
        orderBy: { createdAt: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.planningItem.count({ where }),
    ]);

    return {
      items: items.map((item) => PlanningItemMapper.toEntity(item)),
      total,
    };
  }

  /**
   * Find all items for a specific planning
   */
  async findByPlanningId(planningId: string): Promise<PlanningItemEntity[]> {
    const items = await prisma.planningItem.findMany({
      where: { planningId },
      orderBy: { createdAt: "asc" },
    });

    return items.map((item) => PlanningItemMapper.toEntity(item));
  }

  /**
   * Create new planning item
   */
  async create(
    data: CreatePlanningItemInput,
    tx?: Prisma.TransactionClient,
  ): Promise<PlanningItemEntity> {
    const client = tx ?? prisma;

    const prismaData: Prisma.PlanningItemUncheckedCreateInput = {
      planningId: data.planningId,
      tenantId: data.tenantId,
      name: data.name,
      description: data.description ?? null,
      quantity: data.quantity,
      unit: data.unit,
      estimatedPrice: data.estimatedPrice ?? null,
      actualPrice: data.actualPrice ?? null,
      notes: data.notes ?? null,
    };

    const created = await client.planningItem.create({
      data: prismaData,
    });

    return PlanningItemMapper.toEntity(created);
  }

  /**
   * Update planning item
   */
  async update(
    id: string,
    data: UpdatePlanningItemInput,
    tx?: Prisma.TransactionClient,
  ): Promise<PlanningItemEntity> {
    const client = tx ?? prisma;

    const updateData: Prisma.PlanningItemUpdateInput = {};

    if (data.name !== undefined) {
      updateData.name = data.name;
    }
    if (data.description !== undefined) {
      updateData.description = data.description;
    }
    if (data.quantity !== undefined) {
      updateData.quantity = data.quantity;
    }
    if (data.unit !== undefined) {
      updateData.unit = data.unit;
    }
    if (data.estimatedPrice !== undefined) {
      updateData.estimatedPrice = data.estimatedPrice;
    }
    if (data.actualPrice !== undefined) {
      updateData.actualPrice = data.actualPrice;
    }
    if (data.notes !== undefined) {
      updateData.notes = data.notes;
    }

    const updated = await client.planningItem.update({
      where: { id },
      data: updateData,
    });

    return PlanningItemMapper.toEntity(updated);
  }

  /**
   * Delete planning item
   */
  async delete(id: string, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? prisma;

    await client.planningItem.delete({
      where: { id },
    });
  }

  /**
   * Delete all items for a specific planning (cascade delete)
   */
  async deleteByPlanningId(
    planningId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? prisma;

    await client.planningItem.deleteMany({
      where: { planningId },
    });
  }

  /**
   * Membuat atau memperbarui item otomatis berdasarkan `sourceKey`.
   *
   * Satu pernyataan `upsert` Prisma di atas kunci unik
   * `(planningId, sourceKey)`, bukan baca-lalu-tulis. Versi sebelumnya
   * memakai `findFirst` + `create`/`update`: dua penerbitan yang
   * tumpang-tindih sama-sama tidak menemukan baris lalu sama-sama
   * membuatnya, sehingga item material terduplikasi dan estimasi budget
   * terhitung dobel. Dengan kunci itu, penulis kedua kalah di basis data
   * (bukan di disiplin pemanggil) dan gagal dengan P2002, bukan menggandakan.
   *
   * Item manual tidak pernah tersentuh karena `sourceKey`-nya selalu NULL —
   * kolom itu hanya ditulis oleh metode ini — dan NULL bersifat distinct di
   * Postgres sehingga tidak pernah menempati kunci ini.
   *
   * Harga (`estimatedPrice`) dan `description` sengaja tidak ditimpa saat
   * memperbarui: keduanya diisi manusia di atas angka hasil hitungan.
   */
  async upsertBySourceKey(
    data: UpsertPlanningItemBySourceKeyInput,
    tx?: Prisma.TransactionClient,
  ): Promise<PlanningItemEntity> {
    const client = tx ?? prisma;

    const hasil = await client.planningItem.upsert({
      where: {
        planningId_sourceKey: {
          planningId: data.planningId,
          sourceKey: data.sourceKey,
        },
      },
      update: {
        name: data.name,
        unit: data.unit,
        quantity: data.quantity,
        notes: data.notes,
      },
      create: {
        planningId: data.planningId,
        tenantId: data.tenantId,
        sourceKey: data.sourceKey,
        name: data.name,
        unit: data.unit,
        quantity: data.quantity,
        notes: data.notes,
        isAutoGenerated: true,
      },
    });

    return PlanningItemMapper.toEntity(hasil);
  }

  /** Menghapus item otomatis yang kuncinya tak lagi dipakai; item manual tidak pernah dihapus. */
  async hapusOtomatisYangTidakDipakai(
    filter: HapusItemOtomatisFilter,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const client = tx ?? prisma;

    const hasil = await client.planningItem.deleteMany({
      where: {
        planningId: filter.planningId,
        isAutoGenerated: true,
        OR: [
          { sourceKey: null },
          { sourceKey: { notIn: filter.sourceKeyDipakai } },
        ],
      },
    });
    return hasil.count;
  }
}
