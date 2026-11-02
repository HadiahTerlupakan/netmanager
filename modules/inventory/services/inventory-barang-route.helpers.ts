import type { LingkupSite } from "@/modules/roles/client";

import type { UpdateBarangInput } from "../domain/ports/IInventoryOperationRepository";
import { gudangDalamLingkup } from "./lingkup-gudang";

interface InventoryBarangRecord {
  barangGudang?: InventoryBarangStockRecord[];
}

interface InventoryBarangStockRecord {
  stok: number;
  gudang?: {
    sites?: Array<{ id: string }>;
  };
}

/** Pesan untuk kolom wajib barang yang masih kosong. */
export const PESAN_KOLOM_BARANG_KOSONG = {
  kode: "Kode barang belum diisi. Tulis kode barangnya.",
  nama: "Nama barang belum diisi. Tulis nama barangnya, contoh: Kabel Drop 1 Core.",
  satuan:
    "Satuan barang belum diisi. Tulis satuannya, contoh: pcs, meter, roll.",
} as const;

type KolomWajibBarang = keyof typeof PESAN_KOLOM_BARANG_KOSONG;

/** Validasi payload create barang dari route inventory. */
export function validateBarangCreateBody(body: Record<string, unknown>) {
  return findKolomBarangKosong(body, ["nama", "satuan"]);
}

/** Validasi payload update barang dari route inventory. */
export function validateBarangUpdateBody(body: Record<string, unknown>) {
  return findKolomBarangKosong(body, ["kode", "nama", "satuan"]);
}

/** Laporkan semua kolom wajib yang kosong sekaligus, satu baris per kolom. */
function findKolomBarangKosong(
  body: Record<string, unknown>,
  kolomWajib: readonly KolomWajibBarang[],
) {
  const kosong = kolomWajib.filter(
    (kolom) => !String(body[kolom] ?? "").trim(),
  );
  if (kosong.length === 0) return null;

  return {
    success: false as const,
    status: 400,
    error: kosong.map((kolom) => PESAN_KOLOM_BARANG_KOSONG[kolom]).join("\n"),
    details: Object.fromEntries(
      kosong.map((kolom) => [kolom, [PESAN_KOLOM_BARANG_KOSONG[kolom]]]),
    ),
  };
}

/** Bentuk data update barang dari body route. */
export function toUpdateBarangData(
  body: Record<string, unknown>,
): UpdateBarangInput {
  return {
    kode: String(body.kode),
    nama: String(body.nama),
    satuan: String(body.satuan),
    isWorkOrderMaterial: Boolean(body.isWorkOrderMaterial),
    jenis: body.jenis as UpdateBarangInput["jenis"],
    kategoriAset: body.kategoriAset as UpdateBarangInput["kategoriAset"],
    minStokDefault: body.minStokDefault as number | undefined,
  };
}

/** Tambahkan ringkasan stok barang, hanya dari gudang di dalam lingkup site. */
export function withStockSummary<T extends InventoryBarangRecord>(
  barang: T,
  lingkup: LingkupSite,
): T & { barangGudang: InventoryBarangStockRecord[]; totalStock: number } {
  const barangGudang = (barang.barangGudang || []).filter((stock) =>
    stockDalamLingkup(stock, lingkup),
  );
  return {
    ...barang,
    barangGudang,
    totalStock: barangGudang.reduce((sum, stock) => sum + stock.stok, 0),
  };
}

/**
 * Cek apakah barang boleh diubah/dihapus dalam lingkup site ini: barang harus
 * punya stok di setidaknya satu gudang site pengguna. Pengguna dibatasi tanpa
 * site tidak pernah lolos.
 */
export function canAccessBarang(
  barang: InventoryBarangRecord,
  lingkup: LingkupSite,
) {
  if (!lingkup.dibatasi) return true;
  return (barang.barangGudang || []).some((stock) =>
    stockDalamLingkup(stock, lingkup),
  );
}

function stockDalamLingkup(
  stock: InventoryBarangStockRecord,
  lingkup: LingkupSite,
) {
  const gudangSiteIds = stock.gudang?.sites?.map((site) => site.id) ?? [];
  return gudangDalamLingkup(lingkup, gudangSiteIds);
}
