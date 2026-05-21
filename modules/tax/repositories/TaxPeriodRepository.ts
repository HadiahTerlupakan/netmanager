import { prisma } from "@/lib/prisma";
import type { TaxType } from "../domain/entities/TaxConfig";
import type {
  TaxPeriodSummary,
  TaxPayStatus,
} from "../domain/entities/TaxPeriod";
import type { ITaxPeriodRepository } from "../domain/ports/ITaxPeriodRepository";

/** Maps Prisma TaxPeriodSummary row to domain entity (Decimal → number) */
function toDomain(row: {
  id: string;
  tenantId: string;
  year: number;
  month: number;
  ppnKeluaran: unknown;
  ppnMasukan: unknown;
  ppnKurangBayar: unknown;
  pph21Total: unknown;
  pph23Total: unknown;
  pph4Total: unknown;
  bhpAccrual: unknown;
  usoAccrual: unknown;
  ppnStatus: string;
  pph21Status: string;
  pph23Status: string;
  pph4Status: string;
  bhpStatus: string;
  ppnPaidAt: Date | null;
  pph21PaidAt: Date | null;
  pph23PaidAt: Date | null;
  pph4PaidAt: Date | null;
  bhpPaidAt: Date | null;
  ppnPenalty: unknown;
  pph21Penalty: unknown;
  pph23Penalty: unknown;
  calculatedAt: Date | null;
  lockedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): TaxPeriodSummary {
  return {
    id: row.id,
    tenantId: row.tenantId,
    year: row.year,
    month: row.month,
    ppnKeluaran: Number(row.ppnKeluaran),
    ppnMasukan: Number(row.ppnMasukan),
    ppnKurangBayar: Number(row.ppnKurangBayar),
    pph21Total: Number(row.pph21Total),
    pph23Total: Number(row.pph23Total),
    pph4Total: Number(row.pph4Total),
    bhpAccrual: Number(row.bhpAccrual),
    usoAccrual: Number(row.usoAccrual),
    ppnStatus: row.ppnStatus as TaxPayStatus,
    pph21Status: row.pph21Status as TaxPayStatus,
    pph23Status: row.pph23Status as TaxPayStatus,
    pph4Status: row.pph4Status as TaxPayStatus,
    bhpStatus: row.bhpStatus as TaxPayStatus,
    ppnPaidAt: row.ppnPaidAt,
    pph21PaidAt: row.pph21PaidAt,
    pph23PaidAt: row.pph23PaidAt,
    pph4PaidAt: row.pph4PaidAt,
    bhpPaidAt: row.bhpPaidAt,
    ppnPenalty: Number(row.ppnPenalty),
    pph21Penalty: Number(row.pph21Penalty),
    pph23Penalty: Number(row.pph23Penalty),
    calculatedAt: row.calculatedAt,
    lockedAt: row.lockedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class TaxPeriodRepository implements ITaxPeriodRepository {
  async findByPeriod(
    tenantId: string,
    year: number,
    month: number,
  ): Promise<TaxPeriodSummary | null> {
    const row = await prisma.taxPeriodSummary.findUnique({
      where: { tenantId_year_month: { tenantId, year, month } },
    });
    return row ? toDomain(row) : null;
  }

  async upsert(
    tenantId: string,
    year: number,
    month: number,
    data: Partial<TaxPeriodSummary>,
  ): Promise<TaxPeriodSummary> {
    // Strip domain-only fields that don't map to Prisma columns
    const {
      id: _,
      tenantId: __,
      year: ___,
      month: ____,
      createdAt: _____,
      updatedAt: ______,
      ...updateData
    } = data;

    const row = await prisma.taxPeriodSummary.upsert({
      where: { tenantId_year_month: { tenantId, year, month } },
      create: { tenantId, year, month, ...updateData },
      update: updateData,
    });
    return toDomain(row);
  }

  async markPaid(
    tenantId: string,
    year: number,
    month: number,
    taxType: TaxType,
    paidAt: Date,
  ): Promise<void> {
    const updateData = this.buildMarkPaidData(taxType, paidAt);

    await prisma.taxPeriodSummary.update({
      where: { tenantId_year_month: { tenantId, year, month } },
      data: updateData,
    });
  }

  async lock(tenantId: string, year: number, month: number): Promise<void> {
    await prisma.taxPeriodSummary.update({
      where: { tenantId_year_month: { tenantId, year, month } },
      data: { lockedAt: new Date() },
    });
  }

  async listByYear(
    tenantId: string,
    year: number,
  ): Promise<TaxPeriodSummary[]> {
    const rows = await prisma.taxPeriodSummary.findMany({
      where: { tenantId, year },
      orderBy: { month: "asc" },
    });
    return rows.map(toDomain);
  }

  /** Build update payload for markPaid based on tax type */
  private buildMarkPaidData(
    taxType: TaxType,
    paidAt: Date,
  ): Record<string, unknown> {
    switch (taxType) {
      case "PPN_KELUARAN":
      case "PPN_MASUKAN":
        return { ppnStatus: "SUDAH_SETOR", ppnPaidAt: paidAt };
      case "PPH_21":
        return { pph21Status: "SUDAH_SETOR", pph21PaidAt: paidAt };
      case "PPH_23":
        return { pph23Status: "SUDAH_SETOR", pph23PaidAt: paidAt };
      case "PPH_4_2":
        return { pph4Status: "SUDAH_SETOR", pph4PaidAt: paidAt };
      case "BHP":
      case "USO":
        return { bhpStatus: "SUDAH_SETOR", bhpPaidAt: paidAt };
      default:
        return {};
    }
  }
}
