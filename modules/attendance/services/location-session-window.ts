/**
 * Toleransi jam HP terhadap jam server. Titik pertama sesudah check-in diambil
 * dari fix GPS yang didapat sebelum request check-in terkirim, sehingga
 * `recordedAt`-nya bisa beberapa menit lebih awal dari `checkIn` di server.
 */
export const LOCATION_CLOCK_SKEW_MS = 15 * 60 * 1000;

/** Rentang waktu satu sesi kerja tempat titik lokasi boleh diterima. */
export type LocationSessionWindow = { start: Date; end: Date };

/** Apakah `recordedAt` jatuh di salah satu sesi kerja, dengan toleransi jam HP. */
export function isWithinSessionWindows(
  recordedAt: Date,
  windows: LocationSessionWindow[],
): boolean {
  const time = recordedAt.getTime();
  return windows.some(
    (window) =>
      time >= window.start.getTime() - LOCATION_CLOCK_SKEW_MS &&
      time <= window.end.getTime() + LOCATION_CLOCK_SKEW_MS,
  );
}

/** Apakah titik lokasi terekam di sesi yang dimulai pada `checkIn`. */
export function isRecordedInSession(recordedAt: Date, checkIn: Date): boolean {
  return recordedAt.getTime() >= checkIn.getTime() - LOCATION_CLOCK_SKEW_MS;
}
