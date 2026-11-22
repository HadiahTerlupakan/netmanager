import type { RefObject } from "react";

import type { PhotoUploadRef } from "@/components/inventory/PhotoUpload";
import { OFFLINE_MESSAGE } from "@/components/inventory/form-shared/inventoryRequestMessages";
import {
  getRestockLineProgress,
  getRestockStatusKey,
  isRestockLineRejected,
  isRestockMergedOrder,
  RESTOCK_STATUS_LABELS,
  type RestockStatusKey,
} from "@/modules/inventory/client";

import type {
  Barang,
  BarangGudang,
  PurchaseRequest,
  PurchaseRequestItem,
  PurchaseRequestJasaItem,
  RestockFormItem,
  RestockOverReceiptMap,
  RestockSetting,
  RestockSubstitutionMap,
} from "./types";

/** Pilihan filter status di daftar pengajuan. */
export type RestockStatusFilter = RestockStatusKey | "all";

export const PHOTO_UPLOAD_NOT_READY_MESSAGE =
  "Komponen unggah foto belum siap. Muat ulang halaman lalu coba lagi.";

/**
 * Unggah foto bukti lewat PhotoUpload yang terpasang dan kembalikan URL-nya.
 *
 * Ref kosong berarti komponen yang ter-render tidak mendukung ref, sehingga
 * foto tidak mungkin terunggah. Gagal di sini dengan pesan yang benar, bukan
 * diam-diam mengirim bukti kosong yang ditolak server sebagai "foto wajib diunggah".
 */
export async function uploadProofPhotos(
  photoUploadRef: RefObject<PhotoUploadRef | null> | undefined,
): Promise<string[]> {
  const photoUpload = photoUploadRef?.current;
  if (!photoUpload) {
    throw new Error(PHOTO_UPLOAD_NOT_READY_MESSAGE);
  }
  return photoUpload.uploadPhotos();
}

interface VisibleRestockRequestsInput {
  requests: PurchaseRequest[];
  search: string;
  statusFilter: RestockStatusFilter;
  gudangFilter: string;
}

interface PaginatedRestockRequestsInput {
  requests: PurchaseRequest[];
  page: number;
  itemsPerPage: number | "all";
}

interface GetFilteredBarangsInput {
  allBarangs: Barang[];
  allSettings: RestockSetting[];
  formGudang: string;
  showAllItems: boolean;
}

function getBarangStocks(barang: Barang): BarangGudang[] {
  return barang.stockPerGudang || barang.barangGudang || [];
}

function getStockInfo(
  barang: Barang,
  gudangId: string,
): BarangGudang | undefined {
  return getBarangStocks(barang).find(
    (stock) => (stock.gudangId || stock.gudang?.id) === gudangId,
  );
}

/** Stok minimum barang di gudang: dari pengaturan restock, atau bawaan barang. */
export function getMinStockForBarang(
  barang: Barang,
  allSettings: RestockSetting[],
  gudangId: string,
): number {
  const setting = allSettings.find(
    (item) => item.barangId === barang.id && item.gudangId === gudangId,
  );
  return (setting?.minStok ?? barang.minStokDefault) || 0;
}

/** Barang yang ditawarkan di form: semua, atau yang stoknya di bawah minimum gudang. */
export function getFilteredBarangs({
  allBarangs,
  allSettings,
  formGudang,
  showAllItems,
}: GetFilteredBarangsInput): Barang[] {
  if (showAllItems) {
    return allBarangs;
  }

  if (!formGudang) {
    return [];
  }

  return allBarangs.filter((barang) => {
    const currentStockBaru = getStockInfo(barang, formGudang)?.stokBaru || 0;
    const minStock = getMinStockForBarang(barang, allSettings, formGudang);
    return currentStockBaru <= minStock;
  });
}

/** Sisa pesanan satu baris yang belum masuk dan belum dicoret; tidak pernah negatif. */
export function getRestockItemRemaining(item: PurchaseRequestItem): number {
  return getRestockLineProgress(item).remaining;
}

/**
 * Patokan satu baris di "Lapor Barang Sampai": isian awalnya, dan dasar jumlah
 * yang tidak dimasukkan (patokan dikurangi isian). Mengikuti yang ditutup
 * server saat pengajuan selesai:
 * - pesanan milik satu pengajuan: seluruh sisa pesanan barang itu, termasuk
 *   bila jumlah pesanannya diubah sesudah disetujui;
 * - pesanan gabungan: hanya bagian pengajuan ini, yaitu sisa pesanan tetapi
 *   tidak lebih dari jumlah yang disetujui. Sisa milik pengajuan lain yang
 *   belum selesai tidak ikut ditutup.
 */
