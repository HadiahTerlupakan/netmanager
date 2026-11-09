/** Kontrak akses data link belanja tanpa login. */

import type { RestockPurchaseContext } from "./IRestockPurchaseRecordRepository";

/** Baris link seperti dibaca dari database (tanpa hash token). */
export interface PurchaseLinkRecord {
  id: string;
  purchaseRequestId: string;
  tenantId: string | null;
  createdById: string;
  expiresAt: Date;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  /** Pembuat link masih aktif; link dari akun nonaktif tidak berlaku. */
  isCreatorActive: boolean;
}

/** Ringkasan link untuk panel admin. */
export interface PurchaseLinkSummary {
  id: string;
  createdAt: Date;
  expiresAt: Date;
  lastUsedAt: Date | null;
  createdByName: string | null;
}

/** Bahan tampilan daftar belanja publik. */
export interface PublicPurchaseListSource {
  context: RestockPurchaseContext;
  warehouseName: string;
  /** Catatan belanja pesanan ini yang tidak dibatalkan, terlama dulu. */
  records: Array<{
    storeName: string;
    purchasedAt: Date;
    items: Array<{ purchaseOrderItemId: string; quantity: number }>;
  }>;
}

export interface IRestockPurchaseLinkRepository {
  /** SATU-SATUNYA query yang boleh jalan di system context. */
  findByTokenHash(tokenHash: string): Promise<PurchaseLinkRecord | null>;

  /** Link yang belum dicabut dan belum kedaluwarsa untuk pengajuan ini. */
  findActiveForRequest(
    purchaseRequestId: string,
    tenantId: string,
    now: Date,
  ): Promise<PurchaseLinkSummary | null>;

  /**
   * Dalam satu transaksi: kunci pengajuan, cabut semua link aktifnya, lalu
   * buat link baru. Menjamin paling banyak satu link aktif per pengajuan.
   */
  replaceActiveLink(input: {
    purchaseRequestId: string;
    tenantId: string;
    tokenHash: string;
    expiresAt: Date;
    createdById: string;
    now: Date;
  }): Promise<PurchaseLinkSummary>;

  /** Cabut semua link aktif pengajuan; mengembalikan jumlah yang dicabut. */
  revokeActiveLinks(
    purchaseRequestId: string,
    tenantId: string,
    revokedById: string,
    now: Date,
  ): Promise<number>;

  /** Perbarui `lastUsedAt`, paling sering sekali per selang throttle. */
  touchLastUsed(linkId: string, tenantId: string, now: Date): Promise<void>;

  /** Pengajuan, nama gudang, dan catatan belanja pesanannya. */
  findPublicListSource(
    purchaseRequestId: string,
    tenantId: string,
  ): Promise<PublicPurchaseListSource | null>;
}
