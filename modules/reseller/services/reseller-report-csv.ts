import type {
  ResellerMonthlyReport,
  ResellerReportFigures,
} from "../domain/entities/ResellerReportEntity";

const CSV_HEADERS = [
  "Outlet",
  "Kode outlet",
  "Pelanggan aktif",
  "Tagihan bruto (incl. PPN)",
  "Terbayar",
  "Komisi terbit",
  "Komisi disettle",
  "Komisi dibayar",
];
/** Awalan yang dibaca spreadsheet sebagai rumus (CSV injection). */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;
const TOTAL_LABEL = "TOTAL";

function escapeCsv(value: string): string {
  const safe = FORMULA_PREFIX.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function figureCells(figures: ResellerReportFigures): string[] {
  return [
    figures.activeCustomers,
    figures.grossBilled,
    figures.paid,
    figures.commissionAccrued,
    figures.commissionSettled,
    figures.commissionPaid,
  ].map(String);
}

/** CSV laporan bulanan reseller (satu baris per outlet + baris TOTAL). */
export function buildResellerReportCsv(report: ResellerMonthlyReport): string {
  const lines = [
    CSV_HEADERS,
    ...report.rows.map((row) => [
      row.outletName,
      row.outletCode ?? "",
      ...figureCells(row),
    ]),
    [TOTAL_LABEL, "", ...figureCells(report.totals)],
  ];
  return lines.map((cells) => cells.map(escapeCsv).join(",")).join("\n");
}

/** Nama berkas CSV laporan, mis. `laporan-reseller-RS01-2026-10.csv`. */
export function buildResellerReportFilename(
  report: ResellerMonthlyReport,
): string {
  const code = report.resellerCode.replace(/[^A-Za-z0-9_-]/g, "_");
  return `laporan-reseller-${code}-${report.period}.csv`;
}