export function getRestockEntryBasis(
  item: PurchaseRequestItem,
  request: Pick<PurchaseRequest, "purchaseOrder">,
): number {
  const remaining = getRestockItemRemaining(item);
  return isRestockMergedOrder(request)
    ? Math.min(remaining, item.jumlah)
    : remaining;
}

/**
 * Baris yang diisi di "Lapor Barang Sampai": baris barang yang masih punya sisa,
 * kecuali yang ditolak atasan. Server meminta jumlah untuk tepat baris-baris
 * ini.
 */
export function getRestockEnterableItems(
  request: PurchaseRequest,
): PurchaseRequestItem[] {
  return request.items.filter(
    (item) => !isRestockLineRejected(item) && getRestockItemRemaining(item) > 0,
  );
}

/** Jasa yang masih menunggu konfirmasi selesai; jasa yang ditolak diabaikan. */
export function getPendingJasaItems(
  request: PurchaseRequest,
): PurchaseRequestJasaItem[] {
  return (request.jasaItems ?? []).filter(
    (item) =>
      item.statusKonfirmasi === "PENDING" && !isRestockLineRejected(item),
  );
}

/** Isian awal "Lapor Barang Sampai" per barang: patokan tiap baris. */
export function buildInitialReceivedItems(
  request: PurchaseRequest,
): Record<string, number> {
  return getRestockEnterableItems(request).reduce<Record<string, number>>(
    (acc, item) => {
      acc[item.barangId] =
        (acc[item.barangId] || 0) + getRestockEntryBasis(item, request);
      return acc;
    },
    {},
  );
}

/** Jumlah masuk yang melebihi sisa pesanan; 0 bila tidak berlebih. */
export function getRestockItemExcess(
  item: PurchaseRequestItem,
  receivedQuantity: number,
): number {
  return Math.max(receivedQuantity - getRestockItemRemaining(item), 0);
}

function getExcessItems(
  items: PurchaseRequestItem[],
  receivedItems: Record<string, number>,
): PurchaseRequestItem[] {
  return items.filter(
    (item) => getRestockItemExcess(item, receivedItems[item.barangId] ?? 0) > 0,
  );
}

/** Hanya alasan untuk barang yang benar-benar berlebih yang dikirim ke server. */
export function buildOverReceiptPayload(
  items: PurchaseRequestItem[],
  receivedItems: Record<string, number>,
  overReceipts: RestockOverReceiptMap,
): RestockOverReceiptMap {
  return getExcessItems(items, receivedItems).reduce<RestockOverReceiptMap>(
    (acc, item) => {
      const reason = (overReceipts[item.barangId] ?? "").trim();
      if (reason.length > 0) acc[item.barangId] = reason;
      return acc;
    },
    {},
  );
}

/** Barang yang masuk melebihi sisa pesanan wajib diberi alasan. */
export function hasMissingOverReceiptReason(
  items: PurchaseRequestItem[],
  receivedItems: Record<string, number>,
  overReceipts: RestockOverReceiptMap,
): boolean {
  return getExcessItems(items, receivedItems).some(
    (item) => (overReceipts[item.barangId] ?? "").trim().length === 0,
  );
}

/** Baris yang sudah pernah menerima barang tidak boleh diganti barangnya. */
export function canSubstituteRestockItem(item: PurchaseRequestItem): boolean {
  return item.receivedQuantity <= 0;
}

/**
 * Buang substitusi yang tidak berdampak (kosong / sama dengan barang asli)
 * supaya payload penerimaan tetap bersih.
 */
export function buildSubstitutionPayload(
  substitutions: RestockSubstitutionMap,
): RestockSubstitutionMap {
  return Object.entries(substitutions).reduce<RestockSubstitutionMap>(
    (acc, [originalBarangId, replacementBarangId]) => {
      if (replacementBarangId && replacementBarangId !== originalBarangId) {
        acc[originalBarangId] = replacementBarangId;
      }
      return acc;
    },
    {},
  );
}

/** Tombol "Tinjau & Putuskan": pengajuan yang belum diputuskan atasan. */
export function canApprovePurchaseRequest(
  status: PurchaseRequest["status"],
  canApprove: boolean,
): boolean {
  return canApprove && status === "DRAFT";
}

