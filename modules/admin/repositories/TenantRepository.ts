import { prisma } from "@/modules/database";
import type {
  ITenantRepository,
  TenantListFilters,
  TenantWriteInput,
} from "../domain/ports/ITenantRepository";

export class TenantRepository implements ITenantRepository {
  /** Ambil tenant berdasarkan filter daftar. */
  findMany(filters: TenantListFilters) {
    return prisma.tenant.findMany({
      where: filters.activeOnly ? { isActive: true } : undefined,
      orderBy: { createdAt: "desc" },
    });
  }

  /** Buat tenant baru. */
  create(input: TenantWriteInput) {
    return prisma.tenant.create({ data: input });
  }

  /** Perbarui tenant berdasarkan identifier. */
  update(id: string, input: TenantWriteInput) {
    return prisma.tenant.update({ where: { id }, data: input });
  }

  /** Hapus tenant berdasarkan identifier. */
  async delete(id: string) {
    await prisma.tenant.delete({ where: { id } });
  }

  /** Cari tenant lain yang memakai domain sama. */
  findDuplicateDomain(id: string, domain: string) {
    return prisma.tenant.findFirst({
      where: {
        domain,
        id: { not: id },
      },
    });
  }

  /** Cari tenant aktif berdasarkan domain. */
  findActiveByDomain(domain: string) {
    return prisma.tenant.findFirst({
      where: { domain, isActive: true },
      select: { id: true },
    });
  }
}
