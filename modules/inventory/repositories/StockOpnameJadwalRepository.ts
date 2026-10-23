import type { PrismaClient } from "@prisma/client";

import { prisma } from "@/modules/database";

/** Site pengguna: site utama lama (`User.siteId`) digabung daftar UserSite, tanpa duplikat. */
function gabungSiteIdsPengguna(user: { siteId: string | null; userSites: { siteId: string }[] }): string[] {
  return [...new Set([...(user.siteId ? [user.siteId] : []), ...user.userSites.map((s) => s.siteId)])];
}

/**
 * Data jadwal (per site) & kepatuhan stock opname bulanan. Semua query
 * menyaring `tenantId` secara eksplisit: cron pengingat berjalan tanpa konteks
 * tenant sehingga ekstensi tenant Prisma tidak menyaring apa pun.
 */
export class StockOpnameJadwalRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  /** Site milik tenant (null bila bukan milik tenant). */
  async findSite(tenantId: string, siteId: string) {
    return this.client.sites.findFirst({
      where: { id: siteId, tenantId },
      select: { id: true, name: true },
    });
  }

  /** Jadwal bawaan site-site (map siteId → aturan). */
  async findAturanSites(tenantId: string, siteIds: string[]) {
    if (siteIds.length === 0) return [];
    return this.client.stockOpnameAturan.findMany({ where: { tenantId, siteId: { in: siteIds } } });
  }

  /** Simpan jadwal bawaan satu site. */
  async upsertAturan(
    tenantId: string,
    siteId: string,
    data: { isAktif: boolean; tanggalMulai: number; tanggalSelesai: number },
  ) {
    return this.client.stockOpnameAturan.upsert({
      where: { siteId },
      create: { tenantId, siteId, ...data },
      update: data,
    });
  }

  /** Jadwal khusus site-site untuk satu bulan. */
  async findJadwalSites(tenantId: string, siteIds: string[], periode: string) {
    if (siteIds.length === 0) return [];
    return this.client.stockOpnameJadwal.findMany({
      where: { tenantId, siteId: { in: siteIds }, periode },
    });
  }

  /** Jadwal khusus satu site mulai bulan `dariPeriode` (untuk daftar di halaman site). */
  async findJadwalKhususSite(tenantId: string, siteId: string, dariPeriode: string) {
    return this.client.stockOpnameJadwal.findMany({
      where: { tenantId, siteId, periode: { gte: dariPeriode } },
      orderBy: { periode: "asc" },
    });
  }

  /** Simpan jadwal khusus satu site untuk satu bulan. */
  async upsertJadwal(
    tenantId: string,
    siteId: string,
    periode: string,
    data: { tanggalMulai: Date; tanggalSelesai: Date; catatan: string | null; diubahOlehId: string },
  ) {
    return this.client.stockOpnameJadwal.upsert({
      where: { siteId_periode: { siteId, periode } },
      create: { tenantId, siteId, periode, ...data },
      update: data,
    });
  }

  /** Hapus jadwal khusus → bulan itu kembali memakai jadwal bawaan site. */
  async deleteJadwal(tenantId: string, siteId: string, periode: string) {
    await this.client.stockOpnameJadwal.deleteMany({ where: { tenantId, siteId, periode } });
  }

  /** Site aktif tenant; `siteIds` membatasi ke site tertentu. */
  async findSitesAktif(tenantId: string, siteIds: string[] | null) {
    return this.client.sites.findMany({
      where: { tenantId, isActive: true, ...(siteIds ? { id: { in: siteIds } } : {}) },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  /** Gudang aktif tenant beserta site-nya; `siteIds` membatasi ke site tertentu. */
  async findGudangAktif(tenantId: string, siteIds: string[] | null) {
    return this.client.gudang.findMany({
      where: {
        tenantId,
        isActive: true,
        ...(siteIds ? { sites: { some: { id: { in: siteIds } } } } : {}),
      },
      select: {
        id: true,
        kode: true,
        nama: true,
        sites: { select: { id: true }, where: { isActive: true } },
      },
      orderBy: { nama: "asc" },
    });
  }

  /** Pasangan gudang–barang yang punya stok (wajib dihitung saat SO). */
  async findBarangBerstok(tenantId: string, gudangIds: string[]) {
    if (gudangIds.length === 0) return [];
    return this.client.barangGudang.findMany({
      where: {
        tenantId,
        gudangId: { in: gudangIds },
        OR: [
          { stok: { gt: 0 } },
          { stokBaru: { gt: 0 } },
          { stokBekas: { gt: 0 } },
          { stokRusak: { gt: 0 } },
        ],
      },
      select: { gudangId: true, barangId: true },
    });
  }

  /** Baris SO gudang-gudang dalam rentang waktu (terbaru dulu). */
  async findOpnameDalamRentang(tenantId: string, gudangIds: string[], dari: Date, sampai: Date) {
    if (gudangIds.length === 0) return [];
    return this.client.stockOpname.findMany({
      where: { tenantId, gudangId: { in: gudangIds }, tanggal: { gte: dari, lte: sampai } },
      select: { gudangId: true, barangId: true, tanggal: true, pic: true },
      orderBy: { tanggal: "desc" },
    });
  }

  /** Tenant yang punya minimal satu site dengan pengingat SO aktif. */
  async findTenantDenganPengingatAktif(): Promise<string[]> {
    const aturan = await this.client.stockOpnameAturan.findMany({
      where: { isAktif: true, tenantId: { not: null } },
      select: { tenantId: true },
      distinct: ["tenantId"],
    });
    return aturan.map((baris) => baris.tenantId).filter((id): id is string => id !== null);
  }

  /** Site pengguna tenant (site utama lama + daftar UserSite). */
  async findSiteIdsPengguna(tenantId: string, userId: string): Promise<string[]> {
    const user = await this.client.user.findFirst({
      where: { id: userId, tenantId },
      select: { siteId: true, userSites: { select: { siteId: true } } },
    });
    return user ? gabungSiteIdsPengguna(user) : [];
  }

  /**
   * Pengguna aktif tenant yang role-nya memegang `opname:<action>`, beserta
   * site-nya dan apakah dibatasi `opname:site_only`.
   */
  async findPenggunaDenganIzin(tenantId: string, action: string) {
    const users = await this.client.user.findMany({
      where: {
        tenantId,
        isActive: true,
        role: { permission: { some: { resource: "opname", action } } },
      },
      select: {
        id: true,
        siteId: true,
        userSites: { select: { siteId: true } },
        role: {
          select: {
            permission: {
              where: { resource: "opname", action: "site_only" },
              select: { id: true },
            },
          },
        },
      },
    });
    return users.map((user) => ({
      id: user.id,
      siteIds: gabungSiteIdsPengguna(user),
      isSiteOnly: (user.role?.permission.length ?? 0) > 0,
    }));
  }
}
