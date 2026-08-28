import { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/modules/database";

import type {
  ApplyItemSubstitutionInput,
  BarangSubstitutionCandidate,
  IRestockGoodsReceiptRepository,
  RestockPurchaseOrderForReceipt,
  RestockPurchaseRequestForReceipt,
} from "../domain/ports/IRestockGoodsReceiptRepository";

type PrismaClientLike = PrismaClient;

/**
 * Akses data untuk alur verifikasi kedatangan barang restock.
 * Semua query Prisma milik alur ini terpusat di sini agar service tetap bebas ORM.
 */
export class RestockGoodsReceiptRepository implements IRestockGoodsReceiptRepository {
  constructor(private readonly db: PrismaClientLike = prisma) {}

  /** Ambil purchase request restock milik tenant untuk proses penerimaan. */
  async findPurchaseRequestForReceipt(
    id: string,
    tenantId: string,
  ): Promise<RestockPurchaseRequestForReceipt | null> {
    return this.db.purchaseRequest.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        purchaseOrderId: true,
        gudangId: true,
        status: true,
        nomorRequest: true,
      },
    });
  }

  /** Ambil purchase order beserta item-nya untuk validasi penerimaan. */
  async findPurchaseOrderWithItems(
    purchaseOrderId: string,
  ): Promise<RestockPurchaseOrderForReceipt | null> {
    return this.db.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      select: {
        id: true,
        poNumber: true,
        items: {
          select: {
            id: true,
            barangId: true,
            quantity: true,
            receivedQuantity: true,
            barang: { select: { id: true, nama: true } },
          },
        },
      },
    });
  }

  /** Ambil status terkini purchase order. */
  async findPurchaseOrderStatus(
    purchaseOrderId: string,
  ): Promise<string | null> {
    const purchaseOrder = await this.db.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      select: { status: true },
    });
    return purchaseOrder?.status ?? null;
  }

  /** Ambil barang milik tenant sebagai kandidat pengganti. */
  async findBarangCandidates(
    barangIds: string[],
    tenantId: string,
  ): Promise<BarangSubstitutionCandidate[]> {
    if (barangIds.length === 0) return [];
    return this.db.barang.findMany({
      where: { id: { in: barangIds }, tenantId },
      select: { id: true, nama: true },
    });
  }

  /**
   * Ganti barang pada item PO sekaligus item PR terkait dalam satu transaksi
   * agar dokumen pengajuan dan pesanan tetap konsisten.
   */
  async applyItemSubstitutions(
    input: ApplyItemSubstitutionInput,
  ): Promise<void> {
    if (input.substitutions.length === 0) return;

    await this.db.$transaction(async (tx: Prisma.TransactionClient) => {
      for (const substitution of input.substitutions) {
        await tx.purchaseOrderItem.update({
          where: { id: substitution.purchaseOrderItemId },
          data: { barangId: substitution.toBarangId },
        });
        await tx.purchaseRequestItem.updateMany({
          where: {
            barangId: substitution.fromBarangId,
            purchaseRequest: {
              purchaseOrderId: input.purchaseOrderId,
              tenantId: input.tenantId,
            },
          },
          data: { barangId: substitution.toBarangId },
        });
      }
    });
  }

  /** Tandai purchase order sebagai diterima penuh. */
  async markPurchaseOrderReceived(
    purchaseOrderId: string,
    actorId: string,
  ): Promise<void> {
    await this.db.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: { status: "RECEIVED", receivedById: actorId },
    });
  }

  /** Tandai purchase request sebagai diterima. */
  async markPurchaseRequestReceived(purchaseRequestId: string): Promise<void> {
    await this.db.purchaseRequest.update({
      where: { id: purchaseRequestId },
      data: { status: "RECEIVED" },
    });
  }
}
