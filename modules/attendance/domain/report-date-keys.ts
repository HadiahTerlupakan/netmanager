const DAY_MS = 24 * 60 * 60 * 1000;

/** Tanggal lokal (YYYY-MM-DD) sebuah waktu pada zona waktu tenant. */
export function getDateKeyInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Daftar tanggal (YYYY-MM-DD) dari `fromKey` sampai `toKey`, dipotong ke
 * rentang laporan `rangeStartKey`–`rangeEndKey`. Dihitung di atas key tanggal
 * (UTC murni), jadi tidak bergeser oleh zona waktu server.
 */
export function listDateKeysInRange(
  fromKey: string,
  toKey: string,
  rangeStartKey: string,
  rangeEndKey: string,
): string[] {
  const startKey = fromKey > rangeStartKey ? fromKey : rangeStartKey;
  const endKey = toKey < rangeEndKey ? toKey : rangeEndKey;
  const dateKeys: string[] = [];
  for (
    let time = Date.parse(`${startKey}T00:00:00Z`);
    time <= Date.parse(`${endKey}T00:00:00Z`);
    time += DAY_MS
  ) {
    dateKeys.push(new Date(time).toISOString().slice(0, 10));
  }
  return dateKeys;
}

/** Periode izin yang dihitung harinya per pegawai. */
export type LeavePeriod = { userId: string; startDate: Date; endDate: Date };

/**
 * Jumlah hari izin per pegawai di dalam rentang laporan (hari kalender,
 * tanggal lokal tenant). Hari yang tertutup dua pengajuan dihitung sekali.
 */
export function countLeaveDaysByUser(
  periods: LeavePeriod[],
  range: { startDate: Date; endDate: Date; timezone: string },
): Map<string, number> {
  const rangeStartKey = getDateKeyInTimezone(range.startDate, range.timezone);
  const rangeEndKey = getDateKeyInTimezone(range.endDate, range.timezone);
  const dateKeysByUser = new Map<string, Set<string>>();
  for (const period of periods) {
    const dateKeys = dateKeysByUser.get(period.userId) ?? new Set<string>();
    listDateKeysInRange(
      getDateKeyInTimezone(period.startDate, range.timezone),
      getDateKeyInTimezone(period.endDate, range.timezone),
      rangeStartKey,
      rangeEndKey,
    ).forEach((dateKey) => dateKeys.add(dateKey));
    dateKeysByUser.set(period.userId, dateKeys);
  }
  return new Map(
    [...dateKeysByUser].map(([userId, dateKeys]) => [userId, dateKeys.size]),
  );
}
