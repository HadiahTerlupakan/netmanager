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
}

/**
 * Service GRN: validasi business rules sebelum repository menjalankan transaksi.
 *
 * Aturan utama:
 * - PO harus exist dan punya tenantId yang sama dengan caller
 * - Setiap item GRN harus punya `purchaseOrderItemId` yang valid milik PO ini
 * - `quantity` GRN tidak boleh > sisa quantity (PO.quantity - PO.receivedQuantity)
 * - PO yang sudah RECEIVED penuh ditolak (cegah over-receive)
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
        "Purchase Order sudah dibatalkan, tidak bisa menerima barang",
      );
    }
    const hasRemaining = po.items.some(
      (it) => it.quantity > it.receivedQuantity,
    );
    if (!hasRemaining) {
      throw new GoodsReceiptInvalidError(
        "Semua barang di Purchase Order ini sudah diterima penuh",
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
      const remaining = poItem.quantity - poItem.receivedQuantity;
      if (grnItem.quantity > remaining) {
        const barangNama = poItem.barang?.nama ?? grnItem.barangId;
        throw new GoodsReceiptInvalidError(
          `Quantity ${barangNama} melebihi sisa: ${remaining}`,
        );
      }
    }
  }
}
