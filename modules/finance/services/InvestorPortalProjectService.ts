import type { MixRadiusCustomer } from "@/modules/integrations";
import {
  getMixRadiusService,
  matchesMixRadiusOwner,
} from "@/modules/integrations";
import { InvestorPortalRepository } from "../repositories/InvestorPortalRepository";
import { createRouteServiceError } from "./RouteServiceError";

const MIXRADIUS_FETCH_LIMIT = 10000;
const FULL_PERCENT = 100;
const ACTIVE_MIXRADIUS_STATUSES = new Set(["Active", "Enabled-Users"]);
const INTERNAL_BILLING_SOURCE = "INTERNAL";
const MIXRADIUS_BILLING_SOURCE = "MIXRADIUS";
const NONE_BILLING_SOURCE = "NONE";

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
  if (active === 0) {
    return 0;
  }

  return Math.round((paying / active) * FULL_PERCENT);
}

export class InvestorPortalProjectService {
  constructor(private readonly repository = new InvestorPortalRepository()) {}

  /** Mengambil daftar proyek investor beserta ringkasan actual revenue. */
  async getProjects(investorId: string) {
    const projects = await this.repository.findProjectList(investorId);
    const snapshot = await this.buildProjectSnapshot(projects);
    return projects.map((item) => this.toProjectListItem(item, snapshot));
  }

  /** Mengambil detail proyek investor berdasarkan akses investor. */
  async getProjectDetail(projectId: string, investorId: string) {
    const project = await this.repository.findProjectDetail(
      projectId,
      investorId,
    );
    if (!project) {
      throw createRouteServiceError("Proyek tidak ditemukan", 404);
    }

    const mixRadiusInvestorSite = project.rabProject.mixRadiusInvestorSiteId
      ? await this.repository.findMixRadiusInvestorSiteById(
          project.rabProject.mixRadiusInvestorSiteId,
        )
      : null;
    const billingMetrics = await this.buildProjectBillingMetrics(
      project,
      mixRadiusInvestorSite,
    );
    return this.toProjectDetail(project, mixRadiusInvestorSite, billingMetrics);
  }

  private async buildProjectSnapshot(
    projects: Awaited<ReturnType<InvestorPortalRepository["findProjectList"]>>,
  ) {
    const siteIds = [
      ...new Set(
        projects.map((item) => item.rabProject.siteId).filter(Boolean),
      ),
    ];
    const mixRadiusSiteIds = [
      ...new Set(
        projects
          .map((item) => item.rabProject.mixRadiusInvestorSiteId)
          .filter(Boolean),
      ),
    ];
    const [internalCustomers, investorSites] = await Promise.all([
      this.repository.findInternalCustomers(siteIds),
      this.repository.findMixRadiusInvestorSites(mixRadiusSiteIds),
    ]);
    const mixRadiusCustomers = await this.fetchMixRadiusCustomers(
      investorSites.flatMap((site) => site.owners || []),
    );

    return {
      internalCustomers,
      mixRadiusCustomers,
      investorSiteMap: new Map(investorSites.map((site) => [site.id, site])),
    };
  }

  private async fetchMixRadiusCustomers(owners: string[]) {
    if (owners.length === 0) {
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
      console.error("[INVESTOR_PROJECTS] MixRadius fetch error:", error);
      return [] as MixRadiusCustomer[];
    }
  }

