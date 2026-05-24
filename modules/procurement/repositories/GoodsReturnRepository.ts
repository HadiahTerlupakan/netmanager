import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import type {
  GoodsReturnEntity,
  GoodsReturnReason,
  GoodsReturnStatus,
} from "../domain/entities/GoodsReturn";
import type {
  GoodsReturnCreateInput,
  GoodsReturnListFilter,
  GoodsReturnListResult,
  GoodsReturnResolveInput,
  GoodsReturnWithRelations,
  IGoodsReturnRepository,
} from "../domain/ports/IGoodsReturnRepository";

const RTV_PREFIX = "RTV";

type Tx = Prisma.TransactionClient;

export class GoodsReturnRepository implements IGoodsReturnRepository {
  async findById(id: string): Promise<GoodsReturnWithRelations | null> {
    const row = await prisma.goodsReturn.findUnique({
      where: { id },
      include: {
        goodsReceipt: { select: { id: true, grnNumber: true } },
        supplier: { select: { id: true, name: true } },
        gudang: { select: { id: true, nama: true } },
        returnedBy: { select: { id: true, name: true } },
        items: {
          include: {
            barang: { select: { id: true, nama: true, kode: true } },
            goodsReceiptItem: {
              select: {
                id: true,
                quantity: true,
                purchaseOrderItem: {
                  select: { id: true, unitPrice: true },
                },
              },
            },
          },
        },
      },
    });
    return row ? mapWithRelations(row) : null;
  }

