import type { KondisiBarang } from "@prisma/client";
import { isSuperAdmin } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { socketEmitter } from "@/lib/websocket/emitter";
import {
  buildInventoryActorFilter,
  resolveInventoryActorScope,
  validateInventoryGudangAccess,
} from "../utils/validation";
import type { InventoryActorInput } from "../repositories/IInventoryRepository";
import type {
  MobileActorLookupInput,
  MobileBarangGudangStock,
  MobileBarangMaster,
  MobileBarangStock,
  MobileCommandInput,
  MobileGudangLookupInput,
  MobileHistoryItem,
  MobileHistoryRecord,
  MobileInventoryRepository,
  MobileScopeResult,
} from "./mobile-inventory.types";
import { MobileInventoryError } from "./mobile-inventory.types";

const DEFAULT_HISTORY_LIMIT = 20;
const DEFAULT_KONDISI_BARANG = "BARU" as KondisiBarang;

/** Ambil scope actor mobile atau lempar error bila actor tidak ditemukan. */
export async function requireMobileActorScope(
  repository: MobileInventoryRepository,
  input: MobileActorLookupInput,
): Promise<MobileScopeResult> {
  const user = await repository.findMobileActorUser(input);
  const mitra = user
    ? null
    : await repository.findMobileActorMitra(input.actorId);
  const scope = resolveInventoryActorScope({
    user,
    mitra,
    isSuperAdmin: user ? isSuperAdmin({ role: user.role?.name }) : false,
  });

  if (!scope) {
    throw new MobileInventoryError("User tidak ditemukan", 404);
  }

  return scope;
}

/** Pastikan actor restricted memiliki site assignment. */
export function ensureMobileAssignedSite(scope: MobileScopeResult) {
  if (scope.isRestricted && scope.allowedSiteIds.length === 0) {
    throw new MobileInventoryError(
      "Akses ditolak: Tidak ada site yang ditugaskan",
      403,
    );
  }
}

/** Kembalikan scope site untuk query mobile. */
export function getMobileScopedSiteIds(scope: MobileScopeResult) {
  return scope.isRestricted ? scope.allowedSiteIds : undefined;
}

/** Parse jumlah transaksi mobile ke angka valid. */
export function parseMobileJumlah(jumlah: unknown) {
  const parsedJumlah = Number(jumlah);

  if (!Number.isFinite(parsedJumlah) || parsedJumlah <= 0) {
    throw new MobileInventoryError("Data tidak lengkap", 400);
  }

  return parsedJumlah;
}

/** Validasi akses gudang berdasarkan scope site actor mobile. */
export async function ensureMobileGudangAccess(
  repository: MobileInventoryRepository,
  input: MobileGudangLookupInput,
  scope: MobileScopeResult,
) {
  const gudang = await repository.findMobileGudangSites(input);

  if (!gudang) {
    throw new MobileInventoryError("Gudang tidak ditemukan", 404);
  }

  const access = validateInventoryGudangAccess({
    isRestricted: scope.isRestricted,
    allowedSiteIds: scope.allowedSiteIds,
    gudangSiteIds: gudang.sites.map((site) => site.id),
  });

  if (!access.allowed) {
    throw new MobileInventoryError(access.error || "Akses ditolak", 403);
  }
}

/** Ambil stok berdasarkan kondisi barang. */
export function getMobileStockByKondisi(
  stock: MobileBarangGudangStock,
  kondisi: KondisiBarang,
) {
  if (kondisi === "BEKAS") return stock.stokBekas || 0;
  if (kondisi === "RUSAK") return stock.stokRusak || 0;
  return stock.stokBaru || 0;
}

/** Pastikan stok kondisi cukup untuk transaksi barang keluar mobile. */
export async function requireMobileAvailableStock(
  repository: MobileInventoryRepository,
  input: MobileCommandInput,
  jumlah: number,
) {
  const stock = await repository.findMobileBarangGudangStock(input);
  const kondisi = input.kondisi || DEFAULT_KONDISI_BARANG;
  const availableStock = stock ? getMobileStockByKondisi(stock, kondisi) : 0;

  if (!stock || availableStock < jumlah) {
    throw new MobileInventoryError(
      `Stok ${kondisi} tidak mencukupi. Tersedia: ${availableStock}`,
      400,
    );
  }

  return stock;
}

/** Emit side effect barang keluar mobile ke socket dan activity log. */
export async function emitMobileBarangKeluarSideEffects(input: {
  command: MobileCommandInput;
  actor: InventoryActorInput;
  jumlah: number;
  totalStok: number;
  stock: MobileBarangGudangStock;
}) {
  socketEmitter.inventoryUpdate({
    type: "keluar",
    userId: input.actor.id,
    barangId: input.command.barangId,
    gudangId: input.command.gudangId,
    jumlah: input.jumlah,
    totalStok: input.totalStok,
  });

  await logger.logActivity({
    action: "CREATE",
    subject: "Inventory Out (Mobile)",
    details: buildMobileBarangKeluarLogDetails(input),
    actor: input.actor,
    tenantId: input.command.tenantId,
  });
}

