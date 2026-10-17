import { beforeEach, describe, expect, it, vi } from "vitest";

const { logActivitySafe } = vi.hoisted(() => ({ logActivitySafe: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logActivitySafe }));

import {
  ATTENDANCE_ACTIVITY_ACTIONS,
  ATTENDANCE_ACTIVITY_SUBJECTS,
  ATTENDANCE_SYSTEM_ACTORS,
  formatAttendanceDate,
  recordAttendanceActivity,
} from "@/modules/attendance/services/attendance-activity-log";

describe("recordAttendanceActivity", () => {
  beforeEach(() => logActivitySafe.mockReset());

  it("mencatat aksi karyawan dengan userId", () => {
    recordAttendanceActivity({
      action: ATTENDANCE_ACTIVITY_ACTIONS.CHECK_IN,
      subject: ATTENDANCE_ACTIVITY_SUBJECTS.ATTENDANCE,
      reference: "2026-10-17",
      actor: { userId: "user-1" },
      tenantId: "tenant-1",
      details: { status: "LATE" },
    });

    expect(logActivitySafe).toHaveBeenCalledWith({
      action: "CHECK_IN",
      subject: "Absensi 2026-10-17",
      userId: "user-1",
      tenantId: "tenant-1",
      details: { status: "LATE" },
    });
  });

  it("mencatat proses otomatis sebagai pelaku sistem", () => {
    recordAttendanceActivity({
      action: ATTENDANCE_ACTIVITY_ACTIONS.AUTO_ABSENT,
      subject: ATTENDANCE_ACTIVITY_SUBJECTS.ATTENDANCE,
      reference: "Budi 2026-10-17",
      actor: { systemId: ATTENDANCE_SYSTEM_ACTORS.DAILY_ABSENCE },
      tenantId: "tenant-1",
    });

    expect(logActivitySafe).toHaveBeenCalledWith({
      action: "AUTO_ABSENT",
      subject: "Absensi Budi 2026-10-17",
      actor: { type: "system", id: "cron:process-absence" },
      tenantId: "tenant-1",
      details: undefined,
    });
  });
});

describe("formatAttendanceDate", () => {
  it("memakai tanggal lokal tenant, bukan tanggal UTC", () => {
    const checkInJam05Wib = new Date("2026-10-16T22:30:00.000Z");
    expect(formatAttendanceDate(checkInJam05Wib, "Asia/Jakarta")).toBe(
      "2026-10-17",
    );
  });
});

describe("recordAutomaticAttendance", () => {
  beforeEach(() => logActivitySafe.mockReset());

  it("menulis nama karyawan dan tanggal lokal di subjek dengan pelaku sistem", async () => {
    const { recordAutomaticAttendance } =
      await import("@/modules/attendance/services/attendance-activity-log");

    recordAutomaticAttendance({
      action: ATTENDANCE_ACTIVITY_ACTIONS.AUTO_ABSENT,
      systemId: ATTENDANCE_SYSTEM_ACTORS.DAILY_ABSENCE,
      employee: { id: "user-1", name: "Budi" },
      date: new Date("2026-10-16T17:00:00.000Z"),
      timeZone: "Asia/Jakarta",
      tenantId: "tenant-1",
      details: { attendanceId: "att-9" },
    });

    expect(logActivitySafe).toHaveBeenCalledWith({
      action: "AUTO_ABSENT",
      subject: "Absensi Budi 2026-10-17",
      actor: { type: "system", id: "cron:process-absence" },
      tenantId: "tenant-1",
      details: {
        employeeId: "user-1",
        employeeName: "Budi",
        attendanceId: "att-9",
      },
    });
  });

  it("memakai ID karyawan bila nama tidak tersedia", async () => {
    const { recordAutomaticAttendance } =
      await import("@/modules/attendance/services/attendance-activity-log");

    recordAutomaticAttendance({
      action: ATTENDANCE_ACTIVITY_ACTIONS.AUTO_CHECKOUT,
      systemId: ATTENDANCE_SYSTEM_ACTORS.AUTO_CHECKOUT,
      employee: { id: "user-1", name: null },
      date: new Date("2026-10-17T01:00:00.000Z"),
      timeZone: "Asia/Jakarta",
      tenantId: "tenant-1",
    });

    expect(logActivitySafe.mock.calls[0][0].subject).toBe(
      "Absensi user-1 2026-10-17",
    );
  });
});
