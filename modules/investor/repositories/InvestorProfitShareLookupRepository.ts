import { prisma } from "@/lib/prisma";

/** Bagi hasil yang masih berlaku: semua status kecuali dibatalkan. */
const BAGI_HASIL_BERLAKU = { status: { not: "CANCELLED" } } as const;

/**
 * Query baca-saja atas tabel bagi hasil investor untuk module lain (mis.
 * finance mengunci RAB yang sudah dibagikan). Sengaja tidak bergantung pada
 * module lain agar aman di-import lewat `public-queries` tanpa siklus.
 */
export class InvestorProfitShareLookupRepository {
  /** Apakah bulan ke-n proyek sudah masuk bagi hasil investor yang berlaku. */
  async isProjectMonthShared(rabProjectId: string, month: number): Promise<boolean> {
    const bagiHasil = await prisma.investorProfitShare.findFirst({
      where: { rabProjectId, projectMonths: { has: month }, ...BAGI_HASIL_BERLAKU },
      select: { id: true },
    });
    return Boolean(bagiHasil);
  }

  /** Apakah proyek sudah punya bagi hasil investor yang berlaku. */
  async hasActiveProfitShare(rabProjectId: string): Promise<boolean> {
    const bagiHasil = await prisma.investorProfitShare.findFirst({
      where: { rabProjectId, ...BAGI_HASIL_BERLAKU },
      select: { id: true },
    });
    return Boolean(bagiHasil);
  }
}
