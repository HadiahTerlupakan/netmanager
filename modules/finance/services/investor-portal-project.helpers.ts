import { InvestorPortalRepository } from "../repositories/InvestorPortalRepository";
import {
  calculatePaymentRatio,
  collectInternalSiteIds,
  collectMixRadiusOwners,
  collectMixRadiusSiteIds,
  createInvestorSiteMap,
  fetchMixRadiusCustomers,
  summarizeInternalCustomersBySite,
  summarizeMixRadiusCustomers,
  type CustomerMetrics,
  type InvestorPortalInternalCustomers,
} from "./investor-portal-customer-metrics.helpers";
import type { MixRadiusCustomer } from "@/modules/integrations";

const INTERNAL_BILLING_SOURCE = "INTERNAL";
const MIXRADIUS_BILLING_SOURCE = "MIXRADIUS";
const NONE_BILLING_SOURCE = "NONE";
const ZERO_NUMBER = 0;
const PROJECT_LOG_PREFIX = "[INVESTOR_PROJECTS]";

type ProjectListItems = Awaited<
  ReturnType<InvestorPortalRepository["findProjectList"]>
>;
type ProjectListItem = ProjectListItems[number];
type ProjectDetailItem = NonNullable<
  Awaited<ReturnType<InvestorPortalRepository["findProjectDetail"]>>
>;

type InvestorSite = Awaited<
  ReturnType<InvestorPortalRepository["findMixRadiusInvestorSiteById"]>
>;

type BillingMetrics = {
  totalSubscribers: number;
  activeSubscribers: number;
  payingSubscribers: number;
  estimatedRevenue: number;
};

type ProjectSnapshot = {
  internalCustomers: InvestorPortalInternalCustomers;
  mixRadiusCustomers: MixRadiusCustomer[];
  investorSiteMap: Map<string, NonNullable<InvestorSite>>;
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
  siteName: string | null | undefined;
  billingSource: string;
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
    opex: string;
  }>;
  estimatedCurrentRevenue: string;
  subscribers: {
    total: number;
    active: number;
    paying: number;
    paymentRatio: number;
  };
};

export async function buildProjectSnapshot(
  repository: InvestorPortalRepository,
  projects: ProjectListItems,
): Promise<ProjectSnapshot> {
  const siteIds = collectInternalSiteIds(projects);
  const mixRadiusSiteIds = collectMixRadiusSiteIds(projects);
  const [internalCustomers, investorSites] = await Promise.all([
    repository.findInternalCustomers(siteIds),
    repository.findMixRadiusInvestorSites(mixRadiusSiteIds),
  ]);
  const owners = collectMixRadiusOwners(investorSites);

  return {
    internalCustomers,
    mixRadiusCustomers: await fetchMixRadiusCustomers(
      owners,
      PROJECT_LOG_PREFIX,
    ),
    investorSiteMap: createInvestorSiteMap(investorSites),
  };
}

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
    profitSharePercent: item.profitSharePercent,
    projectedRevenue: item.rabProject.projectedRevenue.toString(),
    projectedOpex: item.rabProject.projectedOpex.toString(),
    contingencyAmount: item.rabProject.contingencyAmount.toString(),
    totalActualRevenue: (actualTotals.revenue + runningRevenue).toString(),
    totalActualOpex: actualTotals.opex.toString(),
    createdAt: item.rabProject.createdAt,
  };
}

export async function buildProjectBillingMetrics(
  repository: InvestorPortalRepository,
  project: ProjectDetailItem,
  mixRadiusInvestorSite: InvestorSite,
): Promise<BillingMetrics> {
  if (
    project.rabProject.siteId &&
    !project.rabProject.mixRadiusInvestorSiteId
  ) {
    return buildInternalBillingMetrics(repository, project.rabProject.siteId);
  }

  if (!mixRadiusInvestorSite) {
    return createEmptyBillingMetrics();
  }

  return buildMixRadiusBillingMetrics(mixRadiusInvestorSite.owners || []);
}

export function toProjectDetail(
  project: ProjectDetailItem,
  mixRadiusInvestorSite: InvestorSite,
  billingMetrics: BillingMetrics,
): ProjectDetailResponse {
  const rabProject = project.rabProject;

  return {
    id: rabProject.id,
    name: rabProject.name,
    description: rabProject.description,
    status: rabProject.status,
    siteName: rabProject.mixRadiusInvestorSiteId
      ? mixRadiusInvestorSite?.name
      : rabProject.site?.name,
    billingSource: getBillingSource(
      rabProject.siteId,
      rabProject.mixRadiusInvestorSiteId,
    ),
    investmentAmount: project.investmentAmount.toString(),
    profitSharePercent: project.profitSharePercent,
    projectedRevenue: rabProject.projectedRevenue.toString(),
    projectedOpex: rabProject.projectedOpex.toString(),
    contingencyAmount: rabProject.contingencyAmount.toString(),
    targetSubscribers: rabProject.targetSubscribers,
    growthType: rabProject.growthType,
    createdAt: rabProject.createdAt,
    actualAchievements: rabProject.actualAchievements.map((achievement) => ({
      id: achievement.id,
      month: achievement.month,
      year: achievement.year,
      achievedRevenue: achievement.actualRevenue.toString(),
      opex: achievement.actualOpex.toString(),
    })),
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
  if (item.rabProject.siteId && !item.rabProject.mixRadiusInvestorSiteId) {
    return summarizeInternalCustomersBySite(
      snapshot.internalCustomers,
      item.rabProject.siteId,
      now,
    ).revenue;
  }

  const investorSiteId = item.rabProject.mixRadiusInvestorSiteId;
  const owners = investorSiteId
    ? snapshot.investorSiteMap.get(investorSiteId)?.owners || []
    : [];

  return summarizeMixRadiusCustomers(snapshot.mixRadiusCustomers, owners, now)
    .revenue;
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

async function buildMixRadiusBillingMetrics(
  owners: string[],
): Promise<BillingMetrics> {
  const metrics = summarizeMixRadiusCustomers(
    await fetchMixRadiusCustomers(owners, PROJECT_LOG_PREFIX),
    owners,
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

function getBillingSource(
  siteId: string | null,
  mixRadiusInvestorSiteId: string | null,
): string {
  if (mixRadiusInvestorSiteId) {
    return MIXRADIUS_BILLING_SOURCE;
  }

  if (siteId) {
    return INTERNAL_BILLING_SOURCE;
  }

  return NONE_BILLING_SOURCE;
}
