const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Awal hari kalender WIB (00:00 Asia/Jakarta) yang memuat `date`. */
export function startOfWibDay(date: Date): Date {
  const wibDay = Math.floor((date.getTime() + WIB_OFFSET_MS) / MS_PER_DAY);
  return new Date(wibDay * MS_PER_DAY - WIB_OFFSET_MS);
}
