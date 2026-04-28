import { logger } from "@/lib/logger";
import type { MixRadiusCustomer } from "@/modules/integrations";
import {
  getMixRadiusService,
  matchesMixRadiusOwner,
} from "@/modules/integrations";
import { InvestorPortalRepository } from "../repositories/InvestorPortalRepository";

type SubscriberMetrics = {
  total: number;
  active: number;
  paying: number;
  paymentRatio: number;
};

type RevenueSnapshot = {
  internalCustomers: Awaited<
    ReturnType<InvestorPortalRepository["findInternalCustomers"]>
  >;
  mixRadiusCustomers: MixRadiusCustomer[];
  investorSiteMap: Map<
    string,
    { id: string; name: string; owners: string[] | null }
  >;
};

const MIXRADIUS_FETCH_LIMIT = 10000;
const FULL_PERCENT = 100;
const ZERO_BIGINT = 0n;
const ZERO_NUMBER = 0;
const GLOBAL_SITE_NAME = "Lokasi Global";
const ACTIVE_MIXRADIUS_STATUSES = new Set(["Active", "Enabled-Users"]);

function collectInternalSiteIds(
  projects: Awaited<
    ReturnType<InvestorPortalRepository["findDashboardProjects"]>
  >,
) {
  return [
    ...new Set(projects.map((item) => item.rabProject.siteId).filter(Boolean)),
  ];
}

function collectMixRadiusSiteIds(
  projects: Awaited<
    ReturnType<InvestorPortalRepository["findDashboardProjects"]>
  >,
) {
  return [
    ...new Set(
      projects
        .map((item) => item.rabProject.mixRadiusInvestorSiteId)
        .filter(Boolean),
    ),
  ];
}

function collectMixRadiusOwners(sites: Array<{ owners: string[] | null }>) {
  return [...new Set(sites.flatMap((site) => site.owners || []))];
}

function createInvestorSiteMap(
  sites: Array<{ id: string; name: string; owners: string[] | null }>,
) {
  return new Map(sites.map((site) => [site.id, site]));
}

function isMixRadiusCustomerActive(customer: MixRadiusCustomer, now: Date) {
  if (!ACTIVE_MIXRADIUS_STATUSES.has(customer.auth_status)) {
    return false;
  }

  if (!customer.expired_on) {
    return true;
  }

  const expiredDate = new Date(customer.expired_on);
  return !Number.isNaN(expiredDate.getTime()) && expiredDate >= now;
}

function calculatePaymentRatio(active: number, paying: number) {
  if (active === ZERO_NUMBER) {
    return ZERO_NUMBER;
  }

  return Math.round((paying / active) * FULL_PERCENT);
}

function getInternalRevenueBySite(
  siteId: string,
  customers: Awaited<
    ReturnType<InvestorPortalRepository["findInternalCustomers"]>
  >,
  now: Date,
) {
  return customers
    .filter((customer) => customer.siteId === siteId)
    .filter(
      (customer) => customer.status === "AKTIF" && customer.jatuhTempo > now,
    )
    .reduce(
      (total, customer) => total + Number(customer.hargaPaket?.harga || 0),
      0,
    );
}

function getMixRadiusRevenueByOwners(
  owners: string[],
  customers: MixRadiusCustomer[],
  now: Date,
) {
  return customers
    .filter((customer) => matchesMixRadiusOwner(customer.owner_name, owners))
    .filter((customer) => isMixRadiusCustomerActive(customer, now))
    .reduce((total, customer) => total + Number(customer.total || 0), 0);
}

export class InvestorPortalDashboardService {
  constructor(private readonly repository = new InvestorPortalRepository()) {}

  /** Mengambil ringkasan dashboard investor berbasis proyek aktif. */
  async getDashboard(investorId: string) {
    const projects = await this.repository.findDashboardProjects(investorId);
    const revenueSnapshot = await this.buildRevenueSnapshot(projects);
    const subscriberMetrics = this.buildSubscriberMetrics(revenueSnapshot);
    return this.buildDashboardResponse(
      projects,
      revenueSnapshot,
      subscriberMetrics,
    );
  }

  private async buildRevenueSnapshot(
    projects: Awaited<
      ReturnType<InvestorPortalRepository["findDashboardProjects"]>
    >,
  ): Promise<RevenueSnapshot> {
    const siteIds = collectInternalSiteIds(projects);
    const mixRadiusSiteIds = collectMixRadiusSiteIds(projects);
    const [internalCustomers, investorSites] = await Promise.all([
      this.repository.findInternalCustomers(siteIds),
      this.repository.findMixRadiusInvestorSites(mixRadiusSiteIds),
    ]);
    const owners = collectMixRadiusOwners(investorSites);
    const mixRadiusCustomers = await this.fetchMixRadiusCustomers(owners);

    return {
      internalCustomers,
      mixRadiusCustomers,
      investorSiteMap: createInvestorSiteMap(investorSites),
    };
  }

