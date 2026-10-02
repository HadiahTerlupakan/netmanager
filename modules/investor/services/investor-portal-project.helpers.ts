import { InvestorPortalRepository } from "../repositories/InvestorPortalRepository";
import { hitungHasilInvestorProyek } from "./investor-project-tracking.helpers";
import {
  calculatePaymentRatio,
  collectInternalSiteIds,
  summarizeInternalCustomersBySite,
  type CustomerMetrics,
  type InvestorPortalInternalCustomers,
} from "./investor-portal-customer-metrics.helpers";

const INTERNAL_BILLING_SOURCE = "INTERNAL";
const NONE_BILLING_SOURCE = "NONE";
const ZERO_NUMBER = 0;

type ProjectBillingSource =
  | typeof INTERNAL_BILLING_SOURCE
  | typeof NONE_BILLING_SOURCE;

type ProjectListItems = Awaited<
  ReturnType<InvestorPortalRepository["findProjectList"]>
>;
type ProjectListItem = ProjectListItems[number];
type ProjectDetailItem = NonNullable<
  Awaited<ReturnType<InvestorPortalRepository["findProjectDetail"]>>
>;

type BillingMetrics = {
  totalSubscribers: number;
  activeSubscribers: number;
  payingSubscribers: number;
  estimatedRevenue: number;
};

type ProjectSnapshot = {
  internalCustomers: InvestorPortalInternalCustomers;
};

type ProjectListResponseItem = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  siteName: string | undefined;
  investmentAmount: string;
  profitSharePercent: number;
  projectedRevenue: string;
  projectedOpex: string;
  contingencyAmount: string;
  totalActualRevenue: string;
  totalActualOpex: string;
  createdAt: Date;
};

type ProjectDetailResponse = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  siteName: string | undefined;
  billingSource: ProjectBillingSource;
  /** Awal bulan ke-1 proyek; capaian bulanan bernomor relatif terhadapnya. */
  startDate: Date | null;
  investmentAmount: string;
  profitSharePercent: number;
  projectedRevenue: string;
  projectedOpex: string;
  contingencyAmount: string;
  targetSubscribers: number | null;
  growthType: string | null;
  createdAt: Date;
  actualAchievements: Array<{
    id: string;
    month: number;
    year: number;
    achievedRevenue: string;
    /** OPEX aktual yang diisi admin; null = belum diisi. */
    opex: string | null;
    /** Biaya operasional yang dipakai hitungan RAB bulan ini. */
    opexUsed: number;
    /** Bagi hasil milik investor ini bulan ini (hitungan RAB). */
    myProfitShare: number;
    /** Pengembalian modal milik investor ini bulan ini (hitungan RAB). */
    myCapitalReturn: number;
  }>;
  /** Total bagi hasil & pengembalian modal milik investor dari bulan aktual. */
  myTotalProfitShare: number;
  myTotalCapitalReturn: number;
  estimatedCurrentRevenue: string;
  subscribers: {
    total: number;
    active: number;
    paying: number;
    paymentRatio: number;
  };
};

/** Memuat pelanggan internal dari seluruh site proyek investor. */
export async function buildProjectSnapshot(
  repository: InvestorPortalRepository,
  projects: ProjectListItems,
): Promise<ProjectSnapshot> {
  const siteIds = collectInternalSiteIds(projects);

  return {
    internalCustomers: await repository.findInternalCustomers(siteIds),
  };
}

/** Memetakan proyek investor ke item list beserta revenue berjalan. */
export function toProjectListItem(
  item: ProjectListItem,
  snapshot: ProjectSnapshot,
): ProjectListResponseItem {
  const actualTotals = summarizeProjectHistory(item);
  const runningRevenue = getRunningRevenue(item, snapshot, new Date());

  return {
    id: item.rabProject.id,
    name: item.rabProject.name,
    description: item.rabProject.description,
    status: item.rabProject.status,
    siteName: item.rabProject.site?.name,
    investmentAmount: item.investmentAmount.toString(),
    profitSharePercent: hitungHasilInvestorProyek(item.rabProject, item.investmentAmount).persenBerlaku,
    projectedRevenue: item.rabProject.projectedRevenue.toString(),
    projectedOpex: item.rabProject.projectedOpex.toString(),
    contingencyAmount: item.rabProject.contingencyAmount.toString(),
    totalActualRevenue: (actualTotals.revenue + runningRevenue).toString(),
    totalActualOpex: actualTotals.opex.toString(),
    createdAt: item.rabProject.createdAt,
  };
}

