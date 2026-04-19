import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "../../setup";
import { AttendanceRepository } from "@/modules/attendance/repositories/AttendanceRepository";

describe("AttendanceRepository absence parity", () => {
  let repository: AttendanceRepository;

  beforeEach(() => {
    repository = new AttendanceRepository();
  });

  it("queries user absence stats using both ALPHA and ABSENT statuses", async () => {
    prismaMock.user.findMany.mockResolvedValueOnce([{ id: "user-1" }]);
    prismaMock.attendance.groupBy.mockResolvedValueOnce([]);

    await repository.getUserAbsenceStats(
      new Date("2026-03-01"),
      new Date("2026-03-31"),
    );

    expect(prismaMock.attendance.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ["ALPHA", "ABSENT"] },
        }),
      }),
    );
  });

  it("queries top absentees using both ALPHA and ABSENT statuses", async () => {
    prismaMock.user.findMany
      .mockResolvedValueOnce([{ id: "user-1" }])
      .mockResolvedValueOnce([
        {
          id: "user-1",
          name: "User One",
          image: null,
          sites: { name: "HQ" },
          departments: { name: "Ops" },
        },
      ]);
    prismaMock.attendance.groupBy.mockResolvedValueOnce([
      { userId: "user-1", _count: { _all: 2 } },
    ]);

    await repository.getTopAbsentees(
      new Date("2026-03-01"),
      new Date("2026-03-31"),
      5,
    );

    expect(prismaMock.attendance.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ["ALPHA", "ABSENT"] },
        }),
      }),
    );
  });

  it("queries canonical evaluation stats by finalStatus instead of raw attendance status", async () => {
    prismaMock.attendanceEvaluation.groupBy.mockResolvedValueOnce([
      { finalStatus: "ABSENT", _count: { _all: 3 } },
    ]);
    prismaMock.attendanceEvaluation.count.mockResolvedValueOnce(3);
    prismaMock.attendanceEvaluation.aggregate.mockResolvedValueOnce({
      _avg: { workMinutes: 480 },
    });

    await repository.getEvaluationStatsByDateRange(
      new Date("2026-03-01"),
      new Date("2026-03-31"),
    );

    expect(prismaMock.attendanceEvaluation.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ["finalStatus"],
        where: expect.objectContaining({
          workDate: {
            gte: new Date("2026-03-01"),
            lte: new Date("2026-03-31"),
          },
        }),
      }),
    );
  });

  it("rejects atomic missed check-in correction when source was already corrected", async () => {
    const transactionClient = {
      attendance: {
        create: vi.fn().mockResolvedValue({
          id: "attendance-corrected-1",
          status: "ON_TIME",
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      attendanceEvaluation: {
        upsert: vi.fn(),
      },
      attendanceEvaluationAudit: {
        create: vi.fn(),
      },
    };

    prismaMock.$transaction.mockImplementationOnce(
      async (callback: (tx: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient),
    );

    const createData = {
      id: "attendance-corrected-1",
      tenantId: "tenant-1",
      userId: "user-1",
      checkIn: new Date("2026-04-17T01:00:00.000Z"),
      checkInDate: new Date("2026-04-16T17:00:00.000Z"),
      checkOut: new Date("2026-04-17T10:00:00.000Z"),
      checkInPhoto: "/uploads/employee/attendance/admin-1-proof.webp",
      status: "ON_TIME" as const,
      notes: null as string | null,
      location: "Manual correction by admin",
      checkOutLocation: "Auto-filled from schedule",
      geofenceStatus: "MANUAL",
      correctionSource: "ADMIN_MISSED_CHECKIN",
      correctionSourceAttendanceId: "attendance-absent-1",
      updatedAt: new Date("2026-04-17T02:00:00.000Z"),
    };

    await expect(
      repository.applyMissedCheckInCorrection({
        createData: createData as unknown as Parameters<
          AttendanceRepository["applyMissedCheckInCorrection"]
        >[0]["createData"],
        sourceAttendanceId: "attendance-absent-1",
        correctedById: "admin-1",
        correctionReason: "Karyawan hadir tetapi lupa absen masuk",
        correctionNotes: null,
        correctionEvidencePhotoUrl:
          "/uploads/employee/attendance/admin-1-proof.webp",
      }),
    ).rejects.toMatchObject({
      message: "Record mangkir ini sudah pernah dikoreksi",
      statusCode: 409,
      code: "CONFLICT",
    });

    expect(transactionClient.attendance.create).toHaveBeenCalledTimes(1);
    expect(transactionClient.attendance.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: "attendance-absent-1",
        correctedAt: null,
        status: { in: ["ABSENT", "ALPHA"] },
      }),
      data: expect.objectContaining({
        correctionReplacementAttendanceId: "attendance-corrected-1",
      }),
    });
    expect(
      transactionClient.attendanceEvaluation.upsert,
    ).not.toHaveBeenCalled();
    expect(
      transactionClient.attendanceEvaluationAudit.create,
    ).not.toHaveBeenCalled();
  });
});
