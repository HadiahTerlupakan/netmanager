import type { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/modules/database";

import { STATUS_KELUHAN_TERBUKA } from "./KeluhanSalesRepository";

const PILIH_PELANGGAN_TUNGGAKAN = {
  id: true,
  idPelanggan: true,
  nama: true,
  username: true,
  alamat: true,
  noTelp: true,
  jatuhTempo: true,
  latitude: true,
  longitude: true,
  siteId: true,
  site: { select: { name: true } },
  hargaPaket: { select: { name: true } },
  salesId: true,
  sales: { select: { id: true, name: true } },
} satisfies Prisma.PelangganSelect;

export type BarisPelangganTunggakan = Prisma.PelangganGetPayload<{ select: typeof PILIH_PELANGGAN_TUNGGAKAN }>;

/** Status WO yang dianggap masih berjalan (ada gangguan/pekerjaan terbuka). */
export const STATUS_WO_TERBUKA = ["REQUESTED", "PENDING", "ASSIGNED", "IN_PROGRESS", "ON_HOLD"] as const;

const PILIH_PELANGGAN_SAYA = {
  id: true,
  idPelanggan: true,
  nama: true,
  status: true,
  alamat: true,
  noTelp: true,
  jatuhTempo: true,
  latitude: true,
  longitude: true,
  site: { select: { name: true } },
  hargaPaket: { select: { name: true } },
  salesId: true,
  sales: { select: { name: true } },
  work_orders: {
    where: { status: { in: [...STATUS_WO_TERBUKA] } },
    select: { workOrderNumber: true, status: true, type: true },
    orderBy: { createdAt: "desc" },
    take: 1,
  },
  _count: { select: { support_tickets: { where: { status: { in: STATUS_KELUHAN_TERBUKA } } } } },
} satisfies Prisma.PelangganSelect;

export type BarisPelangganSaya = Prisma.PelangganGetPayload<{ select: typeof PILIH_PELANGGAN_SAYA }>;

/** Saringan sales pada daftar tunggakan; `null` = seluruh tenant. */
export type SaringanSales = { salesIds: string[] } | null;

/**
 * Data sales penanggung jawab pelanggan (`Pelanggan.salesId`). Semua query
 * menyaring `tenantId` eksplisit (fail-closed), tidak bergantung ekstensi tenant.
 */
export class PelangganSalesRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  /** Sales aktif tenant untuk pilihan penanggung jawab, urut nama. */
  async daftarSalesAktif(tenantId: string) {
    return this.client.user.findMany({
      where: { tenantId, isSales: true, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  /** Sales aktif tenant dengan id itu, atau null. */
  async cariSalesAktif(tenantId: string, salesId: string) {
    return this.client.user.findFirst({
      where: { id: salesId, tenantId, isSales: true, isActive: true },
      select: { id: true, name: true },
    });
  }

  /** Pelanggan milik tenant (null bila bukan). */
  async cariPelanggan(tenantId: string, pelangganId: string) {
    return this.client.pelanggan.findFirst({
      where: { id: pelangganId, tenantId },
      select: { id: true, siteId: true, salesId: true, sales: { select: { id: true, name: true } } },
    });
  }

  /** Tetapkan / lepas sales penanggung jawab pelanggan. */
  async tetapkanSales(pelangganId: string, salesId: string | null) {
    return this.client.pelanggan.update({
      where: { id: pelangganId },
      data: { salesId },
      select: { id: true, salesId: true, sales: { select: { id: true, name: true } } },
    });
  }

  /**
   * Pelanggan per sales penanggung jawab (bukan DISMANTLE) beserta WO terbuka
   * terbaru dan jumlah keluhan terbuka; dicari di nama/ID/telepon/alamat.
   */
  async daftarPelangganSales(
    tenantId: string,
    saringan: SaringanSales,
    filter: { cari?: string; status?: "AKTIF" | "ISOLIR" | "NONAKTIF" | "MAINTENANCE" },
    halaman: { lewati: number; ambil: number },
  ): Promise<{ data: BarisPelangganSaya[]; total: number }> {
    const cari = filter.cari?.trim();
    const where: Prisma.PelangganWhereInput = {
      tenantId,
      status: filter.status ?? { not: "DISMANTLE" },
      ...(saringan ? { salesId: { in: saringan.salesIds } } : { salesId: { not: null } }),
      ...(cari
        ? {
            OR: [
              { nama: { contains: cari, mode: "insensitive" } },
              { idPelanggan: { contains: cari } },
              { noTelp: { contains: cari } },
              { alamat: { contains: cari, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.client.pelanggan.findMany({
        where,
        select: PILIH_PELANGGAN_SAYA,
        orderBy: [{ nama: "asc" }, { id: "asc" }],
        skip: halaman.lewati,
        take: halaman.ambil,
      }),
      this.client.pelanggan.count({ where }),
    ]);
    return { data, total };
  }

  /** Pelanggan ISOLIR tenant, opsional dibatasi sales tertentu; jatuh tempo terlama dulu. */
  async daftarIsolir(tenantId: string, saringan: SaringanSales): Promise<BarisPelangganTunggakan[]> {
    return this.client.pelanggan.findMany({
      where: {
        tenantId,
        status: "ISOLIR",
        ...(saringan ? { salesId: { in: saringan.salesIds } } : {}),
      },
      select: PILIH_PELANGGAN_TUNGGAKAN,
      orderBy: [{ jatuhTempo: "asc" }, { id: "asc" }],
    });
  }
}
