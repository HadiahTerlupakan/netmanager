import { randomUUID } from "crypto";
import { PurchaseRequestStatus, Prisma } from "@prisma/client";

import {
  RESTOCK_EDITABLE_STATUSES,
  RestockRequestNotEditableError,
} from "../domain/restock-request-errors";
import {
  PURCHASE_ORDER_PROGRESS_INCLUDE,
  toRestockReadModel,
} from "./restock-request-read-model";

type PrismaClientLike = Prisma.TransactionClient;

const BARANG_SUMMARY_SELECT = {
  id: true,
  nama: true,
  kode: true,
  satuan: true,
} as const;

export class InventoryPurchaseRequestRepository {
  constructor(private readonly db: PrismaClientLike) {}

  /**
   * Ambil daftar purchase request restock.
   *
   * `siteIds` membatasi hasil ke gudang milik site tersebut. `PurchaseRequest`
   * tidak punya `siteId` sendiri — dimensi site-nya lewat relasi M2M
   * `Gudang.sites`. Daftar kosong berarti "tidak ada gudang yang cocok", bukan
   * "tanpa pembatasan": pemanggil yang tidak membatasi cukup tidak mengirim
   * `siteIds` sama sekali.
   */
  async findPurchaseRequests(input: {
    tenantId: string;
    status?: string | null;
    siteIds?: string[];
  }) {
    const requests = await this.db.purchaseRequest.findMany({
      where: {
        tenantId: input.tenantId,
        ...(input.status
          ? { status: input.status as PurchaseRequestStatus }
          : {}),
        ...(input.siteIds
          ? { gudang: { sites: { some: { id: { in: input.siteIds } } } } }
          : {}),
      },
      include: {
        items: {
          include: {
            barang: true,
            barangDiminta: { select: BARANG_SUMMARY_SELECT },
          },
        },
        jasaItems: { include: { jasa: true } },
        requester: { select: { name: true } },
        approver: { select: { name: true } },
        gudang: { select: { nama: true, id: true } },
        purchaseOrder: { include: PURCHASE_ORDER_PROGRESS_INCLUDE },
      },
      orderBy: { createdAt: "desc" },
    });
    return requests.map((request) => toRestockReadModel(request));
  }

  /** Ambil purchase request milik tenant tertentu. */
  async findPurchaseRequestById(input: { id: string; tenantId: string }) {
    return this.db.purchaseRequest.findUnique({
      where: { id: input.id, tenantId: input.tenantId },
    });
  }

