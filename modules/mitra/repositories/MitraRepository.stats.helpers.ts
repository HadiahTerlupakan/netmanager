import { prismaMitra } from "@/lib/prisma-mitra";
import { SiteService } from "@/modules/roles";
import { toMitraStatsEntity } from "../mappers/MitraDomainMapper";

let siteServiceInstance: SiteService | null = null;
function getSiteServiceInstance(): SiteService {
  if (!siteServiceInstance) siteServiceInstance = new SiteService();
  return siteServiceInstance;
}

/** Collect aggregate mitra statistics within optional tenant scope. */
export async function getMitraStatsData(tenantId?: string) {
  const mitraWhere = tenantId ? { tenantId } : {};
  const walletWhere = tenantId ? { mitra: { tenantId } } : {};
  const [totalTeknisi, totalSales, totalActive, totalWalletBalance] =
    await Promise.all([
      prismaMitra.mitra.count({
        where: { ...mitraWhere, mitraType: "MITRA_TEKNISI" },
      }),
      prismaMitra.mitra.count({
        where: { ...mitraWhere, mitraType: "MITRA_SALES" },
      }),
      prismaMitra.mitra.count({ where: { ...mitraWhere, isActive: true } }),
      prismaMitra.mitraWallet.aggregate({
        where: walletWhere,
        _sum: { balance: true },
      }),
    ]);

  return toMitraStatsEntity({
    totalTeknisi,
    totalSales,
    totalActive,
    totalBalance: totalWalletBalance._sum.balance?.toNumber() || 0,
  });
}

/** Resolve site metadata for mitra ID card views. */
export async function findSiteNameById(siteId: string | null) {
  return getSiteServiceInstance().getSiteNameById(siteId);
}
