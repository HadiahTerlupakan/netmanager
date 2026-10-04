/** Format tampilan laporan Self-Assessment. */

export const MONTH_SHORT_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];
export const QUARTER_NAMES = ["Kuartal I", "Kuartal II", "Kuartal III", "Kuartal IV"];

/** Rasio sebagai persen Indonesia, mis. 0.9165 → "91,65%"; tanpa data → "–". */
export function formatRatio(ratio: number | null): string {
  if (ratio === null) return "–";
  return `${(ratio * 100).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

/** Tanggal & jam WIB singkat. */
export function formatDateTime(iso: string | null): string {
  if (!iso) return "–";
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
}

/** Kelas warna rasio terhadap target: hijau memenuhi, merah tidak, abu tanpa data. */
export function ratioTone(ratio: number | null, target: number): string {
  if (ratio === null) return "text-gray-400";
  return ratio >= target ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
}

/** Tahun yang bisa dipilih: tahun berjalan dan beberapa tahun sebelumnya. */
export function selectableYears(currentYear: number, count: number): number[] {
  return Array.from({ length: count }, (_, index) => currentYear - index);
}

export function dayUnitLabel(unit: "CALENDAR" | "WORKING"): string {
  return unit === "WORKING" ? "hari kerja" : "hari";
}

const DECEMBER = 12;

/**
 * Kalender libur dianggap belum lengkap bila libur terakhir yang tercatat
 * sebelum Desember — libur nasional terakhir tiap tahun (Natal) ada di Desember.
 */
export function isHolidayCalendarIncomplete(lastHolidayDate: string | null): boolean {
  if (!lastHolidayDate) return true;
  const month = Number(
    new Date(lastHolidayDate).toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }).slice(5, 7),
  );
  return month < DECEMBER;
}