  /**
   * Perbarui item purchase request draft/submitted.
   *
   * Baris PR diklaim dulu (updateMany bersyarat status) sebelum item disentuh:
   * keputusan approver yang masuk setelah pemohon membuka form tidak boleh
   * tertimpa, dan urutan kunci (PR lalu item) sama dengan transaksi approval
   * sehingga keduanya tidak saling deadlock. Melempar
   * {@link RestockRequestNotEditableError} bila pengajuan sudah diputuskan.
   */
  async updatePurchaseRequest(input: {
    id: string;
    tenantId: string;
    gudangId: string;
    keterangan?: string;
    items: Array<{
      barangId: string;
      quantity: number;
      keterangan?: string | null;
    }>;
    jasaItems?: Array<{
      jasaId: string;
      jumlah: number;
      hargaPerUnit?: number;
      keterangan?: string | null;
    }>;
  }) {
    return this.db.$transaction(async (tx) => {
      const claimed = await tx.purchaseRequest.updateMany({
        where: {
          id: input.id,
          tenantId: input.tenantId,
          status: { in: [...RESTOCK_EDITABLE_STATUSES] },
        },
        data: {
          gudangId: input.gudangId,
          keterangan: input.keterangan,
        },
      });
      if (claimed.count === 0) {
        const current = await tx.purchaseRequest.findFirst({
          where: { id: input.id, tenantId: input.tenantId },
          select: { status: true },
        });
        throw new RestockRequestNotEditableError(current?.status ?? null);
      }
      await tx.purchaseRequestItem.deleteMany({
        where: { purchaseRequestId: input.id },
      });
      await tx.purchaseRequestJasaItem.deleteMany({
        where: { purchaseRequestId: input.id },
      });

      if (input.items.length > 0) {
        await tx.purchaseRequestItem.createMany({
          data: input.items.map((item) => ({
            id: randomUUID(),
            purchaseRequestId: input.id,
            barangId: item.barangId,
            jumlah: item.quantity,
            keterangan: item.keterangan || null,
            hargaPerUnit: 0,
            totalHarga: 0,
            tenantId: input.tenantId,
          })),
        });
      }

      if (input.jasaItems && input.jasaItems.length > 0) {
        await tx.purchaseRequestJasaItem.createMany({
          data: input.jasaItems.map((item) => {
            const hargaPerUnit = Number(item.hargaPerUnit) || 0;
            return {
              id: randomUUID(),
              purchaseRequestId: input.id,
              jasaId: item.jasaId,
              jumlah: item.jumlah,
              hargaPerUnit,
              totalHarga: hargaPerUnit * item.jumlah,
              keterangan: item.keterangan || null,
              statusKonfirmasi: "PENDING",
              tenantId: input.tenantId,
            };
          }),
        });
      }

      return tx.purchaseRequest.findUnique({
        where: { id: input.id },
        include: { items: true, jasaItems: { include: { jasa: true } } },
      });
    });
  }

  /** Hapus purchase request. */
  async deletePurchaseRequest(id: string) {
    await this.db.purchaseRequest.delete({ where: { id } });
  }

  /** Ambil detail purchase request restock milik tenant beserta keputusan per baris. */
  async findPurchaseRequestDetail(id: string, tenantId: string) {
    const request = await this.db.purchaseRequest.findFirst({
      where: { id, tenantId },
      include: {
        requester: { select: { name: true, email: true } },
        approver: { select: { name: true } },
        gudang: { select: { nama: true, kode: true } },
        items: {
          include: {
            barang: { select: BARANG_SUMMARY_SELECT },
            barangDiminta: { select: BARANG_SUMMARY_SELECT },
          },
        },
        jasaItems: {
          include: {
            jasa: {
              select: {
                id: true,
                kode: true,
                nama: true,
                satuan: true,
                hargaEstimasi: true,
              },
            },
          },
        },
        purchaseOrder: {
          select: {
            id: true,
            poNumber: true,
            status: true,
            issuedAt: true,
            paymentStatus: true,
            ...PURCHASE_ORDER_PROGRESS_INCLUDE,
          },
        },
      },
    });
    return request ? toRestockReadModel(request) : null;
  }

  /** True bila PO ini sudah punya GRN atau ada barang yang tercatat datang. */
  async hasArrivedGoods(purchaseOrderId: string): Promise<boolean> {
    const [goodsReceiptCount, receivedItemCount] = await Promise.all([
      this.db.goodsReceipt.count({ where: { purchaseOrderId } }),
      this.db.purchaseOrderItem.count({
        where: { purchaseOrderId, receivedQuantity: { gt: 0 } },
      }),
    ]);
    return goodsReceiptCount > 0 || receivedItemCount > 0;
  }

  /**
   * True bila pesanan ini sudah punya catatan belanja (yang tidak dibatalkan)
   * atau jumlah dibeli.
   */
  async hasPurchaseRecords(purchaseOrderId: string): Promise<boolean> {
    const [purchaseRecordCount, purchasedItemCount] = await Promise.all([
      this.db.purchaseRecord.count({
        where: { purchaseOrderId, voidedAt: null },
      }),
      this.db.purchaseOrderItem.count({
        where: { purchaseOrderId, purchasedQuantity: { gt: 0 } },
      }),
    ]);
    return purchaseRecordCount > 0 || purchasedItemCount > 0;
  }
}
