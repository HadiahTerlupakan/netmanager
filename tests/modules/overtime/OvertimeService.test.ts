import { describe, it, expect, beforeEach, vi } from "vitest";
import { OvertimeStatus } from "@prisma/client";
import { prismaMock } from "../../setup";

// Since OvertimeService has complex dependencies, we'll test the business logic
// by mocking at the repository level and testing simpler scenarios

// Mock OvertimeRepository with class syntax
const mockOvertimeRepo = {
  findAll: vi.fn(),
  findById: vi.fn(),
  findActiveRequestByDate: vi.fn(),
  findByUserAndDate: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  getByUserId: vi.fn(),
};

vi.mock("@/modules/overtime/repositories/OvertimeRepository", () => ({
  OvertimeRepository: class MockOvertimeRepository {
    findAll = mockOvertimeRepo.findAll;
    findById = mockOvertimeRepo.findById;
    findActiveRequestByDate = mockOvertimeRepo.findActiveRequestByDate;
    findByUserAndDate = mockOvertimeRepo.findByUserAndDate;
    create = mockOvertimeRepo.create;
    update = mockOvertimeRepo.update;
    delete = mockOvertimeRepo.delete;
    getByUserId = mockOvertimeRepo.getByUserId;
  },
}));

// Mock HolidayRepository
vi.mock("@/modules/attendance/repositories/HolidayRepository", () => ({
  HolidayRepository: class MockHolidayRepository {
    isHoliday = vi.fn().mockResolvedValue(true); // Assume always holiday for testing
  },
}));

// Mock NotificationService
vi.mock("@/modules/notification/services/NotificationService", () => ({
  createNotification: vi.fn().mockResolvedValue({ id: "notif-1" }),
}));

const mockAutoCheckoutScheduler = {
  schedule: vi.fn(),
  cancel: vi.fn(),
};

vi.mock(
  "@/modules/overtime/services/OvertimeAutoCheckoutSchedulerService",
  () => ({
    OvertimeAutoCheckoutSchedulerService: class MockOvertimeAutoCheckoutSchedulerService {
      schedule = mockAutoCheckoutScheduler.schedule;
      cancel = mockAutoCheckoutScheduler.cancel;
    },
  }),
);

// Mock prisma for attendance check
vi.mock("@/lib/prisma", async () => {
  const { prismaMock } = await import("../../setup");
  return {
    prisma: prismaMock,
    prismaAuth: prismaMock,
  };
});

import { OvertimeService } from "@/modules/overtime/services/OvertimeService";

