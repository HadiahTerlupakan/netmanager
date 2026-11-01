import { randomUUID } from "crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import type {
  CreateTransferInput,
  InventoryTransferRecord,
  UpdateTransferInput,
} from "../domain/ports/IInventoryOperationRepository";
import {
  buildBatalStokTujuanKurangMessage,
  buildStokAsalKurangMessage,
  TRANSFER_MESSAGES,
  TransferRejectedError,
} from "../domain/transfer-errors";
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
  barang: { nama: string };
  gudangDari: { nama: string };
  gudangKe: { nama: string };
};

/** Penyusun pesan saat stok tidak cukup, menerima jumlah yang benar-benar tersedia. */
type StokKurangMessageBuilder = (tersedia: number) => string;

const TRANSFER_CODE_PREFIX = "TRF";

/** Buat transfer antar gudang dan mutasi stok terkait. */
export async function createTransfer(
  db: TransferRepositoryDb,
  data: CreateTransferInput,
): Promise<InventoryTransferRecord> {
  return db.$transaction(async (tx) => {
    const barang = await findTransferBarang(tx, data.barangId);
    const gudang = await getTransferGudangs(tx, data);
    const sourceStock = buildTransferStockMutation({
      barangId: data.barangId,
      gudangId: data.dariGudangId,
      jumlah: data.jumlah,
      kondisi: data.kondisi,
      tenantId: data.tenantId,
    });

    await decrementTransferStock(tx, sourceStock, (tersedia) =>
      buildStokAsalKurangMessage({
        barangNama: barang.nama,
        gudangNama: gudang.dari.nama,
        kondisi: sourceStock.kondisi,
        tersedia,
        diminta: data.jumlah,
      }),
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
      include: {
        barang: { select: { nama: true } },
        gudangDari: { select: { nama: true } },
        gudangKe: { select: { nama: true } },
      },
    })) as TransferRecord | null;
    if (!transfer) {
      throw new TransferRejectedError(404, TRANSFER_MESSAGES.transferTidakAda);
    }

    await decrementTransferStock(
      tx,
      buildTransferStockMutation({
        barangId: transfer.barangId,
        gudangId: transfer.keGudangId,
        jumlah: transfer.jumlah,
        kondisi: transfer.kondisi,
        tenantId: transfer.tenantId,
      }),
      (tersedia) =>
        buildBatalStokTujuanKurangMessage({
          barangNama: transfer.barang.nama,
          gudangAsalNama: transfer.gudangDari.nama,
          gudangTujuanNama: transfer.gudangKe.nama,
          kondisi: transfer.kondisi,
          tersedia,
          harusKembali: transfer.jumlah,
        }),
      409,
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

async function findTransferBarang(
  tx: Prisma.TransactionClient,
  barangId: string,
): Promise<{ nama: string }> {
  const barang = await tx.barang.findUnique({
    where: { id: barangId },
    select: { nama: true },
  });
  if (!barang) {
    throw new TransferRejectedError(404, TRANSFER_MESSAGES.barangTidakAda);
  }
  return barang;
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

  if (!dari) {
    throw new TransferRejectedError(
      400,
      TRANSFER_MESSAGES.gudangAsalTidakAktif,
    );
  }
  if (!ke) {
    throw new TransferRejectedError(
      400,
      TRANSFER_MESSAGES.gudangTujuanTidakAktif,
    );
  }

  return { dari, ke };
}

async function decrementTransferStock(
  tx: Prisma.TransactionClient,
  input: TransferStockMutation,
  buildMessage: StokKurangMessageBuilder,
  status: 400 | 409 = 400,
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
    const tersedia = await findAvailableStock(tx, input);
    throw new TransferRejectedError(status, buildMessage(tersedia));
  }
}

/** Stok yang benar-benar bisa diambil: dibatasi stok total dan stok kondisinya. */
async function findAvailableStock(
  tx: Prisma.TransactionClient,
  input: TransferStockMutation,
): Promise<number> {
  const record = await tx.barangGudang.findUnique({
    where: {
      barangId_gudangId: { barangId: input.barangId, gudangId: input.gudangId },
    },
  });
  if (!record) return 0;
  const stokKondisi = Number(record[input.stockField] ?? 0);
  return Math.max(0, Math.min(record.stok, stokKondisi));
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
