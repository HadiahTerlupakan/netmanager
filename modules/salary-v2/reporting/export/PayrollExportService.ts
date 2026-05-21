export interface ExportRow {
  employeeName: string;
  employeeId: string;
  department: string;
  basicSalary: number;
  totalEarnings: number;
  totalDeductions: number;
  totalTax: number;
  netSalary: number;
  employerCost: number;
}

export interface PayrollExportData {
  periodLabel: string;
  generatedAt: Date;
  rows: ExportRow[];
  totals: {
    totalBasicSalary: number;
    totalEarnings: number;
    totalDeductions: number;
    totalTax: number;
    totalNetSalary: number;
    totalEmployerCost: number;
    employeeCount: number;
  };
}

/**
 * Formats payroll data for export (CSV/summary).
 * Aggregates per-employee data and computes run-level totals.
 */
export class PayrollExportService {
  generateSummary(params: {
    periodLabel: string;
    entries: Array<{
      employeeName: string;
      employeeId: string;
      department: string;
      basicSalary: number;
      totalEarnings: number;
      totalDeductions: number;
      totalTax: number;
      netSalary: number;
      employerCost: number;
    }>;
  }): PayrollExportData {
    const { periodLabel, entries } = params;

    const rows: ExportRow[] = entries.map((e) => ({
      employeeName: e.employeeName,
      employeeId: e.employeeId,
      department: e.department,
      basicSalary: e.basicSalary,
      totalEarnings: e.totalEarnings,
      totalDeductions: e.totalDeductions,
      totalTax: e.totalTax,
      netSalary: e.netSalary,
      employerCost: e.employerCost,
    }));

    const totals = {
      totalBasicSalary: rows.reduce((sum, r) => sum + r.basicSalary, 0),
      totalEarnings: rows.reduce((sum, r) => sum + r.totalEarnings, 0),
      totalDeductions: rows.reduce((sum, r) => sum + r.totalDeductions, 0),
      totalTax: rows.reduce((sum, r) => sum + r.totalTax, 0),
      totalNetSalary: rows.reduce((sum, r) => sum + r.netSalary, 0),
      totalEmployerCost: rows.reduce((sum, r) => sum + r.employerCost, 0),
      employeeCount: rows.length,
    };

    return { periodLabel, generatedAt: new Date(), rows, totals };
  }

  toCsvRows(data: PayrollExportData): string[] {
    const header =
      "Nama,ID,Department,Gaji Pokok,Total Pendapatan,Total Potongan,Pajak,Gaji Bersih,Biaya Perusahaan";
    const rows = data.rows.map(
      (r) =>
        `${r.employeeName},${r.employeeId},${r.department},${r.basicSalary},${r.totalEarnings},${r.totalDeductions},${r.totalTax},${r.netSalary},${r.employerCost}`,
    );
    return [header, ...rows];
  }
}
