import type { ITaxTransactionRepository } from "../domain/ports/ITaxTransactionRepository";
import type { ITaxPeriodRepository } from "../domain/ports/ITaxPeriodRepository";
import type { ITaxConfigRepository } from "../domain/ports/ITaxConfigRepository";
import type { TaxTransaction } from "../domain/entities/TaxTransaction";

const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

/** Formats a number to locale-friendly string (dot as thousands separator) */
function formatNumber(value: number): string {
  return value.toLocaleString("id-ID");
}

/** Formats a Date to dd/MM/yyyy */
function formatDate(date: Date): string {
  const d = date.getDate().toString().padStart(2, "0");
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

/** Escapes a CSV field value (wraps in quotes if contains comma/newline/quote) */
function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes("\n") || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Builds a CSV string from header row and data rows */
function buildCsv(headers: string[], rows: string[][]): string {
  const lines: string[] = [];
  lines.push(headers.map(escapeCsv).join(","));
  for (const row of rows) {
    lines.push(row.map(escapeCsv).join(","));
  }
  return lines.join("\n");
}

/**
 * Service untuk export data pajak ke format CSV.
 * Menyediakan export per jenis pajak dan ringkasan bulanan.
 */
export class TaxExportService {
  constructor(
    private readonly txRepo: ITaxTransactionRepository,
    private readonly periodRepo: ITaxPeriodRepository,
    private readonly configRepo: ITaxConfigRepository,
  ) {}

  /** Export rekap PPN bulanan ke CSV string */
  async exportPpnCsv(
    tenantId: string,
    year: number,
    month: number,
  ): Promise<string> {
    const transactions = await this.txRepo.findByPeriod(tenantId, year, month);
    const ppnTx = transactions.filter(
      (tx) => tx.taxType === "PPN_KELUARAN" || tx.taxType === "PPN_MASUKAN",
    );

    const headers = [
      "No",
      "Tanggal",
      "Tipe",
      "Referensi",
      "DPP",
      "PPN",
      "Tarif",
    ];
    const rows: string[][] = [];

    let totalKeluaran = 0;
    let totalMasukan = 0;

    for (let i = 0; i < ppnTx.length; i++) {
      const tx = ppnTx[i];
      const tipe = tx.taxType === "PPN_KELUARAN" ? "Keluaran" : "Masukan";

      if (tx.taxType === "PPN_KELUARAN") {
        totalKeluaran += tx.taxAmount;
      } else {
        totalMasukan += tx.taxAmount;
      }

      rows.push([
        String(i + 1),
        formatDate(tx.createdAt),
        tipe,
        this.buildReference(tx),
        formatNumber(tx.amount),
        formatNumber(tx.taxAmount),
        `${tx.rate}%`,
      ]);
    }

    // Footer rows
    rows.push([]);
    rows.push([
      "",
      "",
      "",
      "Total PPN Keluaran",
      "",
      formatNumber(totalKeluaran),
      "",
    ]);
    rows.push([
      "",
      "",
      "",
      "Total PPN Masukan",
      "",
      formatNumber(totalMasukan),
      "",
    ]);
    rows.push([
      "",
      "",
      "",
      "PPN Kurang Bayar",
      "",
      formatNumber(totalKeluaran - totalMasukan),
      "",
    ]);

    return buildCsv(headers, rows);
  }

  /** Export rekap PPh 21 bulanan ke CSV string */
  async exportPph21Csv(
    tenantId: string,
    year: number,
    month: number,
  ): Promise<string> {
    const transactions = await this.txRepo.findByPeriod(tenantId, year, month);
    const pph21Tx = transactions.filter((tx) => tx.taxType === "PPH_21");

    const headers = [
      "No",
      "Tanggal",
      "ID Gaji",
      "Penghasilan Bruto",
      "PPh 21",
      "Tarif Efektif",
    ];
    const rows: string[][] = [];

    for (let i = 0; i < pph21Tx.length; i++) {
      const tx = pph21Tx[i];
      rows.push([
        String(i + 1),
        formatDate(tx.createdAt),
        tx.sourceRefId,
        formatNumber(tx.amount),
        formatNumber(tx.taxAmount),
        `${tx.rate}%`,
      ]);
    }

    return buildCsv(headers, rows);
  }

  /** Export rekap BHP/USO tahunan ke CSV string */
  async exportBhpUsoCsv(tenantId: string, year: number): Promise<string> {
    const config = await this.configRepo.findByTenantId(tenantId);
    const bhpRate = config?.bhpRate ?? 0.5;
    const usoRate = config?.usoRate ?? 1.25;

    const headers = [
      "No",
      "Bulan",
      "Pendapatan Kotor",
      `BHP (${bhpRate}%)`,
      `USO (${usoRate}%)`,
      "Total",
    ];
    const rows: string[][] = [];

    let totalPendapatan = 0;
    let totalBhp = 0;
    let totalUso = 0;

    for (let m = 1; m <= 12; m++) {
      const transactions = await this.txRepo.findByPeriod(tenantId, year, m);
      const bhpTx = transactions.filter((tx) => tx.taxType === "BHP");
      const usoTx = transactions.filter((tx) => tx.taxType === "USO");

      const monthBhp = bhpTx.reduce((sum, tx) => sum + tx.taxAmount, 0);
      const monthUso = usoTx.reduce((sum, tx) => sum + tx.taxAmount, 0);
      // Pendapatan kotor = basis dari BHP (amount field)
      const monthPendapatan = bhpTx.reduce((sum, tx) => sum + tx.amount, 0);

      totalPendapatan += monthPendapatan;
      totalBhp += monthBhp;
      totalUso += monthUso;

      rows.push([
        String(m),
        MONTH_NAMES[m - 1],
        formatNumber(monthPendapatan),
        formatNumber(monthBhp),
        formatNumber(monthUso),
        formatNumber(monthBhp + monthUso),
      ]);
    }

    // Footer
    rows.push([]);
    rows.push([
      "",
      "TOTAL",
      formatNumber(totalPendapatan),
      formatNumber(totalBhp),
      formatNumber(totalUso),
      formatNumber(totalBhp + totalUso),
    ]);

    return buildCsv(headers, rows);
  }

  /** Export ringkasan semua pajak bulanan ke CSV */
  async exportMonthlySummaryCsv(
    tenantId: string,
    year: number,
    month: number,
  ): Promise<string> {
    const summary = await this.periodRepo.findByPeriod(tenantId, year, month);

    const headers = ["Jenis Pajak", "Jumlah", "Status", "Tanggal Setor"];

    if (!summary) {
      return buildCsv(headers, [["(Belum ada data periode ini)", "", "", ""]]);
    }

    const rows: string[][] = [
      [
        "PPN Keluaran",
        formatNumber(summary.ppnKeluaran),
        summary.ppnStatus,
        summary.ppnPaidAt ? formatDate(summary.ppnPaidAt) : "-",
      ],
      [
        "PPN Masukan",
        formatNumber(summary.ppnMasukan),
        summary.ppnStatus,
        summary.ppnPaidAt ? formatDate(summary.ppnPaidAt) : "-",
      ],
      [
        "PPN Kurang Bayar",
        formatNumber(summary.ppnKurangBayar),
        summary.ppnStatus,
        summary.ppnPaidAt ? formatDate(summary.ppnPaidAt) : "-",
      ],
      [
        "PPh 21",
        formatNumber(summary.pph21Total),
        summary.pph21Status,
        summary.pph21PaidAt ? formatDate(summary.pph21PaidAt) : "-",
      ],
      [
        "PPh 23",
        formatNumber(summary.pph23Total),
        summary.pph23Status,
        summary.pph23PaidAt ? formatDate(summary.pph23PaidAt) : "-",
      ],
      [
        "PPh 4(2)",
        formatNumber(summary.pph4Total),
        summary.pph4Status,
        summary.pph4PaidAt ? formatDate(summary.pph4PaidAt) : "-",
      ],
      [
        "BHP",
        formatNumber(summary.bhpAccrual),
        summary.bhpStatus,
        summary.bhpPaidAt ? formatDate(summary.bhpPaidAt) : "-",
      ],
      [
        "USO",
        formatNumber(summary.usoAccrual),
        summary.bhpStatus,
        summary.bhpPaidAt ? formatDate(summary.bhpPaidAt) : "-",
      ],
    ];

    return buildCsv(headers, rows);
  }

  /** Builds a human-readable reference string from a transaction */
  private buildReference(tx: TaxTransaction): string {
    return `${tx.sourceRefType}#${tx.sourceRefId}`;
  }
}
