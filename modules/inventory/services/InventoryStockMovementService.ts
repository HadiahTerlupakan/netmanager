import { STOCK_FIELD_MAP } from "@/lib/constants/inventory";
import { prisma } from "@/modules/database";

export class InventoryStockMovementService {
  async getMasukRecord(id: string) {
    return prisma.barangMasuk.findUnique({
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
    });
  }

  async updateMasuk(input: {
    id: string;
    jumlah: number;
    kondisi?: string | null;
    keterangan?: string | null;
  }) {
    await prisma.$transaction(async (tx) => {
      const currentRecord = await tx.barangMasuk.findUnique({
        where: { id: input.id },
        include: {
          barang: true,
          gudang: true,
        },
      });

      if (!currentRecord) {
        throw new Error("Record barang masuk tidak ditemukan");
      }

      const stockDifference = input.jumlah - currentRecord.jumlah;

      await tx.barangMasuk.update({
        where: { id: input.id },
        data: {
          jumlah: input.jumlah,
          kondisi: (input.kondisi ||
            currentRecord.kondisi) as typeof currentRecord.kondisi,
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

      if (currentStock) {
        const newTotalStock = currentStock.stok + stockDifference;
        if (newTotalStock < 0) {
          throw new Error("Stok tidak bisa negatif");
        }

        const oldKondisi =
          currentRecord.kondisi as keyof typeof STOCK_FIELD_MAP;
        const newKondisi = (input.kondisi ||
          currentRecord.kondisi) as keyof typeof STOCK_FIELD_MAP;
        const oldStockField = STOCK_FIELD_MAP[oldKondisi] || "stokBaru";
        const newStockField = STOCK_FIELD_MAP[newKondisi] || "stokBaru";

        const updateData: Record<string, number> = { stok: newTotalStock };

        if (oldStockField === newStockField) {
          const newConditionStock =
            Number(
              (currentStock as Record<string, unknown>)[oldStockField] || 0,
            ) + stockDifference;
          if (newConditionStock < 0) {
            throw new Error(`Stok ${newKondisi} tidak bisa negatif`);
          }
          updateData[newStockField] = newConditionStock;
        } else {
          const oldConditionStock =
            Number(
              (currentStock as Record<string, unknown>)[oldStockField] || 0,
            ) - currentRecord.jumlah;
          if (oldConditionStock < 0) {
            throw new Error(`Stok ${oldKondisi} tidak bisa negatif`);
          }

          const newConditionStock =
            Number(
              (currentStock as Record<string, unknown>)[newStockField] || 0,
            ) + input.jumlah;
          updateData[oldStockField] = oldConditionStock;
          updateData[newStockField] = newConditionStock;
        }

        await tx.barangGudang.update({
          where: {
            barangId_gudangId: {
              barangId: currentRecord.barangId,
              gudangId: currentRecord.gudangId,
            },
          },
          data: updateData,
        });
      } else {
        const newKondisi = (input.kondisi ||
          currentRecord.kondisi) as keyof typeof STOCK_FIELD_MAP;
        const newStockField = STOCK_FIELD_MAP[newKondisi] || "stokBaru";

        await tx.barangGudang.create({
          data: {
            id: crypto.randomUUID(),
            barangId: currentRecord.barangId,
            gudangId: currentRecord.gudangId,
            stok: input.jumlah,
            [newStockField]: input.jumlah,
            updatedAt: new Date(),
          },
        });
      }
    });
  }

  async deleteMasuk(id: string) {
    await prisma.$transaction(async (tx) => {
      const masukRecord = await tx.barangMasuk.findUnique({
        where: { id },
        include: {
          barang: true,
          gudang: true,
        },
      });

      if (!masukRecord) {
        throw new Error("Record barang masuk tidak ditemukan");
      }

      const currentStock = await tx.barangGudang.findUnique({
        where: {
          barangId_gudangId: {
            barangId: masukRecord.barangId,
            gudangId: masukRecord.gudangId,
          },
        },
      });

      if (currentStock) {
        const newStock = Math.max(0, currentStock.stok - masukRecord.jumlah);
        const stockField =
          STOCK_FIELD_MAP[
            masukRecord.kondisi as keyof typeof STOCK_FIELD_MAP
          ] || "stokBaru";

        if (newStock === 0) {
          await tx.barangGudang.delete({
            where: {
              barangId_gudangId: {
                barangId: masukRecord.barangId,
                gudangId: masukRecord.gudangId,
              },
            },
          });
        } else {
          const newConditionStock = Math.max(
            0,
            Number((currentStock as Record<string, unknown>)[stockField] || 0) -
              masukRecord.jumlah,
          );
          await tx.barangGudang.update({
            where: {
              barangId_gudangId: {
                barangId: masukRecord.barangId,
                gudangId: masukRecord.gudangId,
              },
            },
            data: {
              stok: newStock,
              [stockField]: newConditionStock,
            },
          });
        }
      }

      await tx.barangMasuk.delete({
        where: { id },
      });
    });
  }

  async getOpnameRecord(id: string) {
    return prisma.stockOpname.findUnique({
      where: { id },
      include: {
        barang: {
          select: {
            id: true,
            kode: true,
            nama: true,
            satuan: true,
          },
        },
        gudang: {
          select: {
            id: true,
            kode: true,
            nama: true,
            lokasi: true,
          },
        },
      },
    });
  }

  async updateOpname(input: {
    id: string;
    stokFisik: number;
    keterangan?: string | null;
    kondisiBaik?: number;
    kondisiRusak?: number;
    kondisiExpire?: number;
    lokasiPenyimpanan?: string | null;
    nomorRak?: string | null;
    nomorBox?: string | null;
    pic?: string | null;
    suhuPenyimpanan?: string | null;
    kelembaban?: string | null;
    tanggalExpire?: string | null;
    nomorBatch?: string | null;
    catatanDetail?: string | null;
  }) {
    return prisma.$transaction(async (tx) => {
      const existingRecord = await tx.stockOpname.findUnique({
        where: { id: input.id },
        include: {
          barang: true,
          gudang: true,
        },
      });

      if (!existingRecord) {
        throw new Error("Record stock opname tidak ditemukan");
      }

      const currentStock = await tx.barangGudang.findUnique({
        where: {
          barangId_gudangId: {
            barangId: existingRecord.barangId,
            gudangId: existingRecord.gudangId,
          },
        },
      });

      const stokSistem = currentStock?.stok || 0;
      const selisihFisik = input.stokFisik - existingRecord.stokFisik;
      const selisihBaru = input.stokFisik - existingRecord.stokSistem;

      const updatedRecord = await tx.stockOpname.update({
        where: { id: input.id },
        data: {
          stokFisik: input.stokFisik,
          selisih: selisihBaru,
          keterangan: input.keterangan,
          kondisiBaik:
            input.kondisiBaik !== undefined
              ? input.kondisiBaik
              : existingRecord.kondisiBaik,
          kondisiRusak:
            input.kondisiRusak !== undefined
              ? input.kondisiRusak
              : existingRecord.kondisiRusak,
          kondisiExpire:
            input.kondisiExpire !== undefined
              ? input.kondisiExpire
              : existingRecord.kondisiExpire,
          lokasiPenyimpanan: input.lokasiPenyimpanan,
          nomorRak: input.nomorRak,
          nomorBox: input.nomorBox,
          pic: input.pic,
          suhuPenyimpanan:
            input.suhuPenyimpanan !== undefined &&
            input.suhuPenyimpanan !== null
              ? Number(input.suhuPenyimpanan)
              : null,
          kelembaban:
            input.kelembaban !== undefined && input.kelembaban !== null
              ? Number(input.kelembaban)
              : null,
          tanggalExpire: input.tanggalExpire
            ? new Date(input.tanggalExpire)
            : existingRecord.tanggalExpire,
          nomorBatch: input.nomorBatch,
          catatanDetail: input.catatanDetail,
        },
      });

      if (currentStock) {
        const newTotalStock = Math.max(0, currentStock.stok + selisihFisik);
        const newStokBaru = Math.max(0, currentStock.stokBaru + selisihFisik);

        await tx.barangGudang.update({
          where: {
            barangId_gudangId: {
              barangId: existingRecord.barangId,
              gudangId: existingRecord.gudangId,
            },
          },
          data: {
            stok: newTotalStock,
            stokBaru: newStokBaru,
          },
        });
      } else if (input.stokFisik > 0) {
        await tx.barangGudang.create({
          data: {
            id: crypto.randomUUID(),
            barangId: existingRecord.barangId,
            gudangId: existingRecord.gudangId,
            stok: input.stokFisik,
            updatedAt: new Date(),
          },
        });
      }

      return {
        record: updatedRecord,
        stokSistem,
        selisih: selisihBaru,
      };
    });
  }

  async deleteOpname(id: string) {
    await prisma.$transaction(async (tx) => {
      const existingRecord = await tx.stockOpname.findUnique({
        where: { id: id.trim() },
      });

      if (!existingRecord) {
        throw new Error("Record stock opname tidak ditemukan");
      }

      const currentStock = await tx.barangGudang.findUnique({
        where: {
          barangId_gudangId: {
            barangId: existingRecord.barangId,
            gudangId: existingRecord.gudangId,
          },
        },
      });

      if (currentStock) {
        const newTotalStock = Math.max(
          0,
          currentStock.stok - existingRecord.selisih,
        );
        const newStokBaru = Math.max(
          0,
          currentStock.stokBaru - existingRecord.selisih,
        );

        await tx.barangGudang.update({
          where: {
            barangId_gudangId: {
              barangId: existingRecord.barangId,
              gudangId: existingRecord.gudangId,
            },
          },
          data: {
            stok: newTotalStock,
            stokBaru: newStokBaru,
          },
        });
      }

      await tx.stockOpname.delete({
        where: { id: id.trim() },
      });
    });
  }
}

let inventoryStockMovementServiceInstance: InventoryStockMovementService | null =
  null;

export function getInventoryStockMovementService() {
  if (!inventoryStockMovementServiceInstance) {
    inventoryStockMovementServiceInstance = new InventoryStockMovementService();
  }

  return inventoryStockMovementServiceInstance;
}
