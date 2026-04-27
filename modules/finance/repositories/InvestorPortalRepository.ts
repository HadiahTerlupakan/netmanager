import { prisma, prismaBilling } from "@/modules/database";
import { type Prisma, type Status } from "@prisma/client";

const PROJECT_SUMMARY_INCLUDE = {
  rabProject: {
    include: {
      actualAchievements: true,
      items: true,
      site: { select: { name: true } },
    },
  },
} satisfies Prisma.RabInvestorInclude;

const PROJECT_LIST_INCLUDE = {
  rabProject: {
    include: {
      actualAchievements: true,
      site: { select: { name: true } },
    },
  },
} satisfies Prisma.RabInvestorInclude;

const INTERNAL_CUSTOMER_SELECT = {
  siteId: true,
  status: true,
  idPelanggan: true,
  jatuhTempo: true,
  hargaPaket: { select: { harga: true } },
} satisfies Prisma.PelangganSelect;

export type InvestorPortalInternalCustomer = {
  siteId: string | null;
  status: Status;
  idPelanggan: string;
  jatuhTempo: Date;
  hargaPaket: { harga: Prisma.Decimal | number | bigint | string } | null;
};

export class InvestorPortalRepository {
  /** Mengambil proyek investor untuk halaman dashboard. */
  async findDashboardProjects(investorId: string) {
    return prisma.rabInvestor.findMany({
      where: { investorId },
      include: PROJECT_SUMMARY_INCLUDE,
    });
  }

  /** Mengambil daftar proyek investor untuk halaman list. */
  async findProjectList(investorId: string) {
    return prisma.rabInvestor.findMany({
      where: { investorId },
      include: PROJECT_LIST_INCLUDE,
      orderBy: { rabProject: { createdAt: "desc" } },
    });
  }

  /** Mengambil detail proyek investor berdasarkan akses investor. */
  async findProjectDetail(projectId: string, investorId: string) {
    return prisma.rabInvestor.findUnique({
      where: {
        rabProjectId_investorId: {
          rabProjectId: projectId,
          investorId,
        },
      },
      include: PROJECT_LIST_INCLUDE,
    });
  }

  /** Mengambil pelanggan internal berdasarkan site. */
  async findInternalCustomers(siteIds: string[]) {
    if (siteIds.length === 0) {
      return [] as InvestorPortalInternalCustomer[];
    }

    return prisma.pelanggan.findMany({
      where: { siteId: { in: siteIds } },
      select: INTERNAL_CUSTOMER_SELECT,
    });
  }

  /** Mengambil site investor MixRadius dari billing database. */
  async findMixRadiusInvestorSites(ids: string[]) {
    if (ids.length === 0) {
      return [];
    }

    return prismaBilling.mixRadiusInvestorSite.findMany({
      where: { id: { in: ids } },
    });
  }

  /** Mengambil satu site investor MixRadius dari billing database. */
  async findMixRadiusInvestorSiteById(id: string) {
    return prismaBilling.mixRadiusInvestorSite.findUnique({ where: { id } });
  }
}
