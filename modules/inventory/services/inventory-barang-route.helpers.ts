import type { UpdateBarangInput } from "../domain/ports/IInventoryOperationRepository";

interface InventoryBarangRecord {
  barangGudang?: InventoryBarangStockRecord[];
}

interface InventoryBarangStockRecord {
  stok: number;
  gudang?: {
    sites?: Array<{ id: string }>;
  };
}

/** Validasi payload create barang dari route inventory. */
export function validateBarangCreateBody(body: Record<string, unknown>) {
  if (!body.nama || !body.satuan) {
    return {
      success: false as const,
      status: 400,
      error: "Nama dan satuan barang harus diisi",
    };
  }

  return null;
}

/** Validasi payload update barang dari route inventory. */
export function validateBarangUpdateBody(body: Record<string, unknown>) {
  if (!body.kode || !body.nama || !body.satuan) {
    return {
      success: false as const,
      status: 400,
      error: "Kode, nama, dan satuan barang harus diisi",
    };
  }

  return null;
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

/** Tambahkan ringkasan stok barang untuk site tertentu. */
export function withStockSummary<T extends InventoryBarangRecord>(
  barang: T,
  siteId?: string,
): T & { barangGudang: InventoryBarangStockRecord[]; totalStock: number } {
  const barangGudang = filterBarangGudang(barang.barangGudang || [], siteId);
  return {
    ...barang,
    barangGudang,
    totalStock: barangGudang.reduce((sum, stock) => sum + stock.stok, 0),
  };
}

/** Cek apakah barang bisa diakses dari site tertentu. */
export function canAccessBarang(
  barang: InventoryBarangRecord,
  siteId?: string,
) {
  if (!siteId) return true;
  return (barang.barangGudang || []).some((stock) =>
    stockBelongsToSite(stock, siteId),
  );
}

function filterBarangGudang(
  barangGudang: InventoryBarangStockRecord[],
  siteId?: string,
) {
  if (!siteId) return barangGudang;
  return barangGudang.filter((stock) => stockBelongsToSite(stock, siteId));
}

function stockBelongsToSite(stock: InventoryBarangStockRecord, siteId: string) {
  return stock.gudang?.sites?.some((site) => site.id === siteId) ?? false;
}