describe("OvertimeService", () => {
  let service: OvertimeService;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    service = new OvertimeService();
  });

  describe("createRequest", () => {
    it("should create overtime request successfully", async () => {
      mockOvertimeRepo.findActiveRequestByDate.mockResolvedValueOnce(null);
      mockOvertimeRepo.create.mockResolvedValueOnce({
        id: "overtime-1",
        userId: "user-1",
        date: new Date(),
        status: OvertimeStatus.PENDING,
      });

      // Mock user and admins for notification
      prismaMock.user.findFirst.mockResolvedValue({
        name: "Test User",
        siteId: "site-1",
      } as never);
      prismaMock.user.findMany.mockResolvedValue([{ id: "admin-1" }] as never);

      const result = await service.createRequest("user-1", {
        date: new Date(),
        reason: "Project deadline",
        tenantId: "tenant-1",
      });

      expect(result).toBeDefined();
      expect(result.status).toBe(OvertimeStatus.PENDING);
      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: { id: true },
          where: expect.objectContaining({
            tenantId: "tenant-1",
            OR: expect.arrayContaining([
              { role: { name: "SUPER_ADMIN" } },
              expect.objectContaining({
                AND: expect.arrayContaining([
                  expect.objectContaining({
                    role: {
                      permission: {
                        some: {
                          resource: "lembur",
                          action: "update",
                        },
                      },
                    },
                  }),
                  {
                    OR: [
                      { siteId: "site-1" },
                      { siteId: null },
                      { userSites: { some: { siteId: "site-1" } } },
                    ],
                  },
                ]),
              }),
            ]),
          }),
        }),
      );
    });
  });

  describe("approveRequest", () => {
    it("should approve pending request", async () => {
      mockOvertimeRepo.findById.mockResolvedValueOnce({
        id: "overtime-1",
        userId: "user-1",
        status: OvertimeStatus.PENDING,
      });
      mockOvertimeRepo.update.mockResolvedValueOnce({
        id: "overtime-1",
        status: OvertimeStatus.APPROVED,
        approvedById: "admin-1",
      });

      const result = await service.approveRequest("overtime-1", "admin-1");

      expect(result.status).toBe(OvertimeStatus.APPROVED);
    });

    it("should reject approval when request is no longer pending", async () => {
      mockOvertimeRepo.findById.mockResolvedValueOnce({
        id: "overtime-1",
        userId: "user-1",
        status: OvertimeStatus.APPROVED,
      });

      await expect(
        service.approveRequest("overtime-1", "admin-1"),
      ).rejects.toThrow("Only pending overtime requests can be approved");
      expect(mockOvertimeRepo.update).not.toHaveBeenCalled();
    });
  });

  describe("rejectRequest", () => {
    it("should reject request with reason", async () => {
      mockOvertimeRepo.findById.mockResolvedValueOnce({
        id: "overtime-1",
        userId: "user-1",
        status: OvertimeStatus.PENDING,
      });
      mockOvertimeRepo.update.mockResolvedValueOnce({
        id: "overtime-1",
        status: OvertimeStatus.REJECTED,
        rejectedReason: "Overtime not needed",
      });

      const result = await service.rejectRequest(
        "overtime-1",
        "Overtime not needed",
      );

      expect(result.status).toBe(OvertimeStatus.REJECTED);
    });

    it("should reject only pending requests", async () => {
      mockOvertimeRepo.findById.mockResolvedValueOnce({
        id: "overtime-1",
        userId: "user-1",
        status: OvertimeStatus.REJECTED,
      });

      await expect(
        service.rejectRequest("overtime-1", "Already rejected"),
      ).rejects.toThrow("Only pending overtime requests can be rejected");
      expect(mockOvertimeRepo.update).not.toHaveBeenCalled();
    });
  });

  describe("startOvertime", () => {
    it("should schedule auto checkout after overtime starts", async () => {
      const startTime = new Date("2026-04-18T10:00:00.000Z");

      mockOvertimeRepo.findById.mockResolvedValueOnce({
        id: "overtime-1",
        userId: "user-1",
        status: OvertimeStatus.APPROVED,
      });
      mockOvertimeRepo.update.mockResolvedValueOnce({
        id: "overtime-1",
        status: OvertimeStatus.IN_PROGRESS,
        startTime,
      });

      await service.startOvertime("user-1", "overtime-1", {
        photo: "start-photo.jpg",
        location: "Office",
        timestamp: startTime,
      });

      expect(mockAutoCheckoutScheduler.schedule).toHaveBeenCalledWith({
        overtimeId: "overtime-1",
        startTime,
      });
    });

    it("should still succeed when scheduling auto checkout fails", async () => {
      const startTime = new Date("2026-04-18T10:00:00.000Z");
      const scheduleError = new Error("redis unavailable");

      mockOvertimeRepo.findById.mockResolvedValueOnce({
        id: "overtime-1",
        userId: "user-1",
        status: OvertimeStatus.APPROVED,
      });
      mockOvertimeRepo.update.mockResolvedValueOnce({
        id: "overtime-1",
        status: OvertimeStatus.IN_PROGRESS,
        startTime,
      });
      mockAutoCheckoutScheduler.schedule.mockRejectedValueOnce(scheduleError);

      const result = await service.startOvertime("user-1", "overtime-1", {
        photo: "start-photo.jpg",
        location: "Office",
        timestamp: startTime,
      });

      expect(result.status).toBe(OvertimeStatus.IN_PROGRESS);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[Overtime] Failed to schedule auto checkout for overtime-1",
        scheduleError,
      );
    });
  });

  describe("stopOvertime", () => {
    it("should auto checkout at 8 hours from overtime start", async () => {
      const startTime = new Date("2026-04-18T10:00:00.000Z");
      const requestedEndTime = new Date("2026-04-18T19:30:00.000Z");
      const autoCheckoutTime = new Date("2026-04-18T18:00:00.000Z");

      mockOvertimeRepo.findById.mockResolvedValueOnce({
        id: "overtime-1",
        userId: "user-1",
        status: OvertimeStatus.IN_PROGRESS,
        startTime,
      });
      mockOvertimeRepo.update.mockResolvedValueOnce({
        id: "overtime-1",
        status: OvertimeStatus.COMPLETED,
        endTime: autoCheckoutTime,
        duration: 480,
      });

      const result = await service.stopOvertime("user-1", "overtime-1", {
        photo: "stop-photo.jpg",
        location: "Office",
        timestamp: requestedEndTime,
      });

      expect(mockOvertimeRepo.update).toHaveBeenCalledWith("overtime-1", {
        status: OvertimeStatus.COMPLETED,
        endTime: autoCheckoutTime,
        endPhoto: "stop-photo.jpg",
        endLocation: "Office",
        duration: 480,
      });
      expect(mockAutoCheckoutScheduler.cancel).toHaveBeenCalledWith(
        "overtime-1",
      );
      expect(result.endTime).toEqual(autoCheckoutTime);
      expect(result.duration).toBe(480);
    });

    it("should keep requested end time when stopping before 8 hours", async () => {
      const startTime = new Date("2026-04-18T10:00:00.000Z");
      const requestedEndTime = new Date("2026-04-18T15:30:00.000Z");

      mockOvertimeRepo.findById.mockResolvedValueOnce({
        id: "overtime-1",
        userId: "user-1",
        status: OvertimeStatus.IN_PROGRESS,
        startTime,
      });
      mockOvertimeRepo.update.mockResolvedValueOnce({
        id: "overtime-1",
        status: OvertimeStatus.COMPLETED,
        endTime: requestedEndTime,
        duration: 330,
      });

      const result = await service.stopOvertime("user-1", "overtime-1", {
        photo: "stop-photo.jpg",
        location: "Office",
        timestamp: requestedEndTime,
      });

      expect(mockOvertimeRepo.update).toHaveBeenCalledWith("overtime-1", {
        status: OvertimeStatus.COMPLETED,
        endTime: requestedEndTime,
        endPhoto: "stop-photo.jpg",
        endLocation: "Office",
        duration: 330,
      });
      expect(mockAutoCheckoutScheduler.cancel).toHaveBeenCalledWith(
        "overtime-1",
      );
      expect(result.endTime).toEqual(requestedEndTime);
      expect(result.duration).toBe(330);
    });

    it("should still succeed when cancelling auto checkout fails", async () => {
      const startTime = new Date("2026-04-18T10:00:00.000Z");
      const requestedEndTime = new Date("2026-04-18T15:30:00.000Z");
      const cancelError = new Error("redis unavailable");

      mockOvertimeRepo.findById.mockResolvedValueOnce({
        id: "overtime-1",
        userId: "user-1",
        status: OvertimeStatus.IN_PROGRESS,
        startTime,
      });
      mockOvertimeRepo.update.mockResolvedValueOnce({
        id: "overtime-1",
        status: OvertimeStatus.COMPLETED,
        endTime: requestedEndTime,
        duration: 330,
      });
      mockAutoCheckoutScheduler.cancel.mockRejectedValueOnce(cancelError);

      const result = await service.stopOvertime("user-1", "overtime-1", {
        photo: "stop-photo.jpg",
        location: "Office",
        timestamp: requestedEndTime,
      });

      expect(result.status).toBe(OvertimeStatus.COMPLETED);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[Overtime] Failed to cancel auto checkout for overtime-1",
        cancelError,
      );
    });
  });

  describe("deleteOvertime", () => {
    it("should delete overtime record", async () => {
      mockOvertimeRepo.delete.mockResolvedValueOnce({ id: "overtime-1" });

      await service.deleteOvertime("overtime-1");

      expect(mockOvertimeRepo.delete).toHaveBeenCalledWith("overtime-1");
    });
  });

  describe("getHistory", () => {
    it("should return overtime history for user", async () => {
      const mockHistory = [
        { id: "ot-1", status: OvertimeStatus.COMPLETED },
        { id: "ot-2", status: OvertimeStatus.PENDING },
      ];
      // getHistory calls findAll, not getByUserId
      mockOvertimeRepo.findAll.mockResolvedValue(mockHistory);

      const result = await service.getHistory("user-1");

      expect(result).toBeDefined();
      expect(mockOvertimeRepo.findAll).toHaveBeenCalledWith({
        userId: "user-1",
      });
    });
  });
});
