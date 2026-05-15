import { formatInTimeZone } from "date-fns-tz";
import { prismaBilling } from "@/modules/database";
import { prismaMitra } from "@/lib/prisma-mitra";
import { getTimezoneSync } from "@/lib/utils/get-timezone";
import { SiteService } from "@/modules/roles";
import type { FeePelangganStatsQuery } from "../domain/ports/IMitraRepository";
import { toMitraStatsEntity } from "../mappers/MitraDomainMapper";

const MILLISECOND_OFFSET = 1;
const EARNING_TYPE = "EARNING";
const FEE_PELANGGAN_REFERENCE_PREFIX = "PAYOUT-FEE-";

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

/** Calculate fee pelanggan stats for mitra sales dashboards. */
export async function getFeePelangganStatsData(query: FeePelangganStatsQuery) {
  const timezone = getTimezoneSync(query.tenantId);
  const yesterdayEnd = createYesterdayEnd(query.today);
  const currentMonthKey = buildFeePelangganMonthKey(query.monthStart, timezone);
  const invoices = await prismaBilling.mixRadiusInvoice.findMany({
    where: {
      status: "PAID",
      issuedDate: { gte: query.monthStart, lte: yesterdayEnd },
      ownerName: { in: query.ownerNames },
    },
    select: { username: true },
  });
  const activeCustomers = new Set(invoices.map((invoice) => invoice.username))
    .size;
  const totalFeePelanggan = activeCustomers * query.feeRate;
  const remainingFeePelanggan = await getRemainingFeePelanggan({
    mitraId: query.mitraId,
    currentMonthKey,
    totalFeePelanggan,
  });

  return {
    activeCustomers,
    totalFeePelanggan,
    remainingFeePelanggan,
    unpaidCustomersCount: getUnpaidCustomersCount(
      remainingFeePelanggan,
      query.feeRate,
    ),
  };
}

/** Resolve site metadata for mitra ID card views. */
export async function findSiteNameById(siteId: string | null) {
  return getSiteServiceInstance().getSiteNameById(siteId);
}

function buildFeePelangganMonthKey(monthStart: Date, timezone: string) {
  return formatInTimeZone(monthStart, timezone, "yyyy-MM");
}

function createYesterdayEnd(today: Date) {
  const yesterdayEnd = new Date(today);
  yesterdayEnd.setMilliseconds(-MILLISECOND_OFFSET);
  return yesterdayEnd;
}

async function getRemainingFeePelanggan(input: {
  mitraId: string;
  currentMonthKey: string;
  totalFeePelanggan: number;
}) {
  const syncedFees = await prismaMitra.mitraTransaction.aggregate({
    where: {
      wallet: { mitraId: input.mitraId },
      type: EARNING_TYPE,
      referenceId: {
        startsWith: `${FEE_PELANGGAN_REFERENCE_PREFIX}${input.currentMonthKey}-`,
      },
    },
    _sum: { amount: true },
  });
  const totalSynced = Number(syncedFees._sum.amount || 0);
  return Math.max(0, input.totalFeePelanggan - totalSynced);
}

function getUnpaidCustomersCount(
  remainingFeePelanggan: number,
  feeRate: number,
) {
  if (feeRate <= 0) {
    return 0;
  }

  return Math.floor(remainingFeePelanggan / feeRate);
}
