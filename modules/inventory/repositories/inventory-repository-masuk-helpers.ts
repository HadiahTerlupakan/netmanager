import { randomUUID } from "crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { STOCK_FIELD_MAP } from "@/lib/constants/inventory";
import type {
  InventoryMasukRecord,
  UpdateBarangMasukInput,
} from "../domain/ports/IInventoryOperationRepository";

/** Ambil detail record barang masuk. */
export async function getMasukRecord(
  db: PrismaClient,
  id: string,
): Promise<InventoryMasukRecord | null> {
  return db.barangMasuk.findUnique({
    where: { id },
    include: {
      barang: { select: { id: true, kode: true, nama: true, satuan: true } },
      gudang: {
        select: {
          id: true,
          kode: true,
          nama: true,
          sites: { select: { id: true } },
        },
      },
    },
  }) as unknown as Promise<InventoryMasukRecord | null>;
}

/** Ubah record barang masuk dan sesuaikan stok gudang. */
export async function updateMasuk(
  db: PrismaClient,
  input: UpdateBarangMasukInput,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const currentRecord = await tx.barangMasuk.findUnique({
      where: { id: input.id },
      include: { barang: true, gudang: true },
    });
    if (!currentRecord) throw new Error("Record barang masuk tidak ditemukan");
    const stockDifference = input.jumlah - currentRecord.jumlah;
    const kondisiBaru = (input.kondisi ||
      currentRecord.kondisi) as keyof typeof STOCK_FIELD_MAP;
    await tx.barangMasuk.update({
      where: { id: input.id },
      data: {
        jumlah: input.jumlah,
        kondisi: kondisiBaru,
        keterangan: input.keterangan,
      },
    });
    const currentStock = await tx.barangGudang.findUnique({
      where: {
        barangId_gudangId: {
          barangId: currentRecord.barangId,
          gudangId: currentRecord.gudangId,
        },
      },
    });
    if (!currentStock) {
      await createStockFromMasuk(
        tx,
        currentRecord.barangId,
        currentRecord.gudangId,
        input.jumlah,
        kondisiBaru,
      );
      return;
    }
    await updateExistingMasukStock(tx, {
      currentStock,
      currentRecord,
      input,
      stockDifference,
      kondisiBaru,
    });
  });
}

/** Hapus record barang masuk dan rollback stok gudang. */
export async function deleteMasuk(db: PrismaClient, id: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const masukRecord = await tx.barangMasuk.findUnique({
      where: { id },
      include: { barang: true, gudang: true },
    });
    if (!masukRecord) throw new Error("Record barang masuk tidak ditemukan");
    const currentStock = await tx.barangGudang.findUnique({
      where: {
        barangId_gudangId: {
          barangId: masukRecord.barangId,
          gudangId: masukRecord.gudangId,
        },
      },
    });
    if (currentStock)
      await rollbackMasukStock(tx, { currentStock, masukRecord });
    await tx.barangMasuk.delete({ where: { id } });
  });
}

async function createStockFromMasuk(
  tx: Prisma.TransactionClient,
  barangId: string,
  gudangId: string,
  jumlah: number,
  kondisi: keyof typeof STOCK_FIELD_MAP,
) {
  const newStockField = STOCK_FIELD_MAP[kondisi] || "stokBaru";
  await tx.barangGudang.create({
    data: {
      id: randomUUID(),
      barangId,
      gudangId,
      stok: jumlah,
      [newStockField]: jumlah,
      updatedAt: new Date(),
    },
  });
}

async function updateExistingMasukStock(
  tx: Prisma.TransactionClient,
  input: {
    currentStock: Record<string, unknown> & { stok: number };
    currentRecord: {
      barangId: string;
      gudangId: string;
      jumlah: number;
      kondisi: string;
    };
    updateData?: never;
    input: UpdateBarangMasukInput;
    stockDifference: number;
    kondisiBaru: keyof typeof STOCK_FIELD_MAP;
  },
) {
  const newTotalStock = input.currentStock.stok + input.stockDifference;
  if (newTotalStock < 0) throw new Error("Stok tidak bisa negatif");
  const oldKondisi = input.currentRecord
    .kondisi as keyof typeof STOCK_FIELD_MAP;
  const oldStockField = STOCK_FIELD_MAP[oldKondisi] || "stokBaru";
  const newStockField = STOCK_FIELD_MAP[input.kondisiBaru] || "stokBaru";
  const updateData: Record<string, number> = { stok: newTotalStock };
  if (oldStockField === newStockField) {
    updateData[newStockField] = getNonNegativeConditionStock(
      input.currentStock,
      oldStockField,
      input.stockDifference,
      input.kondisiBaru,
    );
  } else {
    updateData[oldStockField] = getNonNegativeConditionStock(
      input.currentStock,
      oldStockField,
      -input.currentRecord.jumlah,
      oldKondisi,
    );
    updateData[newStockField] =
      Number(input.currentStock[newStockField] || 0) + input.input.jumlah;
  }
  await tx.barangGudang.update({
    where: {
      barangId_gudangId: {
        barangId: input.currentRecord.barangId,
        gudangId: input.currentRecord.gudangId,
      },
    },
    data: updateData,
  });
}

function getNonNegativeConditionStock(
  stock: Record<string, unknown>,
  field: string,
  delta: number,
  kondisi: string,
) {
  const result = Number(stock[field] || 0) + delta;
  if (result < 0) throw new Error(`Stok ${kondisi} tidak bisa negatif`);
  return result;
}

async function rollbackMasukStock(
  tx: Prisma.TransactionClient,
  input: {
    currentStock: Record<string, unknown> & { stok: number };
    masukRecord: {
      barangId: string;
      gudangId: string;
      jumlah: number;
      kondisi: string;
    };
  },
) {
  const newStock = Math.max(
    0,
    input.currentStock.stok - input.masukRecord.jumlah,
  );
  const stockField =
    STOCK_FIELD_MAP[
      input.masukRecord.kondisi as keyof typeof STOCK_FIELD_MAP
    ] || "stokBaru";
  if (newStock === 0) {
    await tx.barangGudang.delete({
      where: {
        barangId_gudangId: {
          barangId: input.masukRecord.barangId,
          gudangId: input.masukRecord.gudangId,
        },
      },
    });
    return;
  }
  await tx.barangGudang.update({
    where: {
      barangId_gudangId: {
        barangId: input.masukRecord.barangId,
        gudangId: input.masukRecord.gudangId,
      },
    },
    data: {
      stok: newStock,
      [stockField]: Math.max(
        0,
        Number(input.currentStock[stockField] || 0) - input.masukRecord.jumlah,
      ),
    },
  });
}