interface RestockFormProblemsInput {
  formGudang: string;
  formNotes: string;
  formItems: RestockFormItem[];
  /** Nama barang per id, agar barang dobel disebut namanya. */
  barangNamaById?: ReadonlyMap<string, string>;
}

/**
 * Daftar hal yang masih kurang di form pengajuan, dalam kalimat untuk petugas.
 * Daftar kosong berarti form siap disimpan. Tombol simpan mati selama daftar
 * ini berisi, jadi daftar ini juga yang ditampilkan di samping tombol.
 */
export function getRestockFormProblems({
  formGudang,
  formNotes,
  formItems,
  barangNamaById,
}: RestockFormProblemsInput): string[] {
  const problems: string[] = [];
  if (!formGudang) problems.push("Gudang tujuan belum dipilih.");
  if (!formNotes.trim()) {
    problems.push("Catatan belum diisi. Tulis untuk apa barang ini dibeli.");
  }
  if (formItems.length === 0) {
    problems.push(
      "Belum ada barang atau jasa. Tekan Tambah Barang atau Tambah Jasa.",
    );
  }

  formItems.forEach((item, index) => {
    const row = `Baris ke-${index + 1}`;
    const isJasa = item.tipe === "JASA";
    if (isJasa ? !item.jasaId : !item.barangId) {
      problems.push(`${row}: ${isJasa ? "jasa" : "barang"}nya belum dipilih.`);
    }
    if (!(item.quantity > 0)) {
      problems.push(`${row}: jumlahnya harus 1 atau lebih.`);
    }
  });

  problems.push(...describeDuplicateBarangRows(formItems, barangNamaById));
  return problems;
}

/** Barang yang dipilih di lebih dari satu baris (jasa boleh dobel). */
function describeDuplicateBarangRows(
  formItems: RestockFormItem[],
  barangNamaById?: ReadonlyMap<string, string>,
): string[] {
  const rowsByBarang = new Map<string, number[]>();
  formItems.forEach((item, index) => {
    if (item.tipe !== "BARANG" || !item.barangId) return;
    rowsByBarang.set(item.barangId, [
      ...(rowsByBarang.get(item.barangId) ?? []),
      index + 1,
    ]);
  });

  return [...rowsByBarang.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([barangId, rows]) => {
      const nama = barangNamaById?.get(barangId) ?? "Barang yang sama";
      return `${nama} dipilih lebih dari sekali (baris ${rows.join(", ")}). Hapus salah satu barisnya, lalu jumlahkan di satu baris saja.`;
    });
}

const SERVER_UNREADABLE_MESSAGE =
  "Server sedang bermasalah dan tidak memberi jawaban yang bisa dibaca. Tunggu sebentar, lalu coba lagi. Kalau tetap gagal, lapor ke admin.";

/**
 * Ambil pesan error dari respons API yang gagal. Respons yang bukan JSON
 * (misalnya halaman error dari server) tidak boleh berubah jadi pesan
 * "Unexpected token <" di layar petugas.
 */
export async function readRestockErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  const body: unknown = await response.json().catch((): null => null);
  if (!body || typeof body !== "object") return SERVER_UNREADABLE_MESSAGE;
  const { error, message } = body as { error?: unknown; message?: unknown };
  if (typeof error === "string" && error) return error;
  if (typeof message === "string" && message) return message;
  return fallback;
}

/** Pesan untuk kegagalan yang terjadi sebelum server menjawab. */
export const RESTOCK_NETWORK_ERROR_MESSAGE = OFFLINE_MESSAGE;

/**
 * Pesan untuk error yang tertangkap di layar. `fetch` yang gagal tersambung
 * melempar TypeError berbahasa Inggris ("Failed to fetch"); itu diganti
 * kalimat yang dimengerti petugas.
 */
export function describeRestockClientError(error: unknown): string {
  if (error instanceof TypeError) return RESTOCK_NETWORK_ERROR_MESSAGE;
  if (error instanceof Error && error.message) return error.message;
  return "Terjadi masalah yang tidak dikenal. Coba sekali lagi. Kalau tetap gagal, lapor ke admin.";
}

/** Baris form boleh dihapus selama masih ada baris lain. */
export function canRemoveRestockFormItem(totalItems: number): boolean {
  return totalItems > 1;
}

/** Teks tombol pengalih daftar barang di form. */
export function getRestockToggleLabel(showAllItems: boolean): string {
  return showAllItems ? "Lihat Semua Barang" : "Filter Stok Minim";
}

