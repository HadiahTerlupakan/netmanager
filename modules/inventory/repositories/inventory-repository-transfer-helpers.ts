import { randomUUID } from "crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { STOCK_FIELD_MAP } from "@/lib/constants/inventory";
import type { CreateTransferInput } from "./IInventoryRepository";

export type TransferRepositoryDb = PrismaClient;

/** Ambil daftar transfer antar gudang beserta relasi ringkas. */
export async function findAllTransfers(
  db: TransferRepositoryDb,
  params?: {
    skip?: number;
    take?: number;
    barangId?: string;
    dariGudangId?: string;
    keGudangId?: string;
    siteId?: string;
    tenantId?: string;
  },
): Promise<{ items: Record<string, unknown>[]; total: number }> {
  const { skip, take, barangId, dariGudangId, keGudangId, siteId, tenantId } =
    params || {};
  const where: Prisma.TransferAntarGudangWhereInput = { tenantId };
  if (barangId) where.barangId = barangId;
  if (dariGudangId) where.dariGudangId = dariGudangId;
  if (keGudangId) where.keGudangId = keGudangId;
  if (siteId)
    where.OR = [
      { gudangDari: { sites: { some: { id: siteId } } } },
      { gudangKe: { sites: { some: { id: siteId } } } },
    ];
  const queryOptions: Prisma.TransferAntarGudangFindManyArgs = {
    where,
    include: buildTransferListInclude(),
    orderBy: { tanggal: "desc" },
    ...(skip !== undefined ? { skip } : {}),
    ...(take !== undefined ? { take } : {}),
  };
  const [rawItems, total] = await Promise.all([
    db.transferAntarGudang.findMany(queryOptions),
    db.transferAntarGudang.count({ where }),
  ]);
  return { items: mapTransferAliases(rawItems), total };
}

/** Ambil detail transfer antar gudang. */
export async function findTransferById(
  db: TransferRepositoryDb,
  id: string,
): Promise<Record<string, unknown> | null> {
  const transfer = (await db.transferAntarGudang.findUnique({
    where: { id },
    include: buildTransferDetailInclude(),
  })) as unknown as TransferDetailRecord | null;
  if (!transfer) return null;
  return {
    ...transfer,
    dariGudang: transfer.gudangDari,
    keGudang: transfer.gudangKe,
    masuk: transfer.barangMasuk?.[0] ?? null,
    keluar: transfer.barangKeluar?.[0] ?? null,
  };
}

/** Buat transfer antar gudang dan mutasi stok terkait. */
export async function createTransfer(
  db: TransferRepositoryDb,
  data: CreateTransferInput,
): Promise<Record<string, unknown>> {
  return db.$transaction(async (tx) => {
    const {
      barangId,
      dariGudangId,
      keGudangId,
      jumlah,
      kondisi = "BARU",
      tenantId,
    } = data;
    const barang = await tx.barang.findUnique({ where: { id: barangId } });
    if (!barang) throw new Error("Barang tidak ditemukan");
    const [dariGudang, keGudang] = await Promise.all([
      tx.gudang.findUnique({ where: { id: dariGudangId, isActive: true } }),
      tx.gudang.findUnique({ where: { id: keGudangId, isActive: true } }),
    ]);
    if (!dariGudang)
      throw new Error("Gudang sumber tidak ditemukan atau tidak aktif");
    if (!keGudang)
      throw new Error("Gudang tujuan tidak ditemukan atau tidak aktif");
    const stockField = STOCK_FIELD_MAP[kondisi] || "stokBaru";
    await decrementSourceStock(tx, {
      barangId,
      gudangId: dariGudangId,
      jumlah,
      kondisi,
      stockField,
    });
    const transfer = await createTransferRecord(tx, data, stockField);
    await createTransferHistories(tx, {
      transferId: transfer.id,
      data,
      dariGudangName: dariGudang.nama,
      keGudangName: keGudang.nama,
    });
    await incrementDestinationStock(tx, {
      barangId,
      gudangId: keGudangId,
      jumlah,
      kondisi,
      tenantId,
      stockField,
    });
    return transfer;
  });
}

