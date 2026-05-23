import type { ITaxConfigRepository } from "../domain/ports/ITaxConfigRepository";
import type { ITaxTransactionRepository } from "../domain/ports/ITaxTransactionRepository";
import type { TaxTransaction } from "../domain/entities/TaxTransaction";

const CORETAX_TX_KIND_KELUARAN = "01";
const CORETAX_TX_KIND_MASUKAN = "01";
const CORETAX_DOC_KODE_NORMAL = "010";
const CORETAX_OBJECT_NAME_DEFAULT = "Jasa Telekomunikasi";

const CSV_HEADER_FK = [
  "FK",
  "KD_JENIS_TRANSAKSI",
  "FG_PENGGANTI",
  "NOMOR_FAKTUR",
  "MASA_PAJAK",
  "TAHUN_PAJAK",
  "TANGGAL_FAKTUR",
  "NPWP",
  "NAMA",
  "ALAMAT_LENGKAP",
  "JUMLAH_DPP",
  "JUMLAH_PPN",
  "JUMLAH_PPNBM",
  "ID_KETERANGAN_TAMBAHAN",
  "FG_UANG_MUKA",
  "UANG_MUKA_DPP",
  "UANG_MUKA_PPN",
  "UANG_MUKA_PPNBM",
  "REFERENSI",
  "KODE_DOKUMEN_PENDUKUNG",
];

const CSV_HEADER_LT = [
  "LT",
  "NPWP",
  "NAMA",
  "JALAN",
  "BLOK",
  "NOMOR",
  "RT",
  "RW",
  "KECAMATAN",
  "KELURAHAN",
  "KABUPATEN",
  "PROPINSI",
  "KODE_POS",
  "NOMOR_TELEPON",
];

const CSV_HEADER_OF = [
  "OF",
  "KODE_OBJEK",
  "NAMA",
  "HARGA_SATUAN",
  "JUMLAH_BARANG",
  "HARGA_TOTAL",
  "DISKON",
  "DPP",
  "PPN",
  "TARIF_PPNBM",
  "PPNBM",
];

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes("\n") || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function csvLine(fields: string[]): string {
  return fields.map(escapeCsv).join(",");
}

function fmtAmount(value: number): string {
  return value.toFixed(0);
}

function fmtDate(date: Date): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

function sanitizeNpwp(npwp: string | null): string {
  if (!npwp) return "000000000000000";
  return npwp
    .replace(/[^0-9]/g, "")
    .padEnd(15, "0")
    .slice(0, 15);
}

interface CoretaxBuildOptions {
  /** "keluaran" untuk faktur keluaran, "masukan" untuk faktur masukan */
  direction: "keluaran" | "masukan";
  /** Nama lawan transaksi untuk fallback bila TaxTransaction tidak punya */
  defaultCounterpartName?: string;
  /** Nama tenant untuk faktur keluaran (NAMA di FK row) */
  tenantName?: string;
}

/**
 * Adapter export ke format Coretax DJP (efektif Jan 2025).
 *
 * Skema CSV: setiap faktur direpresentasikan oleh tiga baris:
 * - FK: header faktur (nomor, tanggal, NPWP penjual, total)
 * - LT: lawan transaksi (NPWP, nama, alamat)
 * - OF: object faktur (line item)
 *
 * Baris FK selalu diikuti oleh LT dan minimal satu OF.
 *
 * Limitations:
 * - Lawan transaksi (alamat) di-skip karena TaxTransaction tidak menyimpan
 *   alamat; baris LT akan minimal-fill (NPWP + nama).
 * - OF hanya satu baris per faktur dengan deskripsi default jika item detail
 *   tidak tersedia.
 *
 * Catatan:
 * - Faktur tanpa `fakturPajakNo` dilewati karena tidak valid untuk import DJP.
 *   Kasus ini dilaporkan via summary.
 */
export class CoretaxExportAdapter {
  constructor(
    private readonly txRepo: ITaxTransactionRepository,
    private readonly configRepo: ITaxConfigRepository,
  ) {}

  /**
   * Build CSV Coretax untuk satu periode (year, month).
   * Returns CSV string + warnings tentang faktur yang dilewati.
   */
  async buildPpnCsv(
    tenantId: string,
    year: number,
    month: number,
    options: CoretaxBuildOptions,
  ): Promise<{ csv: string; skipped: number; included: number }> {
    const config = await this.configRepo.findByTenantId(tenantId);
    if (!config?.isPkp) {
      throw new Error(
        "Tenant bukan PKP. Coretax export hanya untuk Wajib Pajak PKP.",
      );
    }

    const targetTaxType =
      options.direction === "keluaran" ? "PPN_KELUARAN" : "PPN_MASUKAN";

    const all = await this.txRepo.findByPeriod(tenantId, year, month);
    const eligible = all.filter((tx) => tx.taxType === targetTaxType);

    const lines: string[] = [];
    lines.push(csvLine(CSV_HEADER_FK));
    lines.push(csvLine(CSV_HEADER_LT));
    lines.push(csvLine(CSV_HEADER_OF));

    let included = 0;
    let skipped = 0;
    const sellerNpwp =
      options.direction === "keluaran" ? sanitizeNpwp(config.npwp) : null;
    const sellerName =
      options.direction === "keluaran"
        ? (options.tenantName ?? config.companyName ?? "")
        : "";

    for (const tx of eligible) {
      if (!tx.fakturPajakNo) {
        skipped++;
        continue;
      }

      const fakturDate = tx.fakturPajakDate ?? tx.createdAt;
      const dpp = tx.amount - tx.taxAmount;
      const counterpartNpwp = sanitizeNpwp(tx.counterpartNpwp);

      lines.push(
        csvLine([
          "FK",
          options.direction === "keluaran"
            ? CORETAX_TX_KIND_KELUARAN
            : CORETAX_TX_KIND_MASUKAN,
          "0",
          tx.fakturPajakNo,
          String(month),
          String(year),
          fmtDate(fakturDate),
          options.direction === "keluaran" ? sellerNpwp! : counterpartNpwp,
          options.direction === "keluaran"
            ? sellerName
            : (options.defaultCounterpartName ?? ""),
          "",
          fmtAmount(dpp),
          fmtAmount(tx.taxAmount),
          "0",
          "",
          "0",
          "0",
          "0",
          "0",
          tx.sourceRefType + "/" + tx.sourceRefId,
          CORETAX_DOC_KODE_NORMAL,
        ]),
      );

      lines.push(
        csvLine([
          "LT",
          options.direction === "keluaran"
            ? counterpartNpwp
            : (sellerNpwp ?? ""),
          options.direction === "keluaran"
            ? (options.defaultCounterpartName ?? "")
            : sellerName,
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
        ]),
      );

      lines.push(
        csvLine([
          "OF",
          "",
          CORETAX_OBJECT_NAME_DEFAULT,
          fmtAmount(dpp),
          "1",
          fmtAmount(dpp),
          "0",
          fmtAmount(dpp),
          fmtAmount(tx.taxAmount),
          "0",
          "0",
        ]),
      );

      included++;
    }

    return { csv: lines.join("\n"), included, skipped };
  }
}

/** Re-export tipe untuk konsumen */
export type { TaxTransaction };
