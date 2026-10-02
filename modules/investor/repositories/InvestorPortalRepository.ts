import { prisma } from "@/modules/database";
import {
  findRabInvestmentDetail,
  findRabInvestmentList,
  findRabInvestmentSummaries,
  type RabInvestmentFilter,
} from "@/modules/finance/public-queries";
import { type Prisma, type RabStatus, type Status } from "@prisma/client";

import { STATUS_PROYEK_TERLIHAT_INVESTOR } from "../domain/porsi-investor-proyek";

/** Proyek yang belum disetujui, ditolak, atau dibatalkan tidak tampil ke investor. */
const STATUS_PROYEK_TERLIHAT = [...STATUS_PROYEK_TERLIHAT_INVESTOR] as RabStatus[];

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

function filterInvestasi(investorId: string, tenantId?: string): RabInvestmentFilter {
  return { investorId, tenantId, visibleStatuses: STATUS_PROYEK_TERLIHAT };
}

/**
 * Data portal investor. Proyek RAB milik module finance, jadi dibaca lewat
 * `@/modules/finance/public-queries` — bukan query tabel RAB langsung.
 */
export class InvestorPortalRepository {
  /** Mengambil proyek investor untuk halaman dashboard. */
  async findDashboardProjects(investorId: string, tenantId?: string) {
    return findRabInvestmentSummaries(filterInvestasi(investorId, tenantId));
  }

  /** Mengambil daftar proyek investor untuk halaman list. */
  async findProjectList(investorId: string, tenantId?: string) {
    return findRabInvestmentList(filterInvestasi(investorId, tenantId));
  }

  /** Mengambil detail proyek investor berdasarkan akses investor. */
  async findProjectDetail(
    projectId: string,
    investorId: string,
    tenantId?: string,
  ) {
    return findRabInvestmentDetail(projectId, filterInvestasi(investorId, tenantId));
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
