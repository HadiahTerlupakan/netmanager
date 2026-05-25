import { eventBus } from "@/lib/event-bus";
import { EVENT_NAMES } from "@/lib/event-bus/types";
import type { GoodsReturnEntity } from "../domain/entities/GoodsReturn";
import type {
  GoodsReturnListFilter,
  GoodsReturnListResult,
  GoodsReturnResolveInput,
  GoodsReturnWithRelations,
  IGoodsReturnRepository,
} from "../domain/ports/IGoodsReturnRepository";
import type { IGoodsReceiptRepository } from "../domain/ports/IGoodsReceiptRepository";
import { GoodsReceiptRepository } from "../repositories/GoodsReceiptRepository";
import { GoodsReturnRepository } from "../repositories/GoodsReturnRepository";

export class GoodsReturnNotFoundError extends Error {
  constructor(id: string) {
    super(`Goods Return ${id} tidak ditemukan`);
    this.name = "GoodsReturnNotFoundError";
  }
}

export class GoodsReturnInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoodsReturnInvalidError";
  }
}

interface CreateGoodsReturnServiceInput {
  goodsReceiptId: string;
  reason: "DAMAGED" | "WRONG_SPEC" | "EXCESS" | "OTHER";
  returnedAt?: Date;
  notes?: string | null;
  fotoBukti?: string[];
  returnedById: string;
  tenantId: string | null;
  items: Array<{
    goodsReceiptItemId: string;
    barangId: string;
    quantity: number;
    notes?: string | null;
  }>;
}

/**
 * Service Return to Vendor.
 *
 * Aturan utama:
 * - GRN harus exist dan POSTED
 * - Tenant GRN harus match tenant caller
 * - Setiap item RTV harus reference `goodsReceiptItemId` valid milik GRN ini
 * - `quantity` RTV per item ≤ quantity GRN item dikurangi total yang sudah
 *   diretur sebelumnya
 * - Supplier RTV otomatis disnapshot dari PO terkait GRN
 * - Gudang otomatis ambil dari GRN.gudangId
 */
export class GoodsReturnService {
  constructor(
    private readonly returnRepo: IGoodsReturnRepository = new GoodsReturnRepository(),
    private readonly grnRepo: IGoodsReceiptRepository = new GoodsReceiptRepository(),
  ) {}

  list(filter: GoodsReturnListFilter): Promise<GoodsReturnListResult> {
    return this.returnRepo.list(filter);
  }

  async getById(id: string): Promise<GoodsReturnWithRelations> {
    const ret = await this.returnRepo.findById(id);
    if (!ret) throw new GoodsReturnNotFoundError(id);
    return ret;
  }

  async create(
    input: CreateGoodsReturnServiceInput,
  ): Promise<GoodsReturnEntity> {
    const grn = await this.grnRepo.findById(input.goodsReceiptId);
    if (!grn) {
      throw new GoodsReturnInvalidError(
        `Goods Receipt ${input.goodsReceiptId} tidak ditemukan`,
      );
    }
    if (grn.tenantId !== input.tenantId) {
      throw new GoodsReturnInvalidError(
        "Goods Receipt ini bukan milik tenant Anda",
      );
    }
    if (grn.status !== "POSTED") {
      throw new GoodsReturnInvalidError(
        "Hanya GRN dengan status POSTED yang bisa diretur",
      );
    }

    await this.assertItemsWithinAvailable(grn.id, input.items, grn.items);

    const supplierId = await this.resolveSupplierId(grn.purchaseOrder?.id);
    const rtvNumber = await this.returnRepo.generateRtvNumber(input.tenantId);

    const rtv = await this.returnRepo.createAndSend({
      rtvNumber,
      goodsReceiptId: input.goodsReceiptId,
      supplierId,
      gudangId: grn.gudangId,
      reason: input.reason,
      returnedById: input.returnedById,
      returnedAt: input.returnedAt,
      notes: input.notes ?? null,
      fotoBukti: input.fotoBukti ?? [],
      tenantId: input.tenantId,
      items: input.items.map((it) => ({
        goodsReceiptItemId: it.goodsReceiptItemId,
        barangId: it.barangId,
        quantity: it.quantity,
        notes: it.notes ?? null,
      })),
    });

    if (input.tenantId) {
      eventBus
        .publish(EVENT_NAMES.GOODS_RETURN_SENT, {
          goodsReturnId: rtv.id,
          rtvNumber: rtv.rtvNumber,
          goodsReceiptId: input.goodsReceiptId,
          supplierId,
          gudangId: grn.gudangId,
          reason: input.reason,
          returnedById: input.returnedById,
          returnedAt: (input.returnedAt ?? new Date()).toISOString(),
          tenantId: input.tenantId,
          items: input.items.map((it) => ({
            goodsReturnItemId: "",
            goodsReceiptItemId: it.goodsReceiptItemId,
            barangId: it.barangId,
            quantity: it.quantity,
          })),
        })
        .catch(() => {});
    }

    return rtv;
  }

