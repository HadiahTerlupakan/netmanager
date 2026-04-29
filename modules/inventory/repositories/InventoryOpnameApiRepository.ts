import { Prisma } from "@prisma/client";
import { STOCK_FIELD_MAP } from "@/lib/constants/inventory";
import {
  adjustStockCalculation,
  calculateStockByCondition,
} from "./inventory-api-repository-helpers";

type PrismaClientLike = Prisma.TransactionClient;

export class InventoryOpnameApiRepository {
  constructor(private readonly db: PrismaClientLike) {}

  /** Ambil summary opname berbasis stok dan opname terakhir. */
  async findOpnameSummary(gudangId?: string) {
    const whereClause = gudangId ? { gudangId } : {};
    const [barangGudangs, latestOpnames] = await Promise.all([
      this.db.barangGudang.findMany({
        where: whereClause,
        include: {
          barang: {
            select: { id: true, kode: true, nama: true, satuan: true },
          },
          gudang: { select: { id: true, kode: true, nama: true } },
        },
      }),
      this.db.stockOpname.groupBy({
        by: ["barangId", "gudangId"],
        where: whereClause,
        _max: { tanggal: true },
      }),
    ]);
    return barangGudangs.map((barangGudang) => ({
      id: barangGudang.id,
      barang: barangGudang.barang,
      gudang: barangGudang.gudang,
      stokSistem: barangGudang.stok,
      lastOpname: latestOpnames.find(
        (item) =>
          item.barangId === barangGudang.barangId &&
          item.gudangId === barangGudang.gudangId,
      )?._max.tanggal,
    }));
  }

  /** Ambil laporan opname per gudang. */
  async findOpnameReport(gudangId?: string) {
    const gudangs = await this.db.gudang.findMany({
      where: { isActive: true, ...(gudangId ? { id: gudangId } : {}) },
      include: {
        barangGudang: {
          include: {
            barang: {
              select: { id: true, kode: true, nama: true, satuan: true },
            },
          },
        },
      },
      orderBy: { nama: "asc" },
    });
    const gudangList = [];
    for (const gudang of gudangs) {
      const items = await this.buildOpnameReportItems(
        gudang.barangGudang,
        gudang.id,
      );
      gudangList.push({
        gudangId: gudang.id,
        gudangKode: gudang.kode,
        gudangNama: gudang.nama,
        gudangLokasi: gudang.lokasi,
        totalBarang: items.length,
        totalStok: items.reduce((sum, item) => sum + item.stokTotal, 0),
        totalHilang: items.reduce((sum, item) => sum + item.totalHilang, 0),
        items,
      });
    }
    return gudangList;
  }

  /** Hitung data awal opname untuk satu gudang. */
  async calculateOpname(gudangId: string) {
    const barangGudangs = await this.db.barangGudang.findMany({
      where: { gudangId },
      include: {
        barang: {
          select: {
            id: true,
            kode: true,
            nama: true,
            satuan: true,
            createdAt: true,
          },
        },
        gudang: { select: { id: true, kode: true, nama: true } },
      },
      orderBy: { barang: { kode: "asc" } },
    });
    if (barangGudangs.length === 0) return [];
    const { allMasuk, allKeluar } = await this.findOpnameMovements(
      gudangId,
      barangGudangs.map((item) => item.barang.id),
    );
    return barangGudangs.map((barangGudang) => {
      const masukItems = allMasuk.filter(
        (item) => item.barangId === barangGudang.barang.id,
      );
      const keluarItems = allKeluar.filter(
        (item) => item.barangId === barangGudang.barang.id,
      );
      const stockByCondition = calculateStockByCondition(
        masukItems,
        keluarItems,
      );
      const adjusted = adjustStockCalculation(
        barangGudang.stok,
        stockByCondition,
      );
      return {
        barangId: barangGudang.barang.id,
        barangKode: barangGudang.barang.kode,
        barangNama: barangGudang.barang.nama,
        barangSatuan: barangGudang.barang.satuan,
        gudangId: barangGudang.gudang.id,
        gudangNama: barangGudang.gudang.nama,
        stokSistem: barangGudang.stok,
        stokFisik: barangGudang.stok,
        kondisiBaik: adjusted.kondisiBaik,
        kondisiRusak: adjusted.kondisiRusak,
        kondisiExpire: adjusted.kondisiExpire,
        lokasiPenyimpanan: barangGudang.gudang.nama,
        nomorRak: "",
        nomorBox: "",
        pic: "Gudang",
        suhuPenyimpanan: null as number | null,
        kelembaban: null as number | null,
        tanggalExpire: null as Date | null,
        nomorBatch: "",
        catatanDetail: `Stok sistem: ${barangGudang.stok} (Baru: ${stockByCondition.stokBaru}, Bekas: ${stockByCondition.stokBekas}, Rusak: ${stockByCondition.stokRusak}). Input stok fisik dan breakdown kondisi aktual.`,
      };
    });
  }

