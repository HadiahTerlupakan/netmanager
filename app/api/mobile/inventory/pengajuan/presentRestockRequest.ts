/**
 * Bentuk pengajuan barang (restock) untuk layar "Pengajuan Barang" di aplikasi
 * mobile. Tahap dan status dihitung dengan fungsi yang sama dengan halaman
 * admin (`getRestockProgress`), jadi site dan admin selalu melihat status
 * yang sama. Fungsi-fungsi itu murni (tanpa React) dan bekerja atas bentuk
 * JSON yang dikirim API admin, maka data dari repository dilewatkan
 * `JSON.stringify` dulu, persis seperti yang diterima halaman admin.
 */
import {
  getRequestedQuantity,
  getRequestedSatuan,
  isLineRejected,
  wasSubstituted,
} from "@/app/admin/inventory/restock/approvalUtils";
import {
  getRestockLineProgress,
  getRestockProgress,
  isRestockOrderFinished,
  RESTOCK_STAGE_COUNT,
  RESTOCK_STAGE_TITLES,
  type RestockProgressKey,
} from "@/app/admin/inventory/restock/restockProgress";
import {
  getRestockLinePurchase,
  isRestockLegacyPurchased,
} from "@/app/admin/inventory/restock/restockPurchase";
import type {
  PurchaseRequest,
  PurchaseRequestItem,
} from "@/app/admin/inventory/restock/types";

/** Satu barang di kartu pengajuan. */
export interface MobileRestockLine {
  id: string;
  nama: string;
  /** Satuan barang yang dibeli (barang pengganti bila diganti). */
  satuan: string;
  diminta: number;
  satuanDiminta: string;
  /** Null bila belum diputuskan atau ditolak. */
  disetujui: number | null;
  dibeli: number;
  datang: number;
  tidakDatang: number;
  isDitolak: boolean;
  catatanAtasan: string | null;
}

/** Satu pengajuan seperti ditampilkan di aplikasi mobile. */
export interface MobileRestockRequest {
  id: string;
  nomor: string;
  /** ISO. */
  tanggal: string;
  gudang: string;
  pemohon: string | null;
  status: { kode: RestockProgressKey; label: string; kalimat: string };
  tahap: {
    /** Tahap yang sedang berjalan; null bila pengajuan dibatalkan. */
    sekarang: number | null;
    /** Tahap tempat pengajuan berhenti (ditolak/dibatalkan); null bila tidak. */
    berhentiDi: number | null;
    total: number;
    judul: string[];
  };
  barang: MobileRestockLine[];
  jumlahJasa: number;
}

/**
 * Kalimat admin yang menyuruh menekan tombol di halaman admin diganti
 * kalimat untuk site, yang hanya bisa melihat dan menunggu.
 */
const SITE_SENTENCES: Partial<Record<RestockProgressKey, string>> = {
  NO_ORDER: "Daftar belanjanya belum dibuat admin. Tanyakan ke admin gudang.",
  PURCHASED: "Semua barang sudah dibeli. Tinggal menunggu barangnya datang.",
  SERVICE_PENDING: "Menunggu jasanya selesai dikerjakan.",
};

const STAGE_TITLES = Array.from(
  { length: RESTOCK_STAGE_COUNT },
  (_, index) =>
    RESTOCK_STAGE_TITLES[(index + 1) as keyof typeof RESTOCK_STAGE_TITLES],
);

/** Ubah hasil repository ke bentuk JSON yang dipakai fungsi status admin. */
function toAdminShape(source: unknown): PurchaseRequest {
  return JSON.parse(JSON.stringify(source)) as PurchaseRequest;
}

function isAwaitingDecision(request: PurchaseRequest): boolean {
  return request.status === "DRAFT" || request.status === "SUBMITTED";
}

function toLine(
  item: PurchaseRequestItem,
  request: PurchaseRequest,
  isLegacyPurchased: boolean,
): MobileRestockLine {
  const isRejected = request.status === "REJECTED" || isLineRejected(item);
  const isDecided = !isRejected && !isAwaitingDecision(request);
  const progress = getRestockLineProgress(
    item,
    isRestockOrderFinished(request),
  );
  const nama = item.barang?.nama || "Barang";
  return {
    id: item.id,
    nama: wasSubstituted(item)
      ? `${nama} (pengganti ${item.barangDiminta?.nama ?? "barang lain"})`
      : nama,
    satuan: item.barang?.satuan || "",
    diminta: getRequestedQuantity(item),
    satuanDiminta: getRequestedSatuan(item),
    disetujui: isDecided ? item.jumlah : null,
    dibeli: isDecided
      ? getRestockLinePurchase(item, isLegacyPurchased).purchasedTotal
      : 0,
    datang: isRejected ? 0 : progress.received,
    tidakDatang: isRejected ? 0 : progress.cancelled,
    isDitolak: isRejected,
    catatanAtasan: item.catatanApproval ?? null,
  };
}

/** Barang yang ditolak ditaruh paling bawah supaya yang ditunggu terlihat dulu. */
function byRejectedLast(a: MobileRestockLine, b: MobileRestockLine): number {
  return Number(a.isDitolak) - Number(b.isDitolak);
}

/** Bentuk satu pengajuan dari repository untuk aplikasi mobile. */
export function presentRestockRequestForMobile(
  source: unknown,
): MobileRestockRequest {
  const request = toAdminShape(source);
  const progress = getRestockProgress(request);
  const isLegacyPurchased = isRestockLegacyPurchased(request);
  return {
    id: request.id,
    nomor: request.nomorRequest,
    tanggal: request.tanggal || request.createdAt,
    gudang: request.gudang?.nama || "-",
    pemohon: request.requester?.name ?? null,
    status: {
      kode: progress.key,
      label: progress.label,
      kalimat: SITE_SENTENCES[progress.key] ?? progress.sentence,
    },
    tahap: {
      sekarang: progress.stage,
      berhentiDi: progress.stoppedStage,
      total: RESTOCK_STAGE_COUNT,
      judul: STAGE_TITLES,
    },
    barang: (request.items ?? [])
      .map((item) => toLine(item, request, isLegacyPurchased))
      .sort(byRejectedLast),
    jumlahJasa: (request.jasaItems ?? []).filter(
      (item) => request.status !== "REJECTED" && !isLineRejected(item),
    ).length,
  };
}
