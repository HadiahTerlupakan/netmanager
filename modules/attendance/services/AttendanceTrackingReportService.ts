import { LocationTrackingRepository } from "../repositories/LocationTrackingRepository";
import { sumTrackingOffMs } from "./tracking-gap";

/**
 * Sesi sebelum aplikasi mengirim heartbeat saat diam tidak dinilai: HP yang
 * diam di versi lama memang tidak mengirim apa-apa, jadi jedanya bukan
 * kesalahan karyawan. Heartbeat terbit lewat OTA 2026-10-18.
 */
const TRACKING_REPORT_SINCE = new Date("2026-10-18T17:00:00.000Z");

/** Sesi tanpa check-out dinilai paling lama sepanjang sesi fleksibel. */
const MAX_OPEN_SESSION_MS = 24 * 60 * 60 * 1000;

const NOT_WORKING_STATUSES = new Set([
  "ALPHA",
  "ABSENT",
  "DAY_OFF",
  "PERMIT",
  "SICK",
]);

const MINUTE_MS = 60 * 1000;

interface TrackedRow {
  id: string;
  userId: string;
  checkIn: Date;
  checkOut: Date | null;
  status: string;
  correctedAt?: Date | null;
}

type LocationTimesRepository = Pick<
  LocationTrackingRepository,
  "findRecordedAtForUser"
>;

/** Total menit tracking mati per sesi untuk laporan absensi admin. */
export class AttendanceTrackingReportService {
  constructor(
    private readonly locationRepo: LocationTimesRepository = new LocationTrackingRepository(),
  ) {}

  /** Menit per id absensi; null untuk baris yang bukan sesi kerja dinilai. */
  async trackingOffMinutes(
    rows: TrackedRow[],
  ): Promise<Map<string, number | null>> {
    const now = new Date();
    const result = new Map<string, number | null>(
      rows.map((row): [string, number | null] => [row.id, null]),
    );
    const judged = rows
      .filter(isJudgedSession)
      .map((row) => ({ row, end: sessionEnd(row, now) }));

    // Per karyawan, sebatas rentang sesinya sendiri: ekspor sebulan untuk
    // satu tenant tidak menarik seluruh titik semua orang sekaligus.
    for (const sessions of groupByUser(judged).values()) {
      const points = await this.locationRepo.findRecordedAtForUser({
        userId: sessions[0]!.row.userId,
        from: new Date(
          Math.min(...sessions.map(({ row }) => row.checkIn.getTime())),
        ),
        to: new Date(Math.max(...sessions.map(({ end }) => end.getTime()))),
      });
      for (const { row, end } of sessions) {
        const offMs = sumTrackingOffMs({ start: row.checkIn, end, points });
        result.set(row.id, Math.round(offMs / MINUTE_MS));
      }
    }
    return result;
  }
}

function isJudgedSession(row: TrackedRow): boolean {
  return (
    !row.correctedAt &&
    !NOT_WORKING_STATUSES.has(row.status) &&
    row.checkIn >= TRACKING_REPORT_SINCE
  );
}

function sessionEnd(row: TrackedRow, now: Date): Date {
  if (row.checkOut) return row.checkOut;
  const limit = row.checkIn.getTime() + MAX_OPEN_SESSION_MS;
  return new Date(Math.min(now.getTime(), limit));
}

function groupByUser<T extends { row: TrackedRow }>(sessions: T[]) {
  const byUser = new Map<string, T[]>();
  for (const session of sessions) {
    const list = byUser.get(session.row.userId) ?? [];
    list.push(session);
    byUser.set(session.row.userId, list);
  }
  return byUser;
}
