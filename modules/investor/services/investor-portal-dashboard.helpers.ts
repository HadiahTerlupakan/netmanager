import {
  calculatePaymentRatio,
  collectInternalSiteIds,
  summarizeInternalCustomers,
  type InvestorPortalInternalCustomers,
} from "./investor-portal-customer-metrics.helpers";
import { bulatkanRupiah } from "../domain/bagi-hasil-proyek";
import { InvestorPortalRepository } from "../repositories/InvestorPortalRepository";
import { hitungHasilInvestorProyek } from "./investor-project-tracking.helpers";

export type SubscriberMetrics = {
  total: number;
  active: number;
  paying: number;
  paymentRatio: number;
};

type DashboardProjects = Awaited<
  ReturnType<InvestorPortalRepository["findDashboardProjects"]>
>;

type DashboardProject = DashboardProjects[number];

export type RevenueSnapshot = {
  internalCustomers: InvestorPortalInternalCustomers;
};

type DashboardResponse = {
  totalInvestment: string;
  totalProjectedRevenue: string;
  /**
   * Bagi hasil milik investor dari bulan-bulan aktual semua proyek (hitungan
   * RAB), dibulatkan ke sen seperti record bagi hasil yang disimpan.
   */
  totalActualRevenue: string;
  /** Pengembalian modal milik investor dari bulan-bulan aktual, dibulatkan ke sen. */
  totalCapitalReturned: string;
  activeProjectsCount: number;
  projects: Array<{
    id: string;
    name: string;
    status: string;
    siteName: string;
  }>;
  subscribers: SubscriberMetrics;
};

const FULL_PERCENT = 100;
const ZERO_BIGINT = 0n;
const ZERO_NUMBER = 0;
const GLOBAL_SITE_NAME = "Lokasi Global";

/** Memuat pelanggan internal dari seluruh site proyek dashboard investor. */
export async function buildDashboardRevenueSnapshot(
  repository: InvestorPortalRepository,
  projects: DashboardProjects,
): Promise<RevenueSnapshot> {
  const siteIds = collectInternalSiteIds(projects);

  return {
    internalCustomers: await repository.findInternalCustomers(siteIds),
  };
}

/** Meringkas metrik pelanggan dashboard dari pelanggan internal. */
export function buildDashboardSubscriberMetrics(
  snapshot: RevenueSnapshot,
): SubscriberMetrics {
  const metrics = summarizeInternalCustomers(
    snapshot.internalCustomers,
    new Date(),
  );

  return {
    total: metrics.total,
    active: metrics.active,
    paying: metrics.paying,
    paymentRatio: calculatePaymentRatio(metrics.active, metrics.paying),
  };
}

/** Menyusun response dashboard investor beserta total investasi dan revenue. */
export function buildDashboardResponse(
  projects: DashboardProjects,
  subscribers: SubscriberMetrics,
): DashboardResponse {
  const totals = calculateDashboardTotals(projects);

  return {
    totalInvestment: totals.totalInvestment.toString(),
    totalProjectedRevenue: totals.totalProjectedRevenue.toString(),
    totalActualRevenue: String(totals.totalActualRevenue),
    totalCapitalReturned: String(totals.totalCapitalReturned),
    activeProjectsCount: projects.length,
    projects: projects.map((item) => ({
      id: item.rabProject.id,
      name: item.rabProject.name,
      status: item.rabProject.status,
      siteName: item.rabProject.site?.name || GLOBAL_SITE_NAME,
    })),
    subscribers,
  };
}

function calculateDashboardTotals(projects: DashboardProjects) {
  return projects.reduce(
    (accumulator, item) => {
      const projected = calculateProjectedRevenue(item);
      const hasil = hitungHasilInvestorProyek(item.rabProject, item.investmentAmount);

      return {
        totalInvestment:
          accumulator.totalInvestment +
          BigInt(item.investmentAmount.toString()),
        totalProjectedRevenue: accumulator.totalProjectedRevenue + projected,
        // Per proyek sudah dibulatkan ke sen; jumlahnya dibulatkan lagi agar
        // galat floating point tidak memunculkan pecahan di bawah sen.
        totalActualRevenue: bulatkanRupiah(
          accumulator.totalActualRevenue + hasil.totalBagiHasil,
        ),
        totalCapitalReturned: bulatkanRupiah(
          accumulator.totalCapitalReturned + hasil.totalPengembalianModal,
        ),
      };
    },
    {
      totalInvestment: ZERO_BIGINT,
      totalProjectedRevenue: ZERO_BIGINT,
      totalActualRevenue: ZERO_NUMBER,
      totalCapitalReturned: ZERO_NUMBER,
    },
  );
}

function calculateProjectedRevenue(item: DashboardProject): bigint {
  const netProjected = Math.max(
    ZERO_NUMBER,
    Number(item.rabProject.projectedRevenue) -
      Number(item.rabProject.projectedOpex) -
      Number(item.rabProject.contingencyAmount),
  );

  return calculateInvestorShare(
    netProjected,
    hitungHasilInvestorProyek(item.rabProject, item.investmentAmount).persenBerlaku,
  );
}

function calculateInvestorShare(amount: number, percent: number): bigint {
  const normalizedAmount = Math.max(ZERO_NUMBER, amount);
  const investorShare = normalizedAmount * (Number(percent) / FULL_PERCENT);

  return BigInt(Math.floor(investorShare));
}