/** Penjelasan daftar barang yang sedang tampil di form. */
export function getRestockToggleHint(showAllItems: boolean): string {
  return showAllItems
    ? "Menampilkan semua barang untuk restock manual"
    : "Menampilkan hanya barang dengan stok minim";
}

/** Stok baru tinggal separuh stok minimum atau kurang. */
export function isVeryLowStock(
  currentStockBaru: number,
  minStock: number,
): boolean {
  return minStock > 0 && currentStockBaru * 2 <= minStock;
}

/** Stok barang di gudang terpilih beserta minimumnya, untuk baris form. */
export function getStockSnapshot(
  barang: Barang | undefined,
  allSettings: RestockSetting[],
  gudangId: string,
) {
  if (!barang || !gudangId) {
    return {
      stokBaru: 0,
      stokBekas: 0,
      stokRusak: 0,
      minStock: 0,
    };
  }

  const stockInfo = getStockInfo(barang, gudangId);
  return {
    stokBaru: stockInfo?.stokBaru || 0,
    stokBekas: stockInfo?.stokBekas || 0,
    stokRusak: stockInfo?.stokRusak || 0,
    minStock: getMinStockForBarang(barang, allSettings, gudangId),
  };
}

function wordStartMatch(text: string, term: string): boolean {
  if (text.includes(term)) return true;
  const words = text.split(/[\s\-_/,.]+/);
  return words.some((word) => word.startsWith(term));
}

function matchesSearchTerms(text: string, terms: string[]): boolean {
  const lower = text.toLowerCase();
  return terms.every((term) => wordStartMatch(lower, term));
}

function requestMatchesSearch(
  request: PurchaseRequest,
  terms: string[],
): boolean {
  if (terms.length === 0) return true;

  const searchableTexts = [
    request.nomorRequest,
    request.gudang?.nama || "",
    request.keterangan || "",
    ...(request.items?.flatMap((item) => [
      item.barang?.nama || "",
      item.barang?.kode || "",
    ]) || []),
    ...(request.jasaItems?.flatMap((item) => [
      item.jasa?.nama || "",
      item.jasa?.kode || "",
    ]) || []),
  ];

  return searchableTexts.some((text) => matchesSearchTerms(text, terms));
}

/** Pengajuan yang cocok dengan pencarian, status tampilan, dan gudang. */
export function getVisibleRestockRequests({
  requests,
  search,
  statusFilter,
  gudangFilter,
}: VisibleRestockRequestsInput): PurchaseRequest[] {
  const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);

  return requests.filter((request) => {
    const matchesSearch = requestMatchesSearch(request, terms);
    const matchesStatus =
      statusFilter === "all" || getRestockStatusKey(request) === statusFilter;
    const matchesGudang =
      gudangFilter === "all" || request.gudangId === gudangFilter;
    return matchesSearch && matchesStatus && matchesGudang;
  });
}

export interface RestockStatusFilterOption {
  value: RestockStatusFilter;
  label: string;
}

/** Urutan status di filter, mengikuti jalannya pengajuan. */
const FILTERABLE_STATUSES: readonly RestockStatusKey[] = [
  "AWAITING_APPROVAL",
  "APPROVED",
  "RECEIVED",
  "REJECTED",
  "CANCELLED",
];

/**
 * Pilihan filter status di daftar pengajuan. Filter membandingkan status
 * tampilan (badge), bukan status database, supaya hasilnya cocok dengan yang
 * terlihat di tabel.
 */
export const RESTOCK_STATUS_FILTER_OPTIONS: readonly RestockStatusFilterOption[] =
  [
    { value: "all", label: "Semua Status" },
    ...FILTERABLE_STATUSES.map((status) => ({
      value: status,
      label: RESTOCK_STATUS_LABELS[status],
    })),
  ];

/** Potong daftar pengajuan menurut halaman dan jumlah per halaman. */
export function getPaginatedRestockRequests({
  requests,
  page,
  itemsPerPage,
}: PaginatedRestockRequestsInput) {
  if (itemsPerPage === "all") {
    return {
      data: requests,
      page: 1,
      totalPages: 1,
    };
  }

  const totalPages = Math.max(1, Math.ceil(requests.length / itemsPerPage));
  const normalizedPage = Math.min(Math.max(page, 1), totalPages);
  const startIndex = (normalizedPage - 1) * itemsPerPage;

  return {
    data: requests.slice(startIndex, startIndex + itemsPerPage),
    page: normalizedPage,
    totalPages,
  };
}
