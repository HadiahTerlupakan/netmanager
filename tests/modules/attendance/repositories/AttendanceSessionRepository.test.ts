import { beforeEach, describe, expect, it, vi } from "vitest";
import { AttendanceSessionRepository } from "@/modules/attendance/repositories/AttendanceSessionRepository";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    attendance: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

describe("AttendanceSessionRepository", () => {
  let repository: AttendanceSessionRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new AttendanceSessionRepository();
  });

  describe("findFirstOpenSession", () => {
    it("harus memfilter correctedAt: null untuk mengabaikan attendance terkoreksi", async () => {
      vi.mocked(prisma.attendance.findFirst).mockResolvedValue(null);

      await repository.findFirstOpenSession({
        userId: "user-1",
        tenantId: "tenant-1",
      });

      expect(prisma.attendance.findFirst).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          checkOut: null,
          correctedAt: null,
          status: {
            notIn: ["ALPHA", "ABSENT", "DAY_OFF", "PERMIT", "SICK"],
          },
          tenantId: "tenant-1",
        },
        orderBy: { checkIn: "desc" },
        include: {
          user: {
            select: {
              workingHourMode: true,
              flexibleTargetHour: true,
              shift: { select: { startTime: true, endTime: true } },
            },
          },
        },
      });
    });

    it("harus memfilter correctedAt: null tanpa tenantId", async () => {
      vi.mocked(prisma.attendance.findFirst).mockResolvedValue(null);

      await repository.findFirstOpenSession({
        userId: "user-1",
      });

      expect(prisma.attendance.findFirst).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          checkOut: null,
          correctedAt: null,
          status: {
            notIn: ["ALPHA", "ABSENT", "DAY_OFF", "PERMIT", "SICK"],
          },
        },
        orderBy: { checkIn: "desc" },
        include: {
          user: {
            select: {
              workingHourMode: true,
              flexibleTargetHour: true,
              shift: { select: { startTime: true, endTime: true } },
            },
          },
        },
      });
    });

    it("harus return null jika hanya ada attendance terkoreksi", async () => {
      vi.mocked(prisma.attendance.findFirst).mockResolvedValue(null);

      const result = await repository.findFirstOpenSession({
        userId: "user-1",
        tenantId: "tenant-1",
      });

      expect(result).toBeNull();
    });

    it("harus return attendance aktif yang belum dikoreksi", async () => {
      const activeAttendance: {
        id: string;
        userId: string;
        checkIn: Date;
        checkOut: Date | null;
        correctedAt: Date | null;
        status: string;
        tenantId: string;
        user: {
          workingHourMode: string;
          flexibleTargetHour: number | null;
          shift: { startTime: string | null; endTime: string | null } | null;
        };
      } = {
        id: "att-active",
        userId: "user-1",
        checkIn: new Date("2026-05-08T01:00:00Z"),
        checkOut: null,
        correctedAt: null,
        status: "PRESENT",
        tenantId: "tenant-1",
        user: {
          workingHourMode: "FIXED",
          flexibleTargetHour: null,
          shift: null,
        },
      };

      vi.mocked(prisma.attendance.findFirst).mockResolvedValue(
        activeAttendance as never,
      );

      const result = await repository.findFirstOpenSession({
        userId: "user-1",
        tenantId: "tenant-1",
      });

      expect(result).toEqual(activeAttendance);
    });
  });

  describe("findFirstActiveForCheckout", () => {
    it("harus memfilter correctedAt: null untuk checkout", async () => {
      vi.mocked(prisma.attendance.findFirst).mockResolvedValue(null);

      await repository.findFirstActiveForCheckout({
        userId: "user-1",
        tenantId: "tenant-1",
      });

      expect(prisma.attendance.findFirst).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          checkOut: null,
          correctedAt: null,
          status: {
            notIn: ["ALPHA", "ABSENT", "DAY_OFF", "PERMIT", "SICK"],
          },
          tenantId: "tenant-1",
        },
        orderBy: { checkIn: "desc" },
        include: {
          user: {
            select: {
              workingHourMode: true,
              attendanceGeofencePolicy: true,
              flexibleTargetHour: true,
              name: true,
            },
          },
        },
      });
    });
  });

  describe("findManyStaleSessions", () => {
    it("harus memfilter correctedAt: null untuk stale sessions", async () => {
      vi.mocked(prisma.attendance.findMany).mockResolvedValue([]);

      await repository.findManyStaleSessions({
        userId: "user-1",
        effectiveToday: new Date("2026-05-08T00:00:00Z"),
        tenantId: "tenant-1",
      });

      expect(prisma.attendance.findMany).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          checkOut: null,
          correctedAt: null,
          tenantId: "tenant-1",
          status: {
            notIn: ["ALPHA", "ABSENT", "DAY_OFF", "PERMIT", "SICK"],
          },
          checkIn: { lt: new Date("2026-05-08T00:00:00Z") },
        },
      });
    });
  });

  describe("findAllOpenSessionsWithUser", () => {
    it("harus memfilter correctedAt: null untuk auto-checkout cron", async () => {
      vi.mocked(prisma.attendance.findMany).mockResolvedValue([]);

      await repository.findAllOpenSessionsWithUser({
        endOfToday: new Date("2026-05-08T16:59:59Z"),
        twentyFourHoursAgo: new Date("2026-05-07T13:16:00Z"),
        tenantId: "tenant-1",
      });

      expect(prisma.attendance.findMany).toHaveBeenCalledWith({
        where: {
          checkOut: null,
          correctedAt: null,
          checkIn: { lte: new Date("2026-05-08T16:59:59Z") },
          tenantId: "tenant-1",
          status: {
            notIn: ["ALPHA", "ABSENT", "DAY_OFF", "PERMIT", "SICK"],
          },
          OR: [
            { user: { workingHourMode: { not: "FLEXIBLE" } } },
            {
              user: { workingHourMode: "FLEXIBLE" },
              checkIn: { lte: new Date("2026-05-07T13:16:00Z") },
            },
          ],
        },
        include: {
          user: {
            select: {
              name: true,
              workingHourMode: true,
              startWorkTime: true,
              endWorkTime: true,
              shift: true,
            },
          },
        },
      });
    });
  });
});
