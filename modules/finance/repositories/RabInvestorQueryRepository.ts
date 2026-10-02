import { prisma } from "@/lib/prisma";
import type { Prisma, PrismaClient, RabStatus } from "@prisma/client";

/** Modal semua investor proyek — dasar porsi bagi hasil tiap investor. */
const MODAL_SEMUA_INVESTOR = {
  investors: { select: { investmentAmount: true } },
} as const;

const INVESTASI_RINGKAS_INCLUDE = {
  rabProject: {
    include: {
      actualAchievements: true,
      items: true,
      site: { select: { name: true } },
      ...MODAL_SEMUA_INVESTOR,
    },
  },
} satisfies Prisma.RabInvestorInclude;

const INVESTASI_DAFTAR_INCLUDE = {
  rabProject: {
    include: {
      actualAchievements: true,
      items: { select: { totalPrice: true, expenseType: true } },
      site: { select: { name: true } },
      ...MODAL_SEMUA_INVESTOR,
    },
  },
} satisfies Prisma.RabInvestorInclude;

const INVESTASI_DENGAN_SITE_INCLUDE = {
  rabProject: {
    include: {
      site: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.RabInvestorInclude;

/** Data proyek RAB lengkap untuk menghitung bagi hasil investor per proyek. */
const PROYEK_UNTUK_BAGI_HASIL_INCLUDE = {
  items: { select: { totalPrice: true, expenseType: true } },
  actualAchievements: true,
  investors: { select: { investorId: true, investmentAmount: true } },
} satisfies Prisma.RabProjectInclude;

export type RabProjectForProfitShare = Prisma.RabProjectGetPayload<{
  include: typeof PROYEK_UNTUK_BAGI_HASIL_INCLUDE;
}>;

/** Filter akses portal investor atas penyertaan modal di proyek RAB. */
export interface RabInvestmentFilter {
  investorId: string;
  /** Tenant milik investor; kosong = tanpa penyaring tenant. */
  tenantId?: string;
  /** Status proyek yang boleh tampil ke investor. */
  visibleStatuses: readonly RabStatus[];
}

function buildRabInvestmentWhere(filter: RabInvestmentFilter): Prisma.RabInvestorWhereInput {
  return {
    investorId: filter.investorId,
    ...(filter.tenantId ? { investor: { tenantId: filter.tenantId } } : {}),
    rabProject: { status: { in: [...filter.visibleStatuses] } },
  };
}

/**
 * Query baca-saja atas tabel RAB (milik finance) untuk kebutuhan module
 * investor: portal investor, detail investor admin, dan kalkulasi bagi hasil.
 */
export class RabInvestorQueryRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  /** Penyertaan modal investor untuk ringkasan dashboard portal. */
  async findInvestmentSummaries(filter: RabInvestmentFilter) {
    return this.client.rabInvestor.findMany({
      where: buildRabInvestmentWhere(filter),
      include: INVESTASI_RINGKAS_INCLUDE,
    });
  }

  /** Penyertaan modal investor untuk daftar proyek portal (terbaru lebih dulu). */
  async findInvestmentList(filter: RabInvestmentFilter) {
    return this.client.rabInvestor.findMany({
      where: buildRabInvestmentWhere(filter),
      include: INVESTASI_DAFTAR_INCLUDE,
      orderBy: { rabProject: { createdAt: "desc" } },
    });
  }

  /** Satu penyertaan modal investor pada proyek tertentu. */
  async findInvestmentDetail(rabProjectId: string, filter: RabInvestmentFilter) {
    return this.client.rabInvestor.findFirst({
      where: { rabProjectId, ...buildRabInvestmentWhere(filter) },
      include: INVESTASI_DAFTAR_INCLUDE,
    });
  }

  /** Semua penyertaan modal investor beserta proyek & site-nya (detail admin). */
  async findInvestmentsWithSite(investorId: string) {
    return this.client.rabInvestor.findMany({
      where: { investorId },
      include: INVESTASI_DENGAN_SITE_INCLUDE,
    });
  }

  /** Proyek RAB tenant berstatus tertentu yang punya investor, terlama lebih dulu. */
  async findProjectsForProfitShare(
    tenantId: string,
    statuses: readonly RabStatus[],
  ): Promise<RabProjectForProfitShare[]> {
    return this.client.rabProject.findMany({
      where: {
        tenantId,
        status: { in: [...statuses] },
        investors: { some: {} },
      },
      include: PROYEK_UNTUK_BAGI_HASIL_INCLUDE,
      orderBy: { createdAt: "asc" },
    });
  }
}
