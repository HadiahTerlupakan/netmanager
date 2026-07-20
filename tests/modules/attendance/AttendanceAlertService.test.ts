import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "../../setup";

const mockFns = vi.hoisted(() => ({
  sendPushNotification: vi.fn().mockResolvedValue(true),
  createNotification: vi.fn().mockResolvedValue({ id: "notif-1" }),
  whatsAppSend: vi.fn().mockResolvedValue({ success: true }),
}));

const redisStore = new Map<string, { value: string; expiresAt: number }>();

vi.mock("@/modules/notification/services/ExpoPushService", () => ({
  sendPushNotification: mockFns.sendPushNotification,
}));

vi.mock("@/modules/notification/services/NotificationService", () => ({
  createNotification: mockFns.createNotification,
}));

vi.mock("@/modules/notification/services/whatsapp-sender.service", () => ({
  WhatsAppSenderService: class {
    send = mockFns.whatsAppSend;
  },
}));

vi.mock("@/modules/notification", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/modules/notification")>();
  return {
    ...actual,
    sendPushNotification: mockFns.sendPushNotification,
    WhatsAppSenderService: class {
      send = mockFns.whatsAppSend;
    },
  };
});

vi.mock("@/lib/redis", () => {
  const get = vi.fn(async (key: string) => {
    const entry = redisStore.get(key);
    if (!entry || entry.expiresAt <= Date.now()) {
      redisStore.delete(key);
      return null;
    }
    return entry.value;
  });

  const set = vi.fn(
    async (
      key: string,
      value: string,
      mode?: string,
      ttlSeconds?: number,
      nxMode?: string,
    ) => {
      const ttl = typeof ttlSeconds === "number" ? ttlSeconds : 3600;
      const now = Date.now();
      const existing = redisStore.get(key);
      const canWrite = !(
        mode === "EX" &&
        nxMode === "NX" &&
        existing &&
        existing.expiresAt > now
      );
      if (!canWrite) return null;

      redisStore.set(key, { value, expiresAt: now + ttl * 1000 });
      return "OK";
    },
  );

  return { redis: { get, set } };
});

vi.mock("@/lib/utils/get-timezone", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/utils/get-timezone")>();

  return {
    ...actual,
    getTimezone: vi.fn().mockResolvedValue("Asia/Jakarta"),
  };
});

import {
  processCheckInReminders,
  processCheckOutReminders,
  processFixedHourAutoAlpha,
  processIncompleteAttendance,
  processFlexibleReminders,
  runScheduledAttendanceCheck,
} from "@/modules/attendance";

