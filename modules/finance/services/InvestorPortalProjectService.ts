import { InvestorPortalRepository } from "../repositories/InvestorPortalRepository";
import { createRouteServiceError } from "./RouteServiceError";
import {
  buildProjectBillingMetrics,
  buildProjectSnapshot,
  toProjectDetail,
  toProjectListItem,
} from "./investor-portal-project.helpers";

export class InvestorPortalProjectService {
  constructor(private readonly repository = new InvestorPortalRepository()) {}

  /** Mengambil daftar proyek investor beserta ringkasan actual revenue. */
  async getProjects(investorId: string) {
    const projects = await this.repository.findProjectList(investorId);
    const snapshot = await buildProjectSnapshot(this.repository, projects);

    return projects.map((item) => toProjectListItem(item, snapshot));
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
    const billingMetrics = await buildProjectBillingMetrics(
      this.repository,
      project,
      mixRadiusInvestorSite,
    );

    return toProjectDetail(project, mixRadiusInvestorSite, billingMetrics);
  }
}

let investorPortalProjectService: InvestorPortalProjectService | null = null;

export function getInvestorPortalProjectService(): InvestorPortalProjectService {
  if (!investorPortalProjectService) {
    investorPortalProjectService = new InvestorPortalProjectService();
  }

  return investorPortalProjectService;
}
