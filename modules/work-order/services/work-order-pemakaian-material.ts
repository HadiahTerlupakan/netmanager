/**
 * Pencatatan barang yang benar-benar terpasang di pelanggan.
 *
 * Sebelum ini `usedMaterials` — meski namanya begitu — berisi barang yang
 * DIAMBIL dari gudang, dan tidak ada tempat mana pun yang mencatat berapa yang
 * akhirnya terpasang. Ambil 10 meter kabel, pasang 7, dan selisih 3 meter itu
 * tidak tercatat di mana-mana: gudang sudah menguranginya, pelanggan tidak
 * menerimanya, dan satu-satunya yang tahu adalah teknisi yang membawanya.
 *
 * Pemakaian dicatat saat laporan penyelesaian. Sisanya **tidak** otomatis
 * dikembalikan: barangnya secara fisik masih di mobil teknisi, dan menaikkan
 * stok gudang saat itu juga hanya memindahkan kebohongan angkanya ke tempat
 * lain. Sisa itu menggantung sebagai saldo di tangan teknisi sampai ia benar-
 * benar mengembalikannya lewat layar pengembalian.
 */

import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

import {
  akumulasiDariJsonb,
  BatasPengembalianError,
  type KlienBaca,
} from "./work-order-material-return-allowance";

export interface PemakaianMaterialInput {
  barangId: string;
  jumlah: number;
}

export interface PemakaianMaterialTercatat extends PemakaianMaterialInput {
  nama: string;
  satuan: string;
}

type TransactionClient = Parameters<PrismaClient["$transaction"]>[0] extends (
  arg: infer T,
) => Promise<unknown>
  ? T
  : never;

/** Nama & satuan barang, untuk disimpan bersama angka pemakaiannya. */
async function ambilRincianBarang(
  transaction: TransactionClient,
  barangIds: string[],
): Promise<Map<string, { nama: string; satuan: string }>> {
  const barang = await transaction.barang.findMany({
    where: { id: { in: barangIds } },
    select: { id: true, nama: true, satuan: true },
  });

  return new Map(barang.map((b) => [b.id, { nama: b.nama, satuan: b.satuan }]));
}

/**
 * Batas atas pemakaian: tidak bisa memasang lebih banyak daripada yang masih
 * dipegang, yaitu yang diambil dikurangi yang sudah dipakai dan sudah
 * dikembalikan.
 */
function assertBatasPemakaian(input: {
  items: PemakaianMaterialInput[];
  diambil: Map<string, number>;
  dipakai: Map<string, number>;
  dikembalikan: Map<string, number>;
  rincian: Map<string, { nama: string; satuan: string }>;
}): void {
  for (const barangId of new Set(input.items.map((i) => i.barangId))) {
    const dipegang =
      (input.diambil.get(barangId) ?? 0) -
      (input.dipakai.get(barangId) ?? 0) -
      (input.dikembalikan.get(barangId) ?? 0);

    const diminta = input.items
      .filter((i) => i.barangId === barangId)
      .reduce((jumlah, i) => jumlah + i.jumlah, 0);

    if (diminta > dipegang) {
      const nama = input.rincian.get(barangId)?.nama ?? "Barang ini";
      throw new BatasPengembalianError(
        dipegang <= 0
          ? `${nama} tidak ada di tangan Anda untuk work order ini.`
          : `${nama} yang masih Anda pegang tinggal ${dipegang}, dicatat terpasang ${diminta}.`,
      );
    }
  }
}

/**
 * Catat pemakaian material ke `consumedMaterials`.
 *
 * Ditulis dengan `||` jsonb, sama seperti pengambilan dan pengembalian, supaya
 * laporan penyelesaian yang dikirim ulang menambah catatan alih-alih menimpanya.
 */
export async function catatPemakaianMaterial(input: {
  transaction: TransactionClient;
  workOrderId: string;
  tenantId: string | null;
  items: PemakaianMaterialInput[];
}): Promise<PemakaianMaterialTercatat[]> {
  const items = input.items.filter((i) => i.jumlah > 0);
  if (items.length === 0) return [];

  const klien = input.transaction as unknown as KlienBaca;
  await klien.$queryRaw`SELECT "id" FROM "work_orders" WHERE "id" = ${input.workOrderId} FOR UPDATE`;

  const workOrder = await klien.workOrders.findUnique({
    where: { id: input.workOrderId },
    select: {
      usedMaterials: true,
      returnedMaterials: true,
      consumedMaterials: true,
    },
  });

  const diambil = new Map<string, number>();
  akumulasiDariJsonb(workOrder?.usedMaterials, diambil);
  const barisAdmin = await klien.workOrderMaterial.groupBy({
    by: ["barangId"],
    where: { workOrderId: input.workOrderId },
    _sum: { quantity: true },
  });
  for (const b of barisAdmin) {
    diambil.set(
      b.barangId,
      (diambil.get(b.barangId) ?? 0) + (b._sum.quantity ?? 0),
    );
  }

  const dipakai = new Map<string, number>();
  akumulasiDariJsonb(workOrder?.consumedMaterials, dipakai);

  const dikembalikan = new Map<string, number>();
  akumulasiDariJsonb(
    workOrder?.returnedMaterials,
    dikembalikan,
    (baris) => baris.asal === "TARIKAN_PELANGGAN",
  );

  const rincian = await ambilRincianBarang(
    input.transaction,
    items.map((i) => i.barangId),
  );

  assertBatasPemakaian({ items, diambil, dipakai, dikembalikan, rincian });

  const tercatat: PemakaianMaterialTercatat[] = items.map((item) => ({
    barangId: item.barangId,
    jumlah: item.jumlah,
    nama: rincian.get(item.barangId)?.nama ?? "Barang",
    satuan: rincian.get(item.barangId)?.satuan ?? "pcs",
  }));

  const tenantFilter = input.tenantId
    ? Prisma.sql`AND "tenantId" = ${input.tenantId}`
    : Prisma.empty;

  await input.transaction.$executeRaw`
    UPDATE "work_orders"
    SET "consumedMaterials" = COALESCE("consumedMaterials", '[]'::jsonb) || ${JSON.stringify(tercatat)}::jsonb,
        "updatedAt" = NOW()
    WHERE "id" = ${input.workOrderId} ${tenantFilter}
  `;

  return tercatat;
}
