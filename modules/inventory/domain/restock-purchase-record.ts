/**
 * Aturan murni catatan belanja restock (satu kali belanja di satu toko).
 * Tanpa I/O: dipakai service untuk memeriksa isian sebelum ditulis.
 */

import type {
  CreatePurchaseRecordLine,
  RestockPurchaseContext,
  RestockPurchaseContextItem,
} from "./ports/IRestockPurchaseRecordRepository";

/** Pesan untuk petugas; tanpa istilah teknis. */
export const RESTOCK_PURCHASE_MESSAGES = {
  notPartOfRequest:
    "Ada barang yang bukan bagian pengajuan ini. Muat ulang halaman, lalu coba lagi.",
  supplierNotFound:
    "Toko yang dipilih tidak ditemukan. Pilih lagi atau kosongkan.",
  futureDate: "Tanggal belanja tidak boleh di hari yang akan datang.",
  untrustedPhoto: "Foto nota tidak terbaca. Hapus fotonya, lalu unggah ulang.",
  closed:
    "Pesanan ini sudah selesai atau dibatalkan, jadi belanjanya tidak bisa dicatat lagi. Muat ulang halaman.",
  conflict:
    "Pesanan ini baru saja diubah orang lain, jadi belanjanya belum disimpan. Muat ulang halaman, lalu cek lagi.",
  savedAll:
    "Tersimpan. Semua barang sudah dibeli. Sekarang tunggu barangnya datang.",
  savedPartial: (storeName: string) =>
    `Tersimpan. Belanja di ${storeName} sudah dicatat. Masih ada barang yang belum dibeli.`,
  fullyPurchased: (nama: string) => `${nama} sudah dibeli semua.`,
  recordNotFound: "Catatan belanja tidak ditemukan. Muat ulang halaman.",
  alreadyVoided:
    "Catatan belanja ini sudah dibatalkan sebelumnya. Muat ulang halaman.",
  voidSharedRecord:
    "Belanja ini juga berisi barang pengajuan lain yang digabung dalam satu pesanan. Batalkan dari pengajuan yang memiliki semua barangnya.",
  voidClosed:
    "Pesanan ini sudah selesai atau dibatalkan, jadi catatan belanjanya tidak bisa dibatalkan lagi.",
  voided:
    "Catatan belanja dibatalkan. Jumlah barangnya kembali jadi belum dibeli.",
  overLimit: (nama: string, remaining: number, satuan: string | null) =>
    `${nama}: tinggal ${remaining}${satuan ? ` ${satuan}` : ""} yang belum dibeli. Isi paling banyak ${remaining}.`,
} as const;

/** Status pengajuan yang belanjanya masih boleh dicatat. */
export const PURCHASABLE_REQUEST_STATUSES: readonly string[] = [
  "APPROVED",
  "ORDERED",
];

/** Status pesanan yang belanjanya masih boleh dicatat. */
export const PURCHASABLE_ORDER_STATUSES: readonly string[] = [
  "DRAFT",
  "ORDERED",
  "PARTIAL",
];

const JAKARTA_TIME_ZONE = "Asia/Jakarta";
/** Toleransi untuk petugas di zona waktu lebih timur (WIT = WIB + 2 jam). */
const FUTURE_DATE_TOLERANCE_DAYS = 1;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** Tanggal belanja disimpan pukul 12.00 WIB supaya tidak bergeser hari. */
const PURCHASE_DATE_TIME_SUFFIX = "T12:00:00+07:00";

type PurchaseLimitItem = Pick<
  RestockPurchaseContextItem,
  "quantity" | "cancelledQuantity" | "purchasedQuantity" | "receivedQuantity"
>;

/**
 * Jumlah yang dianggap sudah dibeli: barang yang sudah datang dihitung
 * sudah dibeli walau tidak ada catatan belanja.
 */
export function getEffectivePurchased(
  item: Pick<PurchaseLimitItem, "purchasedQuantity" | "receivedQuantity">,
): number {
  return Math.max(item.purchasedQuantity, item.receivedQuantity);
}

/**
 * Sisa yang belum dibeli untuk satu item. Ini juga batas keras jumlah yang
 * masih boleh dicatat dibeli, sama dengan batas di layar. Saat dicatat,
 * jumlah dibeli dinaikkan dari jumlah efektif ini (lihat repository), jadi
 * sisa selalu berkurang sebesar yang dicatat.
 */
export function getRemainingToBuy(item: PurchaseLimitItem): number {
  return Math.max(
    item.quantity - item.cancelledQuantity - getEffectivePurchased(item),
    0,
  );
}

