import { getUserPermissions } from "@/lib/auth";
import { logActivitySafe } from "@/lib/logger";
import { prisma } from "@/modules/database";
import type { Prisma } from "../repositories/prisma-boundary";

import { IZIN_PEMBATAS_OPNAME } from "../domain/izin-pembatas-site";
import { validateGudangSiteAccess } from "../utils/validation";
import { buildInventoryAccessSession } from "../utils/session";
import type { CreateInventoryOpnameInput } from "./InventoryOpnameService";
import {
  buildInitialGudangStock,
  buildOpnameCreateData,
  buildUpdatedStockData,
  calculateStockDifference,
  ensureTenantConsistency,
} from "./inventory-opname.service-helpers";
import {
  planOpnameMovement,
  resolveOpnameStockCondition,
} from "../domain/opname-mutasi";
import {
  STOK_KOSONG,
  computeStockEffect,
  toStoredStockEffect,
  type KondisiStok,
  type StokPerKondisi,
} from "../domain/opname-stock-condition";
import { createOpnameMovement } from "../repositories/opname-stock-effect";
import { namaPelaku, ringkasPembuatan } from "../domain/riwayat-stock-opname";
import { getStockOpnameRiwayatRepository } from "../repositories/StockOpnameRiwayatRepository";

const DEFAULT_EMPTY_TOTAL = 0;
const DEFAULT_ADMIN_PIC = "Admin";

type OpnameReferences = Awaited<ReturnType<typeof findOpnameReferences>>;

export type CreateOpnameTransactionResult = {
  opnameRecord: Awaited<
    ReturnType<Prisma.TransactionClient["stockOpname"]["create"]>
  >;
  previousStock: number;
  newStock: number;
  selisih: number;
};

/** Buat opname tunggal — bungkus dengan transaksi sendiri. */
export async function createInventoryOpname(input: CreateInventoryOpnameInput) {
  const result = await prisma.$transaction((tx) =>
    createOpnameInTransaction(tx, input),
  );
  return result;
}

/**
 * Buat opname dalam transaksi yang sudah dibuka pemanggil.
 * Dipakai oleh batch processor agar seluruh sesi opname atomic.
 */
export async function createOpnameInTransaction(
  tx: Prisma.TransactionClient,
  input: CreateInventoryOpnameInput,
): Promise<CreateOpnameTransactionResult> {
  await validateOpnameGudangAccess(input);
  const result = await runOpnameTransaction(tx, input);
  logCreatedOpname(input, result);
  return result;
}

/**
 * Tolak opname di gudang luar lingkup site pengguna. Permission diambil ulang
 * bila pemanggil tidak menyertakannya — tanpa permission, pembatasan site tidak
 * terlihat dan pemeriksaan ini akan selalu lolos.
 */
async function validateOpnameGudangAccess(input: CreateInventoryOpnameInput) {
  const permissions =
    input.user.permissions ?? (await getUserPermissions(input.user.id));
  const accessSession = await buildInventoryAccessSession(
    input.user,
    permissions,
  );
  const access = await validateGudangSiteAccess(
    accessSession,
    input.gudangId,
    IZIN_PEMBATAS_OPNAME,
  );

  if (!access.allowed) throw new Error(access.error || "Akses ditolak");
  return access;
}

async function runOpnameTransaction(
  tx: Prisma.TransactionClient,
  input: CreateInventoryOpnameInput,
): Promise<CreateOpnameTransactionResult> {
  const references = await findOpnameReferences(tx, input);
  ensureReferencesTenantConsistency(references);
  const stokSistem = references.currentStock?.stok || DEFAULT_EMPTY_TOTAL;
  const selisih = calculateStockDifference(input.stokFisik, stokSistem);
  const opnameRecord = await createOpnameRecord(tx, input, stokSistem, selisih);

  await catatPembuatanKeRiwayat(tx, input, references.barang, opnameRecord);

  await applyOpnameToStock(tx, {
    input,
    opnameId: opnameRecord.id,
    currentStock: references.currentStock,
    selisih,
  });
  return {
    opnameRecord,
    previousStock: stokSistem,
    newStock: input.stokFisik,
    selisih,
  };
}

/** Catat pembuatan catatan opname ke jejak perubahan, dalam transaksi yang sama. */
async function catatPembuatanKeRiwayat(
  tx: Prisma.TransactionClient,
  input: CreateInventoryOpnameInput,
  barang: { nama: string },
  opnameRecord: { id: string; tenantId: string | null },
) {
  await getStockOpnameRiwayatRepository().catat(tx, {
    opnameId: opnameRecord.id,
    gudangId: input.gudangId,
    barangId: input.barangId,
    tenantId: opnameRecord.tenantId,
    aksi: "DIBUAT",
    dilakukanOlehId: input.user.id,
    namaPelaku: namaPelaku(
      input.user.name,
      input.user.email,
      DEFAULT_ADMIN_PIC,
    ),
    namaBarang: barang.nama,
    perubahan: ringkasPembuatan(
      opnameRecord as unknown as Record<string, unknown>,
    ),
  });
}

