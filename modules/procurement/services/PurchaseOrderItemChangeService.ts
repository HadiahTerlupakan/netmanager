import { logger } from "@/lib/logger";
import { ApprovalThresholdRepository } from "../repositories/ApprovalThresholdRepository";
import { PurchaseOrderItemChangeRepository } from "../repositories/PurchaseOrderItemChangeRepository";
import type {
  IPurchaseOrderItemChangeRepository,
  PurchaseOrderForItemChange,
  PurchaseOrderItemAddition,
  PurchaseOrderItemChangeResult,
  PurchaseOrderItemForChange,
  PurchaseOrderStatusValue,
} from "../domain/ports/IPurchaseOrderItemChangeRepository";
import { ApprovalThresholdService } from "./ApprovalThresholdService";
import {
  PurchaseOrderNotEditableError,
  PurchaseOrderNotFoundError,
} from "./PurchaseOrderService";

const STATUSES_OPEN_FOR_CHANGE: PurchaseOrderStatusValue[] = [
  "DRAFT",
  "ORDERED",
  "PARTIAL",
];
const MIN_LINE_QUANTITY = 1;

export class PurchaseOrderItemChangeInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PurchaseOrderItemChangeInvalidError";
  }
}

export interface ChangePurchaseOrderItemsInput {
  purchaseOrderId: string;
  tenantId: string | null;
  actorId: string;
  actorRoleIds: string[];
  reason: string;
  changes: Array<{ id: string; quantity: number }>;
  additions: PurchaseOrderItemAddition[];
}

interface ResolvedQuantityChange {
  item: PurchaseOrderItemForChange;
  quantity: number;
}

/**
 * Ubah isi PO yang sudah dipesan (change order): kurangi jumlah baris yang
 * belum datang semua, atau tambah barang baru dengan harganya sendiri. Dipakai
 * saat supplier mengganti sebagian pesanan, misalnya 4000 m kabel 4 core
 * menjadi 2000 m 4 core dan 2000 m 2 core.
 *
 * Harga satuan baris lama tidak diubah di sini; itu tetap lewat edit PO.
 */
export class PurchaseOrderItemChangeService {
  constructor(
    private readonly repository: IPurchaseOrderItemChangeRepository = new PurchaseOrderItemChangeRepository(),
    private readonly approvalThresholdService: Pick<
      ApprovalThresholdService,
      "assertCanApprove"
    > = new ApprovalThresholdService(new ApprovalThresholdRepository()),
  ) {}

  async changeItems(
    input: ChangePurchaseOrderItemsInput,
  ): Promise<PurchaseOrderItemChangeResult> {
    const po = await this.repository.findForItemChange(input.purchaseOrderId);
    if (!po) throw new PurchaseOrderNotFoundError(input.purchaseOrderId);
    const quantityChanges = this.assertChangeAllowed(po, input);
    const barangNames = await this.findAdditionNames(input);
    await this.assertWithinApprovalLimit(po, quantityChanges, input);

    const result = await this.repository.applyItemChange(
      {
        purchaseOrderId: po.id,
        poNumber: po.poNumber,
        tenantId: po.tenantId,
        actorId: input.actorId,
        quantityChanges: quantityChanges.map(({ item, quantity }) => ({
          purchaseOrderItemId: item.id,
          quantity,
        })),
        additions: input.additions,
        purchaseRequestId: po.purchaseRequestIds[0] ?? null,
      },
      // Diulang di dalam transaksi terhadap PO yang sudah dikunci, karena
      // penerimaan barang atau perubahan lain (yang ikut menaikkan grand
      // total) bisa masuk di antara pembacaan pertama dan penulisan.
      async (locked) => {
        const lockedChanges = this.assertChangeAllowed(locked, input);
        await this.assertWithinApprovalLimit(locked, lockedChanges, input);
      },
    );

    await logger.logActivity({
      userId: input.actorId,
      tenantId: input.tenantId,
      action: "CHANGE_ITEMS PurchaseOrder",
      subject: po.poNumber,
      details: {
        purchaseOrderId: po.id,
        alasan: input.reason,
        perubahanJumlah: quantityChanges.map(({ item, quantity }) => ({
          barang: item.barangName,
          dari: item.quantity,
          menjadi: quantity,
        })),
        barangTambahan: input.additions.map((addition) => ({
          barang: barangNames.get(addition.barangId),
          jumlah: addition.quantity,
          hargaSatuan: addition.unitPrice,
        })),
        grandTotalSebelum: po.grandTotal,
        grandTotalSesudah: result.grandTotal,
      },
    });

    return result;
  }