export interface PurchaseRecordLineInput {
  purchaseOrderItemId: string;
  quantity: number;
  unitPrice: number | null;
}

export type PurchaseRecordPlan =
  | { ok: true; lines: CreatePurchaseRecordLine[] }
  | { ok: false; code: "INVALID" | "CONFLICT"; error: string };

type PurchaseContextWithOrder = RestockPurchaseContext & {
  purchaseOrder: NonNullable<RestockPurchaseContext["purchaseOrder"]>;
};

/**
 * Periksa baris belanja terhadap pengajuan dan pesanannya: status masih
 * terbuka, barangnya milik pengajuan ini, dan jumlahnya tidak melebihi sisa.
 */
export function planPurchaseRecord(
  context: PurchaseContextWithOrder,
  lines: PurchaseRecordLineInput[],
): PurchaseRecordPlan {
  const { request, purchaseOrder } = context;
  if (
    !PURCHASABLE_REQUEST_STATUSES.includes(request.status) ||
    !PURCHASABLE_ORDER_STATUSES.includes(purchaseOrder.status)
  ) {
    return {
      ok: false,
      code: "CONFLICT",
      error: RESTOCK_PURCHASE_MESSAGES.closed,
    };
  }

  const receivable = new Set(request.receivableBarangIds);
  const matched: Array<{
    line: PurchaseRecordLineInput;
    item: RestockPurchaseContextItem;
  }> = [];
  for (const line of lines) {
    const item = purchaseOrder.items.find(
      (candidate) => candidate.id === line.purchaseOrderItemId,
    );
    if (!item || !receivable.has(item.barangId)) {
      return {
        ok: false,
        code: "INVALID",
        error: RESTOCK_PURCHASE_MESSAGES.notPartOfRequest,
      };
    }
    matched.push({ line, item });
  }

  const problems = matched.flatMap(({ line, item }) =>
    describeLimitProblem(item, line.quantity),
  );
  if (problems.length > 0) {
    return { ok: false, code: "INVALID", error: problems.join("\n") };
  }

  return {
    ok: true,
    lines: matched.map(({ line, item }) => ({
      purchaseOrderItemId: line.purchaseOrderItemId,
      barangId: item.barangId,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      expected: {
        quantity: item.quantity,
        cancelledQuantity: item.cancelledQuantity,
      },
    })),
  };
}

function describeLimitProblem(
  item: RestockPurchaseContextItem,
  quantity: number,
): string[] {
  const limit = getRemainingToBuy(item);
  const nama = item.barang?.nama ?? "Barang ini";
  if (limit === 0) return [RESTOCK_PURCHASE_MESSAGES.fullyPurchased(nama)];
  if (quantity > limit) {
    return [
      RESTOCK_PURCHASE_MESSAGES.overLimit(
        nama,
        limit,
        item.barang?.satuan ?? null,
      ),
    ];
  }
  return [];
}

/**
 * True bila semua item pesanan milik pengajuan ini (barang di baris yang
 * tidak ditolak) sudah dibeli atau sudah datang semua. Pada pesanan gabungan,
 * barang pengajuan lain tidak ikut dihitung.
 */
export function isRequestFullyPurchased(
  items: RestockPurchaseContextItem[],
  receivableBarangIds: string[],
): boolean {
  const receivable = new Set(receivableBarangIds);
  const owned = items.filter((item) => receivable.has(item.barangId));
  return (
    owned.length > 0 && owned.every((item) => getRemainingToBuy(item) === 0)
  );
}

/** Tanggal "YYYY-MM-DD" menurut waktu Jakarta. */
export function formatJakartaDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: JAKARTA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Ubah tanggal belanja "YYYY-MM-DD" menjadi waktu simpan (pukul 12.00 WIB).
 * Null bila tanggalnya tidak sah atau lebih dari satu hari di depan hari ini
 * (waktu Jakarta).
 */
export function resolvePurchaseDate(isoDate: string, now: Date): Date | null {
  const purchasedAt = new Date(`${isoDate}${PURCHASE_DATE_TIME_SUFFIX}`);
  if (Number.isNaN(purchasedAt.getTime())) return null;
  if (formatJakartaDate(purchasedAt) !== isoDate) return null;

  const latestAllowed = formatJakartaDate(
    new Date(now.getTime() + FUTURE_DATE_TOLERANCE_DAYS * MS_PER_DAY),
  );
  return isoDate > latestAllowed ? null : purchasedAt;
}