/** Menghitung metrik billing proyek; proyek tanpa site mendapat metrik kosong. */
export async function buildProjectBillingMetrics(
  repository: InvestorPortalRepository,
  project: ProjectDetailItem,
): Promise<BillingMetrics> {
  const siteId = project.rabProject.siteId;

  if (!siteId) {
    return createEmptyBillingMetrics();
  }

  return buildInternalBillingMetrics(repository, siteId);
}

/** Memetakan proyek investor ke response detail beserta metrik billing. */
export function toProjectDetail(
  project: ProjectDetailItem,
  billingMetrics: BillingMetrics,
): ProjectDetailResponse {
  const rabProject = project.rabProject;
  const hasil = hitungHasilInvestorProyek(rabProject, project.investmentAmount);

  return {
    id: rabProject.id,
    name: rabProject.name,
    description: rabProject.description,
    status: rabProject.status,
    siteName: rabProject.site?.name,
    billingSource: getBillingSource(rabProject.siteId),
    startDate: rabProject.startDate,
    investmentAmount: project.investmentAmount.toString(),
    profitSharePercent: hasil.persenBerlaku,
    projectedRevenue: rabProject.projectedRevenue.toString(),
    projectedOpex: rabProject.projectedOpex.toString(),
    contingencyAmount: rabProject.contingencyAmount.toString(),
    targetSubscribers: rabProject.targetSubscribers,
    growthType: rabProject.growthType,
    createdAt: rabProject.createdAt,
    actualAchievements: rabProject.actualAchievements.map((achievement) => {
      const bulan = hasil.bulanan.find((b) => b.month === achievement.month);
      return {
        id: achievement.id,
        month: achievement.month,
        year: achievement.year,
        achievedRevenue: achievement.actualRevenue.toString(),
        opex: achievement.actualOpex?.toString() ?? null,
        opexUsed: bulan?.opex ?? ZERO_NUMBER,
        myProfitShare: bulan?.myProfitShare ?? ZERO_NUMBER,
        myCapitalReturn: bulan?.myCapitalReturn ?? ZERO_NUMBER,
      };
    }),
    myTotalProfitShare: hasil.totalBagiHasil,
    myTotalCapitalReturn: hasil.totalPengembalianModal,
    estimatedCurrentRevenue: billingMetrics.estimatedRevenue.toString(),
    subscribers: {
      total: billingMetrics.totalSubscribers,
      active: billingMetrics.activeSubscribers,
      paying: billingMetrics.payingSubscribers,
      paymentRatio: calculatePaymentRatio(
        billingMetrics.activeSubscribers,
        billingMetrics.payingSubscribers,
      ),
    },
  };
}

function summarizeProjectHistory(item: ProjectListItem): {
  revenue: number;
  opex: number;
} {
  return item.rabProject.actualAchievements.reduce(
    (totals, achievement) => ({
      revenue: totals.revenue + Number(achievement.actualRevenue),
      opex: totals.opex + Number(achievement.actualOpex || 0),
    }),
    {
      revenue: ZERO_NUMBER,
      opex: ZERO_NUMBER,
    },
  );
}

function getRunningRevenue(
  item: ProjectListItem,
  snapshot: ProjectSnapshot,
  now: Date,
): number {
  const siteId = item.rabProject.siteId;

  if (!siteId) {
    return ZERO_NUMBER;
  }

  return summarizeInternalCustomersBySite(
    snapshot.internalCustomers,
    siteId,
    now,
  ).revenue;
}

async function buildInternalBillingMetrics(
  repository: InvestorPortalRepository,
  siteId: string,
): Promise<BillingMetrics> {
  const metrics = summarizeInternalCustomersBySite(
    await repository.findInternalCustomers([siteId]),
    siteId,
    new Date(),
  );

  return toBillingMetrics(metrics);
}

function toBillingMetrics(metrics: CustomerMetrics): BillingMetrics {
  return {
    totalSubscribers: metrics.total,
    activeSubscribers: metrics.active,
    payingSubscribers: metrics.paying,
    estimatedRevenue: metrics.revenue,
  };
}

function createEmptyBillingMetrics(): BillingMetrics {
  return {
    totalSubscribers: ZERO_NUMBER,
    activeSubscribers: ZERO_NUMBER,
    payingSubscribers: ZERO_NUMBER,
    estimatedRevenue: ZERO_NUMBER,
  };
}

function getBillingSource(siteId: string | null): ProjectBillingSource {
  return siteId ? INTERNAL_BILLING_SOURCE : NONE_BILLING_SOURCE;
}
