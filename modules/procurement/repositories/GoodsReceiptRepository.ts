import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import type { GoodsReceiptEntity } from "../domain/entities/GoodsReceipt";
import type {
  GoodsReceiptCreateInput,
  GoodsReceiptListFilter,
  GoodsReceiptListResult,
  GoodsReceiptWithRelations,
  IGoodsReceiptRepository,
} from "../domain/ports/IGoodsReceiptRepository";

const GRN_PREFIX = "GRN";

type Tx = Prisma.TransactionClient;

/**
 * Repository GRN. `createAndPost` membungkus seluruh side-effect stock-in
 * dalam satu Prisma transaction supaya stock & dokumen GRN selalu konsisten.
 */
export class GoodsReceiptRepository implements IGoodsReceiptRepository {
  async findById(id: string): Promise<GoodsReceiptWithRelations | null> {
    const row = await prisma.goodsReceipt.findUnique({
      where: { id },
      include: {
        purchaseOrder: { select: { id: true, poNumber: true } },
        gudang: { select: { id: true, nama: true } },
        receivedBy: { select: { id: true, name: true } },
        items: {
          include: {
            barang: { select: { id: true, nama: true, kode: true } },
            purchaseOrderItem: {
              select: {
                id: true,
                quantity: true,
                receivedQuantity: true,
                unitPrice: true,
              },
            },
          },
        },
      },
    });
    return row ? mapWithRelations(row) : null;
  }

  async list(filter: GoodsReceiptListFilter): Promise<GoodsReceiptListResult> {
    const where: Record<string, unknown> = { tenantId: filter.tenantId };
    if (filter.purchaseOrderId) where.purchaseOrderId = filter.purchaseOrderId;
    if (filter.status) where.status = filter.status;

    const [rows, total] = await Promise.all([
      prisma.goodsReceipt.findMany({
        where,
        orderBy: { receivedAt: "desc" },
        skip: (filter.page - 1) * filter.limit,
        take: filter.limit,
        include: {
          purchaseOrder: { select: { poNumber: true } },
          gudang: { select: { nama: true } },
          receivedBy: { select: { name: true } },
          items: { select: { quantity: true } },
        },
      }),
      prisma.goodsReceipt.count({ where }),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        grnNumber: row.grnNumber,
        purchaseOrderId: row.purchaseOrderId,
        poNumber: row.purchaseOrder?.poNumber ?? null,
        status: row.status,
        receivedAt: row.receivedAt,
        receiverName: row.receivedBy?.name ?? null,
        gudangNama: row.gudang?.nama ?? null,
        totalQuantity: row.items.reduce((sum, it) => sum + it.quantity, 0),
      })),
      total,
      page: filter.page,
      limit: filter.limit,
    };
  }

  async generateGrnNumber(tenantId: string | null): Promise<string> {
    const today = new Date();
    const ymd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
    const prefix = `${GRN_PREFIX}-${ymd}-`;

    const last = await prisma.goodsReceipt.findFirst({
      where: { tenantId, grnNumber: { startsWith: prefix } },
      orderBy: { grnNumber: "desc" },
      select: { grnNumber: true },
    });

    const lastSeq = last
      ? parseInt(last.grnNumber.slice(prefix.length), 10) || 0
      : 0;
    return `${prefix}${String(lastSeq + 1).padStart(4, "0")}`;
  }

  /**
   * Atomic: insert GRN, update PO item receivedQuantity, upsert stok gudang,
   * insert barang_masuk audit, dan re-evaluate PO status.
   */
  async createAndPost(
    input: GoodsReceiptCreateInput,
  ): Promise<GoodsReceiptEntity> {
    return prisma.$transaction(async (tx) => {
      const receivedAt = input.receivedAt ?? new Date();

      const created = await tx.goodsReceipt.create({
        data: {
          grnNumber: input.grnNumber,
          purchaseOrderId: input.purchaseOrderId,
          gudangId: input.gudangId,
          receivedById: input.receivedById,
          receivedAt,
          status: "POSTED",
          notes: input.notes ?? null,
          fotoBukti: input.fotoBukti ?? [],
          tenantId: input.tenantId,
          items: {
            create: input.items.map((it) => ({
              purchaseOrderItemId: it.purchaseOrderItemId,
              barangId: it.barangId,
              quantity: it.quantity,
              notes: it.notes ?? null,
              tenantId: input.tenantId,
            })),
          },
        },
        include: { items: true },
      });

      for (const item of input.items) {
        await tx.purchaseOrderItem.update({
          where: { id: item.purchaseOrderItemId },
          data: { receivedQuantity: { increment: item.quantity } },
        });

        await tx.barangGudang.upsert({
          where: {
            barangId_gudangId: {
              barangId: item.barangId,
              gudangId: input.gudangId,
            },
          },
          create: {
            id: randomUUID(),
            barangId: item.barangId,
            gudangId: input.gudangId,
            stok: item.quantity,
            stokBaru: item.quantity,
            stokBekas: 0,
            stokRusak: 0,
            createdAt: receivedAt,
            updatedAt: receivedAt,
            tenantId: input.tenantId,
          },
          update: {
            stok: { increment: item.quantity },
            stokBaru: { increment: item.quantity },
            updatedAt: receivedAt,
          },
        });

        await tx.barangMasuk.create({
          data: {
            id: randomUUID(),
            barangId: item.barangId,
            gudangId: input.gudangId,
            jumlah: item.quantity,
            kondisi: "BARU",
            tanggal: receivedAt,
            keterangan: `GRN ${input.grnNumber}${item.notes ? ` - ${item.notes}` : ""}`,
            userId: input.receivedById,
            fotoBukti: input.fotoBukti ?? [],
            tenantId: input.tenantId,
          },
        });
      }

      await this.recomputePoStatus(tx, input.purchaseOrderId);

      return mapEntity(created);
    });
  }

  /**
   * Re-evaluate PO status berdasar receivedQuantity vs quantity total.
   * - Semua item fully received → RECEIVED
   * - Sebagian → PARTIAL
   * - Belum ada → tidak diubah (biarkan ORDERED/DRAFT existing)
   */
  private async recomputePoStatus(tx: Tx, poId: string): Promise<void> {
    const po = await tx.purchaseOrder.findUnique({
      where: { id: poId },
      select: {
        status: true,
        items: { select: { quantity: true, receivedQuantity: true } },
      },
    });
    if (!po) return;

    const totalOrdered = po.items.reduce((s, it) => s + it.quantity, 0);
    const totalReceived = po.items.reduce(
      (s, it) => s + it.receivedQuantity,
      0,
    );

    let nextStatus: "PARTIAL" | "RECEIVED" | null = null;
    if (totalOrdered > 0 && totalReceived >= totalOrdered) {
      nextStatus = "RECEIVED";
    } else if (totalReceived > 0) {
      nextStatus = "PARTIAL";
    }

    if (nextStatus && po.status !== nextStatus) {
      await tx.purchaseOrder.update({
        where: { id: poId },
        data: { status: nextStatus },
      });
    }
  }
}

