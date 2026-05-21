export interface MonthlyTaxRecord {
  userId: string;
  year: number;
  month: number;
  grossIncome: number;
  taxPaid: number;
  biayaJabatan: number;
  bpjsEmployee: number;
}

export interface YtdTaxHistory {
  records: MonthlyTaxRecord[];
  totalGrossIncome: number;
  totalTaxPaid: number;
  totalBiayaJabatan: number;
  totalBpjsEmployee: number;
  monthsWorked: number;
}

export interface ITaxHistoryProvider {
  getYtdHistory(userId: string, year: number): YtdTaxHistory;
}

export class InMemoryTaxHistoryProvider implements ITaxHistoryProvider {
  constructor(private records: MonthlyTaxRecord[]) {}

  getYtdHistory(userId: string, year: number): YtdTaxHistory {
    const filtered = this.records.filter(
      (r) => r.userId === userId && r.year === year,
    );

    return {
      records: filtered,
      totalGrossIncome: filtered.reduce((sum, r) => sum + r.grossIncome, 0),
      totalTaxPaid: filtered.reduce((sum, r) => sum + r.taxPaid, 0),
      totalBiayaJabatan: filtered.reduce((sum, r) => sum + r.biayaJabatan, 0),
      totalBpjsEmployee: filtered.reduce((sum, r) => sum + r.bpjsEmployee, 0),
      monthsWorked: filtered.length,
    };
  }
}
