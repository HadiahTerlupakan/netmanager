import type { ApiEnvelope } from "./legal-types";

/**
 * Label dan pemformat murni untuk halaman legal — tanpa React agar mudah diuji.
 */

/** Panjang minimal nama kategori (sejalan dengan validasi server). */
export const MIN_CATEGORY_NAME_LENGTH = 2;

/** Tenggat dalam rentang ini (atau sudah lewat) ditandai mendesak. */
export const URGENT_DAYS_THRESHOLD = 7;

export const DOCUMENT_TYPE_LABEL: Record<string, string> = {
  KONTRAK: "Kontrak",
  IZIN: "Izin",
  SEWA_LAHAN: "Sewa lahan",
  KORPORAT: "Korporat",
};

export const STATUS_LABEL: Record<string, string> = {
  AKTIF: "Aktif",
  SEGERA_BERAKHIR: "Segera berakhir",
  KEDALUWARSA: "Kedaluwarsa",
  DIPERPANJANG: "Diperpanjang",
  DIAKHIRI: "Diakhiri",
};

export const DEADLINE_KIND_LABEL: Record<string, string> = {
  END: "Berakhir",
  NOTICE: "Pemberitahuan",
  GUARANTEE: "Jaminan",
  OBLIGATION: "Kewajiban",
};

export const PAYMENT_SCHEME_LABEL: Record<string, string> = {
  SEKALI: "Sekali bayar",
  BULANAN: "Bulanan",
  TAHUNAN: "Tahunan",
};

export const RECURRENCE_LABEL: Record<string, string> = {
  NONE: "Tidak berulang",
  MONTHLY: "Bulanan",
  YEARLY: "Tahunan",
};

/** Status yang tidak bisa diubah, diperpanjang, atau diakhiri lagi. */
export const CLOSED_STATUSES = ["DIPERPANJANG", "DIAKHIRI"];

/** Label tampilan dari peta label; nilai mentah bila tidak dikenal. */
export function labelOf(labels: Record<string, string>, value: string): string {
  return labels[value] ?? value;
}

/** Tanggal pendek gaya Indonesia, mis. "4 Okt 2026"; "—" bila kosong. */
export function formatDate(value: string | null): string {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Kalimat waktu relatif: "hari ini", "dalam 12 hari", "lewat 3 hari". */
export function describeTiming(daysLeft: number): string {
  if (daysLeft === 0) return "hari ini";
  if (daysLeft > 0) return `dalam ${daysLeft} hari`;

  return `lewat ${Math.abs(daysLeft)} hari`;
}

/** Tenggat yang sudah lewat atau tinggal paling lama seminggu. */
export function isUrgent(daysLeft: number): boolean {
  return daysLeft <= URGENT_DAYS_THRESHOLD;
}

/** Nilai uang dari string desimal server, mis. "1500000.00" → "Rp 1.500.000". */
export function formatMoney(value: string, currency: string): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

/** Tanggal ISO menjadi nilai `<input type="date">` (yyyy-mm-dd). */
export function toDateInput(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}

/** Pesan galat API untuk toast, disertai detail validasi pertama bila ada. */
export function describeApiError(
  body: ApiEnvelope<unknown>,
  fallback: string,
): string {
  const message = body.error || fallback;
  const [firstDetail] = Object.values(body.details ?? {});

  return firstDetail ? `${message}: ${firstDetail}` : message;
}