interface GoodsReceiptRowBase {
  id: string;
  grnNumber: string;
  purchaseOrderId: string;
  gudangId: string;
  receivedById: string;
  receivedAt: Date;
  status: string;
  notes: string | null;
  fotoBukti: string[];
  createdAt: Date;
  updatedAt: Date;
  tenantId: string | null;
  items: Array<{
    id: string;
    goodsReceiptId: string;
    purchaseOrderItemId: string;
    barangId: string;
    quantity: number;
    notes: string | null;
    tenantId: string | null;
  }>;
}

function mapEntity(row: GoodsReceiptRowBase): GoodsReceiptEntity {
  return {
    id: row.id,
    grnNumber: row.grnNumber,
    purchaseOrderId: row.purchaseOrderId,
    gudangId: row.gudangId,
    receivedById: row.receivedById,
    receivedAt: row.receivedAt,
    status: row.status as GoodsReceiptEntity["status"],
    notes: row.notes,
    fotoBukti: row.fotoBukti,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    tenantId: row.tenantId,
    items: row.items.map((it) => ({
      id: it.id,
      goodsReceiptId: it.goodsReceiptId,
      purchaseOrderItemId: it.purchaseOrderItemId,
      barangId: it.barangId,
      quantity: it.quantity,
      notes: it.notes,
      tenantId: it.tenantId,
    })),
  };
}

interface GoodsReceiptRowWithRelations extends GoodsReceiptRowBase {
  purchaseOrder: { id: string; poNumber: string } | null;
  gudang: { id: string; nama: string } | null;
  receivedBy: { id: string; name: string } | null;
  items: Array<
    GoodsReceiptRowBase["items"][number] & {
      barang: { id: string; nama: string; kode: string } | null;
      purchaseOrderItem: {
        id: string;
        quantity: number;
        receivedQuantity: number;
        unitPrice: number;
      } | null;
    }
  >;
}

function mapWithRelations(
  row: GoodsReceiptRowWithRelations,
): GoodsReceiptWithRelations {
  const base = mapEntity(row);
  return {
    ...base,
    purchaseOrder: row.purchaseOrder,
    gudang: row.gudang,
    receivedBy: row.receivedBy,
    items: row.items.map((it, idx) => ({
      ...base.items[idx],
      barang: it.barang,
      purchaseOrderItem: it.purchaseOrderItem,
    })),
  };
}
