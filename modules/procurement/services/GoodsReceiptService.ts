import { eventBus } from "@/lib/event-bus";
import { EVENT_NAMES } from "@/lib/event-bus/types";
import type { GoodsReceiptEntity } from "../domain/entities/GoodsReceipt";
import type {
  GoodsReceiptListFilter,
  GoodsReceiptListResult,
  GoodsReceiptWithRelations,
  IGoodsReceiptRepository,
} from "../domain/ports/IGoodsReceiptRepository";
import type {
  IPurchaseOrderRepository,
  PurchaseOrderItemWithBarang,
  PurchaseOrderWithRelations,
} from "../domain/ports/IPurchaseOrderRepository";
import { GoodsReceiptRepository } from "../repositories/GoodsReceiptRepository";
import { PurchaseOrderRepository } from "../repositories/PurchaseOrderRepository";
import { PurchaseOrderNotFoundError } from "./PurchaseOrderService";
import { GoodsReceiptRestockOrderError } from "../domain/goods-receipt-errors";

export {
  GoodsReceiptExceedsPurchasedError,
  GoodsReceiptRestockOrderError,
  RESTOCK_ORDER_RECEIPT_MESSAGE,
} from "../domain/goods-receipt-errors";

export class GoodsReceiptNotFoundError extends Error {
  constructor(id: string) {
    super(`Goods Receipt ${id} tidak ditemukan`);
    this.name = "GoodsReceiptNotFoundError";
  }
}

export class GoodsReceiptInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoodsReceiptInvalidError";
  }
}

interface CreateGoodsReceiptServiceInput {
  purchaseOrderId: string;
  gudangId: string;
  receivedAt?: Date;
  notes?: string | null;
  fotoBukti?: string[];
  receivedById: string;
  tenantId: string | null;
  items: Array<{
    purchaseOrderItemId: string;
    barangId: string;
    quantity: number;
    notes?: string | null;
  }>;
  /** Lihat `GoodsReceiptCreateInput.isLimitedToPurchased`. */
  isLimitedToPurchased?: boolean;
}

/**
 * Service GRN: validasi business rules sebelum repository menjalankan transaksi.
 *
 * Aturan utama:
 * - PO harus exist dan punya tenantId yang sama dengan caller
 * - Setiap item GRN harus punya `purchaseOrderItemId` yang valid milik PO ini
 * - `quantity` GRN tidak boleh > sisa (quantity − receivedQuantity − cancelledQuantity)
 * - PO yang sudah RECEIVED atau CANCELLED ditolak (cegah barang masuk untuk
 *   sisa yang sudah dinyatakan tidak jadi datang)
 */
export class GoodsReceiptService {
  constructor(
    private readonly grnRepo: IGoodsReceiptRepository = new GoodsReceiptRepository(),
    private readonly poRepo: IPurchaseOrderRepository = new PurchaseOrderRepository(),
  ) {}

  list(filter: GoodsReceiptListFilter): Promise<GoodsReceiptListResult> {
    return this.grnRepo.list(filter);
  }

  async getById(id: string): Promise<GoodsReceiptWithRelations> {
    const grn = await this.grnRepo.findById(id);
    if (!grn) throw new GoodsReceiptNotFoundError(id);
    return grn;
  }

  /**
   * Penerimaan dari halaman Pembelian. Pesanan dari pengajuan restock ditolak:
   * belanjanya dilaporkan lewat link dan barangnya dicatat dari halaman
   * Restock, supaya tahap pembelian tidak terlewati. `create()` sendiri tetap
   * menerima pesanan restock karena dipakai alur restock.
   */
  async createFromProcurementPage(
    input: CreateGoodsReceiptServiceInput,
  ): Promise<GoodsReceiptEntity> {
    const linkedRestockRequestCount =
      await this.poRepo.countLinkedRestockRequests(input.purchaseOrderId);
    if (linkedRestockRequestCount > 0) {
      throw new GoodsReceiptRestockOrderError();
    }
    return this.create(input);
  }

