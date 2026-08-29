import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "../../setup";
import { AbsenceService } from "@/modules/attendance";
import { HolidayRepository } from "@/modules/attendance/repositories/HolidayRepository";

/**
 * Invariant: setiap baris Attendance yang dibuat sistem WAJIB mengisi checkInDate.
 *
 * Tanpa checkInDate, unique index idx_attendance_user_checkin_date_tenant
 * (userId, checkInDate, tenantId) tidak pernah aktif — Postgres memperlakukan
 * NULL sebagai nilai yang selalu distinct — sehingga baris duplikat per hari
 * lolos ke database.
 */

const TENANT_ID = "tenant-1";
const WORK_DATE = new Date("2026-03-02T00:00:00.000Z");

function getCreatedAttendanceData() {
  return prismaMock.attendance.create.mock.calls.map(
    (call) => (call[0] as { data: Record<string, unknown> }).data,
  );
}

function mockActiveUser(overrides: Record<string, unknown> = {}) {
  return [
    {
      id: "user-1",
      tenantId: TENANT_ID,
      name: "Budi",
      workDays: "Mon,Tue,Wed,Thu,Fri",
      workingHourMode: "FIXED",
      isAttendanceRequired: true,
      ...overrides,
    },
  ];
}

describe("system-generated attendance selalu mengisi checkInDate", () => {
  beforeEach(() => {
    vi.spyOn(HolidayRepository.prototype, "findMany").mockResolvedValue(
      [] as never,
    );
    vi.spyOn(
      HolidayRepository.prototype,
      "findFirstByTenantAndDateRange",
    ).mockResolvedValue(null as never);
    prismaMock.attendance.findFirst.mockResolvedValue(null);
    prismaMock.leaveRequest.findFirst.mockResolvedValue(null);
    prismaMock.attendance.create.mockResolvedValue({ id: "att-1" } as never);
  });

  it("AbsenceService mengisi checkInDate saat membuat ABSENT", async () => {
    prismaMock.user.findMany.mockResolvedValue(mockActiveUser() as never);

    await new AbsenceService().processDailyAbsence(WORK_DATE, TENANT_ID);

    const created = getCreatedAttendanceData();
    expect(created.length).toBeGreaterThan(0);
    for (const data of created) {
      expect(data.checkInDate).toBeInstanceOf(Date);
      expect(data.checkInDate).toEqual(data.checkIn);
    }
  });

  it("AbsenceService mengisi checkInDate saat membuat DAY_OFF", async () => {
    // Minggu -> bukan hari kerja -> DAY_OFF
    prismaMock.user.findMany.mockResolvedValue(mockActiveUser() as never);

    await new AbsenceService().processDailyAbsence(
      new Date("2026-03-01T00:00:00.000Z"),
      TENANT_ID,
    );

    const created = getCreatedAttendanceData();
    expect(created.length).toBeGreaterThan(0);
    for (const data of created) {
      expect(data.status).toBe("DAY_OFF");
      expect(data.checkInDate).toBeInstanceOf(Date);
      expect(data.checkInDate).toEqual(data.checkIn);
    }
  });

  it("sinkronisasi DAY_OFF rentang tanggal mengisi checkInDate", async () => {
    prismaMock.user.findMany.mockResolvedValue(mockActiveUser() as never);

    await new AbsenceService().syncDayOffAttendanceRange(
      new Date("2026-03-01T00:00:00.000Z"),
      new Date("2026-03-01T00:00:00.000Z"),
      TENANT_ID,
    );

    const created = getCreatedAttendanceData();
    expect(created.length).toBeGreaterThan(0);
    for (const data of created) {
      expect(data.checkInDate).toBeInstanceOf(Date);
      expect(data.checkInDate).toEqual(data.checkIn);
    }
  });
});
