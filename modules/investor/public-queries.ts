/**
 * Entry publik SEMPIT module investor untuk module lain (finance,
 * notification) yang perlu membaca/merawat data milik investor.
 *
 * Sengaja terpisah dari `index.ts`: index memuat service yang meng-import
 * `@/modules/finance`, sehingga finance → investor/index akan membentuk
 * siklus import. File ini hanya bergantung pada repository investor yang
 * tidak meng-import module lain.
 */
import { InvestorProfitShareLookupRepository } from "./repositories/InvestorProfitShareLookupRepository";
import { InvestorRepository } from "./repositories/InvestorRepository";

const profitShareLookup = new InvestorProfitShareLookupRepository();
const investorRepository = new InvestorRepository();

/** Pemilik investor beserta token FCM-nya. */
export interface InvestorFcmTokenOwner {
  id: string;
  fcmTokens: string[];
}

/** Apakah bulan ke-n proyek RAB sudah masuk bagi hasil investor (selain yang dibatalkan). */
export function isRabProjectMonthShared(rabProjectId: string, month: number): Promise<boolean> {
  return profitShareLookup.isProjectMonthShared(rabProjectId, month);
}

/** Apakah proyek RAB sudah punya bagi hasil investor (selain yang dibatalkan). */
export function hasActiveInvestorProfitShare(rabProjectId: string): Promise<boolean> {
  return profitShareLookup.hasActiveProfitShare(rabProjectId);
}

/** Investor yang memegang salah satu token FCM yang diberikan. */
export function findInvestorFcmTokenOwners(tokens: string[]): Promise<InvestorFcmTokenOwner[]> {
  return investorRepository.findFcmTokenOwners(tokens);
}

/** Investor dengan token FCM yang tidak diperbarui sejak `cutoff`. */
export function findInvestorsWithStaleFcmTokens(cutoff: Date): Promise<InvestorFcmTokenOwner[]> {
  return investorRepository.findWithStaleFcmTokens(cutoff);
}

/** Mengganti seluruh daftar token FCM investor. */
export async function replaceInvestorFcmTokens(investorId: string, tokens: string[]): Promise<void> {
  await investorRepository.replaceFcmTokens(investorId, tokens);
}
