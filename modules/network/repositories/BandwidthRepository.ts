import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type {
  BandwidthListFilters,
  IBandwidthRepository,
} from "../domain/ports/IBandwidthRepository";

export class BandwidthRepository implements IBandwidthRepository {
  /** Ambil daftar bandwidth untuk route admin. */
  findMany(filters: BandwidthListFilters) {
    return prisma.bandwidth.findMany({
      where: this.buildListWhere(filters),
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { hargaPaket: true } } },
    });
  }

  /** Buat bandwidth baru. */
  create(input: Prisma.BandwidthCreateInput) {
    return prisma.bandwidth.create({ data: input });
  }

  /** Ambil detail bandwidth berdasarkan identifier. */
  findById(id: string) {
    return prisma.bandwidth.findUnique({
      where: { id },
      include: { hargaPaket: { include: { profilePPP: true } } },
    });
  }

  /** Perbarui bandwidth berdasarkan identifier. */
  update(id: string, input: Prisma.BandwidthUpdateInput) {
    return prisma.bandwidth.update({ where: { id }, data: input });
  }

  /** Ambil bandwidth beserta paket yang memakai bandwidth tersebut. */
  findForDelete(id: string) {
    return prisma.bandwidth.findUnique({
      where: { id },
      include: { hargaPaket: { select: { id: true, name: true } } },
    });
  }

  /** Hapus bandwidth berdasarkan identifier. */
  async delete(id: string) {
    await prisma.bandwidth.delete({ where: { id } });
  }

  private buildListWhere(
    filters: BandwidthListFilters,
  ): Prisma.BandwidthWhereInput {
    const where: Prisma.BandwidthWhereInput = {};
    if (filters.status) {
      where.status = filters.status as Prisma.EnumStatusFilter<"Bandwidth">;
    }
    if (filters.siteIds && filters.siteIds.length > 0) {
      return {
        ...where,
        OR: [{ siteId: { in: filters.siteIds } }, { siteId: null }],
      };
    }
    if (filters.requestedSiteId) {
      return {
        ...where,
        OR: [{ siteId: filters.requestedSiteId }, { siteId: null }],
      };
    }
    return where;
  }
}