  private async fetchMixRadiusCustomers(owners: string[]) {
    if (owners.length === ZERO_NUMBER) {
      return [] as MixRadiusCustomer[];
    }

    try {
      const response = await getMixRadiusService().fetchCustomersPPP({
        start: 0,
        length: MIXRADIUS_FETCH_LIMIT,
        forceRefresh: false,
      });
      return response.data || [];
    } catch (error) {
      logger.error("[INVESTOR_DASHBOARD] MixRadius fetch error:", error);
      return [] as MixRadiusCustomer[];
    }
  }

  private buildSubscriberMetrics(snapshot: RevenueSnapshot): SubscriberMetrics {
    const now = new Date();
    const internalTotal = snapshot.internalCustomers.length;
    const internalActive = snapshot.internalCustomers.filter(
      (customer) => customer.status === "AKTIF",
    ).length;
    const internalPaying = snapshot.internalCustomers.filter(
      (customer) => customer.status === "AKTIF" && customer.jatuhTempo > now,
    ).length;
    const mixRadiusMatching = snapshot.mixRadiusCustomers.filter((customer) =>
      matchesMixRadiusOwner(
        customer.owner_name,
        collectMixRadiusOwners([...snapshot.investorSiteMap.values()]),
      ),
    );
    const mixRadiusActive = mixRadiusMatching.filter((customer) =>
      isMixRadiusCustomerActive(customer, now),
    ).length;
    const total = internalTotal + mixRadiusMatching.length;
    const active = internalActive + mixRadiusActive;
    const paying = internalPaying + mixRadiusActive;

    return {
      total,
      active,
      paying,
      paymentRatio: calculatePaymentRatio(active, paying),
    };
  }

  private buildDashboardResponse(
    projects: Awaited<
      ReturnType<InvestorPortalRepository["findDashboardProjects"]>
    >,
    snapshot: RevenueSnapshot,
    subscribers: SubscriberMetrics,
  ) {
    const totals = this.calculateTotals(projects, snapshot);
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

  private calculateTotals(
    projects: Awaited<
      ReturnType<InvestorPortalRepository["findDashboardProjects"]>
    >,
    snapshot: RevenueSnapshot,
  ) {
    const now = new Date();
    return projects.reduce(
      (accumulator, item) => {
        const projected = this.calculateProjectedRevenue(item);
        const actual = this.calculateActualRevenue(item, snapshot, now);
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

  private calculateProjectedRevenue(
    item: Awaited<
      ReturnType<InvestorPortalRepository["findDashboardProjects"]>
    >[number],
  ) {
    const netProjected = Math.max(
      ZERO_NUMBER,
      Number(item.rabProject.projectedRevenue) -
        Number(item.rabProject.projectedOpex) -
        Number(item.rabProject.contingencyAmount),
    );
    const investorShare =
      netProjected * (Number(item.profitSharePercent) / FULL_PERCENT);
    return BigInt(Math.floor(investorShare));
  }

  private calculateActualRevenue(
    item: Awaited<
      ReturnType<InvestorPortalRepository["findDashboardProjects"]>
    >[number],
    snapshot: RevenueSnapshot,
    now: Date,
  ) {
    const currentRevenue = this.calculateCurrentRevenue(item, snapshot, now);
    const runningShare = this.calculateInvestorShare(
      currentRevenue - Number(item.rabProject.projectedOpex || 0),
      item.profitSharePercent,
    );
    const historyShare = item.rabProject.actualAchievements.reduce(
      (total, achievement) => {
        const netRevenue =
          Number(achievement.actualRevenue) -
          Number(achievement.actualOpex || 0);
        return (
          total +
          this.calculateInvestorShare(netRevenue, item.profitSharePercent)
        );
      },
      ZERO_BIGINT,
    );

    return runningShare + historyShare;
  }

  private calculateCurrentRevenue(
    item: Awaited<
      ReturnType<InvestorPortalRepository["findDashboardProjects"]>
    >[number],
    snapshot: RevenueSnapshot,
    now: Date,
  ) {
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
    return getMixRadiusRevenueByOwners(
      owners,
      snapshot.mixRadiusCustomers,
      now,
    );
  }

  private calculateInvestorShare(amount: number, percent: number) {
    const normalizedAmount = Math.max(ZERO_NUMBER, amount);
    const investorShare = normalizedAmount * (Number(percent) / FULL_PERCENT);
    return BigInt(Math.floor(investorShare));
  }
}

let investorPortalDashboardService: InvestorPortalDashboardService | null =
  null;

export function getInvestorPortalDashboardService() {
  if (!investorPortalDashboardService) {
    investorPortalDashboardService = new InvestorPortalDashboardService();
  }

  return investorPortalDashboardService;
}
