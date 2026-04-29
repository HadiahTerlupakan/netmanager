type UserScoreState = {
  days: number;
  officialOtMinutes: number;
  excessMinutes: number;
  totalMinutes: number;
  alphaCount: number;
};

type UserWorkConfig = {
  id: string;
  workingHourMode: string | null;
  startWorkTime?: string | null;
  endWorkTime?: string | null;
  flexibleTargetHour?: number | null;
  shift?: { startTime?: string | null; endTime?: string | null } | null;
};

const DEFAULT_MINUTES_PER_DAY = 480;
const HOURS_PER_MINUTE = 60;
const ATTENDANCE_POINT = 10;
const ALPHA_PENALTY_POINT = 20;
const OFFICIAL_OT_DIVISOR = 30;
const EXCESS_OT_DIVISOR = 15;

/** Buat state awal skor user absensi. */
export function createUserScoreState(): UserScoreState {
  return {
    days: 0,
    officialOtMinutes: 0,
    excessMinutes: 0,
    totalMinutes: 0,
    alphaCount: 0,
  };
}

/** Hitung menit kerja standar per hari untuk user. */
export function getStandardMinutesPerDay(
  userId: string,
  userConfigMap: Map<string, UserWorkConfig>,
): number {
  const config = userConfigMap.get(userId);
  if (!config) return DEFAULT_MINUTES_PER_DAY;
  if (config.workingHourMode === "FLEXIBLE")
    return (config.flexibleTargetHour || 8) * HOURS_PER_MINUTE;
  if (config.workingHourMode === "SHIFT") return getShiftMinutes(config.shift);
  return getRangeMinutes(config.startWorkTime, config.endWorkTime);
}

/** Hitung hasil scoring user untuk laporan absensi. */
export function buildAttendanceScoreResult(
  userId: string,
  stats: UserScoreState,
) {
  const officialScore = Math.floor(
    stats.officialOtMinutes / OFFICIAL_OT_DIVISOR,
  );
  const excessScore = Math.floor(stats.excessMinutes / EXCESS_OT_DIVISOR);
  const alphaPenalty = stats.alphaCount * ALPHA_PENALTY_POINT;
  const totalOtMinutes = stats.officialOtMinutes + stats.excessMinutes;
  return {
    userId,
    score:
      stats.days * ATTENDANCE_POINT +
      officialScore +
      excessScore -
      alphaPenalty,
    details: {
      days: stats.days,
      alphaCount: stats.alphaCount,
      otHours: toRoundedHours(totalOtMinutes),
      officialOtHours: toRoundedHours(stats.officialOtMinutes),
      excessHours: toRoundedHours(stats.excessMinutes),
      totalHours: toRoundedHours(stats.totalMinutes),
    },
  };
}

/** Ubah menit menjadi jam 1 desimal. */
export function toRoundedHours(totalMinutes: number) {
  return parseFloat((totalMinutes / HOURS_PER_MINUTE).toFixed(1));
}

function getShiftMinutes(
  shift?: { startTime?: string | null; endTime?: string | null } | null,
) {
  if (!shift?.startTime || !shift?.endTime) return DEFAULT_MINUTES_PER_DAY;
  return getRangeMinutes(shift.startTime, shift.endTime);
}

function getRangeMinutes(startTime?: string | null, endTime?: string | null) {
  if (!startTime || !endTime) return DEFAULT_MINUTES_PER_DAY;
  const startMinutes = parseClockToMinutes(startTime);
  const endMinutes = parseClockToMinutes(endTime);
  return endMinutes >= startMinutes
    ? endMinutes - startMinutes
    : 24 * HOURS_PER_MINUTE - startMinutes + endMinutes;
}

function parseClockToMinutes(value: string) {
  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText || 0);
  const minute = Number(minuteText || 0);
  return hour * HOURS_PER_MINUTE + minute;
}
