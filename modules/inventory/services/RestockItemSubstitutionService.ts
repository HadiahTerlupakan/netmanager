import { logger } from "@/lib/logger";

import type {
  IRestockGoodsReceiptRepository,
  RestockPurchaseOrderItem,
} from "../domain/ports/IRestockGoodsReceiptRepository";

/** Map barang yang dipesan (barangId asli) → barang pengganti yang benar-benar datang. */
export type RestockSubstitutionMap = Record<string, string>;

export interface ApplyRestockSubstitutionInput {
  purchaseOrderId: string;
  purchaseOrderItems: RestockPurchaseOrderItem[];
  substitutions: RestockSubstitutionMap;
  tenantId: string;
  actorId: string;
  referenceNumber: string;
}

interface ResolvedSubstitution {
  purchaseOrderItemId: string;
  fromBarangId: string;
  toBarangId: string;
}

export class RestockSubstitutionInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RestockSubstitutionInvalidError";
  }
}

/**
 * Substitusi barang saat verifikasi kedatangan: barang yang sampai bisa berbeda
 * dari yang dipesan (supplier mengirim merek/tipe lain).
 *
 * Aturan:
 * - Barang asli harus ada di Purchase Order terkait
 * - Item yang sudah pernah diterima sebagian tidak boleh diganti (jejak stok terlanjur tercatat)
 * - Barang pengganti harus milik tenant yang sama dan belum dipakai item lain di PO ini
 * - Harga per unit tetap mengikuti PO; koreksi harga dilakukan lewat edit Purchase Order
 */
export class RestockItemSubstitutionService {
  constructor(private readonly repository: IRestockGoodsReceiptRepository) {}

  /**
   * Terapkan substitusi barang pada PO dan PR terkait.
   * Mengembalikan map barang asli → barang pengganti yang benar-benar diterapkan.
   */
  async apply(
    input: ApplyRestockSubstitutionInput,
  ): Promise<RestockSubstitutionMap> {
    const requested = this.parseRequestedSubstitutions(input.substitutions);
    if (requested.length === 0) return {};

    const resolved = this.resolveAgainstPurchaseOrder(
      requested,
      input.purchaseOrderItems,
    );
    await this.assertReplacementBarangsExist(resolved, input.tenantId);

    await this.repository.applyItemSubstitutions({
      purchaseOrderId: input.purchaseOrderId,
      tenantId: input.tenantId,
      substitutions: resolved,
    });

    await this.logSubstitution(resolved, input);

    return Object.fromEntries(
      resolved.map((item) => [item.fromBarangId, item.toBarangId]),
    );
  }

  private parseRequestedSubstitutions(
    substitutions: RestockSubstitutionMap,
  ): Array<{ fromBarangId: string; toBarangId: string }> {
    return Object.entries(substitutions ?? {})
      .filter(
        ([fromBarangId, toBarangId]) =>
          typeof toBarangId === "string" &&
          toBarangId.length > 0 &&
          toBarangId !== fromBarangId,
      )
      .map(([fromBarangId, toBarangId]) => ({ fromBarangId, toBarangId }));
  }

  private resolveAgainstPurchaseOrder(
    requested: Array<{ fromBarangId: string; toBarangId: string }>,
    purchaseOrderItems: RestockPurchaseOrderItem[],
  ): ResolvedSubstitution[] {
    const usedBarangIds = new Set(
      purchaseOrderItems.map((item) => item.barangId),
    );
    const resolved: ResolvedSubstitution[] = [];

    for (const substitution of requested) {
      const purchaseOrderItem = purchaseOrderItems.find(
        (item) => item.barangId === substitution.fromBarangId,
      );
      if (!purchaseOrderItem) {
        throw new RestockSubstitutionInvalidError(
          "Barang yang mau diganti tidak ada di pesanan ini. Muat ulang halaman, lalu coba lagi.",
        );
      }
      if (purchaseOrderItem.receivedQuantity > 0) {
        throw new RestockSubstitutionInvalidError(
          `${this.describeItem(purchaseOrderItem)} sudah pernah diterima sebagian, jadi tidak bisa diganti dengan barang lain. Terima sisanya dengan barang yang sama.`,
        );
      }
      if (usedBarangIds.has(substitution.toBarangId)) {
        throw new RestockSubstitutionInvalidError(
          "Barang pengganti sudah ada di pesanan ini. Jangan diganti — ubah saja jumlah barang itu.",
        );
      }

      usedBarangIds.delete(substitution.fromBarangId);
      usedBarangIds.add(substitution.toBarangId);
      resolved.push({
        purchaseOrderItemId: purchaseOrderItem.id,
        fromBarangId: substitution.fromBarangId,
        toBarangId: substitution.toBarangId,
      });
    }

    return resolved;
  }

  private async assertReplacementBarangsExist(
    resolved: ResolvedSubstitution[],
    tenantId: string,
  ): Promise<void> {
    const replacementIds = resolved.map((item) => item.toBarangId);
    const candidates = await this.repository.findBarangCandidates(
      replacementIds,
      tenantId,
    );
    const foundIds = new Set(candidates.map((candidate) => candidate.id));
    const missing = replacementIds.find((id) => !foundIds.has(id));
    if (missing) {
      throw new RestockSubstitutionInvalidError(
        "Barang pengganti tidak ditemukan di daftar barang. Mungkin sudah dihapus. Pilih barang pengganti lain.",
      );
    }
  }

  private describeItem(purchaseOrderItem: RestockPurchaseOrderItem): string {
    return purchaseOrderItem.barang?.nama ?? "Barang";
  }

  private async logSubstitution(
    resolved: ResolvedSubstitution[],
    input: ApplyRestockSubstitutionInput,
  ): Promise<void> {
    await logger.logActivity({
      userId: input.actorId,
      tenantId: input.tenantId,
      action: "SUBSTITUTE RestockItem",
      subject: input.referenceNumber,
      details: {
        purchaseOrderId: input.purchaseOrderId,
        substitutions: resolved,
      },
    });
  }
}
