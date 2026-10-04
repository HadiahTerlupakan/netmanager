import ExcelJS from "exceljs";
import type {
  ParameterReport,
  SelfAssessmentReport,
  ServiceLevelSample,
} from "../domain/self-assessment-report";
import type { PeriodStatistic } from "../domain/service-level-aggregation";
import type { SampleOutcome } from "../domain/service-level-evaluation";

/**
 * Berkas Excel Self-Assessment Komdigi: "Lampiran I" (data sampel per
 * parameter dengan baris TOTAL & CAPAIAN), "Agregasi" (bulanan, kuartalan,
 * tahunan, dan per kabupaten/kota), serta "Catatan" (metode & parameter yang
 * belum tersedia).
 */

const SAMPLE_COLUMNS = 7;
const PERCENT_FORMAT = "0.00%";
const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
const SECTION_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};
const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const QUARTER_NAMES = ["Kuartal I", "Kuartal II", "Kuartal III", "Kuartal IV"];

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Jakarta",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/** "dd/mm/yyyy hh:mm:ss" WIB, format yang diminta Lampiran I. */
function formatKomdigiDateTime(date: Date | null): string {
  return date ? dateTimeFormatter.format(date).replace(",", "") : "";
}

function formatPercent(ratio: number | null): string {
  return ratio === null ? "-" : `${(ratio * 100).toFixed(2).replace(".", ",")}%`;
}

function verdictOf(report: ParameterReport): string {
  if (report.isTargetMet === null) return "BELUM ADA DATA";
  return report.isTargetMet ? "MEMENUHI STANDAR" : "TIDAK MEMENUHI STANDAR";
}

const OUTCOME_LABEL: Record<SampleOutcome, string> = {
  MET: "Ya",
  NOT_MET: "Tidak",
  PENDING: "Belum dinilai",
};

function sampleNote(sample: ServiceLevelSample, parameter: ParameterReport["parameter"]): string {
  const parts = [sample.siteName, sample.region];
  if (parameter.key === "PASANG_BARU" && sample.finishedAt) {
    parts.push(`Selesai ${formatKomdigiDateTime(sample.finishedAt)}`);
  }
  if (!sample.finishedAt) parts.push(sample.outcome === "PENDING" ? "Masih dikerjakan" : "Belum selesai, lewat batas");
  return parts.filter(Boolean).join(" · ");
}

function styleRow(row: ExcelJS.Row, options: { fill?: ExcelJS.Fill; isBold?: boolean; columns: number }): void {
  for (let column = 1; column <= options.columns; column += 1) {
    const cell = row.getCell(column);
    cell.border = THIN_BORDER;
    cell.alignment = { vertical: "middle", wrapText: true };
    if (options.fill) cell.fill = options.fill;
    if (options.isBold) cell.font = { bold: true };
  }
}

function addMergedRow(sheet: ExcelJS.Worksheet, text: string, columns: number, fill?: ExcelJS.Fill): ExcelJS.Row {
  const row = sheet.addRow([text]);
  sheet.mergeCells(row.number, 1, row.number, columns);
  row.getCell(1).font = { bold: true };
  row.getCell(1).alignment = { wrapText: true, vertical: "middle" };
  if (fill) row.getCell(1).fill = fill;
  return row;
}

/** Bagian satu parameter di Lampiran I. */
function addSampleSection(sheet: ExcelJS.Worksheet, report: ParameterReport): void {
  const { parameter } = report;
  addMergedRow(
    sheet,
    `${parameter.number}. ${parameter.title} | Tolok ukur: ${parameter.standardLabel} | Dasar: ${parameter.basis}`,
    SAMPLE_COLUMNS,
    SECTION_FILL,
  );

  const header = sheet.addRow([
    "No",
    parameter.columns.reference,
    parameter.columns.firstTime.header,
    parameter.columns.secondTime.header,
    parameter.columns.duration,
    parameter.columns.isMet,
    parameter.columns.note,
  ]);
  styleRow(header, { fill: HEADER_FILL, isBold: true, columns: SAMPLE_COLUMNS });

  report.samples.forEach((sample, index) => {
    const row = sheet.addRow([
      index + 1,
      sample.reference,
      formatKomdigiDateTime(sample[parameter.columns.firstTime.field]),
      formatKomdigiDateTime(sample[parameter.columns.secondTime.field]),
      sample.durationDays,
      OUTCOME_LABEL[sample.outcome],
      sampleNote(sample, parameter),
    ]);
    styleRow(row, { columns: SAMPLE_COLUMNS });
  });

  const { annual } = report;
  const total = sheet.addRow([
    "TOTAL",
    `Jumlah permohonan dinilai: ${annual.received}`,
    report.pendingCount ? `Belum dinilai (masih dalam batas): ${report.pendingCount}` : "",
    "",
    "Memenuhi standar:",
    annual.met,
    "",
  ]);
  styleRow(total, { isBold: true, columns: SAMPLE_COLUMNS });

  const capaian = sheet.addRow([
    "CAPAIAN",
    `${parameter.title.replace("Standar ", "")} = (${annual.met} ÷ ${annual.received}) × 100% = ${formatPercent(annual.ratio)} → ${verdictOf(report)} (${parameter.standardLabel})`,
    "",
    "",
    "",
    annual.ratio ?? "-",
    "",
  ]);
  sheet.mergeCells(capaian.number, 2, capaian.number, 5);
  styleRow(capaian, { isBold: true, columns: SAMPLE_COLUMNS });
  if (annual.ratio !== null) capaian.getCell(6).numFmt = PERCENT_FORMAT;
  sheet.addRow([]);
}

