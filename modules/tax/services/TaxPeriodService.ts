import type { TaxType } from "../domain/entities/TaxConfig";
import type { TaxPeriodSummary } from "../domain/entities/TaxPeriod";
import type { TaxTransaction } from "../domain/entities/TaxTransaction";
import type { ITaxPeriodRepository } from "../domain/ports/ITaxPeriodRepository";
import type { ITaxTransactionRepository } from "../domain/ports/ITaxTransactionRepository";

/**
 * Manages tax period summaries — aggregation, payment marking, and locking.
 */
export class TaxPeriodService {
  constructor(
    private readonly periodRepo: ITaxPeriodRepository,
    private readonly txRepo: ITaxTransactionRepository,
  ) {}

  /** Recalculate period summary from TaxTransaction records */
  async recalculate(
    tenantId: string,
    year: number,
    month: number,
  ): Promise<TaxPeriodSummary> {
    const transactions = await this.txRepo.findByPeriod(tenantId, year, month);
    const aggregated = this.aggregateTransactions(transactions);

    return this.periodRepo.upsert(tenantId, year, month, {
      ...aggregated,
      calculatedAt: new Date(),
    });
  }

  /** Mark a specific tax type as paid */
  async markPaid(
    tenantId: string,
    year: number,
    month: number,
    taxType: TaxType,
  ): Promise<void> {
    await this.periodRepo.markPaid(tenantId, year, month, taxType, new Date());
  }

  /** Lock period (after SPT reported) */
  async lock(tenantId: string, year: number, month: number): Promise<void> {
    await this.periodRepo.lock(tenantId, year, month);
  }

  /** Get summary for display */
  async getSummary(
    tenantId: string,
    year: number,
    month: number,
  ): Promise<TaxPeriodSummary | null> {
    return this.periodRepo.findByPeriod(tenantId, year, month);
  }

  /** List all periods for a year */
  async listByYear(
    tenantId: string,
    year: number,
  ): Promise<TaxPeriodSummary[]> {
    return this.periodRepo.listByYear(tenantId, year);
  }

  /** Aggregate transactions by tax type into period summary fields */
  private aggregateTransactions(
    transactions: TaxTransaction[],
  ): Partial<TaxPeriodSummary> {
    let ppnKeluaran = 0;
    let ppnMasukan = 0;
    let pph21Total = 0;
    let pph23Total = 0;
    let pph4Total = 0;
    let bhpAccrual = 0;
    let usoAccrual = 0;

    for (const tx of transactions) {
      switch (tx.taxType) {
        case "PPN_KELUARAN":
          ppnKeluaran += tx.taxAmount;
          break;
        case "PPN_MASUKAN":
          ppnMasukan += tx.taxAmount;
          break;
        case "PPH_21":
          pph21Total += tx.taxAmount;
          break;
        case "PPH_23":
          pph23Total += tx.taxAmount;
          break;
        case "PPH_4_2":
          pph4Total += tx.taxAmount;
          break;
        case "BHP":
          bhpAccrual += tx.taxAmount;
          break;
        case "USO":
          usoAccrual += tx.taxAmount;
          break;
      }
    }

    return {
      ppnKeluaran,
      ppnMasukan,
      ppnKurangBayar: ppnKeluaran - ppnMasukan,
      pph21Total,
      pph23Total,
      pph4Total,
      bhpAccrual,
      usoAccrual,
    };
  }
}