  private toProjectListItem(
    item: Awaited<
      ReturnType<InvestorPortalRepository["findProjectList"]>
    >[number],
    snapshot: Awaited<
      ReturnType<InvestorPortalProjectService["buildProjectSnapshot"]>
    >,
  ) {
    const history = item.rabProject.actualAchievements.reduce(
      (total, achievement) => total + Number(achievement.actualRevenue),
      0,
    );
    const historyOpex = item.rabProject.actualAchievements.reduce(
      (total, achievement) => total + Number(achievement.actualOpex || 0),
      0,
    );
    const runningRevenue = this.getRunningRevenue(item, snapshot, new Date());

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
      totalActualRevenue: (history + runningRevenue).toString(),
      totalActualOpex: historyOpex.toString(),
      createdAt: item.rabProject.createdAt,
    };
  }

  private getRunningRevenue(
    item: Awaited<
      ReturnType<InvestorPortalRepository["findProjectList"]>
    >[number],
    snapshot: Awaited<
      ReturnType<InvestorPortalProjectService["buildProjectSnapshot"]>
    >,
    now: Date,
  ) {
    if (item.rabProject.siteId && !item.rabProject.mixRadiusInvestorSiteId) {
      return snapshot.internalCustomers
        .filter((customer) => customer.siteId === item.rabProject.siteId)
        .filter(
          (customer) =>
            customer.status === "AKTIF" && customer.jatuhTempo > now,
        )
        .reduce(
          (total, customer) => total + Number(customer.hargaPaket?.harga || 0),
          0,
        );
    }

    const investorSiteId = item.rabProject.mixRadiusInvestorSiteId;
    const owners = investorSiteId
      ? snapshot.investorSiteMap.get(investorSiteId)?.owners || []
      : [];
    return snapshot.mixRadiusCustomers
      .filter((customer) => matchesMixRadiusOwner(customer.owner_name, owners))
      .filter((customer) => isMixRadiusCustomerActive(customer, now))
      .reduce((total, customer) => total + Number(customer.total || 0), 0);
  }

  private async buildProjectBillingMetrics(
    project: NonNullable<
      Awaited<ReturnType<InvestorPortalRepository["findProjectDetail"]>>
    >,
    mixRadiusInvestorSite: Awaited<
      ReturnType<InvestorPortalRepository["findMixRadiusInvestorSiteById"]>
    >,
  ) {
    if (
      project.rabProject.siteId &&
      !project.rabProject.mixRadiusInvestorSiteId
    ) {
      return this.buildInternalBillingMetrics(project.rabProject.siteId);
    }

    if (!mixRadiusInvestorSite) {
      return this.createEmptyBillingMetrics();
    }

    return this.buildMixRadiusBillingMetrics(
      mixRadiusInvestorSite.owners || [],
    );
  }

  private async buildInternalBillingMetrics(siteId: string) {
    const now = new Date();
    const customers = await this.repository.findInternalCustomers([siteId]);
    const payingCustomers = customers.filter(
      (customer) => customer.status === "AKTIF" && customer.jatuhTempo > now,
    );
    const estimatedRevenue = payingCustomers.reduce(
      (total, customer) => total + Number(customer.hargaPaket?.harga || 0),
      0,
    );

    return {
      totalSubscribers: customers.length,
      activeSubscribers: customers.filter(
        (customer) => customer.status === "AKTIF",
      ).length,
      payingSubscribers: payingCustomers.length,
      estimatedRevenue,
    };
  }

  private async buildMixRadiusBillingMetrics(owners: string[]) {
    const customers = await this.fetchMixRadiusCustomers(owners);
    const matchingCustomers = customers.filter((customer) =>
      matchesMixRadiusOwner(customer.owner_name, owners),
    );
    const activeCustomers = matchingCustomers.filter((customer) =>
      isMixRadiusCustomerActive(customer, new Date()),
    );
    const estimatedRevenue = activeCustomers.reduce(
      (total, customer) => total + Number(customer.total || 0),
      0,
    );

    return {
      totalSubscribers: matchingCustomers.length,
      activeSubscribers: activeCustomers.length,
      payingSubscribers: activeCustomers.length,
      estimatedRevenue,
    };
  }

  private createEmptyBillingMetrics() {
    return {
      totalSubscribers: 0,
      activeSubscribers: 0,
      payingSubscribers: 0,
      estimatedRevenue: 0,
    };
  }

  private toProjectDetail(
    project: NonNullable<
      Awaited<ReturnType<InvestorPortalRepository["findProjectDetail"]>>
    >,
    mixRadiusInvestorSite: Awaited<
      ReturnType<InvestorPortalRepository["findMixRadiusInvestorSiteById"]>
    >,
    billingMetrics: Awaited<
      ReturnType<InvestorPortalProjectService["buildProjectBillingMetrics"]>
    >,
  ) {
    const rabProject = project.rabProject;
    return {
      id: rabProject.id,
      name: rabProject.name,
      description: rabProject.description,
      status: rabProject.status,
      siteName: rabProject.mixRadiusInvestorSiteId
        ? mixRadiusInvestorSite?.name
        : rabProject.site?.name,
      billingSource: this.getBillingSource(
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

  private getBillingSource(
    siteId: string | null,
    mixRadiusInvestorSiteId: string | null,
  ) {
    if (mixRadiusInvestorSiteId) {
      return MIXRADIUS_BILLING_SOURCE;
    }

    if (siteId) {
      return INTERNAL_BILLING_SOURCE;
    }

    return NONE_BILLING_SOURCE;
  }
}

let investorPortalProjectService: InvestorPortalProjectService | null = null;

export function getInvestorPortalProjectService() {
  if (!investorPortalProjectService) {
    investorPortalProjectService = new InvestorPortalProjectService();
  }

  return investorPortalProjectService;
}