  async resolve(
    id: string,
    input: GoodsReturnResolveInput,
  ): Promise<GoodsReturnEntity> {
    const existing = await this.returnRepo.findById(id);
    if (!existing) throw new GoodsReturnNotFoundError(id);

    if (existing.status !== "SENT" && existing.status !== "DRAFT") {
      throw new GoodsReturnInvalidError(
        `RTV sudah ${existing.status}, tidak bisa diubah lagi`,
      );
    }
    if (input.status === "CANCELLED" && existing.status === "DRAFT") {
      throw new GoodsReturnInvalidError(
        "RTV DRAFT tidak perlu di-CANCEL, hapus saja",
      );
    }

    return this.returnRepo.resolve(id, input);
  }

  /**
   * Validasi quantity per item ≤ quantity GRN item dikurangi total yang
   * sudah pernah diretur sebelumnya (lewat RTV lain pada GRN yang sama).
   */
  private async assertItemsWithinAvailable(
    grnId: string,
    items: CreateGoodsReturnServiceInput["items"],
    grnItems: GoodsReturnGrnItem[],
  ): Promise<void> {
    const grnItemMap = new Map(grnItems.map((it) => [it.id, it]));
    const previousReturns = await this.returnRepo.list({
      tenantId: null,
      goodsReceiptId: grnId,
      page: 1,
      limit: 100,
    });
    const alreadyReturnedByItem = await this.aggregatePreviousReturns(
      previousReturns.items.map((r) => r.id),
    );

    for (const item of items) {
      const grnItem = grnItemMap.get(item.goodsReceiptItemId);
      if (!grnItem) {
        throw new GoodsReturnInvalidError(
          `Item ${item.goodsReceiptItemId} bukan bagian dari GRN ini`,
        );
      }
      if (grnItem.barangId !== item.barangId) {
        throw new GoodsReturnInvalidError(
          "Barang RTV tidak cocok dengan item GRN",
        );
      }
      const previouslyReturned =
        alreadyReturnedByItem.get(item.goodsReceiptItemId) ?? 0;
      const available = grnItem.quantity - previouslyReturned;
      if (item.quantity > available) {
        throw new GoodsReturnInvalidError(
          `Quantity retur untuk item ini melebihi tersedia (sisa: ${available})`,
        );
      }
    }
  }

  private async aggregatePreviousReturns(
    rtvIds: string[],
  ): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    for (const id of rtvIds) {
      const detail = await this.returnRepo.findById(id);
      if (!detail) continue;
      if (detail.status === "CANCELLED") continue;
      for (const item of detail.items) {
        const current = result.get(item.goodsReceiptItemId) ?? 0;
        result.set(item.goodsReceiptItemId, current + item.quantity);
      }
    }
    return result;
  }

  private async resolveSupplierId(
    purchaseOrderId: string | undefined,
  ): Promise<string | null> {
    if (!purchaseOrderId) return null;
    // Supplier ID bisa di-resolve via PO; karena GoodsReceipt sudah expose
    // purchaseOrder.id, repository PO tidak perlu di-inject di sini.
    // Return null kalau tidak bisa ditemukan; supplier nullable di RTV
    // (compatible dengan PO tanpa supplier).
    const { prisma } = await import("@/lib/prisma");
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      select: { supplierId: true },
    });
    return po?.supplierId ?? null;
  }
}

interface GoodsReturnGrnItem {
  id: string;
  barangId: string;
  quantity: number;
}
