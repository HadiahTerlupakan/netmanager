import { randomUUID } from "crypto";

import type { OpnameMovementPlan } from "../domain/opname-mutasi";
import {
  STOK_KOSONG,
  readStoredStockEffect,
  reverseOpnameStockEffect,
  type StokPerKondisi,
} from "../domain/opname-stock-condition";
import type { Prisma } from "./prisma-boundary";

/**
 * Akses basis data untuk efek opname pada stok: mutasi yang tertaut ke opname
 * dan baris stok per kondisi. Aturan hitungnya ada di domain; berkas ini hanya
 * membaca dan menulis.
 */

type Tx = Prisma.TransactionClient;

/** Barang dan gudang yang stoknya disentuh sebuah opname. */
export interface OpnameStockLocation {
  barangId: string;
  gudangId: string;
  tenantId: string | null;
}

/** Baris stok saat ini; `exists` false bila barang belum punya stok di gudang. */
export interface OpnameStockSnapshot {
  columns: StokPerKondisi;
  exists: boolean;
}

function buildStockKey(location: OpnameStockLocation) {
  return {
    barangId_gudangId: {
      barangId: location.barangId,
      gudangId: location.gudangId,
    },
  };
}

/** Baca kolom stok per kondisi di lokasi opname. */
export async function readOpnameStock(
  tx: Tx,
  location: OpnameStockLocation,
): Promise<OpnameStockSnapshot> {
  const row = await tx.barangGudang.findUnique({
    where: buildStockKey(location),
    select: { stok: true, stokBaru: true, stokBekas: true, stokRusak: true },
  });
  if (!row) return { columns: { ...STOK_KOSONG }, exists: false };
  return { columns: row, exists: true };
}

/**
 * Simpan kolom stok. Baris baru hanya dibuat bila ada stok yang dicatat —
 * barang yang tidak pernah ada di gudang tidak perlu baris berisi nol.
 */
export async function writeOpnameStock(
  tx: Tx,
  location: OpnameStockLocation,
  snapshot: OpnameStockSnapshot,
): Promise<void> {
  if (snapshot.exists) {
    await tx.barangGudang.update({
      where: buildStockKey(location),
      data: snapshot.columns,
    });
    return;
  }
  if (snapshot.columns.stok <= 0) return;

  await tx.barangGudang.create({
    data: {
      id: randomUUID(),
      barangId: location.barangId,
      gudangId: location.gudangId,
      ...snapshot.columns,
      updatedAt: new Date(),
      tenantId: location.tenantId,
    },
  });
}

/** Catat mutasi opname (masuk/keluar) yang tertaut ke opname-nya. */
export async function createOpnameMovement(
  tx: Tx,
  input: {
    location: Omit<OpnameStockLocation, "tenantId">;
    opnameId: string;
    plan: OpnameMovementPlan;
  },
): Promise<void> {
  const common = {
    id: randomUUID(),
    barangId: input.location.barangId,
    gudangId: input.location.gudangId,
    jumlah: input.plan.jumlah,
    kondisi: input.plan.kondisi,
    keterangan: input.plan.keterangan,
    opnameId: input.opnameId,
  };

  if (input.plan.arah === "MASUK") {
    await tx.barangMasuk.create({ data: common });
    return;
  }
  await tx.barangKeluar.create({
    data: { ...common, isHilang: input.plan.isHilang },
  });
}

/**
 * Batalkan efek opname pada kolom stok dan hapus mutasi yang dibuatnya.
 * Kolom dibalik dari efek yang tersimpan di catatan opname, bukan dari
 * mutasinya: mutasi data lama bisa tidak sama dengan efek yang diterapkan.
 * Mengembalikan kolom stok setelah dibatalkan; pemanggil yang menyimpannya.
 */
export async function reverseOpnameEffect(
  tx: Tx,
  opname: {
    id: string;
    selisih: number;
    efekStokBaru: number | null;
    efekStokBekas: number | null;
    efekStokRusak: number | null;
  },
  stock: StokPerKondisi,
): Promise<StokPerKondisi> {
  await tx.barangMasuk.deleteMany({ where: { opnameId: opname.id } });
  await tx.barangKeluar.deleteMany({ where: { opnameId: opname.id } });
  return reverseOpnameStockEffect(stock, {
    selisih: opname.selisih,
    efek: readStoredStockEffect(opname),
  });
}
