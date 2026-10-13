import type { PrismaClient } from "@prisma/client";

import { prisma } from "@/modules/database";

import type {
  AksiRiwayatOpname,
  RingkasanPerubahan,
} from "../domain/riwayat-stock-opname";
import type { Prisma } from "./prisma-boundary";

/** Satu peristiwa yang akan dicatat ke jejak perubahan. */
export interface PeristiwaOpname {
  opnameId: string;
  gudangId: string;
  barangId: string;
  tenantId?: string | null;
  aksi: AksiRiwayatOpname;
  dilakukanOlehId?: string | null;
  namaPelaku: string;
  namaBarang: string;
  perubahan: RingkasanPerubahan;
}

/**
 * Jejak perubahan stock opname: siapa mengubah apa, dan kapan.
 *
 * Penulisan selalu ikut transaksi pemanggil supaya jejaknya tidak pernah
 * tercatat untuk perubahan yang akhirnya di-rollback — dan sebaliknya, tidak
 * pernah hilang untuk perubahan yang benar-benar tersimpan.
 */
export class StockOpnameRiwayatRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  /** Catat satu peristiwa di dalam transaksi yang sudah dibuka pemanggil. */
  async catat(tx: Prisma.TransactionClient, peristiwa: PeristiwaOpname) {
    return tx.stockOpnameAuditLog.create({
      data: {
        opnameId: peristiwa.opnameId,
        gudangId: peristiwa.gudangId,
        barangId: peristiwa.barangId,
        tenantId: peristiwa.tenantId ?? null,
        aksi: peristiwa.aksi,
        dilakukanOlehId: peristiwa.dilakukanOlehId ?? null,
        namaPelaku: peristiwa.namaPelaku,
        namaBarang: peristiwa.namaBarang,
        perubahan: peristiwa.perubahan as unknown as Prisma.InputJsonValue,
      },
    });
  }

  /** Seluruh peristiwa satu gudang dalam rentang waktu, terbaru di atas. */
  async riwayatGudang(input: {
    tenantId: string;
    gudangId: string;
    dari: Date;
    sampai: Date;
    batas: number;
  }) {
    return this.client.stockOpnameAuditLog.findMany({
      where: {
        tenantId: input.tenantId,
        gudangId: input.gudangId,
        dilakukanPada: { gte: input.dari, lte: input.sampai },
      },
      orderBy: { dilakukanPada: "desc" },
      take: input.batas,
    });
  }

  /**
   * Peristiwa terbaru tiap gudang dalam rentang waktu.
   *
   * Dipakai layar kepatuhan untuk menyebut nama orang yang terakhir mengubah
   * catatan gudang itu — bukan orang yang pertama kali membuatnya.
   */
  async peristiwaTerakhirPerGudang(input: {
    tenantId: string;
    gudangIds: string[];
    dari: Date;
    sampai: Date;
  }) {
    if (input.gudangIds.length === 0) return [];
    return this.client.stockOpnameAuditLog.findMany({
      where: {
        tenantId: input.tenantId,
        gudangId: { in: input.gudangIds },
        dilakukanPada: { gte: input.dari, lte: input.sampai },
      },
      orderBy: { dilakukanPada: "desc" },
      distinct: ["gudangId"],
      select: {
        gudangId: true,
        aksi: true,
        namaPelaku: true,
        dilakukanPada: true,
      },
    });
  }
}

let instance: StockOpnameRiwayatRepository | null = null;

/** Instance bersama; dibuat sekali agar klien Prisma tidak digandakan. */
export function getStockOpnameRiwayatRepository(): StockOpnameRiwayatRepository {
  instance ??= new StockOpnameRiwayatRepository();
  return instance;
}
