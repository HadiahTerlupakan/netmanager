import { randomUUID } from "crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import type {
  CreateTransferInput,
  InventoryTransferRecord,
  UpdateTransferInput,
} from "../domain/ports/IInventoryOperationRepository";
import {
  mapTransferRecord,
  TRANSFER_LIST_INCLUDE,
} from "./inventory-repository-transfer-helpers";
import {
  buildDecrementBarangGudangPayload,
  buildIncrementBarangGudangPayload,
  getStockFieldByCondition,
  type InventoryStockField,
} from "./inventory-stock-helpers";

type TransferRepositoryDb = PrismaClient;

type TransferStockMutation = {
  barangId: string;
  gudangId: string;
  jumlah: number;
  kondisi: string;
  tenantId?: string | null;
  stockField: InventoryStockField;
};

type TransferRecord = {
  id: string;
  barangId: string;
  dariGudangId: string;
  keGudangId: string;
  jumlah: number;
  kondisi: string;
  tenantId: string | null;
};

const TRANSFER_CODE_PREFIX = "TRF";

/** Buat transfer antar gudang dan mutasi stok terkait. */
export async function createTransfer(
  db: TransferRepositoryDb,
  data: CreateTransferInput,
): Promise<InventoryTransferRecord> {
  return db.$transaction(async (tx) => {
    await assertBarangExists(tx, data.barangId);
    const gudang = await getTransferGudangs(tx, data);
    const sourceStock = buildTransferStockMutation({
      barangId: data.barangId,
      gudangId: data.dariGudangId,
      jumlah: data.jumlah,
      kondisi: data.kondisi,
      tenantId: data.tenantId,
    });

    await decrementTransferStock(
      tx,
      sourceStock,
      `Stok ${sourceStock.kondisi.toLowerCase()} tidak mencukupi`,
    );

    const transfer = await createTransferRecord(tx, data);
    await createTransferHistories(tx, {
      transferId: transfer.id,
      data,
      dariGudangName: gudang.dari.nama,
      keGudangName: gudang.ke.nama,
    });
    await upsertTransferStock(tx, {
      ...sourceStock,
      gudangId: data.keGudangId,
    });

    return mapTransferRecord(transfer);
  });
}

/** Ubah keterangan transfer antar gudang. */
export async function updateTransfer(
  db: TransferRepositoryDb,
  id: string,
  data: UpdateTransferInput,
): Promise<InventoryTransferRecord> {
  const transfer = await db.transferAntarGudang.update({
    where: { id },
    data,
    include: TRANSFER_LIST_INCLUDE,
  });

  return mapTransferRecord(transfer);
}

/** Hapus transfer antar gudang dan rollback mutasi stok. */
export async function deleteTransfer(
  db: TransferRepositoryDb,
  id: string,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const transfer = (await tx.transferAntarGudang.findUnique({
      where: { id },
    })) as TransferRecord | null;
    if (!transfer) throw new Error("Record transfer tidak ditemukan");

    await decrementTransferStock(
      tx,
      buildTransferStockMutation({
        barangId: transfer.barangId,
        gudangId: transfer.keGudangId,
        jumlah: transfer.jumlah,
        kondisi: transfer.kondisi,
        tenantId: transfer.tenantId,
      }),
      "Stok di gudang tujuan tidak mencukupi",
    );
    await upsertTransferStock(tx, {
      ...buildTransferStockMutation({
        barangId: transfer.barangId,
        gudangId: transfer.dariGudangId,
        jumlah: transfer.jumlah,
        kondisi: transfer.kondisi,
        tenantId: transfer.tenantId,
      }),
      tenantId: transfer.tenantId,
    });
    await tx.barangMasuk.deleteMany({ where: { transferId: id } });
    await tx.barangKeluar.deleteMany({ where: { transferId: id } });
    await tx.transferAntarGudang.delete({ where: { id } });
  });
}

async function assertBarangExists(
  tx: Prisma.TransactionClient,
  barangId: string,
): Promise<void> {
  const barang = await tx.barang.findUnique({ where: { id: barangId } });
  if (!barang) throw new Error("Barang tidak ditemukan");
}

function buildTransferStockMutation(input: {
  barangId: string;
  gudangId: string;
  jumlah: number;
  kondisi?: string | null;
  tenantId?: string | null;
}): TransferStockMutation {
  const kondisi = input.kondisi || "BARU";

  return {
    barangId: input.barangId,
    gudangId: input.gudangId,
    jumlah: input.jumlah,
    kondisi,
    tenantId: input.tenantId ?? null,
    stockField: getStockFieldByCondition(kondisi),
  };
}

async function getTransferGudangs(
  tx: Prisma.TransactionClient,
  data: CreateTransferInput,
) {
  const [dari, ke] = await Promise.all([
    tx.gudang.findUnique({ where: { id: data.dariGudangId, isActive: true } }),
    tx.gudang.findUnique({ where: { id: data.keGudangId, isActive: true } }),
  ]);

  if (!dari) throw new Error("Gudang sumber tidak ditemukan atau tidak aktif");
  if (!ke) throw new Error("Gudang tujuan tidak ditemukan atau tidak aktif");

  return { dari, ke };
}

async function decrementTransferStock(
  tx: Prisma.TransactionClient,
  input: TransferStockMutation,
  message: string,
): Promise<void> {
  const updated = await tx.barangGudang.updateMany({
    where: {
      barangId: input.barangId,
      gudangId: input.gudangId,
      stok: { gte: input.jumlah },
      [input.stockField]: { gte: input.jumlah },
    },
    data: {
      ...buildDecrementBarangGudangPayload({
        stockField: input.stockField,
        quantity: input.jumlah,
      }),
      updatedAt: new Date(),
    } as Prisma.BarangGudangUpdateInput,
  });

  if (updated.count === 0) {
    throw new Error(message);
  }
}

async function upsertTransferStock(
  tx: Prisma.TransactionClient,
  input: TransferStockMutation,
): Promise<void> {
  const stockMutation = buildIncrementBarangGudangPayload({
    barangId: input.barangId,
    gudangId: input.gudangId,
    quantity: input.jumlah,
    kondisi: input.kondisi,
    tenantId: input.tenantId,
  });

  await tx.barangGudang.upsert({
    where: {
      barangId_gudangId: { barangId: input.barangId, gudangId: input.gudangId },
    },
    create: stockMutation.create,
    update: stockMutation.update,
  });
}

function generateTransferCode(): string {
  return `${TRANSFER_CODE_PREFIX}-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function createTransferRecord(
  tx: Prisma.TransactionClient,
  data: CreateTransferInput,
) {
  return tx.transferAntarGudang.create({
    data: {
      id: randomUUID(),
      kodeTransfer: generateTransferCode(),
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
): Promise<void> {
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
