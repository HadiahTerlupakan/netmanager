import { prisma } from "@/modules/database";
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

function tenantScopedInvestor(tenantId?: string) {
  return tenantId ? { investor: { tenantId } } : {};
}

export class InvestorPortalRepository {
  /** Mengambil proyek investor untuk halaman dashboard. */
  async findDashboardProjects(investorId: string, tenantId?: string) {
    return prisma.rabInvestor.findMany({
      where: { investorId, ...tenantScopedInvestor(tenantId) },
      include: PROJECT_SUMMARY_INCLUDE,
    });
  }

  /** Mengambil daftar proyek investor untuk halaman list. */
  async findProjectList(investorId: string, tenantId?: string) {
    return prisma.rabInvestor.findMany({
      where: { investorId, ...tenantScopedInvestor(tenantId) },
      include: PROJECT_LIST_INCLUDE,
      orderBy: { rabProject: { createdAt: "desc" } },
    });
  }

  /** Mengambil detail proyek investor berdasarkan akses investor. */
  async findProjectDetail(
    projectId: string,
    investorId: string,
    tenantId?: string,
  ) {
    return prisma.rabInvestor.findFirst({
      where: {
        rabProjectId: projectId,
        investorId,
        ...tenantScopedInvestor(tenantId),
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
}