/** Ubah keterangan transfer antar gudang. */
export async function updateTransfer(
  db: TransferRepositoryDb,
  id: string,
  data: { keterangan?: string },
): Promise<Record<string, unknown>> {
  return db.transferAntarGudang.update({
    where: { id },
    data,
    include: {
      barang: { select: { id: true, kode: true, nama: true } },
      gudangDari: { select: { id: true, kode: true, nama: true } },
      gudangKe: { select: { id: true, kode: true, nama: true } },
    },
  }) as unknown as Promise<Record<string, unknown>>;
}

/** Hapus transfer antar gudang dan rollback mutasi stok. */
export async function deleteTransfer(
  db: TransferRepositoryDb,
  id: string,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const transfer = await tx.transferAntarGudang.findUnique({
      where: { id },
      include: { barangMasuk: true, barangKeluar: true },
    });
    if (!transfer) throw new Error("Record transfer tidak ditemukan");
    const stockField = STOCK_FIELD_MAP[transfer.kondisi] || "stokBaru";
    await decrementDestinationStock(tx, transfer, stockField);
    await restoreSourceStock(tx, transfer, stockField);
    await tx.barangMasuk.deleteMany({ where: { transferId: id } });
    await tx.barangKeluar.deleteMany({ where: { transferId: id } });
    await tx.transferAntarGudang.delete({ where: { id } });
  });
}

function buildTransferListInclude() {
  return {
    barang: { select: { id: true, kode: true, nama: true, satuan: true } },
    gudangDari: { select: { id: true, kode: true, nama: true, lokasi: true } },
    gudangKe: { select: { id: true, kode: true, nama: true, lokasi: true } },
    createdBy: { select: { id: true, name: true, email: true } },
  };
}

function buildTransferDetailInclude() {
  return {
    barang: { select: { id: true, kode: true, nama: true, satuan: true } },
    gudangDari: { select: { id: true, kode: true, nama: true, lokasi: true } },
    gudangKe: { select: { id: true, kode: true, nama: true, lokasi: true } },
    barangMasuk: {
      select: {
        id: true,
        tanggal: true,
        jumlah: true,
        kondisi: true,
        keterangan: true,
      },
    },
    barangKeluar: {
      select: {
        id: true,
        tanggal: true,
        jumlah: true,
        kondisi: true,
        keterangan: true,
      },
    },
  };
}

function mapTransferAliases(rawItems: unknown[]) {
  return (rawItems as Array<{ gudangDari: unknown; gudangKe: unknown }>).map(
    (item) => ({
      ...item,
      dariGudang: item.gudangDari,
      keGudang: item.gudangKe,
    }),
  );
}

async function decrementSourceStock(
  tx: Prisma.TransactionClient,
  input: {
    barangId: string;
    gudangId: string;
    jumlah: number;
    kondisi: string;
    stockField: string;
  },
) {
  const updatedSumber = await tx.barangGudang.updateMany({
    where: {
      barangId: input.barangId,
      gudangId: input.gudangId,
      stok: { gte: input.jumlah },
      [input.stockField]: { gte: input.jumlah },
    },
    data: {
      stok: { decrement: input.jumlah },
      [input.stockField]: { decrement: input.jumlah },
      updatedAt: new Date(),
    } as Prisma.BarangGudangUpdateInput,
  });
  if (updatedSumber.count === 0)
    throw new Error(`Stok ${input.kondisi.toLowerCase()} tidak mencukupi`);
}

async function createTransferRecord(
  tx: Prisma.TransactionClient,
  data: CreateTransferInput,
  _stockField: string,
) {
  return tx.transferAntarGudang.create({
    data: {
      id: randomUUID(),
      kodeTransfer: `TRF${Date.now()}`,
      barangId: data.barangId,
      dariGudangId: data.dariGudangId,
      keGudangId: data.keGudangId,
      jumlah: data.jumlah,
      kondisi: data.kondisi || "BARU",
      keterangan: data.keterangan || null,
      createdById: data.userId,
      fotoBukti: data.fotoBukti || [],
      fotoMetadata:
        (data.fotoMetadata as unknown as Prisma.InputJsonValue) ||
        Prisma.JsonNull,
      tenantId: data.tenantId,
    },
  });
}

