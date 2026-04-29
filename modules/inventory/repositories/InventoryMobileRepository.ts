import { Prisma, type PrismaClient } from "@prisma/client";
import { prismaMitra } from "@/lib/prisma-mitra";
import {
  buildMobileBarangSelect,
  buildMobileGudangWhere,
  buildMobileHistoryInclude,
  buildSiteFilter,
} from "./inventory-mobile-query-helpers";

export class InventoryMobileRepository {
  constructor(private readonly db: PrismaClient) {}

  /** Find mobile user actor with role, permission, and site scope. */
  async findMobileActorUser(input: { actorId: string; tenantId: string }) {
    return this.db.user.findFirst({
      where: { id: input.actorId, tenantId: input.tenantId },
      include: {
        role: { include: { permission: true } },
        sites: true,
        userSites: { select: { siteId: true } },
      },
    });
  }

  /** Find mobile mitra actor site scope. */
  async findMobileActorMitra(actorId: string) {
    return prismaMitra.mitra.findUnique({
      where: { id: actorId },
      select: { id: true, siteId: true },
    });
  }

  /** Find mobile warehouses visible to a tenant and optional site scope. */
  async findMobileGudangs(input: { tenantId: string; siteIds?: string[] }) {
    return this.db.gudang.findMany({
      where: buildMobileGudangWhere(input),
      select: { id: true, kode: true, nama: true, lokasi: true },
      orderBy: { nama: "asc" },
    });
  }

  /** Find mobile items available for stock-in flow. */
  async findMobileBarangForMasuk(input: {
    tenantId: string;
    siteIds?: string[];
  }) {
    return this.db.barang.findMany({
      where: this.buildBarangMasukWhere(input),
      select: buildMobileBarangSelect(),
      orderBy: { nama: "asc" },
    });
  }

  /** Find mobile item stock available for stock-out flow. */
  async findMobileBarangForKeluar(input: {
    tenantId: string;
    gudangId: string;
    siteIds?: string[];
  }) {
    return this.db.barangGudang.findMany({
      where: this.buildBarangKeluarWhere(input),
      include: { barang: { select: buildMobileBarangSelect() } },
      orderBy: { barang: { nama: "asc" } },
    });
  }

  /** Find warehouse sites for mobile access validation. */
  async findMobileGudangSites(input: { gudangId: string; tenantId: string }) {
    return this.db.gudang.findFirst({
      where: { id: input.gudangId, tenantId: input.tenantId },
      select: { id: true, sites: { select: { id: true } } },
    });
  }

  /** Find stock record for mobile inventory action. */
  async findMobileBarangGudangStock(input: {
    barangId: string;
    gudangId: string;
    tenantId: string;
  }) {
    return this.db.barangGudang.findFirst({
      where: {
        barangId: input.barangId,
        gudangId: input.gudangId,
        tenantId: input.tenantId,
      },
      include: { barang: { select: { nama: true } } },
    });
  }

  /** Find mobile stock-in history. */
  async findMobileHistoryMasuk(input: {
    where: Record<string, unknown>;
    take: number;
  }) {
    return this.db.barangMasuk.findMany({
      where: input.where,
      include: buildMobileHistoryInclude(),
      orderBy: { tanggal: "desc" },
      take: input.take,
    });
  }

  /** Find mobile stock-out history. */
  async findMobileHistoryKeluar(input: {
    where: Record<string, unknown>;
    take: number;
  }) {
    return this.db.barangKeluar.findMany({
      where: input.where,
      include: buildMobileHistoryInclude(),
      orderBy: { tanggal: "desc" },
      take: input.take,
    });
  }

  private buildBarangMasukWhere(input: {
    tenantId: string;
    siteIds?: string[];
  }): Prisma.BarangWhereInput {
    const where: Prisma.BarangWhereInput = { tenantId: input.tenantId };
    if (input.siteIds) {
      where.barangGudang = {
        some: { gudang: buildSiteFilter(input.siteIds) },
      };
    }
    return where;
  }

  private buildBarangKeluarWhere(input: {
    tenantId: string;
    gudangId: string;
    siteIds?: string[];
  }): Prisma.BarangGudangWhereInput {
    const where: Prisma.BarangGudangWhereInput = {
      gudangId: input.gudangId,
      tenantId: input.tenantId,
    };
    if (input.siteIds) where.gudang = buildSiteFilter(input.siteIds);
    return where;
  }
}
