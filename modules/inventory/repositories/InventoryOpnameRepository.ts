import type { PrismaClient } from "@prisma/client";
import type {
  InventoryOpnameRecord,
  UpdateStockOpnameInput,
  UpdatedStockOpnameResult,
} from "./IInventoryRepository";

export class InventoryOpnameRepository {
  constructor(private readonly db: PrismaClient) {}

  /** Find opname record with item and warehouse details. */
  async getOpnameRecord(id: string): Promise<InventoryOpnameRecord | null> {
    return this.db.stockOpname.findUnique({
      where: { id },
      include: {
        barang: { select: { id: true, kode: true, nama: true, satuan: true } },
        gudang: { select: { id: true, kode: true, nama: true, lokasi: true } },
      },
    }) as unknown as Promise<InventoryOpnameRecord | null>;
  }

  /** Update opname record and synchronize physical stock delta. */
  async updateOpname(
    input: UpdateStockOpnameInput,
  ): Promise<UpdatedStockOpnameResult> {
    return this.db.$transaction(async (tx) => {
      const context = await this.getUpdateContext(tx, input.id);
      const stokSistem = context.currentStock?.stok || 0;
      const selisihFisik = input.stokFisik - context.existingRecord.stokFisik;
      const selisihBaru = input.stokFisik - context.existingRecord.stokSistem;
      const updatedRecord = await tx.stockOpname.update({
        where: { id: input.id },
        data: this.buildUpdatePayload(
          input,
          context.existingRecord,
          selisihBaru,
        ),
      });

      await this.applyStockDelta(tx, context, input.stokFisik, selisihFisik);
      return {
        record: updatedRecord as unknown as Record<string, unknown>,
        stokSistem,
        selisih: selisihBaru,
      };
    });
  }

  /** Delete opname record and restore stock delta. */
  async deleteOpname(id: string): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const existingRecord = await tx.stockOpname.findUnique({
        where: { id: id.trim() },
      });
      if (!existingRecord)
        throw new Error("Record stock opname tidak ditemukan");
      const currentStock = await tx.barangGudang.findUnique({
        where: this.buildStockKey(
          existingRecord.barangId,
          existingRecord.gudangId,
        ),
      });

      if (currentStock) {
        await tx.barangGudang.update({
          where: this.buildStockKey(
            existingRecord.barangId,
            existingRecord.gudangId,
          ),
          data: {
            stok: Math.max(0, currentStock.stok - existingRecord.selisih),
            stokBaru: Math.max(
              0,
              currentStock.stokBaru - existingRecord.selisih,
            ),
          },
        });
      }
      await tx.stockOpname.delete({ where: { id: id.trim() } });
    });
  }

  private async getUpdateContext(
    tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0],
    id: string,
  ) {
    const existingRecord = await tx.stockOpname.findUnique({
      where: { id },
      include: { barang: true, gudang: true },
    });
    if (!existingRecord) throw new Error("Record stock opname tidak ditemukan");
    const currentStock = await tx.barangGudang.findUnique({
      where: this.buildStockKey(
        existingRecord.barangId,
        existingRecord.gudangId,
      ),
    });
    return { existingRecord, currentStock };
  }

  private buildUpdatePayload(
    input: UpdateStockOpnameInput,
    existingRecord: {
      kondisiBaik: number | null;
      kondisiRusak: number | null;
      kondisiExpire: number | null;
      tanggalExpire: Date | null;
    },
    selisih: number,
  ) {
    return {
      stokFisik: input.stokFisik,
      selisih,
      keterangan: input.keterangan,
      kondisiBaik: input.kondisiBaik ?? existingRecord.kondisiBaik,
      kondisiRusak: input.kondisiRusak ?? existingRecord.kondisiRusak,
      kondisiExpire: input.kondisiExpire ?? existingRecord.kondisiExpire,
      lokasiPenyimpanan: input.lokasiPenyimpanan,
      nomorRak: input.nomorRak,
      nomorBox: input.nomorBox,
      pic: input.pic,
      suhuPenyimpanan: this.toNullableNumber(input.suhuPenyimpanan),
      kelembaban: this.toNullableNumber(input.kelembaban),
      tanggalExpire: input.tanggalExpire
        ? new Date(input.tanggalExpire)
        : existingRecord.tanggalExpire,
      nomorBatch: input.nomorBatch,
      catatanDetail: input.catatanDetail,
    };
  }

  private async applyStockDelta(
    tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0],
    context: Awaited<ReturnType<InventoryOpnameRepository["getUpdateContext"]>>,
    stokFisik: number,
    selisihFisik: number,
  ) {
    const { existingRecord, currentStock } = context;
    if (currentStock) {
      await tx.barangGudang.update({
        where: this.buildStockKey(
          existingRecord.barangId,
          existingRecord.gudangId,
        ),
        data: {
          stok: Math.max(0, currentStock.stok + selisihFisik),
          stokBaru: Math.max(0, currentStock.stokBaru + selisihFisik),
        },
      });
      return;
    }
    if (stokFisik > 0) await this.createStockFromOpname(tx, context, stokFisik);
  }

  private async createStockFromOpname(
    tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0],
    context: Awaited<ReturnType<InventoryOpnameRepository["getUpdateContext"]>>,
    stokFisik: number,
  ) {
    await tx.barangGudang.create({
      data: {
        id: crypto.randomUUID(),
        barangId: context.existingRecord.barangId,
        gudangId: context.existingRecord.gudangId,
        stok: stokFisik,
        updatedAt: new Date(),
      },
    });
  }

  private buildStockKey(barangId: string, gudangId: string) {
    return { barangId_gudangId: { barangId, gudangId } };
  }

  private toNullableNumber(value: unknown) {
    return value !== undefined && value !== null ? Number(value) : null;
  }
}
