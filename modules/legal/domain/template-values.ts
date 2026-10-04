import type { TemplateValues } from "./template-content";

/**
 * Penyusunan nilai isian template dari data dokumen, perusahaan, dan pihak.
 * Murni — tanggal "hari ini" diteruskan dari luar supaya bisa diuji.
 */

export interface TemplateContact {
  name: string;
  address: string | null;
  phone: string | null;
}

export interface TemplateValueSource {
  title?: string | null;
  documentNumber?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  /** Nilai desimal sebagai teks, seperti yang disimpan dokumen legal. */
  value?: string | null;
  company: TemplateContact;
  party: TemplateContact | null;
  today: Date;
}

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Jakarta",
});

const rupiahFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Tanggal panjang Indonesia, mis. "4 Oktober 2026". */
export function formatLegalDate(date: Date | null | undefined): string | undefined {
  return date ? dateFormatter.format(date) : undefined;
}

/** Nominal rupiah, mis. "Rp 15.000.000"; kosong bila bukan angka. */
export function formatRupiah(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const amount = Number(value);
  return Number.isFinite(amount) ? rupiahFormatter.format(amount).replace(/\s/g, " ") : undefined;
}

/** Nilai seluruh isian yang tersedia; yang tidak diketahui dibiarkan kosong. */
export function buildTemplateValues(source: TemplateValueSource): TemplateValues {
  return {
    judul: source.title ?? undefined,
    nomor: source.documentNumber ?? undefined,
    tanggal: formatLegalDate(source.today),
    tanggal_mulai: formatLegalDate(source.startDate),
    tanggal_berakhir: formatLegalDate(source.endDate),
    nilai: formatRupiah(source.value),
    "perusahaan.nama": source.company.name,
    "perusahaan.alamat": source.company.address ?? undefined,
    "perusahaan.telepon": source.company.phone ?? undefined,
    "pihak.nama": source.party?.name,
    "pihak.alamat": source.party?.address ?? undefined,
    "pihak.telepon": source.party?.phone ?? undefined,
  };
}
