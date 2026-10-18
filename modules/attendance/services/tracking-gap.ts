/**
 * Batas sunyi sebelum tracking dianggap mati. HP Android yang diam mengirim
 * heartbeat paling lambat tiap 30 menit, jadi jeda lebih dari 45 menit tidak
 * terjadi pada tracking yang hidup.
 */
export const TRACKING_GAP_MS = 45 * 60 * 1000;

export const REPORTED_TRACKING_STATUSES = [
  "ACTIVE",
  "PERMISSION_DENIED",
  "BACKGROUND_DENIED",
  "GPS_OFF",
  "START_FAILED",
] as const;

export type ReportedTrackingStatus =
  (typeof REPORTED_TRACKING_STATUSES)[number];

export type TrackingOffReason =
  | "NO_POINT"
  | "STALE"
  | Exclude<ReportedTrackingStatus, "ACTIVE">;

export interface TrackingEvaluation {
  isOff: boolean;
  /** Titik terakhir sesi ini, atau check-in bila belum pernah ada titik. */
  offSince: Date | null;
  reason: TrackingOffReason | null;
}

const TRACKING_ON: TrackingEvaluation = {
  isOff: false,
  offSince: null,
  reason: null,
};

/** Status tracking satu sesi kerja yang masih berjalan. */
export function evaluateTracking(input: {
  checkIn: Date;
  lastPointAt: Date | null;
  reportedStatus: string | null;
  reportedAt: Date | null;
  now: Date;
}): TrackingEvaluation {
  const offSince = input.lastPointAt ?? input.checkIn;
  // Laporan aplikasi berlaku sampai ada titik yang lebih baru: titik itu bukti
  // tracking sudah hidup lagi walau laporan "ACTIVE"-nya belum sampai.
  if (
    isReportedProblem(input.reportedStatus) &&
    input.reportedAt &&
    (!input.lastPointAt || input.reportedAt > input.lastPointAt)
  ) {
    return { isOff: true, offSince, reason: input.reportedStatus };
  }
  if (input.now.getTime() - offSince.getTime() <= TRACKING_GAP_MS) {
    return TRACKING_ON;
  }
  return {
    isOff: true,
    offSince,
    reason: input.lastPointAt ? "STALE" : "NO_POINT",
  };
}

function isReportedProblem(
  status: string | null,
): status is Exclude<ReportedTrackingStatus, "ACTIVE"> {
  return (
    status !== null &&
    status !== "ACTIVE" &&
    (REPORTED_TRACKING_STATUSES as readonly string[]).includes(status)
  );
}

/** Total jeda tanpa titik yang lebih panjang dari batas, dalam satu sesi. */
export function sumTrackingOffMs(input: {
  start: Date;
  end: Date;
  points: Date[];
}): number {
  const start = input.start.getTime();
  const end = input.end.getTime();
  const times = input.points
    .map((point) => point.getTime())
    .filter((time) => time > start && time < end)
    .sort((a, b) => a - b);

  let total = 0;
  let previous = start;
  for (const time of [...times, end]) {
    const silence = time - previous;
    if (silence > TRACKING_GAP_MS) total += silence;
    previous = time;
  }
  return total;
}