async function createTransferHistories(
  tx: Prisma.TransactionClient,
  input: {
    transferId: string;
    data: CreateTransferInput;
    dariGudangName: string;
    keGudangName: string;
  },
) {
  const kondisi = input.data.kondisi || "BARU";
  await tx.barangKeluar.create({
    data: {
      id: randomUUID(),
      barangId: input.data.barangId,
      gudangId: input.data.dariGudangId,
      transferId: input.transferId,
      jumlah: input.data.jumlah,
      kondisi,
      keterangan: `Transfer ke ${input.keGudangName}`,
      userId: input.data.userId,
      tenantId: input.data.tenantId,
    },
  });
  await tx.barangMasuk.create({
    data: {
      id: randomUUID(),
      barangId: input.data.barangId,
      gudangId: input.data.keGudangId,
      transferId: input.transferId,
      jumlah: input.data.jumlah,
      kondisi,
      keterangan: `Transfer dari ${input.dariGudangName}`,
      userId: input.data.userId,
      tenantId: input.data.tenantId,
    },
  });
}

async function incrementDestinationStock(
  tx: Prisma.TransactionClient,
  input: {
    barangId: string;
    gudangId: string;
    jumlah: number;
    kondisi: string;
    tenantId?: string;
    stockField: string;
  },
) {
  await tx.barangGudang.upsert({
    where: {
      barangId_gudangId: { barangId: input.barangId, gudangId: input.gudangId },
    },
    create: {
      id: randomUUID(),
      barangId: input.barangId,
      gudangId: input.gudangId,
      stok: input.jumlah,
      stokBaru: input.kondisi === "BARU" ? input.jumlah : 0,
      stokBekas: input.kondisi === "BEKAS" ? input.jumlah : 0,
      stokRusak: input.kondisi === "RUSAK" ? input.jumlah : 0,
      updatedAt: new Date(),
      tenantId: input.tenantId,
    },
    update: {
      stok: { increment: input.jumlah },
      [input.stockField]: { increment: input.jumlah },
      updatedAt: new Date(),
    } as Prisma.BarangGudangUpdateInput,
  });
}

async function decrementDestinationStock(
  tx: Prisma.TransactionClient,
  transfer: { barangId: string; keGudangId: string; jumlah: number },
  stockField: string,
) {
  const updatedTujuan = await tx.barangGudang.updateMany({
    where: {
      barangId: transfer.barangId,
      gudangId: transfer.keGudangId,
      stok: { gte: transfer.jumlah },
      [stockField]: { gte: transfer.jumlah },
    },
    data: {
      stok: { decrement: transfer.jumlah },
      [stockField]: { decrement: transfer.jumlah },
      updatedAt: new Date(),
    } as Prisma.BarangGudangUpdateInput,
  });
  if (updatedTujuan.count === 0)
    throw new Error("Stok di gudang tujuan tidak mencukupi");
}

async function restoreSourceStock(
  tx: Prisma.TransactionClient,
  transfer: {
    barangId: string;
    dariGudangId: string;
    jumlah: number;
    kondisi: string;
    tenantId: string | null;
  },
  stockField: string,
) {
  await tx.barangGudang.upsert({
    where: {
      barangId_gudangId: {
        barangId: transfer.barangId,
        gudangId: transfer.dariGudangId,
      },
    },
    create: {
      id: randomUUID(),
      barangId: transfer.barangId,
      gudangId: transfer.dariGudangId,
      stok: transfer.jumlah,
      stokBaru: transfer.kondisi === "BARU" ? transfer.jumlah : 0,
      stokBekas: transfer.kondisi === "BEKAS" ? transfer.jumlah : 0,
      stokRusak: transfer.kondisi === "RUSAK" ? transfer.jumlah : 0,
      updatedAt: new Date(),
      tenantId: transfer.tenantId,
    },
    update: {
      stok: { increment: transfer.jumlah },
      [stockField]: { increment: transfer.jumlah },
      updatedAt: new Date(),
    } as Prisma.BarangGudangUpdateInput,
  });
}

type TransferDetailRecord = Record<string, unknown> & {
  gudangDari?: Record<string, unknown>;
  gudangKe?: Record<string, unknown>;
  barangMasuk?: Record<string, unknown>[];
  barangKeluar?: Record<string, unknown>[];
};
