/**
 * Entry publik SEMPIT module proyek untuk module lain (dipakai module investor)
 * yang perlu membaca data penyertaan modal di proyek RAB.
 *
 * Sengaja terpisah dari `index.ts`: index proyek memuat banyak service
 * (termasuk yang memakai `@/modules/investor/public-queries`), sehingga
 * investor → proyek/index rawan siklus import dan memuat terlalu banyak.
 * File ini hanya bergantung pada satu repository baca-saja tanpa import
 * module lain.
 */
import type { RabStatus } from "@prisma/client";

import {
  RabInvestorQueryRepository,
  type RabInvestmentFilter,
  type RabProjectForProfitShare,
} from "./repositories/RabInvestorQueryRepository";

export type { RabInvestmentFilter, RabProjectForProfitShare };

const rabInvestorQueries = new RabInvestorQueryRepository();

/** Penyertaan modal investor di proyek RAB untuk ringkasan dashboard portal. */
export function findRabInvestmentSummaries(filter: RabInvestmentFilter) {
  return rabInvestorQueries.findInvestmentSummaries(filter);
}

/** Penyertaan modal investor di proyek RAB untuk daftar proyek portal. */
export function findRabInvestmentList(filter: RabInvestmentFilter) {
  return rabInvestorQueries.findInvestmentList(filter);
}

/** Satu penyertaan modal investor di proyek RAB tertentu (null bila tak berhak). */
export function findRabInvestmentDetail(
  rabProjectId: string,
  filter: RabInvestmentFilter,
) {
  return rabInvestorQueries.findInvestmentDetail(rabProjectId, filter);
}

/** Semua penyertaan modal investor beserta proyek & site-nya. */
export function findRabInvestmentsWithSite(investorId: string) {
  return rabInvestorQueries.findInvestmentsWithSite(investorId);
}

/** Proyek RAB tenant berstatus tertentu yang punya investor, untuk kalkulasi bagi hasil. */
export function findRabProjectsForProfitShare(
  tenantId: string,
  statuses: readonly RabStatus[],
): Promise<RabProjectForProfitShare[]> {
  return rabInvestorQueries.findProjectsForProfitShare(tenantId, statuses);
}