  async list(filter: GoodsReturnListFilter): Promise<GoodsReturnListResult> {
    const where: Record<string, unknown> = { tenantId: filter.tenantId };
    if (filter.goodsReceiptId) where.goodsReceiptId = filter.goodsReceiptId;
    if (filter.supplierId) where.supplierId = filter.supplierId;
    if (filter.status) where.status = filter.status;

    const [rows, total] = await Promise.all([
      prisma.goodsReturn.findMany({
        where,
        orderBy: { returnedAt: "desc" },
        skip: (filter.page - 1) * filter.limit,
        take: filter.limit,
        include: {
          goodsReceipt: { select: { grnNumber: true } },
          supplier: { select: { name: true } },
          items: { select: { quantity: true } },
        },
      }),
      prisma.goodsReturn.count({ where }),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        rtvNumber: row.rtvNumber,
        goodsReceiptId: row.goodsReceiptId,
        grnNumber: row.goodsReceipt?.grnNumber ?? null,
        supplierName: row.supplier?.name ?? null,
        status: row.status,
        reason: row.reason,
        returnedAt: row.returnedAt,
        totalQuantity: row.items.reduce((sum, it) => sum + it.quantity, 0),
      })),
      total,
      page: filter.page,
      limit: filter.limit,
    };
  }

  async generateRtvNumber(tenantId: string | null): Promise<string> {
    const today = new Date();
    const ymd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
    const prefix = `${RTV_PREFIX}-${ymd}-`;

    const last = await prisma.goodsReturn.findFirst({
      where: { tenantId, rtvNumber: { startsWith: prefix } },
      orderBy: { rtvNumber: "desc" },
      select: { rtvNumber: true },
    });

    const lastSeq = last
      ? parseInt(last.rtvNumber.slice(prefix.length), 10) || 0
      : 0;
    return `${prefix}${String(lastSeq + 1).padStart(4, "0")}`;
  }

  async createAndSend(
    input: GoodsReturnCreateInput,
  ): Promise<GoodsReturnEntity> {
    return prisma.$transaction(async (tx) => {
      const returnedAt = input.returnedAt ?? new Date();

      const created = await tx.goodsReturn.create({
        data: {
          rtvNumber: input.rtvNumber,
          goodsReceiptId: input.goodsReceiptId,
          supplierId: input.supplierId,
          gudangId: input.gudangId,
          reason: input.reason,
          status: "SENT",
          returnedById: input.returnedById,
          returnedAt,
          notes: input.notes ?? null,
          fotoBukti: input.fotoBukti ?? [],
          tenantId: input.tenantId,
          items: {
            create: input.items.map((it) => ({
              goodsReceiptItemId: it.goodsReceiptItemId,
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
        await this.decrementStock(tx, {
          barangId: item.barangId,
          gudangId: input.gudangId,
          quantity: item.quantity,
          reason: input.reason,
        });

        await tx.barangKeluar.create({
          data: {
            id: randomUUID(),
            barangId: item.barangId,
            gudangId: input.gudangId,
            jumlah: item.quantity,
            kondisi: input.reason === "DAMAGED" ? "RUSAK" : "BARU",
            tanggal: returnedAt,
            keterangan: `RTV ${input.rtvNumber} - ${input.reason}${item.notes ? ` (${item.notes})` : ""}`,
            tujuanPenggunaan: "Retur Vendor",
            userId: input.returnedById,
            tenantId: input.tenantId,
          },
        });
      }

      return mapEntity(created);
    });
  }

  async resolve(
    id: string,
    input: GoodsReturnResolveInput,
  ): Promise<GoodsReturnEntity> {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.goodsReturn.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!existing) {
        throw new Error(`GoodsReturn ${id} tidak ditemukan`);
      }

      if (input.status === "CANCELLED" && existing.status === "SENT") {
        for (const item of existing.items) {
          await tx.barangGudang.update({
            where: {
              barangId_gudangId: {
                barangId: item.barangId,
                gudangId: existing.gudangId,
              },
            },
            data: {
              stok: { increment: item.quantity },
              stokBaru: { increment: item.quantity },
              updatedAt: new Date(),
            },
          });
        }
      }

      const updated = await tx.goodsReturn.update({
        where: { id },
        data: {
          status: input.status,
          resolvedAt: input.resolvedAt ?? new Date(),
          ...(input.refundAmount !== undefined && {
            refundAmount: input.refundAmount,
          }),
          ...(input.replacementGrnId !== undefined && {
            replacementGrnId: input.replacementGrnId,
          }),
          ...(input.creditNoteRef !== undefined && {
            creditNoteRef: input.creditNoteRef,
          }),
          ...(input.notes !== undefined && { notes: input.notes }),
        },
        include: { items: true },
      });
      return mapEntity(updated);
    });
  }

  /**
   * Kurangi stok gudang berdasarkan kondisi: barang rusak masuk ke
   * `stokRusak`, lainnya dari `stokBaru`. Total `stok` selalu dikurangi.
   */
  private async decrementStock(
    tx: Tx,
    input: {
      barangId: string;
      gudangId: string;
      quantity: number;
      reason: GoodsReturnReason;
    },
  ): Promise<void> {
    const isDamaged = input.reason === "DAMAGED";
    await tx.barangGudang.update({
      where: {
        barangId_gudangId: {
          barangId: input.barangId,
          gudangId: input.gudangId,
        },
      },
      data: {
        stok: { decrement: input.quantity },
        ...(isDamaged
          ? { stokRusak: { decrement: input.quantity } }
          : { stokBaru: { decrement: input.quantity } }),
        updatedAt: new Date(),
      },
    });
  }
}

interface GoodsReturnRowBase {
  id: string;
  rtvNumber: string;
  goodsReceiptId: string;
  supplierId: string | null;
  gudangId: string;
  reason: string;
  status: string;
  returnedById: string;
  returnedAt: Date;
  resolvedAt: Date | null;
  notes: string | null;
  fotoBukti: string[];
  refundAmount: number | null;
  replacementGrnId: string | null;
  creditNoteRef: string | null;
  createdAt: Date;
  updatedAt: Date;
  tenantId: string | null;
  items: Array<{
    id: string;
    goodsReturnId: string;
    goodsReceiptItemId: string;
    barangId: string;
    quantity: number;
    notes: string | null;
    tenantId: string | null;
  }>;
}

function mapEntity(row: GoodsReturnRowBase): GoodsReturnEntity {
  return {
    id: row.id,
    rtvNumber: row.rtvNumber,
    goodsReceiptId: row.goodsReceiptId,
    supplierId: row.supplierId,
    gudangId: row.gudangId,
    reason: row.reason as GoodsReturnReason,
    status: row.status as GoodsReturnStatus,
    returnedById: row.returnedById,
    returnedAt: row.returnedAt,
    resolvedAt: row.resolvedAt,
    notes: row.notes,
    fotoBukti: row.fotoBukti,
    refundAmount: row.refundAmount,
    replacementGrnId: row.replacementGrnId,
    creditNoteRef: row.creditNoteRef,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    tenantId: row.tenantId,
    items: row.items.map((it) => ({
      id: it.id,
      goodsReturnId: it.goodsReturnId,
      goodsReceiptItemId: it.goodsReceiptItemId,
      barangId: it.barangId,
      quantity: it.quantity,
      notes: it.notes,
      tenantId: it.tenantId,
    })),
  };
}

interface GoodsReturnRowWithRelations extends GoodsReturnRowBase {
  goodsReceipt: { id: string; grnNumber: string } | null;
  supplier: { id: string; name: string } | null;
  gudang: { id: string; nama: string } | null;
  returnedBy: { id: string; name: string } | null;
  items: Array<
    GoodsReturnRowBase["items"][number] & {
      barang: { id: string; nama: string; kode: string } | null;
      goodsReceiptItem: {
        id: string;
        quantity: number;
        purchaseOrderItem: {
          id: string;
          unitPrice: number;
        } | null;
      } | null;
    }
  >;
}

function mapWithRelations(
  row: GoodsReturnRowWithRelations,
): GoodsReturnWithRelations {
  const base = mapEntity(row);
  return {
    ...base,
    goodsReceipt: row.goodsReceipt,
    supplier: row.supplier,
    gudang: row.gudang,
    returnedBy: row.returnedBy,
    items: row.items.map((it, idx) => ({
      ...base.items[idx],
      barang: it.barang,
      goodsReceiptItem: it.goodsReceiptItem,
    })),
  };
}
