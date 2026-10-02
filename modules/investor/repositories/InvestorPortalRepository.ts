import { prisma } from "@/modules/database";
import { type Prisma, type RabStatus, type Status } from "@prisma/client";

import {
  hitungPorsiModal,
  persenBagiHasilInvestor,
  STATUS_PROYEK_TERLIHAT_INVESTOR,
} from "../domain/porsi-investor-proyek";

/** Modal semua investor proyek — dasar porsi bagi hasil tiap investor. */
const MODAL_SEMUA_INVESTOR = {
  investors: { select: { investmentAmount: true } },
} as const;

const PROJECT_SUMMARY_INCLUDE = {
  rabProject: {
    include: {
      actualAchievements: true,
      items: true,
      site: { select: { name: true } },
      ...MODAL_SEMUA_INVESTOR,
    },
  },
} satisfies Prisma.RabInvestorInclude;

const PROJECT_LIST_INCLUDE = {
  rabProject: {
    include: {
      actualAchievements: true,
      items: { select: { totalPrice: true, expenseType: true } },
      site: { select: { name: true } },
      ...MODAL_SEMUA_INVESTOR,
    },
  },
} satisfies Prisma.RabInvestorInclude;

/** Proyek yang belum disetujui, ditolak, atau dibatalkan tidak tampil ke investor. */
const PROYEK_TERLIHAT = {
  rabProject: {
    status: { in: [...STATUS_PROYEK_TERLIHAT_INVESTOR] as RabStatus[] },
  },
} satisfies Prisma.RabInvestorWhereInput;

type BarisModalInvestor = {
  investmentAmount: bigint;
  profitSharePercent: number;
  rabProject: { investors: { investmentAmount: bigint }[] };
};

/**
 * `profitSharePercent` tersimpan = bagian SEMUA investor proyek. Ganti dengan
 * bagian investor ini sesuai porsi modalnya.
 */
function denganPersenMilikInvestor<T extends BarisModalInvestor>(baris: T): T {
  const porsi = hitungPorsiModal(
    baris.investmentAmount,
    baris.rabProject.investors.map((investor) => investor.investmentAmount),
  );
  return {
    ...baris,
    profitSharePercent: persenBagiHasilInvestor(baris.profitSharePercent, porsi),
  };
}

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
    const baris = await prisma.rabInvestor.findMany({
      where: { investorId, ...tenantScopedInvestor(tenantId), ...PROYEK_TERLIHAT },
      include: PROJECT_SUMMARY_INCLUDE,
    });
    return baris.map(denganPersenMilikInvestor);
  }

  /** Mengambil daftar proyek investor untuk halaman list. */
  async findProjectList(investorId: string, tenantId?: string) {
    const baris = await prisma.rabInvestor.findMany({
      where: { investorId, ...tenantScopedInvestor(tenantId), ...PROYEK_TERLIHAT },
      include: PROJECT_LIST_INCLUDE,
      orderBy: { rabProject: { createdAt: "desc" } },
    });
    return baris.map(denganPersenMilikInvestor);
  }

  /** Mengambil detail proyek investor berdasarkan akses investor. */
  async findProjectDetail(
    projectId: string,
    investorId: string,
    tenantId?: string,
  ) {
    const baris = await prisma.rabInvestor.findFirst({
      where: {
        rabProjectId: projectId,
        investorId,
        ...tenantScopedInvestor(tenantId),
        ...PROYEK_TERLIHAT,
      },
      include: PROJECT_LIST_INCLUDE,
    });
    return baris ? denganPersenMilikInvestor(baris) : null;
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