/** Bangun payload detail activity log untuk barang keluar mobile. */
export function buildMobileBarangKeluarLogDetails(input: {
  command: MobileCommandInput;
  jumlah: number;
  stock: MobileBarangGudangStock;
}) {
  return {
    barangId: input.command.barangId,
    namaBarang: input.stock.barang?.nama,
    jumlah: input.jumlah,
    kondisi: input.command.kondisi,
    gudangId: input.command.gudangId,
    keterangan: input.command.keterangan,
    tujuanPenggunaan: input.command.tujuanPenggunaan,
  };
}

/** Bangun filter riwayat inventory mobile berbasis actor dan site. */
export function buildMobileHistoryWhere(
  input: { tenantId: string; cursor?: string | null },
  scope: MobileScopeResult,
) {
  const where: Record<string, unknown> = {
    tenantId: input.tenantId,
    ...buildInventoryActorFilter(scope.actor),
  };

  if (scope.isRestricted) {
    where.gudang = { sites: { some: { id: { in: scope.allowedSiteIds } } } };
  }

  if (input.cursor) {
    where.tanggal = { lt: new Date(input.cursor) };
  }

  return where;
}

/** Ubah riwayat transaksi ke DTO mobile seragam. */
export function mapMobileHistory(
  type: "masuk" | "keluar",
  records: MobileHistoryRecord[],
): MobileHistoryItem[] {
  return records.map((record) => ({
    id: record.id,
    type,
    barang: record.barang,
    gudang: record.gudang,
    jumlah: record.jumlah,
    kondisi: record.kondisi,
    keterangan: record.keterangan,
    tanggal: record.tanggal.toISOString(),
    rawDate: record.tanggal,
  }));
}

/** Rapikan pagination riwayat mobile berbasis cursor. */
export function paginateMobileHistory(transactions: MobileHistoryItem[]) {
  let nextCursor: string | null = null;
  let data = transactions;

  if (data.length > DEFAULT_HISTORY_LIMIT) {
    nextCursor = String(data[DEFAULT_HISTORY_LIMIT - 1].tanggal);
    data = data.slice(0, DEFAULT_HISTORY_LIMIT);
  } else if (data.length === DEFAULT_HISTORY_LIMIT) {
    nextCursor = String(data[data.length - 1].tanggal);
  }

  return {
    data: data.map(({ rawDate: _rawDate, ...item }) => item),
    nextCursor,
  };
}

/** Tambahkan field stok nol untuk mode barang masuk mobile. */
export function mapMobileBarangMaster(items: MobileBarangMaster[]) {
  return items.map((item) => ({
    ...item,
    stok: 0,
    stokBaru: 0,
    stokBekas: 0,
    stokRusak: 0,
  }));
}

/** Bentuk response stok barang mobile untuk mode keluar. */
export function mapMobileBarangStock(items: MobileBarangStock[]) {
  return items.map((item) => ({
    id: item.barang.id,
    kode: item.barang.kode,
    nama: item.barang.nama,
    satuan: item.barang.satuan,
    isWorkOrderMaterial: item.barang.isWorkOrderMaterial,
    stok: item.stok,
    stokBaru: item.stokBaru,
    stokBekas: item.stokBekas,
    stokRusak: item.stokRusak,
  }));
}

/** Gabungkan riwayat masuk dan keluar mobile lalu urutkan terbaru. */
export async function loadMobileHistoryTransactions(
  repository: MobileInventoryRepository,
  input: { tenantId: string; type?: string | null },
  where: Record<string, unknown>,
) {
  if (input.type === "masuk") {
    return mapMobileHistory(
      "masuk",
      await repository.findMobileHistoryMasuk({
        tenantId: input.tenantId,
        where,
        take: DEFAULT_HISTORY_LIMIT + 1,
      }),
    );
  }

  if (input.type === "keluar") {
    return mapMobileHistory(
      "keluar",
      await repository.findMobileHistoryKeluar({
        tenantId: input.tenantId,
        where,
        take: DEFAULT_HISTORY_LIMIT + 1,
      }),
    );
  }

  const [masuk, keluar] = await Promise.all([
    repository.findMobileHistoryMasuk({
      tenantId: input.tenantId,
      where,
      take: DEFAULT_HISTORY_LIMIT,
    }),
    repository.findMobileHistoryKeluar({
      tenantId: input.tenantId,
      where,
      take: DEFAULT_HISTORY_LIMIT,
    }),
  ]);

  return [
    ...mapMobileHistory("masuk", masuk),
    ...mapMobileHistory("keluar", keluar),
  ].sort(
    (left, right) =>
      (right.rawDate?.getTime() || 0) - (left.rawDate?.getTime() || 0),
  );
}
