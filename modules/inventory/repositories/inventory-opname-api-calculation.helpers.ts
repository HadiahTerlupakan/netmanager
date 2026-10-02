import type { Prisma } from "@prisma/client";

import {
  periodeDari,
  rentangWaktuPeriode,
} from "../domain/jadwal-stock-opname";
import {
  adjustStockCalculation,
  calculateStockByCondition,
} from "./inventory-api-repository-helpers";

type PrismaClientLike = Prisma.TransactionClient;
type OpnameMovementItem = { barangId: string; kondisi: string; jumlah: number };
type OpnameBarangGudang = {
  stok: number;
  barang: { id: string; kode: string; nama: string; satuan: string };
  gudang: { id: string; nama: string };
};
/** SO terakhir sebuah barang di bulan berjalan (WIB). */
type SoBulanIni = { tanggal: Date; pic: string | null };

/**
 * Hitung data awal opname untuk satu gudang, beserta SO terakhir tiap barang
 * di bulan berjalan agar petugas tahu barang mana yang sudah/belum di-SO.
 */
export async function calculateInitialOpnameItems(input: {
  db: PrismaClientLike;
  gudangId: string;
  tenantFilter?: { tenantId?: string };
  sekarang?: Date;
}) {
  const barangGudangs = await findOpnameBarangGudangs(
    input.db,
    input.gudangId,
    input.tenantFilter,
  );
  if (barangGudangs.length === 0) return [];

  const barangIds = barangGudangs.map((item) => item.barang.id);
  const [movements, soBulanIni] = await Promise.all([
    findOpnameMovements({ db: input.db, gudangId: input.gudangId, barangIds }),
    findSoBulanIni({
      db: input.db,
      gudangId: input.gudangId,
      barangIds,
      sekarang: input.sekarang ?? new Date(),
    }),
  ]);

  return barangGudangs.map((barangGudang) => ({
    ...mapCalculatedOpnameItem(barangGudang, movements),
    soBulanIni: soBulanIni.get(barangGudang.barang.id) ?? null,
  }));
}

/** SO terakhir per barang di bulan berjalan (map barangId → SO terbaru). */
async function findSoBulanIni(input: {
  db: PrismaClientLike;
  gudangId: string;
  barangIds: string[];
  sekarang: Date;
}): Promise<Map<string, SoBulanIni>> {
  const bulan = rentangWaktuPeriode(periodeDari(input.sekarang));
  const rows = await input.db.stockOpname.findMany({
    where: {
      gudangId: input.gudangId,
      barangId: { in: input.barangIds },
      tanggal: { gte: bulan.dari, lte: bulan.sampai },
    },
    select: { barangId: true, tanggal: true, pic: true },
    orderBy: { tanggal: "desc" },
  });
  const terbaru = new Map<string, SoBulanIni>();
  for (const row of rows) {
    if (!terbaru.has(row.barangId)) terbaru.set(row.barangId, { tanggal: row.tanggal, pic: row.pic });
  }
  return terbaru;
}

function findOpnameBarangGudangs(
  db: PrismaClientLike,
  gudangId: string,
  tenantFilter?: { tenantId?: string },
) {
  return db.barangGudang.findMany({
    where: { gudangId, ...tenantFilter },
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
}

async function findOpnameMovements(input: {
  db: PrismaClientLike;
  gudangId: string;
  barangIds: string[];
}) {
  const [allMasuk, allKeluar] = await Promise.all([
    input.db.barangMasuk.findMany({
      where: { gudangId: input.gudangId, barangId: { in: input.barangIds } },
    }),
    input.db.barangKeluar.findMany({
      where: { gudangId: input.gudangId, barangId: { in: input.barangIds } },
    }),
  ]);
  return { allMasuk, allKeluar };
}

function mapCalculatedOpnameItem(
  barangGudang: OpnameBarangGudang,
  movements: {
    allMasuk: OpnameMovementItem[];
    allKeluar: OpnameMovementItem[];
  },
) {
  const stockByCondition = calculateStockByCondition(
    filterMovementsByBarang(movements.allMasuk, barangGudang.barang.id),
    filterMovementsByBarang(movements.allKeluar, barangGudang.barang.id),
  );
  const adjusted = adjustStockCalculation(barangGudang.stok, stockByCondition);

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
}

function filterMovementsByBarang(
  items: OpnameMovementItem[],
  barangId: string,
) {
  return items.filter((item) => item.barangId === barangId);
}
