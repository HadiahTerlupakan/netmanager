import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/utils/get-timezone", () => ({
  getTimezone: vi.fn().mockResolvedValue("Asia/Jakarta"),
}));

import { AttendanceCorrectionService } from "@/modules/attendance/services/AttendanceCorrectionService";
import { AttendanceTimezoneService } from "@/modules/attendance/services/AttendanceTimezoneService";

describe("AttendanceCorrectionService", () => {
  type AttendanceCorrectionRepository = ConstructorParameters<
    typeof AttendanceCorrectionService
  >[0];

  const mockFindCorrectionSourceById = vi.fn();
  const mockCreateCorrectedAttendance = vi.fn();
  const mockMarkAttendanceAsCorrected = vi.fn();
  const mockFindLatestEvaluationForUser = vi.fn();
  const mockRecordEvaluationChange = vi.fn();
  const mockApplyMissedCheckInCorrection = vi.fn();

  const mockRepository: AttendanceCorrectionRepository = {
    findCorrectionSourceById: mockFindCorrectionSourceById,
    createCorrectedAttendance: mockCreateCorrectedAttendance,
    markAttendanceAsCorrected: mockMarkAttendanceAsCorrected,
    findLatestEvaluationForUser: mockFindLatestEvaluationForUser,
    recordEvaluationChange: mockRecordEvaluationChange,
    applyMissedCheckInCorrection: mockApplyMissedCheckInCorrection,
  };

  const createService = () => new AttendanceCorrectionService(mockRepository);

  const originalAllowNonAtomic =
    process.env.ALLOW_NON_ATOMIC_ATTENDANCE_CORRECTION;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ALLOW_NON_ATOMIC_ATTENDANCE_CORRECTION;
    vi.spyOn(
      AttendanceTimezoneService.prototype,
      "calculateStatus",
    ).mockResolvedValue("ON_TIME");
    mockApplyMissedCheckInCorrection.mockImplementation(
      async ({ createData }) => ({
        id: createData.id,
        status: createData.status,
      }),
    );
    mockFindLatestEvaluationForUser.mockResolvedValue(null);
    mockRecordEvaluationChange.mockResolvedValue({ id: "evaluation-1" });
  });

  afterAll(() => {
    if (typeof originalAllowNonAtomic === "undefined") {
      delete process.env.ALLOW_NON_ATOMIC_ATTENDANCE_CORRECTION;
      return;
    }

    process.env.ALLOW_NON_ATOMIC_ATTENDANCE_CORRECTION = originalAllowNonAtomic;
  });

  it("creates a replacement attendance and marks source ABSENT row as corrected when fallback is explicitly enabled", async () => {
    process.env.ALLOW_NON_ATOMIC_ATTENDANCE_CORRECTION = "1";

    const service = new AttendanceCorrectionService({
      ...mockRepository,
      applyMissedCheckInCorrection: undefined,
    });

    mockFindCorrectionSourceById.mockResolvedValue({
      id: "attendance-absent-1",
      tenantId: "tenant-1",
      userId: "user-1",
      status: "ABSENT",
      checkIn: new Date("2026-04-17T10:00:00.000Z"),
      checkOut: null,
      checkInDate: null,
      notes: "Tidak Masuk Kerja (Absent) - Auto Generated",
      correctedAt: null,
      user: {
        id: "user-1",
        workingHourMode: "FIXED",
        startWorkTime: "08:00",
        endWorkTime: "17:00",
        shift: null,
      },
    });

    mockCreateCorrectedAttendance.mockResolvedValue({
      id: "attendance-corrected-1",
      status: "ON_TIME",
    });

    const result = await service.correctMissedCheckIn({
      sourceAttendanceId: "attendance-absent-1",
      tenantId: "tenant-1",
      actorId: "admin-1",
      checkIn: new Date("2026-04-17T01:03:00.000Z"),
      checkOut: null,
      reason: "Karyawan hadir tetapi lupa absen masuk",
      notes: "Diverifikasi supervisor",
      evidencePhotoUrl: "/uploads/employee/attendance/admin-1-proof.webp",
    });

    expect(mockMarkAttendanceAsCorrected).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceAttendanceId: "attendance-absent-1",
        correctedById: "admin-1",
        correctionReason: "Karyawan hadir tetapi lupa absen masuk",
        replacementAttendanceId: "attendance-corrected-1",
      }),
    );
    expect(result.correctedAttendance.status).toBe("ON_TIME");
  });

  it("creates correction atomically with evaluation payload and actual late minutes", async () => {
    const service = createService();

    vi.spyOn(
      AttendanceTimezoneService.prototype,
      "calculateStatus",
    ).mockResolvedValue("LATE");

    mockFindCorrectionSourceById.mockResolvedValue({
      id: "attendance-alpha-1",
      tenantId: "tenant-1",
      userId: "user-1",
      status: "ALPHA",
      checkIn: new Date("2026-04-17T10:00:00.000Z"),
      correctedAt: null,
      user: {
        id: "user-1",
        workingHourMode: "SHIFT",
        startWorkTime: "08:00",
        endWorkTime: "17:00",
        shift: {
          startTime: "08:00",
          endTime: "17:00",
        },
      },
    });

    await service.correctMissedCheckIn({
      sourceAttendanceId: "attendance-alpha-1",
      tenantId: "tenant-1",
      actorId: "admin-1",
      checkIn: new Date("2026-04-17T01:30:00.000Z"),
      checkOut: new Date("2026-04-17T10:15:00.000Z"),
      reason: "Karyawan hadir tetapi lupa absen masuk",
      notes: "Diverifikasi admin",
      evidencePhotoUrl: "/uploads/employee/attendance/admin-1-proof.webp",
    });

    expect(mockApplyMissedCheckInCorrection).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceAttendanceId: "attendance-alpha-1",
        correctedById: "admin-1",
        evaluationChange: expect.objectContaining({
          evaluation: expect.objectContaining({
            finalStatus: "LATE",
            lateMinutes: 30,
            workMinutes: 525,
            scheduleState: "SHIFT",
          }),
          audit: expect.objectContaining({
            action: "MISSED_CHECKIN_CORRECTED",
            actorId: "admin-1",
          }),
        }),
      }),
    );
    expect(mockCreateCorrectedAttendance).not.toHaveBeenCalled();
    expect(mockMarkAttendanceAsCorrected).not.toHaveBeenCalled();
    expect(mockRecordEvaluationChange).not.toHaveBeenCalled();
  });

  it("rejects source rows that are not mangkir", async () => {
    const service = createService();

    mockFindCorrectionSourceById.mockResolvedValue({
      id: "attendance-late-1",
      tenantId: "tenant-1",
      userId: "user-1",
      status: "LATE",
      correctedAt: null,
      user: {
        id: "user-1",
        workingHourMode: "FIXED",
        startWorkTime: "08:00",
        endWorkTime: "17:00",
        shift: null,
      },
    });

    await expect(
      service.correctMissedCheckIn({
        sourceAttendanceId: "attendance-late-1",
        tenantId: "tenant-1",
        actorId: "admin-1",
        checkIn: new Date("2026-04-17T01:30:00.000Z"),
        checkOut: null,
        reason: "Tidak relevan",
        notes: null,
        evidencePhotoUrl: "/uploads/employee/attendance/admin-1-proof.webp",
      }),
    ).rejects.toThrow(/berstatus mangkir/i);
  });

  it("rejects correction when source attendance date is before user joinDate", async () => {
    const service = createService();

    mockFindCorrectionSourceById.mockResolvedValue({
      id: "attendance-absent-before-join-1",
      tenantId: "tenant-1",
      userId: "user-1",
      status: "ABSENT",
      checkIn: new Date("2026-03-03T00:00:00.000Z"),
      correctedAt: null,
      user: {
        id: "user-1",
        joinDate: new Date("2026-04-01T00:00:00.000Z"),
        workingHourMode: "FIXED",
        startWorkTime: "08:00",
        endWorkTime: "17:00",
        shift: null,
      },
    });

    await expect(
      service.correctMissedCheckIn({
        sourceAttendanceId: "attendance-absent-before-join-1",
        tenantId: "tenant-1",
        actorId: "admin-1",
        checkIn: new Date("2026-03-03T01:30:00.000Z"),
        checkOut: null,
        reason: "Sebelum join date",
        notes: null,
        evidencePhotoUrl: "/uploads/employee/attendance/admin-1-proof.webp",
      }),
    ).rejects.toThrow(/tanggal masuk|join/i);
  });

  it("rejects source rows from another tenant", async () => {
    const service = createService();

    mockFindCorrectionSourceById.mockResolvedValue({
      id: "attendance-absent-other-tenant",
      tenantId: "tenant-2",
      userId: "user-1",
      status: "ABSENT",
      checkIn: new Date("2026-04-17T10:00:00.000Z"),
      correctedAt: null,
      user: {
        id: "user-1",
        workingHourMode: "FIXED",
        startWorkTime: "08:00",
        endWorkTime: "17:00",
        shift: null,
      },
    });

    await expect(
      service.correctMissedCheckIn({
        sourceAttendanceId: "attendance-absent-other-tenant",
        tenantId: "tenant-1",
        actorId: "admin-1",
        checkIn: new Date("2026-04-17T01:30:00.000Z"),
        checkOut: null,
        reason: "Tenant mismatch",
        notes: null,
        evidencePhotoUrl: "/uploads/employee/attendance/admin-1-proof.webp",
      }),
    ).rejects.toThrow(/tidak ditemukan/i);
  });

  it("rejects check-in outside allowed correction window", async () => {
    const service = createService();

    mockFindCorrectionSourceById.mockResolvedValue({
      id: "attendance-absent-early-1",
      tenantId: "tenant-1",
      userId: "user-1",
      status: "ABSENT",
      checkIn: new Date("2026-04-17T10:00:00.000Z"),
      correctedAt: null,
      user: {
        id: "user-1",
        workingHourMode: "FIXED",
        startWorkTime: "08:00",
        endWorkTime: "17:00",
        shift: null,
      },
    });

    await expect(
      service.correctMissedCheckIn({
        sourceAttendanceId: "attendance-absent-early-1",
        tenantId: "tenant-1",
        actorId: "admin-1",
        checkIn: new Date("2026-04-16T21:59:00.000Z"),
        checkOut: null,
        reason: "Di luar jendela",
        notes: null,
        evidencePhotoUrl: "/uploads/employee/attendance/admin-1-proof.webp",
      }),
    ).rejects.toThrow(/di luar jendela/i);
  });

  it("persists evaluation after fallback create-and-mark flow when fallback is explicitly enabled", async () => {
    process.env.ALLOW_NON_ATOMIC_ATTENDANCE_CORRECTION = "1";

    const fallbackRepository: AttendanceCorrectionRepository = {
      ...mockRepository,
      applyMissedCheckInCorrection: undefined,
    };
    const service = new AttendanceCorrectionService(fallbackRepository);

    vi.spyOn(
      AttendanceTimezoneService.prototype,
      "calculateStatus",
    ).mockResolvedValue("LATE");

    mockFindCorrectionSourceById.mockResolvedValue({
      id: "attendance-absent-fallback-1",
      tenantId: "tenant-1",
      userId: "user-1",
      status: "ABSENT",
      checkIn: new Date("2026-04-17T10:00:00.000Z"),
      correctedAt: null,
      user: {
        id: "user-1",
        workingHourMode: "FIXED",
        startWorkTime: "08:00",
        endWorkTime: "17:00",
        shift: null,
      },
    });
    mockCreateCorrectedAttendance.mockResolvedValue({
      id: "attendance-corrected-fallback-1",
      status: "LATE",
    });

    await service.correctMissedCheckIn({
      sourceAttendanceId: "attendance-absent-fallback-1",
      tenantId: "tenant-1",
      actorId: "admin-1",
      checkIn: new Date("2026-04-17T01:30:00.000Z"),
      checkOut: new Date("2026-04-17T10:00:00.000Z"),
      reason: "Fallback flow",
      notes: null,
      evidencePhotoUrl: "/uploads/employee/attendance/admin-1-proof.webp",
    });

    expect(mockCreateCorrectedAttendance).toHaveBeenCalledTimes(1);
    expect(mockMarkAttendanceAsCorrected).toHaveBeenCalledTimes(1);
    expect(mockRecordEvaluationChange).toHaveBeenCalledWith(
      expect.objectContaining({
        evaluation: expect.objectContaining({
          finalStatus: "LATE",
          lateMinutes: 30,
          workMinutes: 510,
        }),
      }),
    );
  });

  it("rejects non-atomic fallback in production mode", async () => {
    const fallbackRepository: AttendanceCorrectionRepository = {
      ...mockRepository,
      applyMissedCheckInCorrection: undefined,
    };
    const service = new AttendanceCorrectionService(fallbackRepository);

    mockFindCorrectionSourceById.mockResolvedValue({
      id: "attendance-absent-prod-guard-1",
      tenantId: "tenant-1",
      userId: "user-1",
      status: "ABSENT",
      checkIn: new Date("2026-04-17T10:00:00.000Z"),
      correctedAt: null,
      user: {
        id: "user-1",
        workingHourMode: "FIXED",
        startWorkTime: "08:00",
        endWorkTime: "17:00",
        shift: null,
      },
    });

    await expect(
      service.correctMissedCheckIn({
        sourceAttendanceId: "attendance-absent-prod-guard-1",
        tenantId: "tenant-1",
        actorId: "admin-1",
        checkIn: new Date("2026-04-17T01:30:00.000Z"),
        checkOut: new Date("2026-04-17T10:00:00.000Z"),
        reason: "Guard non-atomic",
        notes: null,
        evidencePhotoUrl: "/uploads/employee/attendance/admin-1-proof.webp",
      }),
    ).rejects.toMatchObject({
      code: "ATOMIC_CORRECTION_REQUIRED",
      statusCode: 500,
    });

    expect(mockCreateCorrectedAttendance).not.toHaveBeenCalled();
    expect(mockMarkAttendanceAsCorrected).not.toHaveBeenCalled();
    expect(mockRecordEvaluationChange).not.toHaveBeenCalled();
  });

  it("rejects source rows that are already corrected", async () => {
    const service = createService();

    mockFindCorrectionSourceById.mockResolvedValue({
      id: "attendance-absent-corrected-1",
      tenantId: "tenant-1",
      userId: "user-1",
      status: "ABSENT",
      correctedAt: new Date("2026-04-18T02:00:00.000Z"),
      user: {
        id: "user-1",
        workingHourMode: "FIXED",
        startWorkTime: "08:00",
        endWorkTime: "17:00",
        shift: null,
      },
    });

    await expect(
      service.correctMissedCheckIn({
        sourceAttendanceId: "attendance-absent-corrected-1",
        tenantId: "tenant-1",
        actorId: "admin-1",
        checkIn: new Date("2026-04-17T01:30:00.000Z"),
        checkOut: null,
        reason: "Sudah dikoreksi sebelumnya",
        notes: null,
        evidencePhotoUrl: "/uploads/employee/attendance/admin-1-proof.webp",
      }),
    ).rejects.toThrow(/sudah.*dikoreksi|sudah.*koreksi/i);
  });
});
