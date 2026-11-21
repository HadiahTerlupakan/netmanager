import { randomUUID } from "crypto";
import { PurchaseRequestStatus, Prisma } from "@prisma/client";

import type { IRestockRequestDeletionRepository } from "../domain/ports/IRestockRequestDeletionRepository";
import {
  RESTOCK_EDITABLE_STATUSES,
  RestockRequestNotEditableError,
} from "../domain/restock-request-errors";
import { RESTOCK_JASA_DONE_STATUS } from "../domain/restock-request-status";
import {
  PURCHASE_ORDER_PROGRESS_SELECT,
  toRestockReadModel,
} from "./restock-request-read-model";

type PrismaClientLike = Prisma.TransactionClient;

const BARANG_SUMMARY_SELECT = {
  id: true,
  nama: true,
  kode: true,
  satuan: true,
} as const;

/** Relasi yang dibutuhkan untuk menghitung status pengajuan di daftar. */
const PURCHASE_REQUEST_LIST_INCLUDE = {
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
  purchaseOrder: { select: PURCHASE_ORDER_PROGRESS_SELECT },
} satisfies Prisma.PurchaseRequestInclude;

export class InventoryPurchaseRequestRepository implements IRestockRequestDeletionRepository {
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
      include: PURCHASE_REQUEST_LIST_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    return requests.map((request) => toRestockReadModel(request));
  }

  /**
   * Satu halaman daftar pengajuan restock, terbaru dulu, untuk aplikasi
   * mobile. Isinya sama dengan {@link findPurchaseRequests} supaya status yang
   * dihitung darinya sama dengan di halaman admin. `cursor` adalah id
   * pengajuan terakhir halaman sebelumnya; `siteIds` berlaku seperti di sana.
   */
  async findPurchaseRequestPage(input: {
    tenantId: string;
    siteIds?: string[];
    limit: number;
    cursor?: string | null;
  }) {
    const requests = await this.db.purchaseRequest.findMany({
      where: {
        tenantId: input.tenantId,
        ...(input.siteIds
          ? { gudang: { sites: { some: { id: { in: input.siteIds } } } } }
          : {}),
      },
      include: PURCHASE_REQUEST_LIST_INCLUDE,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      // Satu baris lebih untuk tahu apakah masih ada halaman berikutnya.
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    });
    const hasMore = requests.length > input.limit;
    const page = requests.slice(0, input.limit);
    return {
      items: page.map((request) => toRestockReadModel(request)),
      nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    };
  }

  /**
   * Stok terkini gudang tujuan sebuah pengajuan, untuk bahan pertimbangan
   * approver: semua barang yang tercatat di gudang itu (supaya barang
   * pengganti ikut tercakup) beserta batas minimumnya. Null bila pengajuan
   * tidak ada di tenant ini.
   */
  async findApprovalStock(input: { id: string; tenantId: string }) {
    const request = await this.db.purchaseRequest.findUnique({
      where: { id: input.id, tenantId: input.tenantId },
      select: { gudangId: true, gudang: { select: { nama: true } } },
    });
    if (!request) return null;

    const [stocks, settings] = await Promise.all([
      this.db.barangGudang.findMany({
        where: { gudangId: request.gudangId, tenantId: input.tenantId },
        select: {
          barangId: true,
          stok: true,
          stokBaru: true,
          stokBekas: true,
          stokRusak: true,
          barang: { select: { minStokDefault: true } },
        },
      }),
      this.db.restockSettings.findMany({
        where: {
          gudangId: request.gudangId,
          tenantId: input.tenantId,
          isActive: true,
        },
        select: { barangId: true, minStok: true },
      }),
    ]);
    return {
      gudangId: request.gudangId,
      gudangName: request.gudang?.nama ?? null,
      stocks,
      settings,
    };
  }

  /** Ambil purchase request milik tenant tertentu. */
  async findPurchaseRequestById(input: { id: string; tenantId: string }) {
    return this.db.purchaseRequest.findUnique({
      where: { id: input.id, tenantId: input.tenantId },
    });
  }

  /**
   * Perbarui item purchase request yang belum diputuskan dan belum punya pesanan.
   *
   * Baris PR diklaim dulu (updateMany bersyarat status dan tanpa pesanan)
   * sebelum item disentuh: keputusan approver yang masuk setelah pemohon membuka
   * form tidak boleh tertimpa, dan urutan kunci (PR lalu item) sama dengan
   * transaksi approval sehingga keduanya tidak saling deadlock. Melempar
   * {@link RestockRequestNotEditableError} bila pengajuan sudah diputuskan atau
   * sudah punya pesanan.
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
          purchaseOrderId: null,
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

  /**
   * Hapus pengajuan beserta barisnya (cascade) dengan satu DELETE bersyarat.
   * Syarat `purchaseOrderId: null` ada di baris pengajuan sendiri, jadi
   * pesanan yang dibuat bersamaan (persetujuan, Generate PO, Masukkan Barang)
   * membuat penghapusan ini tidak mengenai apa pun. True bila terhapus.
   */
  async deletePurchaseRequestIfDeletable(
    id: string,
    tenantId: string,
  ): Promise<boolean> {
    const result = await this.db.purchaseRequest.deleteMany({
      where: {
        id,
        tenantId,
        purchaseOrderId: null,
        status: { not: "RECEIVED" },
        jasaItems: {
          none: {
            statusKonfirmasi: RESTOCK_JASA_DONE_STATUS,
            statusApproval: { not: "REJECTED" },
          },
        },
      },
    });
    return result.count === 1;
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
        purchaseOrder: { select: PURCHASE_ORDER_PROGRESS_SELECT },
      },
    });
    return request ? toRestockReadModel(request) : null;
  }
}
