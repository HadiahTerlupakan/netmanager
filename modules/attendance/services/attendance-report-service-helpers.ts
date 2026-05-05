import {
  buildAttendanceScoreResult,
  createUserScoreState,
  getStandardMinutesPerDay,
  toRoundedHours,
} from "./attendance-report-helpers";
import type { UserLookupService } from "@/modules/users";

export type UserScoreState = ReturnType<typeof createUserScoreState>;

type AttendanceCountItem = { userId: string; _count: { _all: number } };
type OvertimeCountItem = { userId: string; totalDuration: number | null };
type UserBasicInfo = Awaited<
  ReturnType<UserLookupService["findManyWithBasicInfo"]>
>[number];
type UserFullDetails = Awaited<
  ReturnType<UserLookupService["findManyWithFullDetails"]>
>[number];
type UserWorkConfig = Awaited<
  ReturnType<UserLookupService["findManyWithWorkConfig"]>
>[number];

const DEFAULT_ZERO = 0;
const TOP_EMPLOYEE_LIMIT = 5;

/** Buat atau ambil state skor user dari map. */
export function getOrCreateUserScore(
  userMap: Map<string, UserScoreState>,
  userId: string,
): UserScoreState {
  if (!userMap.has(userId)) userMap.set(userId, createUserScoreState());
  return userMap.get(userId)!;
}

/** Terapkan jumlah hari hadir user ke map skor. */
export function applyAttendanceDays(
  userMap: Map<string, UserScoreState>,
  items: AttendanceCountItem[],
): void {
  items.forEach((item) => {
    getOrCreateUserScore(userMap, item.userId).days = item._count._all;
  });
}

/** Terapkan lembur resmi user yang sudah punya attendance. */
export function applyOfficialOvertime(
  userMap: Map<string, UserScoreState>,
  items: OvertimeCountItem[],
): void {
  items.forEach((item) => {
    if (!userMap.has(item.userId)) return;
    getOrCreateUserScore(userMap, item.userId).officialOtMinutes +=
      item.totalDuration || DEFAULT_ZERO;
  });
}

/** Terapkan penalti alpha ke user yang sudah punya attendance. */
export function applyAbsencePenalty(
  userMap: Map<string, UserScoreState>,
  items: AttendanceCountItem[],
): void {
  items.forEach((item) => {
    if (!userMap.has(item.userId)) return;
    getOrCreateUserScore(userMap, item.userId).alphaCount = item._count._all;
  });
}

/** Terapkan total menit kerja dan excess minutes user. */
export function applyDurationStats(
  userMap: Map<string, UserScoreState>,
  userTotalDuration: Map<string, number>,
  userConfigMap: Map<string, UserWorkConfig>,
): void {
  userTotalDuration.forEach((totalMinutes, userId) => {
    if (!userMap.has(userId)) return;
    const current = getOrCreateUserScore(userMap, userId);
    current.totalMinutes = totalMinutes;
    if (current.days <= DEFAULT_ZERO) return;
    const standardMinutes =
      current.days * getStandardMinutesPerDay(userId, userConfigMap);
    if (totalMinutes > standardMinutes) {
      current.excessMinutes += totalMinutes - standardMinutes;
    }
  });
}

/** Bangun daftar top scorer attendance. */
export function buildTopScorers(userMap: Map<string, UserScoreState>) {
  return Array.from(userMap.entries())
    .filter(([_, score]) => score.days > DEFAULT_ZERO)
    .map(([userId, score]) => buildAttendanceScoreResult(userId, score))
    .sort((left, right) => right.score - left.score)
    .slice(0, TOP_EMPLOYEE_LIMIT);
}

/** Buat map statistik numerik user. */
export function createStatsMap<T>(
  items: T[],
  getKey: (item: T) => string,
  getValue: (item: T) => number,
): Map<string, number> {
  return new Map(items.map((item) => [getKey(item), getValue(item)]));
}

/** Ambil semua user id unik dari beberapa sumber statistik. */
export function collectSummaryUserIds(
  userAttStats: AttendanceCountItem[],
  userAbsenceStats: AttendanceCountItem[],
  userLeaveStats: AttendanceCountItem[],
): string[] {
  return Array.from(
    new Set<string>([
      ...userAttStats.map((item) => item.userId),
      ...userAbsenceStats.map((item) => item.userId),
      ...userLeaveStats.map((item) => item.userId),
    ]),
  );
}

/** Buat item top employee gabungan dengan detail user. */
export function createCombinedTopEmployees(
  scorers: ReturnType<typeof buildAttendanceScoreResult>[],
  users: UserBasicInfo[],
) {
  return scorers
    .map((scorer) => ({
      user: users.find((user) => user.id === scorer.userId),
      score: scorer.score,
      details: scorer.details,
    }))
    .filter((item) => Boolean(item.user));
}

/** Buat daftar summary karyawan dari seluruh map statistik. */
export function createEmployeeSummary(params: {
  userIds: string[];
  userDetailsMap: Map<string, UserFullDetails>;
  userAttMap: Map<string, number>;
  userLateMap: Map<string, number>;
  userLeaveMap: Map<string, number>;
  userAbsenceMap: Map<string, number>;
  userOtMap: Map<string, number>;
  userTotalDuration: Map<string, number>;
}) {
  return params.userIds
    .map((userId) => buildEmployeeSummaryItem({ userId, ...params }))
    .filter((item) => item.user !== null);
}

/** Hitung persentase aman dari pembagi nol. */
export function calculateRate(count: number, total: number): number {
  return total > DEFAULT_ZERO ? (count / total) * 100 : DEFAULT_ZERO;
}

function buildEmployeeSummaryItem(params: {
  userId: string;
  userDetailsMap: Map<string, UserFullDetails>;
  userAttMap: Map<string, number>;
  userLateMap: Map<string, number>;
  userLeaveMap: Map<string, number>;
  userAbsenceMap: Map<string, number>;
  userOtMap: Map<string, number>;
  userTotalDuration: Map<string, number>;
}) {
  return {
    userId: params.userId,
    user: mapSummaryUser(params.userDetailsMap.get(params.userId)),
    ...buildAttendanceSummaryCounts(params),
    ...buildWorkDurationSummary(params),
  };
}

function buildWorkDurationSummary(params: {
  userId: string;
  userOtMap: Map<string, number>;
  userTotalDuration: Map<string, number>;
}) {
  const lemburMinutes = params.userOtMap.get(params.userId) || DEFAULT_ZERO;
  const totalMinutes =
    params.userTotalDuration.get(params.userId) || DEFAULT_ZERO;
  return {
    lemburJam: toRoundedHours(lemburMinutes),
    totalJamKerja: toRoundedHours(totalMinutes),
  };
}

function mapSummaryUser(user?: UserFullDetails) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    image: user.image,
    site: user.sites,
    department: user.departments,
  };
}

function buildAttendanceSummaryCounts(params: {
  userId: string;
  userAttMap: Map<string, number>;
  userLateMap: Map<string, number>;
  userLeaveMap: Map<string, number>;
  userAbsenceMap: Map<string, number>;
}) {
  return {
    hadir: params.userAttMap.get(params.userId) || DEFAULT_ZERO,
    terlambat: params.userLateMap.get(params.userId) || DEFAULT_ZERO,
    izin: params.userLeaveMap.get(params.userId) || DEFAULT_ZERO,
    alpha: params.userAbsenceMap.get(params.userId) || DEFAULT_ZERO,
  };
}