async function findOpnameReferences(
  tx: Prisma.TransactionClient,
  input: CreateInventoryOpnameInput,
) {
  const [barang, gudang, currentStock] = await Promise.all([
    tx.barang.findUnique({ where: { id: input.barangId } }),
    tx.gudang.findUnique({ where: { id: input.gudangId, isActive: true } }),
    tx.barangGudang.findUnique({
      where: {
        barangId_gudangId: {
          barangId: input.barangId,
          gudangId: input.gudangId,
        },
      },
    }),
  ]);

  if (!barang) throw new Error("Barang tidak ditemukan");
  if (!gudang) throw new Error("Gudang tidak ditemukan atau tidak aktif");
  return { barang, gudang, currentStock };
}

function ensureReferencesTenantConsistency(references: OpnameReferences) {
  ensureTenantConsistency({
    barangTenantId: references.barang.tenantId,
    gudangTenantId: references.gudang.tenantId,
    currentStockTenantId: references.currentStock?.tenantId,
  });
}

function createOpnameRecord(
  tx: Prisma.TransactionClient,
  input: CreateInventoryOpnameInput,
  stokSistem: number,
  selisih: number,
) {
  return tx.stockOpname.create({
    data: buildOpnameCreateData({
      ...input,
      userName: input.user.name || DEFAULT_ADMIN_PIC,
      userEmail: input.user.email,
      stokSistem,
      selisih,
    }),
  });
}

/**
 * Terapkan selisih opname: catat mutasinya (tertaut lewat `opnameId`) lalu
 * sesuaikan stok pada kolom kondisi yang sama dengan mutasi itu.
 */
async function applyOpnameToStock(
  tx: Prisma.TransactionClient,
  input: {
    input: CreateInventoryOpnameInput;
    opnameId: string;
    currentStock: StokPerKondisi | null;
    selisih: number;
  },
) {
  const plan = planOpnameMovement({
    opnameId: input.opnameId,
    selisih: input.selisih,
    alasanSelisih: input.input.alasanSelisih,
    kondisiBaik: input.input.kondisiBaik,
    kondisiRusak: input.input.kondisiRusak,
    kondisiExpire: input.input.kondisiExpire,
  });
  if (plan) {
    await createOpnameMovement(tx, {
      location: input.input,
      opnameId: input.opnameId,
      plan,
    });
  }
  const sebelum = input.currentStock ?? STOK_KOSONG;
  const sesudah = await syncGudangStock(tx, {
    ...input,
    kondisi: resolveOpnameStockCondition(plan),
  });
  await tx.stockOpname.update({
    where: { id: input.opnameId },
    data: toStoredStockEffect(computeStockEffect(sebelum, sesudah)),
  });
}

async function syncGudangStock(
  tx: Prisma.TransactionClient,
  input: {
    input: CreateInventoryOpnameInput;
    currentStock: StokPerKondisi | null;
    selisih: number;
    kondisi: KondisiStok;
  },
) {
  if (input.currentStock) {
    return updateExistingGudangStock(tx, {
      ...input,
      currentStock: input.currentStock,
    });
  }
  if (input.input.stokFisik <= 0) return STOK_KOSONG;
  const row = buildInitialGudangStock(input.input, input.kondisi);
  await tx.barangGudang.create({ data: row });
  return pickStockColumns(row);
}

function pickStockColumns(row: StokPerKondisi): StokPerKondisi {
  return {
    stok: row.stok,
    stokBaru: row.stokBaru,
    stokBekas: row.stokBekas,
    stokRusak: row.stokRusak,
  };
}

async function updateExistingGudangStock(
  tx: Prisma.TransactionClient,
  input: {
    input: CreateInventoryOpnameInput;
    currentStock: StokPerKondisi;
    selisih: number;
    kondisi: KondisiStok;
  },
) {
  const columns = buildUpdatedStockData({
    stokFisik: input.input.stokFisik,
    selisih: input.selisih,
    kondisi: input.kondisi,
    currentStock: input.currentStock,
  });
  await tx.barangGudang.update({
    where: {
      barangId_gudangId: {
        barangId: input.input.barangId,
        gudangId: input.input.gudangId,
      },
    },
    data: columns,
  });
  return columns;
}

function logCreatedOpname(
  input: CreateInventoryOpnameInput,
  result: CreateOpnameTransactionResult,
) {
  logActivitySafe({
    action: "CREATE",
    subject: "Stock Opname",
    userId: input.user.id,
    details: {
      id: result.opnameRecord.id,
      barangId: input.barangId,
      gudangId: input.gudangId,
      diff: result.selisih,
    },
  });
}
