/**
 * Kalender WIB untuk laporan regulasi: kunci tanggal, rentang tahun, dan
 * hitungan hari kalender/hari kerja. Murni — hari libur diteruskan dari luar.
 */

const WIB_TIME_ZONE = "Asia/Jakarta";
const WIB_OFFSET = "+07:00";
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const SATURDAY = 6;
const SUNDAY = 0;

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: WIB_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Tanggal WIB sebagai kunci "YYYY-MM-DD". */
export function toWibDateKey(date: Date): string {
  return dateKeyFormatter.format(date);
}

/** Bulan WIB (1–12) dari sebuah waktu. */
export function wibMonth(date: Date): number {
  return Number(toWibDateKey(date).slice(5, 7));
}

/** Awal tahun WIB sampai awal tahun berikutnya: [from, to). */
export function wibYearRange(year: number): { from: Date; to: Date } {
  return {
    from: new Date(`${year}-01-01T00:00:00${WIB_OFFSET}`),
    to: new Date(`${year + 1}-01-01T00:00:00${WIB_OFFSET}`),
  };
}

/** Kunci tanggal → hari ke-n sejak epoch (untuk selisih hari tanpa jebakan zona waktu). */
function dayNumber(dateKey: string): number {
  return Math.round(Date.parse(`${dateKey}T00:00:00Z`) / MS_PER_DAY);
}

function weekdayOfDayNumber(day: number): number {
  return new Date(day * MS_PER_DAY).getUTCDay();
}

/** Selisih hari kalender WIB; hari yang sama = 0. */
export function countCalendarDays(start: Date, end: Date): number {
  return dayNumber(toWibDateKey(end)) - dayNumber(toWibDateKey(start));
}

/**
 * Hari kerja (Senin–Jumat, bukan libur) setelah tanggal mulai sampai dengan
 * tanggal selesai. Hari yang sama = 0; Kamis → Senin dengan Sabtu-Minggu = 2.
 */
export function countWorkingDays(
  start: Date,
  end: Date,
  holidayKeys: ReadonlySet<string>,
): number {
  const firstDay = dayNumber(toWibDateKey(start)) + 1;
  const lastDay = dayNumber(toWibDateKey(end));
  let workingDays = 0;

  for (let day = firstDay; day <= lastDay; day += 1) {
    const weekday = weekdayOfDayNumber(day);
    const dateKey = new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
    if (
      weekday !== SATURDAY &&
      weekday !== SUNDAY &&
      !holidayKeys.has(dateKey)
    ) {
      workingDays += 1;
    }
  }

  return workingDays;
}
