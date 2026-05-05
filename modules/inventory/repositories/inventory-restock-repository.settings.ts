import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";

const DEFAULT_RESTOCK_LEAD_DAYS = 7;
const THIRTY_DAYS = 30;

type RestockSettingsInput = {
  barangId: string;
  gudangId: string;
  minStok: number;
  maxStok: number;
  safetyStok?: number;
  leadTimeDays?: number;
};

/** Ambil konteks validasi barang, gudang, dan rata-rata usage untuk setting restock. */
export async function getRestockSettingContext(
  tx: Prisma.TransactionClient,
  input: Pick<RestockSettingsInput, "barangId" | "gudangId">,
) {
  const [barang, gudang, usageData] = await Promise.all([
    tx.barang.findUnique({ where: { id: input.barangId } }),
    tx.gudang.findUnique({ where: { id: input.gudangId, isActive: true } }),
    findRecentUsage(tx, input),
  ]);

  if (!barang) throw new Error("Barang tidak ditemukan");
  if (!gudang) throw new Error("Gudang tidak ditemukan atau tidak aktif");

  return {
    barang,
    gudang,
    avgDailyUsage: (usageData._sum.jumlah || 0) / THIRTY_DAYS,
  };
}

/** Simpan atau aktifkan kembali setting restock. */
export function upsertRestockSettings(
  tx: Prisma.TransactionClient,
  input: RestockSettingsInput,
  avgDailyUsage: number,
) {
  const commonData = {
    minStok: input.minStok,
    maxStok: input.maxStok,
    safetyStok: input.safetyStok || 0,
    leadTimeDays: input.leadTimeDays || DEFAULT_RESTOCK_LEAD_DAYS,
    avgDailyUsage,
  };

  return tx.restockSettings.upsert({
    where: {
      barangId_gudangId: { barangId: input.barangId, gudangId: input.gudangId },
    },
    update: { ...commonData, lastUsageCalculation: new Date(), isActive: true },
    create: {
      id: randomUUID(),
      barangId: input.barangId,
      gudangId: input.gudangId,
      ...commonData,
      updatedAt: new Date(),
    },
    include: {
      barang: { select: { id: true, kode: true, nama: true, satuan: true } },
      gudang: { select: { id: true, kode: true, nama: true } },
    },
  });
}

function findRecentUsage(
  tx: Prisma.TransactionClient,
  input: Pick<RestockSettingsInput, "barangId" | "gudangId">,
) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - THIRTY_DAYS);
  return tx.barangKeluar.aggregate({
    where: {
      barangId: input.barangId,
      gudangId: input.gudangId,
      tanggal: { gte: thirtyDaysAgo },
    },
    _sum: { jumlah: true },
  });
}