  /** Ambil stok barang dan relasinya. */
  async findStockInfo(barangId: string, gudangId: string) {
    return this.db.barangGudang.findUnique({
      where: { barangId_gudangId: { barangId, gudangId } },
      include: {
        barang: { select: { id: true, kode: true, nama: true, satuan: true } },
        gudang: { select: { id: true, kode: true, nama: true } },
      },
    });
  }

  /** Ambil breakdown stok per kondisi. */
  async findStockBreakdown(barangId: string, gudangId: string) {
    const [stockSnapshot, barangInfo, gudangInfo] = await Promise.all([
      this.db.barangGudang.findUnique({
        where: { barangId_gudangId: { barangId, gudangId } },
        select: {
          stok: true,
          stokBaru: true,
          stokBekas: true,
          stokRusak: true,
        },
      }),
      this.db.barang.findUnique({
        where: { id: barangId },
        select: { id: true, kode: true, nama: true, satuan: true },
      }),
      this.db.gudang.findUnique({
        where: { id: gudangId },
        select: { id: true, kode: true, nama: true },
      }),
    ]);
    return { stockSnapshot, barangInfo, gudangInfo };
  }

  /** Ambil keluar record beserta site gudang untuk validasi akses. */
  async findKeluarRecordWithSite(id: string) {
    return this.db.barangKeluar.findUnique({
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

  /** Perbarui keluar record dan sinkronkan stok. */
  async updateKeluarRecord(input: {
    id: string;
    jumlah: number;
    keterangan?: string;
  }) {
    return this.db.$transaction(async (tx) => {
      const currentRecord = await tx.barangKeluar.findUnique({
        where: { id: input.id },
        include: { barang: true, gudang: true },
      });
      if (!currentRecord)
        throw new Error("Record barang keluar tidak ditemukan");
      const currentStock = await this.requireCurrentStock(tx, currentRecord);
      const stockField = this.getStockField(currentRecord.kondisi);
      const stockDifference = currentRecord.jumlah - input.jumlah;
      const newStock = currentStock.stok + stockDifference;
      const newConditionStock =
        Number(currentStock[stockField] || 0) + stockDifference;
      if (newStock < 0 || newConditionStock < 0) {
        throw new Error("Stok tidak mencukupi untuk perubahan ini");
      }
      await tx.barangKeluar.update({
        where: { id: input.id },
        data: { jumlah: input.jumlah, keterangan: input.keterangan },
      });
      await tx.barangGudang.update({
        where: {
          barangId_gudangId: {
            barangId: currentRecord.barangId,
            gudangId: currentRecord.gudangId,
          },
        },
        data: { stok: newStock, [stockField]: newConditionStock },
      });
      return {
        barangNama: currentRecord.barang.nama,
        jumlahLama: currentRecord.jumlah,
      };
    });
  }

  /** Hapus keluar record dan kembalikan stok. */
  async deleteKeluarRecord(id: string) {
    return this.db.$transaction(async (tx) => {
      const keluarRecord = await tx.barangKeluar.findUnique({
        where: { id },
        include: { barang: true, gudang: true },
      });
      if (!keluarRecord)
        throw new Error("Record barang keluar tidak ditemukan");
      await this.restoreKeluarStock(tx, keluarRecord);
      await tx.barangKeluar.delete({ where: { id } });
      return {
        barangNama: keluarRecord.barang.nama,
        jumlah: keluarRecord.jumlah,
      };
    });
  }

  private async buildOpnameReportItems(
    barangGudangItems: Array<{
      barangId: string;
      stok: number;
      barang: { kode: string; nama: string; satuan: string };
    }>,
    gudangId: string,
  ) {
    const items = [];
    for (const stockItem of barangGudangItems) {
      const [masukData, keluarData] = await Promise.all([
        this.db.barangMasuk.findMany({
          where: { barangId: stockItem.barangId, gudangId },
        }),
        this.db.barangKeluar.findMany({
          where: { barangId: stockItem.barangId, gudangId },
        }),
      ]);
      const stockByCondition = calculateStockByCondition(masukData, keluarData);
      const totalHilang = keluarData
        .filter((item) => item.isHilang)
        .reduce((sum, item) => sum + item.jumlah, 0);
      items.push({
        barangId: stockItem.barangId,
        barangKode: stockItem.barang.kode,
        barangNama: stockItem.barang.nama,
        barangSatuan: stockItem.barang.satuan,
        stokTotal: stockItem.stok,
        stokBaru: stockByCondition.stokBaru,
        stokBekas: stockByCondition.stokBekas,
        stokRusak: stockByCondition.stokRusak,
        totalHilang,
      });
    }
    return items;
  }

  private async findOpnameMovements(gudangId: string, barangIds: string[]) {
    const [allMasuk, allKeluar] = await Promise.all([
      this.db.barangMasuk.findMany({
        where: { gudangId, barangId: { in: barangIds } },
      }),
      this.db.barangKeluar.findMany({
        where: { gudangId, barangId: { in: barangIds } },
      }),
    ]);
    return { allMasuk, allKeluar };
  }

  private async requireCurrentStock(
    tx: Prisma.TransactionClient,
    currentRecord: { barangId: string; gudangId: string },
  ) {
    const currentStock = await tx.barangGudang.findUnique({
      where: { barangId_gudangId: currentRecord },
    });
    if (!currentStock)
      throw new Error("Stok tidak ditemukan untuk barang dan gudang ini");
    return currentStock;
  }

  private async restoreKeluarStock(
    tx: Prisma.TransactionClient,
    keluarRecord: {
      barangId: string;
      gudangId: string;
      jumlah: number;
      kondisi: string;
    },
  ) {
    const stockField = this.getStockField(keluarRecord.kondisi);
    const currentStock = await tx.barangGudang.findUnique({
      where: {
        barangId_gudangId: {
          barangId: keluarRecord.barangId,
          gudangId: keluarRecord.gudangId,
        },
      },
    });
    if (!currentStock)
      return this.createRestoredStock(tx, keluarRecord, stockField);
    await tx.barangGudang.update({
      where: {
        barangId_gudangId: {
          barangId: keluarRecord.barangId,
          gudangId: keluarRecord.gudangId,
        },
      },
      data: {
        stok: currentStock.stok + keluarRecord.jumlah,
        [stockField]:
          Number(currentStock[stockField] || 0) + keluarRecord.jumlah,
      },
    });
  }

  private createRestoredStock(
    tx: Prisma.TransactionClient,
    keluarRecord: { barangId: string; gudangId: string; jumlah: number },
    stockField: string,
  ) {
    return tx.barangGudang.create({
      data: {
        id: crypto.randomUUID(),
        barangId: keluarRecord.barangId,
        gudangId: keluarRecord.gudangId,
        stok: keluarRecord.jumlah,
        [stockField]: keluarRecord.jumlah,
        updatedAt: new Date(),
      },
    });
  }

  private getStockField(kondisi: string) {
    return (
      STOCK_FIELD_MAP[kondisi as keyof typeof STOCK_FIELD_MAP] || "stokBaru"
    );
  }
}