  /** Aturan perubahan; mengembalikan baris yang jumlahnya benar-benar berubah. */
  private assertChangeAllowed(
    po: PurchaseOrderForItemChange,
    input: ChangePurchaseOrderItemsInput,
  ): ResolvedQuantityChange[] {
    if (po.tenantId !== input.tenantId) {
      throw new PurchaseOrderNotFoundError(input.purchaseOrderId);
    }
    if (!STATUSES_OPEN_FOR_CHANGE.includes(po.status)) {
      throw new PurchaseOrderNotEditableError(
        "Isi PO yang sudah diterima penuh atau dibatalkan tidak bisa diubah",
      );
    }
    const quantityChanges = this.resolveQuantityChanges(po, input.changes);
    this.assertAdditionsAllowed(po, input.additions);
    if (quantityChanges.length === 0 && input.additions.length === 0) {
      throw new PurchaseOrderItemChangeInvalidError(
        "Tidak ada perubahan isi pesanan",
      );
    }
    return quantityChanges;
  }

  private resolveQuantityChanges(
    po: PurchaseOrderForItemChange,
    changes: ChangePurchaseOrderItemsInput["changes"],
  ): ResolvedQuantityChange[] {
    const seen = new Set<string>();
    const resolved: ResolvedQuantityChange[] = [];

    for (const change of changes) {
      const item = po.items.find((candidate) => candidate.id === change.id);
      if (!item) {
        throw new PurchaseOrderItemChangeInvalidError(
          "Item tidak ada di Purchase Order ini",
        );
      }
      if (seen.has(item.id)) {
        throw new PurchaseOrderItemChangeInvalidError(
          `${item.barangName} diubah lebih dari sekali`,
        );
      }
      seen.add(item.id);
      this.assertQuantityAllowed(item, change.quantity);
      if (change.quantity !== item.quantity) {
        resolved.push({ item, quantity: change.quantity });
      }
    }
    return resolved;
  }

  private assertQuantityAllowed(
    item: PurchaseOrderItemForChange,
    quantity: number,
  ): void {
    const settled = item.receivedQuantity + item.cancelledQuantity;
    const minimum = Math.max(MIN_LINE_QUANTITY, settled);
    if (Number.isInteger(quantity) && quantity >= minimum) return;

    if (settled < MIN_LINE_QUANTITY) {
      throw new PurchaseOrderItemChangeInvalidError(
        `Jumlah ${item.barangName} minimal ${MIN_LINE_QUANTITY}. Anulir lewat verifikasi barang bila tidak jadi dipesan`,
      );
    }
    const cancelled =
      item.cancelledQuantity > 0
        ? ` dan dianulir ${item.cancelledQuantity}`
        : "";
    throw new PurchaseOrderItemChangeInvalidError(
      `Jumlah ${item.barangName} minimal ${minimum} karena sudah diterima ${item.receivedQuantity}${cancelled}`,
    );
  }

  private assertAdditionsAllowed(
    po: PurchaseOrderForItemChange,
    additions: PurchaseOrderItemAddition[],
  ): void {
    const barangIds = additions.map((addition) => addition.barangId);
    if (new Set(barangIds).size !== barangIds.length) {
      throw new PurchaseOrderItemChangeInvalidError(
        "Barang tambahan tidak boleh dobel",
      );
    }
    for (const barangId of barangIds) {
      const existing = po.items.find((item) => item.barangId === barangId);
      if (existing) {
        throw new PurchaseOrderItemChangeInvalidError(
          `${existing.barangName} sudah ada di pesanan ini. Ubah jumlahnya, jangan ditambah`,
        );
      }
    }
  }

  /** Mengembalikan nama barang tambahan untuk log aktivitas. */
  private async findAdditionNames(
    input: ChangePurchaseOrderItemsInput,
  ): Promise<Map<string, string>> {
    const barangIds = input.additions.map((addition) => addition.barangId);
    if (barangIds.length === 0) return new Map();

    const barangs = await this.repository.findBarangs(
      barangIds,
      input.tenantId,
    );
    if (barangs.length !== barangIds.length) {
      throw new PurchaseOrderItemChangeInvalidError(
        "Barang tambahan tidak ditemukan pada master barang",
      );
    }
    return new Map(barangs.map((barang) => [barang.id, barang.nama]));
  }

  /**
   * Batas approval yang dipakai saat membuat PO juga berlaku saat perubahan
   * isi menambah nilai pesanan.
   */
  private async assertWithinApprovalLimit(
    po: PurchaseOrderForItemChange,
    quantityChanges: ResolvedQuantityChange[],
    input: ChangePurchaseOrderItemsInput,
  ): Promise<void> {
    const subtotalDelta =
      quantityChanges.reduce(
        (sum, { item, quantity }) =>
          sum + (quantity - item.quantity) * item.unitPrice,
        0,
      ) +
      input.additions.reduce(
        (sum, addition) => sum + addition.quantity * addition.unitPrice,
        0,
      );
    if (subtotalDelta <= 0 || input.actorRoleIds.length === 0) return;

    await this.approvalThresholdService.assertCanApprove({
      tenantId: input.tenantId,
      scope: "PURCHASE_ORDER",
      amount: Math.round(
        po.grandTotal + subtotalDelta * (1 + po.ppnRate / 100),
      ),
      roleIds: input.actorRoleIds,
    });
  }
}
