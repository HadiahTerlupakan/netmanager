import {
  calculatePaymentRatio,
  collectInternalSiteIds,
  collectMixRadiusOwners,
  collectMixRadiusSiteIds,
  createInvestorSiteMap,
  fetchMixRadiusCustomers,
  summarizeInternalCustomers,
  summarizeInternalCustomersBySite,
  summarizeMixRadiusCustomers,
  type InvestorPortalInternalCustomers,
} from "./investor-portal-customer-metrics.helpers";
import { InvestorPortalRepository } from "../repositories/InvestorPortalRepository";
import type { MixRadiusCustomer } from "@/modules/integrations";

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

type InvestorSite = { id: string; name: string; owners: string[] | null };

export type RevenueSnapshot = {
  internalCustomers: InvestorPortalInternalCustomers;
  mixRadiusCustomers: MixRadiusCustomer[];
  investorSiteMap: Map<string, InvestorSite>;
};

type DashboardResponse = {
  totalInvestment: string;
  totalProjectedRevenue: string;
  totalActualRevenue: string;
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
const DASHBOARD_LOG_PREFIX = "[INVESTOR_DASHBOARD]";

export async function buildDashboardRevenueSnapshot(
  repository: InvestorPortalRepository,
  projects: DashboardProjects,
): Promise<RevenueSnapshot> {
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
      DASHBOARD_LOG_PREFIX,
    ),
    investorSiteMap: createInvestorSiteMap(investorSites),
  };
}

export function buildDashboardSubscriberMetrics(
  snapshot: RevenueSnapshot,
): SubscriberMetrics {
  const now = new Date();
  const internalMetrics = summarizeInternalCustomers(
    snapshot.internalCustomers,
    now,
  );
  const owners = collectMixRadiusOwners([...snapshot.investorSiteMap.values()]);
  const mixRadiusMetrics = summarizeMixRadiusCustomers(
    snapshot.mixRadiusCustomers,
    owners,
    now,
  );
  const total = internalMetrics.total + mixRadiusMetrics.total;
  const active = internalMetrics.active + mixRadiusMetrics.active;
  const paying = internalMetrics.paying + mixRadiusMetrics.active;

  return {
    total,
    active,
    paying,
    paymentRatio: calculatePaymentRatio(active, paying),
  };
}

export function buildDashboardResponse(
  projects: DashboardProjects,
  snapshot: RevenueSnapshot,
  subscribers: SubscriberMetrics,
): DashboardResponse {
  const totals = calculateDashboardTotals(projects, snapshot);

  return {
    totalInvestment: totals.totalInvestment.toString(),
    totalProjectedRevenue: totals.totalProjectedRevenue.toString(),
    totalActualRevenue: totals.totalActualRevenue.toString(),
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

function calculateDashboardTotals(
  projects: DashboardProjects,
  snapshot: RevenueSnapshot,
) {
  const now = new Date();

  return projects.reduce(
    (accumulator, item) => {
      const projected = calculateProjectedRevenue(item);
      const actual = calculateActualRevenue(item, snapshot, now);

      return {
        totalInvestment:
          accumulator.totalInvestment +
          BigInt(item.investmentAmount.toString()),
        totalProjectedRevenue: accumulator.totalProjectedRevenue + projected,
        totalActualRevenue: accumulator.totalActualRevenue + actual,
      };
    },
    {
      totalInvestment: ZERO_BIGINT,
      totalProjectedRevenue: ZERO_BIGINT,
      totalActualRevenue: ZERO_BIGINT,
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

  return calculateInvestorShare(netProjected, item.profitSharePercent);
}

function calculateActualRevenue(
  item: DashboardProject,
  snapshot: RevenueSnapshot,
  now: Date,
): bigint {
  const currentRevenue = calculateCurrentRevenue(item, snapshot, now);
  const runningShare = calculateInvestorShare(
    currentRevenue - Number(item.rabProject.projectedOpex || 0),
    item.profitSharePercent,
  );
  const historyShare = item.rabProject.actualAchievements.reduce(
    (total, achievement) => {
      const netRevenue =
        Number(achievement.actualRevenue) - Number(achievement.actualOpex || 0);

      return (
        total + calculateInvestorShare(netRevenue, item.profitSharePercent)
      );
    },
    ZERO_BIGINT,
  );

  return runningShare + historyShare;
}

function calculateCurrentRevenue(
  item: DashboardProject,
  snapshot: RevenueSnapshot,
  now: Date,
): number {
  if (item.rabProject.siteId && !item.rabProject.mixRadiusInvestorSiteId) {
    return getInternalRevenueBySite(
      item.rabProject.siteId,
      snapshot.internalCustomers,
      now,
    );
  }

  const investorSiteId = item.rabProject.mixRadiusInvestorSiteId;
  const owners = investorSiteId
    ? snapshot.investorSiteMap.get(investorSiteId)?.owners || []
    : [];

  return summarizeMixRadiusCustomers(snapshot.mixRadiusCustomers, owners, now)
    .revenue;
}

function getInternalRevenueBySite(
  siteId: string,
  customers: InvestorPortalInternalCustomers,
  now: Date,
): number {
  return summarizeInternalCustomersBySite(customers, siteId, now).revenue;
}

function calculateInvestorShare(amount: number, percent: number): bigint {
  const normalizedAmount = Math.max(ZERO_NUMBER, amount);
  const investorShare = normalizedAmount * (Number(percent) / FULL_PERCENT);

  return BigInt(Math.floor(investorShare));
}
