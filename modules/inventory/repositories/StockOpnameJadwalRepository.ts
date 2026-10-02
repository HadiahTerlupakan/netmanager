import type { PrismaClient } from "@prisma/client";

import { prisma } from "@/modules/database";

/**
 * Data jadwal & kepatuhan stock opname bulanan. Semua query menyaring
 * `tenantId` secara eksplisit: cron pengingat berjalan tanpa konteks tenant
 * sehingga ekstensi tenant Prisma tidak menyaring apa pun.
 */
export class StockOpnameJadwalRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  /** Aturan jadwal bawaan tenant (null bila belum pernah diatur). */
  async findAturan(tenantId: string) {
    return this.client.stockOpnameAturan.findUnique({ where: { tenantId } });
  }

  /** Simpan aturan jadwal bawaan tenant. */
  async upsertAturan(
    tenantId: string,
    data: { isAktif: boolean; tanggalMulai: number; tanggalSelesai: number },
  ) {
    return this.client.stockOpnameAturan.upsert({
      where: { tenantId },
      create: { tenantId, ...data },
      update: data,
    });
  }

  /** Jadwal khusus satu bulan (null bila memakai aturan bawaan). */
  async findJadwal(tenantId: string, periode: string) {
    return this.client.stockOpnameJadwal.findUnique({
      where: { tenantId_periode: { tenantId, periode } },
    });
  }

  /** Simpan jadwal khusus satu bulan. */
  async upsertJadwal(
    tenantId: string,
    periode: string,
    data: { tanggalMulai: Date; tanggalSelesai: Date; catatan: string | null; diubahOlehId: string },
  ) {
    return this.client.stockOpnameJadwal.upsert({
      where: { tenantId_periode: { tenantId, periode } },
      create: { tenantId, periode, ...data },
      update: data,
    });
  }

  /** Hapus jadwal khusus → bulan itu kembali memakai aturan bawaan. */
  async deleteJadwal(tenantId: string, periode: string) {
    await this.client.stockOpnameJadwal.deleteMany({ where: { tenantId, periode } });
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
        sites: { select: { id: true, name: true }, orderBy: { name: "asc" } },
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

  /** Baris SO gudang-gudang dalam rentang waktu. */
  async findOpnameDalamRentang(tenantId: string, gudangIds: string[], dari: Date, sampai: Date) {
    if (gudangIds.length === 0) return [];
    return this.client.stockOpname.findMany({
      where: { tenantId, gudangId: { in: gudangIds }, tanggal: { gte: dari, lte: sampai } },
      select: { gudangId: true, barangId: true, tanggal: true, pic: true },
      orderBy: { tanggal: "desc" },
    });
  }

  /** Site pengguna (site utama lama + daftar UserSite). */
  async findSiteIdsPengguna(userId: string): Promise<string[]> {
    const user = await this.client.user.findUnique({
      where: { id: userId },
      select: { siteId: true, userSites: { select: { siteId: true } } },
    });
    if (!user) return [];
    return [...new Set([...(user.siteId ? [user.siteId] : []), ...user.userSites.map((s) => s.siteId)])];
  }

  /** Tenant yang mengaktifkan jadwal & pengingat SO. */
  async findTenantAktif(): Promise<string[]> {
    const aturan = await this.client.stockOpnameAturan.findMany({
      where: { isAktif: true, tenantId: { not: null } },
      select: { tenantId: true },
    });
    return aturan.map((baris) => baris.tenantId).filter((id): id is string => id !== null);
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
      siteIds: [
        ...new Set([...(user.siteId ? [user.siteId] : []), ...user.userSites.map((s) => s.siteId)]),
      ],
      isSiteOnly: (user.role?.permission.length ?? 0) > 0,
    }));
  }
}
