import { Prisma } from "@prisma/client";

/** Bangun where gudang untuk mobile inventory. */
export function buildMobileGudangWhere(input: {
  tenantId: string;
  siteIds?: string[];
}): Prisma.GudangWhereInput {
  const where: Prisma.GudangWhereInput = {
    isActive: true,
    tenantId: input.tenantId,
  };
  if (input.siteIds) where.sites = { some: { id: { in: input.siteIds } } };
  return where;
}

/** Bangun filter site pada query gudang. */
export function buildSiteFilter(siteIds: string[]): Prisma.GudangWhereInput {
  return { sites: { some: { id: { in: siteIds } } } };
}

/** Select barang ringan untuk mobile inventory. */
export function buildMobileBarangSelect() {
  return {
    id: true,
    kode: true,
    nama: true,
    satuan: true,
    isWorkOrderMaterial: true,
  } satisfies Prisma.BarangSelect;
}

/** Include histori mobile inventory. */
export function buildMobileHistoryInclude() {
  return {
    barang: { select: { kode: true, nama: true, satuan: true } },
    gudang: { select: { nama: true } },
  } satisfies Prisma.BarangMasukInclude;
}
