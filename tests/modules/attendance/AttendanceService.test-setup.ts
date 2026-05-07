import { afterEach, beforeEach, vi } from "vitest";
export { prismaMock, redisMock } from "../../setup";
import { prismaMock, redisMock } from "../../setup";
import { AttendanceService } from "@/modules/attendance";
import { AttendanceDailyEvaluator } from "@/modules/attendance/services/AttendanceDailyEvaluator";
import { AttendanceEvaluationAuditService } from "@/modules/attendance/services/AttendanceEvaluationAuditService";
import { AttendanceValidationService } from "@/modules/attendance";
import { AttendanceTimezoneService } from "@/modules/attendance";
export { AttendanceDailyEvaluator } from "@/modules/attendance/services/AttendanceDailyEvaluator";
export { AttendanceEvaluationAuditService } from "@/modules/attendance/services/AttendanceEvaluationAuditService";
export {
  AttendanceTimezoneService,
  GeofenceService,
} from "@/modules/attendance";
import type { AttendanceEvaluationResult } from "@/modules/attendance/types/AttendanceEvaluation";

// Mock LeaveRepository - correct path
vi.mock("@/modules/attendance/repositories/LeaveRepository", () => ({
  LeaveRepository: class MockLeaveRepository {
    getUserLeaveStats = vi.fn().mockResolvedValue([]);
    findActiveLeaveForUserOnDate = vi.fn(() =>
      prismaMock.leaveRequest.findFirst(),
    );
  },
}));

// Mock OvertimeRepository with class syntax
vi.mock("@/modules/overtime/repositories/OvertimeRepository", () => ({
  OvertimeRepository: class MockOvertimeRepository {
    getUserOvertimeStats = vi.fn().mockResolvedValue([]);
    findActiveRequestByDate = vi.fn(() => prismaMock.overtime.findFirst());
  },
}));

// Mock AttendanceRepository with class syntax - matching actual return structure
vi.mock("@/modules/attendance/repositories/AttendanceRepository", () => ({
  AttendanceRepository: class MockAttendanceRepository {
    findMany = vi.fn((params) => prismaMock.attendance.findMany(params));
    create = vi.fn((data) => prismaMock.attendance.create({ data }));
    update = vi.fn((id, data) =>
      prismaMock.attendance.update({ where: { id }, data }),
    );
    findFirstOpenSession = vi.fn(() => prismaMock.attendance.findFirst());
    findManyStaleSessions = vi.fn(() => prismaMock.attendance.findMany());
    findFirstActiveForCheckout = vi.fn(() => prismaMock.attendance.findFirst());
    findFirstByUserAndDateRange = vi.fn(() =>
      prismaMock.attendance.findFirst(),
    );
    findManyForHistory = vi.fn().mockResolvedValue([]);
    countByUserId = vi.fn().mockResolvedValue(0);
    findFirstForCurrentStatus = vi.fn().mockResolvedValue(null);
    findLatestEvaluationForUser = vi.fn(() =>
      prismaMock.attendanceEvaluation.findFirst(),
    );
    findManyForAnalytics = vi.fn().mockResolvedValue([]);
    getStatsByDateRange = vi.fn().mockResolvedValue({
      total: 100,
      avgDurationMinutes: 480,
      statusCounts: { ON_TIME: 80, LATE: 15, ABSENT: 5 },
    });
    getEvaluationStatsByDateRange = vi.fn().mockResolvedValue({
      total: 100,
      avgDurationMinutes: 480,
      statusCounts: { ON_TIME: 80, LATE: 15, ABSENT: 5 },
    });
    getDailyStats = vi.fn().mockResolvedValue([]);
    getGroupedStats = vi.fn().mockResolvedValue([]);
    getTopEmployees = vi.fn().mockResolvedValue([]);
    getUserAttendanceStats = vi.fn().mockResolvedValue([]);
    getTopAbsentees = vi.fn().mockResolvedValue([]);
    getUserTotalDuration = vi.fn().mockResolvedValue(new Map());
    getUserAbsenceStats = vi.fn().mockResolvedValue([]);
    getUserLateStats = vi.fn().mockResolvedValue([]);
  },
}));

export const canonicalEvaluationResult: AttendanceEvaluationResult = {
  tenantId: "tenant-1",
  userId: "user-1",
  workDate: new Date("2026-03-08T00:00:00.000Z"),
  finalStatus: "PERMIT",
  reviewState: "PENDING_REVIEW",
  rawPresenceState: "ATTENDANCE_RECORDED",
  workMinutes: 0,
  lateMinutes: 0,
  overtimeMinutesApproved: 0,
  overtimeMinutesHeld: 0,
  payrollHoldState: "NONE",
  holidayState: null,
  leaveState: "CUTI",
  scheduleState: "FIXED",
  evidenceQuality: null,
  reasonCodes: ["APPROVED_LEAVE_OVERRIDES_ATTENDANCE"],
  anomalyCodes: ["ATTENDANCE_RECORDED_DURING_APPROVED_LEAVE"],
  sourceRefs: {},
  evaluationVersion: 1,
  evaluatedAt: new Date("2026-03-08T02:10:00.000Z"),
};

export let service: AttendanceService;
export const now = new Date("2026-03-08T08:00:00.000Z");
const startOfDay = new Date("2026-03-08T00:00:00.000Z");

beforeEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  Object.assign(prismaMock, {
    leaveRequest: prismaMock.leaveRequest,
    overtime: prismaMock.overtime,
    attendance: prismaMock.attendance,
    attendanceEvaluation: prismaMock.attendanceEvaluation,
    user: prismaMock.user,
  });
  vi.mocked(redisMock.get).mockReset();
  vi.mocked(redisMock.setex).mockReset();
  vi.mocked(redisMock.get).mockResolvedValue(null);
  vi.mocked(redisMock.setex).mockResolvedValue("OK");
  service = new AttendanceService();
  prismaMock.user.findMany.mockResolvedValue([]);
  vi.spyOn(
    AttendanceValidationService.prototype,
    "validateCheckInEligibility",
  ).mockResolvedValue({ isValid: true });
  vi.spyOn(
    AttendanceTimezoneService.prototype,
    "getTimezone",
  ).mockResolvedValue("Asia/Jakarta");
  vi.spyOn(
    AttendanceTimezoneService.prototype,
    "getEffectiveDate",
  ).mockReturnValue({
    now,
    startOfDay,
    tzOffsetMs: 0,
  });
  vi.spyOn(
    AttendanceTimezoneService.prototype,
    "calculateStatus",
  ).mockResolvedValue("ON_TIME");
  vi.spyOn(AttendanceDailyEvaluator.prototype, "evaluate").mockResolvedValue(
    canonicalEvaluationResult,
  );
  vi.spyOn(
    AttendanceEvaluationAuditService.prototype,
    "recordEvaluationChange",
  ).mockResolvedValue({
    id: "eval-default",
    ...canonicalEvaluationResult,
  } as never);
});

afterEach(() => {
  vi.useRealTimers();
});
