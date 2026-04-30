import type { IInventoryRepository } from "../domain/ports/IInventoryRepository";
import {
  INVENTORY_CODE_MAX_ATTEMPTS,
  INVENTORY_CODE_PREFIX,
  INVENTORY_CODE_RANDOM_RANGE,
} from "../validators/inventoryValidators";

type InventoryBarang = Awaited<
  ReturnType<IInventoryRepository["findAllBarang"]>
>["items"][number];

export function mapBarangListItem(input: {
  barang: InventoryBarang;
  gudangId?: string | null;
}) {
  const filteredStocks = filterBarangStocks(input.barang, input.gudangId);
  return {
    id: input.barang.id,
    kode: input.barang.kode,
    nama: input.barang.nama,
    satuan: input.barang.satuan,
    isWorkOrderMaterial: input.barang.isWorkOrderMaterial,
    jenis: input.barang.jenis,
    kategoriAset: input.barang.kategoriAset,
    minStokDefault: input.barang.minStokDefault || 0,
    createdAt: input.barang.createdAt,
    updatedAt: input.barang.updatedAt,
    totalStock: filteredStocks.reduce((sum, stock) => sum + stock.stok, 0),
    stockPerGudang: filteredStocks.map(mapStockPerGudang),
  };
}

export async function resolveUniqueBarangCode(
  repository: IInventoryRepository,
  requestedCode?: string,
) {
  const trimmedCode = requestedCode?.trim();
  if (trimmedCode) {
    await assertBarangCodeAvailable(repository, trimmedCode);
    return trimmedCode;
  }

  return generateUniqueBarangCode(repository);
}

function filterBarangStocks(barang: InventoryBarang, gudangId?: string | null) {
  const stocks = barang.barangGudang || [];
  if (!gudangId) return stocks;
  return stocks.filter((stock) => stock.gudangId === gudangId);
}

function mapStockPerGudang(
  stock: ReturnType<typeof filterBarangStocks>[number],
) {
  return {
    gudangId: stock.gudangId,
    gudangKode: stock.gudang.kode,
    gudangNama: stock.gudang.nama,
    stok: stock.stok,
    stokBaru: (stock as unknown as Record<string, number>).stokBaru || 0,
    stokBekas: (stock as unknown as Record<string, number>).stokBekas || 0,
    stokRusak: (stock as unknown as Record<string, number>).stokRusak || 0,
  };
}

async function assertBarangCodeAvailable(
  repository: IInventoryRepository,
  kode: string,
) {
  const isExists = await repository.existsBarangByKode(kode);
  if (!isExists) return;

  throw new Error(
    `Kode barang "${kode}" sudah digunakan. Silakan gunakan kode lain atau kosongkan field kode.`,
  );
}

async function generateUniqueBarangCode(repository: IInventoryRepository) {
  for (let attempts = 0; attempts < INVENTORY_CODE_MAX_ATTEMPTS; attempts++) {
    const kode = generateBarangCode();
    const isExists = await repository.existsBarangByKode(kode);
    if (!isExists) return kode;
  }

  throw new Error("Gagal generate kode unik");
}

function generateBarangCode() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * INVENTORY_CODE_RANDOM_RANGE);
  return `${INVENTORY_CODE_PREFIX}${timestamp.toString().slice(-6)}${random.toString().padStart(3, "0")}`;
}