  /** Buat GRN untuk pesanan apa pun yang lolos aturan sisa pesanan. */
  async create(
    input: CreateGoodsReceiptServiceInput,
  ): Promise<GoodsReceiptEntity> {
    const po = await this.poRepo.findByIdWithRelations(input.purchaseOrderId);
    if (!po) {
      throw new PurchaseOrderNotFoundError(input.purchaseOrderId);
    }
    this.assertPoEligible(po, input.tenantId);
    this.assertItemsWithinRemaining(po.items, input.items);

    const grnNumber = await this.grnRepo.generateGrnNumber(input.tenantId);

    const grn = await this.grnRepo.createAndPost({
      grnNumber,
      purchaseOrderId: input.purchaseOrderId,
      gudangId: input.gudangId,
      receivedById: input.receivedById,
      receivedAt: input.receivedAt,
      notes: input.notes ?? null,
      fotoBukti: input.fotoBukti ?? [],
      tenantId: input.tenantId,
      isLimitedToPurchased: input.isLimitedToPurchased ?? false,
      items: input.items.map((it) => ({
        purchaseOrderItemId: it.purchaseOrderItemId,
        barangId: it.barangId,
        quantity: it.quantity,
        notes: it.notes ?? null,
      })),
    });

    if (input.tenantId) {
      const itemsPayload = input.items.map((it) => {
        const poItem = po.items.find((pi) => pi.id === it.purchaseOrderItemId);
        return {
          goodsReceiptItemId: "",
          purchaseOrderItemId: it.purchaseOrderItemId,
          barangId: it.barangId,
          quantity: it.quantity,
          unitPrice: String(poItem?.unitPrice ?? 0),
        };
      });
      const totalAmount = itemsPayload
        .reduce((sum, it) => sum + Number(it.unitPrice) * it.quantity, 0)
        .toString();
      eventBus
        .publish(EVENT_NAMES.GOODS_RECEIPT_CREATED, {
          goodsReceiptId: grn.id,
          grnNumber: grn.grnNumber,
          purchaseOrderId: po.id,
          poNumber: po.poNumber,
          gudangId: input.gudangId,
          receivedById: input.receivedById,
          receivedAt: (input.receivedAt ?? new Date()).toISOString(),
          tenantId: input.tenantId,
          fotoBukti: input.fotoBukti ?? [],
          items: itemsPayload,
          totalAmount,
          ppnAmount: String(po.ppnAmount ?? 0),
          vendorNpwp: po.vendorNpwp ?? null,
          fakturPajakNo: po.fakturPajakNo ?? null,
          fakturPajakDate: po.fakturPajakDate
            ? new Date(po.fakturPajakDate).toISOString()
            : null,
        })
        .catch(() => {});
    }

    return grn;
  }

  private assertPoEligible(
    po: PurchaseOrderWithRelations,
    tenantId: string | null,
  ): void {
    if (po.tenantId !== tenantId) {
      throw new GoodsReceiptInvalidError(
        "Purchase Order ini bukan milik tenant Anda",
      );
    }
    if (po.status === "CANCELLED") {
      throw new GoodsReceiptInvalidError(
        "Pesanan ini sudah dibatalkan, jadi barangnya tidak bisa dicatat datang.",
      );
    }
    if (po.status === "RECEIVED") {
      throw new GoodsReceiptInvalidError(
        "Pesanan ini sudah selesai, jadi barangnya tidak bisa dicatat datang lagi.",
      );
    }
    const hasRemaining = po.items.some((it) => getRemainingQuantity(it) > 0);
    if (!hasRemaining) {
      throw new GoodsReceiptInvalidError(
        "Semua barang di pesanan ini sudah datang atau tidak jadi datang. Tidak ada sisa yang bisa dicatat.",
      );
    }
  }

  private assertItemsWithinRemaining(
    poItems: PurchaseOrderItemWithBarang[],
    grnItems: CreateGoodsReceiptServiceInput["items"],
  ): void {
    const itemMap = new Map(poItems.map((it) => [it.id, it]));
    for (const grnItem of grnItems) {
      const poItem = itemMap.get(grnItem.purchaseOrderItemId);
      if (!poItem) {
        throw new GoodsReceiptInvalidError(
          `Item ${grnItem.purchaseOrderItemId} tidak ada di Purchase Order`,
        );
      }
      if (poItem.barangId !== grnItem.barangId) {
        throw new GoodsReceiptInvalidError(
          "Barang GRN tidak cocok dengan barang di item PO",
        );
      }
      const remaining = getRemainingQuantity(poItem);
      if (grnItem.quantity > remaining) {
        const barangNama = poItem.barang?.nama ?? grnItem.barangId;
        throw new GoodsReceiptInvalidError(
          `Jumlah ${barangNama} melebihi sisa yang masih ditunggu: ${remaining}`,
        );
      }
    }
  }
}

/** Sisa yang masih ditunggu = dipesan − sudah datang − tidak jadi datang. */
function getRemainingQuantity(item: PurchaseOrderItemWithBarang): number {
  return item.quantity - item.receivedQuantity - (item.cancelledQuantity ?? 0);
}