describe("AttendanceAlertService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 9, 8, 35, 0, 0));
    vi.clearAllMocks();
    redisStore.clear();
  });

  it("sends check-in reminders only once per user within the same reminder window", async () => {
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: "user-1",
        name: "Budi",
        startWorkTime: "08:00",
        endWorkTime: "17:00",
        workDays: "MON,TUE,WED,THU,FRI",
        pushToken: "token-1",
        phone: "08123456789",
        workingHourMode: "FIXED",
      },
    ]);
    prismaMock.attendance.findMany.mockResolvedValue([]);

    const first = await processCheckInReminders(30);
    const second = await processCheckInReminders(30);

    expect(first.usersNotified).toBe(1);
    expect(second.usersNotified).toBe(0);
    expect(mockFns.sendPushNotification).toHaveBeenCalledTimes(1);
    expect(mockFns.whatsAppSend).toHaveBeenCalledTimes(1);
    expect(mockFns.sendPushNotification).toHaveBeenCalledWith(
      "user-1",
      expect.stringContaining("Telat Check-In"),
      expect.stringContaining("08:00"),
      expect.objectContaining({ action: "check_in" }),
    );
  });

  it("sends check-in reminder via WhatsApp only when user has phone without push token", async () => {
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: "user-wa",
        name: "Wati",
        startWorkTime: "08:00",
        endWorkTime: "17:00",
        workDays: "MON,TUE,WED,THU,FRI",
        pushToken: null,
        phone: "08111111111",
        workingHourMode: "FIXED",
      },
    ]);
    prismaMock.attendance.findMany.mockResolvedValue([]);

    const result = await processCheckInReminders(30);

    expect(result.usersNotified).toBe(1);
    expect(mockFns.sendPushNotification).not.toHaveBeenCalled();
    expect(mockFns.whatsAppSend).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: "08111111111",
        accountType: "INTERNAL",
      }),
    );
  });

  it("sends flexible no-checkin reminder once per day after local noon", async () => {
    vi.setSystemTime(new Date(2026, 2, 9, 12, 15, 0, 0));

    prismaMock.user.findMany.mockResolvedValue([
      {
        id: "user-flex-none",
        name: "Flexi",
        tenantId: "tenant-1",
        workDays: "MON,TUE,WED,THU,FRI",
        pushToken: "token-flex-none",
        phone: null,
        flexibleTargetHour: 8,
      },
    ]);
    prismaMock.attendance.findMany.mockResolvedValue([]);

    const { processFlexibleNoCheckInReminders } =
      await import("@/modules/attendance");
    const first = await processFlexibleNoCheckInReminders();
    const second = await processFlexibleNoCheckInReminders();

    expect(first.usersNotified).toBe(1);
    expect(second.usersNotified).toBe(0);
    expect(mockFns.sendPushNotification).toHaveBeenCalledTimes(1);
  });

  it("sends flexible reminders once per exceeded hour bucket", async () => {
    prismaMock.attendance.findMany.mockResolvedValue([
      {
        checkIn: new Date(2026, 2, 8, 23, 20, 0, 0),
        user: {
          id: "user-flex",
          name: "Sari",
          flexibleTargetHour: 8,
          pushToken: "token-flex",
          phone: null,
        },
      },
    ]);

    const first = await processFlexibleReminders();
    const second = await processFlexibleReminders();

    expect(first.usersNotified).toBe(1);
    expect(second.usersNotified).toBe(0);
    expect(mockFns.sendPushNotification).toHaveBeenCalledTimes(1);
  });

  it("creates incomplete attendance alerts only once per user per day", async () => {
    prismaMock.attendance.findMany.mockResolvedValue([
      {
        userId: "user-miss",
        user: { name: "Rina" },
      },
    ]);

    const first = await processIncompleteAttendance();
    const second = await processIncompleteAttendance();

    expect(first.usersNotified).toEqual(["Rina"]);
    expect(second.usersNotified).toEqual([]);
    expect(mockFns.createNotification).toHaveBeenCalledTimes(1);
  });

  it("skips check-in reminders when reminder lock storage is unavailable", async () => {
    const redisModule = await import("@/lib/redis");
    vi.mocked(redisModule.redis.set).mockRejectedValueOnce(
      new Error("redis unavailable"),
    );

    prismaMock.user.findMany.mockResolvedValue([
      {
        id: "user-1",
        name: "Budi",
        startWorkTime: "08:00",
        endWorkTime: "17:00",
        workDays: "MON,TUE,WED,THU,FRI",
        pushToken: "token-1",
        phone: null,
        workingHourMode: "FIXED",
      },
    ]);
    prismaMock.attendance.findMany.mockResolvedValue([]);

    const result = await processCheckInReminders(30);

    expect(result.usersNotified).toBe(0);
    expect(mockFns.sendPushNotification).not.toHaveBeenCalled();
  });

  it("ignores DAY_OFF, PERMIT, and SICK records when checking check-out reminders", async () => {
    prismaMock.attendance.findMany.mockResolvedValue([]);

    const result = await processCheckOutReminders();

    expect(result.usersNotified).toBe(0);
    expect(prismaMock.attendance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: {
            notIn: ["ALPHA", "ABSENT", "DAY_OFF", "PERMIT", "SICK"],
          },
        }),
      }),
    );
    expect(mockFns.sendPushNotification).not.toHaveBeenCalled();
  });

  it("ignores DAY_OFF, PERMIT, and SICK records when checking incomplete attendance alerts", async () => {
    prismaMock.attendance.findMany.mockResolvedValue([]);

    await processIncompleteAttendance();

    expect(prismaMock.attendance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: {
            notIn: ["ALPHA", "ABSENT", "DAY_OFF", "PERMIT", "SICK"],
          },
        }),
      }),
    );
    expect(mockFns.createNotification).not.toHaveBeenCalled();
  });

  it("auto marks fixed-hour users as ABSENT once their work end time has passed without check-in", async () => {
    vi.setSystemTime(new Date(2026, 2, 9, 17, 35, 0, 0));

    prismaMock.user.findMany.mockResolvedValue([
      {
        id: "user-fixed",
        name: "Budi",
        tenantId: "tenant-1",
        endWorkTime: "17:00",
        workDays: "MON,TUE,WED,THU,FRI",
        workingHourMode: "FIXED",
        isAttendanceRequired: true,
        joinDate: null,
      },
    ]);
    prismaMock.holiday.findFirst.mockResolvedValue(null);
    prismaMock.attendance.findFirst.mockResolvedValue(null);
    prismaMock.leaveRequest.findFirst.mockResolvedValue(null);
    prismaMock.attendance.create.mockResolvedValue({ id: "att-1" });

    const result = await processFixedHourAutoAlpha();

    expect(result.usersMarkedAlpha).toBe(1);
    expect(result.details).toEqual(["Budi (17:00)"]);
    expect(prismaMock.attendance.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-fixed",
        tenantId: "tenant-1",
        status: "ABSENT",
        notes: "Tidak Masuk Kerja (Absent) - Auto Generated",
        location: "System",
        checkIn: new Date(2026, 2, 9, 0, 0, 0, 0),
        updatedAt: expect.any(Date),
        id: expect.any(String),
      }),
    });
  });

  it("skips auto alpha before user joinDate", async () => {
    vi.setSystemTime(new Date(2026, 2, 9, 17, 35, 0, 0));

    prismaMock.user.findMany.mockResolvedValue([
      {
        id: "user-fixed",
        name: "Karyawan Baru",
        tenantId: "tenant-1",
        endWorkTime: "17:00",
        workDays: "MON,TUE,WED,THU,FRI",
        workingHourMode: "FIXED",
        isAttendanceRequired: true,
        joinDate: new Date("2026-04-01T00:00:00.000Z"),
      },
    ]);
    prismaMock.holiday.findFirst.mockResolvedValue(null);
    prismaMock.attendance.findFirst.mockResolvedValue(null);
    prismaMock.leaveRequest.findFirst.mockResolvedValue(null);

    const result = await processFixedHourAutoAlpha();

    expect(result.usersMarkedAlpha).toBe(0);
    expect(prismaMock.attendance.create).not.toHaveBeenCalled();
  });

  it("skips auto alpha when reminder lock storage is unavailable", async () => {
    const redisModule = await import("@/lib/redis");
    vi.mocked(redisModule.redis.set).mockRejectedValueOnce(
      new Error("redis unavailable"),
    );

    vi.setSystemTime(new Date(2026, 2, 9, 17, 35, 0, 0));

    prismaMock.user.findMany.mockResolvedValue([
      {
        id: "user-fixed",
        name: "Budi",
        tenantId: "tenant-1",
        endWorkTime: "17:00",
        workDays: "MON,TUE,WED,THU,FRI",
        workingHourMode: "FIXED",
        isAttendanceRequired: true,
        joinDate: null,
      },
    ]);
    prismaMock.holiday.findFirst.mockResolvedValue(null);
    prismaMock.attendance.findFirst.mockResolvedValue(null);
    prismaMock.leaveRequest.findFirst.mockResolvedValue(null);

    const result = await processFixedHourAutoAlpha();

    expect(result.usersMarkedAlpha).toBe(0);
    expect(prismaMock.attendance.create).not.toHaveBeenCalled();
  });

  it("does not auto mark users before the fixed work end time or for non-fixed modes", async () => {
    vi.setSystemTime(new Date(2026, 2, 9, 16, 45, 0, 0));

    prismaMock.user.findMany.mockResolvedValue([
      {
        id: "user-fixed",
        name: "Budi",
        tenantId: "tenant-1",
        endWorkTime: "17:00",
        workDays: "MON,TUE,WED,THU,FRI",
        workingHourMode: "FIXED",
        isAttendanceRequired: true,
        joinDate: null,
      },
      {
        id: "user-flex",
        name: "Sari",
        tenantId: "tenant-1",
        endWorkTime: "16:00",
        workDays: "MON,TUE,WED,THU,FRI",
        workingHourMode: "FLEXIBLE",
        isAttendanceRequired: true,
        joinDate: null,
      },
    ]);

    const result = await processFixedHourAutoAlpha();

    expect(result.usersMarkedAlpha).toBe(0);
    expect(prismaMock.attendance.create).not.toHaveBeenCalled();
  });

  it("skips auto alpha when fixed-hour users are on holiday, already attended, or on approved leave", async () => {
    vi.setSystemTime(new Date(2026, 2, 9, 17, 35, 0, 0));

    prismaMock.user.findMany.mockResolvedValue([
      {
        id: "user-holiday",
        name: "Hari",
        tenantId: "tenant-1",
        endWorkTime: "17:00",
        workDays: "MON,TUE,WED,THU,FRI",
        workingHourMode: "FIXED",
        isAttendanceRequired: true,
        joinDate: null,
      },
      {
        id: "user-attended",
        name: "Absen",
        tenantId: "tenant-1",
        endWorkTime: "17:00",
        workDays: "MON,TUE,WED,THU,FRI",
        workingHourMode: "FIXED",
        isAttendanceRequired: true,
        joinDate: null,
      },
      {
        id: "user-leave",
        name: "Cuti",
        tenantId: "tenant-1",
        endWorkTime: "17:00",
        workDays: "MON,TUE,WED,THU,FRI",
        workingHourMode: "FIXED",
        isAttendanceRequired: true,
        joinDate: null,
      },
    ]);

    prismaMock.holiday.findFirst
      .mockResolvedValueOnce({ id: "holiday-1" })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    prismaMock.attendance.findFirst
      .mockResolvedValueOnce({ id: "att-existing" })
      .mockResolvedValueOnce(null);
    prismaMock.leaveRequest.findFirst.mockResolvedValueOnce({ id: "leave-1" });

    const result = await processFixedHourAutoAlpha();

    expect(result.usersMarkedAlpha).toBe(0);
    expect(prismaMock.attendance.create).not.toHaveBeenCalled();
  });

  it("includes fixed-hour auto alpha processing in the scheduled attendance check", async () => {
    vi.setSystemTime(new Date(2026, 2, 9, 17, 35, 0, 0));

    prismaMock.user.findMany.mockResolvedValue([
      {
        id: "user-fixed",
        name: "Budi",
        tenantId: "tenant-1",
        endWorkTime: "17:00",
        workDays: "MON,TUE,WED,THU,FRI",
        workingHourMode: "FIXED",
        isAttendanceRequired: true,
        joinDate: null,
      },
    ]);
    prismaMock.attendance.findMany.mockResolvedValue([]);
    prismaMock.holiday.findFirst.mockResolvedValue(null);
    prismaMock.attendance.findFirst.mockResolvedValue(null);
    prismaMock.leaveRequest.findFirst.mockResolvedValue(null);
    prismaMock.attendance.create.mockResolvedValue({ id: "att-1" });

    const result = await runScheduledAttendanceCheck();

    expect(result.fixedAlpha.usersMarkedAlpha).toBe(1);
    expect(result.checkIn.usersNotified).toBe(0);
    expect(result.checkOut.usersNotified).toBe(0);
    expect(result.lateCheckOut.usersNotified).toBe(0);
    expect(result.flexible.usersNotified).toBe(0);
  });
});