function addStatisticRow(sheet: ExcelJS.Worksheet, label: string, statistic: PeriodStatistic, isBold = false): void {
  const row = sheet.addRow([label, statistic.received, statistic.met, statistic.ratio ?? "-"]);
  styleRow(row, { columns: 4, isBold });
  if (statistic.ratio !== null) row.getCell(4).numFmt = PERCENT_FORMAT;
}

/** Bagian satu parameter di sheet Agregasi. */
function addAggregationSection(sheet: ExcelJS.Worksheet, report: ParameterReport): void {
  const columns = 4;
  addMergedRow(sheet, `${report.parameter.number}. ${report.parameter.title}`, columns, SECTION_FILL);

  const header = sheet.addRow(["Periode", "Diterima (N)", "Memenuhi standar", "Statistik (S)"]);
  styleRow(header, { fill: HEADER_FILL, isBold: true, columns });
  report.months.forEach((month) => addStatisticRow(sheet, MONTH_NAMES[month.month - 1], month));
  report.quarters.forEach((quarter) => addStatisticRow(sheet, QUARTER_NAMES[quarter.quarter - 1], quarter, true));
  addStatisticRow(sheet, "Capaian 1 (Satu) Tahun", report.annual, true);
  addMergedRow(
    sheet,
    `KESIMPULAN: Capaian 1 Tahun = ${formatPercent(report.annual.ratio)} → ${verdictOf(report)} — nilai ini yang dipindahkan ke 'Berdasarkan Self Assessment' pada dokumen Word.`,
    columns,
  );
  sheet.addRow([]);

  const regionHeader = sheet.addRow(["Kabupaten/Kota", "Diterima (N)", "Memenuhi standar", "Statistik (S)"]);
  styleRow(regionHeader, { fill: HEADER_FILL, isBold: true, columns });
  report.regions.forEach((region) => addStatisticRow(sheet, region.region, region));
  sheet.addRow([]);
}

function addNotesSheet(workbook: ExcelJS.Workbook, report: SelfAssessmentReport): void {
  const sheet = workbook.addWorksheet("Catatan");
  sheet.columns = [{ width: 110 }];
  addMergedRow(sheet, `Self-Assessment Komdigi ${report.year} — Catatan metode`, 1, SECTION_FILL);
  report.notes.forEach((note) => sheet.addRow([`• ${note}`]));
  if (report.warnings.sitesWithoutRegion.length) {
    sheet.addRow([`• Site tanpa kabupaten/kota: ${report.warnings.sitesWithoutRegion.join(", ")}`]);
  }
  sheet.addRow([]);
  addMergedRow(sheet, "Parameter yang belum tersedia di sistem", 1, SECTION_FILL);
  report.unavailable.forEach((item) =>
    sheet.addRow([`• ${item.title} (${item.standardLabel}) — ${item.reason}`]),
  );
  sheet.eachRow((row) => {
    row.getCell(1).alignment = { wrapText: true, vertical: "top" };
  });
}

/** Susun berkas Excel laporan; dikembalikan sebagai Buffer siap diunduh. */
export async function buildSelfAssessmentWorkbook(report: SelfAssessmentReport): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.created = report.generatedAt;

  const samples = workbook.addWorksheet("Lampiran I");
  samples.columns = [
    { width: 7 }, { width: 26 }, { width: 24 }, { width: 24 }, { width: 18 }, { width: 18 }, { width: 48 },
  ];
  addMergedRow(samples, `Lampiran I — Metode Pengukuran (Data Sampel) Tahun ${report.year}`, SAMPLE_COLUMNS);
  addMergedRow(samples, "B. NON NETWORK RELATED", SAMPLE_COLUMNS);
  report.parameters.forEach((parameter) => addSampleSection(samples, parameter));

  const aggregation = workbook.addWorksheet("Agregasi");
  aggregation.columns = [{ width: 34 }, { width: 16 }, { width: 18 }, { width: 16 }];
  addMergedRow(
    aggregation,
    `Agregasi Statistik ${report.year} — S = Σ(Ni × Si) / Σ(Ni), bukan rata-rata sederhana`,
    4,
  );
  report.parameters.forEach((parameter) => addAggregationSection(aggregation, parameter));

  addNotesSheet(workbook, report);

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
