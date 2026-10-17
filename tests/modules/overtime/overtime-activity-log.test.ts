import { beforeEach, describe, expect, it, vi } from "vitest";

const { logActivitySafe } = vi.hoisted(() => ({ logActivitySafe: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  logActivitySafe,
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/lib/utils/get-timezone", () => ({
  getTimezone: vi.fn().mockResolvedValue("Asia/Jakarta"),
  getTimezoneSync: () => "Asia/Jakarta",
}));

import { OvertimeAutoCheckoutService } from "@/modules/overtime/services/OvertimeAutoCheckoutService";
import { OvertimeService } from "@/modules/overtime/services/OvertimeService";

const START = new Date("2026-10-17T11:00:00.000Z"); // 18:00 WIB
const EMPLOYEE = { id: "user-1", name: "Budi", email: "budi@x.id" };

function overtime(status: string) {
  return {
    id: "ot-1",
    userId: "user-1",
    tenantId: "tenant-1",
    status,
    startTime: START,
    user: EMPLOYEE,
  };
}

function createService(record = overtime("APPROVED")) {
  const repository = {
    create: vi.fn().mockResolvedValue({ id: "ot-1", tenantId: "tenant-1" }),
    update: vi.fn().mockImplementation(async (_id, data) => ({
      ...record,
      ...data,
    })),
  };
  const service = new OvertimeService(
    repository as never,
    {} as never,
    { notifyAdminsForNewRequest: vi.fn() } as never,
    {
      findTodayAttendance: vi.fn().mockResolvedValue(null),
      resolveHolidayState: vi
        .fn()
        .mockResolvedValue({ isHolidayOvertime: false }),
    } as never,
    {} as never,
  );
  const internals = service as unknown as Record<
    string,
    Record<string, unknown>
  >;
  internals.accessService = {
    ensureNoActiveRequest: vi.fn(),
    requireOwnedOvertime: vi.fn().mockResolvedValue(record),
  };
  internals.schedulerService = { schedule: vi.fn(), cancel: vi.fn() };
  return service;
}

function lastActivity() {
  expect(logActivitySafe).toHaveBeenCalledTimes(1);
  return logActivitySafe.mock.calls[0][0];
}

describe("Log Aktivitas lembur", () => {
  beforeEach(() => logActivitySafe.mockReset());

  it("mencatat pengajuan lembur", async () => {
    await createService().createRequest("user-1", {
      date: START,
      reason: "maintenance ODP",
      tenantId: "tenant-1",
    });

    expect(lastActivity()).toEqual({
      action: "CREATE",
      subject: "Lembur 2026-10-17",
      userId: "user-1",
      tenantId: "tenant-1",
      details: { overtimeId: "ot-1", reason: "maintenance ODP" },
    });
  });

  it("mencatat mulai lembur", async () => {
    await createService().startOvertime("user-1", "ot-1", {
      photo: "/mulai.jpg",
      location: "-6.3,107.3",
      timestamp: START,
      tenantId: "tenant-1",
    });

    expect(lastActivity()).toMatchObject({
      action: "START",
      subject: "Lembur 2026-10-17",
      userId: "user-1",
      tenantId: "tenant-1",
      details: {
        overtimeId: "ot-1",
        waktu: START.toISOString(),
        location: "-6.3,107.3",
        lemburHariLibur: false,
      },
    });
  });

  it("mencatat selesai lembur beserta durasi", async () => {
    await createService(overtime("IN_PROGRESS")).stopOvertime(
      "user-1",
      "ot-1",
      {
        photo: "/selesai.jpg",
        location: "-6.3,107.3",
        timestamp: new Date("2026-10-17T13:00:00.000Z"),
      },
    );

    expect(lastActivity()).toMatchObject({
      action: "STOP",
      subject: "Lembur 2026-10-17",
      userId: "user-1",
      details: { overtimeId: "ot-1", durasiMenit: 120 },
    });
  });

  it("mencatat auto-checkout lembur sebagai pelaku sistem", async () => {
    const scheduledFor = new Date("2026-10-17T19:00:00.000Z");
    const repository = {
      findAutoCheckoutScheduleById: vi.fn().mockResolvedValue({
        id: "sch-1",
        overtimeId: "ot-1",
        version: 1,
        status: "PENDING",
        scheduledFor,
      }),
      findById: vi.fn().mockResolvedValue(overtime("IN_PROGRESS")),
      completeScheduledAutoCheckout: vi.fn().mockResolvedValue(true),
    };
    vi.spyOn(
      OvertimeAutoCheckoutService as unknown as {
        isRunnableSchedule: () => unknown;
      },
      "isRunnableSchedule",
    ).mockReturnValue(true);
    vi.useFakeTimers({ now: new Date("2026-10-18T00:00:00.000Z") });

    const result = await OvertimeAutoCheckoutService.runScheduledAutoCheckout(
      { scheduleId: "sch-1", overtimeId: "ot-1", version: 1 } as never,
      repository as never,
    );

    vi.useRealTimers();
    expect(result).toBe("completed");
    expect(lastActivity()).toMatchObject({
      action: "AUTO_STOP",
      subject: "Lembur Budi 2026-10-17",
      actor: { type: "system", id: "job:overtime-auto-checkout" },
      tenantId: "tenant-1",
      details: {
        overtimeId: "ot-1",
        employeeId: "user-1",
        endTime: scheduledFor.toISOString(),
        durasiMenit: 480,
      },
    });
  });
});

describe("Ketahanan pencatat lembur", () => {
  it("tidak menggagalkan proses bila zona waktu gagal diambil", async () => {
    const { getTimezone } = await import("@/lib/utils/get-timezone");
    vi.mocked(getTimezone).mockRejectedValueOnce(new Error("redis down"));
    const { recordOvertimeActivity } =
      await import("@/modules/overtime/services/overtime-activity-log");

    await expect(
      recordOvertimeActivity({
        action: "CREATE",
        date: START,
        actor: { userId: "user-1" },
        tenantId: "tenant-1",
        details: {},
      }),
    ).resolves.toBeUndefined();
  });
});
